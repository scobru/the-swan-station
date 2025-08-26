import { defineConfig } from "vite";

export default defineConfig({
  plugins: [],
  root: ".",
  publicDir: "assets",
  server: {
    port: 3001,
    host: true,
    open: true,
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: true,
  },
});
