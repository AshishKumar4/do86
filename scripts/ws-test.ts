#!/usr/bin/env bun
/**
 * ws-test.ts — do86 WebSocket diagnostic test
 *
 * Usage:
 *   bun run scripts/ws-test.ts [sessionId] [imageKey]
 *
 * Defaults: sessionId = "test-diag", imageKey = "kolibri"
 *
 * Flow:
 *   1. HTTP GET /s/{session}?image={key}&fresh=1  → triggers DO /init
 *   2. WS connect wss://…/s/{session}
 *   3. Decode all binary/text messages
 *   4. Send heartbeat JSON every 10s
 *   5. After 60s, print summary and exit
 */

// ── Protocol constants (mirrors src/types.ts) ─────────────────────────────
const MSG_FULL_FRAME  = 0;
const MSG_DELTA_FRAME = 1;
const MSG_SERIAL_DATA = 2;
const MSG_STATUS      = 3;
const MSG_TEXT_SCREEN = 4;

// ── Config ────────────────────────────────────────────────────────────────
const HOST      = "do86-test.ashishkumarsingh.com";
const SESSION   = process.argv[2] ?? "test-diag-" + Math.random().toString(36).slice(2, 8);
const IMAGE_KEY = process.argv[3] ?? "kolibri";
const DURATION_MS = 60_000;

const HTTP_URL = `https://${HOST}/s/${SESSION}?image=${IMAGE_KEY}&fresh=1`;
const WS_URL   = `wss://${HOST}/s/${SESSION}`;

const td = new TextDecoder();

// ── Stats ─────────────────────────────────────────────────────────────────
const stats = {
  fullFrames:   0,
  deltaFrames:  0,
  serialChunks: 0,
  statusMsgs:   [] as string[],
  textScreens:  0,
  unknownMsgs:  0,
  totalBytes:   0,
  errors:       [] as string[],
  connected:    false,
  connectTime:  0,
};

// ── Decode helpers ────────────────────────────────────────────────────────

function decodeMessage(data: ArrayBuffer): void {
  stats.totalBytes += data.byteLength;
  const view = new DataView(data);
  const type = view.getUint8(0);

  switch (type) {
    case MSG_FULL_FRAME: {
      const w = view.getUint16(1, true);
      const h = view.getUint16(3, true);
      stats.fullFrames++;
      log(`FULL_FRAME ${w}×${h} (${data.byteLength} bytes)`);
      break;
    }
    case MSG_DELTA_FRAME: {
      const w    = view.getUint16(1, true);
      const h    = view.getUint16(3, true);
      const tiles = view.getUint16(5, true);
      stats.deltaFrames++;
      log(`DELTA_FRAME ${w}×${h} tiles=${tiles} (${data.byteLength} bytes)`);
      break;
    }
    case MSG_SERIAL_DATA: {
      const text = td.decode(new Uint8Array(data, 1));
      stats.serialChunks++;
      process.stdout.write(`SERIAL: ${JSON.stringify(text)}\n`);
      break;
    }
    case MSG_STATUS: {
      const text = td.decode(new Uint8Array(data, 1));
      stats.statusMsgs.push(text);
      log(`STATUS: ${text}`);
      break;
    }
    case MSG_TEXT_SCREEN: {
      const cols  = view.getUint8(1);
      const rows  = view.getUint8(2);
      const lines = td.decode(new Uint8Array(data, 3)).split("\n").filter(l => l.trim());
      stats.textScreens++;
      log(`TEXT_SCREEN ${cols}×${rows}: ${lines.slice(0, 2).join(" | ")}`);
      break;
    }
    default:
      stats.unknownMsgs++;
      log(`UNKNOWN msg type=${type} len=${data.byteLength}`);
  }
}

// ── Logging ───────────────────────────────────────────────────────────────

function log(msg: string): void {
  const elapsed = ((Date.now() - stats.connectTime) / 1000).toFixed(1);
  console.log(`[+${elapsed}s] ${msg}`);
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`=== do86 WS test ===`);
  console.log(`Session : ${SESSION}`);
  console.log(`Image   : ${IMAGE_KEY}`);
  console.log(`HTTP URL: ${HTTP_URL}`);
  console.log(`WS URL  : ${WS_URL}`);
  console.log(`Duration: ${DURATION_MS / 1000}s`);
  console.log(``);

  // Step 1: HTTP GET to initialise the DO (triggers /init with fresh=1)
  console.log(`[init] GET ${HTTP_URL}`);
  let initStatus = 0;
  try {
    const resp = await fetch(HTTP_URL, {
      headers: { "Accept": "text/html" },
      redirect: "follow",
    });
    initStatus = resp.status;
    const body = await resp.text();
    console.log(`[init] HTTP ${resp.status} — body length ${body.length} chars`);
    if (!resp.ok) {
      console.error(`[init] Non-OK response: ${body.slice(0, 200)}`);
    }
  } catch (err) {
    console.error(`[init] HTTP fetch failed:`, err);
    stats.errors.push(`HTTP init: ${err}`);
  }

  // Small pause to let /init land in the DO before WS upgrade
  await new Promise(r => setTimeout(r, 500));

  // Step 2: Open WebSocket
  console.log(`[ws] Connecting ${WS_URL} …`);
  stats.connectTime = Date.now();

  await new Promise<void>((resolve) => {
    const ws = new WebSocket(WS_URL);

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let doneTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (doneTimer) clearTimeout(doneTimer);
      try { ws.close(); } catch {}
    };

    ws.binaryType = "arraybuffer";

    ws.addEventListener("open", () => {
      stats.connected = true;
      log(`WS OPEN`);

      // Trigger boot — must come from webSocketMessage for DO event loop to stay alive
      ws.send(JSON.stringify({ type: "boot" }));
      log(`sent boot`);

      heartbeatTimer = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "heartbeat" }));
          log(`sent heartbeat`);
        }
      }, 10_000);

      doneTimer = setTimeout(() => {
        log(`60s elapsed — closing`);
        cleanup();
        resolve();
      }, DURATION_MS);
    });

    ws.addEventListener("message", (event) => {
      if (event.data instanceof ArrayBuffer) {
        decodeMessage(event.data);
      } else {
        // Text message (shouldn't happen in normal protocol)
        log(`TEXT MSG: ${String(event.data).slice(0, 120)}`);
      }
    });

    ws.addEventListener("close", (event) => {
      log(`WS CLOSE code=${event.code} reason=${event.reason || "(none)"}`);
      cleanup();
      resolve();
    });

    ws.addEventListener("error", (event) => {
      const msg = (event as any).message ?? String(event);
      log(`WS ERROR: ${msg}`);
      stats.errors.push(`WS error: ${msg}`);
    });
  });

  // Step 3: Summary
  console.log(``);
  console.log(`=== Summary ===`);
  console.log(`Connected         : ${stats.connected}`);
  console.log(`Full frames       : ${stats.fullFrames}`);
  console.log(`Delta frames      : ${stats.deltaFrames}`);
  console.log(`Serial chunks     : ${stats.serialChunks}`);
  console.log(`Text screens      : ${stats.textScreens}`);
  console.log(`Unknown msgs      : ${stats.unknownMsgs}`);
  console.log(`Total bytes rx    : ${(stats.totalBytes / 1024).toFixed(1)} KB`);
  console.log(`Status messages   :`);
  for (const s of stats.statusMsgs) console.log(`  → ${s}`);
  if (stats.errors.length) {
    console.log(`Errors:`);
    for (const e of stats.errors) console.log(`  ✗ ${e}`);
  }
}

main().catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
