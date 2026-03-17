/**
 * QEMU v5 wrapper for Cloudflare Durable Objects.
 *
 * This module drives QEMU compiled to WebAssembly with Emscripten's
 * `emscripten_set_main_loop()` callback model (NO ASYNCIFY).
 *
 * Key properties for DO compatibility:
 *   - No pthreads / no SharedArrayBuffer
 *   - No ASYNCIFY — QEMU's main loop is driven by `emscripten_set_main_loop()`
 *     which registers a callback invoked by the JS event loop (setInterval)
 *   - `callMain()` returns normally after registering the callback
 *   - Each callback iteration runs TCG translation blocks (up to 4096 per tick)
 *     then processes I/O events via `main_loop_wait(false)`
 *   - ~6.3MB WASM (vs ~12MB with ASYNCIFY)
 *
 * Build flags used (v5):
 *   -sENVIRONMENT=web,worker,node
 *   -sEXIT_RUNTIME=0
 *   -sALLOW_MEMORY_GROWTH=1
 *   -sINITIAL_MEMORY=268435456
 *   -sSTACK_SIZE=4194304
 *   -sALLOW_TABLE_GROWTH=1
 *   No ASYNCIFY, no pthreads
 *
 * Usage in a Durable Object:
 *
 *   import { QEMUInstance, loadQEMUFromText } from './qemu-asyncify';
 *
 *   export class MyDO extends DurableObject {
 *     qemu: QEMUInstance | null = null;
 *
 *     async fetch(request: Request) {
 *       if (!this.qemu) {
 *         const jsText = await getQemuJs(); // load the .js glue code
 *         const wasmBinary = await getQemuWasm(); // load the .wasm binary
 *
 *         this.qemu = await loadQEMUFromText(jsText, {
 *           args: ['-M', 'pc', '-m', '32M', '-nographic', '-nodefaults',
 *                  '-no-user-config', '-serial', 'stdio'],
 *           wasmBinary,
 *           biosFiles: { 'bios-256k.bin': biosData, 'vgabios.bin': vgaData, ... },
 *           onOutput: (line) => console.log('[QEMU]', line),
 *         });
 *         // QEMU is now running: SeaBIOS boots, serial output flows via onOutput
 *       }
 *       // ... handle requests
 *     }
 *   }
 */

/** Output from the QEMU process (serial console, etc.) */
export type QEMUOutputCallback = (line: string) => void;

/** Options for QEMU initialization */
export interface QEMUOptions {
  /**
   * QEMU command-line arguments (excluding the program name).
   * Example: ['-M', 'pc', '-m', '32M', '-nographic', '-nodefaults',
   *           '-no-user-config', '-serial', 'stdio']
   */
  args: string[];

  /** Called with each line of QEMU's stdout output (serial console) */
  onOutput?: QEMUOutputCallback;

  /** Called with each line of QEMU's stderr output */
  onError?: QEMUOutputCallback;

  /**
   * Called when QEMU aborts (error condition).
   * Default: logs to console.error
   */
  onAbort?: (reason: string) => void;

  /**
   * Pre-loaded WASM binary (ArrayBuffer or Uint8Array).
   * Required in Worker/DO environments where file:// URLs aren't available.
   */
  wasmBinary?: ArrayBuffer | Uint8Array;

  /**
   * BIOS/firmware files to mount into QEMU's virtual filesystem at
   * /usr/local/share/qemu/. Keys are filenames, values are file contents.
   *
   * Typical files needed for -M pc:
   *   - bios-256k.bin (SeaBIOS)
   *   - kvmvapic.bin
   *   - linuxboot.bin
   *   - vgabios.bin or vgabios-stdvga.bin or vgabios-cirrus.bin
   */
  biosFiles?: Record<string, Uint8Array | ArrayBuffer>;

  /**
   * Additional files to mount into the virtual filesystem.
   * Keys are absolute paths, values are file contents.
   * Parent directories are created automatically.
   */
  extraFiles?: Record<string, Uint8Array | ArrayBuffer>;
}

/** A running QEMU instance */
export interface QEMUInstance {
  /** The Emscripten Module object */
  readonly module: EmscriptenModule;

  /**
   * The QEMU FS (virtual filesystem).
   * Use this to read/write files that QEMU can access.
   */
  readonly fs: EmscriptenFS;

  /**
   * Whether QEMU has been aborted/crashed.
   */
  readonly aborted: boolean;

  /**
   * Stop the QEMU instance (best-effort cleanup).
   * Cancels the main loop callback. WASM memory is freed by GC
   * when the DO is evicted.
   */
  stop(): void;
}

/** Minimal Emscripten Module interface */
interface EmscriptenModule {
  callMain: (args: string[]) => void;
  FS: EmscriptenFS;
  [key: string]: unknown;
}

/** Minimal Emscripten FS interface */
interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: string }): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
  mkdir(path: string): void;
  mkdirTree?(path: string): void;
  unlink(path: string): void;
  stat(path: string): { size: number; mode: number };
  [key: string]: unknown;
}

/**
 * Recursively create directories for a path.
 * Works even if mkdirTree is not available.
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
    } catch (_e) {
      // directory already exists
    }
  }
}

/**
 * Mount BIOS and extra files into the Emscripten virtual filesystem.
 */
function mountFiles(FS: EmscriptenFS, options: QEMUOptions): void {
  const BIOS_DIR = "/usr/local/share/qemu";

  // Create BIOS directory
  mkdirp(FS, BIOS_DIR);

  // Mount BIOS files
  if (options.biosFiles) {
    for (const [name, data] of Object.entries(options.biosFiles)) {
      const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
      FS.writeFile(`${BIOS_DIR}/${name}`, buf);
    }
  }

  // Mount extra files
  if (options.extraFiles) {
    for (const [path, data] of Object.entries(options.extraFiles)) {
      const dir = path.substring(0, path.lastIndexOf("/"));
      if (dir) mkdirp(FS, dir);
      const buf = data instanceof Uint8Array ? data : new Uint8Array(data);
      FS.writeFile(path, buf);
    }
  }
}

/**
 * Load and start QEMU from JS glue code text.
 *
 * This is the primary entry point for Durable Object / Worker environments
 * where the JS glue code is loaded as a text string (e.g., from KV, R2, or
 * bundled as a string asset).
 *
 * The v5 build uses `emscripten_set_main_loop()` — after `callMain()` returns,
 * QEMU runs autonomously via the JS event loop. No explicit stepping needed.
 *
 * @param qemuJsText - The contents of qemu-system-i386-v5.cjs (globalThis.Module patched)
 * @param options - QEMU initialization options
 */
export async function loadQEMUFromText(
  qemuJsText: string,
  options: QEMUOptions,
): Promise<QEMUInstance> {
  const { args, onOutput, onError, onAbort, wasmBinary } = options;
  let resolveInit: () => void;
  let rejectInit: (e: Error) => void;
  let moduleRef: EmscriptenModule | null = null;
  let aborted = false;

  const initPromise = new Promise<void>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
  });

  // Set up Module globally before the QEMU JS runs.
  // The .cjs variant is patched to read from globalThis.Module.
  (globalThis as unknown as Record<string, unknown>).Module = {
    // Don't auto-run main — we call it manually after FS setup
    noInitialRun: true,

    // Don't exit the runtime when main() returns
    noExitRuntime: true,

    // Serial console output (stdout)
    print: (line: string) => onOutput?.(line),

    // Debug/error output (stderr)
    printErr: (line: string) => (onError ?? onOutput)?.(line),

    // Called when the WASM runtime is ready
    onRuntimeInitialized() {
      moduleRef = (globalThis as unknown as Record<string, unknown>)
        .Module as EmscriptenModule;

      // Mount BIOS and other files before starting QEMU
      try {
        mountFiles(moduleRef.FS, options);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        aborted = true;
        rejectInit(new Error(`Failed to mount files: ${msg}`));
        return;
      }

      // Launch QEMU. In v5 (no ASYNCIFY), callMain() runs qemu_init()
      // and then emscripten_set_main_loop() which registers the main
      // loop callback. callMain() returns normally.
      try {
        moduleRef.callMain(args);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // ASYNCIFY "unwind" is swallowed for backwards compat with
        // older builds. ExitStatus(0) is normal for some configs.
        if (msg !== "unwind" && !msg.includes("ExitStatus")) {
          aborted = true;
          rejectInit(new Error(`QEMU callMain error: ${msg}`));
          return;
        }
      }

      // callMain returned — QEMU's main loop callback is now
      // registered via emscripten_set_main_loop(). The JS event
      // loop will invoke it automatically.
      resolveInit();
    },

    onAbort(what: string) {
      aborted = true;
      rejectInit(new Error(`QEMU aborted: ${what}`));
    },

    // Provide WASM binary (required in Worker/DO where fetch() of
    // file:// URLs isn't possible)
    ...(wasmBinary ? { wasmBinary } : {}),
  };

  // Execute the QEMU JS glue code in the current context.
  // This kicks off WASM compilation and will call onRuntimeInitialized
  // asynchronously when ready.
  // eslint-disable-next-line no-new-func
  const fn = new Function(qemuJsText);
  fn();

  await initPromise;

  const module = moduleRef!;
  return {
    get module() {
      return module;
    },
    get fs() {
      return module.FS as EmscriptenFS;
    },
    get aborted() {
      return aborted;
    },
    stop() {
      // Cancel the Emscripten main loop if possible
      try {
        const cancelMainLoop = module[
          "_emscripten_cancel_main_loop"
        ] as (() => void) | undefined;
        if (typeof cancelMainLoop === "function") {
          cancelMainLoop();
        }
      } catch (_e) {
        // best-effort
      }
      aborted = true;
    },
  };
}

/**
 * Load and start QEMU using require() (Node.js / CJS testing only).
 *
 * Sets up globalThis.Module and then requires the .cjs file.
 * The .cjs file must be the globalThis.Module-patched variant.
 *
 * @param requirePath - Path to the .cjs file (e.g., './qemu-wasm/qemu-system-i386-v5.cjs')
 * @param options - QEMU initialization options
 */
export async function loadQEMU(options: QEMUOptions & { requirePath: string }): Promise<QEMUInstance> {
  const { requirePath, ...rest } = options;

  // In Node.js, we can read the file and use loadQEMUFromText
  // But for CJS compat, we set up globalThis.Module and use require()
  const { args, onOutput, onError, onAbort, wasmBinary } = rest;
  let resolveInit: () => void;
  let rejectInit: (e: Error) => void;
  let moduleRef: EmscriptenModule | null = null;
  let aborted = false;

  const initPromise = new Promise<void>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
  });

  (globalThis as unknown as Record<string, unknown>).Module = {
    noInitialRun: true,
    noExitRuntime: true,

    print: (line: string) => onOutput?.(line),
    printErr: (line: string) => (onError ?? onOutput)?.(line),

    onRuntimeInitialized() {
      moduleRef = (globalThis as unknown as Record<string, unknown>)
        .Module as EmscriptenModule;

      try {
        mountFiles(moduleRef.FS, rest);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        aborted = true;
        rejectInit(new Error(`Failed to mount files: ${msg}`));
        return;
      }

      try {
        moduleRef.callMain(args);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== "unwind" && !msg.includes("ExitStatus")) {
          aborted = true;
          rejectInit(new Error(`QEMU callMain error: ${msg}`));
          return;
        }
      }

      resolveInit();
    },

    onAbort(what: string) {
      aborted = true;
      rejectInit(new Error(`QEMU aborted: ${what}`));
    },

    ...(wasmBinary ? { wasmBinary } : {}),
  };

  // Use dynamic require for CJS
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require(requirePath);

  await initPromise;

  const module = moduleRef!;
  return {
    get module() {
      return module;
    },
    get fs() {
      return module.FS as EmscriptenFS;
    },
    get aborted() {
      return aborted;
    },
    stop() {
      try {
        const cancelMainLoop = module[
          "_emscripten_cancel_main_loop"
        ] as (() => void) | undefined;
        if (typeof cancelMainLoop === "function") {
          cancelMainLoop();
        }
      } catch (_e) {
        // best-effort
      }
      aborted = true;
    },
  };
}
