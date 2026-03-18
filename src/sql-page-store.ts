/**
 * sql-page-store.ts — SQLite-backed demand-paged RAM for Durable Objects.
 *
 * Design:
 *   Hot pool:  Fixed number of 4KB page frames held in a JS Uint8Array.
 *              These are the pages the emulator can access at native speed.
 *   Cold store: All pages (including evicted hot pages) persisted in DO SQLite.
 *              `ctx.storage.sql.exec()` is SYNCHRONOUS — returns SqlStorageCursor,
 *              not a Promise. This is the critical enabler for demand-paged RAM
 *              without ASYNCIFY.
 *
 * Page fault flow (synchronous):
 *   1. Emulator memory miss → calls SqlPageStore.swapIn(gpa)
 *   2. swapIn checks hot map; if miss, reads from SQLite (sync!)
 *   3. If hot pool is full, evicts LRU frame → writes dirty page to SQLite
 *   4. Copies page data into the chosen frame buffer
 *   5. Returns the byte offset of the frame → emulator fills its TLB entry
 *
 * LRU eviction uses a simple access counter. The hot map tracks which GPA
 * is in which frame, and the frame→GPA reverse map enables eviction.
 *
 * All public methods are SYNCHRONOUS. No async, no Promises.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * INTEGRATION RESEARCH — v86/stratum memory hook points
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * The core challenge: v86's Rust code reads/writes guest physical memory as
 * `*mem8.offset(addr as isize)` — a direct raw pointer dereference in WASM
 * linear memory. There is no page-fault trap, no OS kernel, no signal handler.
 * The WASM sandbox makes OOB pointer writes a hard trap, not a catchable event.
 *
 * Three hook points were investigated (source: stratum/src/rust/cpu/memory.rs,
 * stratum/src/cpu.js, stratum/src/rust/cpu/cpu.rs):
 *
 * ── Approach 1: MMIO registration via io.mmap_register() ────────────────────
 *
 *   HOW IT WORKS:
 *   `io.mmap_register(addr, size, read8, write8, read32, write32)` registers
 *   JS callbacks for a 128 KB-aligned address range (MMAP_BLOCK_SIZE = 0x20000).
 *   The Rust `in_mapped_range(addr)` check is:
 *     addr >= 0xA0000 && addr < 0xC0000  ||  addr >= *memory_size
 *   Accesses that pass this test are dispatched to JS via the WASM import
 *   `mmap_read8`/`mmap_write8` etc., which look up cpu.memory_map_read8[addr>>>17].
 *   On CPU init, all addresses ≥ memory_size are already registered with a
 *   no-op handler (io.js:40: `this.mmap_register(memory_size, MMAP_MAX - memory_size, ...)`).
 *
 *   CAN WE USE IT FOR SWAP?
 *   Yes — but only for the address range ABOVE memory_size. The guest's page
 *   tables must map guest-virtual addresses to physical addresses ≥ memory_size
 *   so the Rust `in_mapped_range` check fires. Then our mmap_register handlers
 *   can serve pages from SQLite synchronously (ctx.storage.sql.exec() is sync).
 *   The constraint: memory_size must be small (≤ 32 MB) so that `*mem8` only
 *   covers the hot window. All cold pages must live at physical GPA ≥ memory_size.
 *   This requires the guest OS to cooperate — either the OS itself uses GPA
 *   above memory_size (it won't, since the BIOS reports memory_size as total RAM),
 *   or we fake a larger memory_size to the BIOS while keeping the WASM allocation
 *   small and catching the OOB. The latter is not possible: WASM linear memory
 *   has no guard pages and OOB access is a hard trap, not a fault we can intercept.
 *
 *   VERDICT: Viable only if we control the guest's physical memory map. For
 *   standard OSes (KolibriOS, Linux) booting from BIOS-reported RAM, this is
 *   not feasible without patching the BIOS E820 map and hoping the OS respects
 *   the upper hole — which is fragile and OS-specific.
 *
 * ── Approach 2: TLB miss interception (translate_address / do_page_walk) ────
 *
 *   HOW IT WORKS:
 *   In stratum/src/rust/cpu/cpu.rs, `translate_address()` converts guest-virtual
 *   to guest-physical by walking page tables. On TLB miss it calls `do_page_walk`.
 *   The TLB entry is:
 *     tlb_entry = (phys_addr + mem8 as u32) as i32 ^ virt_page << 12 | flags
 *   i.e. the TLB stores (host WASM offset) directly so that cache hits require
 *   zero arithmetic. The fast path in JIT-compiled code is just a TLB lookup and
 *   a raw memory read — there is no hook point between "TLB hit" and "mem access".
 *
 *   CAN WE INTERCEPT TLB MISSES?
 *   `do_page_walk` is pure Rust, not exported to JS. It is not overridable without
 *   recompiling the WASM. We could export a new WASM function `js_on_tlb_miss` as
 *   a WASM import (Rust `extern "C"`) and call it from `do_page_walk` before
 *   building the TLB entry, but this requires modifying stratum's Rust source.
 *   Even then, the callback would have to synchronously provide the host WASM
 *   offset for the page — meaning the page data must already be in WASM linear
 *   memory. We're back to needing the hot pool in WASM memory, which means
 *   memory_size must cover only hot pages.
 *
 *   VERDICT: Requires Rust source modification. Architecturally sound if we
 *   want to pursue SQLite-backed swap: add `extern "C" fn js_tlb_miss(gpa: u32)`
 *   to memory.rs, call it from `do_page_walk` before the TLB entry is stored,
 *   swap in a hot page from SQLite in the JS callback, and return its WASM
 *   offset. This is the cleanest long-term path.
 *
 * ── Approach 3: Shrink cpu.mem8 / trap out-of-bounds ────────────────────────
 *
 *   HOW IT WORKS:
 *   `cpu.mem8` (cpu.js:1004) is a Uint8Array view into WASM linear memory at
 *   the offset returned by `allocate_memory()`. Its size equals memory_size.
 *   The idea: allocate a small WASM memory (e.g. 8 MB hot window), let the
 *   emulator run, and catch the WASM trap when it accesses beyond mem8.length.
 *
 *   FATAL FLAW:
 *   WebAssembly OOB memory access is a hard trap (WebAssembly.RuntimeError:
 *   "memory access out of bounds") that terminates the WASM instance. It cannot
 *   be caught from inside the WASM module, and catching it from JS (try/catch
 *   around the WASM call) would require restarting the entire WASM instance —
 *   losing all emulator state. This approach is completely unworkable.
 *
 *   VERDICT: Not viable.
 *
 * ── Recommended integration path ─────────────────────────────────────────────
 *
 *   SHORT TERM (current): Reduce memory_size to 48 MB (fits in DO budget).
 *   SqlPageStore is used only for the HDA swap device (SQLiteBlockDevice), not
 *   for guest RAM paging. This is what's deployed today.
 *
 *   MEDIUM TERM: Modify stratum's Rust to export a `js_tlb_miss(gpa: u32) -> u32`
 *   WASM import hook called from `do_page_walk` (memory.rs / cpu.rs). The JS
 *   callback (in linux-vm.ts) would:
 *     1. Look up gpa in the hot map (SqlPageStore)
 *     2. If cold, evict an LRU hot frame to SQLite, load the cold page into that
 *        frame from SQLite (sync via ctx.storage.sql.exec)
 *     3. Return the WASM linear memory byte offset of the hot frame
 *   With memory_size = 8 MB (hot pool only), total WASM allocation stays small.
 *   The guest BIOS E820 map must report the full logical RAM size (e.g. 256 MB)
 *   even though WASM only backs 8 MB of it. The BIOS patch is ~10 lines in
 *   stratum/src/cpu.js where the E820 table is written to guest memory.
 *
 *   This file (SqlPageStore) already implements the hot/cold LRU and SQLite I/O.
 *   Wiring it to the TLB miss hook is the remaining work.
 */

import type { SqlHandle } from "./types";
import { LOG_PREFIX } from "./types";

// ── Page size ───────────────────────────────────────────────────────────────

/** x86 physical page size: 4 KB. */
const PAGE_SIZE = 4096;

// ── Constants ───────────────────────────────────────────────────────────────

/** Maximum number of hot page frames in WASM linear memory. */
const HOT_PAGES_MAX = 8192; // 8192 × 4KB = 32MB hot window

/** Number of pages to evict in a batch when the hot pool is full. */
const EVICT_BATCH = 256; // 256 × 4KB = 1MB per eviction batch

/** Flush dirty pages to SQLite after this many writes accumulate. */
const DIRTY_FLUSH_THRESHOLD = 512;

// ── Hot Page Entry ──────────────────────────────────────────────────────────

interface HotPageEntry {
  /** Guest physical address (page-aligned). */
  gpa: number;
  /** Index into the page frame pool (0..HOT_PAGES_MAX-1). */
  frameIndex: number;
  /** Whether this frame has been modified since last SQLite flush. */
  dirty: boolean;
  /** Monotonic counter for LRU ordering. */
  accessOrder: number;
}

// ── SqlPageStore ────────────────────────────────────────────────────────────

export class SqlPageStore {
  /**
   * GPA → hot page entry. Only pages currently resident in WASM memory.
   */
  private hotPages = new Map<number, HotPageEntry>();

  /**
   * Frame index → GPA. Reverse map for eviction: tells us which GPA
   * a frame currently holds so we can flush it before reuse.
   */
  private frameToGpa = new Map<number, number>();

  /**
   * Free frame indices (frames not currently mapped to any GPA).
   * Initialized with all frame indices on construction.
   */
  private freeFrames: number[] = [];

  /** Monotonic access counter for LRU. */
  private accessCounter = 0;

  /** Count of dirty pages since last flush. */
  private dirtyCount = 0;

  /** Whether the SQLite schema has been created. */
  private initialized = false;

  /** WASM heap byte array — set by QEMUWrapper after module init. */
  private wasmHeap: Uint8Array | null = null;

  /** Base offset in WASM heap where the page frame pool starts. */
  private poolBase = 0;

  /** Maximum number of frames in the pool. */
  private maxFrames: number;

  /** Public read-only access to max frame count (used by QEMUWrapper to size pool). */
  get maxFrameCount(): number {
    return this.maxFrames;
  }

  constructor(
    private readonly sql: SqlHandle,
    maxFrames: number = HOT_PAGES_MAX,
  ) {
    this.maxFrames = maxFrames;
    // Initialize free frame list (all frames available)
    for (let i = maxFrames - 1; i >= 0; i--) {
      this.freeFrames.push(i);
    }
  }

  /**
   * Initialize the SQLite schema. Idempotent.
   * SYNCHRONOUS — sql.exec() returns SqlStorageCursor, not Promise.
   */
  init(): void {
    if (this.initialized) return;

    this.sql.exec(`CREATE TABLE IF NOT EXISTS ram_pages (
      gpa     INTEGER PRIMARY KEY,
      data    BLOB NOT NULL,
      dirty   INTEGER DEFAULT 0
    )`);

    // Index for dirty page scans
    this.sql.exec(
      `CREATE INDEX IF NOT EXISTS idx_ram_dirty ON ram_pages(dirty) WHERE dirty = 1`,
    );

    this.initialized = true;
  }

  /**
   * Set the WASM heap reference and pool base offset.
   * Called by QEMUWrapper after the Emscripten module is initialized.
   */
  setWasmHeap(heap: Uint8Array, poolBase: number): void {
    this.wasmHeap = heap;
    this.poolBase = poolBase;
  }

  // ── Core page operations (all SYNCHRONOUS) ────────────────────────────

  /**
   * Swap a guest physical page into the hot pool (WASM linear memory).
   * Returns the WASM heap byte offset of the page frame.
   *
   * SYNCHRONOUS — this is the page fault handler called from QEMU's TLB miss.
   * The entire path (SQLite read, eviction, memcpy) is synchronous.
   *
   * @param gpa  Guest physical address (page-aligned)
   * @returns    WASM heap byte offset of the page frame, or -1 on error
   */
  swapIn(gpa: number): number {
    const pageAligned = gpa & ~(PAGE_SIZE - 1);

    // Check if already in hot pool
    const existing = this.hotPages.get(pageAligned);
    if (existing) {
      existing.accessOrder = ++this.accessCounter;
      return this.frameOffset(existing.frameIndex);
    }

    // Allocate a frame (may evict)
    const frameIndex = this.allocateFrame();
    if (frameIndex < 0) return -1;

    // Read page data from SQLite (SYNCHRONOUS)
    const data = this.readPageFromSql(pageAligned);

    // Copy into WASM memory
    const offset = this.frameOffset(frameIndex);
    if (this.wasmHeap && offset + PAGE_SIZE <= this.wasmHeap.byteLength) {
      if (data) {
        this.wasmHeap.set(data, offset);
      } else {
        // Zero page — never been written
        this.wasmHeap.fill(0, offset, offset + PAGE_SIZE);
      }
    }

    // Register in hot map
    const entry: HotPageEntry = {
      gpa: pageAligned,
      frameIndex,
      dirty: false,
      accessOrder: ++this.accessCounter,
    };
    this.hotPages.set(pageAligned, entry);
    this.frameToGpa.set(frameIndex, pageAligned);

    return offset;
  }

  /**
   * Read a 4KB page from the hot cache or SQLite.
   * Returns a copy of the page data.
   *
   * SYNCHRONOUS.
   */
  pageIn(gpa: number): Uint8Array {
    const pageAligned = gpa & ~(PAGE_SIZE - 1);

    // Check hot pool first
    const hot = this.hotPages.get(pageAligned);
    if (hot) {
      hot.accessOrder = ++this.accessCounter;
      const offset = this.frameOffset(hot.frameIndex);
      if (this.wasmHeap) {
        return this.wasmHeap.slice(offset, offset + PAGE_SIZE);
      }
    }

    // Read from SQLite
    const data = this.readPageFromSql(pageAligned);
    return data ?? new Uint8Array(PAGE_SIZE);
  }

  /**
   * Write a 4KB page into the hot cache. The page is marked dirty
   * and will be flushed to SQLite on eviction or explicit flush.
   *
   * SYNCHRONOUS.
   */
  pageOut(gpa: number, data: Uint8Array): void {
    const pageAligned = gpa & ~(PAGE_SIZE - 1);

    // If already hot, update in place
    const existing = this.hotPages.get(pageAligned);
    if (existing) {
      const offset = this.frameOffset(existing.frameIndex);
      if (this.wasmHeap) {
        this.wasmHeap.set(
          data.subarray(0, Math.min(data.length, PAGE_SIZE)),
          offset,
        );
      }
      existing.dirty = true;
      existing.accessOrder = ++this.accessCounter;
      this.dirtyCount++;
      this.flushIfNeeded();
      return;
    }

    // Allocate new frame
    const frameIndex = this.allocateFrame();
    if (frameIndex < 0) {
      // Fallback: write directly to SQLite
      this.writePageToSql(pageAligned, data);
      return;
    }

    // Copy into WASM memory
    const offset = this.frameOffset(frameIndex);
    if (this.wasmHeap) {
      this.wasmHeap.set(
        data.subarray(0, Math.min(data.length, PAGE_SIZE)),
        offset,
      );
    }

    const entry: HotPageEntry = {
      gpa: pageAligned,
      frameIndex,
      dirty: true,
      accessOrder: ++this.accessCounter,
    };
    this.hotPages.set(pageAligned, entry);
    this.frameToGpa.set(frameIndex, pageAligned);

    this.dirtyCount++;
    this.flushIfNeeded();
  }

  /**
   * Check if a page exists in the hot cache.
   */
  hasPage(gpa: number): boolean {
    return this.hotPages.has(gpa & ~(PAGE_SIZE - 1));
  }

  /**
   * Flush all dirty hot pages to SQLite.
   *
   * SYNCHRONOUS. Called periodically from QEMUWrapper.postTick()
   * and on eviction.
   */
  flushDirty(): void {
    if (!this.wasmHeap) return;

    for (const [, entry] of this.hotPages) {
      if (entry.dirty) {
        const offset = this.frameOffset(entry.frameIndex);
        const data = this.wasmHeap.slice(offset, offset + PAGE_SIZE);
        this.writePageToSql(entry.gpa, data);
        entry.dirty = false;
      }
    }

    this.dirtyCount = 0;
  }

  // ── Frame allocation & eviction ───────────────────────────────────────

  /**
   * Allocate a page frame. Returns frame index (0-based).
   * If no free frames, evicts LRU pages first.
   */
  private allocateFrame(): number {
    if (this.freeFrames.length > 0) {
      return this.freeFrames.pop()!;
    }

    // Need to evict — find LRU pages
    this.evictLRU();

    if (this.freeFrames.length > 0) {
      return this.freeFrames.pop()!;
    }

    // Should not happen if eviction works correctly
    console.error(`${LOG_PREFIX} SqlPageStore: frame allocation failed after eviction`);
    return -1;
  }

  /**
   * Evict the least-recently-used pages from the hot pool.
   * Dirty pages are flushed to SQLite before eviction.
   *
   * SYNCHRONOUS.
   */
  private evictLRU(): void {
    // Collect all entries, sort by access order (ascending = oldest first)
    const entries = [...this.hotPages.values()]
      .sort((a, b) => a.accessOrder - b.accessOrder);

    let evicted = 0;
    for (const entry of entries) {
      if (evicted >= EVICT_BATCH) break;

      // Flush dirty page to SQLite before eviction
      if (entry.dirty && this.wasmHeap) {
        const offset = this.frameOffset(entry.frameIndex);
        const data = this.wasmHeap.slice(offset, offset + PAGE_SIZE);
        this.writePageToSql(entry.gpa, data);
      }

      // Remove from hot maps
      this.hotPages.delete(entry.gpa);
      this.frameToGpa.delete(entry.frameIndex);

      // Return frame to free list
      this.freeFrames.push(entry.frameIndex);
      evicted++;
    }

    if (evicted > 0) {
      this.dirtyCount = 0; // Reset after flush
    }
  }

  /**
   * Trigger flush if dirty count exceeds threshold.
   */
  private flushIfNeeded(): void {
    if (this.dirtyCount >= DIRTY_FLUSH_THRESHOLD) {
      this.flushDirty();
    }
  }

  // ── SQLite operations (SYNCHRONOUS) ───────────────────────────────────

  /**
   * Read a page from SQLite. Returns null if the page has never been written.
   *
   * SYNCHRONOUS — sql.exec() returns SqlStorageCursor.
   */
  private readPageFromSql(gpa: number): Uint8Array | null {
    this.init();

    const rows = [...this.sql.exec(
      `SELECT data FROM ram_pages WHERE gpa = ?`, gpa,
    )];

    if (rows.length === 0) return null;

    const blob = rows[0].data;
    let data: Uint8Array;

    if (blob instanceof ArrayBuffer) {
      data = new Uint8Array(blob);
    } else if (blob instanceof Uint8Array) {
      data = blob;
    } else {
      // SqlStorageCursor may return blob as ArrayBufferLike
      data = new Uint8Array(
        (blob as { buffer: ArrayBuffer }).buffer ?? blob as ArrayBuffer,
      );
    }

    // Ensure exactly PAGE_SIZE bytes
    if (data.length !== PAGE_SIZE) {
      const padded = new Uint8Array(PAGE_SIZE);
      padded.set(data.subarray(0, Math.min(data.length, PAGE_SIZE)));
      return padded;
    }

    return data;
  }

  /**
   * Write a page to SQLite.
   *
   * SYNCHRONOUS — sql.exec() returns SqlStorageCursor.
   */
  private writePageToSql(gpa: number, data: Uint8Array): void {
    this.init();

    // Ensure we write exactly PAGE_SIZE bytes
    const blob = data.length === PAGE_SIZE
      ? data
      : data.subarray(0, Math.min(data.length, PAGE_SIZE));

    this.sql.exec(
      `INSERT OR REPLACE INTO ram_pages (gpa, data, dirty) VALUES (?, ?, 1)`,
      gpa,
      blob,
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────

  /**
   * Compute the WASM heap byte offset for a given frame index.
   */
  private frameOffset(frameIndex: number): number {
    return this.poolBase + frameIndex * PAGE_SIZE;
  }

  // ── Stats ─────────────────────────────────────────────────────────────

  get stats(): {
    hotPages: number;
    dirtyPages: number;
    freeFrames: number;
    totalFrames: number;
    accessCounter: number;
  } {
    let dirty = 0;
    for (const entry of this.hotPages.values()) {
      if (entry.dirty) dirty++;
    }
    return {
      hotPages: this.hotPages.size,
      dirtyPages: dirty,
      freeFrames: this.freeFrames.length,
      totalFrames: this.maxFrames,
      accessCounter: this.accessCounter,
    };
  }
}
