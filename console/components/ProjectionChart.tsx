import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { confidenceWindow } from "@/lib/format";
import { useConsoleStore } from "@/lib/store";

import { AXIS_STYLE, GRID_STROKE, SERIES, TOOLTIP_STYLE } from "./chartTheme";
import { Caption, Panel } from "./Panel";

interface BandPoint {
  leadHours: number;
  expectedC: number;
  band: [number, number];
}

/**
 * Recharts cannot infer dataMin/dataMax from a tuple-valued dataKey, so the
 * band's own extent is computed here. Rounded to 5 °C so ticks land on
 * readable values instead of arbitrary decimals.
 */
function axisDomain(projection: {
  ci95_low_c: number[];
  ci95_high_c: number[];
  limit_c: number;
}): [number, number] {
  const low = Math.min(...projection.ci95_low_c);
  const high = Math.max(...projection.ci95_high_c, projection.limit_c);
  return [Math.floor((low - 4) / 5) * 5, Math.ceil((high + 4) / 5) * 5];
}

/**
 * Forward hot-spot projection with its 95% band. The band is forecast
 * uncertainty propagated through C57.91 by the Python core -- it widens with
 * lead time because present conditions are known and forecasts are not.
 */
export function ProjectionChart() {
  const projection = useConsoleStore((state) => state.projection);

  const data = useMemo<BandPoint[]>(() => {
    if (!projection) return [];
    return projection.time_hours.map((leadHours, index) => ({
      leadHours,
      expectedC: projection.expected_c[index] ?? 0,
      band: [projection.ci95_low_c[index] ?? 0, projection.ci95_high_c[index] ?? 0],
    }));
  }, [projection]);

  if (!projection || data.length === 0) {
    return (
      <Panel title="Projection" standard="IEEE C57.91 + forecast UQ" className="min-h-[260px]">
        <p className="flex h-[210px] items-center justify-center text-[14px] text-text-tertiary">
          Computing projection…
        </p>
      </Panel>
    );
  }

  const window = projection.time_to_limit;

  return (
    <Panel
      title="Projection"
      standard={`${projection.model_standard} + forecast UQ`}
      className="min-h-[240px]"
    >
      <div className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
            <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="leadHours"
              type="number"
              domain={[0, projection.horizon_hours]}
              tickFormatter={(v: number) => `+${v.toFixed(0)}h`}
              {...AXIS_STYLE}
              tick={AXIS_STYLE}
            />
            <YAxis
              domain={axisDomain(projection)}
              tickCount={5}
              allowDecimals={false}
              tickFormatter={(v: number) => `${v}°`}
              {...AXIS_STYLE}
              tick={AXIS_STYLE}
              width={48}
            />
            <Tooltip
              {...TOOLTIP_STYLE}
              labelFormatter={(v: number) => `lead +${v.toFixed(2)} h`}
              formatter={(value: number | [number, number], name: string) =>
                Array.isArray(value)
                  ? [`${value[0].toFixed(1)} – ${value[1].toFixed(1)} °C`, "95% CI"]
                  : [`${value.toFixed(1)} °C`, name]
              }
            />
            <ReferenceLine
              y={projection.limit_c}
              stroke={SERIES.limit}
              strokeDasharray="4 4"
              label={{
                value: `${projection.limit_c} °C`,
                position: "insideTopRight",
                fill: SERIES.limit,
                fontSize: 11,
                fontFamily: "var(--font-mono)",
              }}
            />
            <Area
              dataKey="band"
              name="95% CI"
              stroke="none"
              fill={SERIES.hotSpot}
              fillOpacity={0.14}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="expectedC"
              name="Expected"
              stroke={SERIES.hotSpot}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 border-t border-border/60 pt-2">
        {/* flex-wrap + nowrap on both items: label and window don't fit side by
            side in a 340px rail, so the window drops to its own line whole
            rather than breaking mid-value ("... – 2.3" / "h)"). */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <Caption className="whitespace-nowrap">Time to {projection.limit_c} °C</Caption>
          <span
            className={`whitespace-nowrap font-mono text-[14px] font-medium tabular-nums ${
              window.already_breached ? "text-forge-red" : "text-text-primary"
            }`}
          >
            {confidenceWindow(window, projection.horizon_hours)}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-snug text-text-tertiary">
          Band: {projection.uncertainty_basis}.
        </p>
      </div>
    </Panel>
  );
}
