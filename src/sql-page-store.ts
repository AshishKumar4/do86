/**
 * sql-page-store.ts — SQLite-backed demand-paged RAM for Durable Objects.
 *
 * Architecture
 * ────────────
 * WASM linear memory layout (configured by caller via PageStoreConfig):
 *   mem8[0 .. poolBase)          — permanently resident guest RAM
 *   mem8[poolBase .. poolBase + frames×4KB) — hot page frame pool
 *
 * Guest sees logical_memory_size via CMOS/e820.  GPAs ≥ poolBase are
 * demand-paged: cold pages live in DO SQLite (ram_pages table, 4 KB BLOBs),
 * hot pages are resident in the frame pool and served via Clock eviction.
 *
 * Clock eviction (second-chance FIFO)
 * ────────────────────────────────────
 * Each frame has a single "referenced" bit.  The clock hand sweeps frames
 * in round-robin order:
 *   - referenced: clear bit, advance
 *   - unreferenced: evict (flush if dirty, reassign GPA)
 *
 * Compared to LRU:
 *   + O(1) eviction — no sort, no linked-list rebalancing
 *   + Very low per-access overhead (set one bit)
 *   + Second-chance prevents thrashing on working sets slightly > pool size
 *
 * forWriting parameter
 * ────────────────────
 * swapPageIn(gpa, forWriting) is called from do_page_walk via WASM import.
 * When forWriting is non-zero the frame is immediately marked dirty.  This is
 * correct because do_page_walk is building a writable TLB entry — the guest
 * WILL write to this frame — marking dirty eagerly avoids a separate hook.
 *
 * TLB flush on eviction
 * ─────────────────────
 * After evicting a frame, full_clear_tlb() is called once.  This invalidates
 * ALL TLB entries (including global), forcing do_page_walk for subsequent
 * accesses.  Cost: ~µs; paid at most once per eviction event.
 *
 * All public methods are SYNCHRONOUS.  No async, no Promises.
 * ctx.storage.sql.exec() is synchronous — returns SqlStorageCursor.
 */

import type { SqlHandle } from "./types";
import { LOG_PREFIX } from "./types";

// ── Page size (fixed by x86 architecture) ────────────────────────────────────

const PAGE_SIZE = 4096;

// ── PageStoreConfig ───────────────────────────────────────────────────────────

/**
 * All tunable parameters for SqlPageStore.
 * Pass a partial object to the constructor; unset fields use the defaults below.
 */
export interface PageStoreConfig {
  /**
   * Number of hot page frames.
   * Each frame is PAGE_SIZE (4 KB).  More frames = larger resident hot window
   * but more WASM linear memory consumed.
   * Default: 8192  (8192 × 4 KB = 32 MB hot window)
   */
  maxFrames: number;

  /**
   * Maximum number of frames the Clock hand scans in a single eviction call.
   * Caps worst-case latency when the pool is fully referenced.  Two full sweeps
   * (2 × maxFrames) is the theoretical worst case; this limit fires before that.
   * Default: 256
   */
  maxEvictScan: number;
}

export const DEFAULT_PAGE_STORE_CONFIG: PageStoreConfig = {
  maxFrames:    8192, // 8192 × 4 KB = 32 MB hot window
  maxEvictScan: 256,
};

// ── SqlPageStore ──────────────────────────────────────────────────────────────

export class SqlPageStore {
  private readonly cfg: PageStoreConfig;

  // ── Clock state ──────────────────────────────────────────────────────────

  /**
   * frameGpa[i]   = GPA currently in frame i, or -1 if free.
   * frameRef[i]   = referenced bit for Clock algorithm (0 or 1).
   * frameDirty[i] = dirty bit: modified since last SQLite flush (0 or 1).
   */
  private readonly frameGpa:   Int32Array;
  private readonly frameRef:   Uint8Array;
  private readonly frameDirty: Uint8Array;

  /** O(1) reverse map: GPA → frame index.  Only contains live (used) entries. */
  private readonly frameMap = new Map<number, number>();

  /** Clock hand position (0 .. maxFrames-1). */
  private clockHand = 0;

  /** Number of frames currently occupied. */
  private usedFrames = 0;

  // ── WASM heap ─────────────────────────────────────────────────────────────

  /** Uint8Array view into WASM linear memory. */
  private wasmHeap: Uint8Array | null = null;

  /** Byte offset in WASM heap where the frame pool starts (== PAGED_THRESHOLD). */
  private poolBase = 0;

  // ── CPU reference (for TLB flush) ─────────────────────────────────────────

  private cpu: { full_clear_tlb: () => void } | null = null;

  // ── SQLite ────────────────────────────────────────────────────────────────

  private schemaReady = false;

  // ── Counters ──────────────────────────────────────────────────────────────

  private _swapIns   = 0;
  private _evictions = 0;
  private _sqlReads  = 0;
  private _sqlWrites = 0;

  constructor(
    private readonly sql: SqlHandle,
    config: Partial<PageStoreConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_PAGE_STORE_CONFIG, ...config };

    this.frameGpa   = new Int32Array(this.cfg.maxFrames).fill(-1);
    this.frameRef   = new Uint8Array(this.cfg.maxFrames);
    this.frameDirty = new Uint8Array(this.cfg.maxFrames);
  }

  // ── Setup ─────────────────────────────────────────────────────────────────

  /**
   * Create the SQLite schema.  Idempotent — safe to call multiple times.
   * SYNCHRONOUS.
   */
  init(): void {
    if (this.schemaReady) return;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS ram_pages (
      gpa  INTEGER PRIMARY KEY,
      data BLOB NOT NULL
    )`);
    this.schemaReady = true;
  }

  /**
   * Set the WASM heap view and hot pool base offset.
   * Must be called after the WASM module is instantiated and before swapPageIn.
   *
   * @param heap      Uint8Array over the full WASM linear memory buffer.
   * @param poolBase  Byte offset where the frame pool starts (== PAGED_THRESHOLD).
   */
  setWasmHeap(heap: Uint8Array, poolBase: number): void {
    this.wasmHeap = heap;
    this.poolBase = poolBase;
  }

  /**
   * Set the v86 CPU reference for TLB invalidation after frame eviction.
   * Must be called before the first swapPageIn().
   */
  setCpu(cpu: { full_clear_tlb: () => void }): void {
    this.cpu = cpu;
  }

  // ── Core API ──────────────────────────────────────────────────────────────

  /**
   * Bring a guest page into the hot pool and return its WASM frame offset.
   *
   * Called synchronously from the WASM swap_page_in import (via
   * cpu._swap_page_in_hook).  The returned offset is substituted for `high`
   * in do_page_walk's TLB entry — same encoding as a normal resident page.
   *
   * @param gpa        Guest physical address (caller ensures page-aligned, ≥ poolBase).
   * @param forWriting Non-zero when the TLB entry is for a write — frame marked dirty.
   * @returns          WASM byte offset of the 4 KB frame, or -1 on error.
   */
  swapPageIn(gpa: number, forWriting: number): number {
    const pageGpa = gpa & ~(PAGE_SIZE - 1);
    this._swapIns++;

    // Fast path: page already in hot pool — refresh ref bit and return offset
    const existing = this.frameMap.get(pageGpa);
    if (existing !== undefined) {
      this.frameRef[existing] = 1;
      if (forWriting) this.frameDirty[existing] = 1;
      return this.poolBase + existing * PAGE_SIZE;
    }

    // Slow path: allocate a frame (may evict)
    const frame = this.allocateFrame();
    if (frame < 0) return -1;

    // Load page data from SQLite (or zero-fill if never written)
    const data = this.readFromSql(pageGpa);
    const offset = this.poolBase + frame * PAGE_SIZE;

    if (this.wasmHeap) {
      if (data) {
        this.wasmHeap.set(data, offset);
      } else {
        this.wasmHeap.fill(0, offset, offset + PAGE_SIZE);
      }
    }

    this.frameGpa[frame]   = pageGpa;
    this.frameRef[frame]   = 1;
    this.frameDirty[frame] = forWriting ? 1 : 0;
    this.frameMap.set(pageGpa, frame);
    this.usedFrames++;

    return offset;
  }

  /**
   * Flush all dirty frames to SQLite.
   * Call before snapshot save to ensure guest RAM is fully persisted.
   * SYNCHRONOUS.
   */
  flushDirty(): void {
    if (!this.wasmHeap) return;
    for (let i = 0; i < this.cfg.maxFrames; i++) {
      if (this.frameDirty[i] && this.frameGpa[i] >= 0) {
        const offset = this.poolBase + i * PAGE_SIZE;
        this.writeToSql(this.frameGpa[i], this.wasmHeap.subarray(offset, offset + PAGE_SIZE));
        this.frameDirty[i] = 0;
      }
    }
  }

  // ── Clock eviction ────────────────────────────────────────────────────────

  /**
   * Allocate one frame.  If free frames remain, returns the next free slot
   * (advancing clockHand to keep sequential locality).  If the pool is full,
   * runs the Clock sweep to evict one frame.
   *
   * Returns frame index ≥ 0, or -1 on failure.
   */
  private allocateFrame(): number {
    if (this.usedFrames < this.cfg.maxFrames) {
      // Linear scan from clockHand to find a free slot
      for (let i = 0; i < this.cfg.maxFrames; i++) {
        const idx = (this.clockHand + i) % this.cfg.maxFrames;
        if (this.frameGpa[idx] < 0) {
          this.clockHand = (idx + 1) % this.cfg.maxFrames;
          return idx;
        }
      }
    }
    return this.clockEvict();
  }

  /**
   * Clock sweep: advance the hand up to cfg.maxEvictScan steps, giving each
   * referenced frame a second chance (clear ref bit), and evicting the first
   * unreferenced frame found.
   *
   * If cfg.maxEvictScan is exhausted without finding an unreferenced frame,
   * a second pass is triggered (all bits were cleared in the first pass, so
   * the very next frame will be evictable).  Worst case: 2 × maxFrames steps.
   */
  private clockEvict(): number {
    // Two passes max: first clears all ref bits, second finds first victim
    const limit = this.cfg.maxFrames * 2;
    let evicted = -1;

    for (let scanned = 0; scanned < limit; scanned++) {
      const i = this.clockHand;
      this.clockHand = (this.clockHand + 1) % this.cfg.maxFrames;

      if (this.frameGpa[i] < 0) {
        evicted = i; // free slot — shouldn't happen but safe to take
        break;
      }

      if (this.frameRef[i]) {
        this.frameRef[i] = 0; // second chance — clear and keep going
        continue;
      }

      evicted = i; // unreferenced — evict
      break;
    }

    if (evicted < 0) {
      console.error(`${LOG_PREFIX} SqlPageStore: Clock eviction failed after ${limit} scans`);
      return -1;
    }

    // Flush dirty frame to SQLite before reuse
    if (this.frameDirty[evicted] && this.wasmHeap) {
      const offset = this.poolBase + evicted * PAGE_SIZE;
      this.writeToSql(this.frameGpa[evicted], this.wasmHeap.subarray(offset, offset + PAGE_SIZE));
      this.frameDirty[evicted] = 0;
    }

    // Unregister the old GPA
    this.frameMap.delete(this.frameGpa[evicted]);
    this.frameGpa[evicted]   = -1;
    this.frameRef[evicted]   = 0;
    this.usedFrames--;
    this._evictions++;

    // Invalidate all TLB entries so no stale entry references this frame's
    // old GPA mapping.  full_clear_tlb() is O(TLB_SIZE) ≈ microseconds.
    if (this.cpu) {
      try { this.cpu.full_clear_tlb(); } catch { /* non-fatal before first run */ }
    }

    return evicted;
  }

  // ── SQLite helpers ────────────────────────────────────────────────────────

  private readFromSql(gpa: number): Uint8Array | null {
    this.init();
    this._sqlReads++;
    const rows = [...this.sql.exec(`SELECT data FROM ram_pages WHERE gpa = ?`, gpa)];
    if (rows.length === 0) return null;

    const blob = rows[0].data;
    let data: Uint8Array;
    if (blob instanceof Uint8Array) {
      data = blob;
    } else if (blob instanceof ArrayBuffer) {
      data = new Uint8Array(blob);
    } else {
      data = new Uint8Array((blob as any).buffer ?? (blob as any));
    }

    if (data.length !== PAGE_SIZE) {
      const padded = new Uint8Array(PAGE_SIZE);
      padded.set(data.subarray(0, Math.min(data.length, PAGE_SIZE)));
      return padded;
    }
    return data;
  }

  private writeToSql(gpa: number, data: Uint8Array): void {
    this.init();
    this._sqlWrites++;
    const blob = data.length === PAGE_SIZE
      ? data
      : data.subarray(0, Math.min(data.length, PAGE_SIZE));
    this.sql.exec(`INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES (?, ?)`, gpa, blob);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get stats() {
    return {
      hotPages:    this.usedFrames,
      totalFrames: this.cfg.maxFrames,
      freeFrames:  this.cfg.maxFrames - this.usedFrames,
      swapIns:     this._swapIns,
      evictions:   this._evictions,
      sqlReads:    this._sqlReads,
      sqlWrites:   this._sqlWrites,
    };
  }
}
