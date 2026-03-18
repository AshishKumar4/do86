export { LinuxVM } from "./linux-vm";
export { CoordinatorDO } from "./coordinator-do";
export { CpuCoreDO } from "./core-do";
export { QemuCpuCoreDO } from "./qemu-core-do";
export { QemuStandaloneDO } from "./qemu-standalone-do";

export interface Env {
  LINUX_VM: DurableObjectNamespace;
  COORDINATOR: DurableObjectNamespace;
  CPU_CORE: DurableObjectNamespace;
  QEMU_STANDALONE: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
  ASSETS_BUCKET: R2Bucket;
}

interface ImageDef {
  file: string;
  drive: "fda" | "cdrom";
  memory: number;
  vgaMemory: number;
  label: string;
  description: string;
  /** Remote URL for the disk image. If set, the DO fetches + caches it in SQLite
   *  instead of the Worker sending the full binary via /init.
   *  If absent, the image is static-only (aqeous.iso served from ASSETS). */
  url?: string;
  /** If true, never save/restore snapshots for this image (unstable OS) */
  noSnapshot?: boolean;
}

// Memory budget: Durable Objects have a 128 MB total isolate limit.
// Each VM's guest RAM + VGA framebuffer + v86 WASM heap + JS runtime overhead
// must all fit within that budget. Keep guest memory ≤ 64 MB to leave headroom
// for WASM (~30 MB) and the JS heap (~20 MB). Exceeding this causes OOM eviction.
const IMAGES: Record<string, ImageDef> = {
  kolibri:    { file: "kolibri.img",             drive: "fda",   memory: 96, vgaMemory: 8, label: "KolibriOS",      description: "Full GUI, boots fast. Tiny x86 OS written in FASM.",
                url: "https://copy.sh/v86/images/kolibri.img" },
  aqeous:     { file: "aqeous.iso",              drive: "cdrom", memory: 96, vgaMemory: 8, label: "AqeousOS",       description: "Custom x86 OS built from scratch. Full GUI with window system.", noSnapshot: true },
  tinycore:   { file: "TinyCore-15.0.iso",       drive: "cdrom", memory: 96, vgaMemory: 8, label: "TinyCore 15",    description: "Minimal Linux with X11 desktop and FLWM window manager. Full POSIX environment with package manager.",
                url: "http://tinycorelinux.net/15.x/x86/release/TinyCore-15.0.iso" },
  tinycore11: { file: "TinyCore-11.1.iso",       drive: "cdrom", memory: 96, vgaMemory: 8, label: "TinyCore 11",    description: "Classic TinyCore release with broad hardware compatibility and lightweight X11 desktop.",
                url: "http://tinycorelinux.net/11.x/x86/release/TinyCore-11.1.iso" },
  dsl:        { file: "dsl-4.11.rc2.iso",        drive: "cdrom", memory: 96, vgaMemory: 8, label: "DSL Linux",      description: "Damn Small Linux — complete desktop with Fluxbox window manager, browser, and tools.",
                url: "https://distro.ibiblio.org/damnsmall/release_candidate/dsl-4.11.rc2.iso" },
  helenos:    { file: "HelenOS-0.14.1-ia32.iso", drive: "cdrom", memory: 96, vgaMemory: 8, label: "HelenOS",        description: "Research microkernel OS with a custom graphical interface.",
                url: "https://www.helenos.org/releases/HelenOS-0.14.1-ia32.iso" },
  linux4:     { file: "linux4.iso",              drive: "cdrom", memory: 32,  vgaMemory: 2, label: "Linux 4 (Text)", description: "Minimal Linux kernel. Text-only — great for exploring the shell.",
                url: "https://copy.sh/v86/images/linux4.iso" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Fetch a static asset via the ASSETS binding.
 *  MUST only be called from plain HTTP handlers — ASSETS.fetch() returns 403
 *  when invoked inside a WebSocket upgrade handler. */
async function getAsset(env: Env, path: string, baseUrl: string): Promise<ArrayBuffer> {
  const resp = await env.ASSETS.fetch(new URL(path, baseUrl).toString());
  if (!resp.ok) throw new Error(`Asset ${path}: ${resp.status}`);
  return resp.arrayBuffer();
}

function packAssets(assets: Record<string, ArrayBuffer>): ArrayBuffer {
  const entries = Object.entries(assets);
  const encoder = new TextEncoder();

  let totalSize = 0;
  const nameBuffers = entries.map(([name]) => {
    const buf = encoder.encode(name);
    totalSize += 2 + buf.length + 4;
    return buf;
  });
  for (const [, buf] of entries) totalSize += buf.byteLength;

  const packed = new ArrayBuffer(totalSize);
  const view = new DataView(packed);
  const bytes = new Uint8Array(packed);
  let offset = 0;

  entries.forEach(([, buf], i) => {
    const nameBytes = nameBuffers[i];
    view.setUint16(offset, nameBytes.length, true);
    offset += 2;
    bytes.set(nameBytes, offset);
    offset += nameBytes.length;
    view.setUint32(offset, buf.byteLength, true);
    offset += 4;
    bytes.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  });

  return packed;
}

// ── Helpers: COOP/COEP for SharedArrayBuffer (required by QEMU pthreads) ────

function withCoopCoep(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cross-Origin-Opener-Policy", "same-origin");
  headers.set("Cross-Origin-Embedder-Policy", "require-corp");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ── Router ────────────────────────────────────────────────────────────────────

const SESSION_RE = /^\/s\/([a-zA-Z0-9_-]+)$/;
const SMP_SESSION_RE = /^\/smp\/([a-zA-Z0-9_-]+)$/;
const QEMU_RE = /^\/qemu(?:\/([a-zA-Z0-9_-]*))?$/;
const QEMU_DO_RE = /^\/qd\/([a-zA-Z0-9_-]+)$/;
const QEMU_DO_INIT_RE = /^\/qd-init\/([a-zA-Z0-9_-]+)$/;
const QEMU_DO_KICK_RE = /^\/qd-kick\/([a-zA-Z0-9_-]+)$/;
const QEMU_DO_STATUS_RE = /^\/qd-status\/([a-zA-Z0-9_-]+)$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET / → landing page
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
    }

    // ── /qemu or /qemu/:sessionId → QEMU-WASM page (browser-side emulation) ─
    // Serves qemu.html with COOP+COEP headers for SharedArrayBuffer.
    // QEMU WASM + BIOS + disk images are served from /qemu/* and /assets/* below.
    const qemuMatch = url.pathname.match(QEMU_RE);
    if (qemuMatch) {
      const resp = await env.ASSETS.fetch(
        new Request(new URL("/qemu.html", request.url).toString()),
      );
      return withCoopCoep(resp);
    }

    // ── /qd-init/:id → init QEMU standalone DO with firmware + disk ──────
    const qdInitMatch = url.pathname.match(QEMU_DO_INIT_RE);
    if (qdInitMatch) {
      const sessionId = qdInitMatch[1];
      const imageKey = url.searchParams.get("image") || "aqeous";
      const imageDef = IMAGES[imageKey] || IMAGES.aqeous;

      const id = env.QEMU_STANDALONE.idFromName(`qemu-${sessionId}-${imageKey}`);
      const stub = env.QEMU_STANDALONE.get(id);

      const meta: Record<string, unknown> = {
        imageKey,
        drive: imageDef.drive,
        memory: Math.min(imageDef.memory || 32, 64),
        label: imageDef.label,
      };

      const assets: Record<string, ArrayBuffer> = {};
      assets.metadata = new TextEncoder().encode(JSON.stringify(meta)).buffer as ArrayBuffer;

      // Fetch BIOS firmware (required by QEMU — small data files, ~300KB total)
      const firmware = [
        { path: "/assets/bios-256k.bin", key: "qemu_bios_256k_bin" },
        { path: "/assets/vgabios-stdvga.bin", key: "qemu_vgabios_stdvga_bin" },
      ];
      const missingFirmware: string[] = [];
      await Promise.all(firmware.map(async ({ path, key }) => {
        const resp = await env.ASSETS.fetch(new URL(path, request.url).toString());
        if (resp.ok) {
          assets[key] = await resp.arrayBuffer();
        } else {
          missingFirmware.push(path);
        }
      }));
      if (missingFirmware.length > 0) {
        return new Response(`Missing QEMU firmware: ${missingFirmware.join(", ")}`, { status: 500 });
      }

      // Fetch disk image
      try {
        const localResp = await env.ASSETS.fetch(
          new URL(`/assets/${imageDef.file}`, request.url).toString(),
        );
        if (localResp.ok) assets.disk = await localResp.arrayBuffer();
      } catch { /* not available locally */ }

      if (!assets.disk && imageDef.url) {
        const remoteResp = await fetch(imageDef.url);
        if (remoteResp.ok) assets.disk = await remoteResp.arrayBuffer();
      }

      if (!assets.disk) {
        return new Response(`Disk image not found for ${imageKey}`, { status: 500 });
      }

      // Pack and send to DO
      const packed = packAssets(assets);
      const initResp = await stub.fetch(
        new Request(new URL("/init", request.url).toString(), { method: "POST", body: packed }),
      );
      if (!initResp.ok) return new Response("Failed to init QEMU VM", { status: 500 });

      return Response.json({ status: "ok", sessionId, imageKey });
    }

    // ── /qd-kick/:id → trigger QEMU boot ─────────────────────────────────
    const qdKickMatch = url.pathname.match(QEMU_DO_KICK_RE);
    if (qdKickMatch) {
      const sessionId = qdKickMatch[1];
      const imageKey = url.searchParams.get("image") || "aqeous";
      const id = env.QEMU_STANDALONE.idFromName(`qemu-${sessionId}-${imageKey}`);
      const resp = await env.QEMU_STANDALONE.get(id).fetch(
        new Request(new URL("/kick", request.url).toString(), { method: "POST" }),
      );
      return new Response(await resp.text(), { status: resp.status });
    }

    // ── /qd-status/:id → QEMU DO status ──────────────────────────────────
    const qdStatusMatch = url.pathname.match(QEMU_DO_STATUS_RE);
    if (qdStatusMatch) {
      const sessionId = qdStatusMatch[1];
      const imageKey = url.searchParams.get("image") || "aqeous";
      const id = env.QEMU_STANDALONE.idFromName(`qemu-${sessionId}-${imageKey}`);
      return env.QEMU_STANDALONE.get(id).fetch(
        new Request(new URL("/status", request.url).toString()),
      );
    }

    // ── /qd-test-import/:id → test WASM loading on QEMU DO ──────────────
    const qdTestMatch = url.pathname.match(/^\/qd-test-import\/([a-zA-Z0-9_-]+)$/);
    if (qdTestMatch) {
      const sessionId = qdTestMatch[1];
      const imageKey = url.searchParams.get("image") || "aqeous";
      const id = env.QEMU_STANDALONE.idFromName(`qemu-${sessionId}-${imageKey}`);
      // Forward with query params preserved
      const doUrl = new URL("/test-import", request.url);
      doUrl.search = url.search;
      return env.QEMU_STANDALONE.get(id).fetch(new Request(doUrl.toString()));
    }

    // ── /qd/:id → WebSocket to QEMU standalone DO ────────────────────────
    const qdMatch = url.pathname.match(QEMU_DO_RE);
    if (qdMatch) {
      if (request.headers.get("Upgrade") === "websocket") {
        const sessionId = qdMatch[1];
        const imageKey = url.searchParams.get("image") || "aqeous";
        const id = env.QEMU_STANDALONE.idFromName(`qemu-${sessionId}-${imageKey}`);
        return env.QEMU_STANDALONE.get(id).fetch(request);
      }
      return env.ASSETS.fetch(new Request(new URL("/session.html", request.url).toString()));
    }

    // /smp/:sessionId → distributed SMP session via CoordinatorDO
    const smpMatch = url.pathname.match(SMP_SESSION_RE);
    if (smpMatch) {
      if (request.headers.get("Upgrade") === "websocket") {
        const imageKey = url.searchParams.get("image") || "aqeous";
        const imageDef = IMAGES[imageKey] || IMAGES.aqeous;

        const id = env.COORDINATOR.idFromName(`smp-${imageKey}`);
        const stub = env.COORDINATOR.get(id);

        // Check if already running
        const statusResp = await stub.fetch(
          new Request(new URL("/status", request.url).toString()),
        );
        const { running } = await statusResp.json<{ running: boolean }>();

        if (!running) {
          const meta: Record<string, any> = {
            imageKey,
            drive: imageDef.drive,
            memory: imageDef.memory,
            vgaMemory: imageDef.vgaMemory,
            label: imageDef.label,
            noSnapshot: true, // No snapshots for SMP (yet)
            numCores: 2, // distributed SMP (BSP + 1 AP)
          };

          // v86 cores need BIOS ROMs — fetch alongside disk
          const [bios, vgaBios] = await Promise.all([
            getAsset(env, "/assets/seabios.bin", request.url),
            getAsset(env, "/assets/vgabios.bin", request.url),
          ]);

          const assets: Record<string, ArrayBuffer> = { bios, vgaBios };

          // Get disk image — try local ASSETS first, fall back to remote URL
          try {
            const localResp = await env.ASSETS.fetch(
              new URL(`/assets/${imageDef.file}`, request.url).toString(),
            );
            if (localResp.ok) {
              assets.disk = await localResp.arrayBuffer();
            }
          } catch { /* not available locally */ }

          if (!assets.disk && imageDef.url) {
            meta.diskUrl = imageDef.url;
            meta.diskFile = imageDef.file;
          }

          if (!assets.disk && !meta.diskUrl) {
            return new Response("Disk image not found for SMP boot", { status: 500 });
          }

          assets.metadata = new TextEncoder().encode(JSON.stringify(meta)).buffer as ArrayBuffer;
          const packed = packAssets(assets);

          const initResp = await stub.fetch(
            new Request(new URL("/init", request.url).toString(), {
              method: "POST",
              body: packed,
            }),
          );
          if (!initResp.ok) return new Response("Failed to init SMP VM", { status: 500 });
        }

        // Forward WebSocket upgrade to coordinator
        return stub.fetch(request);
      }

      // Regular GET → serve the same session page (client is image-agnostic)
      return env.ASSETS.fetch(new Request(new URL("/session.html", request.url).toString()));
    }

    // /s/:sessionId → session VM (original single-DO path)
    const sessionMatch = url.pathname.match(SESSION_RE);
    if (sessionMatch) {
      const imageKey = url.searchParams.get("image") || "kolibri";
      const imageDef = IMAGES[imageKey] || IMAGES.kolibri;
      const freshBoot = url.searchParams.get("fresh") === "1";

      const sessionId = sessionMatch[1];
      
      const id = env.LINUX_VM.idFromName(`vm-${sessionId}`);
      const stub = env.LINUX_VM.get(id);

      // ── WebSocket upgrade → pure passthrough ───────────────────────────
      // Init has already been done by the preceding HTTP GET for this page.
      // env.ASSETS.fetch() CANNOT be called inside a WebSocket upgrade handler
      // (returns 403), so all asset fetching must happen before this branch.
      if (request.headers.get("Upgrade") === "websocket") {
        return stub.fetch(request);
      }

      // ── HTTP GET → init DO (if needed), then serve session.html ────────
      // This is a normal HTTP request so env.ASSETS.fetch() works correctly.
      try {
        let running = false;
        try {
          const statusResp = await stub.fetch(new Request(new URL("/status", request.url).toString()));
          running = (JSON.parse(await statusResp.text()) as { running: boolean }).running ?? false;
        } catch (e) {
          console.error("[do86] Failed to check DO status:", e);
        }

        if (freshBoot && running) {
          await stub.fetch(new Request(new URL("/reboot", request.url).toString(), { method: "POST" }));
          running = false;
        }

        if (!running) {
          // Fetch BIOS ROMs (128 KB + 36 KB) — safe here, plain HTTP handler.
          const [bios, vgaBios] = await Promise.all([
            getAsset(env, "/assets/seabios.bin", request.url),
            getAsset(env, "/assets/vgabios.bin", request.url),
          ]);

          const meta: Record<string, unknown> = {
            imageKey,
            drive: imageDef.drive,
            memory: imageDef.memory,
            vgaMemory: imageDef.vgaMemory,
            label: imageDef.label,
            noSnapshot: imageDef.noSnapshot || false,
            ...(freshBoot ? { fresh: true } : {}),
          };

          const assets: Record<string, ArrayBuffer> = { bios, vgaBios };

          if (imageDef.url) {
            // URL-backed image: tell the DO to fetch + cache it in SQLite.
            meta.diskUrl = imageDef.url;
            meta.diskFile = imageDef.file;
          } else {
            // No public URL (aqeous): send the disk binary inline.
            assets.disk = await getAsset(env, `/assets/${imageDef.file}`, request.url);
          }

          assets.metadata = new TextEncoder().encode(JSON.stringify(meta)).buffer as ArrayBuffer;

          const initResp = await stub.fetch(
            new Request(new URL("/init", request.url).toString(), {
              method: "POST",
              body: packAssets(assets),
            }),
          );
          if (!initResp.ok) {
            const msg = await initResp.text().catch(() => String(initResp.status));
            return new Response(`Failed to init VM: ${msg}`, { status: 500 });
          }
        }
      } catch (e) {
        console.error("[do86] Session init error:", e);
        return new Response(`Init error: ${e}`, { status: 500 });
      }

      // Serve session.html — the client JS will open the WebSocket
      return env.ASSETS.fetch(new Request(new URL("/session.html", request.url).toString()));
    }

    // /api/images
    if (url.pathname === "/api/images") {
      return Response.json(
        Object.entries(IMAGES).map(([key, def]) => ({
          key,
          label: def.label,
          description: def.description,
          drive: def.drive,
          memory: def.memory,
          backends: ["v86", "v86-smp"],
        })),
      );
    }

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    // Everything else → static assets
    // Add COOP/COEP headers for all assets when serving QEMU-related files
    // (needed for SharedArrayBuffer in the browser)
    const assetResp = await env.ASSETS.fetch(request);
    if (url.pathname.startsWith("/qemu/") ||
        url.pathname === "/coi-serviceworker.js" ||
        url.pathname.startsWith("/assets/")) {
      return withCoopCoep(assetResp);
    }
    return assetResp;
  },
};
