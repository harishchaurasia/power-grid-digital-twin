import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { HOT_SPOT_CRITICAL_C, HOT_SPOT_WARNING_C } from "@/lib/bands";
import { useConsoleStore } from "@/lib/store";

import { AXIS_STYLE, GRID_STROKE, SERIES, TOOLTIP_STYLE } from "./chartTheme";
import { Panel } from "./Panel";

/**
 * Thermal history. The visible lag between the ambient/load step and the
 * hot-spot response is the C57.91 time constants doing their job -- a curve
 * that jumped instantly would be the tell.
 */
export function TelemetryChart() {
  const history = useConsoleStore((state) => state.history);

  return (
    <Panel title="Thermal history" standard="IEEE C57.91 Clause 7">
      <div className="h-[158px] w-full">
        {history.length < 2 ? (
          <p className="flex h-full items-center justify-center text-[14px] text-text-tertiary">
            Collecting telemetry…
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 4, right: 8, bottom: 4, left: -12 }}>
              <CartesianGrid stroke={GRID_STROKE} strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="simTimeHours"
                type="number"
                domain={["dataMin", "dataMax"]}
                tickFormatter={(v: number) => `${v.toFixed(1)}h`}
                {...AXIS_STYLE}
                tick={AXIS_STYLE}
              />
              <YAxis
                domain={[0, (max: number) => Math.max(140, Math.ceil(max / 20) * 20)]}
                tickCount={5}
                allowDecimals={false}
                tickFormatter={(v: number) => `${v}°`}
                {...AXIS_STYLE}
                tick={AXIS_STYLE}
                width={48}
              />
              <Tooltip
                {...TOOLTIP_STYLE}
                formatter={(value: number, name: string) => [`${value.toFixed(1)} °C`, name]}
                labelFormatter={(v: number) => `sim t+${v.toFixed(2)} h`}
              />
              <Legend
                wrapperStyle={{ fontSize: 12, fontFamily: "var(--font-body)" }}
                iconType="plainline"
              />
              <ReferenceLine
                y={HOT_SPOT_WARNING_C}
                stroke={SERIES.warning}
                strokeDasharray="4 4"
                strokeOpacity={0.6}
              />
              <ReferenceLine
                y={HOT_SPOT_CRITICAL_C}
                stroke={SERIES.limit}
                strokeDasharray="4 4"
                label={{
                  value: `${HOT_SPOT_CRITICAL_C} °C limit`,
                  position: "insideTopRight",
                  fill: SERIES.limit,
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                }}
              />
              <Line
                type="monotone"
                dataKey="hotSpotC"
                name="Hot-spot"
                stroke={SERIES.hotSpot}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="topOilC"
                name="Top-oil"
                stroke={SERIES.topOil}
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="ambientC"
                name="Ambient"
                stroke={SERIES.ambient}
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}
