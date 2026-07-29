import { useConsoleStore } from "@/lib/store";
import type { ClientMessage, CoolingStage, InterventionId } from "@/lib/types";

const COOLING_INTERVENTIONS: ReadonlyArray<{ stage: CoolingStage; id: InterventionId }> = [
  { stage: "ONAF", id: "cooling_onaf" },
  { stage: "OFAF", id: "cooling_ofaf" },
];

export interface ScenarioControlsProps {
  send: (message: ClientMessage) => void;
}

/**
 * Scenario + intervention bar. These close the bidirectional loop the
 * credibility checklist requires: an intervention changes real twin state in
 * the Python core, it is not a display toggle.
 *
 * Laid out horizontally along the bottom so the side rails stay for data and
 * the twin itself keeps the centre of the view.
 */
export function ScenarioControls({ send }: ScenarioControlsProps) {
  const snapshot = useConsoleStore((state) => state.snapshot);
  const connection = useConsoleStore((state) => state.connection);
  const clearTimeline = useConsoleStore((state) => state.clearTimeline);
  const online = connection === "open";
  const activeStage = snapshot?.transformer.cooling_stage;

  const reset = () => {
    send({ type: "trigger_scenario", scenario: "reset" });
    clearTimeline();
  };

  return (
    <div className="pointer-events-auto flex flex-wrap items-center gap-2 rounded border border-border bg-surface-1/95 px-3 py-2 backdrop-blur-sm">
      <button
        type="button"
        onClick={() => send({ type: "trigger_scenario", scenario: "heatwave_load_spike" })}
        disabled={!online}
        className="transition-brand rounded border border-forge-red bg-forge-red px-3 py-1.5 text-[14px] text-void-black hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Trigger heat wave + load spike
      </button>
      <button
        type="button"
        onClick={reset}
        disabled={!online}
        className="transition-brand rounded border border-border bg-surface-2 px-3 py-1.5 text-[14px] text-text-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
      >
        Reset
      </button>

      <span className="mx-1 h-5 w-px bg-border" aria-hidden="true" />

      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-text-tertiary">
        Cooling
      </span>
      {COOLING_INTERVENTIONS.map(({ stage, id }) => {
        const active = activeStage === stage;
        return (
          <button
            key={id}
            type="button"
            onClick={() => send({ type: "apply_intervention", intervention: id })}
            disabled={!online || active}
            className={`transition-brand rounded border px-3 py-1.5 font-mono text-[14px] disabled:cursor-not-allowed ${
              active
                ? "border-text-secondary bg-surface-2 text-text-primary"
                : "border-border bg-surface-2 text-text-secondary hover:text-text-primary disabled:opacity-40"
            }`}
          >
            {stage}
          </button>
        );
      })}

      <span className="ml-auto max-w-[380px] text-right text-[12px] leading-snug text-text-tertiary">
        Engaging a stage raises rated MVA, so K and hot-spot fall for the same load — at an
        auxiliary-power and fan/pump wear cost.
      </span>
    </div>
  );
}
