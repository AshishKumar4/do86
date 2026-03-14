export { LinuxVM } from "./linux-vm";

export interface Env {
  LINUX_VM: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

interface ImageDef {
  file: string;
  drive: "fda" | "cdrom";
  memory: number;
  vgaMemory: number;
  label: string;
  description: string;
  /** Remote URL for the disk image. If set, the DO fetches + caches it in SQLite
   *  instead of the Worker sending the full binary via /init. */
  url?: string;
  /** If true, never save/restore snapshots for this image (unstable OS) */
  noSnapshot?: boolean;
}

const IMAGES: Record<string, ImageDef> = {
  kolibri: { file: "kolibri.img", drive: "fda",   memory: 128, vgaMemory: 8, label: "KolibriOS",       description: "Full GUI, boots fast. Tiny x86 OS written in FASM." },
  dsl:     { file: "dsl.iso",     drive: "cdrom", memory: 128, vgaMemory: 8, label: "Damn Small Linux", description: "Fluxbox window manager + Firefox. ~50MB Linux distro.",
             url: "https://distro.ibiblio.org/damnsmall/release_candidate/dsl-4.11.rc2.iso" },
  helenos: { file: "helenos.iso", drive: "cdrom", memory: 128, vgaMemory: 8, label: "HelenOS",          description: "Research microkernel OS with a custom GUI.",
             url: "http://www.helenos.org/releases/HelenOS-0.5.0-ia32.iso" },
  linux4:  { file: "linux4.iso",  drive: "cdrom", memory: 128, vgaMemory: 8, label: "Linux (text)",     description: "Minimal Linux kernel. Text mode only.",
             url: "https://copy.sh/v86/images/linux4.iso" },
  aqeous:  { file: "aqeous.iso",  drive: "cdrom", memory: 32, vgaMemory: 8, label: "AqeousOS",        description: "Custom x86 OS built from scratch. Full GUI with window system.", noSnapshot: true },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

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
const QEMU_RE = /^\/qemu(?:\/([a-zA-Z0-9_.-]*))?$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET / → landing page (served from static index.html)
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
    }

    // /qemu → QEMU-WASM browser emulation page
    if (url.pathname === "/qemu" || url.pathname === "/qemu/") {
      const resp = await env.ASSETS.fetch(
        new Request(new URL("/qemu.html", request.url).toString()),
      );
      return withCoopCoep(resp);
    }

    // /s/:sessionId → session VM
    const sessionMatch = url.pathname.match(SESSION_RE);
    if (sessionMatch) {
      // WebSocket upgrade → route to the session's DO
      if (request.headers.get("Upgrade") === "websocket") {
        const imageKey = url.searchParams.get("image") || "kolibri";
        const imageDef = IMAGES[imageKey] || IMAGES.kolibri;

        // Use image key as DO name — all sessions for the same image share one VM.
        // This enables: (a) multi-client viewing, (b) shared state snapshots.
        const id = env.LINUX_VM.idFromName(`vm-${imageKey}`);
        const stub = env.LINUX_VM.get(id);

        // Check if the VM is already running — skip the 25-50MB asset reload
        const statusResp = await stub.fetch(
          new Request(new URL("/status", request.url).toString()),
        );
        const { running } = await statusResp.json<{ running: boolean }>();
        const freshBoot = url.searchParams.get("fresh") === "1";

        if (freshBoot && running) {
          // Force reboot: tell DO to stop, then re-init
          await stub.fetch(new Request(new URL("/reboot", request.url).toString(), { method: "POST" }));
        }

        if (!running || freshBoot) {
          // Always fetch BIOS ROMs from static assets (small: 131KB + 36KB)
          const [bios, vgaBios] = await Promise.all([
            getAsset(env, "/assets/seabios.bin", request.url),
            getAsset(env, "/assets/vgabios.bin", request.url),
          ]);

          const meta: Record<string, any> = {
            imageKey,
            drive: imageDef.drive,
            memory: imageDef.memory,
            vgaMemory: imageDef.vgaMemory,
            label: imageDef.label,
            noSnapshot: imageDef.noSnapshot || false,
          };

          const assets: Record<string, ArrayBuffer> = { bios, vgaBios };

          if (imageDef.url) {
            // Try local asset first (dev mode); fall back to URL fetch in DO
            try {
              const localResp = await env.ASSETS.fetch(new URL(`/assets/${imageDef.file}`, request.url).toString());
              if (localResp.ok) {
                assets.disk = await localResp.arrayBuffer();
              }
            } catch { /* not available locally */ }

            if (!assets.disk) {
              // No local asset — let the DO fetch + cache from URL
              meta.diskUrl = imageDef.url;
              meta.diskFile = imageDef.file;
            }
          } else {
            // Small/local image (e.g. KolibriOS floppy): send inline
            assets.disk = await getAsset(env, `/assets/${imageDef.file}`, request.url);
          }

          // Pass fresh=1 query param to force cold boot (clears saved snapshot)
          if (url.searchParams.get("fresh") === "1") {
            meta.fresh = true;
          }

          assets.metadata = new TextEncoder().encode(JSON.stringify(meta)).buffer as ArrayBuffer;
          const packed = packAssets(assets);

          const initResp = await stub.fetch(
            new Request(new URL("/init", request.url).toString(), {
              method: "POST",
              body: packed,
            }),
          );
          if (!initResp.ok) return new Response("Failed to init VM", { status: 500 });
        }

        return stub.fetch(request);
      }

      // Regular GET → serve the VM client (session.html)
      return env.ASSETS.fetch(new Request(new URL("/session.html", request.url).toString()));
    }

    // /api/*
    if (url.pathname === "/api/images") {
      return Response.json(
        Object.entries(IMAGES).map(([key, def]) => ({
          key,
          label: def.label,
          description: def.description,
          drive: def.drive,
          memory: def.memory,
        })),
      );
    }
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    // Everything else → static assets
    // Add COOP/COEP headers for QEMU-related assets (needed for SharedArrayBuffer)
    const assetResp = await env.ASSETS.fetch(request);
    if (
      url.pathname.startsWith("/qemu/") ||
      url.pathname.startsWith("/assets/")
    ) {
      return withCoopCoep(assetResp);
    }
    return assetResp;
  },
};
