import { DurableObject } from "cloudflare:workers";
import type { V86 as V86Type } from "./libv86.mjs";
import v86WasmModule from "./v86.wasm";

// Side-effect import: registers the ImageData polyfill on globalThis
import "./screen-adapter";

import {
  type ClientMessage, type ClientState, type VgaDevice,
  FPS_DEFAULT, FPS_MAX, FPS_MIN, LARGE_FRAME_BYTES, MAX_RESOLUTION,
  LOG_PREFIX, BOOT_ORDER_CDROM_FIRST, BOOT_ORDER_HDA_FIRST,
  EMULATOR_LOAD_TIMEOUT_MS, SNAPSHOT_DELAY_FAST_MS, SNAPSHOT_DELAY_SLOW_MS,
} from "./types";
import { DOScreenAdapter } from "./screen-adapter";
import { DeltaEncoder, encodeSerialData, encodeStats, encodeStatus, encodeTextScreen } from "./delta-encoder";
import { SqliteStorage, SqliteImageCache, SQLiteBlockDevice, unpackAssets } from "./sqlite-storage";
import { SqlPageStore, type PageStoreConfig } from "./sql-page-store";
import type { Env } from "./index";

// ── VM configuration ──────────────────────────────────────────────────────────
//
// All tunable memory / paging parameters live here.  Change these values to
// reshape the DO memory budget without touching boot logic.
//
// WASM linear memory layout:
//   mem8[0 .. RESIDENT_MB)                        — always-resident guest RAM
//   mem8[RESIDENT_MB .. RESIDENT_MB + HOT_POOL_MB) — hot page frame pool
//   WASM_MB = RESIDENT_MB + HOT_POOL_MB            — total mem8 allocation
//
// *** CRITICAL: memory_size passed to v86 MUST equal WASM_MB (not RESIDENT_MB).
// in_mapped_range(addr) returns true when addr >= memory_size.  If memory_size
// were set to RESIDENT_MB (32 MB), every frame offset the hot pool returns would
// be ≥ memory_size, triggering the MMIO path instead of direct mem8 access.
// Setting memory_size = WASM_MB (64 MB) keeps all hot pool offsets below the
// threshold, so in_mapped_range() correctly returns false for them.
//
// DO isolate memory budget (128 MB hard limit):
//   WASM mem8 (resident + pool): WASM_MB   = 64 MB  (allocated by allocate_memory)
//   VGA SVGA buffer             : VGA_MB   =  8 MB  (svga_allocate_memory, separate)
//   WASM heap overhead          :          ~ 20 MB  (JIT code cache, TLB tables)
//   JS heap                     :          ~ 10 MB  (emulator objects, WS sessions)
//   ──────────────────────────────────────────────
//   Total                                  ~102 MB  ← safe below 128 MB limit
//
// Guest sees LOGICAL_MB via CMOS/e820 (demand-paged by SqlPageStore).
// RESIDENT_MB must equal PAGED_THRESHOLD in stratum/src/rust/cpu/memory.rs.
const VM_CONFIG = {
  /** GPA threshold: below this, pages are always resident in mem8[0..RESIDENT_MB).
   *  MUST match PAGED_THRESHOLD in stratum/src/rust/cpu/memory.rs. */
  RESIDENT_MB:   32,
  /** Hot page frame pool: number of 4 KB frames.
   *  Pool occupies mem8[RESIDENT_MB .. RESIDENT_MB + HOT_FRAMES×4KB).
   *  HOT_POOL_MB = HOT_FRAMES × 4 / 1024 = 32 MB. */
  HOT_FRAMES:    8192,
  /** Total WASM linear memory allocation (MB): RESIDENT_MB + HOT_POOL_MB.
   *  This is the value passed as memory_size to v86.  Must cover the full
   *  hot pool so in_mapped_range() never fires for pool frame offsets. */
  WASM_MB:       64,   // = RESIDENT_MB(32) + HOT_FRAMES×4KB/1MB(32)
  /** VGA SVGA framebuffer size (MB), allocated separately by svga_allocate_memory. */
  VGA_MB:         8,
  /** Logical RAM reported to guest BIOS/CMOS (MB).
   *  GPAs in [RESIDENT_MB, LOGICAL_MB) are demand-paged from DO SQLite. */
  // LOGICAL_MB must equal WASM_MB (not larger) because SeaBIOS places ACPI tables
  // near the top of logical RAM (logical_memory_size - ~7KB).  If logical RAM
  // exceeds the WASM physical allocation (memory_size), those writes hit the MMIO
  // no-op handler (addr >= memory_size triggers in_mapped_range), the ACPI tables
  // are silently dropped, and KolibriOS loops forever scanning for a valid RSDT.
  // Demand-paging still helps: the OS can use the 32–64 MB region (hot pool)
  // without growing WASM — it just can't exceed 64 MB total.
  LOGICAL_MB:    64,   // must equal WASM_MB
  /** SMP CPU count: 1 = BSP only, 2 = BSP + 1 AP.
   *  Each AP adds cooperative ticks; increase only after measuring headroom. */
  CPU_COUNT:      2,
  /** PageStore tuning forwarded to SqlPageStore constructor. */
  PAGE_STORE: {
    maxFrames:    8192,  // must equal HOT_FRAMES above
    maxEvictScan: 256,
  } satisfies Partial<PageStoreConfig>,
} as const;

// ── Image registry (mirrored from index.ts for DO self-recovery) ─────────────
// When the DO is evicted and a client reconnects, cachedAssets is gone.
// The DO uses this table to re-fetch BIOS + disk from the ASSETS binding /
// public CDN — same as the worker does during normal session init.

interface ImageDef {
  file: string;
  drive: "fda" | "cdrom" | "multiboot";
  memory: number;
  vgaMemory: number;
  label: string;
  url?: string;
  noSnapshot?: boolean;
  ahciDiskSize?: number;
  logicalMemory?: number;
}

// memory/vgaMemory in IMAGES are the values passed as memory_size/vga_memory_size to v86.
// For demand-paged images: memory = WASM_MB (full WASM allocation including hot pool).
// linux4 is text-only, no demand-paging, smaller budget.
const { WASM_MB, VGA_MB } = VM_CONFIG;
const IMAGES: Record<string, ImageDef> = {
  kolibri:    { file: "kolibri.img",             drive: "fda",   memory: WASM_MB, vgaMemory: VGA_MB, label: "KolibriOS",
                url: "https://copy.sh/v86/images/kolibri.img" },
  aqeous:     { file: "aqeous.bin",              drive: "multiboot", memory: WASM_MB, vgaMemory: VGA_MB, label: "AqeousOS", noSnapshot: true, ahciDiskSize: 32, logicalMemory: 3584 },
  tinycore:   { file: "TinyCore-15.0.iso",       drive: "cdrom", memory: WASM_MB, vgaMemory: VGA_MB, label: "TinyCore 15",
                url: "http://tinycorelinux.net/15.x/x86/release/TinyCore-15.0.iso" },
  tinycore11: { file: "TinyCore-11.1.iso",       drive: "cdrom", memory: WASM_MB, vgaMemory: VGA_MB, label: "TinyCore 11",
                url: "http://tinycorelinux.net/11.x/x86/release/TinyCore-11.1.iso" },
  dsl:        { file: "dsl-4.11.rc2.iso",        drive: "cdrom", memory: WASM_MB, vgaMemory: VGA_MB, label: "DSL Linux",
                url: "https://distro.ibiblio.org/damnsmall/release_candidate/dsl-4.11.rc2.iso" },
  helenos:    { file: "HelenOS-0.14.1-ia32.iso", drive: "cdrom", memory: WASM_MB, vgaMemory: VGA_MB, label: "HelenOS",
                url: "https://www.helenos.org/releases/HelenOS-0.14.1-ia32.iso" },
  linux4:     { file: "linux4.iso",              drive: "cdrom", memory: 32,      vgaMemory: 2,      label: "Linux 4 (Text)",
                url: "https://copy.sh/v86/images/linux4.iso" },
};

// ── LinuxVM Durable Object ──────────────────────────────────────────────────

export class LinuxVM extends DurableObject<Env> {
  // ── Session state ───────────────────────────────────────────────────────
  private sessions = new Map<WebSocket, ClientState>();
  private mouseButtons: [boolean, boolean, boolean] = [false, false, false];

  // ── Emulator state ──────────────────────────────────────────────────────
  private emulator: V86Type | null = null;
  private screenAdapter: DOScreenAdapter | null = null;
  private booting = false;
  private booted = false;
  private bootError: string | null = null;
  private imageKey: string | null = null;
  private serialBuffer = "";
  private cachedAssets: Map<string, ArrayBuffer> | null = null;

  // ── Rendering state ─────────────────────────────────────────────────────
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private lastTextContent = "";
  private deltaEncoder = new DeltaEncoder();
  private currentFPS = FPS_DEFAULT;
  private lastFrameBytes = 0;
  private consecutiveSmallFrames = 0;
  private consecutiveLargeFrames = 0;
  private framesSkippedBackpressure = 0;

  // ── Adaptive FPS state (2-30fps) ────────────────────────────────────────
  // The render loop runs at 33ms (30fps ceiling).  When no dirty pages are
  // detected for 3+ consecutive ticks, we skip frames to drop to ~2fps.
  // Any dirty detection immediately renders and resets the counter.
  private _cleanTicks = 0;
  private _adaptiveSkips = 0;  // perf counter: frames skipped due to idle
  private _textSent = 0;       // text frames actually broadcast
  private _textEmpty = 0;      // text mode: getTextScreen returned empty
  private _textSame = 0;       // text mode: content unchanged
  private _vgaNull = 0;        // getVga() returned null

  // ── Storage state ───────────────────────────────────────────────────────
  private storage: SqliteStorage | null = null;
  private imageCache: SqliteImageCache | null = null;
  private swapDevice: SQLiteBlockDevice | null = null;

  // ── Origin tracking (for post-eviction ASSETS.fetch recovery) ───────────
  // Captured from the first request URL so selfLoadAssets() can build full URLs.
  private workerOrigin: string | null = null;

  // ── Snapshot state ──────────────────────────────────────────────────────
  private snapshotSaved = false;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private restoredFromSnapshot = false;
  private noSnapshot = false;

  // ── Input gating ──────────────────────────────────────────────────────
  // During a cold boot, user input is blocked until the boot-complete snapshot
  // is captured. This ensures the snapshot reflects pristine boot state, not
  // whatever the user typed while the OS was still loading.
  // Gating is lifted when: (a) snapshot saves successfully, (b) snapshot is
  // skipped (noSnapshot / already exists), or (c) the snapshot attempt fails.
  private inputGated = false;

  // ── Performance counters (reset on each cold boot) ───────────────────
  private _perf = {
    yields:         0,   // total yield callbacks (sync + async)
    syncYields:     0,   // synchronous fast-path yields (BATCH-1 of every BATCH)
    renders:        0,   // renderFrame() calls
    renderMs:       0,   // cumulative ms spent in renderFrame()
    framesSent:     0,   // binary frames delivered to ≥1 client
    bootTimeMs:     0,   // performance.now() at boot complete
    // render pipeline breakdown (reset each boot)
    pixelsNull:     0,   // getVgaPixels() returned null
    pixelsOk:       0,   // getVgaPixels() returned valid data
    deltaNull:      0,   // encode() returned null (no changed tiles)
    notDirty:       0,   // skipped: WASM SVGA dirty bitmap was empty
    svgaDirtyPages: 0,   // cumulative dirty page-fills processed by screen_fill_buffer
  };
  private _pageStore: SqlPageStore | null = null;
  private _statsInterval: ReturnType<typeof setInterval> | null = null;
  private _yieldDead = false;
  private _yieldError = "";

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    // Non-hibernating DO: no session restore needed.
    // The VM lives entirely in memory; hibernation would destroy emulator state.
  }

  // ── HTTP handler ────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status" && request.method === "GET") {
      return Response.json({ running: this.booted || this.booting });
    }

    if (url.pathname === "/stats" && request.method === "GET") {
      return Response.json(this.collectStats());
    }

    if (url.pathname === "/reboot" && request.method === "POST") {
      console.log(`${LOG_PREFIX} Reboot requested — stopping emulator`);
      if (this.renderInterval) { clearInterval(this.renderInterval); this.renderInterval = null; }
      if (this._statsInterval) { clearInterval(this._statsInterval); this._statsInterval = null; }
      if (this.snapshotTimer) { clearTimeout(this.snapshotTimer); this.snapshotTimer = null; }
      if (this.emulator) {
        try { (this.emulator as any).stop?.(); } catch { /* ok */ }
        try { (this.emulator as any).destroy?.(); } catch { /* ok */ }
      }
      this.emulator = null;
      this.booted = false;
      this.booting = false;
      this.bootError = null;
      this.snapshotSaved = false;
      this.restoredFromSnapshot = false;
      this.inputGated = false;
      this.cachedAssets = null;

      // Clear persisted snapshot so the next boot is a cold boot
      if (this.imageKey && this.imageCache) {
        console.log(`${LOG_PREFIX} Clearing persisted snapshot for ${this.imageKey}`);
        this.imageCache.states.delete(this.imageKey);
      }

      this.broadcast(encodeStatus("rebooting"));
      return Response.json({ status: "rebooted" });
    }

    if (url.pathname === "/clear-snapshot" && request.method === "POST") {
      const key = url.searchParams.get("image") || this.imageKey;
      if (key) {
        this.ensureStorage();
        if (this.imageCache!.states.has(key)) {
          this.imageCache!.states.delete(key);
          this.snapshotSaved = false;
          console.log(`${LOG_PREFIX} Snapshot cleared for ${key}`);
          return Response.json({ status: "cleared", imageKey: key });
        }
        return Response.json({ status: "no_snapshot", imageKey: key });
      }
      return Response.json({ status: "no_image_key" }, { status: 400 });
    }

    if (url.pathname === "/init" && request.method === "POST") {
      if (this.booted || this.booting) {
        return Response.json({ status: "already_running", imageKey: this.imageKey });
      }
      try {
        const packed = await request.arrayBuffer();
        this.cachedAssets = unpackAssets(packed);
        const metadataRaw = this.cachedAssets.get("metadata");
        if (metadataRaw) {
          try {
            const meta = JSON.parse(new TextDecoder().decode(metadataRaw));
            this.imageKey = meta.imageKey || null;
          } catch (e) {
            console.error(`${LOG_PREFIX} Failed to parse init metadata:`, e);
          }
        }
        return Response.json({ status: "assets_loaded", count: this.cachedAssets.size, imageKey: this.imageKey });
      } catch (err) {
        return Response.json({ status: "error", message: String(err) }, { status: 500 });
      }
    }

    // WebSocket upgrade — use server.accept() (non-hibernating) so the DO is
    // never evicted from memory while the v86 emulator is running.
    // ctx.acceptWebSocket() (hibernation API) would destroy all in-memory
    // emulator state on eviction.
    //
    // Capture imageKey and origin from the WS URL for post-eviction recovery.
    // imageKey: used by selfLoadAssets() when cachedAssets is gone after eviction.
    // workerOrigin: used to build valid ASSETS.fetch() URLs (e.g. /assets/seabios.bin).
    const wsImageKey = url.searchParams.get("image") || null;
    if (wsImageKey && !this.imageKey) {
      this.imageKey = wsImageKey;
    }
    if (!this.workerOrigin) {
      this.workerOrigin = url.origin;
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();

    this.sessions.set(server, { needsKeyframe: true, droppedFrames: 0, lastSendTime: 0 });

    server.addEventListener("message", async (event: MessageEvent) => {
      await this.webSocketMessage(server, event.data);
    });
    server.addEventListener("close", (event: CloseEvent) => {
      this.webSocketClose(server, event.code, event.reason);
    });
    server.addEventListener("error", () => {
      this.webSocketError(server);
    });

    this.wsSend(server, encodeStatus("connected"));

    if (this.bootError) {
      this.wsSend(server, encodeStatus("error: " + this.bootError));
    } else if (this.booted) {
      this.wsSend(server, encodeStatus("running"));
      this.sendCurrentFrame(server);
      this.startRenderLoop();
    } else if (this.booting) {
      this.wsSend(server, encodeStatus("booting"));
    } else {
      // Tell client to send {type:"boot"} — boot will run inside that handler,
      // keeping the event loop active for the full async chain.
      this.wsSend(server, encodeStatus("waiting_for_boot"));
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Stats collection ──────────────────────────────────────────────────

  
  private getJitBlockCount(): Record<string, unknown> {
    try {
      const emu = this.emulator as any;
      const cpu = emu?.v86?.cpu;
      if (!cpu) return { error: "no cpu" };
      const wm = cpu.wm;
      if (!wm) return { error: "no wm" };
      const table = wm.wasm_table;
      if (!table) return { error: "no wasm_table", wmKeys: Object.keys(wm).slice(0, 10) };
      const tableLen = table.length;
      let filled = 0;
      for (let i = 0; i < tableLen; i++) {
        try { if (table.get(i) !== null) filled++; } catch { break; }
      }
      const seenCode = cpu.seen_code ? Object.keys(cpu.seen_code).length : -1;
      return { tableLen, filled, seenCode };
    } catch (e: any) { return { error: e.message }; }
  }

  private collectStats(): Record<string, unknown> {
    const now = performance.now();
    const uptimeMs = this._perf.bootTimeMs > 0
      ? Math.round(now - this._perf.bootTimeMs)
      : 0;
    const p = this._perf;
    const ps = this._pageStore?.getStats() ?? null;
    return {
      // DO-level
      booted:      this.booted,
      imageKey:    this.imageKey,
      uptimeMs,
      sessions:    this.sessions.size,
      // Yield / CPU
      yields:      p.yields,
      syncYields:  p.syncYields,
      asyncYields: p.yields - p.syncYields,
      // Render
      renders:     p.renders,
      renderMs:    Math.round(p.renderMs),
      framesSent:  p.framesSent,
      rendersPerSec: uptimeMs > 0 ? +(p.renders / (uptimeMs / 1000)).toFixed(1) : 0,
      framesPerSec:  uptimeMs > 0 ? +(p.framesSent / (uptimeMs / 1000)).toFixed(2) : 0,
      // render pipeline breakdown
      notDirty:       p.notDirty,
      pixelsNull:     p.pixelsNull,
      pixelsOk:       p.pixelsOk,
      deltaNull:      p.deltaNull,
      svgaDirtyPages: p.svgaDirtyPages,
      // Text mode rendering
      textSent:      this._textSent,
      textEmpty:     this._textEmpty,
      textSame:      this._textSame,
      vgaNull:       this._vgaNull,
      graphicalMode: this.getVga()?.graphical_mode ?? null,
      // Yield health
      yieldDead:     this._yieldDead,
      yieldError:    this._yieldError || null,
      // Adaptive FPS
      adaptiveSkips: this._adaptiveSkips,
      cleanTicks:    this._cleanTicks,
      effectiveFps:  uptimeMs > 0 ? +(p.framesSent / (uptimeMs / 1000)).toFixed(1) : 0,
      // Page store
      pageStore:   ps,
      // JIT
      jit:         this.getJitBlockCount(),
    };
  }

  // ── Boot pipeline ─────────────────────────────────────────────────────

  private async bootVM(): Promise<void> {
    if (!this.cachedAssets) throw new Error("No assets loaded");
    this.booting = true;
    this.bootError = null;
    this.broadcast(encodeStatus("booting"));

    try {
      const bios = this.cachedAssets.get("bios");
      const vgaBios = this.cachedAssets.get("vgaBios");
      if (!bios || !vgaBios) throw new Error("Missing BIOS assets");

      let imageKey = "kolibri", drive: "fda" | "cdrom" | "multiboot" = "cdrom";
      let memorySizeMB = VM_CONFIG.WASM_MB, vgaMemoryMB = VM_CONFIG.VGA_MB, label = "Linux";
      let diskUrl: string | null = null;
      let diskFile: string | null = null;
      let ahciDiskSize: number | undefined;
      let logicalMemoryMB = VM_CONFIG.LOGICAL_MB;

      const metadataRaw = this.cachedAssets.get("metadata");
      if (metadataRaw) {
        try {
          const meta = JSON.parse(new TextDecoder().decode(metadataRaw));
          imageKey = meta.imageKey || imageKey;
          drive = meta.drive || drive;
          memorySizeMB = meta.memory || memorySizeMB;
          vgaMemoryMB = meta.vgaMemory || vgaMemoryMB;
          label = meta.label || label;
          diskUrl = meta.diskUrl || null;
          diskFile = meta.diskFile || null;
          this.noSnapshot = !!meta.noSnapshot;
          if (meta.ahciDiskSize) ahciDiskSize = meta.ahciDiskSize;
          if (meta.logicalMemory) logicalMemoryMB = meta.logicalMemory;
        } catch (e) {
          console.error(`${LOG_PREFIX} Failed to parse boot metadata:`, e);
        }
      }
      this.imageKey = imageKey;

      // Always initialize storage early (needed for snapshots and image cache)
      this.ensureStorage();

      // ── Handle fresh boot / noSnapshot (clear cached snapshot) ────────
      const metaForFresh = metadataRaw ? JSON.parse(new TextDecoder().decode(metadataRaw)) : {};
      if ((metaForFresh.fresh || this.noSnapshot) && this.imageCache!.states.has(imageKey)) {
        const reason = this.noSnapshot ? "noSnapshot flag" : "fresh boot requested";
        console.log(`${LOG_PREFIX} ${reason} — clearing snapshot for ${imageKey}`);
        this.imageCache!.states.delete(imageKey);
        this.snapshotSaved = false;
      }

      // ── Check for existing state snapshot ─────────────────────────────
      let savedState: ArrayBuffer | null = null;
      if (!this.noSnapshot && this.imageCache!.states.has(imageKey)) {
        console.log(`${LOG_PREFIX} State snapshot found for ${imageKey} — restoring`);
        this.broadcast(encodeStatus(`restoring: ${label}`));
        savedState = this.imageCache!.states.get(imageKey);
        if (savedState) {
          console.log(`${LOG_PREFIX} Loaded snapshot: ${(savedState.byteLength / 1024 / 1024).toFixed(1)}MB`);
          this.snapshotSaved = true;
        }
      }

      // ── Resolve disk image ────────────────────────────────────────────
      let disk = this.cachedAssets.get("disk") || null;
      if (!disk && diskUrl) {
        const cacheName = diskFile || imageKey;

        if (this.imageCache!.images.has(cacheName)) {
          console.log(`${LOG_PREFIX} Cache hit for ${cacheName}`);
          if (!savedState) this.broadcast(encodeStatus(`booting: ${label} (cached)`));
          disk = this.imageCache!.images.get(cacheName);
        }

        if (!disk) {
          console.log(`${LOG_PREFIX} Fetching ${cacheName} from ${diskUrl}`);
          this.broadcast(encodeStatus(`downloading: ${label}`));
          const resp = await this.cachedFetch(diskUrl);
          if (!resp.ok) throw new Error(`Failed to fetch ${diskUrl}: ${resp.status} ${resp.statusText}`);
          disk = await resp.arrayBuffer();
          const etag = resp.headers.get("etag") || undefined;
          console.log(`${LOG_PREFIX} Downloaded ${cacheName}: ${(disk.byteLength / 1024 / 1024).toFixed(1)}MB`);

          try {
            this.imageCache!.images.put(cacheName, disk, { etag, fetchedAt: new Date().toISOString() });
          } catch (e) {
            console.error(`${LOG_PREFIX} Failed to cache ${cacheName}:`, e);
            // Non-fatal — we have the image in memory
          }
        }
      }

      if (!disk) throw new Error("No disk image: not provided inline and no URL configured");

      const bootMode = savedState ? "snapshot" : "cold";
      console.log(`${LOG_PREFIX} Booting ${label} (${bootMode}): drive=${drive} mem=${memorySizeMB}MB vga=${vgaMemoryMB}MB`);
      if (!savedState) this.broadcast(encodeStatus(`booting: ${label}`));
      this.screenAdapter = new DOScreenAdapter();

      // Only initialize swap for floppy images — CD-ROM images don't need HDA
      const needsSwap = drive === "fda";
      if (needsSwap) {
        try {
          this.swapDevice = new SQLiteBlockDevice(this.storage!);
          this.swapDevice.load();
          console.log(`${LOG_PREFIX} SQLite swap initialized (10GB available)`);
        } catch (e) {
          console.error(`${LOG_PREFIX} Swap init failed:`, e);
          this.swapDevice = null;
        }
      }

      // Free packed assets before allocating v86 WASM memory — reduces peak usage
      this.cachedAssets = null;

      const { V86 } = await import("./libv86.mjs");

      // Microtick fix for Workers environment where performance.now() is frozen between I/O.
      //
      // F.microtick (JS-side) is called directly by ACPI, PIT, RTC, and APIC device code —
      // NOT only via the WASM import. We must patch V86.microtick BEFORE new V86() so that:
      //   1. The global JS device calls use our hybrid timer.
      //   2. The WASM import table (bound at WebAssembly.instantiate time) also captures it,
      //      because libv86.mjs passes `v86.microtick` by value into the WASM env object.
      //
      // V86.microtick has a getter/setter that forwards to the internal `v86.microtick` variable,
      // so assigning here propagates to both the JS devices and the WASM import capture.
      //
      // Hybrid approach: advance synthetically during synchronous WASM execution (~50 calls per
      // frame at 0.02ms increment = 1ms), but sync to real time whenever I/O advances it.
      let syntheticTime = performance.now();
      let lastRealTime = syntheticTime;
      const MICROTICK_INCREMENT = 0.005; // 20μs per call — ~50 calls to hit 1ms TIME_PER_FRAME

      (V86 as any).microtick = () => {
        const realNow = performance.now();
        if (realNow > lastRealTime) {
          lastRealTime = realNow;
          // Only advance syntheticTime if real time is ahead — never go backwards.
          // If syntheticTime already leads realNow (from synthetic increments),
          // keep it as-is; resetting to realNow would cause time to go backwards,
          // triggering the ACPI pmtimer dbg_assert(t > timer_last_value).
          if (realNow > syntheticTime) {
            syntheticTime = realNow;
          }
        } else {
          // Still in synchronous execution — advance synthetically.
          syntheticTime += MICROTICK_INCREMENT;
        }
        return syntheticTime;
      };

      // Reset perf counters for this boot
      this._perf = { yields: 0, syncYields: 0, renders: 0, renderMs: 0, framesSent: 0, bootTimeMs: 0, pixelsNull: 0, pixelsOk: 0, deltaNull: 0, notDirty: 0, svgaDirtyPages: 0 };
      this._adaptiveSkips = 0;
      this._cleanTicks = 0;

      // ── SqlPageStore: created BEFORE new V86() so the swap hook is live ───────
      // SeaBIOS runs during cpu.init() which is called synchronously inside the
      // V86 constructor chain (wasm_fn → new v86() → continue_init → v86.init).
      // emulator-loaded fires AFTER cpu.init() completes — too late to catch BIOS
      // writes to demand-paged pages (e.g. ACPI tables near top of logical RAM).
      // Fix: create SqlPageStore here, wire swap_page_in in wasm_fn so it is live
      // from the first WASM instruction.
      const HOT_POOL_BASE = VM_CONFIG.RESIDENT_MB * 1024 * 1024;
      const pageStore = new SqlPageStore(
        this.ctx.storage.sql as any,
        VM_CONFIG.PAGE_STORE,
      );
      pageStore.init();
      this._pageStore = pageStore;

      const v86Config: Record<string, any> = {
        wasm_fn: async (importObj: any) => {
          console.log(`${LOG_PREFIX} wasm_fn: calling WebAssembly.instantiate`);
          const instance = await WebAssembly.instantiate(v86WasmModule, importObj);
          console.log(`${LOG_PREFIX} wasm_fn: WebAssembly.instantiate complete, exports=${Object.keys(instance.exports).length}`);

          // Wire swap hook NOW — WASM memory is live, cpu.init() hasn't run yet.
          // We store the Memory object (not a snapshot Uint8Array) because
          // allocate_memory() during cpu.init() grows WASM memory, detaching
          // any previously-created ArrayBuffer view.
          const wasmMem = instance.exports.memory as WebAssembly.Memory;
          pageStore.setWasmMemory(wasmMem, HOT_POOL_BASE);

          // Wire pool_* WASM exports (page_pool.rs) so the JS Clock eviction
          // reads/clears reference bits from the authoritative WASM REF_MAP,
          // and pool_register/pool_unregister keep FRAME_MAP in sync after
          // every SQLite load or eviction.
          pageStore.setWasmExports(instance.exports as Record<string, unknown>);

          // Wrap the swap_page_in import.  In do_page_walk, pool_lookup (pure WASM)
          // runs first; this import is called ONLY on a cold miss (page not yet in
          // pool).  The JS handler loads from SQLite and calls pool_register so
          // subsequent TLB misses for the same page are handled in WASM (no FFI).
          if (importObj.env) {
            importObj.env.swap_page_in = (gpa: number, forWriting: number): number => {
              return pageStore.swapPageIn(gpa, forWriting);
            };
          }
          console.log(`${LOG_PREFIX} wasm_fn: swap_page_in wired; pool_* exports=${
            ["pool_register","pool_unregister","pool_get_ref","pool_clear_ref","pool_reset"]
              .filter(k => typeof (instance.exports as any)[k] === "function").length
          }/5 found`);

          return instance.exports;
        },
        // JIT works in production — workerd allows runtime WASM compilation.
        // The .catch() in codegen_finalize silently swallows failures without
        // calling codegen_finalize_finished (which would corrupt the wasm_table).
        disable_jit: false,
        bios: { buffer: bios },
        vga_bios: { buffer: vgaBios },
        // memory_size = WASM_MB (resident + hot pool) so in_mapped_range() never
        // fires for hot pool frame offsets.  See VM_CONFIG for full explanation.
        memory_size:         memorySizeMB * 1024 * 1024,
        vga_memory_size:     vgaMemoryMB  * 1024 * 1024,
        // logical_memory_size: what the guest BIOS/CMOS reports.
        // Defaults to VM_CONFIG.LOGICAL_MB (64), but can be overridden per image
        // (e.g. AqeousOS needs 256 MB).  GPAs beyond memory_size (WASM allocation)
        // are demand-paged from DO SQLite via swap_page_in.
        logical_memory_size: logicalMemoryMB * 1024 * 1024,
        autostart: false,
        disable_speaker: true,
        fastboot: true,
        acpi: true,
        boot_order: drive === "cdrom" ? BOOT_ORDER_CDROM_FIRST : BOOT_ORDER_HDA_FIRST,
        // cpu_count: stratum WASM supports SMP via smp_init().
        // VM_CONFIG.CPU_COUNT = 2 (BSP + 1 AP) is conservative for the DO budget.
        cpu_count: VM_CONFIG.CPU_COUNT,
        // Networking: NE2K is always created (v86 default).  We don't set
        // network_relay_url — no relay exists, so TX packets vanish and
        // KolibriOS spins on DHCP retries until timeout.  Cannot use
        // net_device "none" — KolibriOS depends on the NE2K PCI slot.
        //
        // AHCI virtual disk: aqeous needs a 32 MB AHCI disk for its filesystem.
        // ahciDiskSize comes from the init metadata (MB), converted to bytes.
        ...(ahciDiskSize ? { ahci_disk_size: ahciDiskSize * 1024 * 1024 } : {}),
      };

      if (drive === "multiboot") v86Config.multiboot = { buffer: disk };
      else if (drive === "fda") v86Config.fda = { buffer: disk };
      else v86Config.cdrom = { buffer: disk };
      disk = null; // Allow GC of the 50MB+ buffer

      if (this.swapDevice && needsSwap) v86Config.hda = this.swapDevice;

      // Instant boot: pass saved state to v86
      if (savedState) {
        v86Config.initial_state = { buffer: savedState };
      }

      const origOnError = globalThis.onerror;
      // Log v86 config summary for debugging (omit large buffers)
      console.log(`${LOG_PREFIX} v86Config: memory=${memorySizeMB}MB logical=${logicalMemoryMB}MB vga=${vgaMemoryMB}MB drive=${drive} acpi=${v86Config.acpi} ahci_disk_size=${v86Config.ahci_disk_size || 0} multiboot=${!!v86Config.multiboot} cdrom=${!!v86Config.cdrom} fda=${!!v86Config.fda}`);
      this.emulator = new V86(v86Config);
      console.log(`${LOG_PREFIX} new V86() returned — waiting for emulator-loaded`);

      this.emulator.add_listener("emulator-stopped", () => {
        this.broadcast(encodeStatus("error: emulator stopped"));
      });

      this.emulator.add_listener("serial0-output-byte", (byte: number) => {
        const char = String.fromCharCode(byte);
        this.serialBuffer += char;
        if (char === "\n" || this.serialBuffer.length > 256) {
          this.broadcast(encodeSerialData(this.serialBuffer));
          this.serialBuffer = "";
        }
      });

      this.emulator.add_listener("screen-set-mode", (graphical: boolean) => {
        if (graphical) this.deltaEncoder.reset();
        this.broadcast(encodeStatus(graphical ? "mode: graphical" : "mode: text"));
      });

      this.emulator.add_listener("screen-set-size", (_size: [number, number, number]) => {
        this.deltaEncoder.reset();
        for (const state of this.sessions.values()) state.needsKeyframe = true;
      });

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(
          () => reject(new Error("Emulator load timed out")),
          EMULATOR_LOAD_TIMEOUT_MS,
        );

        this.emulator!.add_listener("emulator-loaded", () => {
          console.log(`${LOG_PREFIX} emulator-loaded fired`);
          clearTimeout(timeout);

          // ── SqlPageStore post-init: give the CPU reference for TLB flushing ────
          // The store and its swap hook were wired inside wasm_fn (before cpu.init /
          // BIOS ran). Here we just hand it the cpu object for full_clear_tlb().
          try {
            const cpu = (this.emulator as any).v86?.cpu;
            if (cpu) {
              pageStore.setCpu(cpu);
              // Also wire the cpu-side hook so future TLB misses (after BIOS) go
              // through cpu.swap_page_in() → cpu._swap_page_in_hook path too.
              cpu._swap_page_in_hook = (gpa: number, forWriting: number): number =>
                pageStore.swapPageIn(gpa, forWriting);
              const poolSizeMB = VM_CONFIG.HOT_FRAMES * 4096 / 1024 / 1024;
              console.log(
                `${LOG_PREFIX} SqlPageStore ready: ` +
                `resident=${VM_CONFIG.RESIDENT_MB}MB ` +
                `wasm=${memorySizeMB}MB ` +
                `logical=${logicalMemoryMB}MB ` +
                `hot_pool=${HOT_POOL_BASE.toString(16)}h–` +
                `${(HOT_POOL_BASE + VM_CONFIG.HOT_FRAMES * 4096).toString(16)}h ` +
                `(${VM_CONFIG.HOT_FRAMES} frames × 4KB = ${poolSizeMB}MB) ` +
                ` swapIns=${pageStore.stats.swapIns}(pre-run)`,
              );
            } else {
              console.warn(`${LOG_PREFIX} SqlPageStore: cpu not available after emulator-loaded`);
            }
          } catch (e) {
            console.error(`${LOG_PREFIX} SqlPageStore post-init failed (non-fatal):`, e);
          }

          const vga = this.getVga();
          if (vga) {
            vga.screen = this.screenAdapter;
            if (vga.graphical_mode && vga.screen_width > 0) {
              this.screenAdapter!.set_mode(true);
              this.screenAdapter!.set_size_graphical(
                vga.screen_width, vga.screen_height,
                vga.virtual_width, vga.virtual_height,
              );
            }
            // Force a full redraw into our newly-assigned screen adapter.
            // When restoring from snapshot, v86 calls complete_redraw() during
            // state load — before we hook vga.screen — so our adapter misses the
            // initial put_char() calls. Calling complete_redraw() again after
            // assigning our adapter re-pumps the current VGA state into it.
            // complete_redraw() calls svga_mark_dirty() which fills the WASM dirty
            // bitmap. getVgaPixels() now reads the bitmap directly (not screenAdapter.dirty),
            // so the first render will correctly see dirty pages and capture the frame.
            try { vga.complete_redraw?.(); } catch (_) {}
          }
          this.emulator!.run();

          // ── High-performance yield override ──────────────────────────────────
          //
          // Strategy: eliminate ~87% of setTimeout overhead by calling
          // yield_callback() synchronously for (BATCH_SIZE-1) of every BATCH_SIZE
          // yields. Only the last yield in each batch breaks to the event loop:
          //   1. Lets WS sends flush (network I/O) and incoming messages land
          //   2. Prevents a single DO request from monopolising the event loop
          //   3. Gives us a clean batch boundary to render from (guest has
          //      finished its draw operations — no mid-draw ghost captures)
          //
          // BATCH_SIZE=8: ~8ms between renders (~125fps capture rate), ~87% sync.
          //
          // Idle detection: v86 passes `t` (ms hint) from main_loop. When
          // t > 10 the guest CPU is halted (HLT) — we sleep min(t, 40)ms instead
          // of spinning, saving CPU on idle desktops.
          //
          // Rendering: renderFrame() fires at every batch boundary and on idle.
          // No setInterval — all rendering is driven by the yield cadence.
          const BATCH_SIZE = 8;
          const v86Internal = (this.emulator as any).v86;
          if (v86Internal) {
            let yieldCount = 0;
            v86Internal.yield = (t: number, tick: number) => {
              if (this._yieldDead) return;
              yieldCount++;
              this._perf.yields++;
              if (yieldCount % BATCH_SIZE !== 0) {
                // Synchronous fast path: no event loop round-trip, no setTimeout cost.
                this._perf.syncYields++;
                try {
                  v86Internal.yield_callback(tick);
                } catch (e) {
                  const cpu = (this.emulator as any)?.v86?.cpu;
                  const eip = cpu?.instruction_pointer?.[0];
                  const cr0 = cpu?.cr?.[0];
                  this._yieldError = `sync: ${e} [eip=${eip?.toString(16)} cr0=${cr0?.toString(16)} yields=${this._perf.yields}]`;
                  console.error(`${LOG_PREFIX} FATAL: sync yield_callback threw:`, e, `eip=${eip?.toString(16)} cr0=${cr0?.toString(16)}`);
                  this._yieldDead = true;
                }
                return;
              }
              // Async yield: break to event loop.
              // Render at each async boundary — setInterval can't fire during
              // synchronous yield batches (WASM + page faults monopolize the
              // event loop for hundreds of ms in page-fault-heavy boots).
              try { this.renderFrame(); } catch (_) {}

              if (t > 10) {
                setTimeout(() => {
                  try { v86Internal.yield_callback(tick); }
                  catch (e) { this._yieldError = `async(idle): ${e}`; console.error(`${LOG_PREFIX} FATAL: async yield_callback threw:`, e); this._yieldDead = true; }
                }, Math.min(t, 40));
              } else {
                setTimeout(() => {
                  try { v86Internal.yield_callback(tick); }
                  catch (e) { this._yieldError = `async: ${e}`; console.error(`${LOG_PREFIX} FATAL: async yield_callback threw:`, e); this._yieldDead = true; }
                }, 1);
              }
            };
          }

          resolve();
        });
      });

      // DSL needs an Enter key to auto-boot from CD menu
      if (imageKey === "dsl" && !savedState) {
        setTimeout(() => {
          try { this.emulator?.keyboard_send_text("\n"); }
          catch (e) { console.error(`${LOG_PREFIX} DSL auto-enter failed:`, e); }
        }, 3000);
      }

      this.booted = true;
      this._perf.bootTimeMs = performance.now();
      this.restoredFromSnapshot = !!savedState;
      this.cachedAssets = null;
      this.startRenderLoop();
      this.startStatsInterval();

      if (savedState) {
        // Restored from snapshot — no need to gate input or save again
        this.inputGated = false;
        console.log(`${LOG_PREFIX} Restored from snapshot: ${label}`);
        this.broadcast(encodeStatus(`running: ${label}`));
      } else {
        console.log(`${LOG_PREFIX} Cold boot complete: ${label}`);

        // Schedule snapshot save after boot stabilizes (skip for noSnapshot images).
        // Gate user input until the snapshot is captured so we get pristine boot state.
        if (!this.noSnapshot) {
          this.inputGated = true;
          const delayMs = imageKey === "kolibri" ? SNAPSHOT_DELAY_FAST_MS : SNAPSHOT_DELAY_SLOW_MS;
          console.log(`${LOG_PREFIX} Input gated — will ungate in 3s (snapshot in ${delayMs / 1000}s)`);
          this.broadcast(encodeStatus(`running: ${label}`));
          this.scheduleSnapshot(label, delayMs);
          // Ungate input after 3s regardless of snapshot timing.
          // The snapshot still fires at delayMs to capture fully-booted state,
          // but we don't block user input for the entire wait.  The snapshot
          // captures whatever state the OS is in — user input during the
          // window between ungate and snapshot is acceptable.
          setTimeout(() => this.ungateInput("3s timeout"), 3000);
        } else {
          this.inputGated = false;
          console.log(`${LOG_PREFIX} Snapshot saving disabled for ${imageKey} (noSnapshot)`);
          this.broadcast(encodeStatus(`running: ${label}`));
        }
      }
    } catch (err) {
      if (this.imageKey && this.imageCache) {
        try { console.log(`${LOG_PREFIX} Clearing corrupted snapshot for ${this.imageKey}`); this.snapshotSaved = false; } catch { }
      }
      this.bootError = String(err);
      this.cachedAssets = null;
      this.inputGated = false; // Don't leave input gated on boot failure
      console.error(`${LOG_PREFIX} Boot failed:`, err);
      throw err;
    } finally {
      this.booting = false;
    }
  }

  // ── Snapshot management ───────────────────────────────────────────────

  private async saveSnapshot(label: string): Promise<void> {
    if (this.noSnapshot || this.snapshotSaved || !this.emulator || !this.imageCache || !this.imageKey) {
      this.ungateInput("snapshot precondition not met");
      return;
    }

    const vga = this.getVga();
    if (!vga?.graphical_mode) {
      console.log(`${LOG_PREFIX} Snapshot skipped — not in graphical mode yet`);
      this.ungateInput("not in graphical mode");
      return;
    }

    if (this.imageCache.states.has(this.imageKey)) {
      this.snapshotSaved = true;
      console.log(`${LOG_PREFIX} Snapshot already exists for ${this.imageKey}`);
      this.ungateInput("snapshot already exists");
      return;
    }

    try {
      this.broadcast(encodeStatus("saving snapshot..."));
      console.log(`${LOG_PREFIX} Saving boot snapshot for ${label} (input gated — no user activity captured)...`);
      const state = await this.emulator.save_state();
      this.imageCache.states.put(this.imageKey, state);
      this.snapshotSaved = true;
      console.log(`${LOG_PREFIX} Boot snapshot saved for ${label} (${(state.byteLength / 1024 / 1024).toFixed(1)}MB) — no further snapshots will be taken`);
      this.broadcast(encodeStatus(`running: ${label}`));
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to save snapshot:`, err);
      this.broadcast(encodeStatus(`running: ${label}`));
    } finally {
      // Always ungate input after the snapshot attempt, success or failure.
      // This is the only code path that lifts the gate during cold boot.
      this.ungateInput("boot snapshot complete");
    }
  }

  /** Lift the input gate and allow user interaction with the emulator. */
  private ungateInput(reason: string): void {
    if (!this.inputGated) return;
    this.inputGated = false;
    console.log(`${LOG_PREFIX} Input gate lifted — ${reason}`);
  }

  private scheduleSnapshot(label: string, delayMs: number): void {
    if (this.snapshotTimer) return;
    console.log(`${LOG_PREFIX} Snapshot scheduled in ${delayMs / 1000}s for ${label}`);
    this.snapshotTimer = setTimeout(() => {
      this.snapshotTimer = null;
      this.saveSnapshot(label).catch((err) => {
        console.error(`${LOG_PREFIX} Snapshot error:`, err);
      });
    }, delayMs);
  }

  // ── Frame rate adaptation ─────────────────────────────────────────────

  private adjustFrameRate(frameBytes: number): void {
    if (frameBytes < LARGE_FRAME_BYTES) {
      this.consecutiveSmallFrames++;
      this.consecutiveLargeFrames = 0;
    } else {
      this.consecutiveLargeFrames++;
      this.consecutiveSmallFrames = 0;
    }

    let changed = false;
    if (this.consecutiveSmallFrames > 3 && this.currentFPS < FPS_MAX) {
      this.currentFPS = Math.min(this.currentFPS + 2, FPS_MAX);
      this.consecutiveSmallFrames = 0;
      changed = true;
    }
    if (this.consecutiveLargeFrames > 2 && this.currentFPS > FPS_MIN) {
      this.currentFPS = Math.max(this.currentFPS - 2, FPS_MIN);
      this.consecutiveLargeFrames = 0;
      changed = true;
    }
    if (this.framesSkippedBackpressure > 2 && this.currentFPS > FPS_MIN) {
      this.currentFPS = FPS_MIN;
      this.framesSkippedBackpressure = 0;
      changed = true;
    }
    if (changed) this.restartRenderLoop();
    this.lastFrameBytes = frameBytes;
  }

  private restartRenderLoop(): void {
    this.startRenderLoop();
  }

  /** Adaptive render loop: 30fps ceiling, 2fps floor.
   *
   *  Runs setInterval at 33ms (≈30fps).  Each tick:
   *    1. Calls screen_fill_buffer() which drains the WASM dirty bitmap
   *    2. If dirty: render + send frame, reset _cleanTicks to 0
   *    3. If clean: increment _cleanTicks.  When _cleanTicks ≥ 3, skip frames
   *       (only render every ~15th tick ≈ 2fps).
   *
   *  This gives 30fps when the guest is actively drawing and drops to ~2fps
   *  when idle — no clearInterval/setInterval churn.
   */
  private startRenderLoop(): void {
    if (this.renderInterval) {
      clearInterval(this.renderInterval);
    }
    this._cleanTicks = 0;
    this.renderInterval = setInterval(() => {
      try { this.renderFrame(); } catch (_) {}
    }, 33); // 30fps ceiling
  }

  private startStatsInterval(): void {
    if (this._statsInterval) clearInterval(this._statsInterval);
    this._statsInterval = setInterval(() => {
      if (!this.booted || this.sessions.size === 0) return;
      try {
        const stats = this.collectStats();
        this.broadcast(encodeStats(stats));
        console.log(`${LOG_PREFIX} STATS ${JSON.stringify(stats)}`);
      } catch { /* non-fatal */ }
    }, 10_000);
  }

  // ── VGA pixel reader ──────────────────────────────────────────────────
  //
  // Reads pixel data directly from wasm linear memory.
  //
  // v86 renders RGBA pixels into wasm memory at `vga.dest_buffet_offset`
  // (note: typo is v86's, not ours).
  //
  // CRITICAL FIX: When wasm memory grows, the old ArrayBuffer is detached and
  // a new one is created. v86's screen_fill_buffer() detects this by checking
  // `this.image_data.data.byteLength === 0`. However, in Cloudflare Workers
  // (workerd), detached ArrayBuffers may retain their original byteLength
  // instead of reporting 0. This means v86 never recreates its image_data,
  // and svga_fill_pixel_buffer writes to the new buffer while image_data.data
  // still references the old detached one.
  //
  // We fix this by checking if vga.image_data.data.buffer is the same object
  // as cpu.wasm_memory.buffer. If not, we manually recreate image_data with a
  // fresh view into the current wasm memory before calling screen_fill_buffer.

  private getVgaPixels(vga: VgaDevice): {
    rgba: Uint8ClampedArray; width: number; height: number; bufferWidth: number;
  } | null {
    const cpu = vga.cpu;
    if (!cpu?.wasm_memory?.buffer) {
      this._dbgPixelsNullReason = "no_wasm_buf";
      return null;
    }

    const width = vga.screen_width;
    const height = vga.screen_height;
    if (!width || !height || width * height > MAX_RESOLUTION) {
      this._dbgPixelsNullReason = `bad_size(${width}x${height})`;
      return null;
    }

    const bufferWidth = vga.virtual_width || width;
    const offset = vga.dest_buffet_offset;
    if (offset == null) {
      this._dbgPixelsNullReason = "no_offset";
      return null;
    }

    // Fix detached buffer — see comment above
    const wasmBuf = cpu.wasm_memory.buffer;
    if (vga.image_data?.data) {
      const backingBuffer = vga.image_data.data.buffer;
      if (backingBuffer !== wasmBuf) {
        const virtualHeight = vga.virtual_height || height;
        const pixelCount = bufferWidth * virtualHeight;
        const freshData = new Uint8ClampedArray(wasmBuf, offset, 4 * pixelCount);
        vga.image_data = new ImageData(freshData, bufferWidth, virtualHeight);
        vga.update_layers();
      }
    }

    // ── Dirty detection and pixel fill ──────────────────────────────────
    //
    // Legacy VGA: diff_addr_min/max are JS-side counters updated on every
    // port write.  Safe to check before fill.
    //
    // SVGA: the authoritative dirty state is the WASM dirty bitmap, read by
    // svga_fill_pixel_buffer() inside screen_fill_buffer().  We always call
    // screen_fill_buffer(), then read the WASM output (min/max_offset) to
    // decide whether the fill found any dirty pages.
    //
    // At 8fps (125ms interval), this call runs ≤8 times/s — negligible cost.
    if (!vga.svga_enabled) {
      if (vga.diff_addr_min >= vga.diff_addr_max) {
        this._dbgPixelsNullReason = `legacy_not_dirty(${vga.diff_addr_min}..${vga.diff_addr_max})`;
        return null;
      }
    }

    // screen_fill_buffer processes the WASM dirty bitmap, writes RGBA to
    // dest_buffer, then clears the bitmap.  Cheap even when bitmap is empty.
    vga.screen_fill_buffer();

    // For SVGA: check post-fill output to see if any pages were dirty.
    // min_offset = 0xFFFFFFFF means iter_dirty_pages found nothing.
    if (vga.svga_enabled) {
      const minOff = cpu.svga_dirty_bitmap_min_offset[0];
      if (minOff === 0xFFFFFFFF) {
        this._dbgPixelsNullReason = "svga_bitmap_empty";
        this._perf.notDirty++;
        return null;
      }
      const maxOff = cpu.svga_dirty_bitmap_max_offset[0];
      const dirtyPageEstimate = Math.min(((maxOff - minOff) >> 12) + 1, vga.vga_memory_size >> 12);
      this._perf.svgaDirtyPages += dirtyPageEstimate;
    }

    const byteLen = bufferWidth * height * 4;
    if (offset + byteLen > wasmBuf.byteLength) {
      this._dbgPixelsNullReason = `oob(off=${offset} len=${byteLen} buf=${wasmBuf.byteLength})`;
      return null;
    }
    this._dbgPixelsNullReason = null;
    const rgba = new Uint8ClampedArray(wasmBuf, offset, byteLen);

    return { rgba, width, height, bufferWidth };
  }

  // ── Render loop ───────────────────────────────────────────────────────

   private _renderCount = 0;
   private _dbgPixelsNullReason: string | null = null;
   private _dbgFirstPixels = false;
   private _dbgFirstEncNull = false;

   /** Adaptive render: 30fps when active, ~2fps when idle.
    *  At 33ms interval, 15 ticks ≈ 500ms ≈ 2fps. */
   private static readonly IDLE_SKIP_THRESHOLD = 3;   // clean ticks before throttling
   private static readonly IDLE_RENDER_EVERY   = 15;  // render every Nth tick when idle (~2fps)

   private renderFrame(): void {
     this._renderCount++;
     this._perf.renders++;
     const _rfT0 = performance.now();
     if (!this.emulator || !this.screenAdapter || this.sessions.size === 0) {
       this._perf.renderMs += performance.now() - _rfT0;
       return;
     }

      const vga = this.getVga();

    if (!vga) { this._vgaNull++; return; }

    if (vga.graphical_mode) {
      // Adaptive idle skip: when 3+ consecutive clean ticks, only check every
      // IDLE_RENDER_EVERY ticks (~2fps). This avoids calling screen_fill_buffer
      // and getVgaPixels 30 times/sec on an idle desktop.
      if (this._cleanTicks >= LinuxVM.IDLE_SKIP_THRESHOLD &&
          this._renderCount % LinuxVM.IDLE_RENDER_EVERY !== 0) {
        this._adaptiveSkips++;
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }

      const frame = this.getVgaPixels(vga);
      if (!frame) {
        // No dirty pixels — track consecutive clean ticks for adaptive throttle
        this._cleanTicks++;
        this._perf.pixelsNull++;
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }

      // Dirty detection — reset to active (30fps)
      this._cleanTicks = 0;

      this._perf.pixelsOk++;

      // First successful pixel read — log it once
      if (!this._dbgFirstPixels) {
        this._dbgFirstPixels = true;
        console.log(`${LOG_PREFIX} getVgaPixels: first success w=${frame.width} h=${frame.height} bufW=${frame.bufferWidth} rgbaLen=${frame.rgba.length}`);
      }

      let anyNeedsKeyframe = false;
      for (const state of this.sessions.values()) {
        if (state.needsKeyframe) { anyNeedsKeyframe = true; break; }
      }

      let result: { data: ArrayBuffer; isDelta: boolean } | null;
      try {
        result = this.deltaEncoder.encode(
          frame.width, frame.height, frame.bufferWidth, frame.rgba, anyNeedsKeyframe,
        );
      } catch (e) {
        console.error(`${LOG_PREFIX} Delta encode error:`, e);
        this.deltaEncoder.reset();
        for (const state of this.sessions.values()) state.needsKeyframe = true;
        return;
      }
      if (!result) {
        // Delta encoder says no tiles changed — treat as clean tick
        this._cleanTicks++;
        this._perf.deltaNull++;
        if (!this._dbgFirstEncNull) {
          this._dbgFirstEncNull = true;
          console.log(`${LOG_PREFIX} encode returned null (no changed tiles) — forceKeyframe=${anyNeedsKeyframe} w=${frame.width} h=${frame.height}`);
        }
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }

      this.adjustFrameRate(result.data.byteLength);
      this._perf.renderMs += performance.now() - _rfT0;
      this.sendFrameToClients(result, frame);
    } else {
      // Text mode — also adaptive: skip if idle
      if (this._cleanTicks >= LinuxVM.IDLE_SKIP_THRESHOLD &&
          this._renderCount % LinuxVM.IDLE_RENDER_EVERY !== 0) {
        this._adaptiveSkips++;
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }

      const textRows = this.screenAdapter.getTextScreen();
      if (textRows.length === 0) {
        this._textEmpty++;
        this._cleanTicks++;
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }

      const textContent = textRows.join("\n");
      if (textContent === this.lastTextContent) {
        this._textSame++;
        this._cleanTicks++;
        this._perf.renderMs += performance.now() - _rfT0;
        return;
      }
      this._cleanTicks = 0;
      this.lastTextContent = textContent;
      this._textSent++;

      this._perf.renderMs += performance.now() - _rfT0;
      this.broadcast(encodeTextScreen(
        this.screenAdapter.textWidth_, this.screenAdapter.textHeight_, textRows,
      ));
    }
  }

  private sendFrameToClients(
    result: { data: ArrayBuffer; isDelta: boolean },
    frame: { width: number; height: number; bufferWidth: number; rgba: Uint8ClampedArray },
  ): void {
    const now = Date.now();
    const dead: WebSocket[] = [];

    for (const [ws, state] of this.sessions.entries()) {
      // At 8fps fixed cadence, backpressure gating is unnecessary — we produce
      // at most 8 frames/s per client.  Removed the old 20ms rate limit that was
      // designed for the 532/s yield-driven render loop.
      // (Previously: if lastSendTime > 0 && now - lastSendTime < 20 → skip)

      let data = result.data;
      if (state.needsKeyframe && result.isDelta) {
        try {
          const keyframe = this.deltaEncoder.encode(
            frame.width, frame.height, frame.bufferWidth, frame.rgba, true,
          );
          if (keyframe) data = keyframe.data;
        } catch (e) {
          console.error(`${LOG_PREFIX} Keyframe re-encode failed:`, e);
        }
      }

      try {
        ws.send(data);
        state.lastSendTime = now;
        state.droppedFrames = 0;
        state.needsKeyframe = false;
        this._perf.framesSent++;
      } catch {
        // WebSocket send failed — client disconnected
        dead.push(ws);
      }
    }

    for (const ws of dead) this.sessions.delete(ws);
  }

  private sendCurrentFrame(ws: WebSocket): void {
    if (!this.screenAdapter || !this.emulator) return;
    const vga = this.getVga();
    if (!vga) return;

    try {
      if (vga.graphical_mode) {
        const frame = this.getVgaPixels(vga);
        if (frame) {
          const result = this.deltaEncoder.encode(
            frame.width, frame.height, frame.bufferWidth, frame.rgba, true,
          );
          if (result) ws.send(result.data);
        }
      } else {
        const textRows = this.screenAdapter.getTextScreen();
        if (textRows.length > 0) {
          ws.send(encodeTextScreen(
            this.screenAdapter.textWidth_, this.screenAdapter.textHeight_, textRows,
          ));
        }
      }
    } catch {
      // WebSocket send may fail if client disconnected during frame capture
    }
  }

  // ── WebSocket handlers ────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      if (message instanceof ArrayBuffer) return;

      let msg: ClientMessage;
      try { msg = JSON.parse(message); }
      catch { return; /* ignore malformed JSON */ }

      // ── Boot trigger ───────────────────────────────────────────────────
      // Boot is intentionally triggered from webSocketMessage so that the
      // entire async chain (WASM instantiation, disk fetch, emulator-loaded)
      // runs inside an active event handler. In Durable Objects the runtime
      // keeps the event loop alive for the duration of an active handler,
      // so v86's internal setTimeout(d, 0) fires correctly.
      if (msg.type === "boot") {
        if (this.booted) {
          this.wsSend(ws, encodeStatus("running"));
          this.sendCurrentFrame(ws);
          this.startRenderLoop();
          return;
        }
        if (this.booting) {
          this.wsSend(ws, encodeStatus("booting"));
          return;
        }
        if (this.bootError) {
          this.wsSend(ws, encodeStatus("error: " + this.bootError));
          return;
        }
        if (!this.cachedAssets) {
          // ── Self-recovery after DO eviction ────────────────────────────
          // cachedAssets is in-memory only; eviction wipes it.
          // this.imageKey was either set from the last /init call or captured
          // from the WS URL query param (?image=...) at upgrade time.
          const recoveryKey = this.imageKey ?? "kolibri";

          console.log(`${LOG_PREFIX} DO eviction recovery: reloading assets for ${recoveryKey}`);
          this.wsSend(ws, encodeStatus(`recovering: ${recoveryKey}`));

          try {
            await this.selfLoadAssets(recoveryKey);
          } catch (err) {
            const msg = `Asset recovery failed: ${err}`;
            console.error(`${LOG_PREFIX} ${msg}`);
            this.wsSend(ws, encodeStatus("waiting_for_assets"));
            return;
          }
          // Fall through — cachedAssets is now populated, boot proceeds below.
        }
        // Run boot fully awaited — keeps this handler alive until emulator-loaded fires
        await this.bootVM().catch((err) => {
          this.bootError = String(err);
          this.broadcast(encodeStatus("error: " + String(err)));
        });
        return;
      }

      if (msg.type === "heartbeat") return;

      // Drop keyboard input while the boot snapshot is pending.
      // This prevents key presses from contaminating the pristine boot
      // state that gets persisted for future sessions.
      // Mouse events are allowed through — they don't affect snapshot state
      // and blocking them makes the OS feel broken during the gate window.
      if (this.inputGated && msg.type !== "mousemove" && msg.type !== "mousedown" && msg.type !== "mouseup") return;

      // ── Input messages — require running emulator ──────────────────────
      if (!this.emulator) return;
      const bus = this.emulator.bus;
      if (!bus) return;

      switch (msg.type) {
        case "keydown": {
          const code = msg.code;
          if (code > 0xFF) {
            bus.send("keyboard-code", code >> 8);
            bus.send("keyboard-code", code & 0xFF);
          } else {
            bus.send("keyboard-code", code);
          }
          break;
        }
        case "keyup": {
          const code = msg.code;
          if (code > 0xFF) {
            bus.send("keyboard-code", code >> 8);
            bus.send("keyboard-code", (code & 0xFF) | 0x80);
          } else {
            bus.send("keyboard-code", code | 0x80);
          }
          break;
        }
        case "mousemove":
          bus.send("mouse-delta", [msg.dx, -msg.dy]);
          break;
        case "mousedown":
        case "mouseup": {
          const idx = msg.button === 1 ? 1 : msg.button === 2 ? 2 : 0;
          this.mouseButtons[idx] = msg.type === "mousedown";
          bus.send("mouse-click", [...this.mouseButtons]);
          break;
        }
        case "text":
          if (msg.data) this.emulator.keyboard_send_text?.(msg.data);
          break;
        case "scancodes":
          if (msg.codes) this.emulator.keyboard_send_scancodes?.(msg.codes);
          break;
        case "serial":
          this.emulator.serial0_send?.(msg.data);
          break;
      }
    } catch {
      // Never throw from WS handler — would crash the DO
    }
  }

  webSocketClose(ws: WebSocket, code: number, reason: string): void {
    this.sessions.delete(ws);
    try { ws.close(code, reason); }
    catch { /* already closed */ }

    if (this.sessions.size === 0 && this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /** Get the v86 VGA device, typed as VgaDevice */
  private getVga(): VgaDevice | null {
    return (this.emulator as any)?.v86?.cpu?.devices?.vga ?? null;
  }

  /**
   * Self-recovery path for post-eviction boots.
   *
   * Replicates the asset-fetching logic from the Worker's `/init` path so the
   * DO can rebuild `this.cachedAssets` without a round-trip through the Worker.
   *
   * BIOS files are fetched from the ASSETS binding (same origin, no 403 risk
   * here because we're inside a WS message handler, not an upgrade handler).
   * Disk images with a public `url` are fetched from the CDN directly.
   * Inline-only images (aqeous, which has no `url`) cannot be self-recovered;
   * those get a descriptive error so the client can reload the page.
   */
  private async selfLoadAssets(imageKey: string): Promise<void> {
    const imageDef = IMAGES[imageKey] ?? IMAGES.kolibri;
    const resolvedKey = IMAGES[imageKey] ? imageKey : "kolibri";

    // ── Fetch BIOS files ───────────────────────────────────────────────
    // ASSETS.fetch() works inside WS message handlers (not upgrade handlers).
    const env = this.env as Env;
    // Use the captured worker origin so ASSETS.fetch() gets a real URL.
    // Falls back to a dummy base if origin wasn't captured yet (shouldn't happen).
    const base = this.workerOrigin ?? "https://do86.workers.dev";

    const fetchAsset = async (path: string): Promise<ArrayBuffer> => {
      const resp = await env.ASSETS.fetch(new URL(path, base).toString());
      if (!resp.ok) throw new Error(`ASSETS ${path}: ${resp.status}`);
      return resp.arrayBuffer();
    };

    const [bios, vgaBios] = await Promise.all([
      fetchAsset("/assets/seabios.bin"),
      fetchAsset("/assets/vgabios.bin"),
    ]);

    // ── Resolve disk image ─────────────────────────────────────────────
    const assets: Map<string, ArrayBuffer> = new Map();
    assets.set("bios", bios);
    assets.set("vgaBios", vgaBios);

    // Check SQLite image cache first — avoids re-downloading on every eviction
    this.ensureStorage();
    const cacheName = imageDef.file || resolvedKey;
    let disk: ArrayBuffer | null = null;

    if (this.imageCache!.images.has(cacheName)) {
      console.log(`${LOG_PREFIX} Self-recovery: cache hit for ${cacheName}`);
      disk = this.imageCache!.images.get(cacheName) ?? null;
    }

    if (!disk) {
      if (!imageDef.url) {
        console.log(`${LOG_PREFIX} Self-recovery: fetching ${cacheName} from ASSETS`);
        this.broadcast(encodeStatus(`downloading: ${imageDef.label}`));
        disk = await fetchAsset(`/assets/${imageDef.file}`);
      } else {
        console.log(`${LOG_PREFIX} Self-recovery: fetching ${cacheName} from ${imageDef.url}`);
        this.broadcast(encodeStatus(`downloading: ${imageDef.label}`));
        const resp = await this.cachedFetch(imageDef.url);
        if (!resp.ok) {
          throw new Error(`Disk fetch ${imageDef.url}: ${resp.status} ${resp.statusText}`);
        }
        disk = await resp.arrayBuffer();
        const etag = resp.headers.get("etag") ?? undefined;
        console.log(
          `${LOG_PREFIX} Self-recovery: downloaded ${cacheName} ` +
          `(${(disk.byteLength / 1024 / 1024).toFixed(1)} MB)`,
        );

        try {
          this.imageCache!.images.put(cacheName, disk, { etag, fetchedAt: new Date().toISOString() });
        } catch (e) {
          console.error(`${LOG_PREFIX} Self-recovery: cache write failed (non-fatal):`, e);
        }
      }
    }

    // ── Build metadata (same shape the Worker POSTs in /init) ──────────
    const meta: Record<string, unknown> = {
      imageKey: resolvedKey,
      drive: imageDef.drive,
      memory: imageDef.memory,
      vgaMemory: imageDef.vgaMemory,
      label: imageDef.label,
      noSnapshot: imageDef.noSnapshot ?? false,
      ...(imageDef.ahciDiskSize ? { ahciDiskSize: imageDef.ahciDiskSize } : {}),
      ...(imageDef.logicalMemory ? { logicalMemory: imageDef.logicalMemory } : {}),
      // disk was resolved above, no need for diskUrl — pass it inline
    };
    assets.set("disk", disk);
    assets.set("metadata", new TextEncoder().encode(JSON.stringify(meta)).buffer as ArrayBuffer);

    this.cachedAssets = assets;
    this.imageKey = resolvedKey;
    console.log(`${LOG_PREFIX} Self-recovery complete for ${resolvedKey} — ${assets.size} assets loaded`);
  }

  /**
   * Fetch a disk image URL with Cache API (caches.default) wrapping.
   * On cache hit, returns the cached response directly (CDN edge cache).
   * On miss, fetches from origin, caches the response, returns the body.
   */
  private async cachedFetch(url: string): Promise<Response> {
    // Cache API uses Request objects; normalize URL to HTTPS for cache key consistency
    const cacheKey = new Request(url.replace(/^http:\/\//, "https://"), { redirect: "follow" });
    try {
      const cache = (caches as any).default;
      if (cache) {
        const cached = await cache.match(cacheKey);
        if (cached) {
          console.log(`${LOG_PREFIX} Cache API hit for ${url}`);
          return cached;
        }
      }
    } catch (e) {
      // Cache API may not be available in all environments — fall through
      console.warn(`${LOG_PREFIX} Cache API match failed (non-fatal):`, e);
    }

    const resp = await fetch(url, { redirect: "follow" });
    if (!resp.ok) return resp;

    // Clone before reading body — put the clone in cache, return the original
    try {
      const cache = (caches as any).default;
      if (cache) {
        // Only cache successful responses with a body
        const cloned = resp.clone();
        // Set cache-control if origin didn't provide one (disk images rarely change)
        const headers = new Headers(cloned.headers);
        if (!headers.has("cache-control")) {
          headers.set("cache-control", "public, max-age=604800"); // 7 days
        }
        const cacheResp = new Response(cloned.body, {
          status: cloned.status,
          statusText: cloned.statusText,
          headers,
        });
        await cache.put(cacheKey, cacheResp);
        console.log(`${LOG_PREFIX} Cache API stored ${url}`);
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Cache API put failed (non-fatal):`, e);
    }

    return resp;
  }

  /** Initialize SQLite storage + image cache (idempotent) */
  private ensureStorage(): void {
    if (!this.storage) {
      this.storage = new SqliteStorage(this.ctx.storage.sql as any);
      this.storage.init();
    }
    if (!this.imageCache) {
      this.imageCache = new SqliteImageCache(this.storage);
    }
  }

  /** Safe WebSocket send — swallows errors from disconnected clients */
  private wsSend(ws: WebSocket, data: ArrayBuffer | string): void {
    try { ws.send(data); }
    catch { /* client disconnected */ }
  }

  private broadcast(data: ArrayBuffer | string): void {
    const dead: WebSocket[] = [];
    for (const ws of this.sessions.keys()) {
      try { ws.send(data); }
      catch { dead.push(ws); /* client disconnected */ }
    }
    for (const ws of dead) this.sessions.delete(ws);
  }
}
