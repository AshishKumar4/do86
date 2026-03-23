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
 * WASM-side pool map (page_pool.rs)
 * ──────────────────────────────────
 * pool_lookup(gpa) → wasm_offset | -1   (pure WASM, called from do_page_walk)
 * pool_register(gpa, wasm_offset)        (called from JS after SQLite load)
 * pool_unregister(gpa)                   (called from JS on eviction)
 *
 * pool_lookup runs entirely in WASM (no FFI) on warm misses.  Only cold misses
 * (page not yet loaded) cross to JS swap_page_in, which hits SQLite and then
 * calls pool_register so the next access is a WASM-side hit.
 *
 * Clock eviction (second-chance FIFO)
 * ────────────────────────────────────
 * Reference bits live in WASM (REF_MAP[gpa>>12]).  pool_lookup sets them;
 * pool_get_ref / pool_clear_ref let JS read and clear them during the Clock
 * sweep.  This keeps both sides consistent without duplicating state.
 *
 * forWriting parameter
 * ────────────────────
 * swapPageIn(gpa, forWriting) is called from do_page_walk via WASM import.
 * When forWriting is non-zero the frame is immediately marked dirty.
 *
 * TLB flush on eviction
 * ─────────────────────
 * After evicting frames, full_clear_tlb() is called ONCE per swapPageIn that
 * triggered eviction — not per individual frame.  This avoids cascade TLB
 * thrashing during page fault storms.
 *
 * All public methods are SYNCHRONOUS.  No async, no Promises.
 * ctx.storage.sql.exec() is synchronous — returns SqlStorageCursor.
 */

import type { SqlHandle } from "./types";
import { LOG_PREFIX } from "./types";
import type { ErrorTracker } from "./error-tracker";

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
   * Caps worst-case latency when the pool is fully referenced.
   * Default: 256
   */
  maxEvictScan: number;
}

export const DEFAULT_PAGE_STORE_CONFIG: PageStoreConfig = {
  maxFrames:    8192, // 8192 × 4 KB = 32 MB hot window
  maxEvictScan: 256,
};

// ── WASM pool exports (page_pool.rs) ─────────────────────────────────────────

/**
 * Thin wrappers around the exported WASM page_pool functions.
 * Populated by setWasmExports() once the WASM instance is available.
 */
interface PoolExports {
  pool_register:   (gpa: number, wasmOffset: number) => void;
  pool_unregister: (gpa: number) => void;
  pool_get_ref:    (gpa: number) => number;
  pool_clear_ref:  (gpa: number) => void;
  pool_reset:      () => void;
}

// ── SqlPageStore ──────────────────────────────────────────────────────────────

export class SqlPageStore {
  private readonly cfg: PageStoreConfig;

  // ── Clock state ──────────────────────────────────────────────────────────

  /**
   * frameGpa[i]   = GPA currently in frame i, or -1 if free.
   * frameDirty[i] = dirty bit: modified since last SQLite flush (0 or 1).
   *
   * Reference bits are stored in WASM REF_MAP (page_pool.rs) and accessed
   * via pool_get_ref / pool_clear_ref.  JS does NOT maintain a separate
   * frameRef array — WASM is the authoritative source.
   */
  private readonly frameGpa:   Int32Array;
  private readonly frameDirty: Uint8Array;

  /** O(1) reverse map: GPA → frame index.  Only contains live (used) entries. */
  private readonly frameMap = new Map<number, number>();

  /** Clock hand position (0 .. maxFrames-1). */
  private clockHand = 0;

  /** Number of frames currently occupied. */
  private usedFrames = 0;

  // ── Free-list (stack) ────────────────────────────────────────────────────
  // O(1) frame allocation/deallocation instead of O(N) linear scan.
  // _freeList[0.._freeTop) contains indices of free frames.

  private readonly _freeList: Int32Array;
  private _freeTop: number;

  // ── WASM handles ─────────────────────────────────────────────────────────

  /**
   * The WebAssembly.Memory object.  Held (not a Uint8Array snapshot) so we
   * survive WASM memory growth events (allocate_memory during cpu.init).
   */
  private wasmMemory: WebAssembly.Memory | null = null;

  /** Byte offset in WASM heap where the frame pool starts (== PAGED_THRESHOLD). */
  private poolBase = 0;

  /** Shared error tracker — set via setErrorTracker(). */
  private _errors: ErrorTracker | null = null;

  /** Exported pool_* functions from page_pool.rs (set via setWasmExports). */
  private pool: PoolExports | null = null;

  // ── Cached heap view ─────────────────────────────────────────────────────
  // Avoids creating new Uint8Array(wasmMemory.buffer) on every hot-path call.
  // Invalidated when the underlying ArrayBuffer is detached (WASM memory grow).

  private _heapView: Uint8Array | null = null;
  private _heapBuffer: ArrayBuffer | null = null;

  // ── CPU reference (for TLB flush) ─────────────────────────────────────────

  private cpu: { full_clear_tlb: () => void } | null = null;

  // ── SQLite ────────────────────────────────────────────────────────────────

  private schemaReady = false;

  // ── Deferred eviction write queue ──────────────────────────────────────────
  // During page fault storms, multiple clockEvict() calls happen synchronously.
  // Instead of writing each dirty evicted frame individually, we queue the writes
  // and flush them in a single multi-row INSERT on the next microtask.
  // Uses a Map for O(1) lookup/delete by GPA.
  private _pendingWriteMap = new Map<number, Uint8Array>();
  private _writeFlushScheduled = false;

  // ── Counters ──────────────────────────────────────────────────────────────

  private _swapIns       = 0;
  private _wasmHits      = 0;
  private _evictions     = 0;
  private _tlbFlushes    = 0;
  private _sqlReads      = 0;
  private _sqlWrites     = 0;
  private _sqlReadMs     = 0;
  private _sqlWriteMs    = 0;
  private _batchWrites   = 0;   // number of batched write flushes
  private _batchWriteRows = 0;  // total rows written in batches

  constructor(
    private readonly sql: SqlHandle,
    config: Partial<PageStoreConfig> = {},
  ) {
    this.cfg = { ...DEFAULT_PAGE_STORE_CONFIG, ...config };

    this.frameGpa   = new Int32Array(this.cfg.maxFrames).fill(-1);
    this.frameDirty = new Uint8Array(this.cfg.maxFrames);

    // Initialize free-list: all frames are free, pushed in reverse order
    // so that frame 0 is allocated first (popped last → LIFO).
    this._freeList = new Int32Array(this.cfg.maxFrames);
    for (let i = 0; i < this.cfg.maxFrames; i++) {
      this._freeList[i] = this.cfg.maxFrames - 1 - i;
    }
    this._freeTop = this.cfg.maxFrames;
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
   * Set the WebAssembly.Memory object and hot pool base offset.
   * Call inside wasm_fn immediately after WebAssembly.instantiate completes.
   */
  setWasmMemory(memory: WebAssembly.Memory, poolBase: number): void {
    this.wasmMemory = memory;
    this.poolBase = poolBase;
    // Invalidate cached heap view — will be recreated on next access
    this._heapView = null;
    this._heapBuffer = null;
  }

  /**
   * Set the exported WASM functions from page_pool.rs.
   * Call inside wasm_fn after WebAssembly.instantiate:
   *   pageStore.setWasmExports(instance.exports);
   *
   * Falls back gracefully if the exports are absent (older WASM build).
   */
  setWasmExports(exports: Record<string, unknown>): void {
    const r = exports["pool_register"];
    const u = exports["pool_unregister"];
    const g = exports["pool_get_ref"];
    const c = exports["pool_clear_ref"];
    const rst = exports["pool_reset"];
    if (typeof r === "function" && typeof u === "function" &&
        typeof g === "function" && typeof c === "function" &&
        typeof rst === "function") {
      this.pool = {
        pool_register:   r as PoolExports["pool_register"],
        pool_unregister: u as PoolExports["pool_unregister"],
        pool_get_ref:    g as PoolExports["pool_get_ref"],
        pool_clear_ref:  c as PoolExports["pool_clear_ref"],
        pool_reset:      rst as PoolExports["pool_reset"],
      };
    } else {
      console.warn(`${LOG_PREFIX} SqlPageStore: pool_* WASM exports not found — falling back to JS-only mode`);
      this.pool = null;
    }
  }

  /**
   * @deprecated Use setWasmMemory(). Kept for compatibility.
   */
  setWasmHeap(heap: Uint8Array, poolBase: number): void {
    this.wasmMemory = { buffer: heap.buffer } as unknown as WebAssembly.Memory;
    this.poolBase = poolBase;
    this._heapView = null;
    this._heapBuffer = null;
  }

  /**
   * Set the v86 CPU reference for TLB invalidation after frame eviction.
   */
  setCpu(cpu: { full_clear_tlb: () => void }): void {
    this.cpu = cpu;
  }

  /** Inject the shared error tracker for observability. */
  setErrorTracker(tracker: ErrorTracker): void {
    this._errors = tracker;
  }

  // ── Core API ──────────────────────────────────────────────────────────────

  /**
   * Bring a guest page into the hot pool and return its WASM frame offset.
   *
   * This is the JS cold-miss handler.  It is called from the WASM swap_page_in
   * import ONLY when pool_lookup returns -1 (page not yet in pool).
   *
   * After placing the frame, it calls pool_register so subsequent TLB misses
   * for the same page are handled entirely in WASM (no FFI).
   *
   * @param gpa        Guest physical address (page-aligned, ≥ poolBase).
   * @param forWriting Non-zero when the TLB entry is for a write — frame marked dirty.
   * @returns          WASM byte offset of the 4 KB frame, or -1 on error.
   */
  swapPageIn(gpa: number, forWriting: number): number {
    try { return this._swapPageInInner(gpa, forWriting); }
    catch (e) {
      this._errors?.record("pageStore", `swapPageIn crashed gpa=0x${gpa.toString(16)}`, e);
      return -1;
    }
  }

  private _swapPageInInner(gpa: number, forWriting: number): number {
    const pageGpa = gpa & ~(PAGE_SIZE - 1);
    this._swapIns++;

    // Fast path: page already tracked in JS frameMap (should be rare now that
    // pool_lookup handles warm misses in WASM, but kept for safety).
    const existing = this.frameMap.get(pageGpa);
    if (existing !== undefined) {
      if (forWriting) this.frameDirty[existing] = 1;
      // Re-register in WASM to refresh ref bit (pool_lookup already did this
      // on the WASM path, but we may arrive here from an older code path).
      if (this.pool) {
        this.pool.pool_register(pageGpa, this.poolBase + existing * PAGE_SIZE);
      }
      return this.poolBase + existing * PAGE_SIZE;
    }

    // Identity path: GPA falls within the hot pool's WASM allocation.
    // mem8[poolBase .. poolBase + maxFrames*PAGE_SIZE) is already physically
    // backed by allocate_memory(). Real-mode BIOS writes land directly here.
    // Register at the natural WASM offset (== GPA) without zero-filling.
    const hotPoolEnd = this.poolBase + this.cfg.maxFrames * PAGE_SIZE;
    if (pageGpa < hotPoolEnd) {
      const frameIdx = (pageGpa - this.poolBase) / PAGE_SIZE;
      this.frameGpa[frameIdx]   = pageGpa;
      this.frameDirty[frameIdx] = forWriting ? 1 : 0;
      this.frameMap.set(pageGpa, frameIdx);
      this.usedFrames++;
      // Remove from free-list if present (identity frames are pre-populated,
      // but the free-list was initialized with all indices).
      // This is a no-op cost since identity path only fires during early boot.
      if (this.pool) {
        this.pool.pool_register(pageGpa, pageGpa); // wasm_offset == gpa for pool region
      }
      return pageGpa;
    }

    // SQLite path: GPA is above memory_size — allocate a frame, load from SQLite.
    const frame = this.allocateFrame();
    if (frame < 0) return -1;

    const offset = this.poolBase + frame * PAGE_SIZE;

    // Check pending writes first — a page may have been evicted (dirty data
    // queued for microtask flush) but not yet written to SQLite.  If we read
    // from SQLite we'd get stale/null data, silently corrupting guest state.
    let data: Uint8Array | null = this.takePendingWrite(pageGpa);
    if (!data) {
      data = this.readFromSql(pageGpa);
    }

    const heap = this.getHeap();
    if (heap) {
      if (data) {
        heap.set(data, offset);
      } else {
        heap.fill(0, offset, offset + PAGE_SIZE);
      }
    }

    this.frameGpa[frame]   = pageGpa;
    this.frameDirty[frame] = forWriting ? 1 : 0;
    this.frameMap.set(pageGpa, frame);
    this.usedFrames++;

    // Register in WASM so future TLB misses are handled by pool_lookup (no FFI).
    if (this.pool) {
      this.pool.pool_register(pageGpa, offset);
    }

    return offset;
  }

  /**
   * Flush all dirty frames to SQLite.
   * Call before snapshot save to ensure guest RAM is fully persisted.
   * Uses multi-row INSERT OR REPLACE for batch efficiency.
   * Also flushes any pending deferred writes.
   * SYNCHRONOUS.
   */
  flushDirty(): void {
    // First, flush any deferred eviction writes
    this.flushPendingWrites();

    const heap = this.getHeap();
    if (!heap) return;

    // Collect all dirty frames
    const BATCH = 64;
    const batch: Array<{ gpa: number; data: Uint8Array }> = [];

    for (let i = 0; i < this.cfg.maxFrames; i++) {
      if (this.frameDirty[i] && this.frameGpa[i] >= 0) {
        const offset = this.poolBase + i * PAGE_SIZE;
        // Copy data since we may process many frames
        const copy = new Uint8Array(PAGE_SIZE);
        copy.set(heap.subarray(offset, offset + PAGE_SIZE));
        batch.push({ gpa: this.frameGpa[i], data: copy });
        this.frameDirty[i] = 0;
      }
    }

    if (batch.length === 0) return;
    this.init();
    const t0 = performance.now();

    for (let i = 0; i < batch.length; i += BATCH) {
      const chunk = batch.slice(i, i + BATCH);
      if (chunk.length === 1) {
        this.sql.exec(
          `INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES (?, ?)`,
          chunk[0].gpa, chunk[0].data,
        );
      } else {
        const placeholders = chunk.map(() => "(?,?)").join(",");
        const params: any[] = [];
        for (const entry of chunk) {
          params.push(entry.gpa, entry.data);
        }
        this.sql.exec(
          `INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES ${placeholders}`,
          ...params,
        );
      }
      this._sqlWrites += chunk.length;
      this._batchWriteRows += chunk.length;
    }

    this._batchWrites++;
    this._sqlWriteMs += performance.now() - t0;
  }

  // ── Frame allocation ─────────────────────────────────────────────────────

  /**
   * Allocate a free frame.  Uses the free-list (O(1) amortized) when available,
   * falls back to Clock eviction when pool is full.
   *
   * When eviction occurs, full_clear_tlb() is called ONCE after eviction
   * completes — not inside clockEvict itself.
   *
   * Note: the free-list may contain stale entries (frames claimed by the
   * identity path without popping).  We skip those by checking frameGpa.
   */
  private allocateFrame(): number {
    // O(1) free-list pop — skip stale entries (claimed by identity path)
    while (this._freeTop > 0) {
      const idx = this._freeList[--this._freeTop];
      if (this.frameGpa[idx] < 0) {
        return idx;
      }
      // Stale entry — frame was claimed by identity path; discard and try next
    }

    // Pool full — evict via Clock algorithm
    const evicted = this.clockEvict();
    if (evicted >= 0) {
      // Single TLB flush after eviction — avoids per-eviction cascade
      if (this.cpu) {
        try { this.cpu.full_clear_tlb(); } catch (e) { this._errors?.record("pageStore", "full_clear_tlb failed", e); }
      }
      this._tlbFlushes++;
    }
    return evicted;
  }

  /**
   * Clock sweep using WASM-side reference bits (pool_get_ref / pool_clear_ref).
   * This keeps the ref bit authoritative in WASM while JS drives the sweep.
   *
   * Does NOT call full_clear_tlb() — the caller (allocateFrame) does that
   * once after eviction to avoid cascade TLB thrashing.
   */
  private clockEvict(): number {
    const limit = this.cfg.maxFrames * 2;
    let evicted = -1;

    for (let scanned = 0; scanned < limit; scanned++) {
      const i = this.clockHand;
      this.clockHand = (this.clockHand + 1) % this.cfg.maxFrames;

      if (this.frameGpa[i] < 0) {
        evicted = i;
        break;
      }

      // Read ref bit from WASM (set by pool_lookup on every warm miss).
      const gpa = this.frameGpa[i];
      const ref = this.pool ? this.pool.pool_get_ref(gpa) : 0;

      if (ref) {
        // Second chance: clear ref bit and continue.
        if (this.pool) this.pool.pool_clear_ref(gpa);
        continue;
      }

      evicted = i;
      break;
    }

    if (evicted < 0) {
      this._errors?.record("pageStore", `Clock eviction failed after ${limit} scans (used=${this.usedFrames}/${this.cfg.maxFrames})`);
      return -1;
    }

    // Defer dirty frame write — batched on next microtask for storm efficiency.
    const heap = this.getHeap();
    if (this.frameDirty[evicted] && heap) {
      const offset = this.poolBase + evicted * PAGE_SIZE;
      this.deferWrite(this.frameGpa[evicted], heap.subarray(offset, offset + PAGE_SIZE));
      this.frameDirty[evicted] = 0;
    }

    // Unregister from WASM pool map so pool_lookup returns -1 for this GPA.
    const evictedGpa = this.frameGpa[evicted];
    if (this.pool) {
      this.pool.pool_unregister(evictedGpa);
    }

    this.frameMap.delete(evictedGpa);
    this.frameGpa[evicted] = -1;
    this.usedFrames--;
    this._evictions++;

    // NOTE: TLB flush is done by the caller (allocateFrame), not here.

    return evicted;
  }

  // ── SQLite helpers ────────────────────────────────────────────────────────

  private readFromSql(gpa: number): Uint8Array | null {
    this.init();
    this._sqlReads++;
    const t0 = performance.now();
    const rows = [...this.sql.exec(`SELECT data FROM ram_pages WHERE gpa = ?`, gpa)];
    this._sqlReadMs += performance.now() - t0;
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
    const t0 = performance.now();
    const blob = data.length === PAGE_SIZE
      ? data
      : data.subarray(0, Math.min(data.length, PAGE_SIZE));
    this.sql.exec(`INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES (?, ?)`, gpa, blob);
    this._sqlWriteMs += performance.now() - t0;
  }

  /**
   * Extract a page from the pending write Map, if present.
   * Returns the page data and removes it from the Map, or null if not found.
   * O(1) lookup + delete via Map (replaces O(N) linear scan + splice).
   *
   * Called by swapPageIn to recover dirty data that was evicted but not yet
   * flushed to SQLite (microtask hasn't fired).  Without this, re-loading an
   * evicted page reads stale/null data from SQLite — silent data corruption.
   */
  private takePendingWrite(gpa: number): Uint8Array | null {
    const data = this._pendingWriteMap.get(gpa);
    if (data !== undefined) {
      this._pendingWriteMap.delete(gpa);
      return data;
    }
    return null;
  }

  /**
   * Queue a dirty page for deferred batch write.
   * The actual SQL write happens on the next microtask via flushPendingWrites().
   * During page fault storms this batches many eviction writes into one statement.
   */
  private deferWrite(gpa: number, data: Uint8Array): void {
    // Copy the data since the frame will be reused immediately after eviction
    const copy = new Uint8Array(PAGE_SIZE);
    copy.set(data.subarray(0, PAGE_SIZE));
    this._pendingWriteMap.set(gpa, copy);

    if (!this._writeFlushScheduled) {
      this._writeFlushScheduled = true;
      queueMicrotask(() => this.flushPendingWrites());
    }
  }

  /**
   * Flush all deferred writes in batched multi-row INSERT OR REPLACE statements.
   * Batch size capped at 64 rows per statement to avoid SQLite query limits.
   */
  private flushPendingWrites(): void {
    this._writeFlushScheduled = false;
    const pending = this._pendingWriteMap;
    if (pending.size === 0) return;
    try { this._flushPendingWritesInner(pending); }
    catch (e) { this._errors?.record("pageStore", `flushPendingWrites failed (${pending.size} rows)`, e); }
  }

  private _flushPendingWritesInner(pending: Map<number, Uint8Array>): void {

    // Snapshot and clear the map atomically
    const entries = Array.from(pending.entries());
    pending.clear();

    this.init();
    const t0 = performance.now();
    const BATCH = 64;

    for (let i = 0; i < entries.length; i += BATCH) {
      const chunk = entries.slice(i, i + BATCH);
      if (chunk.length === 1) {
        // Single row — no overhead for non-storm case
        this.sql.exec(
          `INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES (?, ?)`,
          chunk[0][0], chunk[0][1],
        );
      } else {
        // Multi-row batch: INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES (?,?),(?,?),...
        const placeholders = chunk.map(() => "(?,?)").join(",");
        const params: any[] = [];
        for (const [entryGpa, entryData] of chunk) {
          params.push(entryGpa, entryData);
        }
        this.sql.exec(
          `INSERT OR REPLACE INTO ram_pages (gpa, data) VALUES ${placeholders}`,
          ...params,
        );
      }
      this._sqlWrites += chunk.length;
      this._batchWriteRows += chunk.length;
    }

    this._batchWrites++;
    this._sqlWriteMs += performance.now() - t0;
  }

  // ── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Return a cached Uint8Array view of WASM linear memory.
   * The view is recreated only when the underlying ArrayBuffer changes
   * (WASM memory growth detaches the old buffer).
   */
  private getHeap(): Uint8Array | null {
    if (!this.wasmMemory) return null;
    const buf = this.wasmMemory.buffer;
    if (buf !== this._heapBuffer || !this._heapView) {
      this._heapBuffer = buf;
      this._heapView = new Uint8Array(buf);
    }
    return this._heapView;
  }

  /** @deprecated Use getHeap(). Kept for any external callers. */
  private get heap(): Uint8Array | null {
    return this.getHeap();
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  get stats() {
    return {
      hotPages:       this.usedFrames,
      totalFrames:    this.cfg.maxFrames,
      freeFrames:     this.cfg.maxFrames - this.usedFrames,
      swapIns:        this._swapIns,
      evictions:      this._evictions,
      tlbFlushes:     this._tlbFlushes,
      sqlReads:       this._sqlReads,
      sqlWrites:      this._sqlWrites,
      sqlReadMs:      Math.round(this._sqlReadMs),
      sqlWriteMs:     Math.round(this._sqlWriteMs),
      batchWrites:    this._batchWrites,
      batchWriteRows: this._batchWriteRows,
      pendingWrites:  this._pendingWriteMap.size,
      hasWasmPool:    this.pool !== null,
    };
  }

  /** Alias for external callers that want a plain object snapshot. */
  getStats() { return this.stats; }
}
