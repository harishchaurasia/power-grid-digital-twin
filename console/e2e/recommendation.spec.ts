import { expect, test } from "@playwright/test";

import { connectionChip } from "./console-page";

/**
 * The card sits over the twin in the centre column, so collapsing it has one
 * user-visible job: give the asset back to the camera. Asserted by hit-testing
 * the exact point the expanded card occupied.
 */

const FINAL = "OBSERVATION\nHot-spot 134.4 °C.\n\nRECOMMENDATION\nEngage OFAF.";

/** Replays the agent messages the WebSocket would send, via the DEV store handle. */
async function seedRecommendation(page: import("@playwright/test").Page): Promise<void> {
  // `__arkaforgeStore` is attached only in a Vite dev build (`import.meta.env.DEV`
  // in app/main.tsx); a production/preview build never defines it. Without this
  // short timeout + explicit message, that case hangs for the suite's full
  // 20s expect timeout and reports a generic "timeout waiting for function",
  // which does not point at the real cause.
  await page.waitForFunction(() => "__arkaforgeStore" in window, undefined, { timeout: 5_000 }).catch(() => {
    throw new Error(
      "window.__arkaforgeStore was never defined. This spec seeds the agent " +
        "recommendation through that DEV-only handle (app/main.tsx) and cannot " +
        "run against a production/preview build -- run it against `npm run dev`.",
    );
  });
  await page.evaluate((final) => {
    const store = (
      window as unknown as {
        __arkaforgeStore: { getState: () => { applyServerMessage: (m: unknown) => void } };
      }
    ).__arkaforgeStore.getState();
    const send = (message: unknown) => store.applyServerMessage(message);

    send({ type: "agent_started", provider: "anthropic", model: "claude-sonnet-5", local: false });
    send({ type: "tool_call", call_id: "c1", tool: "simulate_forward", input: {} });
    send({
      type: "tool_result",
      call_id: "c1",
      tool: "simulate_forward",
      output: {
        plan: { cooling_stage: "OFAF", load_action: "serve_full" },
        peak_hot_spot_c: 103.0,
        breaches_120c: false,
        hours_above_120c: 0,
        economics: {
          equivalent_life_consumed_hours: 4.1,
          net_value_usd: 508_680,
          transformer_life_cost_usd: 2_700,
          curtailment_cost_usd: 0,
          failure_risk_cost_usd: 900,
        },
      },
    });
    send({ type: "agent_final", text: final });
    send({ type: "agent_done", timestamp: 0 });
  }, FINAL);
}

test("collapsing the recommendation gives the twin back to the camera", async ({ page }) => {
  await page.goto("/?mode=recorded");
  await expect(connectionChip(page)).toHaveText(/recorded/i);

  // TwinSceneLazy code-splits the 3D layer (RESEARCH-LOG.md §8), so the
  // <canvas> mounts a beat after first paint. Without this wait, the first
  // hit-test below can land on the not-yet-replaced DIV underneath and pass
  // vacuously -- proving nothing about the canvas it claims to check for.
  await page.locator("canvas").waitFor({ state: "attached" });

  await seedRecommendation(page);

  const card = page.getByRole("heading", { name: "Recommendation" }).locator("xpath=../../..");
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  expect(box).not.toBeNull();
  const point = {
    x: Math.round((box?.x ?? 0) + (box?.width ?? 0) / 2),
    y: Math.round((box?.y ?? 0) + (box?.height ?? 0) / 2),
  };

  const tagAt = (p: { x: number; y: number }) =>
    page.evaluate((q) => document.elementFromPoint(q.x, q.y)?.tagName ?? "", p);

  // Expanded, that point belongs to the card.
  expect(await tagAt(point)).not.toBe("CANVAS");

  await page.getByRole("button", { name: "Minimize recommendation" }).click();
  await expect(page.getByRole("button", { name: /expand recommendation/i })).toBeVisible();

  // Collapsed, the same point reaches the twin.
  expect(await tagAt(point)).toBe("CANVAS");
});

test("the collapsed bar still carries the recommended plan", async ({ page }) => {
  await page.goto("/?mode=recorded");
  await expect(connectionChip(page)).toHaveText(/recorded/i);
  await seedRecommendation(page);

  await page.getByRole("button", { name: "Minimize recommendation" }).click();

  const bar = page.getByRole("button", { name: /expand recommendation/i });
  await expect(bar).toContainText("OFAF");
  await expect(bar).toContainText("$509k");
});
