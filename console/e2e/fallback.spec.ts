import type { ChildProcess } from "node:child_process";

import { expect, test } from "@playwright/test";

import { backendRunnable, startBackend, stopBackend } from "./backend";
import {
  connectionChip,
  historyVertices,
  hotSpotC,
  panelOverflows,
  triggerButton,
} from "./console-page";

/**
 * docs/architecture.md: the demo must never hard-fail in front of a prospect.
 * These drive the two fallback entry points and the recovery path in a real
 * browser. No backend runs unless a test starts one, so "backend unreachable"
 * is the ambient condition rather than something mocked.
 */

test.describe("recorded playback", () => {
  test("?mode=recorded plays the capture without touching the backend", async ({ page }) => {
    const apiCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/api/")) apiCalls.push(request.url());
    });

    await page.goto("/?mode=recorded");

    await expect(connectionChip(page)).toHaveText(/recorded/i);
    // The recording opens with a short nominal beat, then climbs. Poll rather
    // than sleeping a fixed interval.
    await expect.poll(() => hotSpotC(page), { timeout: 30_000 }).toBeGreaterThan(97);
    expect(apiCalls, "recorded mode must not poll a backend it is standing in for").toEqual([]);
  });

  test("disables scenario controls it cannot honour", async ({ page }) => {
    await page.goto("/?mode=recorded");
    await expect(connectionChip(page)).toHaveText(/recorded/i);
    // Nothing may look clickable when there is no backend to act on the intent.
    await expect(triggerButton(page)).toBeDisabled();
  });

  test("shows the captured V&V report, not an empty panel", async ({ page }) => {
    await page.goto("/?mode=recorded");
    await expect(page.getByText(/rated\s+design\s+point/i)).toBeVisible();
    await expect(page.getByText(/109\.98/)).toBeVisible();
  });
});

test.describe("automatic fallback", () => {
  test("falls back to playback when the backend never answers", async ({ page }) => {
    await page.goto("/");
    // Three failed attempts with backoff, then playback takes over.
    await expect(connectionChip(page)).toHaveText(/recorded/i, { timeout: 30_000 });
    await expect.poll(() => hotSpotC(page), { timeout: 30_000 }).toBeGreaterThan(97);
  });
});

test.describe("handover back to live", () => {
  let backend: ChildProcess | null = null;

  test.afterEach(async () => {
    await stopBackend(backend);
    backend = null;
  });

  test("live takes over from playback with a single timeline", async ({ page }) => {
    test.skip(!(await backendRunnable()), "uv/Python toolchain not available");

    await page.goto("/");
    await expect(connectionChip(page)).toHaveText(/recorded/i, { timeout: 30_000 });
    // Let playback build history, so a failure to clear it would be visible.
    await expect.poll(() => historyVertices(page), { timeout: 30_000 }).toBeGreaterThan(20);
    const recordedVertices = await historyVertices(page);

    backend = await startBackend();

    await expect(connectionChip(page)).toHaveText(/live/i, { timeout: 40_000 });
    await expect(triggerButton(page)).toBeEnabled();

    // Recorded history must be dropped, not presented as live.
    await expect
      .poll(() => historyVertices(page), { timeout: 20_000 })
      .toBeLessThan(recordedVertices);

    // The defect this guards: if the player kept ticking, recorded frames would
    // interleave with live ones and hot-spot would swing. A live twin at its
    // baseline is near-constant.
    const samples: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const value = await hotSpotC(page);
      if (value !== null) samples.push(value);
      await page.waitForTimeout(400);
    }
    const spread = Math.max(...samples) - Math.min(...samples);
    expect(spread, `hot-spot swung ${spread.toFixed(1)} C after handover: ${samples.join(", ")}`)
      .toBeLessThan(5);
  });
});

test.describe("layout", () => {
  // Guards a defect that shipped: panels are opaque, so content escaping one
  // draws over the panel below. Every static check passed while it was broken.
  for (const height of [900, 800]) {
    test(`panels contain their content at ${height}px viewport`, async ({ page }) => {
      await page.setViewportSize({ width: 1600, height });
      await page.goto("/?mode=recorded");
      await expect(connectionChip(page)).toHaveText(/recorded/i);
      await expect(page.getByText(/^Band:/)).toBeVisible();

      expect(await panelOverflows(page)).toEqual([]);
    });
  }

  test("the projected window reads as one unbroken range", async ({ page }) => {
    await page.goto("/?mode=recorded");
    const window = page.getByText(/95% CI/);
    await expect(window).toBeVisible();
    // It must not wrap mid-value, leaving a bare "h)" on its own line.
    const box = await window.boundingBox();
    expect(box).not.toBeNull();
    expect(box?.height ?? 0, "projected window wrapped onto two lines").toBeLessThan(28);
  });
});
