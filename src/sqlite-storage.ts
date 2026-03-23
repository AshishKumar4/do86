import {
  SQLITE_BLOCK_SIZE, IMAGE_CHUNK_SIZE, SWAP_DEVICE, SWAP_SIZE,
  HOT_CACHE_MAX, CACHE_DEVICE, LOG_PREFIX,
  type SqlHandle,
} from "./types";
import type { ErrorTracker } from "./error-tracker";

// ── ChunkedBlobStore ────────────────────────────────────────────────────────
// Generic chunked binary blob storage on DO SQLite.
// Used for both disk images and state snapshots — eliminates copy-paste.

export class ChunkedBlobStore {
  constructor(
    private sql: SqlHandle,
    private dataTable: string,
    private metaTable: string,
    private chunkSize: number,
  ) {
    sql.exec(`CREATE TABLE IF NOT EXISTS ${dataTable} (
      name TEXT NOT NULL,
      chunk_id INTEGER NOT NULL,
      data BLOB NOT NULL,
      PRIMARY KEY (name, chunk_id)
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS ${metaTable} (
      name TEXT PRIMARY KEY,
      total_size INTEGER NOT NULL,
      chunk_count INTEGER NOT NULL,
      extra TEXT
    )`);
  }

  /** Check if a named blob is fully stored */
  has(name: string): boolean {
    const rows = [...this.sql.exec(
      `SELECT total_size FROM ${this.metaTable} WHERE name = ?`, name,
    )];
    return rows.length > 0 && (rows[0].total_size as number) > 0;
  }

  /** Read a stored blob back into an ArrayBuffer, or null if missing/corrupt */
  get(name: string): ArrayBuffer | null {
    const metaRows = [...this.sql.exec(
      `SELECT total_size, chunk_count FROM ${this.metaTable} WHERE name = ?`, name,
    )];
    if (metaRows.length === 0) return null;

    const totalSize = metaRows[0].total_size as number;
    const chunkCount = metaRows[0].chunk_count as number;
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (let i = 0; i < chunkCount; i++) {
      const chunkRows = [...this.sql.exec(
        `SELECT data FROM ${this.dataTable} WHERE name = ? AND chunk_id = ?`, name, i,
      )];
      if (chunkRows.length === 0) {
        console.error(`${LOG_PREFIX} Missing chunk ${i} for ${name} in ${this.dataTable}`);
        return null; // Cache is corrupt — caller should re-fetch
      }
      const blob = chunkRows[0].data;
      const chunk = new Uint8Array(blob instanceof ArrayBuffer ? blob : (blob as any).buffer || blob);
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result.buffer as ArrayBuffer;
  }

  /** Delete a named blob from the store */
  delete(name: string): void {
    this.sql.exec(`DELETE FROM ${this.metaTable} WHERE name = ?`, name);
    this.sql.exec(`DELETE FROM ${this.dataTable} WHERE name = ?`, name);
  }

  /**
   * Store an ArrayBuffer as chunked blobs.
   * Meta row is written last as a commit marker — if interrupted, has() returns
   * false and the blob will be re-stored next time.
   */
  put(name: string, data: ArrayBuffer, extra?: Record<string, unknown>): void {
    const bytes = new Uint8Array(data);
    const chunkCount = Math.ceil(bytes.length / this.chunkSize);

    // Clear any previous partial data
    this.sql.exec(`DELETE FROM ${this.metaTable} WHERE name = ?`, name);
    this.sql.exec(`DELETE FROM ${this.dataTable} WHERE name = ?`, name);

    for (let i = 0; i < chunkCount; i++) {
      const start = i * this.chunkSize;
      const end = Math.min(start + this.chunkSize, bytes.length);
      const chunk = bytes.slice(start, end);
      this.sql.exec(
        `INSERT INTO ${this.dataTable} (name, chunk_id, data) VALUES (?, ?, ?)`,
        name, i, chunk,
      );
    }

    // Write meta last — commit marker
    this.sql.exec(
      `INSERT INTO ${this.metaTable} (name, total_size, chunk_count, extra) VALUES (?, ?, ?, ?)`,
      name, bytes.length, chunkCount, extra ? JSON.stringify(extra) : null,
    );

    console.log(
      `${LOG_PREFIX} Stored ${name} in ${this.dataTable}: ` +
      `${(bytes.length / 1024 / 1024).toFixed(1)}MB in ${chunkCount} chunks`,
    );
  }
}

// ── SqliteStorage: block-level storage on DO SQLite ─────────────────────────

export class SqliteStorage {
  private initialized = false;
  readonly sql: SqlHandle;

  constructor(sql: SqlHandle) {
    this.sql = sql;
  }

  init(): void {
    if (this.initialized) return;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS block_storage (
      device   TEXT NOT NULL,
      block_id INTEGER NOT NULL,
      data     BLOB NOT NULL,
      PRIMARY KEY (device, block_id)
    )`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS do_config (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    this.initialized = true;
  }

  /** Read a config value from the do_config table */
  getConfig(key: string): string | null {
    this.init();
    const rows = [...this.sql.exec(
      `SELECT value FROM do_config WHERE key = ?`, key,
    )];
    return rows.length > 0 ? (rows[0].value as string) : null;
  }

  /** Write a config value to the do_config table */
  setConfig(key: string, value: string): void {
    this.init();
    this.sql.exec(
      `INSERT OR REPLACE INTO do_config (key, value) VALUES (?, ?)`,
      key, value,
    );
  }

  readBlock(device: string, blockId: number): Uint8Array | null {
    this.init();
    const row = [...this.sql.exec(
      `SELECT data FROM block_storage WHERE device = ? AND block_id = ?`,
      device, blockId,
    )][0];
    if (!row) return null;
    const blob = row.data;
    return new Uint8Array(blob instanceof ArrayBuffer ? blob : (blob as any).buffer || blob);
  }

  writeBlock(device: string, blockId: number, data: Uint8Array): void {
    this.init();
    this.sql.exec(
      `INSERT OR REPLACE INTO block_storage (device, block_id, data) VALUES (?, ?, ?)`,
      device, blockId, data,
    );
  }

  writeBlocks(device: string, blocks: [number, Uint8Array][]): void {
    this.init();
    if (blocks.length === 0) return;
    for (const [blockId, data] of blocks) {
      this.sql.exec(
        `INSERT OR REPLACE INTO block_storage (device, block_id, data) VALUES (?, ?, ?)`,
        device, blockId, data,
      );
    }
  }

  deleteBlock(device: string, blockId: number): void {
    this.init();
    this.sql.exec(`DELETE FROM block_storage WHERE device = ? AND block_id = ?`, device, blockId);
  }

  deleteDevice(device: string): void {
    this.init();
    this.sql.exec(`DELETE FROM block_storage WHERE device = ?`, device);
  }
}

// ── SqliteImageCache ────────────────────────────────────────────────────────
// Composes two ChunkedBlobStore instances: one for disk images, one for
// state snapshots. Eliminates the duplicated chunked storage code.

export class SqliteImageCache {
  readonly images: ChunkedBlobStore;
  readonly states: ChunkedBlobStore;

  constructor(storage: SqliteStorage) {
    storage.init();
    this.images = new ChunkedBlobStore(storage.sql, "image_cache", "image_meta", IMAGE_CHUNK_SIZE);
    this.states = new ChunkedBlobStore(storage.sql, "state_cache", "state_meta", IMAGE_CHUNK_SIZE);
  }
}

// ── SQLiteBlockDevice (virtual swap, 10GB lazy-allocated) ───────────────────

export class SQLiteBlockDevice {
  byteLength = SWAP_SIZE;
  onload: ((e: unknown) => void) | undefined;
  onprogress: ((e: unknown) => void) | undefined;

  private hotCache = new Map<number, Uint8Array>();
  private dirtyBlocks = new Set<number>();
  private flushTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private storage: SqliteStorage) {}

  load(): void {
    this.storage.init();
    this.onload?.({});
  }

  get(offset: number, len: number, callback: (data: Uint8Array) => void): void {
    const result = new Uint8Array(len);
    let pos = 0;
    while (pos < len) {
      const currentOffset = offset + pos;
      const blockId = Math.floor(currentOffset / SQLITE_BLOCK_SIZE);
      const blockOffset = currentOffset % SQLITE_BLOCK_SIZE;
      const bytesInBlock = Math.min(SQLITE_BLOCK_SIZE - blockOffset, len - pos);
      result.set(this.getBlock(blockId).subarray(blockOffset, blockOffset + bytesInBlock), pos);
      pos += bytesInBlock;
    }
    callback(result);
  }

  set(offset: number, data: Uint8Array, callback: () => void): void {
    let pos = 0;
    while (pos < data.length) {
      const currentOffset = offset + pos;
      const blockId = Math.floor(currentOffset / SQLITE_BLOCK_SIZE);
      const blockOffset = currentOffset % SQLITE_BLOCK_SIZE;
      const bytesInBlock = Math.min(SQLITE_BLOCK_SIZE - blockOffset, data.length - pos);
      const block = this.getBlock(blockId);
      block.set(data.subarray(pos, pos + bytesInBlock), blockOffset);
      this.hotCache.set(blockId, block);
      this.dirtyBlocks.add(blockId);
      pos += bytesInBlock;
    }
    // Deferred flush — coalesce rapid writes (e.g. during boot)
    this.scheduleFlush();
    callback();
  }

  get_buffer(callback: (buf: ArrayBuffer | undefined) => void): void { callback(undefined); }

  get_state(): unknown[] {
    this.flushDirty();
    return [this.byteLength];
  }

  set_state(state: unknown[]): void {
    const arr = state as number[];
    if (arr?.[0]) this.byteLength = arr[0];
    this.hotCache.clear();
    this.dirtyBlocks.clear();
  }

  private scheduleFlush(): void {
    if (this.flushTimer) return;
    // Flush after 50ms of write quiescence — batches rapid sequential writes
    if (this.dirtyBlocks.size >= 32) {
      this.flushDirty();
    } else {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        this.flushDirty();
      }, 50);
    }
  }

  private getBlock(blockId: number): Uint8Array {
    const cached = this.hotCache.get(blockId);
    if (cached) return cached;

    const stored = this.storage.readBlock(SWAP_DEVICE, blockId);
    let block: Uint8Array;

    if (stored) {
      if (stored.length === SQLITE_BLOCK_SIZE) {
        block = stored;
      } else {
        block = new Uint8Array(SQLITE_BLOCK_SIZE);
        block.set(stored.subarray(0, Math.min(stored.length, SQLITE_BLOCK_SIZE)));
      }
    } else {
      block = new Uint8Array(SQLITE_BLOCK_SIZE);
    }

    this.evictIfNeeded();
    this.hotCache.set(blockId, block);
    return block;
  }

  private evictIfNeeded(): void {
    if (this.hotCache.size <= HOT_CACHE_MAX) return;
    let evicted = 0;
    for (const key of this.hotCache.keys()) {
      if (!this.dirtyBlocks.has(key)) {
        this.hotCache.delete(key);
        evicted++;
        if (evicted >= 64 || this.hotCache.size <= HOT_CACHE_MAX) break;
      }
    }
  }

  private flushDirty(): void {
    if (this.dirtyBlocks.size === 0) return;
    const blocks: [number, Uint8Array][] = [];
    for (const blockId of this.dirtyBlocks) {
      const block = this.hotCache.get(blockId);
      if (block) blocks.push([blockId, block]);
    }
    this.storage.writeBlocks(SWAP_DEVICE, blocks);
    this.dirtyBlocks.clear();
  }
}

// ── SQLiteDiskCache (read-through cache for boot disk) ──────────────────────

export class SQLiteDiskCache {
  byteLength: number;
  onload: ((e: unknown) => void) | undefined;
  onprogress: ((e: unknown) => void) | undefined;

  private inner: any; // v86 disk buffer — untyped upstream API

  constructor(innerBuffer: any, private storage: SqliteStorage) {
    this.inner = innerBuffer;
    this.byteLength = innerBuffer.byteLength;
  }

  load(): void {
    this.storage.init();
    if (this.inner.load) {
      this.inner.onload = () => this.onload?.({});
      this.inner.onprogress = this.onprogress;
      this.inner.load();
    } else {
      this.onload?.({});
    }
  }

  get(offset: number, len: number, callback: (data: Uint8Array) => void): void {
    if (len <= SQLITE_BLOCK_SIZE && offset % SQLITE_BLOCK_SIZE === 0) {
      const blockId = Math.floor(offset / SQLITE_BLOCK_SIZE);
      const cached = this.storage.readBlock(CACHE_DEVICE, blockId);
      if (cached) {
        callback(cached.subarray(0, len));
        return;
      }
    }

    this.inner.get(offset, len, (data: Uint8Array) => {
      if (len <= SQLITE_BLOCK_SIZE && offset % SQLITE_BLOCK_SIZE === 0) {
        try {
          this.storage.writeBlock(CACHE_DEVICE, Math.floor(offset / SQLITE_BLOCK_SIZE), data);
        } catch (e) {
          console.error(`${LOG_PREFIX} Disk cache write failed:`, e);
        }
      }
      callback(data);
    });
  }

  set(offset: number, data: Uint8Array, callback: () => void): void {
    const startBlock = Math.floor(offset / SQLITE_BLOCK_SIZE);
    const endBlock = Math.floor((offset + data.length - 1) / SQLITE_BLOCK_SIZE);
    for (let b = startBlock; b <= endBlock; b++) {
      try {
        this.storage.deleteBlock(CACHE_DEVICE, b);
      } catch (e) {
        console.error(`${LOG_PREFIX} Disk cache invalidation failed:`, e);
      }
    }
    this.inner.set(offset, data, callback);
  }

  get_buffer(callback: (buf: ArrayBuffer | undefined) => void): void { this.inner.get_buffer(callback); }
  get_state(): unknown { return this.inner.get_state(); }
  set_state(state: unknown): void { this.inner.set_state(state); }
}

// ── SqliteDiskBuffer ────────────────────────────────────────────────────────
//
// Implements the v86 disk buffer interface (get/set/load/byteLength) backed by
// DO SQLite instead of an in-memory ArrayBuffer.  This replaces the 50MB
// ArrayBuffer that SyncBuffer holds for large ISOs (e.g. DSL Linux) with
// on-demand SQLite reads through a small LRU cache.
//
// Memory savings for DSL: 50MB ArrayBuffer → ~2MB LRU cache.
//
// v86's IDE controller calls buffer.get(start, len, callback) synchronously.
// DO SQLite reads (ctx.storage.sql.exec) are synchronous, so we can serve
// reads inline without breaking the IDE's callback expectations.
//
// The duck-typing check in v86's add_file (starter.js line ~395):
//   if(file.get && file.set && file.load) { use directly as loadable }
// means we pass this object as v86Config.cdrom (not wrapped in {buffer:...}).
//
// Chunk size: 64KB balances SQLite row overhead vs read amplification.
// LRU cache: 32 chunks × 64KB = 2MB hot window.

const DISK_CHUNK_SIZE = 64 * 1024;        // 64KB per SQLite row
const DISK_LRU_MAX    = 32;               // 32 chunks = 2MB cache
const DISK_DEVICE     = "disk_image";      // device key in block_storage table

export class SqliteDiskBuffer {
  byteLength: number;
  onload:     ((e: unknown) => void) | undefined;
  onprogress: ((e: unknown) => void) | undefined;

  private storage: SqliteStorage;
  private name: string;                    // unique name (e.g. "dsl-4.11.rc2.iso")

  // ── LRU cache: Map iteration order = insertion order ──────────────────
  // On hit we delete+re-insert to move to end (most recently used).
  // Eviction removes from the front (least recently used).
  private lru = new Map<number, Uint8Array>();

  // ── Write overlay: guest writes go here, overlaid on reads ────────────
  // Map<chunkId, Uint8Array> — only chunks that were modified by set().
  // Flushed to SQLite periodically (or we could write-through).
  private dirty = new Map<number, Uint8Array>();

  // ── Stats ─────────────────────────────────────────────────────────────
  private _hits  = 0;
  private _misses = 0;
  private _writes = 0;
  private _readErrors = 0;
  private _writeErrors = 0;

  /** Shared error tracker — set after construction. */
  _errors: ErrorTracker | null = null;

  constructor(storage: SqliteStorage, name: string, totalSize: number) {
    this.storage = storage;
    this.name    = name;
    this.byteLength = totalSize;
  }

  // ── Ingest: chunk a raw ArrayBuffer into SQLite ───────────────────────
  // Call once after downloading the ISO.  After this returns, the original
  // ArrayBuffer can be freed — all data lives in SQLite.
  ingest(data: ArrayBuffer): void {
    this.storage.init();
    const bytes = new Uint8Array(data);
    const chunkCount = Math.ceil(bytes.length / DISK_CHUNK_SIZE);

    // Clear any previous data for this image name
    this.storage.sql.exec(
      `DELETE FROM block_storage WHERE device = ?`,
      `${DISK_DEVICE}:${this.name}`,
    );

    for (let i = 0; i < chunkCount; i++) {
      const start = i * DISK_CHUNK_SIZE;
      const end   = Math.min(start + DISK_CHUNK_SIZE, bytes.length);
      const chunk = bytes.slice(start, end);
      this.storage.writeBlock(`${DISK_DEVICE}:${this.name}`, i, new Uint8Array(chunk));
    }

    console.log(
      `${LOG_PREFIX} SqliteDiskBuffer: ingested ${this.name}: ` +
      `${(bytes.length / 1024 / 1024).toFixed(1)}MB in ${chunkCount} × ${DISK_CHUNK_SIZE / 1024}KB chunks`,
    );
  }

  /** Check if this image is already fully stored in SQLite */
  hasData(): boolean {
    this.storage.init();
    // Check for chunk 0 — if present, assume the image was fully ingested
    // (ingest deletes all chunks first, then writes sequentially)
    const row = this.storage.readBlock(`${DISK_DEVICE}:${this.name}`, 0);
    return row !== null;
  }

  // ── v86 buffer interface ──────────────────────────────────────────────

  load(): void {
    this.storage.init();
    this.onload?.({});
  }

  get(offset: number, len: number, callback: (data: Uint8Array) => void): void {
    try {
      const result = new Uint8Array(len);
      let pos = 0;

      while (pos < len) {
        const currentOffset = offset + pos;
        const chunkId       = Math.floor(currentOffset / DISK_CHUNK_SIZE);
        const chunkOffset   = currentOffset % DISK_CHUNK_SIZE;
        const bytesFromChunk = Math.min(DISK_CHUNK_SIZE - chunkOffset, len - pos);

        const chunk = this.getChunk(chunkId);
        result.set(chunk.subarray(chunkOffset, chunkOffset + bytesFromChunk), pos);
        pos += bytesFromChunk;
      }

      callback(result);
    } catch (e) {
      this._readErrors++;
      this._errors?.record("disk", `SqliteDiskBuffer.get failed at offset=0x${offset.toString(16)} len=${len}`, e);
      // Return zeros so IDE doesn't hang waiting for a callback
      callback(new Uint8Array(len));
    }
  }

  set(offset: number, data: Uint8Array, callback: () => void): void {
    try {
      let pos = 0;
      while (pos < data.length) {
        const currentOffset = offset + pos;
        const chunkId       = Math.floor(currentOffset / DISK_CHUNK_SIZE);
        const chunkOffset   = currentOffset % DISK_CHUNK_SIZE;
        const bytesInChunk  = Math.min(DISK_CHUNK_SIZE - chunkOffset, data.length - pos);

        const chunk = this.getChunk(chunkId);
        let dirtyChunk = this.dirty.get(chunkId);
        if (!dirtyChunk) {
          dirtyChunk = new Uint8Array(DISK_CHUNK_SIZE);
          dirtyChunk.set(chunk);
          this.dirty.set(chunkId, dirtyChunk);
          this.lru.set(chunkId, dirtyChunk);
        }
        dirtyChunk.set(data.subarray(pos, pos + bytesInChunk), chunkOffset);
        pos += bytesInChunk;
      }
      this._writes++;

      for (const [chunkId, chunk] of this.dirty) {
        this.storage.writeBlock(`${DISK_DEVICE}:${this.name}`, chunkId, chunk);
      }
      this.dirty.clear();
    } catch (e) {
      this._writeErrors++;
      this._errors?.record("disk", `SqliteDiskBuffer.set failed at offset=0x${offset.toString(16)} len=${data.length}`, e);
    }
    callback();
  }

  get_buffer(callback: (buf: ArrayBuffer | undefined) => void): void {
    // Cannot return the full buffer — that's the whole point
    callback(undefined);
  }

  get_state(): unknown[] {
    // Flush any pending dirty chunks
    for (const [chunkId, chunk] of this.dirty) {
      this.storage.writeBlock(`${DISK_DEVICE}:${this.name}`, chunkId, chunk);
    }
    this.dirty.clear();
    // State: just the size (data lives in SQLite, survives DO eviction)
    return [this.byteLength];
  }

  set_state(state: unknown[]): void {
    const arr = state as number[];
    if (arr?.[0]) this.byteLength = arr[0];
    this.lru.clear();
    this.dirty.clear();
  }

  // ── Stats for diagnostics ──────────────────────────────────────────────

  get stats() {
    return {
      hits: this._hits,
      misses: this._misses,
      writes: this._writes,
      readErrors: this._readErrors,
      writeErrors: this._writeErrors,
      lruSize: this.lru.size,
      lruMaxSize: DISK_LRU_MAX,
      chunkSize: DISK_CHUNK_SIZE,
    };
  }

  // ── Internal: chunk read with LRU cache ───────────────────────────────

  private getChunk(chunkId: number): Uint8Array {
    // Check LRU
    const cached = this.lru.get(chunkId);
    if (cached) {
      this._hits++;
      // Move to end (MRU position)
      this.lru.delete(chunkId);
      this.lru.set(chunkId, cached);
      return cached;
    }

    // Cache miss — read from SQLite
    this._misses++;
    const stored = this.storage.readBlock(`${DISK_DEVICE}:${this.name}`, chunkId);

    let chunk: Uint8Array;
    if (stored) {
      // Stored chunk may be smaller than DISK_CHUNK_SIZE (last chunk)
      if (stored.length === DISK_CHUNK_SIZE) {
        chunk = stored;
      } else {
        chunk = new Uint8Array(DISK_CHUNK_SIZE);
        chunk.set(stored.subarray(0, Math.min(stored.length, DISK_CHUNK_SIZE)));
      }
    } else {
      // Missing chunk — return zeros (shouldn't happen for a fully ingested image)
      chunk = new Uint8Array(DISK_CHUNK_SIZE);
    }

    // Evict LRU if needed
    if (this.lru.size >= DISK_LRU_MAX) {
      // Delete the first (oldest) entry
      const firstKey = this.lru.keys().next().value;
      if (firstKey !== undefined) {
        this.lru.delete(firstKey);
      }
    }

    this.lru.set(chunkId, chunk);
    return chunk;
  }
}

// ── Asset pack utilities ────────────────────────────────────────────────────
// Binary asset pack format: [nameLen:u16][name:utf8][dataLen:u32][data:bytes]...

export function unpackAssets(packed: ArrayBuffer): Map<string, ArrayBuffer> {
  const view = new DataView(packed);
  const bytes = new Uint8Array(packed);
  const assets = new Map<string, ArrayBuffer>();
  let offset = 0;
  const decoder = new TextDecoder();

  while (offset < packed.byteLength) {
    const nameLen = view.getUint16(offset, true);
    offset += 2;
    const name = decoder.decode(bytes.subarray(offset, offset + nameLen));
    offset += nameLen;
    const dataLen = view.getUint32(offset, true);
    offset += 4;
    assets.set(name, packed.slice(offset, offset + dataLen));
    offset += dataLen;
  }
  return assets;
}
