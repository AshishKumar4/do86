/**
 * core-do.ts — CpuCoreDO: Per-core Durable Object wrapping a v86 instance.
 *
 * Each instance represents one x86 CPU core. It runs its own v86 emulator
 * with a private WASM linear memory, LAPIC, and TLB. Communicates with the
 * CoordinatorDO via RPC for memory coherence and IPI routing.
 */

import { DurableObject } from "cloudflare:workers";
import type { V86 as V86Type } from "./libv86.mjs";
import v86WasmModule from "./v86.wasm";
import "./screen-adapter";

import { CorePageCache, CorePageState, PAGE_SIZE } from "./memory-coherence";
import { type IPIMessage, DeliveryMode, decodeICR } from "./ipi-handler";
import { LOG_PREFIX } from "./types";
import { DOScreenAdapter } from "./screen-adapter";

// ── v86 APIC struct offsets ─────────────────────────────────────────────────
// The APIC state is 46 x Int32 (184 bytes) at cpu.get_apic_addr().
// These are Int32Array indices — multiply by 4 for byte offsets.
//
// Derived from v86's set_state_apic() in libv86-debug.mjs and apic.rs:
//   [0]      apic_id
//   [1]      lvt_timer
//   [2]      lvt_perf_counter
//   [3]      lvt_int0
//   [4]      lvt_int1
//   [5]      lvt_error
//   [6-15]   timer state (initial_count, divider, ticks, etc.)
//   [16-23]  irr[8]     — Interrupt Request Register (256 bits)
//   [24-31]  isr[8]     — In-Service Register
//   [32-39]  tmr[8]     — Trigger Mode Register
//   [40]     icr0       — ICR Low  (written by guest to send IPIs)
//   [41]     icr1       — ICR High (destination APIC ID in bits 31:24)
//   [42]     svr        — Spurious Vector Register
//   [43]     tpr        — Task Priority Register
//   [44]     timer_divider
//   [45]     timer_divider_shift

const APIC_I32_ICR0 = 40;
const APIC_I32_ICR1 = 41;
const APIC_I32_IRR_BASE = 16;  // irr[0..7] at indices 16-23
const APIC_I32_APIC_ID = 0;

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

// ── v86 CPU register WASM offsets (byte offsets into wasm_memory) ────────────
// These are used to set up AP CPU state after v86 boots from BIOS.

const CPU_WASM_OFF = {
  REG32:              64,   // Int32Array[8] — EAX, ECX, EDX, EBX, ESP, EBP, ESI, EDI
  FLAGS:              120,  // Int32Array[1]
  SEG_ACCESS_BYTES:   512,  // Uint8Array[8] — segment access rights
  INSTRUCTION_PTR:    556,  // Int32Array[1]
  IDTR_SIZE:          564,  // Int32Array[1]
  IDTR_OFFSET:        568,  // Int32Array[1]
  GDTR_SIZE:          572,  // Int32Array[1]
  GDTR_OFFSET:        576,  // Int32Array[1]
  CR:                 580,  // Int32Array[8] — CR0..CR7
  CPL:                612,  // Uint8Array[1]
  IN_HLT:             616,  // Uint8Array[1]
  SREG:               668,  // Uint16Array[8] — ES, CS, SS, DS, FS, GS, ...
  SEG_IS_NULL:        724,  // Uint8Array[8] — 1 if segment is null
  SEG_OFFSETS:        736,  // Int32Array[8]
  SEG_LIMITS:         768,  // Uint32Array[8]
  PROTECTED_MODE:     800,  // Int32Array[1]
  IS_32:              804,  // Int32Array[1]
  STACK_SIZE_32:      808,  // Int32Array[1]
} as const;

// Segment register indices
const SEG_ES = 0, SEG_CS = 1, SEG_SS = 2, SEG_DS = 3, SEG_FS = 4, SEG_GS = 5;

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
  private serialBuffer: string = "";

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
   *
   * @param vector  SIPI vector (start address = vector * 0x1000)
   * @param memoryConfig  Memory configuration + BIOS binaries
   * @param trampolinePages  Low-memory pages copied from BSP, keyed by page-aligned address.
   *                          Must include the trampoline code page(s) and any data pages
   *                          the AP needs during early boot (stack, GDT, etc.)
   */
  async startupIPI(vector: number, memoryConfig: {
    memorySizeBytes: number;
    vgaMemorySizeBytes: number;
    bios: ArrayBuffer;
    vgaBios: ArrayBuffer;
  }, trampolinePages: Map<number, ArrayBuffer>): Promise<void> {
    const startAddr = vector * 0x1000;
    console.log(`${LOG_PREFIX} Core ${this.apicId} received SIPI — start at 0x${startAddr.toString(16)} (${trampolinePages.size} trampoline pages)`);

    // Create a v86 instance for this AP, patch its memory with trampoline
    // pages from BSP, and set CPU registers to 16-bit real mode at CS:IP = vector:0000
    await this.createAPEmulator(memoryConfig, startAddr, trampolinePages);
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
   * Read a range of physical memory pages from this core's v86 instance.
   * Used by the coordinator to fetch trampoline pages for AP boot.
   *
   * @param startAddr  Page-aligned start address
   * @param numPages   Number of 4KB pages to read
   * @returns Array of [physAddr, pageData] pairs
   */
  async readPages(startAddr: number, numPages: number): Promise<Array<[number, ArrayBuffer]>> {
    if (!this.emulator) throw new Error("Core not running");

    const wasmMemory = (this.emulator as any).v86?.cpu?.wasm_memory;
    if (!wasmMemory) throw new Error("No WASM memory");

    const result: Array<[number, ArrayBuffer]> = [];
    for (let i = 0; i < numPages; i++) {
      const addr = startAddr + i * PAGE_SIZE;
      if (addr + PAGE_SIZE > wasmMemory.buffer.byteLength) break;

      const pageData = new ArrayBuffer(PAGE_SIZE);
      new Uint8Array(pageData).set(
        new Uint8Array(wasmMemory.buffer, addr, PAGE_SIZE),
      );
      result.push([addr, pageData]);
    }

    return result;
  }

  // ── Screen / VGA ────────────────────────────────────────────────────

  private getVga(): any {
    return (this.emulator as any)?.v86?.cpu?.devices?.vga ?? null;
  }

  /**
   * Get graphical screen frame data (BSP only).
   * Returns null if not in graphical mode.
   */
  async getScreenFrame(): Promise<ArrayBuffer | null> {
    if (!this.emulator || !this.screenAdapter || !this.isBSP) return null;

    const vga = this.getVga();
    if (!vga || !vga.graphical_mode) return null;

    const cpu = vga.cpu;
    if (!cpu?.wasm_memory?.buffer) return null;

    const width = vga.screen_width;
    const height = vga.screen_height;
    if (!width || !height || width * height > 1280 * 1024) return null;

    const bufferWidth = vga.virtual_width || width;
    const offset = vga.dest_buffet_offset;
    if (offset == null) return null;

    // Fix detached buffer (same as LinuxVM)
    const wasmBuf = cpu.wasm_memory.buffer;
    if (vga.image_data?.data) {
      const backingBuffer = vga.image_data.data.buffer;
      if (backingBuffer !== wasmBuf) {
        const virtualHeight = vga.virtual_height || height;
        const pixelCount = bufferWidth * virtualHeight;
        const freshData = new Uint8ClampedArray(wasmBuf, offset, 4 * pixelCount);
        vga.image_data = new ImageData(freshData, bufferWidth, virtualHeight);
        vga.update_layers();
      }
    }

    vga.complete_redraw();
    vga.screen_fill_buffer();

    const byteLen = bufferWidth * height * 4;
    if (offset + byteLen > wasmBuf.byteLength) return null;

    // Copy frame data — encode header: [width, height, bufferWidth, rgba...]
    const frame = new ArrayBuffer(byteLen + 12);
    const view = new DataView(frame);
    view.setUint32(0, width, true);
    view.setUint32(4, height, true);
    view.setUint32(8, bufferWidth, true);
    new Uint8Array(frame, 12).set(new Uint8Array(wasmBuf, offset, byteLen));

    return frame;
  }

  /**
   * Get text screen content. Returns null if in graphical mode.
   */
  async getTextScreen(): Promise<{ cols: number; rows: number; lines: string[] } | null> {
    if (!this.screenAdapter || !this.isBSP) return null;

    const vga = this.getVga();
    if (vga?.graphical_mode) return null;

    const lines = this.screenAdapter.getTextScreen();
    if (lines.length === 0) return null;

    return {
      cols: this.screenAdapter.textWidth_,
      rows: this.screenAdapter.textHeight_,
      lines,
    };
  }

  /**
   * Check if VGA is in graphical mode.
   */
  async isGraphicalMode(): Promise<boolean> {
    const vga = this.getVga();
    return vga?.graphical_mode ?? false;
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

  /**
   * Forward keyboard scancode to this core's v86.
   * Handles extended keycodes (> 0xFF) by splitting into prefix + code.
   */
  async sendKeyCode(code: number, isUp: boolean): Promise<void> {
    if (!this.emulator) return;
    const bus = this.emulator.bus;
    if (!bus) return;

    if (code > 0xFF) {
      // Extended scancode: send prefix byte, then code byte
      bus.send("keyboard-code", code >> 8);
      bus.send("keyboard-code", isUp ? ((code & 0xFF) | 0x80) : (code & 0xFF));
    } else {
      bus.send("keyboard-code", isUp ? (code | 0x80) : code);
    }
  }

  /**
   * Send mouse movement delta.
   */
  async sendMouseDelta(dx: number, dy: number): Promise<void> {
    if (!this.emulator) return;
    const bus = this.emulator.bus;
    if (!bus) return;
    bus.send("mouse-delta", [dx, -dy]);
  }

  /**
   * Send mouse button state.
   */
  async sendMouseClick(buttons: [boolean, boolean, boolean]): Promise<void> {
    if (!this.emulator) return;
    const bus = this.emulator.bus;
    if (!bus) return;
    bus.send("mouse-click", [...buttons]);
  }

  /**
   * Send text string (types it via keyboard emulation).
   */
  async sendText(data: string): Promise<void> {
    if (!this.emulator) return;
    this.emulator.keyboard_send_text?.(data);
  }

  /**
   * Send raw scancodes.
   */
  async sendScancodes(codes: number[]): Promise<void> {
    if (!this.emulator) return;
    this.emulator.keyboard_send_scancodes?.(codes);
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
    const { V86 } = await import("./libv86.mjs");

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

    // Capture serial output
    this.emulator.add_listener("serial0-output-byte", (byte: number) => {
      const char = String.fromCharCode(byte);
      this.serialBuffer += char;
      // Cap buffer to avoid unbounded growth between polls
      if (this.serialBuffer.length > 4096) {
        this.serialBuffer = this.serialBuffer.slice(-2048);
      }
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Emulator load timed out")), 30_000);
      this.emulator!.add_listener("emulator-loaded", () => {
        clearTimeout(timeout);
        const vga = (this.emulator as any)?.v86?.cpu?.devices?.vga;
        if (vga) {
          vga.screen = this.screenAdapter;
          if (vga.graphical_mode && vga.screen_width > 0) {
            this.screenAdapter!.set_mode(true);
            this.screenAdapter!.set_size_graphical(
              vga.screen_width, vga.screen_height,
              vga.virtual_width, vga.virtual_height,
            );
          }
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

  /**
   * Create a v86 instance for an Application Processor.
   *
   * Strategy: Boot a full v86 with BIOS (needed for device init), wait for it
   * to reach the BIOS reset vector, then:
   *  1. Stop execution
   *  2. Copy trampoline pages from BSP into the AP's WASM linear memory
   *  3. Patch CPU registers to 16-bit real mode at CS:IP = vector:0000
   *  4. Set the APIC ID to this core's ID
   *  5. Resume execution — the AP runs the BSP's trampoline code
   */
  private async createAPEmulator(
    memoryConfig: {
      memorySizeBytes: number;
      vgaMemorySizeBytes: number;
      bios: ArrayBuffer;
      vgaBios: ArrayBuffer;
    },
    startAddr: number,
    trampolinePages: Map<number, ArrayBuffer>,
  ): Promise<void> {
    const { V86 } = await import("./libv86.mjs");

    // Synthetic microtick (same as BSP)
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

    // Create v86 with BIOS — we need the BIOS to initialize devices.
    // We'll override the CPU state after it loads.
    const v86Config: Record<string, any> = {
      wasm_fn: async (env: any) => (await WebAssembly.instantiate(v86WasmModule, env)).exports,
      bios: { buffer: memoryConfig.bios },
      vga_bios: { buffer: memoryConfig.vgaBios },
      memory_size: memoryConfig.memorySizeBytes,
      vga_memory_size: memoryConfig.vgaMemorySizeBytes,
      autostart: false,
      disable_speaker: true,
      fastboot: true,
      acpi: true,
      // No disk for AP — it doesn't boot from disk
    };

    this.emulator = new V86(v86Config);

    // Wait for v86 to finish loading (WASM instantiation)
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("AP emulator load timed out")), 30_000);
      this.emulator!.add_listener("emulator-loaded", () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    // At this point v86 is loaded but not running.
    // Run it briefly to let BIOS POST complete device init, or we can
    // skip that and go straight to patching since AP doesn't need full BIOS.
    // For safety: run one tick to initialize WASM internals, then stop.
    const v86Internal = (this.emulator as any).v86;
    const cpu = v86Internal?.cpu;
    if (!cpu || !cpu.wasm_memory) {
      throw new Error("AP: v86 CPU not available after load");
    }

    // ── Step 1: Copy trampoline pages from BSP into AP's memory ──────
    const wasmBuf = cpu.wasm_memory.buffer;
    const mem8 = new Uint8Array(wasmBuf);

    for (const [addr, pageData] of trampolinePages.entries()) {
      if (addr + PAGE_SIZE <= wasmBuf.byteLength) {
        mem8.set(new Uint8Array(pageData), addr);
      }
    }

    console.log(
      `${LOG_PREFIX} AP Core ${this.apicId}: copied ${trampolinePages.size} trampoline pages to WASM memory`,
    );

    // ── Step 2: Set CPU registers to 16-bit real mode at SIPI vector ─
    const vector = startAddr >>> 12; // SIPI vector = startAddr / 4096

    // Protected mode = off, 16-bit mode
    new Int32Array(wasmBuf, CPU_WASM_OFF.PROTECTED_MODE, 1)[0] = 0;
    new Int32Array(wasmBuf, CPU_WASM_OFF.IS_32, 1)[0] = 0;

    // CPL = 0 (ring 0)
    new Uint8Array(wasmBuf, CPU_WASM_OFF.CPL, 1)[0] = 0;

    // Not halted
    new Uint8Array(wasmBuf, CPU_WASM_OFF.IN_HLT, 1)[0] = 0;

    // EFLAGS = 0x02 (reserved bit 1 always set, interrupts disabled)
    new Int32Array(wasmBuf, CPU_WASM_OFF.FLAGS, 1)[0] = 0x02;

    // Control registers: CR0 = 0 (real mode, no paging)
    const cr = new Int32Array(wasmBuf, CPU_WASM_OFF.CR, 8);
    cr[0] = 0; // PE=0, PG=0

    // Segment registers: real mode defaults
    const sreg = new Uint16Array(wasmBuf, CPU_WASM_OFF.SREG, 8);
    const segOffsets = new Int32Array(wasmBuf, CPU_WASM_OFF.SEG_OFFSETS, 8);
    const segLimits = new Uint32Array(wasmBuf, CPU_WASM_OFF.SEG_LIMITS, 8);

    // CS = vector, CS base = vector << 12
    sreg[SEG_CS] = vector;
    segOffsets[SEG_CS] = startAddr;
    segLimits[SEG_CS] = 0xFFFF;

    // All other segments: 0:0 with 64K limit (real mode default)
    for (const seg of [SEG_ES, SEG_SS, SEG_DS, SEG_FS, SEG_GS]) {
      sreg[seg] = 0;
      segOffsets[seg] = 0;
      segLimits[seg] = 0xFFFF;
    }

    // Segment is_null: all segments are valid (not null)
    const segIsNull = new Uint8Array(wasmBuf, CPU_WASM_OFF.SEG_IS_NULL, 8);
    segIsNull.fill(0);

    // Segment access bytes: real mode defaults
    // In real mode, data segments have 0xF2 (present, ring0, writable data)
    // CS has 0xFA (present, ring0, executable+readable code)
    const segAccessBytes = new Uint8Array(wasmBuf, CPU_WASM_OFF.SEG_ACCESS_BYTES, 8);
    segAccessBytes.fill(0xF2);     // Default: data segment
    segAccessBytes[SEG_CS] = 0xFA; // Code segment

    // Stack size: 16-bit (real mode)
    new Int32Array(wasmBuf, CPU_WASM_OFF.STACK_SIZE_32, 1)[0] = 0;

    // EIP = CS_base + 0 = startAddr (instruction_pointer includes CS base in v86)
    new Int32Array(wasmBuf, CPU_WASM_OFF.INSTRUCTION_PTR, 1)[0] = startAddr;

    // General purpose registers: all zero
    const reg32 = new Int32Array(wasmBuf, CPU_WASM_OFF.REG32, 8);
    reg32.fill(0);

    // GDTR/IDTR: real mode IVT (base=0, limit=0x3FF for IDT, no GDT)
    new Int32Array(wasmBuf, CPU_WASM_OFF.IDTR_OFFSET, 1)[0] = 0;
    new Int32Array(wasmBuf, CPU_WASM_OFF.IDTR_SIZE, 1)[0] = 0x3FF;
    new Int32Array(wasmBuf, CPU_WASM_OFF.GDTR_OFFSET, 1)[0] = 0;
    new Int32Array(wasmBuf, CPU_WASM_OFF.GDTR_SIZE, 1)[0] = 0;

    // ── Step 3: Set APIC ID for this core ────────────────────────────
    const apicAddr = cpu.get_apic_addr?.();
    if (apicAddr && apicAddr > 0) {
      const apicView = new Int32Array(wasmBuf, apicAddr, 46);
      apicView[APIC_I32_APIC_ID] = this.apicId;
    }

    console.log(
      `${LOG_PREFIX} AP Core ${this.apicId}: CPU set to real mode at ${vector.toString(16)}:0000 (phys 0x${startAddr.toString(16)})`,
    );

    // ── Step 4: Enable v86 execution ───────────────────────────────
    // v86's do_tick() checks `this.running` — we must set it to true.
    // We don't call run() because that would schedule BIOS execution.
    // Instead, set the flag directly and let our execution loop call do_tick().
    v86Internal.running = true;
    v86Internal.stopping = false;

    // Capture serial output (for debugging)
    this.emulator.add_listener("serial0-output-byte", (byte: number) => {
      const char = String.fromCharCode(byte);
      this.serialBuffer += char;
      if (this.serialBuffer.length > 4096) {
        this.serialBuffer = this.serialBuffer.slice(-2048);
      }
    });

    console.log(
      `${LOG_PREFIX} AP Core ${this.apicId}: emulator ready, execution will start from trampoline`,
    );
  }

  // ── Execution loop ────────────────────────────────────────────────────

  private startExecutionLoop(): void {
    if (this.executionTimer) return;
    this.executionTimer = setInterval(() => {
      this.executionCycle();
    }, 4);
  }

  private stopExecutionLoop(): void {
    if (this.executionTimer) {
      clearInterval(this.executionTimer);
      this.executionTimer = null;
    }
  }

  private _execErrors = 0;

  private executionCycle(): void {
    if (!this.emulator || this.state !== CoreState.RUNNING) return;

    try {
      // Inject pending IPIs into LAPIC before executing
      this.injectPendingIPIs();

      // Run v86 for one frame
      const v86Internal = (this.emulator as any).v86;
      if (v86Internal) {
        v86Internal.do_tick();
      }

      // Check for outbound IPIs (ICR writes during this cycle)
      this.checkOutboundIPIs();

      this._execErrors = 0; // Reset on success
    } catch (e) {
      this._execErrors++;
      // Log sparingly — OOB reads from APIC polling are noisy but harmless
      if (this._execErrors <= 3 || this._execErrors % 1000 === 0) {
        console.error(`${LOG_PREFIX} Core ${this.apicId} execution error (#${this._execErrors}):`, e);
      }
    }
  }

  // ── IPI handling ──────────────────────────────────────────────────────

  /**
   * Read the APIC struct from WASM memory as an Int32Array view.
   * Returns null if the emulator or APIC isn't available or address is OOB.
   */
  private getApicView(): { view: Int32Array; apicAddr: number } | null {
    try {
      const cpu = (this.emulator as any)?.v86?.cpu;
      if (!cpu || typeof cpu.get_apic_addr !== "function") return null;
      const apicAddr = cpu.get_apic_addr();
      const wasmMem = cpu.wasm_memory;
      if (!wasmMem) return null;
      // 46 x i32 = 184 bytes — verify address is within WASM memory bounds
      const needed = apicAddr + 184;
      if (apicAddr <= 0 || needed > wasmMem.buffer.byteLength) return null;
      const view = new Int32Array(wasmMem.buffer, apicAddr, 46);
      return { view, apicAddr };
    } catch {
      return null;
    }
  }

  /**
   * Inject pending IPIs into this core's LAPIC IRR register.
   *
   * Sets the appropriate bit in irr[vector/32] so v86's handle_irqs()
   * picks it up on the next instruction batch.
   */
  private injectPendingIPIs(): void {
    if (this.pendingIPIs.length === 0) return;

    const apic = this.getApicView();
    if (!apic) {
      this.pendingIPIs = [];
      return;
    }

    for (const ipi of this.pendingIPIs) {
      if (ipi.mode === DeliveryMode.FIXED || ipi.mode === DeliveryMode.LOWEST_PRIORITY) {
        // IRR is 8 x u32 at indices APIC_I32_IRR_BASE..APIC_I32_IRR_BASE+7
        // Each bit = one vector. vector 0 = IRR[16] bit 0, vector 33 = IRR[17] bit 1, etc.
        const regIndex = (ipi.vector >>> 5);          // ipi.vector / 32
        const bitOffset = ipi.vector & 0x1F;          // ipi.vector % 32
        const irrIndex = APIC_I32_IRR_BASE + regIndex;
        apic.view[irrIndex] |= (1 << bitOffset);
      }
      // NMI: inject as vector 2
      else if (ipi.mode === DeliveryMode.NMI) {
        const irrIndex = APIC_I32_IRR_BASE + 0;  // vector 2 is in irr[0]
        apic.view[irrIndex] |= (1 << 2);
      }
      // INIT and SIPI are handled by the coordinator, not injected as IRR bits
    }

    this.pendingIPIs = [];
  }

  /**
   * Check if the guest wrote to the LAPIC ICR during the last execution cycle.
   *
   * Strategy: after each do_tick(), read icr0/icr1 from WASM memory. If icr0
   * changed since last check, the guest issued an IPI. Decode it and route
   * via RPC to the coordinator.
   *
   * v86's apic.rs clears the delivery-status bit (bit 12) after processing
   * the write, so we detect changes by comparing the full icr0 value.
   * We also clear bit 12 in our snapshot to avoid false positives from the
   * delivery-status toggle.
   */
  private checkOutboundIPIs(): void {
    const apic = this.getApicView();
    if (!apic) return;

    const icr0 = apic.view[APIC_I32_ICR0];
    const icr1 = apic.view[APIC_I32_ICR1];

    // Mask out delivery-status bit (12) for comparison — v86 toggles it
    const icr0Masked = icr0 & ~(1 << 12);
    const lastMasked = this.lastICRLow & ~(1 << 12);

    if (icr0Masked !== lastMasked || icr1 !== this.lastICRHigh) {
      // ICR changed — guest wrote an IPI
      this.lastICRLow = icr0;
      this.lastICRHigh = icr1;

      const ipi = decodeICR(icr0, icr1, this.apicId);

      // Don't route self-targeted IPIs — v86 already delivered them locally
      if (ipi.to === this.apicId) return;

      // Route to coordinator asynchronously.
      // We fire-and-forget here because the execution loop is synchronous.
      // The coordinator will process the IPI and deliver it to the target core.
      this.routeIPIToCoordinator(ipi);
    }
  }

  /**
   * Send an IPI to the coordinator for routing.
   * Async fire-and-forget from the synchronous execution loop.
   */
  private routeIPIToCoordinator(ipi: IPIMessage): void {
    if (!this.coordinatorId) return;

    // Get a stub to the coordinator DO
    const coordId = this.env.COORDINATOR.idFromString(this.coordinatorId);
    const coordStub = this.env.COORDINATOR.get(coordId);

    // Fire-and-forget — we don't block the execution loop waiting for RPC.
    // The IPI will be delivered asynchronously. This is fine because:
    // 1. INIT/SIPI don't need instant delivery — there's a >10ms delay
    //    in real hardware between INIT and SIPI anyway
    // 2. Fixed IPIs are buffered in the target's IRR until checked
    // 3. The execution loop will yield to the event loop between ticks,
    //    allowing the RPC promise to resolve
    (coordStub as any).routeIPI(ipi).catch((e: Error) => {
      console.error(`${LOG_PREFIX} Core ${this.apicId} failed to route IPI:`, e);
    });
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
