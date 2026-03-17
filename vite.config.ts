import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    cloudflare(),
  ],
  environments: {
    client: {
      build: {
        emptyOutDir: false,
        rollupOptions: {
          input: {
            main: resolve(__dirname, "index.html"),
            session: resolve(__dirname, "session.html"),
          },
        },
      },
    },
  },
});

