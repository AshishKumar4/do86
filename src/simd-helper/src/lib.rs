#![no_std]

#[cfg(target_arch = "wasm32")]
use core::arch::wasm32::*;

/// Compare two contiguous byte buffers of `len` bytes using SIMD.
/// Returns 1 if any byte differs, 0 if identical.
///
/// Processes 16 bytes at a time via v128 XOR + any_true.
/// Handles trailing bytes with scalar fallback.
#[no_mangle]
#[cfg(target_arch = "wasm32")]
pub unsafe extern "C" fn tiles_differ(ptr_a: *const u8, ptr_b: *const u8, len: u32) -> u32 {
    let n = len as usize;
    let chunks = n / 16;
    let remainder = n % 16;

    // SIMD: 16-byte chunks
    for i in 0..chunks {
        let off = i * 16;
        let a = v128_load(ptr_a.add(off) as *const v128);
        let b = v128_load(ptr_b.add(off) as *const v128);
        let diff = v128_xor(a, b);
        if v128_any_true(diff) {
            return 1;
        }
    }

    // Scalar: remaining bytes
    let tail_off = chunks * 16;
    for i in 0..remainder {
        if *ptr_a.add(tail_off + i) != *ptr_b.add(tail_off + i) {
            return 1;
        }
    }

    0
}

/// Compare tiles between two framebuffers with potentially different row strides.
///
/// Both buffers are RGBA (4 bytes per pixel).
/// `old_buf` is the previous frame stored contiguously (stride = width * 4).
/// `new_buf` is the current frame which may have bufferWidth > width (stride = buf_stride_px * 4).
/// `width` and `height` are the visible dimensions in pixels.
/// `buf_stride_px` is the row stride of `new_buf` in pixels (>= width).
/// `tile_size` is the tile edge length in pixels (e.g. 64).
/// `out_dirty` points to a u8 array where each byte is set to 1 if the tile is dirty, 0 otherwise.
///
/// Returns the number of dirty tiles found.
#[no_mangle]
#[cfg(target_arch = "wasm32")]
pub unsafe extern "C" fn diff_tiles(
    old_buf: *const u8,
    new_buf: *const u8,
    width: u32,
    height: u32,
    buf_stride_px: u32,
    tile_size: u32,
    out_dirty: *mut u8,
) -> u32 {
    let w = width as usize;
    let h = height as usize;
    let stride_new = buf_stride_px as usize * 4; // bytes per row in new buffer
    let stride_old = w * 4;                       // bytes per row in old buffer (contiguous)
    let ts = tile_size as usize;

    let tiles_x = (w + ts - 1) / ts;
    let tiles_y = (h + ts - 1) / ts;
    let mut dirty_count: u32 = 0;

    for ty in 0..tiles_y {
        for tx in 0..tiles_x {
            let tile_idx = ty * tiles_x + tx;
            let start_x = tx * ts;
            let start_y = ty * ts;
            let tile_w = if start_x + ts <= w { ts } else { w - start_x };
            let tile_h = if start_y + ts <= h { ts } else { h - start_y };
            let row_bytes = tile_w * 4;

            let mut found_diff = false;

            for row in 0..tile_h {
                let y = start_y + row;
                let new_row_ptr = new_buf.add(y * stride_new + start_x * 4);
                let old_row_ptr = old_buf.add(y * stride_old + start_x * 4);

                // SIMD compare this row segment
                let chunks = row_bytes / 16;
                let remainder = row_bytes % 16;

                for c in 0..chunks {
                    let off = c * 16;
                    let a = v128_load(new_row_ptr.add(off) as *const v128);
                    let b = v128_load(old_row_ptr.add(off) as *const v128);
                    let diff = v128_xor(a, b);
                    if v128_any_true(diff) {
                        found_diff = true;
                        break;
                    }
                }

                if found_diff {
                    break;
                }

                // Check remainder bytes
                let tail_off = chunks * 16;
                for i in 0..remainder {
                    if *new_row_ptr.add(tail_off + i) != *old_row_ptr.add(tail_off + i) {
                        found_diff = true;
                        break;
                    }
                }

                if found_diff {
                    break;
                }
            }

            if found_diff {
                *out_dirty.add(tile_idx) = 1;
                dirty_count += 1;
            } else {
                *out_dirty.add(tile_idx) = 0;
            }
        }
    }

    dirty_count
}

/// Copy rows from a strided source buffer into a contiguous destination buffer.
/// Useful for flattening a bufferWidth-padded RGBA frame into width-packed layout.
///
/// `src`: source buffer (stride = src_stride_px * 4 bytes per row)
/// `dst`: destination buffer (stride = width * 4 bytes per row)
/// `width`: visible width in pixels
/// `height`: visible height in pixels
/// `src_stride_px`: source row stride in pixels
#[no_mangle]
#[cfg(target_arch = "wasm32")]
pub unsafe extern "C" fn copy_strided(
    src: *const u8,
    dst: *mut u8,
    width: u32,
    height: u32,
    src_stride_px: u32,
) {
    let w = width as usize;
    let h = height as usize;
    let src_stride = src_stride_px as usize * 4;
    let row_bytes = w * 4;

    for row in 0..h {
        let src_row = src.add(row * src_stride);
        let dst_row = dst.add(row * row_bytes);

        // SIMD copy: 16 bytes at a time
        let chunks = row_bytes / 16;
        let remainder = row_bytes % 16;

        for c in 0..chunks {
            let off = c * 16;
            let v = v128_load(src_row.add(off) as *const v128);
            v128_store(dst_row.add(off) as *mut v128, v);
        }

        let tail = chunks * 16;
        for i in 0..remainder {
            *dst_row.add(tail + i) = *src_row.add(tail + i);
        }
    }
}

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    core::arch::wasm32::unreachable()
}
