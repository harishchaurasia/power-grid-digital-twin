import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { celsius, signed } from "@/lib/format";
import { useConsoleStore } from "@/lib/store";

import { AXIS_STYLE, GRID_STROKE, SERIES, TOOLTIP_STYLE } from "./chartTheme";
import { Caption, Panel } from "./Panel";

/**
 * The V&V view. Verification (integrator vs the closed-form C57.91 solution) and
 * validation (exact Arrhenius aging vs the familiar 6 °C rule) are shown
 * separately, with residuals. The rule of thumb is the approximation here, and
 * where it diverges is shown rather than hidden.
 */
export function ValidationView() {
  const validation = useConsoleStore((state) => state.validation);

  if (!validation) {
    return (
      <Panel title="Validation" standard="V&V + UQ">
        <p className="py-6 text-center text-[14px] text-text-tertiary">Loading V&amp;V report…</p>
      </Panel>
    );
  }

  const design = validation.design_point;

  return (
    <Panel title="Validation" standard="V&V + UQ" className="min-h-[260px]">
      <div className="flex items-baseline justify-between gap-3 pb-2">
        <Caption>Rated design point</Caption>
        <span className="font-mono text-[12px] tabular-nums text-text-secondary">
          K={design.loading_k.toFixed(1)} @ {celsius(design.ambient_c, 0)} →{" "}
          <span className="text-text-primary">{celsius(design.model_hot_spot_c, 2)}</span>
          <span className="text-text-tertiary"> vs {celsius(design.reference_hot_spot_c, 1)}</span>{" "}
          <span className={design.passes ? "text-status-nominal" : "text-forge-red"}>
            {design.passes ? "pass" : "fail"}
          </span>
        </span>
      </div>

      <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
        <Caption>Integrator residual (max)</Caption>
        <span className="font-mono text-[12px] tabular-nums text-text-primary">
          {validation.thermal_max_abs_residual_c.toFixed(3)} °C
          <span className="ml-2 text-text-tertiary">
            over K = {validation.thermal_verification[0]?.loading_k.toFixed(1)}–
            {validation.thermal_verification.at(-1)?.loading_k.toFixed(1)}
          </span>
        </span>
      </div>

      <p className="py-2 text-[12px] leading-snug text-text-tertiary">
        Aging: exact Arrhenius (model) against the {validation.aging_reference}.
      </p>

      <div className="h-[146px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={validation.aging_validation}
            margin={{ top: 4, right: 8, bottom: 4, left: -12 }}
          >
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="hot_spot_c"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) => `${v.toFixed(0)}°`}
              {...AXIS_STYLE}
              tick={AXIS_STYLE}
            />
            <YAxis scale="log" domain={[0.1, "dataMax"]} {...AXIS_STYLE} tick={AXIS_STYLE} width={48} />
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(v: number) => `θ_H = ${v.toFixed(1)} °C`}
              formatter={(value: number, name: string) => [value.toFixed(3), name]}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }}
              iconType="plainline"
            />
            <Line
              type="monotone"
              dataKey="model_faa"
              name="Model (Arrhenius)"
              stroke={SERIES.hotSpot}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="six_degree_rule_faa"
              name="6 °C rule"
              stroke={SERIES.reference}
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex items-baseline justify-between border-t border-border/60 pt-2">
        <Caption>F_AA residual at 140 °C</Caption>
        <span className="font-mono text-[12px] tabular-nums text-text-secondary">
          {signed(validation.aging_validation.at(-1)?.residual ?? 0, 2)} (rule overstates aging)
        </span>
      </div>
    </Panel>
  );
}
