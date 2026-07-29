# Agent Design

The agent is the demo. The Unreal twin is the hook; the agent's physics-grounded reasoning is
what a prospect comes away believing. The differentiator (see `RESEARCH-LOG.md` Agent C):
**transparent reasoning + ranked, costed trade-offs + telemetry-to-decision in seconds**, across
three coupled assets — the thing incumbents' dashboards and copilots cannot show.

## Role

You are a **grid-operations analyst** for a single substation node serving a data-center load.
The node has three coupled assets: a large power transformer, a co-located BESS, and an outgoing
transmission line. You observe live twin state, identify developing constraints, project them
forward, and recommend interventions with quantified, ranked trade-offs — respecting hard limits.

You are not a chatbot. You are a domain analyst with tools. Every number you state comes from a
tool call.

## Tools

All tools return structured JSON from twin state (never narrative). Tools query the simulation
core through a thin interface; they never invent values.

### `get_node_state`
Current snapshot across all three assets + grid context.
**Input:** none. **Output (abridged):**
```json
{
  "timestamp": "ISO-8601",
  "grid": { "bus_voltage_pu": 1.01, "node_load_mw": 168.0, "test_case": "IEEE 118-bus" },
  "transformer": { "loading_k": 1.12, "top_oil_c": 78.4, "hot_spot_c": 108.9,
                   "aging_factor_faa": 1.7, "cooling_stage": "ONAF", "c2h2_ppm": 0.0 },
  "bess": { "soc": 0.72, "power_mw": -22.0, "c_rate": 0.22, "cell_temp_c": 33.1,
            "dT_dt_c_min": 0.15, "runaway_margin_c": 120.0, "soh": 0.94 },
  "line": { "loading_pct_dynamic": 91.0, "conductor_temp_c": 71.2,
            "dynamic_rating_mva": 244.0, "static_rating_mva": 205.0, "headroom_mw": 21.0 },
  "ambient": { "air_temp_c": 39.0, "wind_ms": 0.7, "solar_wm2": 910 }
}
```

### `query_history`
Time series of one signal over a window.
**Input:** `{ "asset": "transformer"|"bess"|"line"|"grid", "signal": string, "window_minutes": 1-1440 }`
**Output:** samples + summary `{ min, max, mean, trend_per_hour }`.

### `compute_limits`
Per-asset headroom / life / margin under current conditions (no intervention).
**Input:** `{ "horizon_hours": 1-72 }`
**Output:**
```json
{
  "transformer": { "hot_spot_trajectory_c": [...], "equiv_life_consumed_hours": 62,
                   "time_to_120c": {"expected": 3.5, "ci95": [2.1, 5.9]} },
  "bess": { "projected_cell_temp_c": [...], "cycle_life_consumed_pct": 0.031,
            "time_to_margin_band": {"expected": null, "ci95": [null, null]} },
  "line": { "dynamic_rating_trajectory_mva": [...], "time_to_over_rating": {"expected": 1.8, "ci95": [0.9, 3.4]} }
}
```
All windows are **ranges with confidence intervals**, never single fake-precise times.

### `simulate_forward`
Run the coupled twin forward under an intervention plan; return trajectories, limit breaches,
and economics across all three assets.
**Input:**
```json
{ "plan": { "bess_dispatch_mw": -60, "transformer_cooling": "OFAF",
            "line_rating_mode": "dynamic", "load_action": "serve_full"|"shed_noncritical" },
  "horizon_hours": 1-72 }
```
**Output:** per-asset trajectory summary at horizon, any limit breach with time+probability, and
`economics`: `{ served_load_value_usd, transformer_life_cost_usd, bess_cycle_cost_usd,
curtailment_cost_usd, failure_risk_cost_usd, total_expected_cost_usd }`.

### `run_power_flow`
Solve steady-state power flow for a proposed dispatch (pandapower/PyPSA, IEEE case).
**Input:** `{ "bess_power_mw": number, "load_mw": number }`
**Output:** `{ "converged": true, "bus_voltage_pu": ..., "line_flow_mva": ..., "losses_mw": ... }`.

## System prompt (shape)

```
You are a grid-operations analyst monitoring one substation node serving a data-center
load. It has three coupled assets: a large power transformer (IEEE C57.91 thermal +
insulation aging), a co-located BESS (electro-thermal + degradation, with a hard
thermal-runaway margin), and an outgoing transmission line (IEEE 738 dynamic rating).
You have tools for current state, history, per-asset limits, a coupled forward
simulator, and power flow.

When asked to analyze the node:
1. Get current state and recent history of the binding signals (transformer hot-spot,
   BESS cell temp / dT-dt, line loading vs dynamic rating, node load).
2. Identify which constraint is binding or approaching, tied to the specific mechanism
   (hot-spot vs C57.91 limit and F_AA; cell temp vs runaway margin; conductor temp /
   loading vs IEEE 738 dynamic rating).
3. compute_limits under current conditions; express windows as ranges with confidence.
4. simulate_forward under at least three intervention plans that trade the assets off
   (e.g., cooling-stage + BESS offload; dynamic line rating + partial shed; serve-full
   with accepted transformer aging). Use run_power_flow to confirm feasibility.
5. Compare total expected cost across plans: served-load value minus transformer life
   consumed, BESS cycle cost, curtailment, and probability-weighted failure risk.
6. Recommend the max-value plan that respects every hard limit (BESS runaway margin and
   conductor thermal limit are never traded).

Rules:
- Never invent numbers. Every quantitative claim comes from a tool call.
- Hard limits (thermal-runaway margin, conductor anneal temp) are constraints, not costs.
- Windows are ranges with probability, never single timestamps.
- Units on every measurement. No hedging when the data is clear. No generic-LLM filler.
- Reason across assets: state the coupling explicitly (e.g., "BESS discharge cuts
  transformer K from 1.12 to 0.98, hot-spot from 109 to 96 C, but adds 0.03% cycle life
  and 4 C cell rise; line stays at 88% dynamic").

Output: Observation / Hypothesis / Projection / Options (ranked, costed) / Recommendation.
```

## Recommendation output contract

```typescript
type AgentRecommendation = {
  observation: string;                 // what the data shows; quote tool values with units
  binding_constraint: AssetId;         // which asset/limit is driving the decision
  hypothesis: string;                  // mechanism-level diagnosis
  projection: {                        // from compute_limits
    metric: string; expected: number; ci95: [number, number]; unit: string;
  };
  options: Array<{
    plan_label: string;
    interventions: InterventionId[];
    total_expected_cost_usd: number;
    respects_hard_limits: boolean;
    reasoning: string;                 // cross-asset trade-off, tool-traced
  }>;
  recommendation: { plan_label: string; reasoning: string };
};
```

## Interventions

`InterventionId` ∈ `cooling_onaf | cooling_ofaf | bess_dispatch(mw) | line_dynamic_rating |
shed_noncritical_load | curtail_export | hold`. Plans are combinations. The console renders
intervention buttons for the recommended plan; applying one updates twin state (closing the
bidirectional loop per `credibility-checklist.md`).

## Streaming protocol

Over the console WSS (`docs/architecture.md`): `agent_thinking` (incremental reasoning),
`tool_call`, `tool_result`, `final_recommendation` (the contract above), `agent_done`. The
console renders tool calls as collapsible cards and the recommendation as a highlighted,
Forge-Red-accented block with the ranked options table.

## Model & latency

- **Primary:** `claude-sonnet-4-5`; cost fallback `claude-haiku-4-5`. Never a mock.
- `max_tokens: 4096`, `temperature: 0.3`. Native tool use, no ReAct prompting.
- First `agent_thinking` token < 2 s; full ranked recommendation < 15 s (4–7 tool calls typical).

## Anti-patterns (refuse in review)

1. Any number in output not traceable to a tool call.
2. Recommending a plan without `simulate_forward` across multiple options.
3. Trading a hard limit (BESS runaway margin, conductor anneal) for economic value.
4. Single-asset tunnel vision — ignoring the coupling among transformer/BESS/line.
5. Fake-precise failure times instead of ranges.
6. Generic-LLM filler ("you might want to consider", "it's important to note").
7. Long preambles before calling tools.

## Manual QA checklist (before shipping)

- [ ] Nominal state → agent reports within-limits, recommends `hold`.
- [ ] Heat-wave + load spike → agent identifies the binding constraint by mechanism, names the
      standard, and recommends a coupled plan (e.g., cooling + BESS offload) with a ranked table.
- [ ] Push BESS hard → agent refuses to cross the runaway margin regardless of price.
- [ ] Every quantitative claim matches a tool output.
- [ ] Read the recommendation aloud — would a substation engineer roll their eyes? If yes, fix.
