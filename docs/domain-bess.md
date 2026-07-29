# Domain: Battery Energy Storage System (BESS)

Source of truth for BESS telemetry realism. **Read before generating any battery data.** Models:
an equivalent-circuit + lumped electro-thermal model and a non-linear (calendar + cycle)
degradation model. Thermal-runaway margin is an explicit safety limit the agent must respect.
See `docs/credibility-checklist.md`.

## Reference asset

- **Chemistry:** LFP (LiFePO₄) — dominant grid chemistry; safer onset than NMC, but runaway is
  still a modeled limit (cf. Moss Landing, Jan 2025, `RESEARCH-LOG.md`)
- **Rating:** 100 MW / 400 MWh (4-hour), co-located at the substation node
- **Nominal C-rate:** 0.25C continuous (100 MW / 400 MWh); short-term higher
- **Config:** parameters in `sim/bess.py`, constants at module top

## State definitions

- **SOC** (state of charge) `∈ [0,1]`; usable window typically 0.10–0.95
- **DoD** (depth of discharge) = SOC swing of a cycle
- **C-rate** = |power| / energy-capacity (0.25C = 100 MW here); sets current and I²R heating
- **SOH** (state of health) = usable capacity / rated; **EOL at SOH = 0.80**

## Electro-thermal model

**Heat generation** (per pack), dominated by ohmic loss plus a smaller entropic term:
```
Q_gen = I² · R_internal(SOC, T, SOH)  +  I · T · (dU/dT)     [W]
```
Demo may foreground the I²R term and treat the entropic term as a small correction — but state
that it exists (a pure I²R model is a simplification, not a lie, if labeled).

**Lumped thermal model** (single thermal node, coolant sink `T_cool`):
```
C_th · dT_cell/dt = Q_gen − (T_cell − T_cool) / R_th
```
Thermal time constant `τ_th = R_th · C_th` (minutes). Cell temperature **lags** power — a step
in dispatch warms the pack over minutes, not instantly.

## Degradation model (non-linear)

Total capacity fade = calendar + cycle. **Not** a linear wall-clock decay.

**Calendar aging** (idle loss; Arrhenius in temperature, SOC-dependent):
```
Q_cal = k_cal(SOC) · exp( −E_a / (R · T_cell) ) · √t
```

**Cycle aging** (throughput-driven; stress rises with DoD and C-rate):
```
Q_cyc = k_cyc · f_DoD(DoD) · f_Crate(C) · Ah_throughput
f_DoD(DoD) ∝ DoD^p     (p ≈ 1.5–2, deep cycles disproportionately costly)
```

`SOH = 1 − (Q_cal + Q_cyc)`; internal resistance grows as SOH falls (feeds back into Q_gen).
Cycles counted by **rainflow** on the SOC signal. The agent prices **cycle-life consumed** per
dispatch decision.

## Thermal-runaway margin (hard safety limit)

- **Self-heating onset** `T_onset` (LFP ≈ 150–200 °C; configurable, lower for aged/NMC).
- **Runaway margin** `= T_onset − T_cell`. The agent must keep dispatch within a margin band
  (e.g., never let projected `T_cell` come within ΔT_safe of onset).
- **Early-warning signals** the twin exposes: cell-to-cell **voltage divergence**, **temperature
  rise-rate** (dT/dt), and off-gas indication. A rising dT/dt near a hot string is the actionable
  precursor — tie recommendations to it, never to a bare threshold.

## Normal operating ranges

| Signal | Normal | Warning | Critical |
|---|---|---|---|
| Cell temperature | 15–35 °C | 35–45 °C | >45 °C (and runaway-margin band) |
| C-rate (magnitude) | ≤0.5C | 0.5–1C | >1C sustained |
| SOC | 0.10–0.95 | edges | outside window |
| dT/dt (rise rate) | small | elevated | rapid (runaway precursor) |
| Cell voltage spread | tight | widening | diverging |
| SOH | >0.90 | 0.80–0.90 | <0.80 (EOL) |

## Economics (agent reasoning inputs)

Adjust here, not in agent code.

- **Arbitrage / peak-shave value:** revenue for discharging into the peak (price × MWh) or the
  transformer-life it saves by offloading (couples to `domain-transformer.md`).
- **Degradation cost per cycle:** `(cell-life consumed) × (replacement/augmentation $/kWh)`.
  This is the crisp revenue-vs-life trade-off the agent owns.
- **Thermal safety:** breaching the runaway margin is not a cost, it is a hard constraint —
  never traded for revenue.
- **Replacement/augmentation:** $/kWh cost of restoring capacity at EOL.

## Intervention decision logic (agent)

- **Cell temp < 35 °C, margin large:** dispatch to economic optimum (serve peak / offload
  transformer), tracking cycle-life cost.
- **Cell temp 35–45 °C or dT/dt rising:** cap C-rate to hold within thermal margin; capture the
  fraction of value that stays safe (e.g., "0.7C → 85% of revenue, 8 °C below limit").
- **Runaway-margin band approached:** curtail/stop regardless of price. Safety dominates.
- **Always:** present ranked options as (served value/offload) vs (cycle-life $) vs (thermal
  margin), numbers from tool calls only.

## Coupling to the scenario

During the peak, discharging the BESS offloads the transformer (lowers K → lowers hot-spot) and
reduces transmission-line flow — but high discharge raises cell temperature and burns cycle life.
The agent balances transformer relief against battery thermal/degradation limits, within the
line's export cap.

## Anti-patterns (smell tests)

- Cell temperature that tracks power instantaneously (ignores τ_th).
- Linear, temperature-independent capacity fade.
- Degradation independent of DoD/C-rate.
- Trading the thermal-runaway margin for revenue.
- Any number not derivable from the models above.

## References

- Equivalent-circuit + electro-thermal Li-ion modeling (standard literature)
- Empirical calendar/cycle degradation models; rainflow cycle counting
- UL 9540A (thermal-runaway / fire test method) — safety framing
- `RESEARCH-LOG.md` §4 (Agent A: BESS growth + Moss Landing; Agent B: electro-thermal/degradation)
