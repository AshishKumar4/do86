import "./session.css";
import {
  MSG_FULL_FRAME,
  MSG_DELTA_FRAME,
  MSG_SERIAL_DATA,
  MSG_STATUS,
  MSG_TEXT_SCREEN,
  decodeFullFrame,
  decodeDeltaFrame,
  decodeTextScreen,
} from "./decoder";

// ── Session ──────────────────────────────────────────────────────────────────

const pathMatch = location.pathname.match(/^\/s\/([a-zA-Z0-9_-]+)/);
const sessionId = pathMatch?.[1] ?? null;
const imageParam = new URLSearchParams(location.search).get("image") || "";

// Strip ?image= from the address bar — only needed for the first WS handshake
if (imageParam) history.replaceState(null, "", location.pathname);

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

// ── State ────────────────────────────────────────────────────────────────────

let ws: WebSocket | null = null;
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
    text.startsWith("downloading") ||
    text.startsWith("mode:") ||
    text.startsWith("resize:")
  ) {
    statusEl.className = "booting";
  } else {
    statusEl.className = "";
  }

  // Drive the loading overlay from status messages
  if (text.startsWith("downloading")) {
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
    displayContainer.style.cursor = "default";
    return;
  }

  if (pointerLocked) {
    hideOverlay(focusOverlay);
    canvas.style.outline = "2px solid #58a6ff";
    canvas.style.outlineOffset = "-2px";
    displayContainer.style.cursor = "none";
  } else if (canvasFocused) {
    hideOverlay(focusOverlay);
    canvas.style.outline = "1px solid #30363d";
    canvas.style.outlineOffset = "-1px";
    displayContainer.style.cursor = "crosshair";
  } else {
    showOverlay(focusOverlay);
    canvas.style.outline = "none";
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
        ctx.putImageData(localImageData!, 0, 0);
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
      if (result?.dirty) {
        const d = result.dirty;
        ctx.putImageData(localImageData!, 0, 0, d.x, d.y, d.w, d.h);
      }
      if (result) {
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
      localImageData = null;
      pixelU32 = null;
      frameCount++;
      onFrameReceived(data.byteLength);
      break;
    }

    case MSG_STATUS:
      setStatus(textDecoder.decode(new Uint8Array(data, 1)));
      break;
  }
}

// ── Canvas scaling ───────────────────────────────────────────────────────────

window.addEventListener("resize", fitCanvas);
fitCanvas();

// ── Focus & pointer lock ─────────────────────────────────────────────────────

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
  canvasFocused = pointerLocked;
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
  if (firstConnect && imageParam) {
    wsUrl += `?image=${encodeURIComponent(imageParam)}`;
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
    reconnectTimer = setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, 30000);
  });

  ws.addEventListener("error", () => { /* handled by close */ });
}

// ── Boot ─────────────────────────────────────────────────────────────────────

connect();
