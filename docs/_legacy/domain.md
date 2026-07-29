# Wind Turbine Domain Knowledge

This document is the source of truth for telemetry realism. **Read this before generating any synthetic data.**

## Reference Asset

- **Class:** 8MW offshore wind turbine (reference: Vestas V164-8.0 MW / scaled-down GE Haliade-X)
- **Rotor diameter:** 164 m
- **Hub height:** 110 m
- **Cut-in wind speed:** 3 m/s
- **Rated wind speed:** 12 m/s
- **Cut-out wind speed:** 25 m/s
- **Rated power:** 8 MW
- **Location:** Offshore (North Sea conditions assumed)

## Power Curve

Piecewise function `P(v)` where `v` is wind speed in m/s, `P_rated = 8 MW`:

```
v < 3:            P = 0                                       (below cut-in)
3 <= v < 12:      P = P_rated * ((v - 3)^3 / (12 - 3)^3)     (cubic region)
12 <= v < 25:     P = P_rated                                 (rated, pitch regulated)
v >= 25:          P = 0                                       (cut-out, safety)
```

Real turbines have slight non-cubic behavior due to control system response, but cubic is sufficient for the demo.

## Wind Speed Generation

- **Distribution:** Weibull with shape `k = 2.0` (Rayleigh special case), scale `lambda = 10.0 m/s`
- **Temporal correlation:** 1/f noise (pink noise) with characteristic time ~60 seconds. Wind doesn't change instantaneously.
- **Diurnal variation:** Optional sinusoidal component with 24h period and amplitude ~1.5 m/s
- **Sampling:** Generate at 10 Hz, smooth with first-order low-pass (tau = 5s) for visualization

**Anti-pattern to avoid:** Drawing fresh Weibull samples at 10Hz independently. That produces white noise that no turbine in the world would experience.

## Rotor Dynamics

- **Tip speed ratio (TSR):** 7 to 9 typical for utility scale
- **Rotor RPM at rated wind:** 10 to 12 RPM
- **Generator-side RPM (after gearbox):** ~1500 RPM (gear ratio ~120:1 to 150:1)
- **Cut-in to rated ramp:** rotor RPM scales roughly linearly with wind speed in the cubic region

## Gearbox Architecture

- Three-stage planetary + parallel gearbox
- Gear ratio: ~120:1 (rotor side to generator side)
- High-speed shaft (HSS) connects gearbox output to the generator
- **HSS bearings are the most common failure point**: ~70% of gearbox failures originate at HSS bearings

## Bearing Fault Frequencies

For a typical HSS bearing (assume SKF 6324 or equivalent, 8 rolling elements):

| Frequency | Symbol | Multiplier on shaft frequency |
|---|---|---|
| Ball Pass Frequency Inner race | BPFI | ~5.5x |
| Ball Pass Frequency Outer race | BPFO | ~3.5x |
| Ball Spin Frequency | BSF | ~2.3x |
| Fundamental Train Frequency (cage) | FTF | ~0.4x |

At rated generator speed (1500 RPM = 25 Hz shaft frequency):

- BPFI peak: ~137.5 Hz
- BPFO peak: ~87.5 Hz
- BSF peak: ~57.5 Hz
- FTF peak: ~10 Hz

These are the frequencies that grow in the vibration spectrum as the bearing degrades. **Use these specific values in the synthetic vibration generator.**

## Vibration Signal Generation

The vibration spectrum at the gearbox case is composed of:

1. **Broadband background:** White noise floor, ~0.5 to 2 mm/s amplitude across 0 to 2000 Hz
2. **Shaft harmonics:** Peaks at shaft frequency and harmonics (25, 50, 75 Hz...) at low amplitude (~0.3 mm/s each)
3. **Gear mesh frequencies:** Peaks at gear mesh frequency (~3 kHz for HSS pinion), but typically out of band for our demo
4. **Bearing fault peaks (THE DEGRADATION SIGNAL):**
   - Peaks at BPFI, BPFO, BSF and their harmonics
   - Sidebands at +/- shaft frequency around each fault peak
   - Amplitude scales with degradation parameter `d in [0, 1]`
   - At `d = 0`: peaks invisible in the noise floor
   - At `d = 0.5`: peaks 2-3x noise floor
   - At `d = 1.0`: peaks 8-10x noise floor, harmonics also visible

**Implementation hint:** Generate as an FFT-domain spectrum, inverse-FFT to time domain for visualization. Or generate time-domain directly using sum of sinusoids + colored noise.

## Failure Progression (Stages)

| Stage | Name | Vibration signature | Temperature | Time to next stage |
|---|---|---|---|---|
| 1 | Sub-surface microcracks | Baseline, no fault peaks | Normal | Months to years |
| 2 | Incipient | Ultrasonic energy (>20 kHz), no LF signature | Normal | Weeks to months |
| 3 | Progressive | Fault peaks appear at BPFI/BPFO/BSF, sidebands begin | +2 to 5°C drift | 1 to 6 months |
| 4 | Advanced | Sidebands grow, harmonics of fault freqs visible, RMS rises 2-5x | +5 to 15°C above normal | Days to weeks |
| 5 | Catastrophic | Cage breakdown, rolling element fracture, broadband elevation | Rapid rise, smoke | Hours |

**Demo target:** Operate in Stage 3 transitioning to Stage 4. That is the actionable detection window in the real world and gives the agent meaningful intervention options.

## Normal Operating Telemetry Ranges

| Signal | Normal | Warning | Critical |
|---|---|---|---|
| Rotor RPM | 0 to 12 | 12.5+ | 14+ |
| Generator RPM | 0 to 1800 | 1850+ | 2000+ |
| Active power | 0 to 8 MW | 8.5+ | 9+ |
| Gearbox oil temp | 40 to 70°C | 75+ | 85+ |
| HSS bearing temp | 45 to 65°C | 70+ | 80+ |
| Vibration RMS (gearbox case) | 2 to 5 mm/s | 7+ | 10+ |
| Blade pitch angle | 0° (below rated) to 25° (above rated) | n/a | n/a |
| Wind speed | 3 to 25 m/s operational | <3 idle, >25 cut-out | gusts >30 |

## Intervention Costs (used by agent reasoning)

These numbers drive the agent's recommendations. Adjust here, not in the agent code.

- **Lost generation at full output:** ~$30,000 per day
  - Math: 8 MW × 24 h × 0.4 capacity factor × $40/MWh ≈ $30K
- **De-rated to 70% output:** ~$9,000 per day in foregone generation, extends bearing life 2 to 3x
- **HSS bearing replacement:** ~$250,000 total
  - Parts: ~$50K
  - Vessel + crane day rate: ~$150K
  - Labor and downtime: ~$50K
- **Catastrophic gearbox failure:** $1.5M to $3M
  - Full gearbox replacement plus 2 to 4 weeks downtime
  - Risk of secondary damage to generator and main shaft

## Intervention Decision Logic

The agent should reason approximately as follows:

- **Failure window > 60 days, high confidence:** Monitor, schedule maintenance at next planned window
- **Failure window 30 to 60 days:** De-rate to 70%, monitor closely, schedule replacement at earliest feasible window
- **Failure window < 30 days:** Immediate replacement or aggressive de-rate to prevent catastrophic failure
- **Always:** Compute expected value across scenarios. Recommend the max EV option, not the most conservative.

Expected value calculation example for a 45-day failure window:

| Option | Lost generation | Replacement cost | Failure risk cost | Total expected cost |
|---|---|---|---|---|
| No action | 0 | 0 | 0.4 × $2.5M = $1M | $1.0M |
| De-rate to 70% | 45d × $9K = $405K | $250K | 0.05 × $2.5M = $125K | $780K |
| Replace now | 7d × $30K = $210K | $250K | 0 | $460K |

In this example, replace-now has lowest expected cost. The agent should arrive at similar reasoning.

## Anti-Patterns (Telemetry Smell Tests)

If your synthetic telemetry has any of these, fix it:

- Wind speed that looks like white noise (no temporal correlation)
- Power output uncorrelated with wind speed
- Vibration that is uniform white noise across the spectrum
- Bearing temperature that drifts randomly with no thermal time constant
- Rotor RPM that doesn't match the wind speed via the power curve
- Fault peaks that appear at "round numbers" like 100 Hz instead of actual BPFI/BPFO
- Degradation that progresses linearly with wall-clock time at a visible rate (real degradation is over months; for demo, compress time but make the curve realistic in shape)

## References

- IEC 61400-1 (Wind turbine design requirements)
- "Wind Energy Handbook" by Burton, Jenkins, Sharpe, Bossanyi (telemetry ranges)
- Vibration analysis literature on rolling element bearing diagnostics (McFadden & Smith, Randall)
