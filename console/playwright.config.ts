import { defineConfig } from "@playwright/test";

const PORT = 5174; // Not 5173: never fight a dev server the developer is using.
export const BASE_URL = `http://localhost:${PORT}`;

/**
 * Browser-level flows. These exist because every defect this project has shipped
 * was found by looking at a render, not by typechecking -- the recorded/live
 * interleaving and panels spilling past their border both passed every static
 * check.
 *
 * Uses the *installed* Chrome (`channel: "chrome"`) rather than a downloaded
 * Chromium, so `npx playwright install` is not part of setup. The suite starts
 * its own Vite server with **no backend**, which is what makes the fallback
 * paths testable: an unreachable backend is the default here, not a fixture.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // The specs drive one backend process between them.
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: BASE_URL,
    channel: "chrome",
    viewport: { width: 1600, height: 900 },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
