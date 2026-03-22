# DO86 — x86 OS Emulation in Cloudflare Durable Objects

## Project Overview

Full x86 PCs emulated at Cloudflare's edge using **Stratum** (our v86 fork).
Browser connects via WebSocket, receives compressed VGA frames, sends keyboard/mouse input.

- **Production**: https://do86.ashishkumarsingh.com
- **do86 repo**: `/workspace/do86` — GitHub `AshishKumar4/do86`
- **stratum repo**: `/workspace/stratum` — GitHub `AshishKumar4/stratum`

## Architecture

```
Browser ←WebSocket→ Worker (routes, packs assets) ←RPC→ Durable Object (Stratum v86 emulator)
```

### Demand-Paged Guest RAM
- Guest sees up to 3.5 GB logical memory
- WASM allocation: 64 MB (V8 lazily commits pages)
- Resident zone: 0–32 MB always in WASM (BIOS, kernel, low memory)
- Hot pool: 32–64 MB, 8192 frames × 4KB, Clock eviction
- Cold pages: DO SQLite (`ram_pages` table), paged in on fault
- WASM-side pool lookup: `FRAME_MAP[gpa >> 12]` — zero FFI on TLB hits
- Page fault path: `do_page_walk()` → `pool_lookup(gpa)` → miss → `swap_page_in()` (JS FFI → SQLite)

### Render Pipeline
- Adaptive FPS: 2–30fps based on VGA dirty state
- Tile-based delta compression (16×16 RGBA tiles)
- Frame types: 0=full keyframe, 1=delta, 3=status, 4=heartbeat, 5=stats

### CPU / JIT
- Yield override: BATCH_SIZE=8 (7 sync, 1 async), instruction-counter-based microtick
- JIT: WebAssembly.instantiate() works in production Workers (200+ compiled blocks)
- Threshold: 200K executions per block before compilation

## Tech Stack
- **Runtime**: Cloudflare Workers + Durable Objects
- **Build**: Vite + @cloudflare/vite-plugin
- **Language**: TypeScript (do86), Rust → WASM + JS (stratum)
- **Package manager**: Bun
- **Deploy**: `npx wrangler deploy`

## Key Files

### do86
| File | Lines | Purpose |
|------|-------|---------|
| `src/linux-vm.ts` | 1859 | DO class: v86 lifecycle, yield override, render loop, microtick, boot flow |
| `src/sql-page-store.ts` | 677 | Demand paging: Clock eviction, SQLite cold store, free-list, batch TLB flush |
| `src/index.ts` | 252 | Worker: routing, OS image configs, asset packing, /stats endpoint |
| `src/delta-encoder.ts` | 371 | Tile-based frame diffing + RLE compression |
| `src/network-relay.ts` | 1124 | Network relay: ARP, DHCP, DNS-over-HTTPS, TCP (standalone, not wired in) |
| `src/screen-adapter.ts` | 93 | VGA screen adapter + ImageData polyfill for Workers |
| `src/types.ts` | 96 | Constants (FPS, delays, thresholds, message types) |
| `src/libv86.mjs` | ~28K | Stratum ESM bundle (BUILT from stratum, never edit directly) |
| `src/v86.wasm` | ~1.9MB | Stratum WASM module (BUILT from stratum Rust, never edit directly) |

### stratum
| File | Purpose |
|------|---------|
| `src/rust/cpu/cpu.rs` | CPU core: do_page_walk hook, instruction dispatch, jit_run_interpreted |
| `src/rust/cpu/page_pool.rs` | WASM-side frame map (FRAME_MAP + REF_MAP) |
| `src/rust/cpu/memory.rs` | Physical memory access, PAGED_THRESHOLD, swap_page_in extern |
| `src/cpu.js` | JS CPU wrapper, JIT codegen_finalize with safe .catch() |
| `src/browser/starter.js` | V86 constructor, net_device "none" support, network adapters |
| `src/browser/ahci.js` | AHCI controller emulation |
| `src/browser/ahci_protocol.js` | AHCI DMA with demand-paging-aware resolveGPA |
| `src/acpi.js` | ACPI tables, demand-paging-aware DSDT patching |

## Build & Deploy

### Stratum (when emulator changes needed)
```sh
cd /workspace/stratum

# JS bundle (IIFE for browser, ESM for Workers)
bun run build          # builds both formats

# WASM (when Rust changes needed)
make build/v86.wasm    # needs rustup + wasm32-unknown-unknown target

# Copy to do86
cp build/libv86.mjs ../do86/src/libv86.mjs
cp build/v86.wasm ../do86/src/v86.wasm
```

### do86
```sh
cd /workspace/do86
bun install
bun run dev              # local dev on port 5173
bun run build            # production build
npx wrangler deploy      # deploy to Cloudflare
```

### Wrangler Auth
OAuth token expires. Re-auth:
```sh
npx wrangler login       # opens OAuth flow on port 8976
# Paste the callback URL back
```

Deploy command (with env cleanup for sandbox proxy):
```sh
cd /workspace/do86 && unset HTTPS_PROXY HTTP_PROXY http_proxy https_proxy CLOUDFLARE_API_BASE_URL CLOUDFLARE_API_TOKEN && CLOUDFLARE_ACCOUNT_ID=f44999d1ddda7012e9a87729eba250f1 npx wrangler deploy
```

## OS Images
| Key | OS | Drive | Notes |
|-----|-----|-------|-------|
| kolibri | KolibriOS | fda | Default. Fast boot. URL: copy.sh |
| aqeous | AqeousOS | multiboot | Custom OS. AHCI, 3.5GB logical, noSnapshot |
| tinycore | TinyCore 15 | cdrom | Static asset (no HTTPS available) |
| tinycore11 | TinyCore 11 | cdrom | Static asset |
| dsl | Damn Small Linux | cdrom | URL: copy.sh |
| helenos | HelenOS | cdrom | URL: copy.sh |
| linux4 | Linux 4.x | cdrom | URL: copy.sh |

## CRITICAL RULES

1. **NEVER edit libv86.mjs or v86.wasm directly.** Always edit stratum source, rebuild, copy.
2. **NEVER use stale builds from /shared.** Always rebuild from source.
3. **Always test production with FRESH session IDs.** Old sessions have cached snapshots.
4. **JIT works in production Workers.** Never set disable_jit: true.
5. **JIT .catch() must NOT call codegen_finalize_finished.** It poisons the WASM table.
6. **Test both KolibriOS AND AqeousOS after any change.** They exercise different code paths.
7. **Wrangler hot-reload destroys DO state.** Don't edit files during local dev testing.

## Known Issues / Current Bugs

### BLOCKING: selfLoadAssets hangs for KolibriOS in production
- Fresh KolibriOS sessions stuck at `recovering: kolibri` forever
- `env.ASSETS.fetch()` for BIOS/disk appears to hang in DO context
- `this.workerOrigin` may be stale/null after hibernation
- AqeousOS works (different recovery path?)
- Active investigation in fix-crash-and-swap session

### Microtick timing tension
- Instruction-counter microtick: fast (1-2 main_loop iterations), but PIT calibration broke before Rust flush fix
- Rust flush fix (dd0be37c): flushes instruction_counter before every dispatch
- Current: baseline microtick using instruction counter + fallback
- Need to verify this actually works with the Rust flush in production

### Performance
- KolibriOS: was smooth at ~30fps, currently degraded
- AqeousOS: boots but slow compared to browser demo (demand paging overhead)
- Hot pool nearly full at 8110/8192 with KolibriOS shell open

