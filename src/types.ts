// ── Protocol constants (must match client) ──────────────────────────────────

export const MSG_FULL_FRAME = 0;
export const MSG_DELTA_FRAME = 1;
export const MSG_SERIAL_DATA = 2;
export const MSG_STATUS = 3;
export const MSG_TEXT_SCREEN = 4;

// ── Rendering constants ─────────────────────────────────────────────────────

export const TILE_SIZE = 64;
export const FPS_MIN = 2;
export const FPS_MAX = 15;
export const FPS_DEFAULT = 8;
export const LARGE_FRAME_BYTES = 50_000;
export const MAX_RESOLUTION = 1280 * 1024;

// ── Storage constants ───────────────────────────────────────────────────────

export const SQLITE_BLOCK_SIZE = 4096;
export const IMAGE_CHUNK_SIZE = 512 * 1024; // 512KB per chunk
export const SWAP_DEVICE = "swap";
export const SWAP_SIZE = 10 * 1024 * 1024 * 1024; // 10GB lazy-allocated
export const HOT_CACHE_MAX = 2048;
export const CACHE_DEVICE = "cache";

// ── Boot constants ──────────────────────────────────────────────────────────

export const BOOT_ORDER_CDROM_FIRST = 0x213;
export const BOOT_ORDER_HDA_FIRST = 0x312;
export const EMULATOR_LOAD_TIMEOUT_MS = 30_000;
export const SNAPSHOT_DELAY_FAST_MS = 30_000;  // KolibriOS — boots fast
export const SNAPSHOT_DELAY_SLOW_MS = 60_000;  // Heavier OSes

// ── Log prefix ──────────────────────────────────────────────────────────────

export const LOG_PREFIX = "[do86]";

// ── Shared types ────────────────────────────────────────────────────────────

export type ClientMessage =
  | { type: "keydown" | "keyup"; code: number }
  | { type: "mousemove"; dx: number; dy: number }
  | { type: "mousedown" | "mouseup"; button: number }
  | { type: "serial"; data: string }
  | { type: "text"; data: string }
  | { type: "scancodes"; codes: number[] }
  | { type: "heartbeat" }
  | { type: "boot" };

export interface ClientState {
  needsKeyframe: boolean;
  droppedFrames: number;
  lastSendTime: number;
}

// ── v86 VGA device interface ────────────────────────────────────────────────
// Typed subset of v86's internal VGA device that we actually access.

export interface VgaDevice {
  cpu: {
    wasm_memory: WebAssembly.Memory;
    svga_dirty_bitmap_min_offset: Uint32Array;
    svga_dirty_bitmap_max_offset: Uint32Array;
  };
  screen: any;
  graphical_mode: boolean;
  screen_width: number;
  screen_height: number;
  virtual_width: number;
  virtual_height: number;
  svga_enabled: boolean;
  // Legacy VGA dirty range — set by port writes, consumed by screen_fill_buffer
  diff_addr_min: number;
  diff_addr_max: number;
  vga_memory_size: number;
  image_data: ImageData | null;
  dest_buffet_offset: number; // v86's typo, not ours
  screen_fill_buffer(): void;
  complete_redraw(): void;
  reset_diffs(): void;
  update_layers(): void;
}

// ── Minimal SqlStorage interface ────────────────────────────────────────────
// Matches Cloudflare DO SqlStorage.exec — avoids importing full workers-types
// in modules that only need SQL access.

export interface SqlHandle {
  exec(query: string, ...params: any[]): Iterable<Record<string, any>>;
}
