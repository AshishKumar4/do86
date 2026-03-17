import { DurableObject } from "cloudflare:workers";
import type { V86 as V86Type } from "v86";
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
import { DeltaEncoder, encodeSerialData, encodeStatus, encodeTextScreen } from "./delta-encoder";
import { SqliteStorage, SqliteImageCache, SQLiteBlockDevice, unpackAssets } from "./sqlite-storage";

// ── LinuxVM Durable Object ──────────────────────────────────────────────────

export class LinuxVM extends DurableObject<unknown> {
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

  // ── Storage state ───────────────────────────────────────────────────────
  private storage: SqliteStorage | null = null;
  private imageCache: SqliteImageCache | null = null;
  private swapDevice: SQLiteBlockDevice | null = null;

  // ── Snapshot state ──────────────────────────────────────────────────────
  private snapshotSaved = false;
  private snapshotTimer: ReturnType<typeof setTimeout> | null = null;
  private restoredFromSnapshot = false;

  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);

    // Restore sessions from hibernation
    for (const ws of this.ctx.getWebSockets()) {
      const tag = ws.deserializeAttachment() as string | null;
      if (tag) {
        this.sessions.set(ws, { needsKeyframe: true, droppedFrames: 0, lastSendTime: 0 });
      }
    }

    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  // ── HTTP handler ────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status" && request.method === "GET") {
      return Response.json({ running: this.booted || this.booting });
    }

    if (url.pathname === "/reboot" && request.method === "POST") {
      console.log(`${LOG_PREFIX} Reboot requested — stopping emulator`);
      if (this.renderInterval) { clearInterval(this.renderInterval); this.renderInterval = null; }
      if (this.emulator) {
        try { (this.emulator as any).stop?.(); } catch { /* ok */ }
        try { (this.emulator as any).destroy?.(); } catch { /* ok */ }
      }
      this.emulator = null;
      this.booted = false;
      this.booting = false;
      this.bootError = null;
      this.snapshotSaved = false;
      this.cachedAssets = null;
      this.broadcast(encodeStatus("rebooting"));
      return Response.json({ status: "rebooted" });
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

    // WebSocket upgrade
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server);

    const sessionId = crypto.randomUUID();
    server.serializeAttachment(sessionId);
    this.sessions.set(server, { needsKeyframe: true, droppedFrames: 0, lastSendTime: 0 });

    this.wsSend(server, encodeStatus("connected"));

    if (this.bootError) {
      this.wsSend(server, encodeStatus("error: " + this.bootError));
    } else if (!this.booting && !this.booted) {
      if (this.cachedAssets) {
        this.bootVM().catch((err) => {
          this.bootError = String(err);
          this.broadcast(encodeStatus("error: " + String(err)));
        });
      } else {
        this.wsSend(server, encodeStatus("waiting_for_assets"));
      }
    } else if (this.booted) {
      this.wsSend(server, encodeStatus("running"));
      this.sendCurrentFrame(server);
      this.startRenderLoop();
    } else {
      this.wsSend(server, encodeStatus("booting"));
    }

    return new Response(null, { status: 101, webSocket: client });
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

      let imageKey = "kolibri", drive: "fda" | "cdrom" = "cdrom";
      let memorySizeMB = 32, vgaMemoryMB = 2, label = "Linux";
      let diskUrl: string | null = null;
      let diskFile: string | null = null;

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
        } catch (e) {
          console.error(`${LOG_PREFIX} Failed to parse boot metadata:`, e);
        }
      }
      this.imageKey = imageKey;

      // Always initialize storage early (needed for snapshots and image cache)
      this.ensureStorage();

      // ── Handle fresh boot request (clear cached snapshot) ──────────────
      const metaForFresh = metadataRaw ? JSON.parse(new TextDecoder().decode(metadataRaw)) : {};
      if (metaForFresh.fresh && this.imageCache!.states.has(imageKey)) {
        console.log(`${LOG_PREFIX} Fresh boot requested — clearing snapshot for ${imageKey}`);
        this.imageCache!.states.delete(imageKey);
        this.snapshotSaved = false;
      }

      // ── Check for existing state snapshot ─────────────────────────────
      let savedState: ArrayBuffer | null = null;
      if (this.imageCache!.states.has(imageKey)) {
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
          const resp = await fetch(diskUrl, { redirect: "follow" });
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

      const { V86 } = await import("v86");

      // Monkey-patch microtick for Workers environment where performance.now() is coarsened
      // to only return the time of the last I/O. The WASM main_loop calls microtick() repeatedly
      // to check if TIME_PER_FRAME (1ms) has elapsed — but since no I/O happens during synchronous
      // WASM execution, performance.now() never advances and the loop spins forever, exhausting cpu_ms.
      //
      // Hybrid approach: advance synthetically during synchronous WASM execution (~50 calls per frame
      // at 0.02ms increment = 1ms), but sync to real time whenever I/O causes it to advance.
      // The PIT/guest OS timer is driven by cycle count, not wall clock, so synthetic time is fine.
      let syntheticTime = performance.now();
      let lastRealTime = syntheticTime;
      const MICROTICK_INCREMENT = 0.02; // 20μs per call — ~50 calls to hit 1ms TIME_PER_FRAME
      (V86 as any).microtick = () => {
        const realNow = performance.now();
        if (realNow > lastRealTime) {
          // I/O happened — real time advanced. Sync up.
          syntheticTime = realNow;
          lastRealTime = realNow;
        } else {
          // Still in synchronous WASM execution — advance synthetically
          syntheticTime += MICROTICK_INCREMENT;
        }
        return syntheticTime;
      };

      const v86Config: Record<string, any> = {
        wasm_fn: async (importObj: any) => {
          const instance = await WebAssembly.instantiate(v86WasmModule, importObj);
          return instance.exports;
        },
        disable_jit: false,
        bios: { buffer: bios },
        vga_bios: { buffer: vgaBios },
        memory_size: memorySizeMB * 1024 * 1024,
        vga_memory_size: vgaMemoryMB * 1024 * 1024,
        autostart: false,
        disable_speaker: true,
        fastboot: true,
        acpi: true,
        boot_order: drive === "cdrom" ? BOOT_ORDER_CDROM_FIRST : BOOT_ORDER_HDA_FIRST,
      };

      if (drive === "fda") v86Config.fda = { buffer: disk };
      else v86Config.cdrom = { buffer: disk };
      disk = null; // Allow GC of the 50MB+ buffer

      if (this.swapDevice && needsSwap) v86Config.hda = this.swapDevice;

      // Instant boot: pass saved state to v86
      if (savedState) {
        v86Config.initial_state = { buffer: savedState };
      }

      this.emulator = new V86(v86Config);

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
          clearTimeout(timeout);
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
          }
          this.emulator!.run();
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
      this.restoredFromSnapshot = !!savedState;
      this.cachedAssets = null;
      this.startRenderLoop();

      if (savedState) {
        console.log(`${LOG_PREFIX} Restored from snapshot: ${label}`);
        this.broadcast(encodeStatus(`running: ${label}`));
      } else {
        console.log(`${LOG_PREFIX} Boot complete: ${label}`);
        this.broadcast(encodeStatus(`running: ${label}`));

        // Schedule snapshot save after boot stabilizes
        const delayMs = imageKey === "kolibri" ? SNAPSHOT_DELAY_FAST_MS : SNAPSHOT_DELAY_SLOW_MS;
        this.scheduleSnapshot(label, delayMs);
      }
    } catch (err) {
      this.bootError = String(err);
      this.cachedAssets = null;
      console.error(`${LOG_PREFIX} Boot failed:`, err);
      throw err;
    } finally {
      this.booting = false;
    }
  }

  // ── Snapshot management ───────────────────────────────────────────────

  private async saveSnapshot(label: string): Promise<void> {
    if (this.snapshotSaved || !this.emulator || !this.imageCache || !this.imageKey) return;

    const vga = this.getVga();
    if (!vga?.graphical_mode) {
      console.log(`${LOG_PREFIX} Snapshot skipped — not in graphical mode yet`);
      return;
    }

    if (this.imageCache.states.has(this.imageKey)) {
      this.snapshotSaved = true;
      console.log(`${LOG_PREFIX} Snapshot already exists for ${this.imageKey}`);
      return;
    }

    try {
      this.broadcast(encodeStatus("saving snapshot..."));
      console.log(`${LOG_PREFIX} Saving state snapshot for ${label}...`);
      const state = await this.emulator.save_state();
      this.imageCache.states.put(this.imageKey, state);
      this.snapshotSaved = true;
      console.log(`${LOG_PREFIX} State snapshot saved for ${label} (${(state.byteLength / 1024 / 1024).toFixed(1)}MB)`);
      this.broadcast(encodeStatus(`running: ${label}`));
    } catch (err) {
      console.error(`${LOG_PREFIX} Failed to save snapshot:`, err);
      this.broadcast(encodeStatus(`running: ${label}`));
    }
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
    if (this.renderInterval) clearInterval(this.renderInterval);
    this.renderInterval = null;
    this.startRenderLoop();
  }

  private startRenderLoop(): void {
    if (this.renderInterval) return;
    this.renderInterval = setInterval(() => {
      try { this.renderFrame(); }
      catch (e) { console.error(`${LOG_PREFIX} Render frame error:`, e); }
    }, Math.round(1000 / this.currentFPS));
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
    if (!cpu?.wasm_memory?.buffer) return null;

    const width = vga.screen_width;
    const height = vga.screen_height;
    if (!width || !height || width * height > MAX_RESOLUTION) return null;

    const bufferWidth = vga.virtual_width || width;
    const offset = vga.dest_buffet_offset;
    if (offset == null) return null;

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

    // Mark entire screen dirty so screen_fill_buffer processes all pixels
    vga.complete_redraw();
    vga.screen_fill_buffer();

    const byteLen = bufferWidth * height * 4;
    if (offset + byteLen > wasmBuf.byteLength) return null;
    const rgba = new Uint8ClampedArray(wasmBuf, offset, byteLen);

    return { rgba, width, height, bufferWidth };
  }

  // ── Render loop ───────────────────────────────────────────────────────

   private _renderCount = 0;
   private renderFrame(): void {
    this._renderCount++;
    if (this._renderCount % 50 === 0) {
      const sa = this.screenAdapter;
      const preview = sa ? sa.getTextScreen().filter(r => r.trim()).slice(0, 3).join(" | ") : "(no adapter)";
      console.log(`${LOG_PREFIX} renderFrame #${this._renderCount} sessions=${this.sessions.size} preview="${preview.substring(0,120)}"`);
    }
    if (!this.emulator || !this.screenAdapter || this.sessions.size === 0) return;

    const vga = this.getVga();
    if (!vga) return;

    if (vga.graphical_mode) {
      const frame = this.getVgaPixels(vga);
      if (!frame) return;

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
      if (!result) return;

      this.adjustFrameRate(result.data.byteLength);
      this.sendFrameToClients(result, frame);
    } else {
      const textRows = this.screenAdapter.getTextScreen();
      if (textRows.length === 0) return;

      const textContent = textRows.join("\n");
      if (textContent === this.lastTextContent) return;
      this.lastTextContent = textContent;

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
      if (state.lastSendTime > 0 && now - state.lastSendTime < 20) {
        state.droppedFrames++;
        this.framesSkippedBackpressure++;
        if (state.droppedFrames > 5) state.needsKeyframe = true;
        continue;
      }

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
      if (!this.emulator || message instanceof ArrayBuffer) return;

      let msg: ClientMessage;
      try { msg = JSON.parse(message); }
      catch { return; /* ignore malformed JSON */ }

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
        case "serial":
          this.emulator.serial0_send?.(msg.data);
          break;
      }
    } catch {
      // Never throw from WS handler — would crash the DO
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
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
