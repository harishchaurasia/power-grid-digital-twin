/**
 * Locators for the operator console.
 *
 * Deliberately queried by visible text and role rather than test ids: if a
 * locator here stops matching, the thing an operator reads has changed, which
 * is itself worth failing over.
 */

import type { Locator, Page } from "@playwright/test";

/** The connection chip is CSS-uppercased, so every matcher here is case-insensitive. */
export function connectionChip(page: Page): Locator {
  return page
    .locator("header")
    .getByText(/^(live|recorded|connecting|reconnecting|disconnected)$/i);
}

export function hotSpotRow(page: Page): Locator {
  return page.getByText("Hot-spot temperature").locator("xpath=..");
}

export async function hotSpotC(page: Page): Promise<number | null> {
  const text = await hotSpotRow(page).innerText();
  const match = /(-?\d+\.\d+)/.exec(text);
  return match?.[1] === undefined ? null : Number(match[1]);
}

export function triggerButton(page: Page): Locator {
  return page.getByRole("button", { name: /Trigger heat wave/ });
}

/** Vertex count of the thermal-history curve: a proxy for timeline length. */
export async function historyVertices(page: Page): Promise<number> {
  const d = await page
    .locator("svg.recharts-surface path.recharts-curve")
    .first()
    .getAttribute("d");
  // Recharts draws monotone curves as cubic Beziers, so vertices are `C`, not `L`.
  return d === null ? 0 : (d.match(/[CL]/g) ?? []).length;
}

/**
 * Any element whose box escapes its panel's border. Panels are opaque surfaces,
 * so content that overflows draws on top of the panel below instead of being
 * clipped -- silent until someone looks at a render.
 */
export async function panelOverflows(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const problems: string[] = [];
    document.querySelectorAll("section").forEach((section) => {
      const box = section.getBoundingClientRect();
      section.querySelectorAll("*").forEach((child) => {
        const childBox = child.getBoundingClientRect();
        if (childBox.height === 0 || childBox.width === 0) return;
        const spill = Math.max(childBox.bottom - box.bottom, childBox.right - box.right);
        if (spill > 1) {
          const label = (child.textContent ?? "").trim().slice(0, 40);
          problems.push(`${child.tagName} "${label}" spills ${spill.toFixed(0)}px`);
        }
      });
    });
    return problems;
  });
}
