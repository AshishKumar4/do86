/**
 * qemu-wrapper.ts — QEMU WASM lifecycle manager for Durable Objects.
 *
 * Loads qemu-system-i386 (Emscripten, NO ASYNCIFY, MODULARIZE), configures
 * the Emscripten VFS with BIOS/disk images, hooks serial + display + APIC
 * bridge exports, and drives the main-loop via emscripten_set_main_loop().
 *
 * The JS glue is built with -sMODULARIZE=1 -sEXPORT_NAME=createQemuModule.
 * Loading pattern:
 *   const createQemuModule = new Function(jsGlue + "\nreturn createQemuModule;")();
 *   const Module = await createQemuModule({ print, printErr, wasmBinary, ... });
 *
 * WASM exports (Emscripten adds `_` prefix):
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
 * EM_ASM callbacks (set on Module via factory overrides, called synchronously):
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

import type { QemuPageStore } from "./qemu-page-store";
// IPI handler removed — standalone mode doesn't need distributed IPI
interface IPIMessage { destId: number; vector: number; triggerMode: number; deliveryMode: number; }
function decodeICR(icrLow: number, icrHigh: number): IPIMessage {
  return { destId: (icrHigh >> 24) & 0xff, vector: icrLow & 0xff, triggerMode: (icrLow >> 15) & 1, deliveryMode: (icrLow >> 8) & 7 };
}
import { LOG_PREFIX } from "./types";

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

  // ── Emscripten print hooks ──────────────────────────────────────────
  print?(line: string): void;
  printErr?(line: string): void;

  // ── Execution pump + event processing ────────────────────────────────
  _wasm_step?(iterations: number): number;
  _wasm_pump_events?(): void;

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
  sqlPageStore: QemuPageStore;

  // ── WASM loading: two modes ──────────────────────────────────────────
  //
  // Mode A (Workers/DOs): pre-compiled at deploy time — no runtime eval.
  //   wasmModule: pre-compiled WebAssembly.Module (from `import mod from "./x.wasm"`)
  //   createFactory: Emscripten factory function (from `import fn from "./x-glue.mjs"`)
  //
  // Mode B (Node.js / testing): runtime compilation.
  //   wasmBinary: raw WASM bytes (ArrayBuffer)
  //   jsGlue: Emscripten JS glue as a string (evaluated via new Function)

  /** Pre-compiled WebAssembly.Module (Workers mode — import at deploy time). */
  wasmModule?: WebAssembly.Module;
  /** Emscripten factory function (Workers mode — import at deploy time). */
  createFactory?: (overrides: Record<string, unknown>) => Promise<any>;

  /** QEMU WASM binary as bytes (Node.js/testing mode — runtime compilation). */
  wasmBinary?: ArrayBuffer;
  /** Emscripten JS glue code as string (Node.js/testing mode — eval at runtime). */
  jsGlue?: string;

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

  // ── ASYNCIFY init completion signal ──────────────────────────────────
  private initSignal: { done: boolean; resolve: (() => void) | null } | null = null;

  // ── Execution pump (JS-driven via setTimeout) ──────────────────────
  private stepTimer: ReturnType<typeof setTimeout> | null = null;
  private eventTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly STEP_ITERATIONS = 16384; // TBs per step call (high throughput)

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
   * 1. Evaluate JS glue to get createQemuModule factory.
   * 2. await createQemuModule({...}) — waits for runtime init.
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

    // Start the JS-driven execution pump.
    // callMain() returned without entering a loop (no-ASYNCIFY path).
    // We drive QEMU by calling _wasm_step(N) on a setInterval.
    this.startExecution();
  }

  /**
   * Start the JS-driven execution pump.
   * Calls _wasm_step(N) every STEP_INTERVAL_MS milliseconds. Each call
   * executes N translation blocks + processes timers/events, then returns
   * control to the JS event loop so HTTP/WebSocket handlers can run.
   */
  private startExecution(): void {
    if (this.stepTimer || !this.module) return;

    const mod = this.module;

    let stepCount = 0;
    console.log(`${LOG_PREFIX} stepTimer setup: running=${this.running} aborted=${this.aborted} hasStep=${typeof mod._wasm_step}`);

    // Use recursive setTimeout instead of setInterval.
    // This prevents races between the Fibers trampoline (ASYNCIFY rewind)
    // and our next scheduled call. Each call completes fully (including any
    // ASYNCIFY unwind/rewind cycles) before the next is scheduled.
    const scheduleStep = () => {
      this.stepTimer = setTimeout(() => {
        if (!this.running || this.aborted || !mod._wasm_step) return;

        try {
          stepCount++;
          const result = mod._wasm_step(QEMUWrapper.STEP_ITERATIONS);
          if (stepCount <= 5 || stepCount % 5000 === 0) {
            console.log(`${LOG_PREFIX} wasm_step #${stepCount} returned ${result}`);
          }
          if (result > 0) {
            console.log(`${LOG_PREFIX} QEMU exit requested (status=${result})`);
            this.stop();
            return;
          }
        } catch (e) {
          console.error(`${LOG_PREFIX} wasm_step error:`, e);
          this.aborted = true;
          this.stop();
          return;
        }

        // Schedule next step — setTimeout(0) runs after the current event
        // loop tick, giving HTTP/WS handlers a chance to process.
        scheduleStep();
      }, 0);
    };
    scheduleStep();

    // With -icount, timers fire via qemu_clock_run_timers inside wasm_step.
    // No separate event pump needed.

    console.log(
      `${LOG_PREFIX} Execution pump started: ${QEMUWrapper.STEP_ITERATIONS} iters/step + event pump`,
    );
  }

  /**
   * Load the QEMU Emscripten module. Returns when callMain() has completed
   * (i.e., emscripten_set_main_loop callback is registered).
   *
   * The JS glue is built with -sMODULARIZE=1 -sEXPORT_NAME=createQemuModule,
   * so it exports a factory function. We call it with our overrides and await
   * the returned promise — no globalThis.Module hacks needed.
   */
  private async loadModule(config: QEMUWrapperConfig): Promise<QEMUModule> {
    // Resolve the Emscripten factory function.
    //
    // Mode A (Workers/DOs): use pre-imported factory + instantiateWasm callback
    //   with pre-compiled WebAssembly.Module. No eval, no runtime compilation.
    //
    // Mode B (Node.js/testing): evaluate JS glue string via new Function() and
    //   pass wasmBinary for runtime compilation.
    let factory: (overrides: Record<string, unknown>) => Promise<QEMUModule>;

    const usePrecompiled = !!config.wasmModule && !!config.createFactory;

    if (usePrecompiled) {
      factory = config.createFactory as (overrides: Record<string, unknown>) => Promise<QEMUModule>;
    } else if (config.jsGlue) {
      // eslint-disable-next-line no-new-func
      factory = new Function(
        config.jsGlue + "\nreturn createQemuModule;",
      )() as (overrides: Record<string, unknown>) => Promise<QEMUModule>;
    } else {
      throw new Error("QEMUWrapper: need either (wasmModule + createFactory) or (wasmBinary + jsGlue)");
    }

    // Prepare module overrides — all callbacks are wired here.
    // The factory merges these into the Module object before init.
    const moduleOverrides: Record<string, unknown> = {
      noInitialRun: true,
      noExitRuntime: true,
      // Prevent new URL() with empty base in Workers (no import.meta.url)
      locateFile: () => "",

      // Serial console output (stdout).
      // Also detects QEMU init completion signal for ASYNCIFY wait.
      print: (line: string) => {
        if (config.onSerialOutput) {
          for (const ch of line) config.onSerialOutput(ch);
          config.onSerialOutput("\n");
        }
        if (typeof line === "string" &&
            (line.includes("[MAIN] after qemu_main_loop") || line.includes("[ML-LOOP] Emscripten:"))) {
          if (this.initSignal && !this.initSignal.done) {
            this.initSignal.done = true;
            console.log(`${LOG_PREFIX} QEMU init complete`);
            this.initSignal.resolve?.();
          }
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
        if (config.onDisplayUpdate && mod) {
          const bpp = 4; // 32bpp BGRA
          const regionBytes = w * h * bpp;
          // Read region from WASM memory and convert BGRA→RGBA
          const rgba = new Uint8Array(regionBytes);
          const heap = mod.HEAPU8;
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

      onAbort: (what: string) => {
        // Log but don't set this.aborted — QEMU coroutine issues during init
        // are non-fatal. The guest can still boot even with coroutine warnings.
        console.error(`${LOG_PREFIX} QEMU abort: ${what}`);
        if (what.includes("out of memory") || what.includes("stack overflow")) {
          this.aborted = true;
        }
        // Don't throw — the JS abort() function will return and QEMU continues.
        // The WASM unreachable instruction after C abort() will be handled by
        // the patched JS abort() function which returns instead of throwing.
      },
    };

    // WASM loading strategy:
    if (usePrecompiled) {
      // Mode A: provide instantiateWasm callback with pre-compiled Module.
      // Workers/DOs cannot call WebAssembly.compile() at runtime.
      const wasmMod = config.wasmModule!;
      moduleOverrides.instantiateWasm = (
        imports: WebAssembly.Imports,
        successCallback: (instance: WebAssembly.Instance) => void,
      ) => {
        WebAssembly.instantiate(wasmMod, imports)
          .then((instance) => successCallback(instance))
          .catch((err) => console.error(`${LOG_PREFIX} WASM instantiate error:`, err));
        return {}; // signal async instantiation to Emscripten
      };
    } else if (config.wasmBinary) {
      // Mode B: pass raw bytes — Emscripten will compile at runtime.
      moduleOverrides.wasmBinary = new Uint8Array(config.wasmBinary);
    }

    // Call the factory — it returns a promise that resolves when the
    // Emscripten runtime is fully initialized (replaces onRuntimeInitialized).
    const mod = await factory(moduleOverrides) as unknown as QEMUModule;

    // Mount BIOS/disk files into the Emscripten VFS
    this.mountFilesystem(mod, config);

    // Build QEMU args and start the VM.
    //
    // With ASYNCIFY: callMain() runs qemu_init() which uses fiber_swap for
    // coroutines (block layer I/O). Each fiber_swap causes an ASYNCIFY
    // "unwind" — callMain() throws, and Emscripten schedules a "rewind"
    // via setTimeout to resume execution. This repeats until qemu_init()
    // completes and qemu_main_loop() returns 0.
    //
    // We wrap callMain in a Promise that resolves when the main loop returns
    // (signaled by our [ML-LOOP] fprintf + the Asyncify state settling).
    const args = this.buildQemuArgs(config);

    // Verify disk file in MEMFS
    try {
      const diskPath = config.diskDrive === "fda" ? "/disk.img" : "/disk.iso";
      const stat = mod.FS.stat(diskPath);
      const data = mod.FS.readFile(diskPath, { encoding: "binary" });
      const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data as unknown as ArrayBuffer);
      const first4 = [bytes[0], bytes[1], bytes[2], bytes[3]].map(b => b.toString(16).padStart(2, "0")).join(" ");
      const bootSig = bytes.length >= 512 ? `${bytes[510].toString(16)}${bytes[511].toString(16)}` : "N/A";
      console.log(`${LOG_PREFIX} MEMFS ${diskPath}: size=${stat.size} first4=[${first4}] bootSig=${bootSig}`);
    } catch (e: any) {
      console.log(`${LOG_PREFIX} MEMFS verify error: ${e?.message}`);
    }

    // With ASYNCIFY: callMain() runs qemu_init() which uses fiber_swap
    // for coroutines. Each fiber_swap causes an ASYNCIFY unwind — callMain
    // throws, Emscripten schedules a rewind via setTimeout, and execution
    // resumes from the fiber_swap point.
    //
    // We must NOT catch the unwind exception — let it propagate to Emscripten's
    // runtime. The rewind callbacks fire via the DO's event loop (setTimeout).
    // We wait for qemu_main_loop() to return by polling the Asyncify state.
    // With ASYNCIFY: callMain() runs qemu_init() which may trigger
    // emscripten_fiber_swap for block layer coroutines. Each fiber_swap
    // causes an ASYNCIFY unwind — callMain() returns early, and Emscripten
    // handles the rewind via Fibers.trampoline(). The rewind re-enters
    // the WASM and qemu_init() continues. This may happen multiple times.
    //
    // We wait for qemu_init() to fully complete by watching for the
    // "[MAIN] after qemu_init" debug message, which prints after qemu_init()
    // returns in main().
    // ASYNCIFY init completion: callMain() may return early due to ASYNCIFY
    // unwind. Fibers.trampoline() handles rewind asynchronously. We detect
    // completion via "[MAIN] after qemu_main_loop" in stdout.
    this.initSignal = { done: false, resolve: null };

    console.log(`${LOG_PREFIX} About to callMain with ${args.length} args`);
    console.log(`${LOG_PREFIX} mod.callMain is: ${typeof mod.callMain}`);
    console.log(`${LOG_PREFIX} mod._wasm_step is: ${typeof mod._wasm_step}`);
    console.log(`${LOG_PREFIX} mod.FS is: ${typeof mod.FS}`);

    await new Promise<void>((resolve) => {
      this.initSignal!.resolve = resolve;

      try {
        console.log(`${LOG_PREFIX} Calling callMain now...`);
        mod.callMain(args);
        console.log(`${LOG_PREFIX} callMain returned normally`);
      } catch (e: any) {
        const msg = e?.message || String(e);
        // Ignore ASYNCIFY unwind, ExitStatus, assertions, and unreachable
        // (the WASM unreachable instruction fires after C abort() which we
        // handle non-fatally via the JS abort() patch).
        if (msg === "unwind" || msg.includes("ExitStatus") ||
            msg.includes("Assertion") || msg.includes("unreachable") ||
            msg.includes("aborted")) {
          console.log(`${LOG_PREFIX} callMain: ${msg.slice(0, 100)} (continuing)`);
        } else {
          console.error(`${LOG_PREFIX} callMain fatal: ${msg}`);
          throw e;
        }
      }

      if (this.initSignal!.done) {
        resolve();
        return;
      }

      // Timeout: 120s for ASYNCIFY rewind cycles
      setTimeout(() => {
        if (!this.initSignal!.done) {
          this.initSignal!.done = true;
          console.log(`${LOG_PREFIX} Init timeout (120s) — proceeding`);
          resolve();
        }
      }, 120_000);
    });

    this.initSignal = null;

    return mod;
  }

  /**
   * Build QEMU command-line arguments for this core.
   */
  private buildQemuArgs(config: QEMUWrapperConfig): string[] {
    const args: string[] = [
      "-M", "pc",                             // i440FX machine
      "-m", `${config.wasmHeapMB}M`,          // Hot window allocation only
      "-smp", "1",                             // Single vCPU per DO
      "-nographic",                            // Redirect VGA text to serial (SeaBIOS output)
      "-device", "VGA",                        // Add VGA device for framebuffer capture
      "-serial", "stdio",                      // Serial to stdout callbacks
      "-no-reboot",
      "-nodefaults",
      "-no-user-config",
    ];

    // BSP gets disk; AP gets nothing.
    // Use format=raw to skip coroutine-based format probing during init.
    if (config.isBSP && config.diskData) {
      if (config.diskDrive === "fda") {
        args.push("-drive", "file=/disk.img,if=floppy,format=raw");
      } else {
        args.push("-drive", "file=/disk.iso,if=ide,media=cdrom,format=raw,readonly=on");
        args.push("-boot", "d");
      }
    }

    args.push("-L", "/usr/local/share/qemu"); // BIOS search path
    args.push("-nic", "none");                 // No network
    args.push("-monitor", "none");             // No QMP monitor
    args.push("-icount", "shift=7");             // 128 insns = 1ns — balanced timer delivery + throughput

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
    this.config.sqlPageStore.pageOut?.(0, new Uint8Array(0)) // stub;

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
    // In standalone mode, IPIs are self-targeted (single core). No-op.
    const ipi = decodeICR(icrLow, icrHigh);
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

    // Stop the JS execution pumps
    if (this.stepTimer) { clearTimeout(this.stepTimer); this.stepTimer = null; }
    if (this.eventTimer) { clearTimeout(this.eventTimer); this.eventTimer = null; }

    // Cancel the Emscripten main loop (if using emscripten_set_main_loop path)
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
    this.config?.sqlPageStore.pageOut?.(0, new Uint8Array(0)) // stub;

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
