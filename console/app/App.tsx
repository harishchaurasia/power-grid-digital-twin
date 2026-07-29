import { AgentPanel } from "@/components/AgentPanel";
import {
  LazyProjectionChart,
  LazyTelemetryChart,
  LazyValidationView,
} from "@/components/LazyPanels";
import { ModelAttribution } from "@/components/ModelAttribution";
import { RecommendationCard } from "@/components/RecommendationCard";
import { ConnectionIndicator } from "@/components/ConnectionIndicator";
import { ScenarioControls } from "@/components/ScenarioControls";
import { TransformerPanel } from "@/components/TransformerPanel";
import { TwinSceneLazy } from "@/components/scene/TwinSceneLazy";
import { useHeroModelAvailable } from "@/lib/heroModel";
import { useConsoleStore } from "@/lib/store";

import { useTwinConnection } from "./useTwinConnection";

/**
 * Operator console.
 *
 * Two layers: the 3D twin fills the viewport, and the data/agent UI composites
 * on top as side rails so the asset itself stays visible. The centre column is
 * deliberately empty and click-through, so dragging there orbits the camera.
 *
 * When Pixel Streaming lands, the <TwinScene> layer is replaced by the streamed
 * video element and nothing in the overlay has to change
 * (docs/architecture.md). Nothing here reads `window.parent` or `window.top`.
 */
export function App() {
  const send = useTwinConnection();
  const lastError = useConsoleStore((state) => state.lastError);
  const heroAvailable = useHeroModelAvailable();

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-0">
        <TwinSceneLazy />
      </div>

      <div className="pointer-events-none absolute inset-0 flex flex-col gap-3 p-4">
        <header className="pointer-events-auto flex flex-wrap items-baseline justify-between gap-3 rounded border border-border bg-surface-1/95 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-baseline gap-3">
            <h1 className="font-display text-[28px] tracking-[0.03em] text-text-primary">
              Substation node
            </h1>
            <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
              ISO 23247 synchronised twin
            </span>
          </div>
          <ConnectionIndicator />
        </header>

        {lastError ? (
          <p
            role="alert"
            className="pointer-events-auto rounded border border-forge-red bg-surface-1/95 px-4 py-2 text-[14px] text-forge-red backdrop-blur-sm"
          >
            {lastError}
          </p>
        ) : null}

        <main className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[340px_minmax(0,1fr)_340px]">
          <div className="pointer-events-auto flex min-h-0 flex-col gap-3 overflow-y-auto pr-1">
            <TransformerPanel />
            <LazyTelemetryChart />
          </div>

          {/* Centre column stays click-through for the camera, except where the
              recommendation appears — the conclusion the demo builds to belongs
              here, not at the bottom of a rail. */}
          <div className="pointer-events-none hidden min-h-0 flex-col justify-end lg:flex">
            <RecommendationCard send={send} />
          </div>

          <div className="pointer-events-auto flex min-h-0 flex-col gap-3 overflow-y-auto pl-1">
            <LazyProjectionChart />
            <LazyValidationView />
            <AgentPanel send={send} />
          </div>
        </main>

        <ScenarioControls send={send} />

        <footer className="flex items-center justify-between gap-3">
          <span className="flex flex-col gap-0.5 text-[12px] text-text-tertiary">
            Drag to orbit · scroll to zoom
            <ModelAttribution visible={heroAvailable === true} />
          </span>
          <span className="font-display text-[18px] uppercase tracking-[0.05em] text-text-secondary">
            Train in simulation. Operate in reality.
          </span>
          <span className="w-[220px]" aria-hidden="true" />
        </footer>
      </div>
    </div>
  );
}
