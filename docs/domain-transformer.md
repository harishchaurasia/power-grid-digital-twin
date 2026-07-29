# Domain: Large Power Transformer (LPT)

Source of truth for transformer telemetry realism. **Read before generating any transformer
data.** Physics follows **IEEE Std C57.91** (Guide for Loading Mineral-Oil-Immersed
Transformers), Clause 7 thermal model and Annex aging. Every number the twin or agent reports
must trace to these equations. See `docs/credibility-checklist.md`.

## Reference asset

- **Type:** three-phase, mineral-oil-immersed, ONAN/ONAF/OFAF cooling, thermally-upgraded
  (65 °C average-winding-rise) insulation
- **Rating:** 150 MVA base (ONAN) / 200 MVA (ONAF) / 250 MVA (OFAF)
- **Voltage:** 230 / 34.5 kV substation step-down (data-center-serving node)
- **Reference:** representative of a substation main power transformer; parameters below are
  configurable in `sim/transformer.py` (constants at module top, each citing C57.91)

## Rated thermal parameters (configurable)

| Symbol | Meaning | Value |
|---|---|---|
| ΔθTO,R | Top-oil rise over ambient at rated load | 55 °C |
| ΔθH,R | Hot-spot rise over ambient at rated load | 80 °C |
| ΔθH/TO,R | Hot-spot rise over **top-oil** at rated | 25 °C |
| R | Ratio of load loss (rated) to no-load loss | 8.0 |
| n | Oil exponent | 0.8 (ONAN) → 1.0 (forced) |
| m | Winding exponent | 0.8 |
| τTO | Top-oil time constant | ~3 h (ONAN), shorter forced |
| τW | Winding (hot-spot) time constant | ~5–7 min |
| θH,ref | Reference hot-spot for normal aging | 110 °C |

## Thermal model (IEEE C57.91, Clause 7)

Load ratio `K = load MVA / rated MVA`. Ambient `θA`.

**Ultimate top-oil rise** at load K:
```
Δθ_TO,ult = Δθ_TO,R * [ (K² · R + 1) / (R + 1) ]^n
```

**Top-oil temperature** responds with first-order lag toward the ultimate value:
```
dθ_TO/dt = (θ_A + Δθ_TO,ult − θ_TO) / τ_TO
```

**Hot-spot rise over top-oil** (fast, winding time constant):
```
Δθ_H,ult = Δθ_(H/TO),R * K^(2m)
dΔθ_H/dt = (Δθ_H,ult − Δθ_H) / τ_W
```

**Hot-spot temperature:**
```
θ_H = θ_TO + Δθ_H          (= θ_A + Δθ_TO + Δθ_H)
```

The time constants matter: a step in load does **not** instantly change hot-spot — top-oil lags
by hours, winding by minutes. Telemetry that jumps instantly is a tell.

## Insulation aging (Annex A / the "6 °C rule")

**Aging acceleration factor** (65 °C-rise thermally-upgraded insulation, ref 110 °C):
```
F_AA = exp( 15000/383  −  15000/(θ_H + 273) )
```
- θ_H = 110 °C → F_AA = 1.0 (normal aging)
- θ_H = 116 °C → F_AA ≈ 2.0  (the **6 °C rule**: +6 °C ≈ 2× aging)
- θ_H = 122 °C → F_AA ≈ 4.0

**Loss of life** over an interval: `LOL = Σ (F_AA · Δt)`. Normal insulation life basis
≈ 180,000 h (20.55 yr) — configurable. The agent reasons in **equivalent hours/days of life
consumed**, not vibes.

## Cooling stages (the primary lever)

| Stage | Mechanism | Approx capacity |
|---|---|---|
| ONAN | Oil natural, air natural | 100% (150 MVA) |
| ONAF | + fans | ~133% (200 MVA) |
| OFAF | + oil pumps + fans | ~167% (250 MVA) |

Engaging a cooling stage lowers hot-spot for the same load (raises effective τ behavior and
lowers rises). This is a real, instantly-available intervention with a small auxiliary-power
cost and fan/pump wear.

## Dissolved Gas Analysis (DGA) — condition signal

Incipient faults evolve fault gases; the twin models a slow DGA trend the agent can read:

| Gas | Indicates |
|---|---|
| H₂ | general/partial discharge |
| CH₄, C₂H₄ (ethylene) | thermal fault, overheating (rises with sustained high hot-spot) |
| C₂H₂ (acetylene) | high-energy arcing (serious) |
| CO, CO₂ | cellulose (paper) degradation |

Interpretation via the **Duval Triangle** (relative %CH₄/%C₂H₄/%C₂H₂). Sustained overheating in
the scenario drives ethylene/methane up; the agent should tie a rising thermal-gas trend to the
hot-spot history, not treat it as free-floating.

## Normal operating ranges

| Signal | Normal | Warning | Critical |
|---|---|---|---|
| Loading (K) | 0–1.0 | 1.0–1.3 | >1.3 |
| Top-oil temp | 40–75 °C | 75–90 °C | >90 °C |
| Hot-spot temp | 55–105 °C | 105–120 °C | >120 °C |
| F_AA (aging rate) | ≤1 | 1–4 | >4 |
| Load-tap-changer ops/day | nominal | elevated | — |
| Acetylene (C₂H₂) | ~0 ppm | any sustained | rising |

## Intervention costs (agent reasoning inputs)

Adjust here, not in agent code. Sourced from `RESEARCH-LOG.md` (Agent A).

- **Replacement LPT:** ~$1.4M unit (prices +77% since 2019), **lead time ~128 weeks (2–4 yr)** —
  there is effectively **no spare**. This is what makes life-extension economically decisive.
- **Overload economics:** serving peak load at K>1 buys served-load revenue but burns insulation
  life at F_AA×; the agent must price life consumed against alternatives.
- **Cooling stage engage:** small auxiliary-power + wear cost; large hot-spot relief.
- **Unserved / curtailed load:** value of lost load / contractual penalty per MWh (configurable).
- **Catastrophic failure:** multi-year outage of the node + ~$1.4M + 2–4 yr replacement — the
  tail risk the agent is protecting against.

## Intervention decision logic (agent)

- **Hot-spot < 105 °C, F_AA ≈ 1:** nominal; serve load, monitor.
- **Hot-spot 105–120 °C:** engage next cooling stage; if still high, offload via **BESS
  dispatch** (couples to `domain-bess.md`) before accepting overload aging.
- **Hot-spot > 120 °C or acetylene rising:** cap loading / shed non-critical load; quantify life
  consumed per hour and the replacement tail risk.
- **Always:** compute equivalent life consumed for each option and rank by total expected cost
  (served-load value − life-consumption cost − failure-risk cost). Recommend max-value, not most
  conservative.

## Coupling to the scenario

Heat wave raises θ_A (less cooling headroom) while the data-center load spike raises K → hot-spot
climbs super-linearly. The transformer is the first constraint the agent hits; BESS dispatch and
load management are its levers.

## Anti-patterns (smell tests)

- Hot-spot that changes instantly with load (ignores τTO/τW).
- F_AA computed from anything but θ_H via the Arrhenius equation above.
- DGA gases uncorrelated with thermal history.
- Overload with no life-consumption accounting.
- Any thermal number not derivable from the C57.91 equations.

## References

- IEEE Std C57.91 (2011; 2025 rev) — Loading Mineral-Oil-Immersed Transformers
- IEEE/IEC 60599 & Duval — DGA interpretation
- `RESEARCH-LOG.md` §4 (Agent A: transformer crisis; Agent B: C57.91, 6 °C rule)
