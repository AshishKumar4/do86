import {
  MSG_FULL_FRAME, MSG_DELTA_FRAME, MSG_SERIAL_DATA,
  MSG_STATUS, MSG_TEXT_SCREEN, MSG_STATS, MSG_DETAILED_STATS, TILE_SIZE,
} from "./types";
import simdModule from "./simd_helper.wasm";

// ── SIMD WASM Helper ────────────────────────────────────────────────────────
// Lazy-initialized WASM SIMD module for fast tile comparison.
// Layout in WASM linear memory:
//   [0 .. frameBytes)              = new frame (contiguous, stride = width*4)
//   [frameBytes .. 2*frameBytes)   = prev frame (contiguous, stride = width*4)
//   [2*frameBytes .. 2*frameBytes + maxTiles) = dirty flags (1 byte per tile)

interface SimdExports {
  memory: WebAssembly.Memory;
  tiles_differ(ptr_a: number, ptr_b: number, len: number): number;
  diff_tiles(
    old_buf: number, new_buf: number,
    width: number, height: number,
    buf_stride_px: number, tile_size: number,
    out_dirty: number,
  ): number;
  copy_strided(
    src: number, dst: number,
    width: number, height: number,
    src_stride_px: number,
  ): void;
}

let simdInstance: SimdExports | null = null;
let simdReady = false;
let simdFailed = false;

function ensureSimd(): SimdExports | null {
  if (simdReady) return simdInstance;
  if (simdFailed) return null;
  try {
    const instance = new WebAssembly.Instance(simdModule);
    simdInstance = instance.exports as unknown as SimdExports;
    simdReady = true;
    return simdInstance;
  } catch {
    simdFailed = true;
    return null;
  }
}

/** Ensure WASM linear memory is large enough for `needed` bytes. */
function ensureMemory(simd: SimdExports, needed: number): void {
  const current = simd.memory.buffer.byteLength;
  if (current >= needed) return;
  const pagesNeeded = Math.ceil((needed - current) / 65536);
  simd.memory.grow(pagesNeeded);
}

// ── Message Encoders ────────────────────────────────────────────────────────
// Pre-allocate reusable TextEncoder (shared across all encoder calls).

const textEncoder = new TextEncoder();

export function encodeTextScreen(cols: number, rows: number, textRows: string[]): ArrayBuffer {
  const encoded = textEncoder.encode(textRows.join("\n"));
  const buf = new ArrayBuffer(3 + encoded.length);
  const view = new Uint8Array(buf);
  view[0] = MSG_TEXT_SCREEN;
  view[1] = cols;
  view[2] = rows;
  view.set(encoded, 3);
  return buf;
}

export function encodeSerialData(text: string): ArrayBuffer {
  const encoded = textEncoder.encode(text);
  const buf = new ArrayBuffer(1 + encoded.length);
  const view = new Uint8Array(buf);
  view[0] = MSG_SERIAL_DATA;
  view.set(encoded, 1);
  return buf;
}

export function encodeStatus(status: string): ArrayBuffer {
  const encoded = textEncoder.encode(status);
  const buf = new ArrayBuffer(1 + encoded.length);
  const view = new Uint8Array(buf);
  view[0] = MSG_STATUS;
  view.set(encoded, 1);
  return buf;
}

export function encodeStats(stats: Record<string, unknown>): ArrayBuffer {
  const encoded = textEncoder.encode(JSON.stringify(stats));
  const buf = new ArrayBuffer(1 + encoded.length);
  const view = new Uint8Array(buf);
  view[0] = MSG_STATS;
  view.set(encoded, 1);
  return buf;
}

export function encodeDetailedStats(stats: Record<string, unknown>): ArrayBuffer {
  const encoded = textEncoder.encode(JSON.stringify(stats));
  const buf = new ArrayBuffer(1 + encoded.length);
  const view = new Uint8Array(buf);
  view[0] = MSG_DETAILED_STATS;
  view.set(encoded, 1);
  return buf;
}

// ── RLE Encoder ─────────────────────────────────────────────────────────────
// Format: [R][G][B][run_length:u8] — run_length = additional identical pixels (0 = single)

function rleEncodeInto(rgb: Uint8Array, pixelCount: number, out: Uint8Array): number {
  let outIdx = 0;
  let i = 0;

  while (i < pixelCount) {
    const baseIdx = i * 3;
    const r = rgb[baseIdx], g = rgb[baseIdx + 1], b = rgb[baseIdx + 2];
    const pixel = (r << 16) | (g << 8) | b;

    let run = 0;
    let j = i + 1;
    while (j < pixelCount && run < 255) {
      const jIdx = j * 3;
      const jp = (rgb[jIdx] << 16) | (rgb[jIdx + 1] << 8) | rgb[jIdx + 2];
      if (jp !== pixel) break;
      run++;
      j++;
    }

    out[outIdx++] = r;
    out[outIdx++] = g;
    out[outIdx++] = b;
    out[outIdx++] = run;
    i = j;
  }
  return outIdx;
}

// ── Delta Frame Encoder ─────────────────────────────────────────────────────
// Optimized: cached typed-array views, pre-allocated scratch buffers,
// zero per-frame allocations in the hot path.

export class DeltaEncoder {
  private prevFrame: Uint8Array | null = null;
  private prevWidth = 0;
  private prevHeight = 0;
  // Pre-allocated tile scratch buffers
  private tileRGBBuffer = new Uint8Array(TILE_SIZE * TILE_SIZE * 3);
  private tileRLEBuffer = new Uint8Array(TILE_SIZE * TILE_SIZE * 4);
  private deltaBuffer: ArrayBuffer | null = null;
  private keyframeBuffer: ArrayBuffer | null = null;
  // Cached Uint32Array view over prevFrame — avoids re-creating per tile
  private prevU32: Uint32Array | null = null;
  // Pre-allocated changed-tile coordinate buffer (reused across frames)
  private changedCoordsBuffer: Int32Array | null = null;
  private static readonly MAX_DELTA_BUFFER = 512 * 1024;

  encode(
    width: number, height: number, bufferWidth: number,
    rgba: Uint8ClampedArray, forceKeyframe: boolean,
  ): { data: ArrayBuffer; isDelta: boolean } | null {
    if (forceKeyframe || !this.prevFrame || width !== this.prevWidth || height !== this.prevHeight) {
      return this.encodeKeyframe(width, height, bufferWidth, rgba);
    }
    return this.encodeDelta(width, height, bufferWidth, rgba);
  }

  reset(): void {
    this.prevFrame = null;
    this.prevU32 = null;
    this.prevWidth = 0;
    this.prevHeight = 0;
  }

  private encodeKeyframe(
    width: number, height: number, bufferWidth: number, rgba: Uint8ClampedArray,
  ): { data: ArrayBuffer; isDelta: boolean } {
    const header = 5;
    const needed = header + width * height * 3;
    if (!this.keyframeBuffer || this.keyframeBuffer.byteLength < needed) {
      this.keyframeBuffer = new ArrayBuffer(needed);
    }

    const buf = this.keyframeBuffer;
    const view = new DataView(buf);
    const out = new Uint8Array(buf);

    view.setUint8(0, MSG_FULL_FRAME);
    view.setUint16(1, width, true);
    view.setUint16(3, height, true);

    // Strip alpha: RGBA -> RGB
    let dst = header;
    if (bufferWidth === width) {
      const totalPx = width * height;
      for (let i = 0; i < totalPx; i++) {
        const s = i << 2;
        out[dst++] = rgba[s];
        out[dst++] = rgba[s + 1];
        out[dst++] = rgba[s + 2];
      }
    } else {
      for (let row = 0; row < height; row++) {
        const srcRowStart = row * bufferWidth * 4;
        for (let col = 0; col < width; col++) {
          const srcIdx = srcRowStart + col * 4;
          out[dst++] = rgba[srcIdx];
          out[dst++] = rgba[srcIdx + 1];
          out[dst++] = rgba[srcIdx + 2];
        }
      }
    }

    this.savePrevFrame(width, height, bufferWidth, rgba, null);
    return { data: buf.slice(0, needed), isDelta: false };
  }

  private encodeDelta(
    width: number, height: number, bufferWidth: number, rgba: Uint8ClampedArray,
  ): { data: ArrayBuffer; isDelta: boolean } | null {
    const tilesX = Math.ceil(width / TILE_SIZE);
    const tilesY = Math.ceil(height / TILE_SIZE);
    const prevFrame = this.prevFrame!;
    const totalTiles = tilesX * tilesY;

    // Reuse pre-allocated coordinate buffer when possible
    const neededCoords = totalTiles * 2;
    if (!this.changedCoordsBuffer || this.changedCoordsBuffer.length < neededCoords) {
      this.changedCoordsBuffer = new Int32Array(neededCoords);
    }
    const changedCoords = this.changedCoordsBuffer;
    let changedCount = 0;

    // ── SIMD fast path: bulk tile diff via WASM ──
    const simd = ensureSimd();
    if (simd) {
      changedCount = this.encodeDeltaSimd(
        simd, width, height, bufferWidth, rgba, prevFrame,
        tilesX, tilesY, changedCoords,
      );
    } else {
      // ── JS fallback: per-tile comparison ──
      changedCount = this.encodeDeltaJS(
        width, height, bufferWidth, rgba, prevFrame,
        tilesX, tilesY, changedCoords,
      );
    }

    if (changedCount === 0) return null;

    // Keyframe is more efficient when most tiles changed
    if (changedCount > tilesX * tilesY * 0.7) {
      return this.encodeKeyframe(width, height, bufferWidth, rgba);
    }

    const headerSize = 7;
    const tileHeaderSize = 9;
    const maxTileData = TILE_SIZE * TILE_SIZE * 4;
    const estimatedSize = Math.min(
      headerSize + changedCount * (tileHeaderSize + maxTileData),
      DeltaEncoder.MAX_DELTA_BUFFER,
    );

    if (!this.deltaBuffer || this.deltaBuffer.byteLength < estimatedSize) {
      this.deltaBuffer = new ArrayBuffer(estimatedSize);
    }

    const buf = this.deltaBuffer;
    const dv = new DataView(buf);
    const out = new Uint8Array(buf);

    dv.setUint8(0, MSG_DELTA_FRAME);
    dv.setUint16(1, width, true);
    dv.setUint16(3, height, true);

    let offset = headerSize;
    let tileCount = 0;
    const tileRGB = this.tileRGBBuffer;
    const tileRLE = this.tileRLEBuffer;

    for (let ci = 0; ci < changedCount; ci++) {
      const tx = changedCoords[ci * 2];
      const ty = changedCoords[ci * 2 + 1];
      const tileX = tx * TILE_SIZE;
      const tileY = ty * TILE_SIZE;
      const tileW = Math.min(TILE_SIZE, width - tileX);
      const tileH = Math.min(TILE_SIZE, height - tileY);

      if (offset + tileHeaderSize + tileW * tileH * 4 > buf.byteLength) break;

      dv.setUint16(offset, tileX, true); offset += 2;
      dv.setUint16(offset, tileY, true); offset += 2;
      dv.setUint16(offset, tileW, true); offset += 2;
      dv.setUint16(offset, tileH, true); offset += 2;

      // Extract tile RGB
      let rawIdx = 0;
      for (let row = 0; row < tileH; row++) {
        let srcIdx = ((tileY + row) * bufferWidth + tileX) * 4;
        for (let col = 0; col < tileW; col++) {
          tileRGB[rawIdx++] = rgba[srcIdx];
          tileRGB[rawIdx++] = rgba[srcIdx + 1];
          tileRGB[rawIdx++] = rgba[srcIdx + 2];
          srcIdx += 4;
        }
      }

      const tilePixels = tileW * tileH;
      const rawRGBLen = tilePixels * 3;
      const rleLen = rleEncodeInto(tileRGB, tilePixels, tileRLE);

      if (rleLen < rawRGBLen * 0.9) {
        out[offset++] = 1;
        out.set(tileRLE.subarray(0, rleLen), offset);
        offset += rleLen;
      } else {
        out[offset++] = 0;
        out.set(tileRGB.subarray(0, rawRGBLen), offset);
        offset += rawRGBLen;
      }
      tileCount++;
    }

    dv.setUint16(5, tileCount, true);
    this.savePrevFrame(width, height, bufferWidth, rgba, changedCoords, changedCount);
    return { data: buf.slice(0, offset), isDelta: true };
  }

  // Save current frame into prevFrame. For deltas, only copy changed tiles.
  // Uses TypedArray.set() with subarray instead of byte-by-byte loops.
  private savePrevFrame(
    width: number, height: number, bufferWidth: number, rgba: Uint8ClampedArray,
    changedCoords: Int32Array | null, changedCount?: number,
  ): void {
    const pixelBytes = width * height * 4;
    if (!this.prevFrame || this.prevFrame.length !== pixelBytes) {
      this.prevFrame = new Uint8Array(pixelBytes);
      this.prevU32 = new Uint32Array(this.prevFrame.buffer);
      changedCoords = null; // must do full copy on realloc
    }

    if (changedCoords && changedCount) {
      // Delta: only copy the tiles that changed
      const src = rgba;
      const dst = this.prevFrame;
      for (let ci = 0; ci < changedCount; ci++) {
        const tx = changedCoords[ci * 2];
        const ty = changedCoords[ci * 2 + 1];
        const tileX = tx * TILE_SIZE;
        const tileY = ty * TILE_SIZE;
        const tileW = Math.min(TILE_SIZE, width - tileX);
        const tileH = Math.min(TILE_SIZE, height - tileY);
        const rowBytes = tileW * 4;

        for (let row = 0; row < tileH; row++) {
          const y = tileY + row;
          const srcOff = y * bufferWidth * 4 + tileX * 4;
          const dstOff = y * width * 4 + tileX * 4;
          dst.set(src.subarray(srcOff, srcOff + rowBytes), dstOff);
        }
      }
    } else {
      // Keyframe: full copy
      const dst = this.prevFrame;
      const src = rgba;
      if (bufferWidth === width) {
        dst.set(src.subarray(0, pixelBytes));
      } else {
        for (let row = 0; row < height; row++) {
          const srcOff = row * bufferWidth * 4;
          const dstOff = row * width * 4;
          const rowBytes = width * 4;
          dst.set(src.subarray(srcOff, srcOff + rowBytes), dstOff);
        }
      }
    }

    this.prevWidth = width;
    this.prevHeight = height;
  }

  // ── SIMD bulk tile diff ──────────────────────────────────────────────────
  // Copies both framebuffers into WASM linear memory, calls diff_tiles (SIMD),
  // reads back per-tile dirty flags, populates changedCoords.
  private encodeDeltaSimd(
    simd: SimdExports,
    width: number, height: number, bufferWidth: number,
    rgba: Uint8ClampedArray, prevFrame: Uint8Array,
    tilesX: number, tilesY: number,
    changedCoords: Int32Array,
  ): number {
    const frameBytes = width * height * 4;
    const totalTiles = tilesX * tilesY;
    // Memory layout: [new_frame | prev_frame | dirty_flags]
    // Align dirty flags to 16 bytes for safety
    const dirtyOffset = frameBytes * 2;
    const needed = dirtyOffset + ((totalTiles + 15) & ~15);

    ensureMemory(simd, needed);

    const wasmBuf = new Uint8Array(simd.memory.buffer);

    // Copy new frame into WASM memory at offset 0 (contiguous layout)
    if (bufferWidth === width) {
      wasmBuf.set(rgba.subarray(0, frameBytes), 0);
    } else {
      // Use SIMD copy_strided if buffer is already in WASM — but we need to
      // get it there first. Do a row-by-row JS copy into WASM offset 0.
      const rowBytes = width * 4;
      for (let row = 0; row < height; row++) {
        const srcOff = row * bufferWidth * 4;
        wasmBuf.set(
          rgba.subarray(srcOff, srcOff + rowBytes),
          row * rowBytes,
        );
      }
    }

    // Copy prev frame into WASM memory at offset frameBytes (already contiguous)
    wasmBuf.set(prevFrame.subarray(0, frameBytes), frameBytes);

    // Call SIMD diff_tiles — new buffer is at 0, old buffer is at frameBytes
    // new_buf stride = width (contiguous after our copy), old_buf stride = width
    const dirtyCount = simd.diff_tiles(
      frameBytes,   // old_buf (prev)
      0,            // new_buf (current)
      width, height,
      width,        // buf_stride_px — both are contiguous after copy
      TILE_SIZE,
      dirtyOffset,
    );

    if (dirtyCount === 0) return 0;

    // Read dirty flags and populate changedCoords
    // Re-wrap: memory.buffer may have been detached by grow()
    const dirtyFlags = new Uint8Array(simd.memory.buffer, dirtyOffset, totalTiles);
    let count = 0;
    for (let i = 0; i < totalTiles; i++) {
      if (dirtyFlags[i]) {
        const tx = i % tilesX;
        const ty = (i / tilesX) | 0;
        changedCoords[count * 2] = tx;
        changedCoords[count * 2 + 1] = ty;
        count++;
      }
    }
    return count;
  }

  // ── JS fallback tile diff ─────────────────────────────────────────────────
  // Uses cached Uint32Array views when available. No allocations in the hot path.
  private encodeDeltaJS(
    width: number, height: number, bufferWidth: number,
    rgba: Uint8ClampedArray, prevFrame: Uint8Array,
    tilesX: number, tilesY: number,
    changedCoords: Int32Array,
  ): number {
    let rgbaU32: Uint32Array | null = null;
    const prevU32 = this.prevU32;
    if ((rgba.byteOffset & 3) === 0 && prevU32) {
      rgbaU32 = new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength >> 2);
    }

    let changedCount = 0;
    for (let ty = 0; ty < tilesY; ty++) {
      for (let tx = 0; tx < tilesX; tx++) {
        if (this.tileChangedJS(tx, ty, width, height, bufferWidth, rgbaU32, prevU32, rgba, prevFrame)) {
          changedCoords[changedCount * 2] = tx;
          changedCoords[changedCount * 2 + 1] = ty;
          changedCount++;
        }
      }
    }
    return changedCount;
  }

  // Direct comparison — uses cached Uint32Array views when available.
  // No allocations in the hot path.
  private tileChangedJS(
    tx: number, ty: number, width: number, height: number,
    bufferWidth: number,
    rgbaU32: Uint32Array | null, prevU32: Uint32Array | null,
    rgba: Uint8ClampedArray, prevFrame: Uint8Array,
  ): boolean {
    const startX = tx * TILE_SIZE;
    const startY = ty * TILE_SIZE;
    const tileW = Math.min(TILE_SIZE, width - startX);
    const tileH = Math.min(TILE_SIZE, height - startY);

    // Fast path: 4-byte comparison using pre-created Uint32Array views
    if (rgbaU32 && prevU32) {
      for (let row = 0; row < tileH; row++) {
        const srcBase = (startY + row) * bufferWidth + startX;
        const prevBase = (startY + row) * width + startX;
        for (let col = 0; col < tileW; col++) {
          if (rgbaU32[srcBase + col] !== prevU32[prevBase + col]) return true;
        }
      }
      return false;
    }

    // Fallback: byte-level comparison
    for (let row = 0; row < tileH; row++) {
      const srcRowByte = ((startY + row) * bufferWidth + startX) * 4;
      const prevRowByte = ((startY + row) * width + startX) * 4;
      for (let col = 0; col < tileW; col++) {
        const s = srcRowByte + col * 4;
        const p = prevRowByte + col * 4;
        if (rgba[s] !== prevFrame[p] || rgba[s + 1] !== prevFrame[p + 1] ||
            rgba[s + 2] !== prevFrame[p + 2] || rgba[s + 3] !== prevFrame[p + 3]) return true;
      }
    }
    return false;
  }
}
