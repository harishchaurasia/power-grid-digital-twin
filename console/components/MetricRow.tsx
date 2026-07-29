import type { ReactNode } from "react";

import type { AssetStatus } from "@/lib/types";

/**
 * One labelled telemetry reading. `value` is pre-formatted with its unit by
 * lib/format -- a unitless number must never reach this component.
 */
const VALUE_TONE: Record<AssetStatus, string> = {
  nominal: "text-text-primary",
  warning: "text-status-warning",
  critical: "text-forge-red",
};

export interface MetricRowProps {
  label: string;
  value: string;
  /** Band for this individual reading, when it has one of its own. */
  tone?: AssetStatus;
  /** Where the number comes from, e.g. the governing equation. */
  hint?: string;
  trailing?: ReactNode;
}

export function MetricRow({ label, value, tone = "nominal", hint, trailing }: MetricRowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-2 last:border-b-0">
      <span className="text-[14px] text-text-secondary" title={hint}>
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span className={`font-mono text-[14px] font-medium tabular-nums ${VALUE_TONE[tone]}`}>
          {value}
        </span>
        {trailing}
      </span>
    </div>
  );
}
