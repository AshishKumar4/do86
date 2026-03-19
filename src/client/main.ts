import "./session.css";
import {
  MSG_FULL_FRAME,
  MSG_DELTA_FRAME,
  MSG_SERIAL_DATA,
  MSG_STATUS,
  MSG_TEXT_SCREEN,
  MSG_STATS,
  MSG_DETAILED_STATS,
  decodeFullFrame,
  decodeDeltaFrame,
  decodeTextScreen,
} from "./decoder";

// ── Session ──────────────────────────────────────────────────────────────────

const pathMatch = location.pathname.match(/^\/s\/([a-zA-Z0-9_-]+)/);
const sessionId = pathMatch?.[1] ?? null;
const params = new URLSearchParams(location.search);
const imageParam = params.get("image") || "";
const freshParam = params.get("fresh") === "1";

// Strip query params from the address bar — only needed for the first WS handshake
if (imageParam || freshParam) history.replaceState(null, "", location.pathname);

// ── DOM ──────────────────────────────────────────────────────────────────────

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const resolutionEl = document.getElementById("resolution")!;
const serialOutput = document.getElementById("serial-output")!;
const serialCmd = document.getElementById("serial-cmd") as HTMLInputElement;
const serialPanel = document.getElementById("serial-panel")!;
const serialToggle = document.getElementById("serial-toggle")!;
const displayContainer = document.getElementById("display-container")!;
const statsEl = document.getElementById("frame-stats")!;
const sessionIdEl = document.getElementById("session-id")!;
const loadingOverlay = document.getElementById("loading-overlay")!;
const loadingText = document.getElementById("loading-text")!;
const loadingSub = document.getElementById("loading-sub")!;
const focusOverlay = document.getElementById("focus-overlay")!;
const reconnectOverlay = document.getElementById("reconnect-overlay")!;

if (sessionId) {
  sessionIdEl.textContent = sessionId.slice(0, 8);
  sessionIdEl.title = sessionId;
}

// ── Debug stats overlay ──────────────────────────────────────────────────────
// Created dynamically so it doesn't require session.html changes.
// Toggle with Ctrl+Shift+D.

const debugOverlay = document.createElement("div");
debugOverlay.id = "debug-stats";
Object.assign(debugOverlay.style, {
  position:   "fixed",
  bottom:     "8px",
  right:      "8px",
  background: "rgba(0,0,0,0.75)",
  color:      "#0f0",
  fontFamily: "monospace",
  fontSize:   "11px",
  padding:    "8px 10px",
  borderRadius: "4px",
  zIndex:     "9999",
  whiteSpace: "pre",
  display:    "none",
  maxWidth:   "320px",
  lineHeight: "1.4",
  pointerEvents: "none",
});
document.body.appendChild(debugOverlay);

let debugVisible = false;
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyD") {
    debugVisible = !debugVisible;
    debugOverlay.style.display = debugVisible ? "block" : "none";
  }
});

function updateDebugOverlay(stats: Record<string, unknown>) {
  const ps = stats.pageStore as Record<string, unknown> | null;
  const lines = [
    `═══ do86 stats ═══`,
    `uptime     ${stats.uptimeMs} ms`,
    `image      ${stats.imageKey ?? "?"}`,
    ``,
    `── render ──`,
    `renders    ${stats.renders}  (${stats.rendersPerSec}/s)`,
    `frames     ${stats.framesSent}  (${stats.framesPerSec}/s)`,
    `renderMs   ${stats.renderMs} ms`,
    ``,
    `── cpu ──`,
    `yields     ${stats.yields}`,
    `syncYields ${stats.syncYields}`,
    `asyncY     ${(stats as any).asyncYields}`,
    ``,
    ...(ps ? [
      `── page store ──`,
      `swapIns    ${ps.swapIns}`,
      `evictions  ${ps.evictions}`,
      `hotPages   ${ps.hotPages}/${ps.totalFrames}`,
      `sqlReads   ${ps.sqlReads}  (${ps.sqlReadMs}ms)`,
      `sqlWrites  ${ps.sqlWrites}  (${ps.sqlWriteMs}ms)`,
      `wasmPool   ${ps.hasWasmPool}`,
    ] : [`── page store: N/A ──`]),
  ];
  debugOverlay.textContent = lines.join("\n");
}

// ── Stats sidebar ────────────────────────────────────────────────────────────

const sidebar = document.getElementById("stats-sidebar")!;
const sidebarToggle = document.getElementById("stats-toggle")!;
const sidebarContent = document.getElementById("stats-content")!;
let sidebarOpen = false;
let statsSubscribed = false;

// Sparkline ring buffers (last 60 samples)
const SPARKLINE_LEN = 60;
const sparkSwapIns: number[] = [];
const sparkYields: number[] = [];

function toggleSidebar() {
  sidebarOpen = !sidebarOpen;
  sidebar.classList.toggle("collapsed", !sidebarOpen);
  if (sidebarOpen && !statsSubscribed) {
    sendJSON({ type: "subscribe_stats" });
    statsSubscribed = true;
  } else if (!sidebarOpen && statsSubscribed) {
    sendJSON({ type: "unsubscribe_stats" });
    statsSubscribed = false;
  }
}

sidebarToggle.addEventListener("click", toggleSidebar);

// Ctrl+Shift+S toggles sidebar
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.shiftKey && e.code === "KeyS") {
    e.preventDefault();
    toggleSidebar();
  }
});

function fmt(n: number | undefined | null): string {
  if (n == null) return "-";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return String(Math.round(n));
}

function fmtMs(ms: number | undefined | null): string {
  if (ms == null) return "-";
  if (ms >= 1000) return (ms / 1000).toFixed(1) + "s";
  return Math.round(ms) + "ms";
}

function drawSparkline(canvasId: string, data: number[], color: string) {
  const c = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!c) return;
  const ctx2 = c.getContext("2d");
  if (!ctx2) return;
  const w = c.width;
  const h = c.height;
  ctx2.clearRect(0, 0, w, h);
  if (data.length < 2) return;
  const max = Math.max(...data, 1);
  ctx2.beginPath();
  ctx2.strokeStyle = color;
  ctx2.lineWidth = 1.5;
  for (let i = 0; i < data.length; i++) {
    const x = (i / (SPARKLINE_LEN - 1)) * w;
    const y = h - (data[i] / max) * (h - 2) - 1;
    if (i === 0) ctx2.moveTo(x, y);
    else ctx2.lineTo(x, y);
  }
  ctx2.stroke();
  // Label max value
  ctx2.fillStyle = "#8b949e";
  ctx2.font = "9px monospace";
  ctx2.textAlign = "right";
  ctx2.fillText(fmt(max) + "/s", w - 2, 10);
}

function updateSidebar(stats: Record<string, unknown>) {
  const ps = stats.ps as Record<string, unknown> | null;

  // Pool bar
  if (ps) {
    const hot = (ps.hot as number) || 0;
    const total = (ps.total as number) || 1;
    const pct = Math.round((hot / total) * 100);
    const bar = document.getElementById("pool-bar") as HTMLElement;
    bar.style.width = pct + "%";
    bar.style.background = pct > 90 ? "#da3633" : pct > 70 ? "#d29922" : "#238636";
    const barText = document.getElementById("pool-bar-text");
    if (barText) barText.textContent = pct > 10 ? pct + "%" : "";

    setText("s-hot", fmt(hot) + " / " + fmt(total));
    setText("s-free", fmt(ps.free as number));
    setText("s-pool-pct", pct + "%");
    setText("s-swapins", fmt(ps.swapIns as number));
    setText("s-evictions", fmt(ps.evictions as number));
    setText("s-tlb", fmt(ps.tlbFlushes as number));
    setText("s-pending", fmt(ps.pending as number));
    setText("s-sql-reads", fmt(ps.sqlR as number));
    setText("s-sql-writes", fmt(ps.sqlW as number));
    setText("s-sql-read-ms", fmtMs(ps.sqlRms as number));
    setText("s-sql-write-ms", fmtMs(ps.sqlWms as number));
  }

  // Rates
  setText("s-swapins-rate", fmt(stats.swapInsPerSec as number));
  setText("s-evictions-rate", fmt(stats.evictionsPerSec as number));
  setText("s-sql-reads-rate", fmt(stats.sqlReadsPerSec as number));
  setText("s-yields", fmt(stats.yields as number));
  setText("s-yields-rate", fmt(stats.yieldsPerSec as number));

  const yields = (stats.yields as number) || 0;
  const syncYields = (stats.syncYields as number) || 0;
  setText("s-sync-ratio", yields > 0 ? Math.round((syncYields / yields) * 100) + "%" : "-");

  setText("s-instructions", fmt(stats.instructions as number));
  const ips = (stats.instructionsPerSec as number) || 0;
  setText("s-mips", ips > 0 ? (ips / 1_000_000).toFixed(2) : "-");

  setText("s-frames", fmt(stats.framesSent as number));
  setText("s-render-ms", fmtMs(stats.renderMs as number));

  setText("s-uptime", fmtMs(stats.uptimeMs as number));
  setText("s-image", (stats.imageKey as string) || "-");
  setText("s-sessions", String(stats.sessions ?? "-"));
  const dead = stats.yieldDead as boolean;
  const deadEl = document.getElementById("s-dead");
  if (deadEl) {
    deadEl.textContent = dead ? "YES" : "no";
    deadEl.style.color = dead ? "#da3633" : "#238636";
  }

  // Sparklines
  sparkSwapIns.push((stats.swapInsPerSec as number) || 0);
  if (sparkSwapIns.length > SPARKLINE_LEN) sparkSwapIns.shift();
  drawSparkline("chart-swapins", sparkSwapIns, "#f97316");

  sparkYields.push((stats.yieldsPerSec as number) || 0);
  if (sparkYields.length > SPARKLINE_LEN) sparkYields.shift();
  drawSparkline("chart-yields", sparkYields, "#58a6ff");
}

function setText(id: string, value: string) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// ── State ────────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
let screenWidth = 720;
let screenHeight = 400;
let canvasFocused = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelay = 1000;
let pointerLocked = false;
let localImageData: ImageData | null = null;
let firstConnect = true;
let vmRunning = false;
let wsConnected = false;

// Cached Uint32Array view over the local pixel buffer
let pixelU32: Uint32Array | null = null;

// ── Frame paint ──────────────────────────────────────────────────────────────
// Paint immediately on frame receive — no rAF queue delay.
// Each WS message is one rendered frame from the server; painting synchronously
// eliminates the up-to-16ms rAF wait that was the dominant source of cursor
// ghosting on top of the ~8ms server batch latency.
// The browser still composites to the display at vsync — the immediate
// putImageData just ensures the canvas backbuffer is up-to-date as early
// as possible before that composite step.

function paintFrame(dirty: { x: number; y: number; w: number; h: number } | "full") {
  if (!localImageData) return;
  if (dirty === "full") {
    ctx.putImageData(localImageData, 0, 0);
  } else {
    ctx.putImageData(localImageData, 0, 0, dirty.x, dirty.y, dirty.w, dirty.h);
  }
}

// Stats / FPS
let frameCount = 0;
let deltaFrameCount = 0;
let fullFrameCount = 0;
let totalBytes = 0;
let lastStatsTime = 0;
let lastStatsFrame = 0;

const textDecoder = new TextDecoder();

// ── Scancode map (KeyboardEvent.code → AT Set 1) ────────────────────────────

const SCANCODE_MAP: Record<string, number> = {
  Escape: 0x01,
  Digit1: 0x02, Digit2: 0x03, Digit3: 0x04, Digit4: 0x05,
  Digit5: 0x06, Digit6: 0x07, Digit7: 0x08, Digit8: 0x09,
  Digit9: 0x0a, Digit0: 0x0b,
  Minus: 0x0c, Equal: 0x0d, Backspace: 0x0e, Tab: 0x0f,
  KeyQ: 0x10, KeyW: 0x11, KeyE: 0x12, KeyR: 0x13,
  KeyT: 0x14, KeyY: 0x15, KeyU: 0x16, KeyI: 0x17,
  KeyO: 0x18, KeyP: 0x19,
  BracketLeft: 0x1a, BracketRight: 0x1b, Enter: 0x1c,
  ControlLeft: 0x1d,
  KeyA: 0x1e, KeyS: 0x1f, KeyD: 0x20, KeyF: 0x21,
  KeyG: 0x22, KeyH: 0x23, KeyJ: 0x24, KeyK: 0x25, KeyL: 0x26,
  Semicolon: 0x27, Quote: 0x28, Backquote: 0x29,
  ShiftLeft: 0x2a, Backslash: 0x2b,
  KeyZ: 0x2c, KeyX: 0x2d, KeyC: 0x2e, KeyV: 0x2f,
  KeyB: 0x30, KeyN: 0x31, KeyM: 0x32,
  Comma: 0x33, Period: 0x34, Slash: 0x35, ShiftRight: 0x36,
  NumpadMultiply: 0x37, AltLeft: 0x38, Space: 0x39, CapsLock: 0x3a,
  F1: 0x3b, F2: 0x3c, F3: 0x3d, F4: 0x3e,
  F5: 0x3f, F6: 0x40, F7: 0x41, F8: 0x42, F9: 0x43, F10: 0x44,
  NumLock: 0x45, ScrollLock: 0x46,
  Numpad7: 0x47, Numpad8: 0x48, Numpad9: 0x49, NumpadSubtract: 0x4a,
  Numpad4: 0x4b, Numpad5: 0x4c, Numpad6: 0x4d, NumpadAdd: 0x4e,
  Numpad1: 0x4f, Numpad2: 0x50, Numpad3: 0x51,
  Numpad0: 0x52, NumpadDecimal: 0x53, F11: 0x57, F12: 0x58,
  NumpadEnter: 0xE01C, ControlRight: 0xE01D, NumpadDivide: 0xE035,
  AltRight: 0xE038, Home: 0xE047, ArrowUp: 0xE048, PageUp: 0xE049,
  ArrowLeft: 0xE04B, ArrowRight: 0xE04D, End: 0xE04F,
  ArrowDown: 0xE050, PageDown: 0xE051, Insert: 0xE052, Delete: 0xE053,
  MetaLeft: 0xE05B, MetaRight: 0xE05C, ContextMenu: 0xE05D,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendJSON(msg: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function appendSerial(text: string) {
  serialOutput.textContent += text;
  if (serialOutput.textContent!.length > 8000) {
    serialOutput.textContent = serialOutput.textContent!.slice(-4000);
  }
  serialOutput.scrollTop = serialOutput.scrollHeight;
}

function showOverlay(el: HTMLElement) { el.classList.remove("hidden"); }
function hideOverlay(el: HTMLElement) { el.classList.add("hidden"); }

// ── Status & overlay management ─────────────────────────────────────────────

function setStatus(text: string) {
  statusEl.textContent = text;

  if (text.startsWith("running") || text === "connected") {
    statusEl.className = "connected";
  } else if (text.startsWith("restoring")) {
    statusEl.className = "restoring";
  } else if (text.startsWith("saving snapshot")) {
    statusEl.className = "booting";
  } else if (
    text.startsWith("booting") ||
    text.startsWith("waiting_for_boot") ||
    text.startsWith("recovering") ||
    text.startsWith("downloading") ||
    text.startsWith("mode:") ||
    text.startsWith("resize:")
  ) {
    statusEl.className = "booting";
  } else if (text === "waiting_for_assets") {
    statusEl.className = "";
  } else {
    statusEl.className = "";
  }

  // Drive the loading overlay from status messages
  if (text === "waiting_for_assets") {
    // DO is alive but lost its assets (eviction without self-recovery).
    // Close and reconnect — the HTTP GET on reconnect will re-run /init.
    loadingText.textContent = "Reconnecting\u2026";
    loadingSub.textContent = "Session state lost. Reconnecting automatically\u2026";
    showOverlay(loadingOverlay);
    hideOverlay(reconnectOverlay);
    // Close WS so the close handler fires and schedules connect() with backoff.
    if (ws) { ws.close(); }
  } else if (text.startsWith("recovering")) {
    const what = text.replace("recovering:", "").trim() || "session";
    loadingText.textContent = `Recovering ${what}\u2026`;
    loadingSub.textContent = "DO was evicted — reloading assets automatically";
    showOverlay(loadingOverlay);
  } else if (text.startsWith("downloading")) {
    const what = text.replace("downloading:", "").trim() || "image";
    loadingText.textContent = `Downloading ${what}\u2026`;
    loadingSub.textContent = "This may take 10\u201330 seconds on first boot";
    showOverlay(loadingOverlay);
  } else if (text.startsWith("booting")) {
    loadingText.textContent = "Booting\u2026";
    loadingSub.textContent = "";
    showOverlay(loadingOverlay);
  } else if (text.startsWith("running") || text.startsWith("mode:") || text.startsWith("resize:")) {
    vmRunning = true;
    hideOverlay(loadingOverlay);
    updateFocusUI();
  }
}

function updateFocusUI() {
  if (!vmRunning || !wsConnected) {
    hideOverlay(focusOverlay);
    canvas.style.outline = "none";
    canvas.style.boxShadow = "none";
    displayContainer.style.cursor = "default";
    return;
  }

  if (pointerLocked) {
    hideOverlay(focusOverlay);
    canvas.style.outline = "2px solid #58a6ff";
    canvas.style.outlineOffset = "-2px";
    canvas.style.boxShadow = "0 0 12px rgba(88, 166, 255, 0.4)";
    displayContainer.style.cursor = "none";
  } else if (canvasFocused) {
    hideOverlay(focusOverlay);
    canvas.style.outline = "2px solid #3fb950";
    canvas.style.outlineOffset = "-2px";
    canvas.style.boxShadow = "0 0 8px rgba(63, 185, 80, 0.3)";
    displayContainer.style.cursor = "crosshair";
  } else {
    showOverlay(focusOverlay);
    canvas.style.outline = "none";
    canvas.style.boxShadow = "none";
    displayContainer.style.cursor = "default";
  }
}

// ── Canvas / pixel buffer ───────────────────────────────────────────────────

function fitCanvas() {
  const cw = displayContainer.clientWidth;
  const ch = displayContainer.clientHeight;
  if (cw === 0 || ch === 0) return;
  const scale = Math.min(cw / screenWidth, ch / screenHeight, 2);
  canvas.style.width = `${Math.floor(screenWidth * scale)}px`;
  canvas.style.height = `${Math.floor(screenHeight * scale)}px`;
}

function updateCanvasSize(width: number, height: number) {
  if (width === screenWidth && height === screenHeight) return;
  screenWidth = width;
  screenHeight = height;
  canvas.width = width;
  canvas.height = height;
  resolutionEl.textContent = `${width}\u00d7${height}`;
  fitCanvas();
  localImageData = null;
  pixelU32 = null;
}

function ensureLocalBuffer(width: number, height: number): Uint32Array {
  if (localImageData?.width === width && localImageData?.height === height) {
    return pixelU32!;
  }
  localImageData = ctx.createImageData(width, height);
  const u32 = new Uint32Array(localImageData.data.buffer);
  for (let i = 0; i < u32.length; i++) u32[i] = 0xFF000000;
  pixelU32 = u32;
  return u32;
}

// ── Stats ───────────────────────────────────────────────────────────────────

function updateStats() {
  const now = Date.now();
  const elapsed = now - lastStatsTime;
  if (elapsed < 1000) return;

  const fps = Math.round(((frameCount - lastStatsFrame) / elapsed) * 1000);
  lastStatsFrame = frameCount;
  lastStatsTime = now;

  statsEl.textContent =
    `${fps} fps \u00b7 ${frameCount}f (${deltaFrameCount}d/${fullFrameCount}k) \u00b7 ${(totalBytes / 1024) | 0} KB`;
}

/** Called after every frame decode */
function onFrameReceived(bytes: number) {
  totalBytes += bytes;
  if (!vmRunning) {
    vmRunning = true;
    hideOverlay(loadingOverlay);
    updateFocusUI();
  }
  updateStats();
}

// ── Binary message handler ──────────────────────────────────────────────────

function handleBinaryMessage(data: ArrayBuffer) {
  const type = new DataView(data).getUint8(0);

  switch (type) {
    case MSG_FULL_FRAME: {
      const view = new DataView(data);
      const w = view.getUint16(1, true);
      const h = view.getUint16(3, true);
      updateCanvasSize(w, h);
      const u32 = ensureLocalBuffer(w, h);
      const result = decodeFullFrame(data, u32);
      if (result) {
        paintFrame("full");
        fullFrameCount++;
        frameCount++;
        onFrameReceived(data.byteLength);
      }
      break;
    }

    case MSG_DELTA_FRAME: {
      const view = new DataView(data);
      const w = view.getUint16(1, true);
      const h = view.getUint16(3, true);
      updateCanvasSize(w, h);
      const u32 = ensureLocalBuffer(w, h);
      const result = decodeDeltaFrame(data, u32);
      if (result) {
        if (result.dirty) {
          paintFrame(result.dirty);
        }
        deltaFrameCount++;
        frameCount++;
        onFrameReceived(data.byteLength);
      }
      break;
    }

    case MSG_SERIAL_DATA:
      appendSerial(textDecoder.decode(new Uint8Array(data, 1)));
      break;

    case MSG_TEXT_SCREEN: {
      const ts = decodeTextScreen(data, textDecoder);
      updateCanvasSize(ts.width, ts.height);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = "16px monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#aaa";
      for (let row = 0; row < ts.lines.length && row < ts.rows; row++) {
        ctx.fillText(ts.lines[row] || "", 0, row * 16);
      }
      // Text renders directly to canvas; clear pixel buffer so next graphical
      // frame forces a full repaint.
      localImageData = null;
      pixelU32 = null;
      frameCount++;
      onFrameReceived(data.byteLength);
      break;
    }

    case MSG_STATUS:
      setStatus(textDecoder.decode(new Uint8Array(data, 1)));
      break;

    case MSG_STATS: {
      try {
        const stats = JSON.parse(textDecoder.decode(new Uint8Array(data, 1)));
        updateDebugOverlay(stats);
        // Auto-show overlay on first stats message if URL has ?debug=1
        if (new URLSearchParams(location.search).get("debug") === "1") {
          debugVisible = true;
          debugOverlay.style.display = "block";
        }
      } catch { /* malformed stats — ignore */ }
      break;
    }

    case MSG_DETAILED_STATS: {
      try {
        const stats = JSON.parse(textDecoder.decode(new Uint8Array(data, 1)));
        if (sidebarOpen) updateSidebar(stats);
      } catch { /* malformed stats — ignore */ }
      break;
    }
  }
}

// ── Canvas scaling ───────────────────────────────────────────────────────────

window.addEventListener("resize", fitCanvas);
fitCanvas();

// ── Focus & pointer lock ─────────────────────────────────────────────────────

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  // Don't unfocus keyboard when pointer lock exits — canvas focus is independent.
  // Pointer lock is only for mouse capture (GUI OSes); keyboard should keep working.
  if (pointerLocked) canvasFocused = true;
  updateFocusUI();
});

// ── Keyboard ─────────────────────────────────────────────────────────────────

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (pointerLocked) { document.exitPointerLock(); return; }
    if (canvasFocused) { canvasFocused = false; updateFocusUI(); return; }
  }
  if (!canvasFocused) return;
  const sc = SCANCODE_MAP[e.code];
  if (sc !== undefined) { e.preventDefault(); sendJSON({ type: "keydown", code: sc }); }
});

document.addEventListener("keyup", (e) => {
  if (!canvasFocused) return;
  const sc = SCANCODE_MAP[e.code];
  if (sc !== undefined) { e.preventDefault(); sendJSON({ type: "keyup", code: sc }); }
});

// ── Mouse ────────────────────────────────────────────────────────────────────

canvas.addEventListener("click", () => {
  if (pointerLocked) return;
  if (canvasFocused) canvas.requestPointerLock();
  else { canvasFocused = true; updateFocusUI(); }
});

document.addEventListener("click", (e) => {
  if (!pointerLocked && e.target !== canvas) {
    canvasFocused = false;
    updateFocusUI();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  if (e.movementX || e.movementY) sendJSON({ type: "mousemove", dx: e.movementX, dy: e.movementY });
});

canvas.addEventListener("mousedown", (e) => {
  if (!pointerLocked) return;
  e.preventDefault();
  // Send DOM button index directly (0=left, 1=middle, 2=right)
  sendJSON({ type: "mousedown", button: e.button });
});

canvas.addEventListener("mouseup", (e) => {
  if (!pointerLocked) return;
  e.preventDefault();
  sendJSON({ type: "mouseup", button: e.button });
});

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

// ── Serial ───────────────────────────────────────────────────────────────────

serialCmd.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && serialCmd.value) {
    sendJSON({ type: "serial", data: serialCmd.value + "\n" });
    serialCmd.value = "";
  }
});

serialToggle.addEventListener("click", () => {
  serialPanel.classList.toggle("collapsed");
  serialToggle.textContent = serialPanel.classList.contains("collapsed")
    ? "Serial \u25B2"
    : "Serial \u25BC";
});

// ── WebSocket ────────────────────────────────────────────────────────────────

function connect() {
  if (!sessionId) return;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (ws) { ws.onclose = null; ws.close(); ws = null; }

  frameCount = deltaFrameCount = fullFrameCount = totalBytes = 0;
  lastStatsFrame = 0;
  localImageData = null;
  pixelU32 = null;

  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  let wsUrl = `${protocol}//${location.host}/s/${sessionId}`;
  if (firstConnect) {
    const wsParams = new URLSearchParams();
    if (imageParam) wsParams.set("image", imageParam);
    if (freshParam) wsParams.set("fresh", "1");
    const qs = wsParams.toString();
    if (qs) wsUrl += `?${qs}`;
    firstConnect = false;
  }

  ws = new WebSocket(wsUrl);
  ws.binaryType = "arraybuffer";

  ws.addEventListener("open", () => {
    wsConnected = true;
    setStatus("connected");
    reconnectDelay = 1000;
    hideOverlay(reconnectOverlay);

    if (!vmRunning) {
      loadingText.textContent = "Connecting\u2026";
      loadingSub.textContent = "";
      showOverlay(loadingOverlay);
    }
    updateFocusUI();

    // Trigger boot from the server side. Boot runs inside webSocketMessage so
    // v86's internal setTimeout(d,0) fires within an active DO event handler.
    ws.send(JSON.stringify({ type: "boot" }));

    // Re-subscribe to detailed stats if sidebar was open before reconnect
    if (sidebarOpen) {
      sendJSON({ type: "subscribe_stats" });
      statsSubscribed = true;
    }

    // Heartbeat every 10s to keep the non-hibernating DO alive
    heartbeatInterval = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "heartbeat" }));
    }, 10_000);
  });

  ws.addEventListener("message", (event) => {
    if (event.data instanceof ArrayBuffer) {
      handleBinaryMessage(event.data);
    } else {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === "status") setStatus(msg.status);
      } catch { /* ignore non-JSON text messages */ }
    }
  });

  ws.addEventListener("close", () => {
    wsConnected = false;
    setStatus("disconnected");
    showOverlay(reconnectOverlay);
    hideOverlay(focusOverlay);
    canvasFocused = false;
    updateFocusUI();
    if (heartbeatInterval) { clearInterval(heartbeatInterval); heartbeatInterval = null; }
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });

  ws.addEventListener("error", () => { /* handled by close */ });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

connect();
