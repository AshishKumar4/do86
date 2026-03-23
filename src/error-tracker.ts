/**
 * Centralized error observability for do86.
 *
 * Every catch site calls `tracker.record(subsystem, message, error)`.
 * The tracker keeps:
 *   - A ring buffer of the last MAX_ERRORS errors (with timestamp, source, message, stack)
 *   - Per-subsystem error count + lastError string
 *
 * The stats response embeds `tracker.snapshot()` so every error is visible
 * from the /stats endpoint without needing wrangler tail.
 */

import { LOG_PREFIX } from "./types";

const MAX_ERRORS = 50;

export type Subsystem =
  | "yield"       // yield_callback crash, yield death
  | "pageStore"   // swapPageIn, clockEvict, SQLite page r/w
  | "disk"        // SqliteDiskBuffer reads, writes, ingest
  | "ws"          // WebSocket send/close/parse failures
  | "render"      // renderFrame, deltaEncoder, screen_fill_buffer
  | "boot"        // bootVM, selfLoadAssets, snapshot save/restore
  | "sqlite"      // low-level SQLite storage failures
  | "v86"         // WASM traps, JIT, emulator events
  ;

export interface ErrorEntry {
  time: number;    // Date.now()
  source: Subsystem;
  message: string;
  stack?: string;
}

interface SubsystemStats {
  count: number;
  lastError: string | null;
  lastTime: number | null;
}

export class ErrorTracker {
  private ring: ErrorEntry[] = [];
  private pos = 0;            // next write position in ring
  private total = 0;          // total errors ever recorded
  private subs = new Map<Subsystem, SubsystemStats>();

  /** Record an error.  Also logs to console.error. */
  record(source: Subsystem, message: string, error?: unknown): void {
    const stack = extractStack(error);
    const msg = error ? `${message}: ${stringifyError(error)}` : message;

    // Console log (always)
    console.error(`${LOG_PREFIX} [${source}] ${msg}`);
    if (stack) console.error(stack);

    // Ring buffer
    const entry: ErrorEntry = {
      time: Date.now(),
      source,
      message: msg,
      stack: stack || undefined,
    };

    if (this.ring.length < MAX_ERRORS) {
      this.ring.push(entry);
    } else {
      this.ring[this.pos] = entry;
    }
    this.pos = (this.pos + 1) % MAX_ERRORS;
    this.total++;

    // Per-subsystem counter
    let s = this.subs.get(source);
    if (!s) {
      s = { count: 0, lastError: null, lastTime: null };
      this.subs.set(source, s);
    }
    s.count++;
    s.lastError = msg.length > 200 ? msg.slice(0, 200) + "…" : msg;
    s.lastTime = entry.time;
  }

  /** Snapshot for /stats response.  Cheap — just references + map copy. */
  snapshot(): {
    total: number;
    recent: ErrorEntry[];
    subsystems: Record<string, SubsystemStats>;
  } {
    // Return ring in chronological order (oldest first)
    const recent: ErrorEntry[] = [];
    if (this.ring.length < MAX_ERRORS) {
      // Ring hasn't wrapped yet — entries are in order
      for (const e of this.ring) recent.push(e);
    } else {
      // Wrapped — oldest is at this.pos, newest is at this.pos-1
      for (let i = 0; i < MAX_ERRORS; i++) {
        recent.push(this.ring[(this.pos + i) % MAX_ERRORS]);
      }
    }

    const subsystems: Record<string, SubsystemStats> = {};
    for (const [k, v] of this.subs) {
      subsystems[k] = { ...v };
    }

    return { total: this.total, recent, subsystems };
  }
}

function stringifyError(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  try { return String(e); }
  catch { return "[unstringifiable]"; }
}

function extractStack(e: unknown): string | null {
  if (e instanceof Error && e.stack) {
    // Trim the first line (duplicates message) and limit length
    const lines = e.stack.split("\n");
    const stackOnly = lines.slice(1).join("\n").trim();
    return stackOnly.length > 500 ? stackOnly.slice(0, 500) + "…" : stackOnly;
  }
  return null;
}
