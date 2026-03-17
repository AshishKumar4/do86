/**
 * qemu-wrapper.ts — QEMU WASM lifecycle manager for Durable Objects.
 *
 * Loads qemu-system-i386 (Emscripten, NO ASYNCIFY), configures the
 * Emscripten VFS with BIOS/disk images, hooks serial + display + APIC
 * bridge exports, and drives the main-loop via emscripten_set_main_loop().
 *
 * Actual WASM exports (Emscripten adds `_` prefix):
 *   _wasm_display_init
 *   _wasm_get_display_surface_data, _wasm_get_display_stride,
 *   _wasm_get_display_width, _wasm_get_display_height,
 *   _wasm_cpu_set_sipi_vector, _wasm_cpu_resume,
 *   _wasm_cpu_get_halted, _wasm_cpu_get_eip,
 *   _wasm_cpu_interrupt, _wasm_cpu_flush_tlb, _wasm_cpu_flush_tlb_page,
 *   _wasm_apic_get_id, _wasm_apic_set_id,
 *   _wasm_apic_inject_irq, _wasm_apic_read_icr,
 *   _wasm_apic_get_highest_irr
 *
 * EM_ASM callbacks (set on Module before init, called synchronously by QEMU):
 *   Module.onTlbMiss(gpa)       — page fault handler, returns WASM offset
 *   Module.onICRWrite(lo, hi)   — LAPIC ICR write (outbound IPI)
 *   Module.onSerialChar(code)   — per-character serial output
 *   Module.onDisplayUpdate(x, y, w, h, ptr, stride, surfW)
 *   Module.onDisplayResize(w, h)
 *   Module.preTick()            — before each main-loop iteration
 *   Module.postTick()           — after each main-loop iteration
 *
 * Key invariants:
 *  - No ASYNCIFY: the main loop runs via emscripten_set_main_loop() callback.
 *    callMain() returns normally after registering the callback.
 *  - No pthreads / no SharedArrayBuffer.
 *  - All I/O during TB execution must be synchronous or deferred.
 *  - DO SQLite (sql.exec) is synchronous — the critical enabler for
 *    demand-paged RAM without ASYNCIFY.
 */

import type { SqlPageStore } from "./sql-page-store";
import type { IPIMessage } from "./ipi-handler";
import { decodeICR } from "./ipi-handler";
import { LOG_PREFIX } from "./types";

// ── QEMU WASM module asset imports ──────────────────────────────────────────
// The bundler resolves these to the qemu-wasm/ directory.

import qemuWasmModule from "../qemu-wasm/qemu-system-i386.wasm";
import qemuJsGlue from "../qemu-wasm/qemu-system-i386.js" with { type: "text" };

// ── Emscripten FS subset ────────────────────────────────────────────────────

interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: string }): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
  mkdir(path: string): void;
  mkdirTree?(path: string): void;
  unlink(path: string): void;
  stat(path: string): { size: number; mode: number };
}

// ── QEMU Module interface (typed exports) ───────────────────────────────────
// Only exports that actually exist in the QEMU WASM build.

interface QEMUModule {
  callMain: (args: string[]) => void;
  FS: EmscriptenFS;
  HEAPU8: Uint8Array;
  HEAP32: Int32Array;

  // ── APIC bridge exports ───────────────────────────────────────────────
  _wasm_apic_get_id(): number;
  _wasm_apic_set_id(id: number): void;
  _wasm_apic_inject_irq(vector: number, triggerMode: number): void;
  _wasm_apic_read_icr(icrLowPtr: number, icrHighPtr: number): number;
  _wasm_apic_get_highest_irr(): number;

  // ── CPU control exports ───────────────────────────────────────────────
  _wasm_cpu_set_sipi_vector(vector: number): void;
  _wasm_cpu_resume(): void;
  _wasm_cpu_get_halted(): number;
  _wasm_cpu_get_eip(): number;
  _wasm_cpu_interrupt(vector: number): void;
  _wasm_cpu_flush_tlb(): void;
  _wasm_cpu_flush_tlb_page(gpa: number): void;

  // ── Display exports ───────────────────────────────────────────────────
  _wasm_display_init(): void;
  _wasm_get_display_surface_data(): number;
  _wasm_get_display_stride(): number;
  _wasm_get_display_width(): number;
  _wasm_get_display_height(): number;

  // ── Emscripten lifecycle ──────────────────────────────────────────────
  _emscripten_cancel_main_loop?(): void;
  _malloc(size: number): number;
  _free(ptr: number): void;

  // ── EM_ASM callbacks (set on Module before/during init) ───────────────
  preTick?: () => void;
  postTick?: () => void;
  onICRWrite?: (icrLow: number, icrHigh: number) => void;
  onTlbMiss?: (gpa: number) => number;
  onDisplayUpdate?: (
    x: number, y: number, w: number, h: number,
    dataPtr: number, stride: number, surfaceWidth: number,
  ) => void;
  onDisplayResize?: (width: number, height: number) => void;
  onSerialChar?: (charCode: number) => void;
}

// ── Configuration ───────────────────────────────────────────────────────────

export interface QEMUWrapperConfig {
  /** APIC ID for this vCPU (0 = BSP). */
  apicId: number;
  /** Whether this is the bootstrap processor. */
  isBSP: boolean;
  /** Total declared guest RAM in MB (may exceed physical WASM allocation). */
  memorySizeMB: number;
  /** WASM linear memory hot window in MB (actual allocation). */
  wasmHeapMB: number;
  /** SQLite-backed cold page store for demand-paged RAM. */
  sqlPageStore: SqlPageStore;
  /** SeaBIOS binary (required). */
  biosData: ArrayBuffer;
  /** VGA BIOS binary (required). */
  vgaBiosData: ArrayBuffer;
  /** Disk image (BSP only). */
  diskData?: ArrayBuffer;
  /** Disk drive type. */
  diskDrive?: "fda" | "cdrom";
  /** Serial output callback. */
  onSerialOutput?: (char: string) => void;
  /** Display dirty-region callback. */
  onDisplayUpdate?: (
    x: number, y: number, w: number, h: number,
    data: Uint8Array,
  ) => void;
  /** Outbound IPI callback (called when guest writes LAPIC ICR). */
  onIPISend?: (ipi: IPIMessage) => void;
}

// ── QEMUWrapper ─────────────────────────────────────────────────────────────

export class QEMUWrapper {
  private module: QEMUModule | null = null;
  private config: QEMUWrapperConfig | null = null;
  private running = false;
  private aborted = false;

  // ── Display state ───────────────────────────────────────────────────
  private displayWidth = 0;
  private displayHeight = 0;
  private displayDirty = false;

  // ── IPI monitoring ──────────────────────────────────────────────────
  private lastICRLow = 0;
  private lastICRHigh = 0;
  private icrScratchPtr = 0; // malloc'd 8-byte buffer for apic_read_icr

  // ── Page fault tracking (between-tick async prefetch) ───────────────
  private tlbMissLog: number[] = [];
  private resolvedPages = new Map<number, Uint8Array>();
  private pendingPageFetches = new Map<number, Promise<Uint8Array>>();

  /** Whether the QEMU module has been loaded and callMain() has returned. */
  get isLoaded(): boolean {
    return this.module !== null && !this.aborted;
  }

  /** Whether the execution loop is running. */
  get isRunning(): boolean {
    return this.running;
  }

  /**
   * Initialize and start the QEMU instance.
   *
   * 1. Evaluate JS glue (sets up globalThis.Module).
   * 2. Wait for onRuntimeInitialized.
   * 3. Write BIOS/disk to Emscripten VFS.
   * 4. callMain() — registers emscripten_set_main_loop callback.
   * 5. Set APIC ID, install hooks.
   */
  async init(config: QEMUWrapperConfig): Promise<void> {
    this.config = config;

    const module = await this.loadModule(config);
    this.module = module;

    // Set APIC ID
    module._wasm_apic_set_id(config.apicId);

    // Initialize the WASM display backend
    module._wasm_display_init();

    // Allocate scratch buffer for ICR reads (2 x uint32 = 8 bytes)
    this.icrScratchPtr = module._malloc(8);

    // Wire up the SqlPageStore to WASM heap for demand-paged RAM.
    // The page pool lives in the upper region of QEMU's WASM heap.
    // We use INITIAL_MEMORY minus a safety margin as the pool base,
    // since QEMU allocates from the bottom up via sbrk/malloc.
    // The pool base is computed from HEAPU8 length to stay within bounds.
    const heapLen = module.HEAPU8.byteLength;
    const poolSize = config.sqlPageStore.maxFrameCount * 4096;
    const poolBase = heapLen - poolSize;
    config.sqlPageStore.setWasmHeap(module.HEAPU8, poolBase);

    this.running = true;

    console.log(
      `${LOG_PREFIX} QEMU Core ${config.apicId} initialized ` +
      `(BSP=${config.isBSP}, heap=${config.wasmHeapMB}MB, ` +
      `pool@0x${poolBase.toString(16)}, ${config.sqlPageStore.maxFrameCount} frames)`,
    );
  }

  /**
   * Load the QEMU Emscripten module. Returns when callMain() has completed
   * (i.e., emscripten_set_main_loop callback is registered).
   */
  private loadModule(config: QEMUWrapperConfig): Promise<QEMUModule> {
    return new Promise<QEMUModule>((resolve, reject) => {
      let moduleRef: QEMUModule | null = null;

      const moduleOverrides: Record<string, unknown> = {
        noInitialRun: true,
        noExitRuntime: true,

        // Serial console output (stdout)
        print: (line: string) => {
          if (config.onSerialOutput) {
            for (const ch of line) {
              config.onSerialOutput(ch);
            }
            config.onSerialOutput("\n");
          }
        },

        // Debug/error output (stderr)
        printErr: (line: string) => {
          console.error(`${LOG_PREFIX} [qemu:${config.apicId}]`, line);
        },

        // Per-character serial hook (called from QEMU's serial device via EM_ASM)
        onSerialChar: (charCode: number) => {
          config.onSerialOutput?.(String.fromCharCode(charCode));
        },

        // ICR write callback (called from patched apic_mem_write via EM_ASM)
        onICRWrite: (icrLow: number, icrHigh: number) => {
          this.handleICRWrite(icrLow, icrHigh);
        },

        // TLB miss / page fault callback — SYNCHRONOUS.
        // Called from patched cputlb.c via EM_ASM when QEMU's softmmu
        // can't resolve a guest physical address. Returns the WASM heap
        // offset of the page frame containing the data, or -1.
        onTlbMiss: (gpa: number) => {
          return this.handleTlbMiss(gpa);
        },

        // Display update callback
        onDisplayUpdate: (
          x: number, y: number, w: number, h: number,
          dataPtr: number, stride: number, surfaceWidth: number,
        ) => {
          this.displayDirty = true;
          // If caller registered a region-level callback, forward it
          if (config.onDisplayUpdate && moduleRef) {
            const bpp = 4; // 32bpp BGRA
            const regionBytes = w * h * bpp;
            // Read region from WASM memory and convert BGRA→RGBA
            const rgba = new Uint8Array(regionBytes);
            const heap = moduleRef.HEAPU8;
            for (let row = 0; row < h; row++) {
              const srcRowStart = dataPtr + (y + row) * stride + x * bpp;
              const dstRowStart = row * w * bpp;
              for (let col = 0; col < w; col++) {
                const s = srcRowStart + col * bpp;
                const d = dstRowStart + col * bpp;
                rgba[d + 0] = heap[s + 2]; // R ← B
                rgba[d + 1] = heap[s + 1]; // G ← G
                rgba[d + 2] = heap[s + 0]; // B ← R
                rgba[d + 3] = 255;          // A
              }
            }
            config.onDisplayUpdate(x, y, w, h, rgba);
          }
        },

        // Display resize callback
        onDisplayResize: (width: number, height: number) => {
          this.displayWidth = width;
          this.displayHeight = height;
          this.displayDirty = true;
        },

        // Pre/post tick hooks — called by patched main_loop_callback
        preTick: () => this.preTick(),
        postTick: () => this.postTick(),

        onRuntimeInitialized: () => {
          moduleRef = (globalThis as unknown as Record<string, unknown>)
            .Module as QEMUModule;

          try {
            this.mountFilesystem(moduleRef, config);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            this.aborted = true;
            reject(new Error(`Failed to mount files: ${msg}`));
            return;
          }

          // Build QEMU args
          const args = this.buildQemuArgs(config);

          try {
            moduleRef.callMain(args);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            if (msg !== "unwind" && !msg.includes("ExitStatus")) {
              this.aborted = true;
              reject(new Error(`QEMU callMain error: ${msg}`));
              return;
            }
          }

          // callMain returned — main loop callback is registered.
          resolve(moduleRef);
        },

        onAbort: (what: string) => {
          this.aborted = true;
          reject(new Error(`QEMU aborted: ${what}`));
        },

        // Provide pre-compiled WASM module
        wasmBinary: qemuWasmModule,
      };

      // Set up globalThis.Module — the JS glue reads from it.
      (globalThis as unknown as Record<string, unknown>).Module = moduleOverrides;

      // Execute the Emscripten JS glue code.
      // eslint-disable-next-line no-new-func
      const fn = new Function(qemuJsGlue);
      fn();
    });
  }

  /**
   * Build QEMU command-line arguments for this core.
   */
  private buildQemuArgs(config: QEMUWrapperConfig): string[] {
    const args: string[] = [
      "-M", "pc",                             // i440FX machine
      "-m", `${config.wasmHeapMB}M`,          // Hot window allocation only
      "-smp", "1",                             // Single vCPU per DO
      "-nographic",                            // No SDL/GTK display
      "-device", "VGA",                        // VGA for framebuffer
      "-serial", "stdio",                      // Serial to stdout callbacks
      "-no-reboot",
      "-nodefaults",
      "-no-user-config",
    ];

    // BSP gets disk; AP gets nothing
    if (config.isBSP && config.diskData) {
      if (config.diskDrive === "fda") {
        args.push("-fda", "/disk.img");
      } else {
        args.push("-cdrom", "/disk.iso");
      }
    }

    // AP starts paused, waiting for SIPI
    if (!config.isBSP) {
      args.push("-S"); // Start CPU halted
    }

    return args;
  }

  /**
   * Write BIOS, VGA BIOS, and disk image into Emscripten's virtual filesystem.
   */
  private mountFilesystem(module: QEMUModule, config: QEMUWrapperConfig): void {
    const FS = module.FS;
    const BIOS_DIR = "/usr/local/share/qemu";

    // Create BIOS directory tree
    mkdirp(FS, BIOS_DIR);

    // Write SeaBIOS
    FS.writeFile(
      `${BIOS_DIR}/bios-256k.bin`,
      new Uint8Array(config.biosData),
    );

    // Write VGA BIOS
    FS.writeFile(
      `${BIOS_DIR}/vgabios-stdvga.bin`,
      new Uint8Array(config.vgaBiosData),
    );

    // Also write as vgabios.bin (QEMU may look for either name)
    FS.writeFile(
      `${BIOS_DIR}/vgabios.bin`,
      new Uint8Array(config.vgaBiosData),
    );

    // Write kvmvapic.bin stub (QEMU expects it but it's optional)
    FS.writeFile(`${BIOS_DIR}/kvmvapic.bin`, new Uint8Array(0));
    FS.writeFile(`${BIOS_DIR}/linuxboot.bin`, new Uint8Array(0));

    // Write disk image (BSP only)
    if (config.isBSP && config.diskData) {
      const diskPath = config.diskDrive === "fda" ? "/disk.img" : "/disk.iso";
      FS.writeFile(diskPath, new Uint8Array(config.diskData));
    }
  }

  // ── Pre/Post Tick ─────────────────────────────────────────────────────

  /**
   * Called before each QEMU main-loop iteration (≤4096 TBs).
   * Injects resolved remote pages and pending IPIs.
   */
  private preTick(): void {
    if (!this.module || !this.config) return;

    // Install any pages that completed async fetching since last tick
    for (const [gpa, data] of this.resolvedPages) {
      this.config.sqlPageStore.pageOut(gpa, data);
      this.pendingPageFetches.delete(gpa);
      // Flush QEMU's TLB entry so next access sees the new data
      this.module._wasm_cpu_flush_tlb_page(gpa);
    }
    this.resolvedPages.clear();
  }

  /**
   * Called after each QEMU main-loop iteration.
   * Checks for outbound IPIs via ICR polling (fallback if EM_ASM callback
   * is not available) and flushes dirty pages.
   */
  private postTick(): void {
    if (!this.module || !this.config) return;

    // Poll ICR as fallback (in case onICRWrite callback wasn't patched in)
    this.pollICR();

    // Periodic dirty page flush to SQLite
    this.config.sqlPageStore.flushDirty();

    // Update display dimensions from QEMU exports
    const w = this.module._wasm_get_display_width();
    const h = this.module._wasm_get_display_height();
    if (w > 0 && h > 0 && (w !== this.displayWidth || h !== this.displayHeight)) {
      this.displayWidth = w;
      this.displayHeight = h;
      this.displayDirty = true;
    }
  }

  // ── IPI Handling ──────────────────────────────────────────────────────

  /**
   * Handle an ICR write from the guest (called via EM_ASM callback from
   * patched apic_mem_write). Decodes the IPI and forwards to coordinator.
   */
  private handleICRWrite(icrLow: number, icrHigh: number): void {
    if (!this.config) return;

    const ipi = decodeICR(icrLow, icrHigh, this.config.apicId);

    // Don't forward self-targeted IPIs
    if (ipi.to === this.config.apicId) return;

    this.config.onIPISend?.(ipi);
  }

  /**
   * Poll ICR register (fallback for builds without EM_ASM callback).
   * Compares current ICR to last-seen values; if changed, decode + forward.
   */
  private pollICR(): void {
    if (!this.module || !this.config || !this.icrScratchPtr) return;

    const result = this.module._wasm_apic_read_icr(
      this.icrScratchPtr,
      this.icrScratchPtr + 4,
    );
    if (result !== 1) return;

    const icrLow = this.module.HEAP32[this.icrScratchPtr >> 2];
    const icrHigh = this.module.HEAP32[(this.icrScratchPtr + 4) >> 2];

    // Mask delivery-status bit (12) for comparison
    const maskedLow = icrLow & ~(1 << 12);
    const lastMasked = this.lastICRLow & ~(1 << 12);

    if (maskedLow !== lastMasked || icrHigh !== this.lastICRHigh) {
      this.lastICRLow = icrLow;
      this.lastICRHigh = icrHigh;
      this.handleICRWrite(icrLow, icrHigh);
    }
  }

  /**
   * Inject an interrupt into this core's LAPIC (called by coordinator).
   * The vector is injected via the QEMU bridge export, which sets the
   * appropriate IRR bit in the APIC state.
   */
  injectInterrupt(vector: number, triggerMode: number): void {
    if (!this.module) return;
    this.module._wasm_apic_inject_irq(vector, triggerMode);
  }

  // ── TLB Miss / Demand Paging ──────────────────────────────────────────

  /**
   * Handle a synchronous TLB miss from QEMU's softmmu.
   * Called via EM_ASM in the patched cputlb.c (Module.onTlbMiss).
   *
   * Returns: WASM heap offset of the page frame (for TLB fill), or -1.
   *
   * SYNCHRONOUS — reads from the local SqlPageStore which uses DO SQLite
   * (sql.exec is synchronous). This is the critical path that makes
   * demand-paged RAM work without ASYNCIFY.
   */
  private handleTlbMiss(gpa: number): number {
    if (!this.config) return -1;

    // Log for between-tick async prefetch of remote pages
    this.tlbMissLog.push(gpa);

    // Synchronous page-in from local SQLite or hot cache
    return this.config.sqlPageStore.swapIn(gpa);
  }

  // ── SIPI / AP Control ─────────────────────────────────────────────────

  /**
   * Set up this core's CPU for SIPI-based startup (AP boot).
   * Sets CS:IP to vector:0000 in real mode and unpauses.
   */
  handleSIPI(vector: number): void {
    if (!this.module) return;
    this.module._wasm_cpu_set_sipi_vector(vector);
    this.module._wasm_cpu_resume();
    this.running = true;
  }

  /**
   * Halt the CPU (INIT reset). Since there's no _wasm_cpu_halt export,
   * we cancel the main loop to stop execution. The CPU will be
   * re-started via handleSIPI() when SIPI arrives.
   */
  halt(): void {
    if (!this.module) return;
    // Cancel the main loop to stop TB execution
    if (typeof this.module._emscripten_cancel_main_loop === "function") {
      try {
        this.module._emscripten_cancel_main_loop();
      } catch {
        // best-effort
      }
    }
    this.running = false;
  }

  /**
   * Resume execution (after halt or pause).
   */
  resume(): void {
    if (!this.module) return;
    this.module._wasm_cpu_resume();
    this.running = true;
  }

  /**
   * Check if the CPU is in HLT state.
   */
  isCpuHalted(): boolean {
    if (!this.module) return true;
    return this.module._wasm_cpu_get_halted() !== 0;
  }

  /**
   * Get the current EIP (instruction pointer).
   */
  getCpuEip(): number {
    if (!this.module) return 0;
    return this.module._wasm_cpu_get_eip();
  }

  /**
   * Inject a CPU interrupt directly (not via APIC).
   */
  cpuInterrupt(vector: number): void {
    if (!this.module) return;
    this.module._wasm_cpu_interrupt(vector);
  }

  /**
   * Flush the entire TLB.
   */
  flushTlb(): void {
    if (!this.module) return;
    this.module._wasm_cpu_flush_tlb();
  }

  /**
   * Flush a single TLB entry for a guest physical address.
   */
  flushTlbPage(gpa: number): void {
    if (!this.module) return;
    this.module._wasm_cpu_flush_tlb_page(gpa);
  }

  /**
   * Get the highest pending IRR vector.
   */
  getHighestIrr(): number {
    if (!this.module) return -1;
    return this.module._wasm_apic_get_highest_irr();
  }

  // ── Display ───────────────────────────────────────────────────────────

  /**
   * Capture the current framebuffer as a raw frame buffer.
   * Returns width, height, bufferWidth, and RGBA pixel data in an
   * ArrayBuffer with a 12-byte header [width:u32, height:u32, bufferWidth:u32].
   *
   * Matches the format that CpuCoreDO.getScreenFrame() returns for
   * compatibility with the existing CoordinatorDO render pipeline.
   */
  getScreenFrame(): ArrayBuffer | null {
    if (!this.module) return null;

    const surfacePtr = this.module._wasm_get_display_surface_data();
    const stride = this.module._wasm_get_display_stride();
    const width = this.module._wasm_get_display_width();
    const height = this.module._wasm_get_display_height();

    if (surfacePtr <= 0 || width <= 0 || height <= 0) return null;
    if (width * height > 1280 * 1024) return null; // Safety cap

    const bpp = 4; // BGRA
    const bufferWidth = stride / bpp;
    const heap = this.module.HEAPU8;

    // Build frame: 12-byte header + RGBA pixel data
    const byteLen = bufferWidth * height * 4;
    const frame = new ArrayBuffer(byteLen + 12);
    const view = new DataView(frame);
    const out = new Uint8Array(frame, 12);

    view.setUint32(0, width, true);
    view.setUint32(4, height, true);
    view.setUint32(8, bufferWidth, true);

    // Convert BGRA → RGBA
    for (let row = 0; row < height; row++) {
      const srcRowStart = surfacePtr + row * stride;
      const dstRowStart = row * bufferWidth * 4;
      for (let col = 0; col < bufferWidth; col++) {
        const s = srcRowStart + col * bpp;
        const d = dstRowStart + col * 4;
        out[d + 0] = heap[s + 2]; // R ← B
        out[d + 1] = heap[s + 1]; // G ← G
        out[d + 2] = heap[s + 0]; // B ← R
        out[d + 3] = 255;          // A
      }
    }

    return frame;
  }

  /**
   * Check if QEMU's display is in graphical mode.
   * Uses display dimensions as a proxy — if both are > 0, VGA is active.
   */
  isGraphicalMode(): boolean {
    if (!this.module) return false;
    const w = this.module._wasm_get_display_width();
    const h = this.module._wasm_get_display_height();
    return w > 0 && h > 0;
  }

  // ── Memory Access ─────────────────────────────────────────────────────

  /**
   * Read pages from the QEMU WASM linear memory (for trampoline copy).
   * Returns array of [physAddr, pageData] pairs.
   */
  readPages(startAddr: number, numPages: number): Array<[number, ArrayBuffer]> {
    if (!this.module) return [];

    const heap = this.module.HEAPU8;
    const result: Array<[number, ArrayBuffer]> = [];
    const PG_SIZE = 4096;

    for (let i = 0; i < numPages; i++) {
      const addr = startAddr + i * PG_SIZE;
      if (addr + PG_SIZE > heap.byteLength) break;

      const pageData = new ArrayBuffer(PG_SIZE);
      new Uint8Array(pageData).set(heap.subarray(addr, addr + PG_SIZE));
      result.push([addr, pageData]);
    }

    return result;
  }

  /**
   * Write pages into the QEMU WASM linear memory (for trampoline install).
   */
  writePages(pages: Map<number, ArrayBuffer>): void {
    if (!this.module) return;

    const heap = this.module.HEAPU8;
    const PG_SIZE = 4096;

    for (const [addr, data] of pages) {
      if (addr + PG_SIZE <= heap.byteLength) {
        heap.set(new Uint8Array(data), addr);
      }
    }
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────

  /**
   * Stop the QEMU instance. Best-effort cleanup.
   */
  stop(): void {
    if (!this.module) return;

    this.running = false;

    // Cancel the Emscripten main loop
    if (typeof this.module._emscripten_cancel_main_loop === "function") {
      try {
        this.module._emscripten_cancel_main_loop();
      } catch {
        // best-effort
      }
    }

    // Free scratch buffer
    if (this.icrScratchPtr) {
      try { this.module._free(this.icrScratchPtr); } catch { /* ok */ }
      this.icrScratchPtr = 0;
    }

    // Flush remaining dirty pages
    this.config?.sqlPageStore.flushDirty();

    this.aborted = true;
  }

  /**
   * Get the raw QEMU module (for advanced access). Typed as QEMUModule.
   */
  getModule(): QEMUModule | null {
    return this.module;
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Recursively create directories in the Emscripten VFS.
 */
function mkdirp(FS: EmscriptenFS, path: string): void {
  if (FS.mkdirTree) {
    FS.mkdirTree(path);
    return;
  }
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current += "/" + part;
    try {
      FS.mkdir(current);
    } catch {
      // directory already exists
    }
  }
}
