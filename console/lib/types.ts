/**
 * Wire contract with the backend. Mirrors `backend/api/schemas.py`,
 * `backend/sim/state.py`, `backend/sim/projection.py` and
 * `backend/sim/validation.py`. Keep both sides in step -- the console never
 * derives physics of its own, it only renders what Python sends.
 */

export type AssetId = "transformer" | "bess" | "line";
export type AssetStatus = "nominal" | "warning" | "critical";
export type CoolingStage = "ONAN" | "ONAF" | "OFAF";
export type InterventionId = "cooling_onaf" | "cooling_ofaf" | "hold";

export interface AmbientConditions {
  air_temp_c: number;
  wind_ms: number;
  solar_wm2: number;
}

export interface TransformerSnapshot {
  node_load_mva: number;
  loading_k: number;
  top_oil_c: number;
  hot_spot_c: number;
  aging_factor_faa: number;
  cooling_stage: CoolingStage;
  cumulative_loss_of_life_hours: number;
  status: AssetStatus;
  model_standard: string;
}

export interface TwinSnapshot {
  sim_time_hours: number;
  timestamp_ms: number;
  twinning_rate_hz: number;
  ambient: AmbientConditions;
  transformer: TransformerSnapshot;
  /** Populated in Phases 2-3; null until their physics models exist. */
  bess: null;
  line: null;
}

/* --- Server -> console (docs/architecture.md) ------------------------------ */

export interface ToolCallEvent {
  call_id: string;
  tool: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export type ServerMessage =
  | { type: "telemetry"; payload: TwinSnapshot; timestamp: number }
  | { type: "agent_started"; provider: string; model: string; local: boolean }
  | { type: "agent_thinking"; text: string }
  | { type: "tool_call"; call_id: string; tool: string; input: Record<string, unknown> }
  | { type: "tool_result"; call_id: string; tool: string; output: Record<string, unknown> }
  | { type: "agent_final"; text: string }
  | { type: "agent_done"; timestamp: number }
  | {
      type: "state_change";
      asset: AssetId;
      from: AssetStatus;
      to: AssetStatus;
      timestamp: number;
    }
  | { type: "error"; message: string };

/* --- Console -> server ----------------------------------------------------- */

export type ClientMessage =
  | { type: "trigger_scenario"; scenario: "heatwave_load_spike" | "reset" }
  | { type: "agent_invoke" }
  | { type: "apply_intervention"; intervention: InterventionId }
  | { type: "select_asset"; asset: AssetId };

/* --- REST: forward projection with its uncertainty band -------------------- */

export interface ConfidenceWindow {
  expected_hours: number | null;
  ci95_low_hours: number | null;
  ci95_high_hours: number | null;
  /** Limit is already exceeded, so there is no future window to report. */
  already_breached: boolean;
}

export interface HotSpotProjection {
  horizon_hours: number;
  dt_hours: number;
  time_hours: number[];
  expected_c: number[];
  ci95_low_c: number[];
  ci95_high_c: number[];
  limit_c: number;
  time_to_limit: ConfidenceWindow;
  model_standard: string;
  uncertainty_basis: string;
}

/* --- REST: V&V report ------------------------------------------------------ */

export interface ThermalVerificationPoint {
  loading_k: number;
  model_hot_spot_c: number;
  reference_hot_spot_c: number;
  residual_c: number;
}

export interface AgingValidationPoint {
  hot_spot_c: number;
  model_faa: number;
  six_degree_rule_faa: number;
  residual: number;
}

export interface DesignPointCheck {
  ambient_c: number;
  loading_k: number;
  model_hot_spot_c: number;
  reference_hot_spot_c: number;
  model_faa: number;
  reference_faa: number;
  passes: boolean;
}

export interface ValidationReport {
  thermal_verification: ThermalVerificationPoint[];
  thermal_max_abs_residual_c: number;
  aging_validation: AgingValidationPoint[];
  design_point: DesignPointCheck;
  thermal_reference: string;
  aging_reference: string;
}

/* --- Connection state ------------------------------------------------------ */

export type ConnectionState =
  | "connecting"
  | "open"
  | "reconnecting"
  | "closed"
  /** Backend unreachable; playing the captured scenario instead. */
  | "recorded";
