/**
 * core-do.ts — CpuCoreDO: Per-core Durable Object wrapping a QEMU WASM instance.
 *
 * Each instance represents one x86 CPU core. It runs its own QEMU emulator
 * with a private WASM linear memory, LAPIC, and demand-paged RAM via SQLite.
 * Communicates with the CoordinatorDO via RPC for memory coherence and
 * IPI routing.
 *
 * Replaces the previous v86-based implementation with QEMU v5 (Emscripten,
 * no ASYNCIFY). Key differences:
 *   - APIC access via exported C functions (not WASM memory offsets)
 *   - Demand-paged RAM via SqlPageStore (SQLite-backed, synchronous)
 *   - Display via QEMU's display callback system
 *   - AP boot via wasm_cpu_set_sipi_vector + wasm_cpu_resume
 */

import { DurableObject } from "cloudflare:workers";
import { QEMUWrapper, type QEMUWrapperConfig } from "./qemu-wrapper";
import { SqlPageStore } from "./sql-page-store";
import { CorePageCache, CorePageState, PAGE_SIZE } from "./memory-coherence";
import { type IPIMessage, DeliveryMode } from "./ipi-handler";
import { LOG_PREFIX } from "./types";
import type { SqlHandle } from "./types";

// ── Core States ──────────────────────────────────────────────────────────────

export const enum CoreState {
  IDLE = "idle",
  CREATING = "creating",
  WAITING_FOR_SIPI = "waiting_for_sipi",
  RUNNING = "running",
  HALTED = "halted",
}

// ── Core Configuration ──────────────────────────────────────────────────────

export interface CoreConfig {
  apicId: number;
  isBSP: boolean;
  memorySizeBytes: number;
  vgaMemorySizeBytes: number;
  /** SeaBIOS binary (required for both BSP and AP). */
  bios: ArrayBuffer;
  /** VGA BIOS binary (required for both BSP and AP). */
  vgaBios: ArrayBuffer;
  /** Disk image (BSP only). */
  disk?: ArrayBuffer;
  diskDrive?: "fda" | "cdrom";
}

// ── QEMU tuning defaults ────────────────────────────────────────────────────

/** WASM linear memory hot window for guest RAM (MB). */
const WASM_HEAP_MB = 48;

/** Max hot page frames in the SqlPageStore. */
const HOT_PAGES_MAX = 8192; // 32MB

// ── Env interface ───────────────────────────────────────────────────────────

export interface CpuCoreEnv {
  COORDINATOR: DurableObjectNamespace;
  CPU_CORE: DurableObjectNamespace;
}

// ── CpuCoreDO ────────────────────────────────────────────────────────────────

export class CpuCoreDO extends DurableObject<CpuCoreEnv> {
  // ── Core identity ──────────────────────────────────────────────────────
  private apicId: number = -1;
  private isBSP: boolean = false;
  private state: CoreState = CoreState.IDLE;

  // ── QEMU emulator ──────────────────────────────────────────────────────
  private qemu: QEMUWrapper | null = null;
  private sqlPageStore: SqlPageStore | null = null;
  private serialBuffer: string = "";

  // ── Memory coherence ──────────────────────────────────────────────────
  private pageCache: CorePageCache | null = null;

  // ── Coordinator stub (for RPC calls back to coordinator) ───────────────
  private coordinatorId: string | null = null;

  // ── Pending IPI queue (injected while core is executing) ───────────────
  private pendingIPIs: IPIMessage[] = [];

  constructor(ctx: DurableObjectState, env: CpuCoreEnv) {
    super(ctx, env);
  }

  // ── RPC: Called by CoordinatorDO ───────────────────────────────────────

  /**
   * Initialize this core with configuration.
   * For BSP: creates a full QEMU instance with BIOS and disk.
   * For AP: creates state, waits for SIPI to create the QEMU instance.
   */
  async init(config: CoreConfig, coordinatorId: string): Promise<{ status: string }> {
    this.apicId = config.apicId;
    this.isBSP = config.isBSP;
    this.coordinatorId = coordinatorId;
    this.pageCache = new CorePageCache(this.apicId);
    this.state = CoreState.CREATING;

    console.log(`${LOG_PREFIX} Core ${this.apicId} init (BSP=${this.isBSP})`);

    // Initialize SqlPageStore (uses DO SQLite — synchronous)
    const sqlHandle = this.ctx.storage.sql as unknown as SqlHandle;
    this.sqlPageStore = new SqlPageStore(sqlHandle, HOT_PAGES_MAX);
    this.sqlPageStore.init();

    if (this.isBSP) {
      await this.createBSPEmulator(config);
    }
    // AP cores don't create emulators yet — wait for SIPI

    return { status: "initialized" };
  }

  /**
   * Start executing (BSP only — APs start via SIPI).
   */
  async start(): Promise<void> {
    if (!this.qemu) throw new Error("Core not initialized");
    this.state = CoreState.RUNNING;
    console.log(`${LOG_PREFIX} Core ${this.apicId} started execution`);
  }

  /**
   * Stop execution.
   */
  async stop(): Promise<void> {
    if (this.qemu) {
      this.qemu.stop();
    }
    this.state = CoreState.HALTED;
    console.log(`${LOG_PREFIX} Core ${this.apicId} stopped`);
  }

  /**
   * INIT reset — resets CPU to initial state, waits for SIPI.
   */
  async initReset(): Promise<void> {
    console.log(`${LOG_PREFIX} Core ${this.apicId} received INIT — resetting`);
    if (this.qemu) {
      this.qemu.halt();
    }
    this.state = CoreState.WAITING_FOR_SIPI;
  }

  /**
   * SIPI — start execution at vector * 0x1000.
   * This is where AP cores begin their journey.
   *
   * @param vector  SIPI vector (start address = vector * 0x1000)
   * @param memoryConfig  Memory configuration + BIOS binaries
   * @param trampolinePages  Low-memory pages copied from BSP, keyed by page-aligned address.
   */
  async startupIPI(vector: number, memoryConfig: {
    memorySizeBytes: number;
    vgaMemorySizeBytes: number;
    bios: ArrayBuffer;
    vgaBios: ArrayBuffer;
  }, trampolinePages: Map<number, ArrayBuffer>): Promise<void> {
    const startAddr = vector * 0x1000;
    console.log(
      `${LOG_PREFIX} Core ${this.apicId} received SIPI — start at 0x${startAddr.toString(16)} ` +
      `(${trampolinePages.size} trampoline pages)`,
    );

    if (!this.qemu) {
      // Create the QEMU instance for this AP
      await this.createAPEmulator(memoryConfig, trampolinePages);
    } else {
      // QEMU already exists (e.g., from a previous INIT+SIPI cycle).
      // Write trampoline pages into WASM memory.
      this.qemu.writePages(trampolinePages);
    }

    // Set SIPI vector and resume — QEMU's CPU will start at vector:0000
    this.qemu!.handleSIPI(vector);
    this.state = CoreState.RUNNING;
  }

  /**
   * Inject an interrupt into this core's LAPIC.
   * Uses the QEMU bridge export wasm_apic_inject_irq().
   */
  async injectInterrupt(ipi: IPIMessage): Promise<void> {
    if (this.qemu) {
      const triggerMode = ipi.triggerMode ? 1 : 0;

      if (ipi.mode === DeliveryMode.FIXED || ipi.mode === DeliveryMode.LOWEST_PRIORITY) {
        this.qemu.injectInterrupt(ipi.vector, triggerMode);
      } else if (ipi.mode === DeliveryMode.NMI) {
        // NMI is vector 2
        this.qemu.injectInterrupt(2, 0);
      }
      // INIT and SIPI are handled separately by initReset() / startupIPI()
    } else {
      // Queue for when QEMU is created
      this.pendingIPIs.push(ipi);
    }
  }

  /**
   * Memory coherence: invalidate a page (coordinator tells us to drop it).
   */
  async invalidatePage(physAddr: number): Promise<void> {
    if (this.pageCache) {
      this.pageCache.invalidate(physAddr);
    }
  }

  /**
   * Memory coherence: write back a dirty page to the coordinator.
   */
  async writeback(physAddr: number): Promise<ArrayBuffer> {
    if (!this.sqlPageStore) throw new Error("Core not running");

    // Read page data from the SqlPageStore (hot cache or SQLite)
    const data = this.sqlPageStore.pageIn(physAddr);
    const pageData = new ArrayBuffer(PAGE_SIZE);
    new Uint8Array(pageData).set(data);

    // Downgrade to SHARED
    if (this.pageCache) {
      this.pageCache.setPage(physAddr, CorePageState.SHARED, physAddr);
    }

    return pageData;
  }

  /**
   * Read a range of physical memory pages from this core's QEMU instance.
   * Used by the coordinator to fetch trampoline pages for AP boot.
   */
  async readPages(startAddr: number, numPages: number): Promise<Array<[number, ArrayBuffer]>> {
    if (!this.qemu) throw new Error("Core not running");
    return this.qemu.readPages(startAddr, numPages);
  }

  // ── Screen / Display ───────────────────────────────────────────────────

  /**
   * Get graphical screen frame data (BSP only).
   * Returns null if not in graphical mode or no display data.
   *
   * Returns an ArrayBuffer with 12-byte header:
   *   [width:u32, height:u32, bufferWidth:u32, rgba...]
   *
   * Same format as the previous v86 implementation for compatibility
   * with CoordinatorDO's render pipeline.
   */
  async getScreenFrame(): Promise<ArrayBuffer | null> {
    if (!this.qemu || !this.isBSP) return null;
    if (!this.qemu.isGraphicalMode()) return null;
    return this.qemu.getScreenFrame();
  }

  /**
   * Get text screen content. Returns null if in graphical mode.
   * Note: QEMU's text mode output goes through serial (stdio),
   * not through a separate text-mode adapter like v86.
   */
  async getTextScreen(): Promise<{ cols: number; rows: number; lines: string[] } | null> {
    // QEMU in nographic mode uses serial for text output.
    // We don't have a separate text mode adapter — serial output
    // is captured in serialBuffer and sent as serial data.
    // Return null to signal that the coordinator should use serial data instead.
    return null;
  }

  /**
   * Check if VGA is in graphical mode.
   */
  async isGraphicalMode(): Promise<boolean> {
    if (!this.qemu) return false;
    return this.qemu.isGraphicalMode();
  }

  /**
   * Flush and return any buffered serial output.
   */
  async flushSerial(): Promise<string | null> {
    if (this.serialBuffer.length === 0) return null;
    const data = this.serialBuffer;
    this.serialBuffer = "";
    return data;
  }

  // ── Input forwarding ──────────────────────────────────────────────────
  // QEMU handles keyboard/mouse through its device models.
  // In nographic mode, input goes through the serial port.
  // For graphical mode, we'd need to inject PS/2 scancodes.
  // The existing methods are maintained for API compatibility.

  /**
   * Forward keyboard scancode to this core's QEMU.
   * TODO: Implement PS/2 keyboard injection via QEMU bridge export.
   */
  async sendKeyCode(_code: number, _isUp: boolean): Promise<void> {
    // Stub — QEMU keyboard injection requires additional bridge exports
    // (wasm_keyboard_inject_scancode). For now, input flows through serial.
  }

  /**
   * Send mouse movement delta.
   * TODO: Implement PS/2 mouse injection via QEMU bridge export.
   */
  async sendMouseDelta(_dx: number, _dy: number): Promise<void> {
    // Stub — mouse injection needs wasm_mouse_inject_delta
  }

  /**
   * Send mouse button state.
   */
  async sendMouseClick(_buttons: [boolean, boolean, boolean]): Promise<void> {
    // Stub
  }

  /**
   * Send text string (types it via serial).
   */
  async sendText(_data: string): Promise<void> {
    // TODO: Inject text via QEMU's serial input
  }

  /**
   * Send raw scancodes.
   */
  async sendScancodes(_codes: number[]): Promise<void> {
    // Stub
  }

  /**
   * Get core status.
   */
  async getStatus(): Promise<{
    apicId: number;
    state: string;
    isBSP: boolean;
    pageStats: { cached: number; hits: number; misses: number; upgrades: number } | null;
    ramStats: {
      hotPages: number;
      dirtyPages: number;
      freeFrames: number;
      totalFrames: number;
      accessCounter: number;
    } | null;
    cpuHalted: boolean;
  }> {
    return {
      apicId: this.apicId,
      state: this.state,
      isBSP: this.isBSP,
      pageStats: this.pageCache?.stats ?? null,
      ramStats: this.sqlPageStore?.stats ?? null,
      cpuHalted: this.qemu?.isCpuHalted() ?? true,
    };
  }

  // ── Emulator creation ─────────────────────────────────────────────────

  /**
   * Create and boot the BSP QEMU instance.
   *
   * Steps:
   *  1. Create QEMUWrapper with full boot config (BIOS, disk)
   *  2. QEMU's callMain() registers the emscripten_set_main_loop callback
   *  3. The JS event loop drives QEMU execution automatically
   *  4. Set APIC ID = 0 for BSP
   */
  private async createBSPEmulator(config: CoreConfig): Promise<void> {
    if (!config.bios || !config.vgaBios) {
      throw new Error("BSP requires bios and vgaBios");
    }

    if (!this.sqlPageStore) {
      throw new Error("SqlPageStore not initialized");
    }

    const wrapperConfig: QEMUWrapperConfig = {
      apicId: config.apicId,
      isBSP: true,
      memorySizeMB: Math.ceil(config.memorySizeBytes / (1024 * 1024)),
      wasmHeapMB: WASM_HEAP_MB,
      sqlPageStore: this.sqlPageStore,
      biosData: config.bios,
      vgaBiosData: config.vgaBios,
      diskData: config.disk,
      diskDrive: config.diskDrive,
      onSerialOutput: (char: string) => {
        this.serialBuffer += char;
        // Cap buffer to avoid unbounded growth between polls
        if (this.serialBuffer.length > 4096) {
          this.serialBuffer = this.serialBuffer.slice(-2048);
        }
      },
      onIPISend: (ipi: IPIMessage) => {
        // Don't route self-targeted IPIs
        if (ipi.to === this.apicId) return;
        this.routeIPIToCoordinator(ipi);
      },
    };

    this.qemu = new QEMUWrapper();
    await this.qemu.init(wrapperConfig);

    // BSP owns all memory initially
    if (this.pageCache) {
      this.pageCache.markAllWritable();
    }

    console.log(
      `${LOG_PREFIX} BSP emulator created (QEMU, mem=${config.memorySizeBytes / 1024 / 1024}MB, ` +
      `heap=${WASM_HEAP_MB}MB, hot=${HOT_PAGES_MAX} frames)`,
    );
  }

  /**
   * Create a QEMU instance for an Application Processor.
   *
   * Strategy: Start QEMU with -S (paused). Copy trampoline pages from BSP.
   * When SIPI arrives, call handleSIPI(vector) which sets CS:IP and resumes.
   */
  private async createAPEmulator(
    memoryConfig: {
      memorySizeBytes: number;
      vgaMemorySizeBytes: number;
      bios: ArrayBuffer;
      vgaBios: ArrayBuffer;
    },
    trampolinePages: Map<number, ArrayBuffer>,
  ): Promise<void> {
    if (!this.sqlPageStore) {
      throw new Error("SqlPageStore not initialized");
    }

    const wrapperConfig: QEMUWrapperConfig = {
      apicId: this.apicId,
      isBSP: false,
      memorySizeMB: Math.ceil(memoryConfig.memorySizeBytes / (1024 * 1024)),
      wasmHeapMB: WASM_HEAP_MB,
      sqlPageStore: this.sqlPageStore,
      biosData: memoryConfig.bios,
      vgaBiosData: memoryConfig.vgaBios,
      // No disk for AP
      onSerialOutput: (char: string) => {
        this.serialBuffer += char;
        if (this.serialBuffer.length > 4096) {
          this.serialBuffer = this.serialBuffer.slice(-2048);
        }
      },
      onIPISend: (ipi: IPIMessage) => {
        if (ipi.to === this.apicId) return;
        this.routeIPIToCoordinator(ipi);
      },
    };

    this.qemu = new QEMUWrapper();
    await this.qemu.init(wrapperConfig);

    // Copy trampoline pages from BSP into AP's WASM memory
    this.qemu.writePages(trampolinePages);

    console.log(
      `${LOG_PREFIX} AP Core ${this.apicId}: QEMU created, ` +
      `${trampolinePages.size} trampoline pages installed`,
    );

    // Inject any pending IPIs that arrived before the emulator was created
    for (const ipi of this.pendingIPIs) {
      const triggerMode = ipi.triggerMode ? 1 : 0;
      if (ipi.mode === DeliveryMode.FIXED || ipi.mode === DeliveryMode.LOWEST_PRIORITY) {
        this.qemu.injectInterrupt(ipi.vector, triggerMode);
      } else if (ipi.mode === DeliveryMode.NMI) {
        this.qemu.injectInterrupt(2, 0);
      }
    }
    this.pendingIPIs = [];
  }

  // ── IPI routing ───────────────────────────────────────────────────────

  /**
   * Send an IPI to the coordinator for routing.
   * Async fire-and-forget from the execution context.
   */
  private routeIPIToCoordinator(ipi: IPIMessage): void {
    if (!this.coordinatorId) return;

    const coordId = this.env.COORDINATOR.idFromString(this.coordinatorId);
    const coordStub = this.env.COORDINATOR.get(coordId);

    // Fire-and-forget — the execution callbacks are synchronous,
    // but the RPC promise will resolve on the next event loop tick.
    const rpc = coordStub as unknown as { routeIPI(ipi: IPIMessage): Promise<void> };
    rpc.routeIPI(ipi).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`${LOG_PREFIX} Core ${this.apicId} failed to route IPI: ${msg}`);
    });
  }

  // ── HTTP handler (for direct DO access, debugging) ────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(await this.getStatus());
    }

    return new Response("CpuCoreDO (QEMU)", { status: 200 });
  }
}
