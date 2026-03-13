// ── ImageData polyfill ──────────────────────────────────────────────────────
// v86's VGA code requires ImageData to exist for graphical framebuffer allocation.
// Workers (workerd) don't have a DOM, so we provide a minimal shim.

if (typeof (globalThis as any).ImageData === "undefined") {
  (globalThis as any).ImageData = class ImageData {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      maybeHeight?: number,
    ) {
      if (dataOrWidth instanceof Uint8ClampedArray) {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = maybeHeight || dataOrWidth.length / 4 / widthOrHeight;
      } else {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      }
    }
  };
}

// ── Screen Adapter ──────────────────────────────────────────────────────────
// Headless v86 screen adapter that captures text/graphical output without a DOM.

export class DOScreenAdapter {
  FLAG_BLINKING = 1;
  FLAG_FONT_PAGE_B = 2;
  graphicalMode = false;
  screenWidth = 0;
  screenHeight = 0;
  dirty = false;

  private textData = new Uint8Array(80 * 25);
  private textWidth = 80;
  private textHeight = 25;

  get textWidth_(): number { return this.textWidth; }
  get textHeight_(): number { return this.textHeight; }

  set_mode(graphical: boolean): void { this.graphicalMode = graphical; }

  put_char(row: number, col: number, chr: number, _f?: number, _b?: number, _fg?: number): void {
    if (row < this.textHeight && col < this.textWidth) {
      this.textData[row * this.textWidth + col] = chr;
    }
  }

  set_size_text(cols: number, rows: number): void {
    if (cols !== this.textWidth || rows !== this.textHeight) {
      this.textData = new Uint8Array(cols * rows);
      this.textWidth = cols;
      this.textHeight = rows;
    }
  }

  set_size_graphical(width: number, height: number, _vw: number, _vh: number): void {
    this.screenWidth = width;
    this.screenHeight = height;
    this.dirty = true;
  }

  update_buffer(_layers: unknown): void {
    this.dirty = true;
  }

  // Required no-op stubs for v86 VGA interface
  set_font_bitmap(_h: number, _w9: boolean, _wd: boolean, _c8: boolean, _bm: Uint8Array, _ch: boolean): void {}
  set_font_page(_a: number, _b: number): void {}
  clear_screen(): void {}
  update_cursor_scanline(_s: number, _e: number, _en: boolean): void {}
  update_cursor(_r: number, _c: number): void {}
  set_scale(_sx: number, _sy: number): void {}
  pause(): void {}
  continue(): void {}
  destroy(): void {}
  make_screenshot(): null { return null; }

  getTextScreen(): string[] {
    const screen: string[] = [];
    for (let i = 0; i < this.textHeight; i++) {
      const begin = i * this.textWidth;
      const row = this.textData.subarray(begin, begin + this.textWidth);
      screen.push(Array.from(row, (chr) => String.fromCharCode(chr || 32)).join(""));
    }
    return screen;
  }
}
