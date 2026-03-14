/**
 * QEMU-WASM Browser Boot Script
 *
 * Loads the Emscripten-compiled QEMU i386 system emulator in the browser.
 * The QEMU binary + BIOS files + disk images are fetched from the server
 * and loaded into the Emscripten virtual filesystem before QEMU's main()
 * is called.
 *
 * Requirements:
 * - crossOriginIsolated must be true (COOP+COEP headers) for SharedArrayBuffer
 * - QEMU assets in /qemu/ (WASM, JS, worker.js, BIOS files)
 * - Disk images in /assets/
 */

// ── DOM references ───────────────────────────────────────────────────────────

const term = document.getElementById("terminal")!;
const statusEl = document.getElementById("status")!;
const progressEl = document.getElementById("progress")!;
const infoBar = document.getElementById("info-bar")!;
const canvasContainer = document.getElementById("canvas-container")!;
const canvas = document.getElementById("screen") as HTMLCanvasElement;
const controlsEl = document.getElementById("controls")!;
const perfInfo = document.getElementById("perf-info")!;

// ── Logging ──────────────────────────────────────────────────────────────────

let logLines = 0;
const MAX_LOG_LINES = 2000;

function log(msg: string) {
  if (logLines > MAX_LOG_LINES) {
    const lines = term.textContent!.split("\n");
    term.textContent = lines.slice(-500).join("\n");
    logLines = 500;
  }
  term.textContent += msg + "\n";
  logLines++;
  term.scrollTop = term.scrollHeight;
}

function setStatus(text: string, cls?: string) {
  statusEl.textContent = text;
  statusEl.className = cls || "";
}

// ── Query params ─────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const imageKey = params.get("image") || "aqeous";
const smpCores = parseInt(params.get("smp") || "1", 10);
const ramMB = parseInt(params.get("ram") || "32", 10);

log("[do86] QEMU-WASM i386 System Emulator");
log(`[do86] Image: ${imageKey} | SMP: ${smpCores} | RAM: ${ramMB}MB`);
log(`[do86] crossOriginIsolated: ${crossOriginIsolated}`);
log(
  `[do86] SharedArrayBuffer: ${typeof SharedArrayBuffer !== "undefined" ? "available" : "MISSING"}`,
);
log("");

if (!crossOriginIsolated) {
  log("[WARN] crossOriginIsolated is false");
  log("[WARN] QEMU pthreads build requires COOP+COEP headers.");
  log("[WARN] Waiting for COI service worker to activate and reload...");
  setStatus("waiting for COOP/COEP", "error");
  // Page will reload once COI service worker injects headers
}

// ── Asset fetcher with progress ──────────────────────────────────────────────

async function fetchBinary(url: string, label: string): Promise<Uint8Array> {
  log(`[fetch] ${label}...`);
  const t0 = performance.now();
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`${label}: HTTP ${resp.status}`);

  const contentLength = resp.headers.get("content-length");
  let buf: Uint8Array;
  if (contentLength && resp.body) {
    const total = parseInt(contentLength, 10);
    const reader = resp.body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      received += value.length;
      const pct = ((received / total) * 100).toFixed(0);
      progressEl.innerHTML = `<span class="spinner"></span>${label}: ${pct}% (${(received / 1024 / 1024).toFixed(1)}/${(total / 1024 / 1024).toFixed(1)} MB)`;
    }
    buf = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      buf.set(chunk, offset);
      offset += chunk.length;
    }
  } else {
    buf = new Uint8Array(await resp.arrayBuffer());
  }

  const ms = (performance.now() - t0).toFixed(0);
  const size =
    buf.byteLength > 1024 * 1024
      ? `${(buf.byteLength / 1024 / 1024).toFixed(1)} MB`
      : `${(buf.byteLength / 1024).toFixed(0)} KB`;
  log(`[fetch] ${label}: ${size} in ${ms}ms`);
  return buf;
}

// ── Load Emscripten module factory ───────────────────────────────────────────
// The Emscripten JS is in /public/qemu/ — Vite blocks import() of files in
// /public, so we fetch the source text, create a blob: URL, and import that.
// This completely bypasses Vite's import-analysis plugin.

async function loadEmscriptenFactory(): Promise<
  (config: Record<string, unknown>) => Promise<any>
> {
  log("[boot] Loading Emscripten module factory...");

  // Build the URL dynamically to prevent Vite static analysis from finding it.
  // Vite scans string literals in import() — a runtime-constructed URL is opaque.
  const jsUrl = "/qemu/" + ["qemu", "system", "i386"].join("-") + ".js";

  const resp = await fetch(jsUrl);
  if (!resp.ok) throw new Error(`Failed to fetch Emscripten JS: HTTP ${resp.status}`);
  const jsText = await resp.text();

  const blob = new Blob([jsText], { type: "text/javascript" });
  const blobUrl = URL.createObjectURL(blob);

  try {
    // @vite-ignore prevents Vite from trying to resolve the blob URL
    const mod = await import(/* @vite-ignore */ blobUrl);
    const factory = mod.default;
    if (typeof factory !== "function") {
      throw new Error(
        `Emscripten module factory is not a function (got ${typeof factory})`,
      );
    }
    log("[boot] Emscripten module factory loaded");
    return factory;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

// ── Main boot sequence ───────────────────────────────────────────────────────

async function boot() {
  if (!crossOriginIsolated) return;

  try {
    const t0 = performance.now();
    progressEl.innerHTML =
      '<span class="spinner"></span>Downloading QEMU WASM + BIOS + disk image...';

    const diskExt = imageKey === "kolibri" ? "img" : "iso";
    const diskPath = `/assets/${imageKey}.${diskExt}`;

    // Download all assets in parallel
    const [wasmBinary, bios, vgaBios, kvmvapic, linuxboot, diskImage] =
      await Promise.all([
        fetchBinary("/qemu/qemu-system-i386.wasm", "qemu-system-i386.wasm"),
        fetchBinary("/qemu/bios-256k.bin", "bios-256k.bin"),
        fetchBinary("/qemu/vgabios-stdvga.bin", "vgabios-stdvga.bin"),
        fetchBinary("/qemu/kvmvapic.bin", "kvmvapic.bin"),
        fetchBinary("/qemu/linuxboot_dma.bin", "linuxboot_dma.bin"),
        fetchBinary(diskPath, `${imageKey}.${diskExt}`),
      ]);

    const dlTime = ((performance.now() - t0) / 1000).toFixed(1);
    const totalMB =
      [wasmBinary, bios, vgaBios, kvmvapic, linuxboot, diskImage].reduce(
        (s, b) => s + b.byteLength,
        0,
      ) /
      1024 /
      1024;
    log("");
    log(`[boot] All assets loaded: ${totalMB.toFixed(1)} MB in ${dlTime}s`);
    log("[boot] Initializing QEMU...");
    progressEl.innerHTML =
      '<span class="spinner"></span>Starting QEMU emulator...';
    setStatus("booting", "");

    // QEMU drive arguments
    const driveArgs =
      diskExt === "img"
        ? ["-fda", "/drive/disk.img"]
        : ["-cdrom", "/drive/disk.iso", "-boot", "d"];

    // QEMU command-line arguments (argv[1..n])
    const qemuArgs = [
      "-machine", "pc,accel=tcg",
      "-cpu", "pentium3",
      "-m", String(ramMB),
      "-smp", String(smpCores),
      ...driveArgs,
      "-vga", "std",
      "-display", "none",
      "-serial", "stdio",
      "-monitor", "none",
      "-no-reboot",
      "-no-shutdown",
      "-icount", "shift=2,sleep=on",
      "-L", "/usr/local/share/qemu",
    ];

    log(`[boot] QEMU args: qemu-system-i386 ${qemuArgs.join(" ")}`);
    log("");

    // Load the Emscripten module factory (blob URL bypass)
    const QemuModuleFactory = await loadEmscriptenFactory();

    // The canonical URL for the main JS — workers need this to import it
    const mainJsUrl = new URL("/qemu/qemu-system-i386.js", location.href).href;

    const instance = await QemuModuleFactory({
      arguments: qemuArgs,
      thisProgram: "qemu-system-i386",

      preRun: [
        function (mod: any) {
          log("[fs] Setting up virtual filesystem...");

          // QEMU was compiled with --prefix=/usr/local
          // It looks for BIOS at /usr/local/share/qemu/
          mod.FS.mkdirTree("/usr/local/share/qemu");
          mod.FS.writeFile("/usr/local/share/qemu/bios-256k.bin", bios);
          mod.FS.writeFile(
            "/usr/local/share/qemu/vgabios-stdvga.bin",
            vgaBios,
          );
          mod.FS.writeFile("/usr/local/share/qemu/kvmvapic.bin", kvmvapic);
          mod.FS.writeFile(
            "/usr/local/share/qemu/linuxboot_dma.bin",
            linuxboot,
          );

          try {
            mod.FS.symlink(
              "/usr/local/share/qemu/vgabios-stdvga.bin",
              "/usr/local/share/qemu/vgabios.bin",
            );
          } catch (_e) {
            /* ignore if symlink not supported */
          }

          mod.FS.mkdirTree("/drive");
          mod.FS.writeFile(`/drive/disk.${diskExt}`, diskImage);

          log(
            "[fs] BIOS: bios-256k.bin, vgabios-stdvga.bin, kvmvapic.bin, linuxboot_dma.bin",
          );
          log(
            `[fs] Disk: /drive/disk.${diskExt} (${(diskImage.byteLength / 1024 / 1024).toFixed(1)} MB)`,
          );
          log("[fs] Virtual filesystem ready");
        },
      ],

      // Capture stdout — serial console
      print: function (text: string) {
        log(text);
      },

      // Capture stderr — QEMU diagnostic output
      printErr: function (text: string) {
        log("[qemu:err] " + text);
      },

      // Canvas for VGA framebuffer
      canvas: canvas,

      // Resolve paths for WASM binary and worker
      locateFile: function (filename: string) {
        if (filename.endsWith(".wasm"))
          return "/qemu/qemu-system-i386.wasm";
        if (filename.endsWith(".worker.js"))
          return "/qemu/qemu-system-i386.worker.js";
        return "/qemu/" + filename;
      },

      // Provide pre-downloaded WASM binary (avoids double-fetch)
      wasmBinary: wasmBinary.buffer,

      // Tell Emscripten where the main JS lives so pthread Workers can import it.
      // Without this, workers try a relative import from the blob URL which fails.
      mainScriptUrlOrBlob: mainJsUrl,

      // Status callback for Emscripten init phases
      setStatus: function (text: string) {
        if (text)
          progressEl.innerHTML = `<span class="spinner"></span>${text}`;
      },

      // Called when the QEMU WASM runtime is fully initialized
      onRuntimeInitialized: function () {
        log("");
        log("[boot] QEMU runtime initialized");
        const bootTime = ((performance.now() - t0) / 1000).toFixed(1);
        log(`[boot] Total time to runtime init: ${bootTime}s`);
      },

      onAbort: function (what: string) {
        log("");
        log("[ABORT] " + what);
        setStatus("aborted", "error");
      },

      quit: function (status: number) {
        log(`[exit] QEMU exited with status ${status}`);
        setStatus("exited", "");
      },
    });

    log("");
    log("[boot] QEMU module created — emulation starting on worker thread");
    setStatus("running", "running");
    progressEl.style.display = "none";

    // Show canvas and controls
    canvasContainer.style.display = "block";
    controlsEl.style.display = "flex";

    document
      .getElementById("btn-fullscreen")!
      .addEventListener("click", () => {
        canvas.requestFullscreen?.();
      });

    canvas.focus();

    infoBar.textContent = `QEMU i386 | TCG/TCI | ${smpCores} vCPU | ${ramMB}MB RAM | ${imageKey}`;

    // Periodic heap stats
    setInterval(() => {
      const heap = (instance as any).HEAPU8?.length;
      if (heap) {
        perfInfo.textContent = `Heap: ${(heap / 1024 / 1024).toFixed(0)} MB`;
      }
    }, 5000);
  } catch (err: any) {
    log("");
    log(`[ERROR] ${err.message}`);
    if (err.stack) log(err.stack);
    setStatus("error", "error");
    progressEl.innerHTML = `<span style="color:#f85149">Boot failed: ${err.message}</span>`;
    console.error("[QEMU boot error]", err);
  }
}

boot();
