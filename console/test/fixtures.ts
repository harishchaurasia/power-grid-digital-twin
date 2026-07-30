/**
 * Test fixtures shaped like the real wire contract.
 *
 * Values are taken from actual backend output (a nominal ONAN baseline), not
 * invented, so a test that passes here is a test about behaviour the real
 * physics can produce. Overrides let a test say only what it cares about.
 */

import type { HotSpotProjection, TwinSnapshot, ValidationReport } from "@/lib/types";

export function snapshot(overrides: {
  simTimeHours?: number;
  hotSpotC?: number;
  status?: TwinSnapshot["transformer"]["status"];
  coolingStage?: TwinSnapshot["transformer"]["cooling_stage"];
} = {}): TwinSnapshot {
  const hotSpotC = overrides.hotSpotC ?? 96.5;
  return {
    sim_time_hours: overrides.simTimeHours ?? 0.02,
    timestamp_ms: 1_753_000_000_000,
    twinning_rate_hz: 10,
    ambient: { air_temp_c: 28.0, wind_ms: 1.2, solar_wm2: 780 },
    transformer: {
      node_load_mva: 135.0,
      loading_k: 0.9,
      top_oil_c: 75.4,
      hot_spot_c: hotSpotC,
      aging_factor_faa: 0.24,
      cooling_stage: overrides.coolingStage ?? "ONAN",
      cumulative_loss_of_life_hours: 3.7,
      status: overrides.status ?? "nominal",
      model_standard: "IEEE C57.91",
    },
    bess: null,
    line: null,
  };
}

export function projection(): HotSpotProjection {
  return {
    horizon_hours: 6,
    dt_hours: 0.05,
    time_hours: [0, 0.05],
    expected_c: [96.5, 96.6],
    ci95_low_c: [96.4, 96.2],
    ci95_high_c: [96.6, 97.1],
    limit_c: 120,
    time_to_limit: {
      expected_hours: null,
      ci95_low_hours: null,
      ci95_high_hours: null,
      already_breached: false,
    },
    model_standard: "IEEE C57.91",
    uncertainty_basis: "weather + load forecast error propagated through C57.91",
  };
}

export function validation(): ValidationReport {
  return {
    thermal_verification: [
      {
        loading_k: 1.0,
        model_hot_spot_c: 109.98,
        reference_hot_spot_c: 110.0,
        residual_c: -0.02,
      },
    ],
    thermal_max_abs_residual_c: 0.03,
    aging_validation: [
      { hot_spot_c: 110, model_faa: 1.0, six_degree_rule_faa: 1.0, residual: 0 },
    ],
    design_point: {
      ambient_c: 30,
      loading_k: 1.0,
      model_hot_spot_c: 109.98,
      reference_hot_spot_c: 110.0,
      model_faa: 0.99,
      reference_faa: 1.0,
      passes: true,
    },
    thermal_reference: "IEEE C57.91 Clause 7",
    aging_reference: "IEEE C57.91 Annex A",
  };
}
