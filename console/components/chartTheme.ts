/**
 * Shared Recharts styling so every chart reads as one system and stays inside
 * the brand palette (docs/brand.md). Forge Red is reserved for limits and
 * critical state -- never for an ordinary series.
 */

export const AXIS_STYLE = {
  stroke: "var(--text-tertiary)",
  fontSize: 11,
  fontFamily: "var(--font-mono)",
} as const;

export const GRID_STROKE = "var(--border)";

export const TOOLTIP_STYLE = {
  contentStyle: {
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 4,
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--text-primary)",
  },
  labelStyle: { color: "var(--text-tertiary)" },
  itemStyle: { color: "var(--text-primary)" },
} as const;

export const SERIES = {
  hotSpot: "var(--text-primary)",
  topOil: "var(--text-secondary)",
  ambient: "var(--text-tertiary)",
  limit: "var(--forge-red)",
  warning: "var(--status-warning)",
  reference: "var(--status-nominal)",
} as const;
