/**
 * qemu-standalone-do.ts — Self-contained QEMU Durable Object.
 *
 * Runs a single QEMU vCPU inside a DO using QemuWrapper (no-ASYNCIFY) +
 * SqlPageStore (demand-paged RAM via synchronous DO SQLite). Streams serial
 * output and VGA framebuffer to connected WebSocket clients.
 *
 * Asset loading: QEMU WASM (~7MB), JS glue (~160KB), and BIOS ROMs are
 * fetched from R2 (ASSETS_BUCKET) on first boot and cached in DO SQLite
 * via ChunkedBlobStore. Subsequent boots load instantly from cache.
 *
 * Alternatively, assets can be POSTed to /init as a packed binary blob
 * (TLV format) for development without R2.
 */

import { DurableObject } from "cloudflare:workers";
import { QEMUWrapper, type QEMUWrapperConfig } from "./qemu-wrapper";
import { QemuPageStoreStub } from "./qemu-page-store";
import { DeltaEncoder, encodeSerialData, encodeStatus } from "./delta-encoder";
import { type ClientMessage, LOG_PREFIX, MSG_FULL_FRAME } from "./types";

// ── Deploy-time imports (pre-compiled by Wrangler) ──────────────────────────
// WASM: Wrangler compiles this to a WebAssembly.Module at deploy time.
// Glue: The Emscripten JS runtime, transformed to a Workers-safe ES module.
// These CANNOT be loaded from R2 at runtime — Workers block eval() and
// WebAssembly.compile(). They must be bundled into the Worker module.
import qemuWasmModule from "./qemu-v6.wasm";
import createQemuModule from "./qemu-v6-glue.mjs";

// ── Environment ─────────────────────────────────────────────────────────────

export interface QemuStandaloneEnv {
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

// ── BIOS firmware paths (fetched from static assets at runtime — data only) ─
// These are small data files (~300KB total), not code. Safe to fetch at runtime.
const BIOS_FIRMWARE = [
  { path: "/qemu-do/bios-256k.bin", key: "bios" },
  { path: "/qemu-do/vgabios-stdvga.bin", key: "vgaBios" },
];

// ── Constants ───────────────────────────────────────────────────────────────

const HOT_PAGES_MAX = 8192;     // 32MB hot window (8192 * 4KB)
const WASM_HEAP_MB = 48;        // Total WASM linear memory
const RENDER_FPS = 15;  // Frame capture rate for display streaming
const KEEPALIVE_MS = 15_000;     // Server-side keepalive interval
const SERIAL_CAP = 4096;         // Max serial buffer chars

// ── Standalone QEMU Durable Object ─────────────────────────────────────────

export class QemuStandaloneDO extends DurableObject<QemuStandaloneEnv> {
  // ── Session state ───────────────────────────────────────────────────────
  private sessions = new Map<WebSocket, { needsKeyframe: boolean }>();

  // ── QEMU runtime ────────────────────────────────────────────────────────
  private qemu: QEMUWrapper | null = null;
  private sqlPageStore: QemuPageStoreStub | null = null;
  private booting = false;
  private booted = false;
  private bootError: string | null = null;
  private imageKey: string | null = null;

  // ── Serial output ───────────────────────────────────────────────────────
  private serialBuffer = "";
  private serialLines: string[] = [];

  // ── Display ─────────────────────────────────────────────────────────────
  private deltaEncoder = new DeltaEncoder();
  private renderTimer: ReturnType<typeof setInterval> | null = null;
  private keepaliveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSendTime = 0;

  // ── Cached assets (from /init POST or R2 fetch) ─────────────────────────
  private cachedAssets: Map<string, ArrayBuffer> | null = null;

  constructor(ctx: DurableObjectState, env: QemuStandaloneEnv) {
    super(ctx, env);
  }

  // ── HTTP router ─────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status") {
      return Response.json({
        running: this.booted,
        booting: this.booting,
        error: this.bootError,
        imageKey: this.imageKey,
        clients: this.sessions.size,
        pageStats: this.sqlPageStore?.stats ?? null,
      });
    }

    // Accept packed assets from Worker (fallback when R2 is unavailable)
    if (url.pathname === "/init" && request.method === "POST") {
      const packed = await request.arrayBuffer();
      this.cachedAssets = unpackAssets(packed);
      return Response.json({ status: "assets_received", keys: [...this.cachedAssets.keys()] });
    }

    if (url.pathname === "/kick" && request.method === "POST") {
      if (this.booted) return new Response("already running");
      if (this.booting) return new Response("already booting");
      if (!this.cachedAssets) {
        return new Response("no assets: POST firmware + disk to /init first", { status: 400 });
      }

      // Defer boot to macrotask so the 200 response flushes first
      this.ctx.waitUntil(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            this.boot().catch((err) => {
              this.bootError = String(err);
              console.error(`${LOG_PREFIX} QEMU boot failed:`, err);
              this.broadcast(encodeStatus(`error: ${this.bootError}`));
            }).finally(resolve);
          }, 0);
        }),
      );
      return new Response("ok");
    }

    // Debug: test WASM import chain without booting
    if (url.pathname === "/test-import") {
      return this.handleTestImport(request);
    }

    // ── WebSocket upgrade ─────────────────────────────────────────────────
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Non-hibernating: accept manually, attach event listeners
      server.accept();
      this.sessions.set(server, { needsKeyframe: true });

      // Send current state
      server.send(encodeStatus("connected"));
      if (this.bootError) {
        server.send(encodeStatus(`error: ${this.bootError}`));
      } else if (this.booted) {
        server.send(encodeStatus(`running: ${this.imageKey || "QEMU"}`));
        if (this.serialLines.length > 0) {
          server.send(encodeSerialData(this.serialLines.join("")));
        }
      }

      server.addEventListener("message", (event) => this.handleMessage(server, event.data));
      server.addEventListener("close", () => this.handleClose(server));
      server.addEventListener("error", () => this.handleClose(server));

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  // ── Boot sequence ─────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    if (this.booting || this.booted) return;
    this.booting = true;
    this.bootError = null;
    this.broadcast(encodeStatus("booting"));

    const log = (msg: string) => console.log(`${LOG_PREFIX} [qemu] ${msg}`);

    try {
      // 1. Load assets (R2 with SQLite cache, or from /init POST)
      const assets = await this.loadAssets(log);

      // 2. Parse metadata
      const metaJson = new TextDecoder().decode(new Uint8Array(assets.metadata));
      const meta = JSON.parse(metaJson) as {
        imageKey: string; drive: "fda" | "cdrom";
        memory: number; label: string;
      };
      this.imageKey = meta.imageKey;
      log(`image=${meta.imageKey} drive=${meta.drive} memory=${meta.memory}MB`);

      // 3. Create SqlPageStore
      
      this.sqlPageStore = new QemuPageStoreStub(HOT_PAGES_MAX);
      this.sqlPageStore.init();

      // 4. Build QemuWrapper config — WASM + glue from deploy-time imports
      const config: QEMUWrapperConfig = {
        apicId: 0,
        isBSP: true,
        memorySizeMB: Math.min(meta.memory || 32, 64),
        wasmHeapMB: WASM_HEAP_MB,
        sqlPageStore: this.sqlPageStore,
        wasmModule: qemuWasmModule,
        createFactory: createQemuModule,
        biosData: assets.biosData,
        vgaBiosData: assets.vgaBiosData,
        diskData: assets.disk,
        diskDrive: meta.drive,
        onSerialOutput: (char: string) => {
          this.serialBuffer += char;
          if (char === "\n" || this.serialBuffer.length > 256) {
            this.serialLines.push(this.serialBuffer);
            if (this.serialLines.length > 500) this.serialLines.shift();
            this.broadcast(encodeSerialData(this.serialBuffer));
            // Log first few post-init serial lines
            if (this.booted && this.serialLines.length <= 5) {
              console.log(`${LOG_PREFIX} SERIAL[${this.serialLines.length}]: ${this.serialBuffer.slice(0, 80)}`);
            }
            this.serialBuffer = "";
          }
        },
      };

      // 5. Free packed assets before WASM allocation
      this.cachedAssets = null;

      // 6. Create and init QemuWrapper
      // init() is async: WASM instantiation + callMain (runs qemu_init
      // synchronously — may take 1-3s for machine/device setup). After
      // callMain returns, the execution pump (setInterval) drives QEMU.
      this.qemu = new QEMUWrapper();
      log("initializing QemuWrapper (callMain will block briefly)...");
      this.broadcast(encodeStatus("initializing QEMU runtime"));

      // Yield to event loop before the heavy callMain() — this allows the
      // kick response and any pending WebSocket messages to flush.
      await new Promise<void>((r) => setTimeout(r, 0));

      await this.qemu.init(config);

      // 7. Start render + keepalive loops
      this.booted = true;
      this.booting = false;
      log(`QEMU booted: ${meta.label}`);
      this.broadcast(encodeStatus(`running: ${meta.label}`));
      this.startRenderLoop();

    } catch (err) {
      this.booting = false;
      this.bootError = String(err);
      this.cachedAssets = null;
      console.error(`${LOG_PREFIX} Boot failed:`, err);
      this.broadcast(encodeStatus(`error: ${this.bootError}`));
      throw err;
    }
  }

  // ── Asset loading ─────────────────────────────────────────────────────
  // WASM + JS glue are imported at deploy time (bundled into the Worker).
  // Only BIOS ROMs and disk images are loaded at runtime (data, not code).

  private async loadAssets(log: (msg: string) => void): Promise<{
    metadata: ArrayBuffer;
    biosData: ArrayBuffer;
    vgaBiosData: ArrayBuffer;
    disk: ArrayBuffer;
  }> {
    if (!this.cachedAssets) {
      throw new Error("no cached assets — POST firmware + disk to /init first");
    }

    log("loading assets from /init POST cache");
    const metadata = this.cachedAssets.get("metadata");
    const disk = this.cachedAssets.get("disk");
    if (!metadata || !disk) throw new Error("missing metadata or disk in packed assets");

    // BIOS ROMs: check the packed assets first, then fall back to description
    let biosData = this.cachedAssets.get("qemu_bios_256k_bin");
    let vgaBiosData = this.cachedAssets.get("qemu_vgabios_stdvga_bin");

    if (!biosData || !vgaBiosData) {
      throw new Error("missing BIOS ROMs in packed assets (need qemu_bios_256k_bin and qemu_vgabios_stdvga_bin)");
    }

    return { metadata, disk, biosData, vgaBiosData };
  }

  // ── Render loop ─────────────────────────────────────────────────────────

  private startRenderLoop(): void {
    if (this.renderTimer) return;

    let renderCount = 0;
    this.renderTimer = setInterval(() => {
      if (this.sessions.size === 0 || !this.qemu?.isLoaded) return;
      renderCount++;

      try {
        const frame = this.qemu.getScreenFrame();
        if (renderCount <= 5) {
          const graphical = this.qemu.isGraphicalMode();
          this.broadcast(encodeSerialData(
            `[RENDER] #${renderCount} graphical=${graphical} frame=${frame ? frame.byteLength : 'null'}\n`));
        }
        if (!frame || frame.byteLength < 12) return;

        // Parse header: [width:u32, height:u32, bufferWidth:u32]
        const header = new DataView(frame);
        const width = header.getUint32(0, true);
        const height = header.getUint32(4, true);
        const bufferWidth = header.getUint32(8, true);
        if (width === 0 || height === 0) return;

        // Extract RGBA pixels after header
        const pixels = new Uint8Array(frame, 12);

        // Build full frame message: [MSG_FULL_FRAME, width:u16, height:u16, ...rgbPixels]
        const rgbSize = width * height * 3;
        const msg = new ArrayBuffer(5 + rgbSize);
        const msgView = new Uint8Array(msg);
        const msgDV = new DataView(msg);
        msgView[0] = MSG_FULL_FRAME;
        msgDV.setUint16(1, width, true);
        msgDV.setUint16(3, height, true);

        // Convert RGBA → RGB (drop alpha)
        let outIdx = 5;
        for (let i = 0; i < width * height; i++) {
          const srcRow = Math.floor(i / width);
          const srcCol = i % width;
          const srcIdx = (srcRow * bufferWidth + srcCol) * 4;
          msgView[outIdx++] = pixels[srcIdx];
          msgView[outIdx++] = pixels[srcIdx + 1];
          msgView[outIdx++] = pixels[srcIdx + 2];
        }

        this.broadcast(msg);
      } catch (e) {
        console.error(`${LOG_PREFIX} Render error:`, e);
      }
    }, Math.round(1000 / RENDER_FPS));

    // Server-side keepalive
    this.keepaliveTimer = setInterval(() => {
      if (this.sessions.size > 0 && Date.now() - this.lastSendTime > 14_000) {
        this.broadcast(encodeStatus("alive"));
      }
    }, KEEPALIVE_MS);
  }

  private stopTimers(): void {
    if (this.renderTimer) { clearInterval(this.renderTimer); this.renderTimer = null; }
    if (this.keepaliveTimer) { clearInterval(this.keepaliveTimer); this.keepaliveTimer = null; }
  }

  // ── WebSocket message handler ─────────────────────────────────────────

  private handleMessage(ws: WebSocket, data: string | ArrayBuffer): void {
    if (typeof data !== "string") return;
    try {
      const msg: ClientMessage = JSON.parse(data);
      if (msg.type === "heartbeat") return;

      // TODO: wire keyboard/mouse input to QEMU via bridge exports
      // For now, only serial input is supported
      if (msg.type === "serial" && this.qemu?.isLoaded) {
        // QEMU serial input would go through Module._wasm_cpu_interrupt or stdin
      }
    } catch {
      // Never throw from WS handler
    }
  }

  private handleClose(ws: WebSocket): void {
    this.sessions.delete(ws);
    if (this.sessions.size === 0) {
      this.stopTimers();
      if (this.qemu) {
        this.qemu.stop();
        this.qemu = null;
      }
    }
  }

  // ── Debug: test WASM import chain ─────────────────────────────────────

  private async handleTestImport(request: Request): Promise<Response> {
    const t0 = Date.now();

    try {
      // Test that the deploy-time imports are available
      const hasWasm = qemuWasmModule instanceof WebAssembly.Module;
      const hasFactory = typeof createQemuModule === "function";

      // Instantiation test — create the module, optionally run callMain
      if (hasWasm && hasFactory) {
        const printLines: string[] = [];
        const mod = await createQemuModule({
          noInitialRun: true,
          noExitRuntime: true,
          locateFile: () => "",  // prevent new URL() with empty base
          instantiateWasm: (
            imports: WebAssembly.Imports,
            cb: (instance: WebAssembly.Instance) => void,
          ) => {
            WebAssembly.instantiate(qemuWasmModule, imports).then(cb);
            return {};
          },
          print: (line: string) => { if (printLines.length < 200) printLines.push(line); },
          printErr: (line: string) => { if (printLines.length < 200) printLines.push(`[ERR] ${line}`); },
        });

        const instantiateMs = Date.now() - t0;
        const exports = Object.keys(mod).filter((k: string) => k.startsWith("_wasm_"));

        // If ?boot=1 is passed, also test callMain (with timeout protection)
        let bootResult: string | null = null;
        if (new URL(request.url).searchParams.get("boot") === "1") {
          // Mount minimal BIOS/disk for boot test
          if (this.cachedAssets) {
            const biosData = this.cachedAssets.get("qemu_bios_256k_bin");
            const vgaBiosData = this.cachedAssets.get("qemu_vgabios_stdvga_bin");
            const disk = this.cachedAssets.get("disk");
            if (biosData && vgaBiosData) {
              try {
                mod.FS.mkdirTree?.("/usr/local/share/qemu");
                mod.FS.writeFile("/usr/local/share/qemu/bios-256k.bin", new Uint8Array(biosData));
                mod.FS.writeFile("/usr/local/share/qemu/vgabios-stdvga.bin", new Uint8Array(vgaBiosData));
                if (disk) {
                  const diskFile = "/disk.img";
                  mod.FS.writeFile(diskFile, new Uint8Array(disk));
                  // Verify the write
                  const readBack = mod.FS.readFile(diskFile, { encoding: "binary" });
                  const rb = new Uint8Array(readBack);
                  const orig = new Uint8Array(disk);
                  const match = rb.length === orig.length && rb[0] === orig[0] && rb[1] === orig[1] && rb[510] === orig[510] && rb[511] === orig[511];
                  printLines.push(`[VERIFY] disk ${diskFile}: wrote=${orig.length}B read=${rb.length}B first=[${orig[0].toString(16)},${orig[1].toString(16)}] boot=[${orig[510].toString(16)},${orig[511].toString(16)}] match=${match}`);
                }
              } catch (e: any) { bootResult = `FS error: ${e?.message}`; }
            }

            if (!bootResult) {
              try {
                const args = ["-M", "pc", "-m", "32M", "-smp", "1",
                  "-nographic", "-serial", "stdio",
                  "-no-reboot", "-nodefaults", "-no-user-config",
                  "-nic", "none", "-L", "/usr/local/share/qemu",
                  ...(disk ? ["-fda", "/disk.img"] : [])];
                const t1 = Date.now();
                mod.callMain(args);
                bootResult = `callMain returned in ${Date.now() - t1}ms`;
              } catch (e: any) {
                bootResult = `callMain threw: ${e?.message || e}`;
              }
            }
          } else {
            bootResult = "no cached assets — POST to /init first";
          }
        }

        return Response.json({
          ok: true,
          instantiateMs,
          hasWasm,
          hasFactory,
          heapSize: mod.HEAPU8?.byteLength ?? 0,
          wasmExports: exports,
          bootResult,
          printLines: printLines.slice(0, 50),
        });
      }

      return Response.json({ ok: false, hasWasm, hasFactory }, { status: 500 });
    } catch (e: any) {
      return Response.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private broadcast(data: ArrayBuffer | string): void {
    const dead: WebSocket[] = [];
    for (const ws of this.sessions.keys()) {
      try { ws.send(data); }
      catch { dead.push(ws); }
    }
    for (const ws of dead) this.sessions.delete(ws);
    if (this.sessions.size > 0) this.lastSendTime = Date.now();
  }
}

// ── Asset packing/unpacking (TLV binary format) ────────────────────────────
// Wire format: [nameLen:u16LE][name:UTF8][dataLen:u32LE][data:bytes] repeated

function unpackAssets(packed: ArrayBuffer): Map<string, ArrayBuffer> {
  const view = new DataView(packed);
  const decoder = new TextDecoder();
  const result = new Map<string, ArrayBuffer>();
  let offset = 0;

  while (offset < packed.byteLength) {
    const nameLen = view.getUint16(offset, true); offset += 2;
    const name = decoder.decode(new Uint8Array(packed, offset, nameLen)); offset += nameLen;
    const dataLen = view.getUint32(offset, true); offset += 4;
    const data = packed.slice(offset, offset + dataLen); offset += dataLen;
    result.set(name, data);
  }

  return result;
}
