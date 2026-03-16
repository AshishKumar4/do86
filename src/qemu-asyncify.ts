/**
 * QEMU ASYNCIFY wrapper for Cloudflare Durable Objects.
 *
 * This module drives QEMU compiled to WebAssembly with Emscripten ASYNCIFY.
 * Key properties for DO compatibility:
 *   - No pthreads / no SharedArrayBuffer.Atomics.wait
 *   - ASYNCIFY transforms emscripten_sleep() calls into JS async boundaries
 *   - QEMU's main loop calls emscripten_sleep(N) instead of poll/select
 *   - Each call to step() lets QEMU run for one main-loop iteration (~4ms)
 *
 * Build flags used:
 *   -sASYNCIFY=1 -sASYNCIFY_STACK_SIZE=131072
 *   -sASYNCIFY_IMPORTS=emscripten_sleep
 *   -sINVOKE_RUN=0  (we call callMain manually)
 *   -sEXPORTED_RUNTIME_METHODS=FS,callMain
 *   -sENVIRONMENT=node
 *   No -sPROXY_TO_PTHREAD (critical for DO compatibility)
 *
 * Usage in a Durable Object:
 *
 *   import { QEMUInstance, loadQEMU } from './qemu-asyncify';
 *
 *   export class MyDO extends DurableObject {
 *     qemu: QEMUInstance | null = null;
 *
 *     async fetch(request: Request) {
 *       if (!this.qemu) {
 *         this.qemu = await loadQEMU({
 *           args: ['-M', 'none', '-m', '16M', '-nographic', '-S'],
 *           onOutput: (line) => console.log('[QEMU]', line),
 *         });
 *         // QEMU is now running in its main loop, yielding via ASYNCIFY every 4ms
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
   * Example: ['-M', 'none', '-m', '16M', '-nographic', '-S']
   *
   * Note: Machines with complex hardware (PC, isapc) may hang due to
   * coroutine limitations in the current build. Use '-M none' for
   * basic operation, or provide a custom kernel/firmware.
   */
  args: string[];

  /** Called with each line of QEMU's stdout/stderr output */
  onOutput?: QEMUOutputCallback;

  /**
   * Called when QEMU aborts (error condition).
   * Default: logs to console.error
   */
  onAbort?: (reason: string) => void;

  /**
   * Path to the QEMU wasm file (relative or absolute).
   * Default: './qemu-system-i386.wasm' (for Workers/DO environments,
   * this should be the URL/binding for the WASM asset)
   */
  wasmUrl?: string;

  /**
   * Pre-loaded WASM binary (ArrayBuffer or Uint8Array).
   * Provide this when you can't use file:// URLs (e.g., in a Worker).
   */
  wasmBinary?: ArrayBuffer | Uint8Array;
}

/** A running QEMU instance */
export interface QEMUInstance {
  /** The Emscripten Module object */
  readonly module: EmscriptenModule;

  /**
   * The QEMU FS (virtual filesystem).
   * Use this to read/write files that QEMU can access.
   * Example: qemu.fs.writeFile('/drive.raw', data)
   */
  readonly fs: EmscriptenFS;

  /**
   * Whether QEMU has been aborted/crashed.
   */
  readonly aborted: boolean;

  /**
   * Stop the QEMU instance (best-effort cleanup).
   */
  stop(): void;
}

/** Minimal Emscripten Module interface */
interface EmscriptenModule {
  callMain: (args: string[]) => void;
  FS: EmscriptenFS;
  _emscripten_sleep?: (ms: number) => void;
  [key: string]: unknown;
}

/** Minimal Emscripten FS interface */
interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array, opts?: { encoding?: string }): void;
  readFile(path: string, opts?: { encoding?: string }): Uint8Array | string;
  mkdir(path: string): void;
  unlink(path: string): void;
  stat(path: string): { size: number; mode: number };
  [key: string]: unknown;
}

/**
 * Load and start QEMU.
 *
 * Returns a Promise that resolves after QEMU's runtime initializes and
 * callMain() has been invoked. At this point QEMU is running asynchronously
 * via ASYNCIFY — its main loop yields to the JS event loop every ~4ms.
 */
export async function loadQEMU(options: QEMUOptions): Promise<QEMUInstance> {
  const { args, onOutput, onAbort, wasmUrl, wasmBinary } = options;
  const outputLines: string[] = [];
  let aborted = false;
  let moduleRef: EmscriptenModule | null = null;

  await new Promise<void>((resolve, reject) => {
    // Set up the Module BEFORE loading the QEMU JS.
    // The QEMU JS was patched to check globalThis.Module so this works
    // even when the JS is loaded via require() or dynamic import.
    (globalThis as unknown as Record<string, unknown>).Module = {
      // Don't auto-run main — we call it manually after initialization
      noInitialRun: true,

      // Handle QEMU stdout/stderr
      print: (line: string) => {
        outputLines.push(line);
        onOutput?.(line);
      },
      printErr: (line: string) => {
        outputLines.push(line);
        onOutput?.(line);
      },

      // Called when the WASM runtime is ready (but before main runs)
      onRuntimeInitialized() {
        moduleRef = (globalThis as unknown as Record<string, unknown>).Module as EmscriptenModule;

        // Launch QEMU's main(). With ASYNCIFY, callMain() suspends when
        // QEMU's main loop calls emscripten_sleep(), returning control here.
        try {
          moduleRef.callMain(args);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          // ASYNCIFY "unwind" exceptions are normal and should be swallowed
          if (msg !== 'unwind' && !msg.includes('ExitStatus')) {
            aborted = true;
            onAbort?.(msg);
            reject(new Error(`QEMU callMain error: ${msg}`));
            return;
          }
        }

        // callMain returned — QEMU is now running asynchronously.
        // The emscripten_sleep() in QEMU's main loop will wake it up
        // via setTimeout every ~4ms.
        resolve();
      },

      onAbort(what: string) {
        aborted = true;
        const msg = `QEMU aborted: ${what}`;
        onAbort?.(msg);
        reject(new Error(msg));
      },

      // Provide WASM binary if given (needed for Worker environments
      // where file: URLs aren't available)
      ...(wasmBinary ? { wasmBinary } : {}),
      ...(wasmUrl ? {
        locateFile: (path: string) => {
          if (path.endsWith('.wasm')) return wasmUrl;
          return path;
        }
      } : {}),
    };

    // Load the QEMU JS glue code.
    // In a Durable Object / Worker, you'd typically do:
    //   const qemuJs = await env.ASSETS.get('qemu-system-i386.js');
    //   eval(await qemuJs.text());
    //
    // For local testing (Node.js), use:
    //   require('./qemu-system-i386.js');
    //
    // The QEMU JS is designed to use globalThis.Module (patched).
    // This function just sets up the Module; the caller must arrange
    // for the QEMU JS to be loaded/executed.
  });

  if (!moduleRef) {
    throw new Error('QEMU module not initialized');
  }

  const module = moduleRef;

  return {
    get module() { return module; },
    get fs() { return module.FS as EmscriptenFS; },
    get aborted() { return aborted; },
    stop() {
      // Best-effort: there's no clean shutdown for ASYNCIFY QEMU
      // The DO lifecycle will clean up the WASM memory
      aborted = true;
    },
  };
}

/**
 * Helper to load QEMU in a Durable Object environment.
 * Evaluates the QEMU JS glue code from a text string.
 *
 * @param qemuJsText - The contents of qemu-system-i386.js
 * @param options - QEMU initialization options
 */
export async function loadQEMUFromText(
  qemuJsText: string,
  options: QEMUOptions
): Promise<QEMUInstance> {
  const { args, onOutput, onAbort, wasmBinary } = options;
  let resolveInit: () => void;
  let rejectInit: (e: Error) => void;
  let moduleRef: EmscriptenModule | null = null;
  let aborted = false;

  const initPromise = new Promise<void>((resolve, reject) => {
    resolveInit = resolve;
    rejectInit = reject;
  });

  // Set up Module globally before the QEMU JS runs
  (globalThis as unknown as Record<string, unknown>).Module = {
    noInitialRun: true,

    print: (line: string) => onOutput?.(line),
    printErr: (line: string) => onOutput?.(line),

    onRuntimeInitialized() {
      moduleRef = (globalThis as unknown as Record<string, unknown>).Module as EmscriptenModule;
      try {
        moduleRef.callMain(args);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg !== 'unwind' && !msg.includes('ExitStatus')) {
          aborted = true;
          rejectInit(new Error(`QEMU callMain: ${msg}`));
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

  // Execute the QEMU JS glue code in the current context
  // This sets up the WASM loading and will call onRuntimeInitialized
  // when ready (asynchronously via Promise)
  // eslint-disable-next-line no-new-func
  const fn = new Function(qemuJsText);
  fn();

  await initPromise;

  const module = moduleRef!;
  return {
    get module() { return module; },
    get fs() { return module.FS as EmscriptenFS; },
    get aborted() { return aborted; },
    stop() { aborted = true; },
  };
}
