/**
 * Display formatting. Every telemetry value carries its unit
 * (docs/credibility-checklist.md) -- a bare number is a defect here.
 */

const EM_DASH = "—";

export function celsius(value: number, digits = 1): string {
  return `${value.toFixed(digits)} °C`;
}

export function mva(value: number, digits = 1): string {
  return `${value.toFixed(digits)} MVA`;
}

export function ratio(value: number, digits = 2): string {
  return value.toFixed(digits);
}

export function hours(value: number, digits = 1): string {
  return `${value.toFixed(digits)} h`;
}

/** Loss-of-life reads better in days once it passes a day. */
export function lossOfLife(hoursConsumed: number): string {
  if (hoursConsumed >= 48) {
    return `${(hoursConsumed / 24).toFixed(1)} d`;
  }
  return `${hoursConsumed.toFixed(1)} h`;
}

/**
 * A projected window, always as a range. A missing bound means that corner of
 * the forecast never reached the limit inside the horizon -- say so rather than
 * inventing a number. An already-breached limit reports the breach, never a
 * collapsed interval.
 */
export function confidenceWindow(
  window: {
    expected_hours: number | null;
    ci95_low_hours: number | null;
    ci95_high_hours: number | null;
    already_breached: boolean;
  },
  horizonHours: number,
): string {
  if (window.already_breached) {
    return "exceeded now";
  }
  if (window.expected_hours === null) {
    return `none within ${hours(horizonHours, 0)}`;
  }
  const lowLabel = window.ci95_low_hours === null ? EM_DASH : hours(window.ci95_low_hours);
  const highLabel =
    window.ci95_high_hours === null ? `>${hours(horizonHours, 0)}` : hours(window.ci95_high_hours);
  return `${hours(window.expected_hours)}  (95% CI ${lowLabel} – ${highLabel})`;
}

export function signed(value: number, digits = 3): string {
  const fixed = value.toFixed(digits);
  return value > 0 ? `+${fixed}` : fixed;
}
