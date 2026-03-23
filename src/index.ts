export { LinuxVM } from "./linux-vm";

export interface Env {
  LINUX_VM: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

interface ImageDef {
  file: string;
  drive: "fda" | "cdrom" | "multiboot";
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
  ahciDiskSize?: number;
  /** Logical memory the guest BIOS reports (MB).  Defaults to VM_CONFIG.LOGICAL_MB (256).
   *  GPAs beyond memory_size are demand-paged via swap_page_in.  Set higher for
   *  OSes that need to see more RAM than the WASM allocation provides. */
  logicalMemory?: number;
  /** SMP CPU count. Default: 1 (BSP only). Set 2 for OSes that use SMP. */
  cpuCount?: number;
}

// ── DO memory budget ─────────────────────────────────────────────────────────
// Cloudflare Durable Objects have a 128 MB total isolate memory limit.
// Demand-paging layout (all tunable in linux-vm.ts VM_CONFIG):
//   WASM mem8 total    : 32 MB  (memory_size passed to v86; covers hot pool)
//     ↳ Resident RAM   : 16 MB  (mem8[0..16MB], PAGED_THRESHOLD in Rust)
//     ↳ Hot pool       : 16 MB  (mem8[16MB..32MB], 4096 × 4 KB frames)
//   VGA SVGA buffer    :  8 MB  (svga_allocate_memory, separate allocation)
//   WASM heap overhead : ~20 MB (JIT code cache, TLB tables, CPU structs)
//   JS heap            : ~10 MB (emulator objects, WS sessions, delta encoder)
//   ──────────────────────────────────
//   Total              ~ 70 MB ← safe headroom below 128 MB limit
//
// Guest sees logicalMemory MB via CMOS/e820 (per-image, e.g. 64 for KolibriOS,
// 3584 for AqeousOS).  GPAs in [16 MB, logicalMemory MB) are demand-paged from
// DO SQLite via swap_page_in.
//
// memory/vgaMemory values in IMAGES are the WASM allocation passed to v86.
// Standardized to 32 MB for all images.  To change, edit VM_CONFIG in linux-vm.ts.

/** Shared default memory/VGA allocation (MB).
 *  memory = WASM_MB = 32 MB for all images (RESIDENT 16 MB + HOT_POOL 16 MB).
 *  Must match VM_CONFIG.WASM_MB in linux-vm.ts. */
const DEFAULT_MEMORY_MB  = 32; // == VM_CONFIG.WASM_MB
const DEFAULT_VGA_MB     =  8; // == VM_CONFIG.VGA_MB

const IMAGES: Record<string, ImageDef> = {
  kolibri:    { file: "kolibri.img",             drive: "fda",       memory: DEFAULT_MEMORY_MB, vgaMemory: DEFAULT_VGA_MB, logicalMemory: 64,   label: "KolibriOS",      description: "Full GUI, boots fast. Tiny x86 OS written in FASM.",
                url: "https://copy.sh/v86/images/kolibri.img" },
  aqeous:     { file: "aqeous.bin",              drive: "multiboot", memory: DEFAULT_MEMORY_MB, vgaMemory: DEFAULT_VGA_MB, logicalMemory: 3584, label: "AqeousOS",       description: "Custom x86 OS built from scratch. Full GUI with window system.", noSnapshot: true, ahciDiskSize: 32, cpuCount: 2 },
  tinycore:   { file: "TinyCore-15.0.iso",       drive: "cdrom",     memory: DEFAULT_MEMORY_MB, vgaMemory: DEFAULT_VGA_MB, logicalMemory: 128,  label: "TinyCore 15",    description: "Minimal Linux with X11 desktop and FLWM window manager. Full POSIX environment with package manager." },
  tinycore11: { file: "TinyCore-11.1.iso",       drive: "cdrom",     memory: DEFAULT_MEMORY_MB, vgaMemory: DEFAULT_VGA_MB, logicalMemory: 128,  label: "TinyCore 11",    description: "Classic TinyCore release with broad hardware compatibility and lightweight X11 desktop." },
  dsl:        { file: "dsl-4.11.rc2.iso",        drive: "cdrom",     memory: DEFAULT_MEMORY_MB, vgaMemory: 4,              logicalMemory: 256,  label: "DSL Linux",      description: "Damn Small Linux — complete desktop with Fluxbox window manager, browser, and tools.",
                url: "https://distro.ibiblio.org/damnsmall/release_candidate/dsl-4.11.rc2.iso" },
  helenos:    { file: "HelenOS-0.14.1-ia32.iso", drive: "cdrom",     memory: DEFAULT_MEMORY_MB, vgaMemory: 4,              logicalMemory: 128,  label: "HelenOS",        description: "Research microkernel OS with a custom graphical interface.",
                url: "https://www.helenos.org/releases/HelenOS-0.14.1-ia32.iso" },
  linux4:     { file: "linux4.iso",              drive: "cdrom",     memory: DEFAULT_MEMORY_MB, vgaMemory: 2,              logicalMemory: 64,   label: "Linux 4 (Text)", description: "Minimal Linux kernel. Text-only — great for exploring the shell.",
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

// ── Router ────────────────────────────────────────────────────────────────────

const SESSION_RE = /^\/s\/([a-zA-Z0-9_-]+)$/;
const STATS_RE   = /^\/stats\/([a-zA-Z0-9_-]+)$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // GET / → landing page
    if (url.pathname === "/") {
      return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString()));
    }

    // /s/:sessionId
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
            ...(imageDef.ahciDiskSize ? { ahciDiskSize: imageDef.ahciDiskSize } : {}),
            ...(imageDef.logicalMemory ? { logicalMemory: imageDef.logicalMemory } : {}),
            ...(imageDef.cpuCount ? { cpuCount: imageDef.cpuCount } : {}),
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
          memory: def.logicalMemory || 64,
        })),
      );
    }

    // /stats/:sessionId — proxy to DO's /stats handler, returns JSON counters
    const statsMatch = url.pathname.match(STATS_RE);
    if (statsMatch && request.method === "GET") {
      const sessionId = statsMatch[1];
      const id = env.LINUX_VM.idFromName(`vm-${sessionId}`);
      const stub = env.LINUX_VM.get(id);
      const resp = await stub.fetch(new Request(new URL("/stats", request.url).toString()));
      return new Response(resp.body, {
        status: resp.status,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok" });
    }

    // Everything else → static assets
    return env.ASSETS.fetch(request);
  },
};
