<p align="center">
  <img src="logo.svg" alt="do86" width="420" />
</p>

<p align="center">
  <strong>x86 operating systems running inside Cloudflare Durable Objects</strong>
</p>

<p align="center">
  <a href="https://do86.ashishkumarsingh.com"><img src="https://img.shields.io/badge/Live-do86.ashishkumarsingh.com-F38020?logo=cloudflare&logoColor=white" alt="Live Demo"></a>
  <a href="https://workers.cloudflare.com"><img src="https://img.shields.io/badge/Built_with-Cloudflare_Workers-F38020?logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
  <a href="https://github.com/AshishKumar4/stratum"><img src="https://img.shields.io/badge/Emulator-Stratum-4B32C3" alt="Stratum"></a>
  <img src="https://img.shields.io/badge/Platform-Durable_Objects-7C3AED" alt="Durable Objects">
  <img src="https://img.shields.io/badge/License-MIT-green" alt="MIT License">
</p>

---

Full x86 PCs emulated at the edge using [Stratum](https://github.com/AshishKumar4/stratum) (a v86 fork with AHCI, ACPI, and SMP extensions). The browser connects over WebSocket and receives compressed framebuffer updates — no plugins, no VNC client, just a \`<canvas>\`.

**🚀 Try it live: [do86.ashishkumarsingh.com](https://do86.ashishkumarsingh.com)**

## How It Works

\`\`\`
┌────────────┐              ┌────────────┐              ┌─────────────────────┐
│            │  WebSocket   │            │     RPC      │                     │
│  Browser   │◄────────────►│   Worker   │◄────────────►│   Durable Object    │
│            │              │            │              │                     │
│  canvas    │ frames+input │  routes    │   assets     │   Stratum (v86)     │
│  keyboard  │              │  packs     │              │   demand-paged RAM  │
│  mouse     │              │  assets    │              │   delta encoder     │
│            │              │            │              │   SQLite storage    │
└────────────┘              └────────────┘              └─────────────────────┘
\`\`\`

1. **Browser** opens a WebSocket to the Worker, requesting an OS image
2. **Worker** loads BIOS + disk image from Assets/CDN, packs them, and forwards to the Durable Object
3. **Durable Object** boots Stratum — a full x86 CPU emulated in WebAssembly with demand-paged guest RAM
4. **Frames** are captured from virtual VGA, delta-compressed (tile-based diffing), and streamed over WebSocket
5. **Input** (keyboard scancodes, mouse deltas) flows back to the emulator

## Available OS Images

| Image | OS | Boot | Notes |
|-------|----|------|-------|
| \`kolibri\` | [KolibriOS](http://kolibrios.org) | Floppy | Default. Full GUI, boots in seconds |
| \`aqeous\` | [AqeousOS](https://github.com/AshishKumar4/AqeousOS) | Multiboot | Custom x86 OS with AHCI, window system, EXT2 |
| \`tinycore\` | TinyCore 15 | CD-ROM | Minimal Linux with X11 + FLWM |
| \`tinycore11\` | TinyCore 11 | CD-ROM | Classic release |
| \`dsl\` | Damn Small Linux | CD-ROM | Fluxbox desktop, browser, tools |
| \`helenos\` | HelenOS | CD-ROM | Research microkernel OS |
| \`linux4\` | Linux 4.x | CD-ROM | Minimal text-mode kernel |

## Architecture

### Demand-Paged Guest RAM

Guest OSes see up to 3.5 GB of logical RAM, but the DO only commits ~60-80 MB of real memory (within the 128 MB DO limit):

\`\`\`
Guest Physical Address Space (up to 3.5 GB logical)
┌──────────────────────┬──────────────────────┬─────────────────────┐
│   Resident Zone      │   Hot Page Pool      │   Cold Pages        │
│   0 – 32 MB          │   32 – 64 MB WASM    │   > 64 MB           │
│   Always in WASM     │   8192 × 4KB frames  │   Stored in SQLite  │
│   BIOS, kernel, low  │   Clock eviction     │   Paged in on fault │
└──────────────────────┴──────────────────────┴─────────────────────┘
\`\`\`

- **WASM-side pool lookup**: TLB miss → \`pool_lookup(gpa)\` — pure WASM, zero FFI
- **Cold miss**: \`swap_page_in()\` → SQLite read → frame allocation
- **Batched SQLite I/O** for page fault storms
- **CDN-cached disk images** via Cache API

### Render Pipeline

- **Adaptive FPS**: 2–30 FPS based on screen activity
- **Tile-based delta compression**: only changed tiles sent
- **Multi-client**: multiple browsers share the same VM session

### JIT Compilation

Hot x86 basic blocks compiled to WASM at runtime via \`WebAssembly.instantiate()\`. Confirmed working in production Workers (200+ compiled blocks).

## Quick Start

\`\`\`sh
bun install
bun run dev
\`\`\`

### Deploy

\`\`\`sh
bun run build
npx wrangler deploy
\`\`\`

## Stratum (v86 Fork)

This project uses [Stratum](https://github.com/AshishKumar4/stratum), a fork of v86 with AHCI, ACPI, SMP scaffolding, demand paging hooks, and \`net_device: "none"\` support.

Rebuild after stratum changes:
\`\`\`sh
cd ../stratum && bun run build
cp build/libv86.mjs ../do86/src/libv86.mjs
\`\`\`

## License

MIT
