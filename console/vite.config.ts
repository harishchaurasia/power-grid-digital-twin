import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const BACKEND_ORIGIN = process.env.ARKAFORGE_BACKEND ?? "http://localhost:8000";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Split the two heavy, independent vendor trees so a change to one
        // does not invalidate the other's cache entry for returning visitors.
        manualChunks: {
          three: ["three", "@react-three/fiber", "@react-three/drei"],
          charts: ["recharts"],
        },
      },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  server: {
    port: 5173,
    // Dev-only: lets the console call the backend on its own origin, so the
    // iframe-embedded build needs no CORS or mixed-origin special-casing.
    proxy: {
      "/api": { target: BACKEND_ORIGIN, changeOrigin: true },
      "/ws": { target: BACKEND_ORIGIN, ws: true, changeOrigin: true },
    },
  },
});
