import { describe, expect, it } from "vitest";

import { celsius, confidenceWindow, hours, lossOfLife, mva, ratio, signed } from "@/lib/format";

/**
 * These hold two rules from docs/credibility-checklist.md that are easy to
 * regress and expensive to ship: every measurement carries its unit, and a
 * projected window is never reported as a fake-precise point.
 */

describe("units on every measurement", () => {
  it("labels temperature, power and time", () => {
    expect(celsius(96.54)).toBe("96.5 °C");
    expect(mva(135)).toBe("135.0 MVA");
    expect(hours(1.24)).toBe("1.2 h");
  });

  it("leaves loading ratio unitless -- K is dimensionless", () => {
    expect(ratio(0.9012)).toBe("0.90");
  });

  it("switches loss-of-life to days past 48 h so the number stays readable", () => {
    expect(lossOfLife(47.9)).toBe("47.9 h");
    expect(lossOfLife(48)).toBe("2.0 d");
    expect(lossOfLife(240)).toBe("10.0 d");
  });

  it("signs deltas so a residual's direction is visible", () => {
    expect(signed(0.03)).toBe("+0.030");
    expect(signed(-0.03)).toBe("-0.030");
    expect(signed(0)).toBe("0.000");
  });
});

describe("confidenceWindow", () => {
  const base = {
    expected_hours: 2.1,
    ci95_low_hours: 1.9,
    ci95_high_hours: 2.3,
    already_breached: false,
  };

  it("reports a range with its confidence level, never a bare point", () => {
    const text = confidenceWindow(base, 6);
    expect(text).toBe("2.1 h  (95% CI 1.9 h – 2.3 h)");
    expect(text).toContain("95% CI");
  });

  it("reports an already-breached limit as breached, not as a collapsed interval", () => {
    // The defect this guards: a breached limit once rendered as
    // "0.1 h (95% CI 0.1 - 0.1)", which reads as fake precision.
    const text = confidenceWindow({ ...base, already_breached: true }, 6);
    expect(text).toBe("exceeded now");
    expect(text).not.toContain("CI");
  });

  it("says the limit is not reached rather than inventing a time", () => {
    expect(confidenceWindow({ ...base, expected_hours: null }, 6)).toBe("none within 6 h");
  });

  it("marks an open upper bound with the horizon instead of a made-up number", () => {
    expect(confidenceWindow({ ...base, ci95_high_hours: null }, 6)).toBe(
      "2.1 h  (95% CI 1.9 h – >6 h)",
    );
  });

  it("marks an open lower bound with an em dash", () => {
    expect(confidenceWindow({ ...base, ci95_low_hours: null }, 6)).toBe(
      "2.1 h  (95% CI — – 2.3 h)",
    );
  });
});
