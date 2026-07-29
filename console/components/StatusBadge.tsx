import type { AssetStatus } from "@/lib/types";

/**
 * Operating-band badge. Bands come from the backend's `transformer_status`,
 * which encodes the ranges in docs/domain-transformer.md -- the console does not
 * decide what is critical.
 */
const BAND_STYLE: Record<AssetStatus, string> = {
  nominal: "border-status-nominal/40 text-status-nominal",
  warning: "border-status-warning/40 text-status-warning",
  critical: "border-forge-red text-forge-red",
};

export interface StatusBadgeProps {
  status: AssetStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[12px] font-medium uppercase tracking-[0.05em] ${BAND_STYLE[status]}`}
    >
      {status}
    </span>
  );
}
