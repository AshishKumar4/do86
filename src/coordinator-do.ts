/**
 * coordinator-do.ts — CoordinatorDO: The hub of distributed SMP.
 *
 * One CoordinatorDO per VM session. It:
 * - Accepts browser WebSocket connections (screen, keyboard, mouse)
 * - Manages per-core CpuCoreDO instances via RPC
 * - Holds the canonical page directory for memory coherence
 * - Routes inter-processor interrupts between cores via APIC emulation
 * - Hosts the IOAPIC for external interrupt routing
 * - Forwards BSP screen frames to browser clients
 *
 * Backend-agnostic: the coordinator communicates with cores via a typed RPC
 * interface (CoreStubRPC). Currently backed by v86-based CpuCoreDO; a future
 * QEMU backend (QemuCpuCoreDO) implements the same interface.
 */

import { DurableObject } from "cloudflare:workers";
import {
  type ClientState,
  FPS_DEFAULT,
  LOG_PREFIX,
} from "./types";
import { DeltaEncoder, encodeSerialData, encodeStatus, encodeTextScreen } from "./delta-encoder";
import { PageDirectory } from "./memory-coherence";
import { IPIRouter, IOAPIC, DeliveryMode, type IPIMessage } from "./ipi-handler";
import { unpackAssets } from "./sqlite-storage";

// ── Env ──────────────────────────────────────────────────────────────────────

export interface CoordinatorEnv {
  COORDINATOR: DurableObjectNamespace;
  CPU_CORE: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
}

// ── Core RPC stub interface ─────────────────────────────────────────────────
// Typed interface for RPC calls to CpuCoreDO. The actual stub is untyped
// (DurableObjectStub), but these methods match the CpuCoreDO class.

interface CoreStubRPC {
  init(config: {
    apicId: number;
    isBSP: boolean;
    memorySizeBytes: number;
    vgaMemorySizeBytes: number;
    bios?: ArrayBuffer;
    vgaBios?: ArrayBuffer;
    disk?: ArrayBuffer;
    diskDrive?: "fda" | "cdrom";
  }, coordinatorId: string): Promise<{ status: string }>;
  start(): Promise<void>;
  stop(): Promise<void>;
  initReset(): Promise<void>;
  startupIPI(vector: number, memoryConfig: {
    memorySizeBytes: number;
    vgaMemorySizeBytes: number;
    bios: ArrayBuffer;
    vgaBios: ArrayBuffer;
  }, trampolinePages: Map<number, ArrayBuffer>): Promise<void>;
  injectInterrupt(ipi: IPIMessage): Promise<void>;
  invalidatePage(physAddr: number): Promise<void>;
  writeback(physAddr: number): Promise<ArrayBuffer>;
  readPages(startAddr: number, numPages: number): Promise<Array<[number, ArrayBuffer]>>;
  getScreenFrame(): Promise<ArrayBuffer | null>;
  getTextScreen(): Promise<{ cols: number; rows: number; lines: string[] } | null>;
  isGraphicalMode(): Promise<boolean>;
  flushSerial(): Promise<string | null>;
  sendKeyCode(code: number, isUp: boolean): Promise<void>;
  sendMouseDelta(dx: number, dy: number): Promise<void>;
  sendMouseClick(buttons: [boolean, boolean, boolean]): Promise<void>;
  sendText(data: string): Promise<void>;
  sendScancodes(codes: number[]): Promise<void>;
  getStatus(): Promise<{
    apicId: number;
    state: string;
    isBSP: boolean;
    pageStats: Record<string, number> | null;
    ramStats?: Record<string, number> | null;
    cpuHalted?: boolean;
  }>;
}

/** Cast a DurableObjectStub to the typed RPC interface. */
function coreRPC(stub: DurableObjectStub): CoreStubRPC {
  return stub as unknown as CoreStubRPC;
}

// ── CoordinatorDO ────────────────────────────────────────────────────────────

export class CoordinatorDO extends DurableObject<CoordinatorEnv> {
  // ── VM identity ────────────────────────────────────────────────────────
  private vmId: string = "";
  private numCores: number = 2; // Default: 2 cores (BSP + 1 AP)

  // ── Core management ────────────────────────────────────────────────────
  private coreStubs = new Map<number, DurableObjectStub>();
  private coreLocation: string = "enam"; // Default: Eastern North America

  // ── Memory coherence ──────────────────────────────────────────────────
  private pageDir: PageDirectory | null = null;

  // ── IPI routing ────────────────────────────────────────────────────────
  private ipiRouter: IPIRouter | null = null;
  private ioapic: IOAPIC | null = null;

  // ── Browser sessions ──────────────────────────────────────────────────
  private sessions = new Map<WebSocket, ClientState>();
  private mouseButtons: [boolean, boolean, boolean] = [false, false, false];

  // ── Rendering ─────────────────────────────────────────────────────────
  private renderInterval: ReturnType<typeof setInterval> | null = null;
  private deltaEncoder = new DeltaEncoder();
  private currentFPS = FPS_DEFAULT;
  private lastTextContent = "";
  private _renderCount = 0;

  // ── Boot state ────────────────────────────────────────────────────────
  private booting = false;
  private booted = false;
  private bootError: string | null = null;
  private cachedAssets: Map<string, ArrayBuffer> | null = null;

  // ── Memory config (needed for AP core creation after boot) ──────────
  private memorySizeBytes: number = 0;
  private vgaMemorySizeBytes: number = 0;

  // ── BIOS blobs (cached for AP creation — v86 cores need them) ──────
  private biosBlob: ArrayBuffer | null = null;
  private vgaBiosBlob: ArrayBuffer | null = null;

  constructor(ctx: DurableObjectState, env: CoordinatorEnv) {
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

  // ── HTTP handler ──────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/status" && request.method === "GET") {
      return Response.json({
        running: this.booted || this.booting,
        numCores: this.numCores,
        cores: await this.getCoreStatuses(),
        pageStats: this.pageDir?.stats ?? null,
        ipiStats: this.ipiRouter?.stats ?? null,
      });
    }

    if (url.pathname === "/init" && request.method === "POST") {
      if (this.booted || this.booting) {
        return Response.json({ status: "already_running" });
      }
      try {
        const packed = await request.arrayBuffer();
        this.cachedAssets = unpackAssets(packed);
        return Response.json({ status: "assets_loaded", count: this.cachedAssets.size });
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
    this.broadcast(encodeStatus("booting: distributed SMP (v86)"));

    try {
      // Parse metadata
      let memorySizeMB = 32;
      let vgaMemoryMB = 8;
      let diskDrive: "fda" | "cdrom" = "cdrom";
      let diskUrl: string | null = null;
      let diskFile: string | null = null;
      const metadataRaw = this.cachedAssets.get("metadata");
      if (metadataRaw) {
        const meta = JSON.parse(new TextDecoder().decode(metadataRaw));
        memorySizeMB = meta.memory || memorySizeMB;
        vgaMemoryMB = meta.vgaMemory || vgaMemoryMB;
        diskDrive = meta.drive || diskDrive;
        this.vmId = meta.imageKey || "unknown";
        this.numCores = meta.numCores || 1;
        diskUrl = meta.diskUrl || null;
        diskFile = meta.diskFile || null;
      }

      // Extract BIOS blobs (v86 cores need them for emulator creation)
      const bios = this.cachedAssets.get("bios");
      const vgaBios = this.cachedAssets.get("vgaBios");
      if (!bios || !vgaBios) throw new Error("BIOS blobs missing from asset pack");
      this.biosBlob = bios;
      this.vgaBiosBlob = vgaBios;

      // Resolve disk image — may need to be fetched from URL
      let disk = this.cachedAssets.get("disk") || null;
      if (!disk && diskUrl) {
        console.log(`${LOG_PREFIX} Fetching disk from ${diskUrl}`);
        this.broadcast(encodeStatus("downloading disk image..."));
        const resp = await fetch(diskUrl, { redirect: "follow" });
        if (!resp.ok) throw new Error(`Failed to fetch ${diskUrl}: ${resp.status}`);
        disk = await resp.arrayBuffer();
        console.log(`${LOG_PREFIX} Downloaded disk: ${(disk.byteLength / 1024 / 1024).toFixed(1)}MB`);
      }
      if (!disk) throw new Error("No disk image: not provided inline and no URL configured");

      // Cache memory config for AP creation later
      const memoryBytes = memorySizeMB * 1024 * 1024;
      const vgaMemoryBytes = vgaMemoryMB * 1024 * 1024;
      this.memorySizeBytes = memoryBytes;
      this.vgaMemorySizeBytes = vgaMemoryBytes;

      // Initialize memory coherence
      this.pageDir = new PageDirectory(memoryBytes);

      // Initialize IPI routing
      this.ipiRouter = new IPIRouter(async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      // ── INIT callback: create AP core DO ────────────────────────────
      this.ipiRouter.onCoreCreate = async (apicId) => {
        await this.createCore(apicId, false);
        // Initialize the AP core — waits for SIPI before creating its emulator.
        const stub = this.coreStubs.get(apicId);
        if (stub) {
          const coordId = this.ctx.id.toString();
          await coreRPC(stub).init(
            {
              apicId,
              isBSP: false,
              memorySizeBytes: this.memorySizeBytes,
              vgaMemorySizeBytes: this.vgaMemorySizeBytes,
            },
            coordId,
          );
        }
      };

      // ── SIPI callback: copy trampoline pages from BSP, start AP ─────
      // The AP's v86 instance boots from BIOS, gets stopped, then has its
      // memory patched with trampoline pages and registers set to 16-bit
      // real mode at CS:IP = vector:0000. Then execution resumes.
      this.ipiRouter.onCoreSIPI = async (apicId, vector) => {
        const stub = this.coreStubs.get(apicId);
        if (!stub) return;

        // Fetch trampoline pages from BSP's WASM linear memory
        const bsp = this.coreStubs.get(0);
        const trampolinePages = new Map<number, ArrayBuffer>();

        if (bsp) {
          const baseAddr = vector * 0x1000;
          // Fetch low memory (0x0000-0x20000) — covers IVT, BDA, trampoline
          const lowMemPages = 32; // 32 pages = 128KB
          const pages = await coreRPC(bsp).readPages(0, lowMemPages);
          for (const [addr, data] of pages) {
            trampolinePages.set(addr, data);
          }

          // Also grab pages around the SIPI vector if above 128KB
          if (baseAddr >= lowMemPages * 4096) {
            const extraStart = Math.max(0, baseAddr - 4096);
            const extraPages = 8;
            const extra = await coreRPC(bsp).readPages(extraStart, extraPages);
            for (const [addr, data] of extra) {
              trampolinePages.set(addr, data);
            }
          }

          console.log(
            `${LOG_PREFIX} Fetched ${trampolinePages.size} pages from BSP for AP ${apicId} ` +
            `(SIPI vector=0x${vector.toString(16)}, addr=0x${baseAddr.toString(16)})`,
          );
        }

        // Deliver SIPI to the AP core with BIOS blobs + trampoline pages
        await coreRPC(stub).startupIPI(vector, {
          memorySizeBytes: this.memorySizeBytes,
          vgaMemorySizeBytes: this.vgaMemorySizeBytes,
          bios: this.biosBlob!,
          vgaBios: this.vgaBiosBlob!,
        }, trampolinePages);
      };

      // Initialize IOAPIC (24 entries, routes to cores)
      this.ioapic = new IOAPIC(24, async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      // All pages start owned by BSP (Core 0)
      this.pageDir.assignAllToCore(0);

      // Create and boot BSP (Core 0)
      console.log(`${LOG_PREFIX} Creating BSP (Core 0) with v86`);
      await this.createCore(0, true);

      // Initialize BSP with boot config (BIOS + disk)
      const bspStub = this.coreStubs.get(0);
      if (!bspStub) throw new Error("Failed to create BSP");

      const coordId = this.ctx.id.toString();
      await coreRPC(bspStub).init(
        {
          apicId: 0,
          isBSP: true,
          memorySizeBytes: memoryBytes,
          vgaMemorySizeBytes: vgaMemoryBytes,
          bios: bios,
          vgaBios: vgaBios,
          disk: disk,
          diskDrive: diskDrive,
        },
        coordId,
      );

      // Start BSP execution
      await coreRPC(bspStub).start();
      this.ipiRouter.registerCore(0);

      // Free cached assets (BIOS blobs kept in biosBlob/vgaBiosBlob for AP creation)
      this.cachedAssets = null;

      this.booted = true;
      this.booting = false;
      this.broadcast(encodeStatus(`running: distributed SMP v86 (${this.numCores} cores)`));
      this.startRenderLoop();

      console.log(
        `${LOG_PREFIX} Distributed SMP VM booted (v86): ${this.vmId} ` +
        `(${this.numCores} cores, ${memorySizeMB}MB RAM)`,
      );
    } catch (err) {
      this.bootError = String(err);
      this.booting = false;
      this.cachedAssets = null;
      console.error(`${LOG_PREFIX} Boot failed:`, err);
      throw err;
    }
  }

  // ── Core management ───────────────────────────────────────────────────

  private async createCore(apicId: number, _isBSP: boolean): Promise<void> {
    const name = `vm-${this.vmId}-core-${apicId}`;
    const id = this.env.CPU_CORE.idFromName(name);
    const stub = this.env.CPU_CORE.get(id, {
      locationHint: this.coreLocation as DurableObjectLocationHint,
    });
    this.coreStubs.set(apicId, stub);
    console.log(`${LOG_PREFIX} Created core DO: ${name} (APIC ID ${apicId})`);
  }

  private async getCoreStatuses(): Promise<Array<{
    apicId: number;
    state: string;
    isBSP: boolean;
    pageStats: Record<string, number> | null;
    ramStats?: Record<string, number> | null;
    cpuHalted?: boolean;
  } | { apicId: number; state: string; error: string }>> {
    const statuses: Array<{
      apicId: number;
      state: string;
      isBSP: boolean;
      pageStats: Record<string, number> | null;
      ramStats?: Record<string, number> | null;
      cpuHalted?: boolean;
    } | { apicId: number; state: string; error: string }> = [];
    for (const [apicId, stub] of this.coreStubs) {
      try {
        const status = await coreRPC(stub).getStatus();
        statuses.push(status);
      } catch (e) {
        statuses.push({ apicId, state: "error", error: String(e) });
      }
    }
    return statuses;
  }

  // ── IPI delivery ────────────────────────────────────────────────────
  // Cores call routeIPI() via RPC when the guest writes to LAPIC ICR.
  // The coordinator routes the IPI to the target core(s).

  /**
   * Called by cores via RPC when the guest writes to LAPIC ICR.
   * Routes the IPI to the target core based on destination and mode.
   */
  async routeIPI(ipi: IPIMessage): Promise<void> {
    if (!this.ipiRouter) return;
    await this.ipiRouter.route(ipi);
  }

  /**
   * Deliver an IPI to a target core.
   *
   * For FIXED/LOWEST_PRIORITY: calls injectInterrupt (writes to APIC IRR)
   * For INIT: calls initReset (halts the core, waits for SIPI)
   * For SIPI: handled by IPIRouter.onCoreSIPI → startupIPI
   */
  private async deliverIPIToCore(targetApicId: number, ipi: IPIMessage): Promise<void> {
    const stub = this.coreStubs.get(targetApicId);
    if (!stub) {
      console.log(`${LOG_PREFIX} IPI to unknown core ${targetApicId} — dropped`);
      return;
    }

    try {
      // INIT IPI: halt the core, wait for SIPI
      if (ipi.mode === DeliveryMode.INIT) {
        await coreRPC(stub).initReset();
        return;
      }

      // Standard IPI: inject into target core's LAPIC
      await coreRPC(stub).injectInterrupt(ipi);
    } catch (e) {
      console.error(`${LOG_PREFIX} IPI delivery to core ${targetApicId} failed:`, e);
    }
  }

  // ── Memory coherence RPCs (called by cores) ───────────────────────────

  /**
   * Core requests a page it doesn't have.
   */
  async fetchPage(physAddr: number, requestingCore: number): Promise<ArrayBuffer | null> {
    if (!this.pageDir) return null;

    const result = this.pageDir.fetchPage(physAddr, requestingCore);

    if (result.needsWritebackFrom !== null) {
      // Need to get the dirty page from the owning core first
      const ownerStub = this.coreStubs.get(result.needsWritebackFrom);
      if (ownerStub) {
        const dirtyData = await coreRPC(ownerStub).writeback(physAddr);
        this.pageDir.acceptWriteback(physAddr, result.needsWritebackFrom, dirtyData);
        // Now retry the fetch
        const retryResult = this.pageDir.fetchPage(physAddr, requestingCore);
        return retryResult.data;
      }
    }

    return result.data;
  }

  /**
   * Core wants to upgrade a SHARED page to WRITABLE.
   */
  async upgradePage(physAddr: number, requestingCore: number): Promise<void> {
    if (!this.pageDir) return;

    const { coresToInvalidate } = this.pageDir.upgradePage(physAddr, requestingCore);

    // Invalidate all other sharers in parallel
    await Promise.all(
      coresToInvalidate.map(async (coreId) => {
        const stub = this.coreStubs.get(coreId);
        if (stub) {
          try {
            await coreRPC(stub).invalidatePage(physAddr);
          } catch (e) {
            console.error(`${LOG_PREFIX} Invalidation to core ${coreId} failed:`, e);
          }
        }
      }),
    );
  }

  /**
   * Core writes back a dirty page.
   */
  async writebackPage(
    physAddr: number,
    fromCore: number,
    data: ArrayBuffer,
  ): Promise<void> {
    if (!this.pageDir) return;
    this.pageDir.acceptWriteback(physAddr, fromCore, data);
  }

  // ── Render loop (fetches frames from BSP core via RPC) ─────────────

  private startRenderLoop(): void {
    if (this.renderInterval) return;
    this.renderInterval = setInterval(() => {
      this.renderFrame().catch((e) => {
        console.error(`${LOG_PREFIX} Render error:`, e);
      });
    }, Math.round(1000 / this.currentFPS));
  }

  private async renderFrame(): Promise<void> {
    this._renderCount++;
    if (this.sessions.size === 0) return;

    const bsp = this.coreStubs.get(0);
    if (!bsp) return;

    try {
      // Drain serial output from BSP
      const serialData = await coreRPC(bsp).flushSerial();
      if (serialData) {
        this.broadcast(encodeSerialData(serialData));
      }

      // Check mode and render accordingly
      const graphical = await coreRPC(bsp).isGraphicalMode();

      if (graphical) {
        await this.renderGraphicalFrame(bsp);
      } else {
        await this.renderTextFrame(bsp);
      }
    } catch {
      // RPC failed — BSP might be busy, skip this frame
    }
  }

  /**
   * Render a graphical frame from the BSP's display.
   * Frame format: [width:u32, height:u32, bufferWidth:u32, rgba...]
   */
  private async renderGraphicalFrame(bsp: DurableObjectStub): Promise<void> {
    const frameData = await coreRPC(bsp).getScreenFrame();
    if (!frameData) return;

    const view = new DataView(frameData);
    const width = view.getUint32(0, true);
    const height = view.getUint32(4, true);
    const bufferWidth = view.getUint32(8, true);
    const rgba = new Uint8ClampedArray(frameData, 12);

    let anyNeedsKeyframe = false;
    for (const state of this.sessions.values()) {
      if (state.needsKeyframe) { anyNeedsKeyframe = true; break; }
    }

    const result = this.deltaEncoder.encode(
      width, height, bufferWidth, rgba, anyNeedsKeyframe,
    );
    if (!result) return;

    const now = Date.now();
    const dead: WebSocket[] = [];
    for (const [ws, state] of this.sessions.entries()) {
      let data = result.data;
      // Send keyframe to clients that need it
      if (state.needsKeyframe && result.isDelta) {
        try {
          const keyframe = this.deltaEncoder.encode(width, height, bufferWidth, rgba, true);
          if (keyframe) data = keyframe.data;
        } catch { /* use delta */ }
      }
      try {
        ws.send(data);
        state.lastSendTime = now;
        state.droppedFrames = 0;
        state.needsKeyframe = false;
      } catch {
        dead.push(ws);
      }
    }
    for (const ws of dead) this.sessions.delete(ws);
  }

  /**
   * Render text mode content from BSP.
   */
  private async renderTextFrame(bsp: DurableObjectStub): Promise<void> {
    const textData = await coreRPC(bsp).getTextScreen();
    if (!textData) return;

    const textContent = textData.lines.join("\n");
    if (textContent === this.lastTextContent && this._renderCount > 30) return;
    this.lastTextContent = textContent;

    this.broadcast(encodeTextScreen(textData.cols, textData.rows, textData.lines));
  }

  // ── WebSocket handlers ────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      if (message instanceof ArrayBuffer) return;

      let msg: Record<string, unknown>;
      try { msg = JSON.parse(message); }
      catch { return; }

      // Forward all input to BSP (Core 0)
      const bsp = this.coreStubs.get(0);
      if (!bsp) return;

      switch (msg.type) {
        case "keydown": {
          const code = msg.code as number;
          await coreRPC(bsp).sendKeyCode(code, false);
          break;
        }
        case "keyup": {
          const code = msg.code as number;
          await coreRPC(bsp).sendKeyCode(code, true);
          break;
        }
        case "mousemove":
          await coreRPC(bsp).sendMouseDelta(msg.dx as number, msg.dy as number);
          break;
        case "mousedown":
        case "mouseup": {
          const idx = msg.button === 1 ? 1 : msg.button === 2 ? 2 : 0;
          this.mouseButtons[idx] = msg.type === "mousedown";
          await coreRPC(bsp).sendMouseClick([...this.mouseButtons]);
          break;
        }
        case "text":
          if (msg.data) await coreRPC(bsp).sendText(msg.data as string);
          break;
        case "scancodes":
          if (msg.codes) await coreRPC(bsp).sendScancodes(msg.codes as number[]);
          break;
        case "serial":
          // TODO: serial input forwarding to BSP
          break;
      }
    } catch { /* Never throw from WS handler */ }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    this.sessions.delete(ws);
    try { ws.close(code, reason); } catch { /* already closed */ }
    if (this.sessions.size === 0 && this.renderInterval) {
      clearInterval(this.renderInterval);
      this.renderInterval = null;
    }
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.sessions.delete(ws);
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  private wsSend(ws: WebSocket, data: ArrayBuffer | string): void {
    try { ws.send(data); } catch { /* client disconnected */ }
  }

  private broadcast(data: ArrayBuffer | string): void {
    const dead: WebSocket[] = [];
    for (const ws of this.sessions.keys()) {
      try { ws.send(data); } catch { dead.push(ws); }
    }
    for (const ws of dead) this.sessions.delete(ws);
  }
}
