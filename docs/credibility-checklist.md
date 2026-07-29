# Credibility Checklist

This is a **hard build gate**, not a nicety. The demo's entire purpose is to be trusted by
people who build and operate power systems. The research is blunt: **visual realism is not
fidelity**, and "pretty 3D standing in for model accuracy" is the number-one tell of a toy.
Trust comes from physics an expert can check.

Every item maps to a standard, model, or known failure mode. Nothing ships until it passes.

## Definitions we hold ourselves to

- **NASA (origin):** a twin is an *integrated multi-physics, multi-scale, probabilistic
  simulation updated with sensor + history*. Four load-bearing properties: multi-physics,
  multi-scale, probabilistic, sensor-updated.
- **ISO 23247:** a twin *synchronizes* with the physical element. No sync → not a twin.
- **Digital Twin Consortium:** "synchronized interaction at a **specified frequency and
  fidelity**." We state our **twinning rate**.
- **V&V + UQ (ASME V&V 40 lineage):** Verification (code solves the math), Validation (math
  matches reality), Uncertainty Quantification (confidence bands; aleatoric vs epistemic).

## Physics & telemetry (per asset)

**Transformer (LPT)** — see `docs/domain-transformer.md`
- [ ] Top-oil and hot-spot temperatures from the **IEEE C57.91** thermal model, not curve-fit.
- [ ] Insulation loss-of-life via the **6 °C rule** (every 6 °C over 110 °C hot-spot ~halves
      life); Arrhenius-based aging.
- [ ] Loading, cooling stage, and ambient are inputs; hot-spot is a derived state with a time
      constant (thermal inertia), not instantaneous.

**BESS** — see `docs/domain-bess.md`
- [ ] Cell/pack temperature from an electro-thermal model (heat generation from I²R + entropic,
      dissipation with a thermal time constant).
- [ ] Degradation as a non-linear function of DoD, C-rate, cell temperature, and cycle count —
      not a linear wall-clock decay.
- [ ] An explicit thermal-runaway **margin** the agent must respect.

**Transmission line** — see `docs/domain-transmission.md`
- [ ] Conductor temperature / dynamic ampacity from the **IEEE 738** heat balance
      (Joule + solar = convective + radiative), driven by ambient temp, wind, solar.
- [ ] Dynamic rating shown against the static rating; sag/thermal limit respected.

**Grid context** — see `docs/domain-transmission.md` / `sim/grid.py`
- [ ] Steady-state power flow solved with **pandapower/PyPSA on a published IEEE test case**
      (e.g., IEEE 14/118-bus) so an engineer can verify bus voltages / flows against known
      solutions. Per-unit system used correctly.

**Units & ranges (all assets)**
- [ ] Correct, consistent units everywhere: MW/MVA, kV, A, °C, per-unit, Hz. No unit errors,
      no physically impossible magnitudes.

## Anchor to recognized references

- [ ] Every physical model **names its standard in-product** (tooltip/inspector: "IEEE C57.91
      hot-spot model", "IEEE 738 dynamic rating", "IEEE 118-bus"). Naming the source is the
      difference between engineering and vibes.
- [ ] Definitional standards surfaced in copy: ISO 23247 (synchronization), DTC ("specified
      frequency and fidelity").
- [ ] Cost/economic parameters are documented in the domain docs (adjust there, not in code),
      with sourced reasoning.

## Digital-twin discipline (not a dashboard)

- [ ] Models are **physics-based (or physics-informed hybrid)**, matching the GE/Siemens/NVIDIA
      "physics first, AI second" pattern.
- [ ] **Bidirectional**: the twin ingests scenario/telemetry AND the agent proposes
      interventions that change asset operation, closing the loop.
- [ ] The **twinning rate** (sim/sync frequency) is stated in the UI or docs.
- [ ] Unreal renders **only** state derived from the simulation core — never locally invented
      physics.

## V&V and uncertainty (the trust layer)

- [ ] At least one **validation view**: model output vs a reference (textbook curve / IEEE
      published solution / recorded ground truth) with residuals.
- [ ] Automated **validation tests**: transformer thermal vs C57.91 worked example; line rating
      vs IEEE 738; power flow vs IEEE test-case solution. These live in `backend/tests/`.
- [ ] Every projected limit/failure window is a **range with probability**, never a single
      fake-precise timestamp. Confidence bands shown on trajectories.

## Agent credibility (see `docs/agent-design.md`)

- [ ] Agent reports **only tool-returned twin-state values** — zero invented numbers.
- [ ] Recommendations show **engineering judgment**: quantified, ranked trade-offs (cost vs
      risk vs asset-life vs served load), respect for operating limits, and **traceability**
      back to the readings and computations that drove them.
- [ ] Cross-asset reasoning is coherent (e.g., "dispatch BESS to hold transformer hot-spot
      below X, but line rating caps export at Y, so...").

## Anti-tells — every one of these must be FALSE

- [ ] No `random.gauss`/white noise masquerading as a physical signal.
- [ ] No fake-precise single-point failure predictions.
- [ ] No power-flow, thermal, or rating numbers that violate the governing equations.
- [ ] No unit errors or physically impossible magnitudes.
- [ ] No Unreal visual realism presented as if it were model fidelity.
- [ ] No agent number without a traceable tool output behind it.
- [ ] No "digital twin" that is actually a one-way telemetry mirror with no model or sync.
- [ ] No number anywhere without a named model or standard behind it.

## Sign-off

A phase is not "done" until: the physics-validation tests pass, the anti-tells are all false,
and the demo has been watched end-to-end over Pixel Streaming (not just the local console).
Read the agent's output aloud — would a substation engineer roll their eyes? If yes, fix it.
