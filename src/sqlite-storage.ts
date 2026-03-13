import {
  SQLITE_BLOCK_SIZE, IMAGE_CHUNK_SIZE, SWAP_DEVICE, SWAP_SIZE,
  HOT_CACHE_MAX, CACHE_DEVICE, LOG_PREFIX,
  type SqlHandle,
} from "./types";

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
    this.initialized = true;
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
