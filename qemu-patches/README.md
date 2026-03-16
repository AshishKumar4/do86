# QEMU Emscripten/Durable Object Patches

These patches and source files target **QEMU 8.2.7** for building with Emscripten
to produce WASM binaries suitable for running inside Cloudflare Durable Objects.

## Files

| File | Description |
|------|-------------|
| `emscripten-do.patch` | `git diff HEAD` from the patched QEMU 8.2.7 tree. Apply with `git apply` on top of the v8.2.7 tag. |
| `coroutine-emscripten.c` | Synchronous coroutine backend for Emscripten. Replaces fibers/ucontext with an inline call model — no `emscripten_fiber_swap` required. Drop into `util/`. |
| `emscripten-stubs.c` | POSIX/Linux stubs needed to satisfy QEMU's build system under Emscripten (missing syscalls, threading primitives, etc.). Drop into `util/`. |
| `tq.js` | Minimal Node.js test runner: loads `qemu-system-i386.js`, mounts the BIOS, and calls `main`. Useful for smoke-testing a fresh WASM build. |
| `tq-diag.js` | Diagnostic variant of `tq.js` — instruments `WebAssembly.instantiate`, logs `runDependencies`, and gives per-step timing. |

## Applying the Patch

```bash
git clone https://gitlab.com/qemu-project/qemu.git
cd qemu
git checkout v8.2.7
git apply /path/to/emscripten-do.patch
cp /path/to/coroutine-emscripten.c util/
cp /path/to/emscripten-stubs.c util/
```

## Build (Emscripten / Asyncify)

The patch configures a `build-wasm/` directory. The key configure flags are:

- `--cross-prefix=` (Emscripten toolchain via `emcmake`)
- `--target-list=i386-softmmu`
- Asyncify enabled for async I/O integration with the Durable Object event loop

See `do-linux-path2` root `README.md` for the full build walkthrough.

## Notes

- The coroutine backend avoids Asyncify stack-unwinding on every coroutine switch
  by running each coroutine inline; this is safe because Durable Objects perform
  no real disk I/O.
- `emscripten-stubs.c` provides no-op or minimal implementations only; do not
  link against it for native builds.
- Test scripts (`tq.js`, `tq-diag.js`) reference absolute `/workspace/` paths and
  should be edited for your local environment before use.
