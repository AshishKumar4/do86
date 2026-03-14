/**
 * memory-coherence.ts — Page-level memory coherence for distributed SMP.
 *
 * Implements a directory-based protocol where the coordinator holds canonical
 * page data and cores maintain local caches with ABSENT/SHARED/WRITABLE states.
 */

// ── Constants ────────────────────────────────────────────────────────────────

export const PAGE_SIZE = 4096;
export const PAGE_SHIFT = 12;

/** Align a physical address down to its page boundary. */
export function pageAlign(physAddr: number): number {
  return physAddr & ~(PAGE_SIZE - 1);
}

/** Convert physical address to page number. */
export function pageNumber(physAddr: number): number {
  return physAddr >>> PAGE_SHIFT;
}

// ── Page States ──────────────────────────────────────────────────────────────

/** Coordinator's view of each page. */
export const enum DirPageState {
  /** Canonical data is up-to-date. Any core may hold a SHARED copy. */
  CLEAN = 0,
  /** A specific core owns the sole writable copy. Canonical data is stale. */
  OWNED = 1,
}

/** Core's local view of each page. */
export const enum CorePageState {
  /** Core does not have this page. Must fetch on access. */
  ABSENT = 0,
  /** Core has a read-only copy. Write requires upgrade via coordinator. */
  SHARED = 1,
  /** Core owns the sole writable copy. Coordinator knows. */
  WRITABLE = 2,
}

// ── Coordinator Page Directory ───────────────────────────────────────────────

export interface DirEntry {
  state: DirPageState;
  /** APIC ID of the owning core (only valid when state === OWNED). */
  owner: number;
  /** Set of core APIC IDs that hold a SHARED copy. */
  sharers: Set<number>;
  /** Canonical page data (4KB). Null if never written. */
  data: ArrayBuffer | null;
}

/**
 * PageDirectory — lives in the CoordinatorDO.
 *
 * Tracks ownership and sharing of every physical page across all cores.
 * Provides the RPC-facing methods that cores call for page fetches, upgrades,
 * and writebacks.
 */
export class PageDirectory {
  private pages = new Map<number, DirEntry>();
  private totalMemoryBytes: number;

  constructor(memorySizeBytes: number) {
    this.totalMemoryBytes = memorySizeBytes;
  }

  /** Get or create a directory entry for a page. */
  private getEntry(pageNum: number): DirEntry {
    let entry = this.pages.get(pageNum);
    if (!entry) {
      entry = {
        state: DirPageState.CLEAN,
        owner: -1,
        sharers: new Set(),
        data: null, // Zeroed page — never been written
      };
      this.pages.set(pageNum, entry);
    }
    return entry;
  }

  /**
   * Called during boot: bulk-assign all pages to Core 0 (BSP) as OWNED.
   * This avoids RPC overhead during single-core boot.
   */
  assignAllToCore(coreId: number): void {
    // We don't pre-populate all pages — instead, we lazily create entries
    // and default them to OWNED by the specified core.
    // The getEntry method is patched to return OWNED(coreId) by default.
    this.defaultOwner = coreId;
  }

  private defaultOwner: number = -1;

  private getEntryWithDefault(pageNum: number): DirEntry {
    let entry = this.pages.get(pageNum);
    if (!entry) {
      if (this.defaultOwner >= 0) {
        entry = {
          state: DirPageState.OWNED,
          owner: this.defaultOwner,
          sharers: new Set(),
          data: null,
        };
      } else {
        entry = {
          state: DirPageState.CLEAN,
          owner: -1,
          sharers: new Set(),
          data: null,
        };
      }
      this.pages.set(pageNum, entry);
    }
    return entry;
  }

  // ── Core-facing operations ──────────────────────────────────────────────

  /**
   * Core requests a page it doesn't have (ABSENT → SHARED).
   * Returns the page data.
   *
   * If page is OWNED by another core, coordinator must first request a
   * writeback from that core (caller must handle the async RPC).
   */
  fetchPage(
    physAddr: number,
    requestingCore: number,
  ): { data: ArrayBuffer | null; needsWritebackFrom: number | null } {
    const pageNum = pageNumber(physAddr);
    const entry = this.getEntryWithDefault(pageNum);

    if (entry.state === DirPageState.OWNED && entry.owner !== requestingCore) {
      // Need writeback from current owner before we can serve the page
      return { data: null, needsWritebackFrom: entry.owner };
    }

    if (entry.state === DirPageState.OWNED && entry.owner === requestingCore) {
      // Core already owns it — just return what we have (core has the real data)
      entry.sharers.add(requestingCore);
      return { data: entry.data, needsWritebackFrom: null };
    }

    // CLEAN — serve from canonical store
    entry.sharers.add(requestingCore);
    return { data: entry.data, needsWritebackFrom: null };
  }

  /**
   * Core wants to write to a SHARED page (SHARED → WRITABLE).
   * Returns the set of cores that need invalidation.
   */
  upgradePage(
    physAddr: number,
    requestingCore: number,
  ): { coresToInvalidate: number[] } {
    const pageNum = pageNumber(physAddr);
    const entry = this.getEntryWithDefault(pageNum);

    // Collect cores that need invalidation (all sharers except requester)
    const coresToInvalidate: number[] = [];
    for (const coreId of entry.sharers) {
      if (coreId !== requestingCore) {
        coresToInvalidate.push(coreId);
      }
    }

    // Transition to OWNED
    entry.state = DirPageState.OWNED;
    entry.owner = requestingCore;
    entry.sharers.clear();
    // Note: we don't add requestingCore to sharers — it's the owner now

    return { coresToInvalidate };
  }

  /**
   * Core writes back a dirty page to the coordinator.
   * Called when coordinator needs the page for another core's fetch.
   */
  acceptWriteback(physAddr: number, fromCore: number, data: ArrayBuffer): void {
    const pageNum = pageNumber(physAddr);
    const entry = this.getEntryWithDefault(pageNum);

    if (entry.state === DirPageState.OWNED && entry.owner === fromCore) {
      entry.data = data;
      entry.state = DirPageState.CLEAN;
      entry.owner = -1;
      entry.sharers.add(fromCore); // Writer keeps a SHARED copy
    }
  }

  /**
   * Bulk import: set canonical page data for a range (used during boot to
   * populate memory from the disk image / BIOS).
   */
  importPages(baseAddr: number, data: ArrayBuffer): void {
    const pages = Math.ceil(data.byteLength / PAGE_SIZE);
    for (let i = 0; i < pages; i++) {
      const pageNum = pageNumber(baseAddr + i * PAGE_SIZE);
      const entry = this.getEntryWithDefault(pageNum);
      const offset = i * PAGE_SIZE;
      const len = Math.min(PAGE_SIZE, data.byteLength - offset);
      const pageData = new ArrayBuffer(PAGE_SIZE);
      new Uint8Array(pageData).set(new Uint8Array(data, offset, len));
      entry.data = pageData;
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  get stats(): { totalPages: number; ownedPages: number; cleanPages: number } {
    let owned = 0;
    let clean = 0;
    for (const entry of this.pages.values()) {
      if (entry.state === DirPageState.OWNED) owned++;
      else clean++;
    }
    return { totalPages: this.pages.size, ownedPages: owned, cleanPages: clean };
  }
}

// ── Core Page Cache ──────────────────────────────────────────────────────────

export interface CoreCacheEntry {
  state: CorePageState;
  /** Offset in v86 WASM linear memory where this page lives. */
  wasmOffset: number;
}

/**
 * CorePageCache — lives in each CpuCoreDO.
 *
 * Tracks which pages the core has locally and their state.
 * Used to determine when an RPC to the coordinator is needed.
 */
export class CorePageCache {
  private pages = new Map<number, CoreCacheEntry>();
  private coreId: number;

  // Stats
  hits = 0;
  misses = 0;
  upgrades = 0;

  constructor(coreId: number) {
    this.coreId = coreId;
  }

  /** Check if a page is present locally. */
  has(physAddr: number): boolean {
    const pageNum = pageNumber(physAddr);
    const entry = this.pages.get(pageNum);
    return entry !== undefined && entry.state !== CorePageState.ABSENT;
  }

  /** Check if a page is writable locally. */
  isWritable(physAddr: number): boolean {
    const pageNum = pageNumber(physAddr);
    const entry = this.pages.get(pageNum);
    return entry !== undefined && entry.state === CorePageState.WRITABLE;
  }

  /** Get the local state of a page. */
  getState(physAddr: number): CorePageState {
    const pageNum = pageNumber(physAddr);
    return this.pages.get(pageNum)?.state ?? CorePageState.ABSENT;
  }

  /** Mark a page as present with the given state. */
  setPage(physAddr: number, state: CorePageState, wasmOffset: number): void {
    const pageNum = pageNumber(physAddr);
    this.pages.set(pageNum, { state, wasmOffset });
  }

  /** Invalidate a page (coordinator told us to drop it). */
  invalidate(physAddr: number): void {
    const pageNum = pageNumber(physAddr);
    this.pages.delete(pageNum);
  }

  /** Upgrade a SHARED page to WRITABLE (after coordinator confirms). */
  upgrade(physAddr: number): void {
    const pageNum = pageNumber(physAddr);
    const entry = this.pages.get(pageNum);
    if (entry) {
      entry.state = CorePageState.WRITABLE;
      this.upgrades++;
    }
  }

  /** Mark all pages as OWNED/WRITABLE (used for BSP during boot). */
  markAllWritable(): void {
    for (const entry of this.pages.values()) {
      entry.state = CorePageState.WRITABLE;
    }
  }

  get stats(): { cached: number; hits: number; misses: number; upgrades: number } {
    return {
      cached: this.pages.size,
      hits: this.hits,
      misses: this.misses,
      upgrades: this.upgrades,
    };
  }
}
