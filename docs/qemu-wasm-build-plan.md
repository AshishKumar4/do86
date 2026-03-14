# QEMU-WASM Build Plan for Durable Objects

## Executive Summary

Two proven projects have successfully compiled QEMU to WebAssembly:

1. **ktock/qemu-wasm** — QEMU 8.2 compiled via Emscripten with TCG JIT (translates IR→WASM modules at runtime). Uses pthreads/SharedArrayBuffer. 317 stars.
2. **ericmigi/pebble-qemu-wasm** — QEMU 10.1 compiled via Emscripten with TCI (interpreter, no JIT). Uses pthreads for worker thread. 65 stars. **33MB WASM binary.**

Our goal: compile QEMU to WASM that runs inside a Cloudflare Durable Object (single-threaded, no pthreads, no SharedArrayBuffer).

---

## Source Analysis

### ktock/qemu-wasm (QEMU 8.2, TCG JIT)

| Property | Value |
|---|---|
| QEMU version | 8.2.0 |
| Emscripten version | 3.1.50 |
| Build system | Docker multi-stage (Dockerfile) |
| Target | `x86_64-softmmu` (also aarch64, riscv64) |
| TCG mode | **JIT** — translates TB (Translation Block) IR to WASM modules at runtime |
| Threading | **Yes** — `-pthread -sPROXY_TO_PTHREAD=1 -matomics -mbulk-memory` |
| Coroutine backend | `fiber` |
| Key dependencies | glib 2.75.0, pixman 0.42.2, zlib 1.3.1, libffi |
| Memory | `-sTOTAL_MEMORY=2300MB` (for x86_64 guest) |
| Output files | `.js` (loader), `.wasm` (binary), `.worker.js` (pthread worker) |

**Key build flags** (from Dockerfile + README):
```bash
emconfigure ./configure --static --target-list=x86_64-softmmu --cpu=wasm32 \
  --without-default-features --enable-system --with-coroutine=fiber --enable-virtfs \
  --extra-cflags="-O3 -matomics -mbulk-memory -DNDEBUG -DG_DISABLE_ASSERT \
    -D_GNU_SOURCE -sASYNCIFY=1 -pthread -sPROXY_TO_PTHREAD=1 \
    -sFORCE_FILESYSTEM -sALLOW_TABLE_GROWTH -sTOTAL_MEMORY=2300MB \
    -sWASM_BIGINT -sMALLOC=mimalloc"
```

**How JIT works**: Each hot Translation Block (executed >1000 times) is compiled from QEMU's TCG IR to a WASM module using `WebAssembly.Module()` + `WebAssembly.Instance()` browser APIs. Cold TBs use TCI (interpreter). This hybrid approach gives ~5-10x speedup over pure TCI.

**Upstreaming status** (as of the README):
- TCI for 32-bit guests: **Upstreamed in QEMU 10.1**
- TCI for 64-bit guests: Under review (PATCH v3)
- TCG JIT for WASM: Under review (PATCH v2)

### ericmigi/pebble-qemu-wasm (QEMU 10.1, TCI)

| Property | Value |
|---|---|
| QEMU version | 10.1 (with upstream TCI support) |
| Emscripten version | Uses `emsdk-wasm32-cross.docker` from QEMU 10.1 |
| Target | `arm-softmmu` (Pebble smartwatch) |
| TCG mode | **TCI** (interpreter only, `--enable-tcg-interpreter`) |
| Threading | **Yes** — uses `-pthread`, `PROXY_TO_PTHREAD`, `SharedArrayBuffer` |
| WASM binary size | **33 MB** |
| JS loader size | 343 KB |
| Output files | `.js`, `.wasm`, `.worker.js` |

**Key build flags**:
```bash
emconfigure ./configure --static --target-list=arm-softmmu \
  --without-default-features --enable-system --enable-tcg-interpreter \
  --disable-tools --disable-docs --disable-pie \
  --extra-cflags="-DSTM32_UART_NO_BAUD_DELAY -DTCI_INSTRUMENT -flto -msimd128"
```

**JIT variant** also exists (`build_wasm_jit.sh` / `Dockerfile.wasm-jit`):
- Uses ktock/qemu-wasm's `wasm64-tcg-b` branch
- Emsdk 4.0.23, glib 2.84.0, pixman 0.44.2
- Uses `-sMEMORY64=2` for wasm32-compatible 64-bit pointers
- Uses `--cpu=wasm64` and `--enable-wasm64-32bit-address-limit`
- Does NOT use `--enable-tcg-interpreter` (uses real TCG JIT)

---

## Key Question: Can QEMU Run Without pthreads?

### The Problem

Both existing projects use `-pthread` and `-sPROXY_TO_PTHREAD=1`. Cloudflare Workers have NO threading support — no Web Workers, no SharedArrayBuffer, no Atomics.

### Analysis

QEMU's threading is used for:

1. **MTTCG (Multi-Threaded TCG)** — one host thread per vCPU. Not needed if we use `--accel tcg,thread=single` (round-robin vCPUs on one thread).

2. **PROXY_TO_PTHREAD** — Emscripten feature that runs `main()` on a Web Worker to avoid blocking the browser's main thread. In a DO, there IS no browser main thread — the WASM runs directly. This is not needed.

3. **I/O threads** — QEMU's AIO (async I/O) event loop can use threads. With `-sASYNCIFY=1`, Emscripten converts blocking calls to async yields, which can replace threading for I/O.

4. **Coroutine backend** — QEMU uses `fiber` coroutines for Emscripten, which does NOT require pthreads. Fibers use Emscripten's ASYNCIFY mechanism.

5. **glib/GMainLoop** — glib's event loop uses mutexes internally, but in single-threaded mode these are no-ops.

### Verdict

**Yes, it should be possible to build QEMU without pthreads**, but it requires:

1. Remove `-pthread` and `-sPROXY_TO_PTHREAD=1` from CFLAGS/LDFLAGS
2. Remove `-matomics` and `-mbulk-memory` (WASM threading features)
3. Use `--accel tcg,thread=single` at runtime
4. Use `-sASYNCIFY=1` (already used) for cooperative yielding
5. Stub out or disable any code that calls `pthread_create()` directly
6. Patch glib's threading stubs for single-threaded Emscripten build (glib already has stub implementations for this)

The pebble-qemu-wasm project uses pthreads only for:
- `PROXY_TO_PTHREAD` (browser main thread offloading)
- `SharedArrayBuffer` writes for button input
- Neither is needed in a DO

### Risk Assessment

**Medium risk.** The core QEMU TCG engine in TCI mode is fundamentally single-threaded (it's a C interpreter loop). The risk is in glib and QEMU's internal event loop assuming threading primitives exist. The `--with-coroutine=fiber` flag already handles the main async pattern.

---

## Proposed Build Configuration

### Target: i386-softmmu (32-bit x86 for AqeousOS)

```bash
# Configure command for DO-compatible QEMU WASM
emconfigure ./configure \
  --static \
  --target-list=i386-softmmu \
  --cpu=wasm32 \
  --without-default-features \
  --enable-system \
  --enable-tcg-interpreter \
  --with-coroutine=fiber \
  --disable-tools \
  --disable-docs \
  --disable-pie \
  --disable-guest-agent \
  --disable-vnc \
  --disable-sdl \
  --disable-gtk \
  --disable-opengl \
  --disable-curses \
  --disable-slirp \
  --disable-libusb \
  --disable-usb-redir \
  --disable-spice \
  --disable-smartcard \
  --extra-cflags=" \
    -O2 \
    -DNDEBUG \
    -DG_DISABLE_ASSERT \
    -sASYNCIFY=1 \
    -sFORCE_FILESYSTEM \
    -sALLOW_TABLE_GROWTH \
    -sTOTAL_MEMORY=256MB \
    -sWASM_BIGINT \
    -sMALLOC=mimalloc \
    -flto \
  " \
  --extra-ldflags=" \
    -sEXPORTED_RUNTIME_METHODS=getTempRet0,setTempRet0,addFunction,removeFunction,FS \
    -flto \
  "
```

### Features Enabled

| Feature | Status | Notes |
|---|---|---|
| TCG (TCI interpreter) | Enabled | `--enable-tcg-interpreter` |
| i386 system emulation | Enabled | `--target-list=i386-softmmu` |
| VGA (stdvga) | Enabled (default device) | Framebuffer output for DO streaming |
| IDE disk | Enabled (default device) | For CD-ROM/ISO boot |
| PS/2 keyboard/mouse | Enabled (default device) | For input from WebSocket |
| APIC/IOAPIC | Enabled (default for i386) | For SMP if we add it later |
| PIT (8254 timer) | Enabled (default) | |
| PIC (8259) | Enabled (default) | |
| PCI bus | Enabled (default) | |
| Fiber coroutines | Enabled | `--with-coroutine=fiber` |
| ASYNCIFY | Enabled | For cooperative yielding |

### Features Disabled

| Feature | Reason |
|---|---|
| pthreads | Workers have no threading |
| VNC server | We stream framebuffer directly |
| SDL/GTK/OpenGL | No display in Workers |
| slirp networking | Not needed initially |
| USB/libusb | Not needed |
| Spice | Not needed |
| Audio | Not needed |
| Guest agent | Not needed |
| AHCI | Can enable later if needed |

### Estimated Binary Size

Based on pebble-qemu-wasm's 33MB for ARM TCI:
- i386 target is larger (more instructions to decode) — estimate ~35-40MB
- With LTO and stripping: ~25-30MB
- gzip compressed: ~8-10MB

**Worker size limit**: 10MB for the Worker script itself. BUT: the WASM binary can be loaded from R2 at runtime using `WebAssembly.instantiate()` with fetched bytes, or stored as a DO asset.

---

## Integration Architecture

### How QEMU-WASM fits into the existing DO

```
Browser Client
     │
     │ WebSocket (VNC-like frame protocol)
     │
┌────┴──────────────────────────────────┐
│         Durable Object (DO)           │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │      QEMU WASM Instance         │  │
│  │                                 │  │
│  │  ┌─────────┐  ┌──────────────┐ │  │
│  │  │ TCG/TCI │  │ Device Models│ │  │
│  │  │  (CPU)  │  │ VGA, IDE,   │ │  │
│  │  │         │  │ PS/2, APIC  │ │  │
│  │  └─────────┘  └──────────────┘ │  │
│  │         │              │       │  │
│  │    Guest RAM      Framebuffer  │  │
│  │   (WASM linear     (shared    │  │
│  │    memory)          buffer)    │  │
│  └─────────────────────────────────┘  │
│              │              │         │
│     Disk images       Frame render    │
│     (from R2/         loop sends      │
│      SQLite)          RGBA to client  │
└───────────────────────────────────────┘
```

### VGA Output

QEMU's VGA device writes to a framebuffer in guest memory. In native QEMU, `graphic_hw_update()` is called to get the current frame. In the WASM build:

1. Call `graphic_hw_update()` on a timer (e.g., 30 FPS)
2. Read the VGA framebuffer from WASM memory (it's a flat RGBA buffer)
3. Diff against the previous frame (like our current v86 approach)
4. Send changed regions over WebSocket to the client

The existing DO already does exactly this for v86 — the integration path is identical.

### Keyboard Input

QEMU's PS/2 keyboard model accepts scancodes. The existing DO receives scancodes from WebSocket clients and feeds them to v86's bus. For QEMU:

1. Client sends scancode via WebSocket (existing protocol)
2. DO calls `qemu_input_event_send_key_number(...)` or writes to PS/2 port
3. QEMU delivers the keypress to the guest via the PS/2 controller → PIC → CPU

### Disk Images

AqeousOS boots from a CD-ROM ISO. In QEMU:
- Load the ISO into Emscripten's virtual filesystem (`FS.writeFile`)
- Or use `-drive file=/path/to/aqeous.iso,format=raw,if=ide,media=cdrom`
- The ISO can be fetched from R2 and written to FS before QEMU starts

BIOS files (SeaBIOS + VGA BIOS) also need to be loaded into the virtual filesystem:
- `bios-256k.bin` (~256KB)
- `vgabios-stdvga.bin` (~64KB)
- `kvmvapic.bin` (~9KB)
- `linuxboot_dma.bin` (~1KB)

---

## SMP Support (Future)

QEMU's single-threaded TCG mode already supports multi-vCPU via round-robin:

```bash
qemu-system-i386 -smp 2 -accel tcg,thread=single ...
```

In this mode, QEMU round-robins between vCPUs on a single thread — exactly what we need for cooperative SMP in a DO. The APIC, IOAPIC, and INIT/SIPI protocol are all handled by QEMU's existing device models.

This means **SMP comes essentially for free** once the basic QEMU-WASM build works.

---

## Build Steps

### Phase 1: Docker Build Environment

```bash
# 1. Download QEMU 10.1 source
wget https://download.qemu.org/qemu-10.1.0.tar.xz
tar xf qemu-10.1.0.tar.xz

# 2. Build the base Docker image (from QEMU's own Emscripten dockerfile)
docker build -t qemu-wasm-base \
  -f qemu-10.1.0/tests/docker/dockerfiles/emsdk-wasm32-cross.docker .

# 3. Or use ktock/qemu-wasm's Dockerfile for a full build env with
#    glib/pixman/zlib already compiled for Emscripten
docker build -t qemu-wasm-full -f Dockerfile .
```

### Phase 2: Configure & Build

```bash
docker run -v $(pwd)/qemu-10.1.0:/qemu:ro -it qemu-wasm-full bash

# Inside container:
cp -a /qemu /qemu-rw && cd /qemu-rw

emconfigure ./configure \
  --static \
  --target-list=i386-softmmu \
  --without-default-features \
  --enable-system \
  --enable-tcg-interpreter \
  --disable-tools --disable-docs --disable-pie \
  --extra-cflags="-O2 -DNDEBUG -sASYNCIFY=1 -sFORCE_FILESYSTEM \
    -sALLOW_TABLE_GROWTH -sTOTAL_MEMORY=256MB -sWASM_BIGINT -flto" \
  --extra-ldflags="-flto -sEXPORTED_RUNTIME_METHODS=getTempRet0,setTempRet0,addFunction,removeFunction,FS"

ninja -j$(nproc) qemu-system-i386.js
```

### Phase 3: Test in Browser

Before integrating with DO, verify it works in a browser:
1. Package BIOS files and ISO with `emscripten file_packager`
2. Serve with a simple HTTP server
3. Verify AqeousOS boots and displays frames

### Phase 4: DO Integration

1. Load `qemu-system-i386.wasm` from R2 at DO startup
2. Instantiate with custom imports (replace Emscripten's browser APIs with DO-compatible ones)
3. Hook VGA output to DO's frame streaming
4. Hook PS/2 input to DO's WebSocket handler
5. Replace v86 in the DO's `bootVM()` method with QEMU startup

---

## Configure Test Results (from this sandbox)

We successfully ran `emconfigure ./configure` against QEMU 10.1.0 with Emscripten 3.1.50. Results:

### What worked
- Emscripten detected as C compiler: `emcc -m32 (emscripten 3.1.50)`
- Host CPU detected as `wasm32`
- `--with-coroutine=wasm` accepted — **QEMU 10.1 has native WASM coroutine support!** (not `fiber` from older builds)
- `--enable-tcg-interpreter` accepted
- Thread detection passed (`Run-time dependency threads found: YES`)
- All C compiler flag checks passed

### What failed (expected)
- `glib-2.0` not found — requires pre-compiling glib for Emscripten (Docker build handles this)
- No `pkg-config` configured for cross-compilation

### Key Discovery
QEMU 10.1's meson build system has changed the coroutine backend options from older versions:
```
Old (qemu-wasm 8.2): --with-coroutine=fiber
New (QEMU 10.1):     --with-coroutine=wasm    ← native WASM support!
```

This means QEMU 10.1 has **first-class Emscripten/WASM support** baked into the official source. The TCI interpreter for 32-bit guests is officially part of QEMU 10.1.

### Next step
The build requires a Docker environment with glib, pixman, zlib, and libffi pre-compiled for Emscripten. The Dockerfiles from both ktock/qemu-wasm and pebble-qemu-wasm provide this. The most straightforward path is:

1. Use QEMU 10.1's own `tests/docker/dockerfiles/emsdk-wasm32-cross.docker` as the base image
2. Overlay the configure command above
3. Build with `ninja -j$(nproc) qemu-system-i386.js`

---

## Risk Register

| Risk | Severity | Mitigation |
|---|---|---|
| Removing pthreads breaks QEMU | High | Start with TCI mode which is fundamentally single-threaded. Patch glib stubs. |
| WASM binary too large for Workers | Medium | Load from R2 at runtime. Split into main module + data. Use gzip compression. |
| `WebAssembly.compile()` blocked in Workers | High (for JIT) | Use TCI mode only. Test dynamic compilation separately. |
| ASYNCIFY overhead | Medium | ASYNCIFY adds ~30% code size and some performance overhead. Acceptable for TCI. |
| Emscripten FS not available in Workers | Medium | Implement custom FS using DO storage or ArrayBuffer-backed FS. |
| QEMU main loop blocking | High | Must integrate with DO's event-driven model. Use ASYNCIFY yields. |
| Memory limits (128MB WASM default) | Medium | 256MB should be enough for 32MB guest + QEMU overhead. Configurable. |
| GPL v2 license | Low | QEMU is GPL. The WASM binary would be GPL. Our DO wrapper code can stay BSD. |

---

## Timeline Estimate

| Phase | Effort | Description |
|---|---|---|
| Docker build env + TCI build | 1-2 weeks | Get QEMU i386 TCI compiling to WASM |
| Remove pthreads dependency | 1-2 weeks | Patch out threading, test single-threaded |
| Browser test | 1 week | Verify AqeousOS boots in browser WASM |
| DO integration | 2-3 weeks | Replace v86 with QEMU, hook I/O |
| SMP enablement | 1 week | Add `-smp 2` and test |
| **Total** | **6-9 weeks** | |

---

## References

- ktock/qemu-wasm: https://github.com/ktock/qemu-wasm
- container2wasm: https://github.com/container2wasm/container2wasm
- pebble-qemu-wasm: https://github.com/ericmigi/pebble-qemu-wasm
- QEMU TCI WASM upstream patches: https://patchew.org/QEMU/cover.1754534225.git.ktokunaga.mail@gmail.com/
- QEMU TCG WASM JIT patches: https://patchew.org/QEMU/cover.1756216429.git.ktokunaga.mail@gmail.com/
