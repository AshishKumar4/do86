/**
 * core-do.ts — CpuCoreDO: Per-core Durable Object wrapping a v86 instance.
 *
 * Each instance represents one x86 CPU core. It runs its own v86 emulator
 * with a private WASM linear memory, LAPIC, and TLB. Communicates with the
 * CoordinatorDO via RPC for memory coherence and IPI routing.
 */

import { DurableObject } from "cloudflare:workers";
import type { V86 as V86Type } from "v86";
import v86WasmModule from "./v86.wasm";
import "./screen-adapter";

import { CorePageCache, CorePageState, PAGE_SIZE } from "./memory-coherence";
import { type IPIMessage, DeliveryMode } from "./ipi-handler";
import { LOG_PREFIX } from "./types";
import { DOScreenAdapter } from "./screen-adapter";

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
  /** BIOS binary (only for BSP). */
  bios?: ArrayBuffer;
  /** VGA BIOS binary (only for BSP). */
  vgaBios?: ArrayBuffer;
  /** Disk image (only for BSP). */
  disk?: ArrayBuffer;
  diskDrive?: "fda" | "cdrom";
}

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

  // ── Emulator ───────────────────────────────────────────────────────────
  private emulator: V86Type | null = null;
  private screenAdapter: DOScreenAdapter | null = null;
  private executionTimer: ReturnType<typeof setInterval> | null = null;

  // ── Memory coherence ──────────────────────────────────────────────────
  private pageCache: CorePageCache | null = null;

  // ── Coordinator stub (for RPC calls back to coordinator) ───────────────
  private coordinatorId: string | null = null;

  // ── Pending IPI queue (injected while core is executing) ───────────────
  private pendingIPIs: IPIMessage[] = [];

  // ── ICR monitoring (to detect outbound IPIs after each execution cycle)─
  private lastICRLow: number = 0;
  private lastICRHigh: number = 0;

  constructor(ctx: DurableObjectState, env: CpuCoreEnv) {
    super(ctx, env);
  }

  // ── RPC: Called by CoordinatorDO ───────────────────────────────────────

  /**
   * Initialize this core with configuration.
   * For BSP: creates a full v86 instance with BIOS and disk.
   * For AP: creates a minimal v86 instance waiting for SIPI.
   */
  async init(config: CoreConfig, coordinatorId: string): Promise<{ status: string }> {
    this.apicId = config.apicId;
    this.isBSP = config.isBSP;
    this.coordinatorId = coordinatorId;
    this.pageCache = new CorePageCache(this.apicId);
    this.state = CoreState.CREATING;

    console.log(`${LOG_PREFIX} Core ${this.apicId} init (BSP=${this.isBSP})`);

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
    if (!this.emulator) throw new Error("Core not initialized");
    this.state = CoreState.RUNNING;
    this.startExecutionLoop();
    console.log(`${LOG_PREFIX} Core ${this.apicId} started execution`);
  }

  /**
   * Stop execution.
   */
  async stop(): Promise<void> {
    this.stopExecutionLoop();
    this.state = CoreState.HALTED;
    console.log(`${LOG_PREFIX} Core ${this.apicId} stopped`);
  }

  /**
   * INIT reset — resets CPU to initial state, waits for SIPI.
   */
  async initReset(): Promise<void> {
    console.log(`${LOG_PREFIX} Core ${this.apicId} received INIT — resetting`);
    this.stopExecutionLoop();
    // If there's an existing emulator, reset it
    if (this.emulator) {
      try { (this.emulator as any).stop?.(); } catch { /* ok */ }
      try { (this.emulator as any).destroy?.(); } catch { /* ok */ }
      this.emulator = null;
    }
    this.state = CoreState.WAITING_FOR_SIPI;
  }

  /**
   * SIPI — start execution at vector * 0x1000.
   * This is where AP cores begin their journey.
   */
  async startupIPI(vector: number, memoryConfig: {
    memorySizeBytes: number;
    bios: ArrayBuffer;
    vgaBios: ArrayBuffer;
  }): Promise<void> {
    const startAddr = vector * 0x1000;
    console.log(`${LOG_PREFIX} Core ${this.apicId} received SIPI — start at 0x${startAddr.toString(16)}`);

    // Create a minimal v86 instance for this AP
    // The AP will start executing from the trampoline code that the BSP
    // placed at the SIPI vector address
    await this.createAPEmulator(memoryConfig, startAddr);
    this.state = CoreState.RUNNING;
    this.startExecutionLoop();
  }

  /**
   * Inject an interrupt into this core's LAPIC.
   * The interrupt will be picked up on the next execution cycle.
   */
  async injectInterrupt(ipi: IPIMessage): Promise<void> {
    this.pendingIPIs.push(ipi);
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
    if (!this.emulator) throw new Error("Core not running");

    // Read page data from v86 WASM linear memory
    const wasmMemory = (this.emulator as any).v86?.cpu?.wasm_memory;
    if (!wasmMemory) throw new Error("No WASM memory");

    const pageData = new ArrayBuffer(PAGE_SIZE);
    new Uint8Array(pageData).set(
      new Uint8Array(wasmMemory.buffer, physAddr, PAGE_SIZE),
    );

    // Downgrade to SHARED
    if (this.pageCache) {
      this.pageCache.setPage(physAddr, CorePageState.SHARED, physAddr);
    }

    return pageData;
  }

  /**
   * Get screen frame data (BSP only).
   * Called by coordinator to forward to browser clients.
   */
  async getScreenFrame(): Promise<ArrayBuffer | null> {
    if (!this.emulator || !this.screenAdapter || !this.isBSP) return null;

    const vga = (this.emulator as any)?.v86?.cpu?.devices?.vga;
    if (!vga || !vga.graphical_mode) return null;

    // Read pixels from WASM memory
    const cpu = vga.cpu;
    if (!cpu?.wasm_memory?.buffer) return null;

    const width = vga.screen_width;
    const height = vga.screen_height;
    if (!width || !height) return null;

    const bufferWidth = vga.virtual_width || width;
    const offset = vga.dest_buffet_offset;
    if (offset == null) return null;

    vga.complete_redraw();
    vga.screen_fill_buffer();

    const byteLen = bufferWidth * height * 4;
    const wasmBuf = cpu.wasm_memory.buffer;
    if (offset + byteLen > wasmBuf.byteLength) return null;

    // Copy frame data (don't share the WASM memory directly)
    const frame = new ArrayBuffer(byteLen + 12);
    const view = new DataView(frame);
    view.setUint32(0, width, true);
    view.setUint32(4, height, true);
    view.setUint32(8, bufferWidth, true);
    new Uint8Array(frame, 12).set(new Uint8Array(wasmBuf, offset, byteLen));

    return frame;
  }

  /**
   * Forward keyboard input to this core's v86 (BSP only).
   */
  async sendKeyCode(code: number, isUp: boolean): Promise<void> {
    if (!this.emulator) return;
    const bus = this.emulator.bus;
    if (!bus) return;
    bus.send("keyboard-code", isUp ? (code | 0x80) : code);
  }

  /**
   * Get core status.
   */
  async getStatus(): Promise<{
    apicId: number;
    state: string;
    isBSP: boolean;
    pageStats: { cached: number; hits: number; misses: number; upgrades: number } | null;
  }> {
    return {
      apicId: this.apicId,
      state: this.state,
      isBSP: this.isBSP,
      pageStats: this.pageCache?.stats ?? null,
    };
  }

  // ── Emulator creation ─────────────────────────────────────────────────

  private async createBSPEmulator(config: CoreConfig): Promise<void> {
    if (!config.bios || !config.vgaBios || !config.disk) {
      throw new Error("BSP requires bios, vgaBios, and disk");
    }

    this.screenAdapter = new DOScreenAdapter();
    const { V86 } = await import("v86");

    // Synthetic microtick (same as LinuxVM)
    let syntheticTime = performance.now();
    let lastRealTime = syntheticTime;
    (V86 as any).microtick = () => {
      const realNow = performance.now();
      if (realNow > lastRealTime) {
        syntheticTime = realNow;
        lastRealTime = realNow;
      } else {
        syntheticTime += 0.02;
      }
      return syntheticTime;
    };

    const v86Config: Record<string, any> = {
      wasm_fn: async (env: any) => (await WebAssembly.instantiate(v86WasmModule, env)).exports,
      bios: { buffer: config.bios },
      vga_bios: { buffer: config.vgaBios },
      memory_size: config.memorySizeBytes,
      vga_memory_size: config.vgaMemorySizeBytes,
      autostart: false,
      disable_speaker: true,
      fastboot: true,
      acpi: true,
      boot_order: config.diskDrive === "cdrom" ? 0x213 : 0x312,
    };

    if (config.diskDrive === "fda") {
      v86Config.fda = { buffer: config.disk };
    } else {
      v86Config.cdrom = { buffer: config.disk };
    }

    this.emulator = new V86(v86Config);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Emulator load timed out")), 30_000);
      this.emulator!.add_listener("emulator-loaded", () => {
        clearTimeout(timeout);
        const vga = (this.emulator as any)?.v86?.cpu?.devices?.vga;
        if (vga) {
          vga.screen = this.screenAdapter;
        }
        this.emulator!.run();
        resolve();
      });
    });

    // BSP owns all memory initially
    if (this.pageCache) {
      this.pageCache.markAllWritable();
    }

    console.log(`${LOG_PREFIX} BSP emulator created (mem=${config.memorySizeBytes / 1024 / 1024}MB)`);
  }

  private async createAPEmulator(
    memoryConfig: { memorySizeBytes: number; bios: ArrayBuffer; vgaBios: ArrayBuffer },
    startAddr: number,
  ): Promise<void> {
    // AP cores need a v86 instance but start from a specific address.
    // For now, we create a full v86 and will set the IP after boot.
    // TODO: Proper AP initialization — this is a skeleton.
    console.log(
      `${LOG_PREFIX} AP Core ${this.apicId} emulator created (start=0x${startAddr.toString(16)})`,
    );
    // AP emulator creation will be implemented in Phase 3
    // It needs: (1) shared memory page fetching, (2) IP set to startAddr,
    // (3) real-mode execution of the trampoline code
  }

  // ── Execution loop ────────────────────────────────────────────────────

  private startExecutionLoop(): void {
    if (this.executionTimer) return;
    this.executionTimer = setInterval(() => {
      this.executionCycle();
    }, 0);
  }

  private stopExecutionLoop(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
      this.executionTimer = null;
    }
  }

  private executionCycle(): void {
    if (!this.emulator || this.state !== CoreState.RUNNING) return;

    try {
      // Inject pending IPIs into LAPIC before executing
      this.injectPendingIPIs();

      // Run v86 for one frame
      // main_loop() returns sleep time in ms
      // (we access it through the internal v86 object)
      const v86Internal = (this.emulator as any).v86;
      if (v86Internal) {
        v86Internal.do_tick();
      }

      // Check for outbound IPIs (ICR writes during this cycle)
      this.checkOutboundIPIs();
    } catch (e) {
      console.error(`${LOG_PREFIX} Core ${this.apicId} execution error:`, e);
    }
  }

  // ── IPI handling ──────────────────────────────────────────────────────

  private injectPendingIPIs(): void {
    if (this.pendingIPIs.length === 0) return;
    if (!this.emulator) return;

    const cpu = (this.emulator as any)?.v86?.cpu;
    if (!cpu) return;

    for (const ipi of this.pendingIPIs) {
      if (ipi.mode === DeliveryMode.FIXED || ipi.mode === DeliveryMode.LOWEST_PRIORITY) {
        // Set IRR bit for the vector in LAPIC
        // LAPIC IRR is at offsets 0x200-0x270 (8 × 32-bit registers)
        // Each bit represents one vector (0-255)
        const regIndex = Math.floor(ipi.vector / 32);
        const bitOffset = ipi.vector % 32;

        // Access LAPIC state via v86's WASM memory
        // The APIC struct address is obtained via get_apic_addr()
        if (typeof cpu.get_apic_addr === "function") {
          const apicAddr = cpu.get_apic_addr();
          const wasmMem = cpu.wasm_memory;
          if (wasmMem) {
            // IRR starts at offset 8 in the Apic struct (after irr[0..7])
            // Each IRR register is 4 bytes (32 bits)
            // The Apic struct layout from v86's apic.rs:
            //   irr: [u32; 8],  offset 0
            //   isr: [u32; 8],  offset 32
            //   tmr: [u32; 8],  offset 64
            //   ...
            const irrOffset = apicAddr + regIndex * 4;
            const view = new DataView(wasmMem.buffer);
            const currentIRR = view.getUint32(irrOffset, true);
            view.setUint32(irrOffset, currentIRR | (1 << bitOffset), true);
          }
        }
      }
      // INIT and SIPI are handled by the coordinator, not injected as interrupts
    }

    this.pendingIPIs = [];
  }

  private checkOutboundIPIs(): void {
    if (!this.emulator) return;

    const cpu = (this.emulator as any)?.v86?.cpu;
    if (!cpu) return;

    // Read current ICR values from LAPIC
    // ICR Low is at LAPIC offset 0x300, ICR High at 0x310
    // In v86's Apic struct: icr0 at offset ~120, icr1 at offset ~124
    // TODO: Find exact offsets in v86's Apic struct for ICR monitoring
    // For now, this is a placeholder — Phase 3 will implement the actual
    // ICR interception, likely by patching v86's apic write handler.
  }

  // ── HTTP handler (for direct DO access, debugging) ────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json(await this.getStatus());
    }

    return new Response("CpuCoreDO", { status: 200 });
  }
}
