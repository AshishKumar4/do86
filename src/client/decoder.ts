// decoder.ts — pure frame-decoding functions for the do86 binary protocol.
//
// These operate on raw ArrayBuffers and write into Uint32Array pixel buffers.
// They have zero DOM/canvas dependencies — the caller owns rendering.

// ── Protocol constants (must match server) ──────────────────────────────────

export const MSG_FULL_FRAME  = 0;
export const MSG_DELTA_FRAME = 1;
export const MSG_SERIAL_DATA = 2;
export const MSG_STATUS      = 3;
export const MSG_TEXT_SCREEN = 4;
export const MSG_STATS       = 5;

// ── Types ───────────────────────────────────────────────────────────────────

/** Dirty rectangle produced by delta frame decode */
export interface DirtyRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface FullFrameResult {
  width: number;
  height: number;
}

export interface DeltaFrameResult {
  width: number;
  height: number;
  dirty: DirtyRect | null;
}

export interface TextScreenResult {
  cols: number;
  rows: number;
  lines: string[];
  width: number;
  height: number;
}

// ── Pixel blitting ──────────────────────────────────────────────────────────

/**
 * Blit raw RGB (3 bytes/pixel) into a Uint32Array pixel buffer.
 * Returns the new source offset after reading.
 */
export function blitRGB(
  src: Uint8Array,
  srcOffset: number,
  u32: Uint32Array,
  canvasWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  let si = srcOffset;
  for (let row = 0; row < h; row++) {
    let di = (y + row) * canvasWidth + x;
    for (let col = 0; col < w; col++) {
      // Pack RGBA into single u32 (little-endian: ABGR)
      u32[di++] = 0xFF000000 | (src[si + 2] << 16) | (src[si + 1] << 8) | src[si];
      si += 3;
    }
  }
  return si;
}

/**
 * Decode RLE-encoded pixel data into a Uint32Array pixel buffer.
 * Format: [R, G, B, runLength] per entry — runLength 0 means 1 pixel.
 * Returns the new source offset after reading.
 */
export function decodeRLE(
  src: Uint8Array,
  srcOffset: number,
  u32: Uint32Array,
  canvasWidth: number,
  x: number,
  y: number,
  w: number,
  h: number,
): number {
  let si = srcOffset;
  const totalPixels = w * h;
  let row = 0;
  let col = 0;
  let pixelIdx = 0;

  while (pixelIdx < totalPixels && si < src.length) {
    const r = src[si++], g = src[si++], b = src[si++], run = src[si++];
    const packed = 0xFF000000 | (b << 16) | (g << 8) | r;

    for (let k = 0; k <= run && pixelIdx < totalPixels; k++) {
      u32[(y + row) * canvasWidth + (x + col)] = packed;
      pixelIdx++;
      col++;
      if (col >= w) { col = 0; row++; }
    }
  }
  return si;
}

// ── Frame decoders ──────────────────────────────────────────────────────────

/**
 * Decode a full (keyframe) frame message.
 * Writes all pixels into the provided u32 buffer.
 * Returns frame dimensions, or null if the message is malformed.
 */
export function decodeFullFrame(
  data: ArrayBuffer,
  u32: Uint32Array,
): FullFrameResult | null {
  const view = new DataView(data);
  const width = view.getUint16(1, true);
  const height = view.getUint16(3, true);
  if (width === 0 || height === 0) return null;
  if (data.byteLength - 5 < width * height * 3) return null;

  blitRGB(new Uint8Array(data, 5), 0, u32, width, 0, 0, width, height);
  return { width, height };
}

/**
 * Decode a delta frame message (series of dirty rectangles).
 * Writes changed pixels into the provided u32 buffer.
 * Returns frame dimensions and the bounding dirty rect (or null if empty).
 */
export function decodeDeltaFrame(
  data: ArrayBuffer,
  u32: Uint32Array,
): DeltaFrameResult | null {
  const view = new DataView(data);
  const width = view.getUint16(1, true);
  const height = view.getUint16(3, true);
  const numRects = view.getUint16(5, true);
  if (width === 0 || height === 0) return null;

  const srcBytes = new Uint8Array(data);
  let offset = 7;

  let dirtyMinX = width, dirtyMinY = height, dirtyMaxX = 0, dirtyMaxY = 0;

  for (let i = 0; i < numRects; i++) {
    const rx = view.getUint16(offset, true); offset += 2;
    const ry = view.getUint16(offset, true); offset += 2;
    const rw = view.getUint16(offset, true); offset += 2;
    const rh = view.getUint16(offset, true); offset += 2;
    const rle = srcBytes[offset++];

    if (rx < dirtyMinX) dirtyMinX = rx;
    if (ry < dirtyMinY) dirtyMinY = ry;
    if (rx + rw > dirtyMaxX) dirtyMaxX = rx + rw;
    if (ry + rh > dirtyMaxY) dirtyMaxY = ry + rh;

    if (rle) {
      offset = decodeRLE(srcBytes, offset, u32, width, rx, ry, rw, rh);
    } else {
      offset = blitRGB(srcBytes, offset, u32, width, rx, ry, rw, rh);
    }
  }

  const dirty = (dirtyMaxX > dirtyMinX && dirtyMaxY > dirtyMinY)
    ? { x: dirtyMinX, y: dirtyMinY, w: dirtyMaxX - dirtyMinX, h: dirtyMaxY - dirtyMinY }
    : null;

  return { width, height, dirty };
}

/**
 * Decode a text-mode screen message.
 * Returns dimensions (in pixels) and the text lines to render.
 */
export function decodeTextScreen(data: ArrayBuffer, td: TextDecoder): TextScreenResult {
  const view = new DataView(data);
  const cols = view.getUint8(1);
  const rows = view.getUint8(2);
  const lines = td.decode(new Uint8Array(data, 3)).split("\n");
  const charW = 8, charH = 16;
  return { cols, rows, lines, width: cols * charW, height: rows * charH };
}
