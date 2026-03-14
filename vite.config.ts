import { defineConfig, type Plugin } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "path";

/**
 * Vite plugin to inject COOP/COEP headers for SharedArrayBuffer support.
 * Required by Emscripten pthreads (QEMU-WASM build uses -pthread -sPROXY_TO_PTHREAD).
 */
function coopCoepHeaders(): Plugin {
  return {
    name: "coop-coep-headers",
    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [
    coopCoepHeaders(),
    cloudflare(),
  ],
  environments: {
    client: {
      build: {
        rollupOptions: {
          input: {
            main: resolve(__dirname, "index.html"),
            session: resolve(__dirname, "session.html"),
            qemu: resolve(__dirname, "qemu.html"),
          },
        },
      },
    },
  },
});
