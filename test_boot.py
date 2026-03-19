#!/usr/bin/env python3
"""
WebSocket test client for do86 — monitors OS boot progress.

Usage:
    python3 test_boot.py [--image kolibri|aqeous] [--fresh] [--duration 300]

Connects via WebSocket, subscribes to detailed stats, and logs:
  - Text screen content (boot messages)
  - Status messages  
  - Stats (yields, instructions, MIPS, etc.)
  - Graphical/full frame events
"""

import argparse
import asyncio
import json
import struct
import sys
import time
import uuid

try:
    import websockets
except ImportError:
    print("Installing websockets...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets", "-q"])
    import websockets

# Protocol constants (must match src/types.ts)
MSG_FULL_FRAME     = 0
MSG_DELTA_FRAME    = 1
MSG_SERIAL_DATA    = 2
MSG_STATUS         = 3
MSG_TEXT_SCREEN     = 4
MSG_STATS          = 5
MSG_DETAILED_STATS = 6

BASE_URL = "do86.ashishkumarsingh.com"


def decode_message(data: bytes) -> dict:
    """Decode a binary WebSocket message from the server."""
    if len(data) < 1:
        return {"type": "empty"}
    
    msg_type = data[0]
    
    if msg_type == MSG_STATUS:
        text = data[1:].decode("utf-8", errors="replace")
        return {"type": "status", "text": text}
    
    elif msg_type == MSG_TEXT_SCREEN:
        if len(data) < 3:
            return {"type": "text_screen", "cols": 0, "rows": 0, "text": ""}
        cols = data[1]
        rows = data[2]
        text = data[3:].decode("utf-8", errors="replace")
        return {"type": "text_screen", "cols": cols, "rows": rows, "text": text}
    
    elif msg_type == MSG_SERIAL_DATA:
        text = data[1:].decode("utf-8", errors="replace")
        return {"type": "serial", "text": text}
    
    elif msg_type == MSG_STATS:
        text = data[1:].decode("utf-8", errors="replace")
        try:
            stats = json.loads(text)
        except json.JSONDecodeError:
            stats = {"raw": text}
        return {"type": "stats", "data": stats}
    
    elif msg_type == MSG_DETAILED_STATS:
        text = data[1:].decode("utf-8", errors="replace")
        try:
            stats = json.loads(text)
        except json.JSONDecodeError:
            stats = {"raw": text}
        return {"type": "detailed_stats", "data": stats}
    
    elif msg_type == MSG_FULL_FRAME:
        return {"type": "full_frame", "size": len(data)}
    
    elif msg_type == MSG_DELTA_FRAME:
        return {"type": "delta_frame", "size": len(data)}
    
    else:
        return {"type": f"unknown_{msg_type}", "size": len(data)}


async def monitor(image: str, fresh: bool, duration: int):
    session_id = f"test-{image}-{uuid.uuid4().hex[:8]}"
    fresh_param = "&fresh=1" if fresh else ""
    
    # Step 1: HTTP GET to init the DO (triggers /init POST internally)
    # The Worker handles the init flow: checks DO status, fetches BIOS ROMs,
    # packs assets, and POSTs to the DO's /init endpoint.
    print(f"[init] Creating session: {session_id} (image={image}, fresh={fresh})")
    
    import urllib.request
    import ssl
    ctx = ssl.create_default_context()
    init_url = f"https://{BASE_URL}/s/{session_id}?image={image}{fresh_param}"
    try:
        req = urllib.request.Request(init_url, headers={"User-Agent": "do86-test/1.0"})
        with urllib.request.urlopen(req, timeout=60, context=ctx) as resp:
            # Read the response to ensure the init flow completes
            body = resp.read()
            print(f"[init] HTTP {resp.status} — {len(body)} bytes (DO init triggered)")
    except Exception as e:
        print(f"[init] Warning: {e} — will wait for DO to init via WS")
    
    # Step 2: Connect WebSocket
    ws_url = f"wss://{BASE_URL}/s/{session_id}?image={image}"
    print(f"[ws] Connecting to {ws_url}")
    
    start_time = time.time()
    last_text = ""
    last_status = ""
    msg_counts = {}
    last_stats_time = 0
    booted = False
    graphical_mode = False
    
    try:
        async with websockets.connect(ws_url, max_size=10_000_000) as ws:
            print(f"[ws] Connected! Monitoring for {duration}s...")
            
            # Subscribe to detailed stats and trigger boot
            await ws.send(json.dumps({"type": "subscribe_stats"}))
            await ws.send(json.dumps({"type": "boot"}))
            print("[ws] Subscribed to detailed stats + sent boot command")
            
            # Send periodic heartbeats
            async def heartbeat():
                while True:
                    try:
                        await ws.send(json.dumps({"type": "heartbeat"}))
                        await asyncio.sleep(5)
                    except:
                        break
            
            heartbeat_task = asyncio.create_task(heartbeat())
            
            try:
                while time.time() - start_time < duration:
                    try:
                        data = await asyncio.wait_for(ws.recv(), timeout=5.0)
                    except asyncio.TimeoutError:
                        elapsed = time.time() - start_time
                        print(f"[{elapsed:6.1f}s] No message for 5s (counts: {msg_counts})")
                        continue
                    except websockets.exceptions.ConnectionClosed:
                        print("[ws] Connection closed by server")
                        break
                    
                    elapsed = time.time() - start_time
                    
                    if isinstance(data, str):
                        print(f"[{elapsed:6.1f}s] TEXT: {data[:200]}")
                        continue
                    
                    msg = decode_message(data)
                    msg_type = msg["type"]
                    msg_counts[msg_type] = msg_counts.get(msg_type, 0) + 1
                    
                    if msg_type == "status":
                        if msg["text"] != last_status:
                            last_status = msg["text"]
                            print(f"[{elapsed:6.1f}s] STATUS: {last_status}")
                            if "running" in last_status:
                                booted = True
                            if "graphical" in last_status.lower() or "mode: graphical" in last_status:
                                graphical_mode = True
                                print(f"[{elapsed:6.1f}s] *** GRAPHICAL MODE — OS likely booted to GUI ***")
                    
                    elif msg_type == "text_screen":
                        text = msg["text"]
                        if text != last_text:
                            last_text = text
                            # Show the text screen content (boot messages)
                            lines = text.split("\n")
                            # Find last non-empty line
                            last_line = ""
                            for line in reversed(lines):
                                stripped = line.strip()
                                if stripped:
                                    last_line = stripped
                                    break
                            print(f"[{elapsed:6.1f}s] SCREEN ({msg['cols']}x{msg['rows']}): ...{last_line}")
                    
                    elif msg_type == "serial":
                        text = msg["text"].strip()
                        if text:
                            print(f"[{elapsed:6.1f}s] SERIAL: {text[:200]}")
                    
                    elif msg_type == "detailed_stats":
                        now = time.time()
                        if now - last_stats_time >= 2.0:  # Print stats every 2s
                            last_stats_time = now
                            d = msg["data"]
                            yields = d.get("yields", 0)
                            instr = d.get("instructions", 0)
                            mips = d.get("instructionsPerSec", 0)
                            yps = d.get("yieldsPerSec", 0)
                            dead = d.get("yieldDead", False)
                            err = d.get("yieldError", None)
                            renders = d.get("renders", 0)
                            ps = d.get("ps")
                            diag = d.get("diag")
                            
                            parts = [
                                f"yields={yields}",
                                f"instr={instr}",
                                f"MIPS={mips/1e6:.1f}" if mips else "MIPS=0",
                                f"y/s={yps:.0f}" if yps else "y/s=0",
                                f"renders={renders}",
                            ]
                            if dead:
                                parts.append("DEAD!")
                            if err:
                                parts.append(f"err={err}")
                            if ps:
                                parts.append(f"swap={ps.get('swapIns',0)} evict={ps.get('evictions',0)}")
                            if diag:
                                parts.append(f"batches={diag.get('batches',0)} wallMs={diag.get('lastWallMs',0)}")
                            
                            print(f"[{elapsed:6.1f}s] STATS: {' | '.join(parts)}")
                    
                    elif msg_type == "stats":
                        # Periodic stats (every 10s from server)
                        d = msg["data"]
                        if isinstance(d, dict):
                            yields = d.get("yields", 0)
                            print(f"[{elapsed:6.1f}s] PERIODIC: yields={yields} renders={d.get('renders',0)} dead={d.get('yieldDead',False)}")
                    
                    elif msg_type in ("full_frame", "delta_frame"):
                        if msg_counts.get(msg_type, 0) <= 3 or msg_counts.get(msg_type, 0) % 50 == 0:
                            print(f"[{elapsed:6.1f}s] {msg_type.upper()} ({msg['size']} bytes) [total={msg_counts[msg_type]}]")
                    
            finally:
                heartbeat_task.cancel()
                try:
                    await heartbeat_task
                except asyncio.CancelledError:
                    pass
    
    except Exception as e:
        print(f"[error] {e}")
    
    elapsed = time.time() - start_time
    print(f"\n{'='*60}")
    print(f"Test completed after {elapsed:.1f}s")
    print(f"Session: {session_id}")
    print(f"Image: {image}")
    print(f"Booted: {booted}")
    print(f"Graphical: {graphical_mode}")
    print(f"Message counts: {msg_counts}")
    print(f"Last status: {last_status}")
    print(f"Last screen line: {last_text.split(chr(10))[-1].strip() if last_text else '(none)'}")
    
    # Also fetch final stats via HTTP
    try:
        import ssl
        stats_url = f"https://{BASE_URL}/stats/{session_id}"
        req = urllib.request.Request(stats_url, headers={"User-Agent": "do86-test/1.0"})
        with urllib.request.urlopen(req, timeout=10, context=ssl.create_default_context()) as resp:
            stats = json.loads(resp.read())
            print(f"\nFinal HTTP stats:")
            for k in ["booted", "imageKey", "yields", "syncYields", "renders", "yieldDead", "yieldError"]:
                if k in stats:
                    print(f"  {k}: {stats[k]}")
            if "yieldDiag" in stats and stats["yieldDiag"]:
                diag = stats["yieldDiag"]
                print(f"  totalBatches: {diag.get('totalBatches',0)}")
                print(f"  avgBatchWallMs: {diag.get('avgBatchWallMs',0)}")
    except Exception as e:
        print(f"[stats] Failed to fetch: {e}")


def main():
    parser = argparse.ArgumentParser(description="Test do86 OS boot via WebSocket")
    parser.add_argument("--image", default="kolibri", help="Image to boot (kolibri, aqeous, etc.)")
    parser.add_argument("--fresh", action="store_true", help="Force fresh boot (clear snapshot)")
    parser.add_argument("--duration", type=int, default=180, help="Monitor duration in seconds")
    args = parser.parse_args()
    
    asyncio.run(monitor(args.image, args.fresh, args.duration))


if __name__ == "__main__":
    main()
