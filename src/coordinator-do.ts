/**
 * coordinator-do.ts — CoordinatorDO: The hub of distributed SMP.
 *
 * One CoordinatorDO per VM session. It:
 * - Accepts browser WebSocket connections (screen, keyboard, mouse)
 * - Manages per-core CpuCoreDO instances via RPC
 * - Holds the canonical page directory for memory coherence
 * - Routes inter-processor interrupts between cores via QEMU APIC bridge
 * - Hosts the IOAPIC for external interrupt routing
 * - Forwards BSP screen frames to browser clients
 *
 * QEMU migration notes:
 *   - IPI routing uses the same IPIRouter / decodeICR infrastructure.
 *     The difference is that CpuCoreDO now uses QEMUWrapper's bridge
 *     exports (wasm_apic_inject_irq, wasm_apic_read_icr) instead of
 *     direct WASM memory reads at v86 APIC struct offsets.
 *   - The ICR-write-callback approach (Module.onICRWrite via EM_ASM
 *     in patched apic_mem_write) means IPIs are push-based from cores
 *     rather than poll-based. The coordinator's routeIPI() RPC entry
 *     point is unchanged.
 *   - AP boot uses wasm_cpu_set_sipi_vector + wasm_cpu_resume instead
 *     of manual register patching. The coordinator still orchestrates
 *     the INIT→SIPI sequence via IPIRouter callbacks.
 *   - Display frames use the same 12-byte header format:
 *     [width:u32, height:u32, bufferWidth:u32, rgba...]
 *     QEMU's BGRA→RGBA conversion happens in QEMUWrapper.getScreenFrame().
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
    ramStats: Record<string, number> | null;
    heapUsage: number;
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

  // ── Cached BIOS binaries (needed for AP core creation after boot) ────
  private biosData: ArrayBuffer | null = null;
  private vgaBiosData: ArrayBuffer | null = null;
  private memorySizeBytes: number = 0;
  private vgaMemorySizeBytes: number = 0;

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
    this.broadcast(encodeStatus("booting: distributed SMP (QEMU)"));

    try {
      const bios = this.cachedAssets.get("bios");
      const vgaBios = this.cachedAssets.get("vgaBios");
      if (!bios || !vgaBios) throw new Error("Missing BIOS assets");

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

      // Cache BIOS binaries for AP creation later
      const memoryBytes = memorySizeMB * 1024 * 1024;
      const vgaMemoryBytes = vgaMemoryMB * 1024 * 1024;
      this.biosData = bios;
      this.vgaBiosData = vgaBios;
      this.memorySizeBytes = memoryBytes;
      this.vgaMemorySizeBytes = vgaMemoryBytes;

      // Initialize memory coherence
      this.pageDir = new PageDirectory(memoryBytes);

      // Initialize IPI routing with QEMU APIC bridge callbacks
      this.ipiRouter = new IPIRouter(async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      // ── INIT callback: create AP core DO ────────────────────────────
      this.ipiRouter.onCoreCreate = async (apicId) => {
        await this.createCore(apicId, false);
        // Initialize the AP core — it creates its SqlPageStore and waits for SIPI
        const stub = this.coreStubs.get(apicId);
        if (stub) {
          const coordId = this.ctx.id.toString();
          await coreRPC(stub).init(
            {
              apicId,
              isBSP: false,
              memorySizeBytes: this.memorySizeBytes,
              vgaMemorySizeBytes: this.vgaMemorySizeBytes,
              bios: this.biosData!,
              vgaBios: this.vgaBiosData!,
            },
            coordId,
          );
        }
      };

      // ── SIPI callback: copy trampoline pages, start AP ──────────────
      // With QEMU, the AP's QEMUWrapper.handleSIPI() calls
      // wasm_cpu_set_sipi_vector + wasm_cpu_resume, which sets CS:IP to
      // real mode at vector:0000 and unpauses the vCPU. The trampoline
      // pages are written to WASM memory before SIPI is delivered.
      this.ipiRouter.onCoreSIPI = async (apicId, vector) => {
        const stub = this.coreStubs.get(apicId);
        if (!stub) return;

        // Fetch trampoline pages from BSP's QEMU WASM memory
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

        // Deliver SIPI to the AP core — QEMUWrapper.handleSIPI() sets
        // the SIPI vector via wasm_cpu_set_sipi_vector and resumes.
        await coreRPC(stub).startupIPI(vector, {
          memorySizeBytes: this.memorySizeBytes,
          vgaMemorySizeBytes: this.vgaMemorySizeBytes,
          bios: this.biosData!,
          vgaBios: this.vgaBiosData!,
        }, trampolinePages);
      };

      // Initialize IOAPIC (24 entries, routes to cores)
      this.ioapic = new IOAPIC(24, async (targetApicId, ipi) => {
        await this.deliverIPIToCore(targetApicId, ipi);
      });

      // All pages start owned by BSP (Core 0)
      this.pageDir.assignAllToCore(0);

      // Create and boot BSP (Core 0)
      console.log(`${LOG_PREFIX} Creating BSP (Core 0) with QEMU`);
      await this.createCore(0, true);

      // Initialize BSP with full boot config (BIOS + disk)
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

      // Start BSP execution — QEMU's emscripten_set_main_loop is already
      // registered; this just sets the core state to RUNNING.
      await coreRPC(bspStub).start();
      this.ipiRouter.registerCore(0);

      // Free cached assets
      this.cachedAssets = null;

      this.booted = true;
      this.booting = false;
      this.broadcast(encodeStatus(`running: distributed SMP QEMU (${this.numCores} cores)`));
      this.startRenderLoop();

      console.log(
        `${LOG_PREFIX} Distributed SMP VM booted (QEMU): ${this.vmId} ` +
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
    ramStats: Record<string, number> | null;
    heapUsage: number;
  } | { apicId: number; state: string; error: string }>> {
    const statuses: Array<{
      apicId: number;
      state: string;
      isBSP: boolean;
      pageStats: Record<string, number> | null;
      ramStats: Record<string, number> | null;
      heapUsage: number;
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

  // ── IPI delivery (QEMU APIC bridge) ───────────────────────────────────
  // The IPI routing protocol is identical to the v86 version.
  // The difference is in how the target core handles it:
  //   v86:  Direct write to APIC IRR bits in WASM linear memory
  //   QEMU: CpuCoreDO.injectInterrupt() → wasm_apic_inject_irq()

  /**
   * Called by cores via RPC when the guest writes to LAPIC ICR.
   * This is the push-based path — QEMU's patched apic_mem_write calls
   * Module.onICRWrite via EM_ASM, which fires onIPISend in QEMUWrapper,
   * which calls this RPC method on the coordinator.
   */
  async routeIPI(ipi: IPIMessage): Promise<void> {
    if (!this.ipiRouter) return;
    await this.ipiRouter.route(ipi);
  }

  /**
   * Deliver an IPI to a target core via the QEMU APIC bridge.
   *
   * For FIXED/LOWEST_PRIORITY: calls injectInterrupt → wasm_apic_inject_irq
   * For INIT: calls initReset → wasm_cpu_halt
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

      // Standard IPI: inject into LAPIC via QEMU bridge
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
   * Render a graphical frame from the BSP's QEMU display.
   * QEMUWrapper.getScreenFrame() returns RGBA data in the same format
   * as the previous v86 implementation: [width:u32, height:u32, bufferWidth:u32, rgba...]
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
   * QEMU's text output goes through serial (stdio), so this may return
   * null. In that case, text content is delivered via serial data messages.
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
          // TODO: serial input forwarding via QEMU bridge
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
