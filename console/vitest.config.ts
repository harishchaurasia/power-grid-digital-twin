import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/**
 * Unit/component layer. The browser-level flows live in `e2e/` under Playwright
 * (`npm run test:e2e`) and are excluded here -- jsdom has no WebGL and no real
 * WebSocket, so the 3D scene and the live/recorded handover cannot be proven in
 * this runner. Don't add them here; that is what the e2e suite is for.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["{lib,components,app}/**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", "dist/**"],
  },
});
