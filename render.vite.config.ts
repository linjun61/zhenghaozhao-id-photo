import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  publicDir: "public",
  build: {
    outDir: "render-dist",
    emptyOutDir: true,
    rollupOptions: { input: resolve(process.cwd(), "index.html") },
  },
});
