/**
 * Minimal page store for QEMU standalone DO.
 * Provides the API that QemuWrapper expects (maxFrameCount, swapIn, pageOut).
 * Currently a stub — QEMU uses flat WASM memory, not demand paging.
 */

export interface QemuPageStore {
  readonly maxFrameCount: number;
  readonly stats: { hotPages: number; coldPages: number } | null;
  init(): void;
  setWasmHeap(heap: Uint8Array, poolBase: number): void;
  swapIn(gpa: number): number;
  pageOut(gpa: number, data: Uint8Array): void;
}

export class QemuPageStoreStub implements QemuPageStore {
  readonly maxFrameCount: number;
  stats: { hotPages: number; coldPages: number } | null = null;

  constructor(hotFrames: number) {
    this.maxFrameCount = hotFrames;
  }

  init(): void {
    this.stats = { hotPages: 0, coldPages: 0 };
  }

  setWasmHeap(_heap: Uint8Array, _poolBase: number): void {
    // No-op for now — QEMU manages its own memory
  }

  swapIn(_gpa: number): number {
    return -1; // Not handled
  }

  pageOut(_gpa: number, _data: Uint8Array): void {
    // No-op
  }
}
