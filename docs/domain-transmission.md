# Domain: Transmission Line (Dynamic Line Rating) + Grid Context

Source of truth for the outgoing line and the power-flow context the node lives in. **Read before
generating line or grid data.** Line thermal model follows **IEEE Std 738** (conductor
thermal-rating). Power flow uses **pandapower/PyPSA on a published IEEE test case** so numbers are
independently verifiable. See `docs/credibility-checklist.md`.

## Reference asset

- **Line:** 230 kV single-circuit, **ACSR "Drake" 795 kcmil** (D = 28.1 mm), representative span
- **Static (nameplate) rating:** computed under conservative assumptions (below)
- **Dynamic rating:** computed from real-time weather via IEEE 738 (the whole point)
- **Conductor temp limits:** 75 °C normal, 100 °C emergency (annealing risk above ~90–100 °C for
  ACSR); parameters in `sim/line.py`

## IEEE 738 steady-state heat balance

At thermal equilibrium, heat in = heat out:
```
q_s  +  I² · R(T_c)   =   q_c  +  q_r
(solar) (Joule)          (convective) (radiative)
```

**Convective loss** `q_c` (per unit length) — the dominant, weather-sensitive term. Forced
convection (wind) uses Reynolds number `N_Re`; natural convection when wind ≈ 0:
```
q_c,forced = K_angle · (1.01 + 1.35 · N_Re^0.52) · k_f · (T_c − T_a)
q_c,natural = 0.0205 · ρ_f^0.5 · D^0.75 · (T_c − T_a)^1.25
```
`K_angle` accounts for wind direction relative to the conductor (perpendicular wind cools most).

**Radiative loss** `q_r`:
```
q_r = 17.8 · D · ε · [ ((T_c + 273)/100)^4 − ((T_a + 273)/100)^4 ]
```

**Solar gain** `q_s`:
```
q_s = α · Q_se · sin(θ) · A′        (A′ = projected area = D per unit length)
```

**Resistance** temperature-dependent (linear): `R(T_c) = R_20 · [1 + β·(T_c − 20)]`.

**Two uses:**
- **Ampacity** (rating): solve for `I` at `T_c = T_c,max` →
  `I_max = √( (q_c + q_r − q_s) / R(T_c,max) )`
- **Conductor temperature** at a given current: solve the balance for `T_c` (iterate).

## Static vs dynamic rating

- **Static assumptions** (conservative, worst-case): `T_a = 40 °C`, wind `0.61 m/s (2 ft/s)`
  perpendicular, full noon sun. Gives the nameplate rating.
- **Dynamic** uses **actual** ambient, wind speed/direction, and solar. Real conditions (cooler,
  windier) typically yield **5–30 % more ampacity** — the hidden headroom the agent unlocks
  (Agent A: ~25 %; FERC Orders 881/1920 tailwind).
- During the heat-wave scenario, high `T_a` and low wind **shrink** dynamic headroom — the line
  can become the binding export constraint exactly when load peaks.

## Grid / power-flow context

- `sim/grid.py` solves steady-state AC power flow (Newton-Raphson, per-unit) with
  **pandapower/PyPSA** on an **IEEE test case** (e.g., IEEE 14- or 118-bus). The substation node
  is a bus with the data-center load; the BESS is a controllable injection; the line is the branch
  whose loading we rate.
- This gives the twin correct bus voltages and real/reactive flows — numbers an engineer can
  check against the published test-case solution.

## Normal operating ranges

| Signal | Normal | Warning | Critical |
|---|---|---|---|
| Line loading (vs dynamic rating) | <85 % | 85–100 % | >100 % (over-rating) |
| Conductor temperature | <65 °C | 65–90 °C | >90–100 °C (anneal) |
| Dynamic headroom vs static | positive | ~0 | negative (dynamic < static) |
| Ambient / wind / solar | inputs | — | — |
| Bus voltage (p.u.) | 0.95–1.05 | edges | outside |

## Economics (agent reasoning inputs)

- **Congestion / curtailment cost:** when the line binds, either load is unserved or generation
  (or BESS export) is curtailed — priced per MWh (US congestion ~$11.5 B/yr, Agent A).
- **Value of unlocked capacity:** MWh enabled by using dynamic instead of static rating.
- **Constraint, not a cost:** exceeding the emergency conductor temperature (annealing/sag) is a
  hard limit, not a tradeable quantity.

## Intervention decision logic (agent)

- **Loading < 85 %:** nominal; report dynamic headroom vs static.
- **Loading 85–100 %:** if weather supports it, use the **dynamic** rating to unlock headroom
  (quantify the extra MW and the resulting conductor temperature with margin).
- **Loading > 100 % or T_c → limit:** reduce flow via **BESS local discharge** (serves node load
  without importing over the line) and/or curtail non-critical export; quantify each.
- **Always:** rank options by served-load value vs curtailment cost, respecting the conductor
  thermal limit as a hard bound.

## Coupling to the scenario

The line caps how much power the node can import/export. BESS discharge reduces required line
flow (local supply), and reducing line flow also interacts with the transformer loading. The
agent's cross-asset job: meet the data-center peak while keeping transformer hot-spot, BESS
thermal margin, **and** conductor temperature all within limits — trading off the three.

## Anti-patterns (smell tests)

- Ratings not derived from the IEEE 738 balance (e.g., a fixed MVA number regardless of weather).
- Dynamic rating that ignores wind direction or solar.
- Power-flow numbers that don't reconcile with a known IEEE test-case solution.
- Conductor temperature exceeding the anneal limit with no consequence.
- Any number not derivable from the equations above.

## References

- IEEE Std 738 (2012) — Calculating the Current-Temperature Relationship of Bare Overhead
  Conductors
- FERC Order 881 (ambient-adjusted ratings) / Order 1920 — regulatory context
- MATPOWER / pandapower / PyPSA + IEEE test cases — verifiable power flow
- `RESEARCH-LOG.md` §4 (Agent A: congestion + DLR; Agent B: IEEE 738, power-flow tools)
