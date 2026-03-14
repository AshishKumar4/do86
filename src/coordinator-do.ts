/**
 * coordinator-do.ts — CoordinatorDO: The hub of distributed SMP.
 *
 * One CoordinatorDO per VM session. It:
 * - Accepts browser WebSocket connections (screen, keyboard, mouse)
 * - Manages per-core CpuCoreDO instances via RPC
 * - Holds the canonical page directory for memory coherence
 * - Routes inter-processor interrupts between cores
 * - Hosts the IOAPIC for external interrupt routing
 * - Forwards BSP screen frames to browser clients
 */

import { DurableObject } from "cloudflare:workers";
import {
  type ClientMessage, type ClientState,
  FPS_DEFAULT, FPS_MAX, FPS_MIN, LARGE_FRAME_BYTES,
  LOG_PREFIX,
} from "./types";
import { DeltaEncoder, encodeSerialData, encodeStatus, encodeTextScreen } from "./delta-encoder";
import { PageDirectory } from "./memory-coherence";
import { IPIRouter, IOAPIC, type IPIMessage, DeliveryMode, decodeICR } from "./ipi-handler";
import { unpackAssets } from "./sqlite-storage";

// ── Env ──────────────────────────────────────────────────────────────────────

export interface CoordinatorEnv {
  COORDINATOR: DurableObjectNamespace;
  CPU_CORE: DurableObjectNamespace;
  ASSETS: { fetch: (request: Request | string) => Promise<Response> };
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

  // ── Boot state ────────────────────────────────────────────────────────
  private booting = false;
  private booted = false;
  private bootError: string | null = null;
  private cachedAssets: Map<string, ArrayBuffer> | null = null;

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
    this.broadcast(encodeStatus("booting: distributed SMP"));

    try {
      const bios = this.cachedAssets.get("bios");
      const vgaBios = this.cachedAssets.get("vgaBios");
      const disk = this.cachedAssets.get("disk");
      if (!bios || !vgaBios) throw new Error("Missing BIOS assets");
      if (!disk) throw new Error("Missing disk image");

      // Parse metadata
      let memorySizeMB = 32;
      let vgaMemoryMB = 8;
      let diskDrive: "fda" | "cdrom" = "cdrom";
      const metadataRaw = this.cachedAssets.get("metadata");
      if (metadataRaw) {
        const meta = JSON.parse(new TextDecoder().decode(metadataRaw));
        memorySizeMB = meta.memory || memorySizeMB;
        vgaMemoryMB = meta.vgaMemory || vgaMemoryMB;
        diskDrive = meta.drive || diskDrive;
        this.vmId = meta.imageKey || "unknown";
        this.numCores = meta.numCores || 2;
      }

      // Initialize memory coherence
      const memoryBytes = memorySizeMB * 1024 * 1024;
      this.pageDir = new PageDirectory(memoryBytes);

      // Initialize IPI routing
      this.ipiRouter = new IPIRouter(async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      this.ipiRouter.onCoreCreate = async (apicId) => {
        await this.createCore(apicId, false);
      };

      this.ipiRouter.onCoreSIPI = async (apicId, vector) => {
        const stub = this.coreStubs.get(apicId);
        if (stub) {
          await (stub as any).startupIPI(vector, {
            memorySizeBytes: memoryBytes,
            bios: bios,
            vgaBios: vgaBios,
          });
        }
      };

      // Initialize IOAPIC (24 entries, routes to cores)
      this.ioapic = new IOAPIC(24, async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      // All pages start owned by BSP (Core 0)
      this.pageDir.assignAllToCore(0);

      // Create and boot BSP (Core 0)
      console.log(`${LOG_PREFIX} Creating BSP (Core 0)`);
      await this.createCore(0, true);

      // Initialize BSP with full boot config
      const bspStub = this.coreStubs.get(0);
      if (!bspStub) throw new Error("Failed to create BSP");

      const coordId = this.ctx.id.toString();
      await (bspStub as any).init(
        {
          apicId: 0,
          isBSP: true,
          memorySizeBytes: memoryBytes,
          vgaMemorySizeBytes: vgaMemoryMB * 1024 * 1024,
          bios: bios,
          vgaBios: vgaBios,
          disk: disk,
          diskDrive: diskDrive,
        },
        coordId,
      );

      // Start BSP execution
      await (bspStub as any).start();
      this.ipiRouter.registerCore(0);

      // Free cached assets
      this.cachedAssets = null;

      this.booted = true;
      this.booting = false;
      this.broadcast(encodeStatus(`running: distributed SMP (${this.numCores} cores)`));
      this.startRenderLoop();

      console.log(
        `${LOG_PREFIX} Distributed SMP VM booted: ${this.vmId} ` +
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
    const stub = this.env.CPU_CORE.get(id, { locationHint: this.coreLocation as any });
    this.coreStubs.set(apicId, stub);
    console.log(`${LOG_PREFIX} Created core DO: ${name} (APIC ID ${apicId})`);
  }

  private async getCoreStatuses(): Promise<any[]> {
    const statuses = [];
    for (const [apicId, stub] of this.coreStubs) {
      try {
        const status = await (stub as any).getStatus();
        statuses.push(status);
      } catch (e) {
        statuses.push({ apicId, state: "error", error: String(e) });
      }
    }
    return statuses;
  }

  // ── IPI delivery ──────────────────────────────────────────────────────

  /**
   * Called by cores via RPC when they write to LAPIC ICR.
   */
  async routeIPI(ipi: IPIMessage): Promise<void> {
    if (!this.ipiRouter) return;
    await this.ipiRouter.route(ipi);
  }

  private async deliverIPIToCore(targetApicId: number, ipi: IPIMessage): Promise<void> {
    const stub = this.coreStubs.get(targetApicId);
    if (!stub) {
      console.log(`${LOG_PREFIX} IPI to unknown core ${targetApicId} — dropped`);
      return;
    }

    try {
      await (stub as any).injectInterrupt(ipi);
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
        const dirtyData = await (ownerStub as any).writeback(physAddr);
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
            await (stub as any).invalidatePage(physAddr);
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

  // ── Render loop (fetches frames from BSP core) ────────────────────────

  private startRenderLoop(): void {
    if (this.renderInterval) return;
    this.renderInterval = setInterval(() => {
      this.renderFrame().catch((e) => {
        console.error(`${LOG_PREFIX} Render error:`, e);
      });
    }, Math.round(1000 / this.currentFPS));
  }

  private async renderFrame(): Promise<void> {
    if (this.sessions.size === 0) return;

    const bspStub = this.coreStubs.get(0);
    if (!bspStub) return;

    try {
      const frameData = await (bspStub as any).getScreenFrame();
      if (!frameData) return;

      // frameData is: [width:u32, height:u32, bufferWidth:u32, rgba...]
      const view = new DataView(frameData);
      const width = view.getUint32(0, true);
      const height = view.getUint32(4, true);
      const bufferWidth = view.getUint32(8, true);
      const rgba = new Uint8ClampedArray(frameData, 12);

      // Encode as delta frame
      let anyNeedsKeyframe = false;
      for (const state of this.sessions.values()) {
        if (state.needsKeyframe) { anyNeedsKeyframe = true; break; }
      }

      const result = this.deltaEncoder.encode(
        width, height, bufferWidth, rgba, anyNeedsKeyframe,
      );
      if (!result) return;

      // Send to all connected browsers
      const now = Date.now();
      const dead: WebSocket[] = [];
      for (const [ws, state] of this.sessions.entries()) {
        try {
          ws.send(result.data);
          state.lastSendTime = now;
          state.needsKeyframe = false;
        } catch {
          dead.push(ws);
        }
      }
      for (const ws of dead) this.sessions.delete(ws);
    } catch (e) {
      // Frame fetch failed — BSP might be busy, skip this frame
    }
  }

  // ── WebSocket handlers ────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      if (message instanceof ArrayBuffer) return;

      let msg: ClientMessage;
      try { msg = JSON.parse(message); }
      catch { return; }

      // Forward input to BSP (Core 0)
      const bspStub = this.coreStubs.get(0);
      if (!bspStub) return;

      switch (msg.type) {
        case "keydown":
          await (bspStub as any).sendKeyCode(msg.code, false);
          break;
        case "keyup":
          await (bspStub as any).sendKeyCode(msg.code, true);
          break;
        // TODO: mouse events
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
