/**
 * Minimal QEMU-WASM boot script.
 *
 * 1. Fetch BIOS + ISO + WASM into ArrayBuffers
 * 2. Dynamically load the Emscripten JS (ES module, fetch+blob to dodge Vite)
 * 3. Call the factory with preRun to populate the virtual FS
 * 4. Serial output goes to a <pre> element
 */

const pre = document.getElementById("terminal") as HTMLPreElement;
const statusEl = document.getElementById("status")!;
const progressEl = document.getElementById("progress")!;

function log(msg: string) {
  pre.textContent += msg + "\n";
  pre.scrollTop = pre.scrollHeight;
  console.log(msg);
}

function setStatus(text: string, cls = "") {
  statusEl.textContent = text;
  statusEl.className = cls;
}

// ── helpers ──────────────────────────────────────────────────────────

async function fetchBin(url: string, label: string): Promise<Uint8Array> {
  log(`[fetch] ${label} ...`);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${label}: HTTP ${r.status}`);
  const buf = new Uint8Array(await r.arrayBuffer());
  const kb = (buf.byteLength / 1024).toFixed(0);
  log(`[fetch] ${label}: ${kb} KB`);
  return buf;
}

// ── boot ─────────────────────────────────────────────────────────────

async function boot() {
  log("[qemu] QEMU-WASM i386 boot");
  log(`[qemu] crossOriginIsolated = ${crossOriginIsolated}`);
  log(`[qemu] SharedArrayBuffer   = ${typeof SharedArrayBuffer !== "undefined"}`);
  log("");

  if (!crossOriginIsolated) {
    log("[WARN] crossOriginIsolated is false — pthreads will fail.");
    log("[WARN] Check COOP/COEP headers.");
    setStatus("no COOP/COEP", "error");
  }

  try {
    setStatus("downloading");
    progressEl.textContent = "Downloading QEMU + BIOS + disk ...";

    // Parallel fetch everything
    const [wasmBin, bios, vga, kvmvapic, linuxboot, disk] = await Promise.all([
      fetchBin("/qemu/qemu-system-i386.wasm", "qemu WASM"),
      fetchBin("/qemu/bios-256k.bin",         "BIOS"),
      fetchBin("/qemu/vgabios-stdvga.bin",    "VGA BIOS"),
      fetchBin("/qemu/kvmvapic.bin",          "kvmvapic"),
      fetchBin("/qemu/linuxboot_dma.bin",     "linuxboot"),
      fetchBin("/assets/aqeous.iso",          "aqeous.iso"),
    ]);

    log("");
    log("[boot] All assets fetched. Loading Emscripten module ...");
    progressEl.textContent = "Initializing QEMU ...";
    setStatus("booting");

    // ── Load Emscripten factory ──────────────────────────────────────
    // The .js is an ES module (export default Module). We fetch its text
    // and import via a blob URL so Vite doesn't try to transform it.
    const jsUrl = "/qemu/" + ["qemu", "system", "i386"].join("-") + ".js";
    const jsResp = await fetch(jsUrl);
    if (!jsResp.ok) throw new Error(`Emscripten JS: HTTP ${jsResp.status}`);
    const jsText = await jsResp.text();
    const blob = new Blob([jsText], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);

    let factory: (cfg: any) => Promise<any>;
    try {
      const mod = await import(/* @vite-ignore */ blobUrl);
      factory = mod.default;
    } finally {
      URL.revokeObjectURL(blobUrl);
    }

    if (typeof factory !== "function") {
      throw new Error(`Module.default is ${typeof factory}, expected function`);
    }
    log("[boot] Emscripten factory loaded");

    // ── QEMU args ────────────────────────────────────────────────────
    const qemuArgs = [
      "-machine", "pc,accel=tcg",
      "-cpu",     "pentium3",
      "-m",       "128",
      "-smp",     "1",
      "-cdrom",   "/drive/disk.iso",
      "-boot",    "d",
      "-vga",     "std",
      "-display", "none",
      "-serial",  "stdio",
      "-monitor", "none",
      "-no-reboot",
      "-no-shutdown",
      "-icount",  "shift=2,sleep=on",
      "-L",       "/usr/local/share/qemu",
      "-nic",     "none",
    ];
    log(`[boot] args: qemu-system-i386 ${qemuArgs.join(" ")}`);

    // Canonical URL for the main JS so pthread workers can import it
    const mainJsUrl = new URL("/qemu/qemu-system-i386.js", location.href).href;

    // ── Call the factory ─────────────────────────────────────────────
    const instance = await factory({
      arguments: qemuArgs,
      thisProgram: "qemu-system-i386",

      preRun: [
        (mod: any) => {
          const FS = mod.FS;
          const BIOS = "/usr/local/share/qemu";
          log("[fs] Writing BIOS + disk to virtual FS ...");

          FS.mkdirTree(BIOS);
          FS.writeFile(BIOS + "/bios-256k.bin", bios);
          FS.writeFile(BIOS + "/vgabios-stdvga.bin", vga);
          FS.writeFile(BIOS + "/kvmvapic.bin", kvmvapic);
          FS.writeFile(BIOS + "/linuxboot_dma.bin", linuxboot);
          try { FS.symlink(BIOS + "/vgabios-stdvga.bin", BIOS + "/vgabios.bin"); } catch {}

          FS.mkdirTree("/drive");
          FS.writeFile("/drive/disk.iso", disk);

          log(`[fs] BIOS at ${BIOS}, disk at /drive/disk.iso`);
        },
      ],

      print:    (t: string) => log(t),
      printErr: (t: string) => log("[stderr] " + t),

      canvas: document.getElementById("screen") as HTMLCanvasElement,

      locateFile(name: string) {
        if (name.endsWith(".wasm"))      return "/qemu/qemu-system-i386.wasm";
        if (name.endsWith(".worker.js")) return "/qemu/qemu-system-i386.worker.js";
        return "/qemu/" + name;
      },

      wasmBinary: wasmBin.buffer,
      mainScriptUrlOrBlob: mainJsUrl,

      setStatus(text: string) {
        if (text) progressEl.textContent = text;
      },

      onRuntimeInitialized() {
        log("");
        log("[boot] QEMU runtime initialized");
      },

      onAbort(what: string) {
        log("[ABORT] " + what);
        setStatus("aborted", "error");
      },

      quit(code: number) {
        // With PROXY_TO_PTHREAD, main thread exits 0 immediately while
        // the real QEMU work runs on a worker thread. That's normal.
        if (code === 0) {
          log("[main] main thread returned (PROXY_TO_PTHREAD) — worker running");
        } else {
          log(`[exit] QEMU exited with status ${code}`);
          setStatus("exited", "error");
        }
      },
    });

    log("");
    log("[boot] QEMU module created — emulation running");
    setStatus("running", "running");
    progressEl.style.display = "none";
  } catch (err: any) {
    log("");
    log(`[ERROR] ${err.message}`);
    if (err.stack) log(err.stack);
    setStatus("error", "error");
    progressEl.textContent = `Boot failed: ${err.message}`;
    console.error(err);
  }
}

boot();
