import { Suspense, lazy } from "react";

import { Panel } from "./Panel";

/**
 * Code-split boundary for the Recharts panels.
 *
 * Recharts is ~116 kB gzipped and none of it is needed to render the telemetry
 * *values* — the readings in TransformerPanel are plain text. Splitting the
 * charts lets the numbers paint on the entry chunk, which matters because those
 * numbers are the substance; the charts are the elaboration.
 *
 * Each placeholder keeps its panel's frame and height so the rails do not
 * reflow when a chunk lands (docs/brand.md: no decorative motion, and a layout
 * jump is worse than a still frame).
 */

const TelemetryChart = lazy(() =>
  import("./TelemetryChart").then((m) => ({ default: m.TelemetryChart })),
);
const ProjectionChart = lazy(() =>
  import("./ProjectionChart").then((m) => ({ default: m.ProjectionChart })),
);
const ValidationView = lazy(() =>
  import("./ValidationView").then((m) => ({ default: m.ValidationView })),
);

interface PlaceholderProps {
  title: string;
  standard?: string;
  heightClass: string;
}

function Placeholder({ title, standard, heightClass }: PlaceholderProps) {
  return (
    <Panel title={title} {...(standard ? { standard } : {})}>
      <div className={heightClass} />
    </Panel>
  );
}

export function LazyTelemetryChart() {
  return (
    <Suspense
      fallback={
        <Placeholder title="Thermal history" standard="IEEE C57.91 Clause 7" heightClass="h-[158px]" />
      }
    >
      <TelemetryChart />
    </Suspense>
  );
}

export function LazyProjectionChart() {
  return (
    <Suspense
      fallback={
        <Placeholder title="Projection" standard="IEEE C57.91 + forecast UQ" heightClass="h-[212px]" />
      }
    >
      <ProjectionChart />
    </Suspense>
  );
}

export function LazyValidationView() {
  return (
    <Suspense fallback={<Placeholder title="Validation" standard="V&V + UQ" heightClass="h-[280px]" />}>
      <ValidationView />
    </Suspense>
  );
}
