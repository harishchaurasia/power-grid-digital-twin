import { agingTone, hotSpotTone, loadingTone, topOilTone } from "@/lib/bands";
import { celsius, lossOfLife, mva, ratio } from "@/lib/format";
import { useConsoleStore } from "@/lib/store";

import { MetricRow } from "./MetricRow";
import { Caption, Panel } from "./Panel";
import { StatusBadge } from "./StatusBadge";

/**
 * Live transformer telemetry. Every row traces to the IEEE C57.91 model in
 * `backend/sim/transformer.py`; the hints name the governing equation so an
 * engineer can check the number.
 */
export function TransformerPanel() {
  const snapshot = useConsoleStore((state) => state.snapshot);

  if (!snapshot) {
    return (
      <Panel title="Transformer" standard="IEEE C57.91">
        <p className="py-6 text-center text-[14px] text-text-tertiary">Awaiting twin state…</p>
      </Panel>
    );
  }

  const t = snapshot.transformer;

  return (
    <Panel
      title="Transformer"
      standard={t.model_standard}
      actions={<StatusBadge status={t.status} />}
    >
      <MetricRow
        label="Hot-spot temperature"
        value={celsius(t.hot_spot_c)}
        tone={hotSpotTone(t.hot_spot_c)}
        hint="θ_H = θ_TO + Δθ_H — derived state with winding time constant τ_W ≈ 7 min"
      />
      <MetricRow
        label="Top-oil temperature"
        value={celsius(t.top_oil_c)}
        tone={topOilTone(t.top_oil_c)}
        hint="First-order lag toward Δθ_TO,ult with oil time constant τ_TO"
      />
      <MetricRow
        label="Loading ratio K"
        value={ratio(t.loading_k)}
        tone={loadingTone(t.loading_k)}
        hint="K = load MVA / rated MVA at the active cooling stage"
      />
      <MetricRow
        label="Node load"
        value={mva(t.node_load_mva)}
        hint="Data-centre load served through this node"
      />
      <MetricRow
        label="Aging factor F_AA"
        value={ratio(t.aging_factor_faa)}
        tone={agingTone(t.aging_factor_faa)}
        hint="F_AA = exp(15000/383 − 15000/(θ_H+273)) — C57.91 Annex A"
      />
      <MetricRow
        label="Life consumed"
        value={lossOfLife(t.cumulative_loss_of_life_hours)}
        hint="Σ F_AA · Δt — equivalent insulation life, not wall-clock time"
      />
      <MetricRow
        label="Cooling stage"
        value={t.cooling_stage}
        hint="ONAN 150 MVA / ONAF 200 MVA / OFAF 250 MVA"
      />
      <MetricRow label="Ambient" value={celsius(snapshot.ambient.air_temp_c)} />

      <div className="mt-3 flex items-baseline justify-between">
        <Caption>Twinning rate</Caption>
        <span className="font-mono text-[11px] text-text-tertiary">
          {snapshot.twinning_rate_hz.toFixed(0)} Hz · sim t+
          {snapshot.sim_time_hours.toFixed(2)} h
        </span>
      </div>
    </Panel>
  );
}
