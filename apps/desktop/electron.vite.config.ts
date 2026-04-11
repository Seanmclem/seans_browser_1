import { resolve } from "node:path";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: ["@seans-browser/browser-core"] })],
    build: {
      outDir: "dist/main",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/index.ts"),
          "wv-lab": resolve(__dirname, "src/wv-lab/main.ts")
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin({ exclude: ["@seans-browser/browser-core"] })],
    build: {
      outDir: "dist/preload",
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/main/preload.ts")
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [react()],
    server: {
      port: 5179,
      strictPort: true
    },
    resolve: {
      alias: {
        "@renderer": resolve(__dirname, "src/renderer"),
        "@shared": resolve(__dirname, "src/shared")
      }
    },
    build: {
      outDir: resolve(__dirname, "dist/renderer")
    }
  }
});
