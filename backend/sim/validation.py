"""V&V report: model output checked against named references, with residuals.

This is the trust layer required by docs/credibility-checklist.md. It separates
the two questions an engineer actually asks:

- **Verification** (does the code solve the math right?): the Euler-integrated
  thermal model is run to equilibrium and compared against the closed-form
  IEEE C57.91 Clause 7 solution at the same load. Residuals are integrator
  error and should be small.
- **Validation** (does the math match the reference?): the model's exact
  Arrhenius aging factor is compared against the familiar "6 degC rule"
  approximation from C57.91 Annex A, and the rated design point is checked
  against the standard's 110 degC normal-life basis.

Reporting the 6 degC residual honestly is the point: the rule of thumb is the
approximation, the Arrhenius equation is authoritative, and the divergence is
visible rather than hidden.
"""

from __future__ import annotations

from functools import lru_cache

from pydantic import BaseModel

from sim.transformer import (
    COOLING_STAGE_PARAMS,
    HOTSPOT_REFERENCE_C,
    CoolingStage,
    TransformerThermalModel,
    aging_acceleration_factor,
)

# --- C57.91 normal-life design point: 30 degC ambient + 80 degC total rise.
DESIGN_POINT_AMBIENT_C: float = 30.0

# --- Load ratios swept for the thermal verification curve.
LOAD_RATIO_SWEEP: tuple[float, ...] = (0.4, 0.6, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4)

# --- Integrator settle: tau_TO is ~3 h (ONAN), so 24 h is ~8 time constants.
SETTLE_HOURS: float = 24.0
SETTLE_DT_HOURS: float = 0.01

# --- Hot-spot range over which the aging models are compared.
AGING_SWEEP_START_C: float = 95.0
AGING_SWEEP_END_C: float = 140.0
AGING_SWEEP_STEP_C: float = 2.5

# The "6 degC rule": aging doubles per 6 degC over the 110 degC reference.
SIX_DEGREE_RULE_INTERVAL_C: float = 6.0


class ThermalVerificationPoint(BaseModel):
    """One load point: integrated model vs the closed-form C57.91 solution."""

    loading_k: float
    model_hot_spot_c: float
    reference_hot_spot_c: float
    residual_c: float


class AgingValidationPoint(BaseModel):
    """One hot-spot point: exact Arrhenius F_AA vs the 6 degC rule of thumb."""

    hot_spot_c: float
    model_faa: float
    six_degree_rule_faa: float
    residual: float


class DesignPointCheck(BaseModel):
    """The C57.91 rated-point identity the whole thermal model must satisfy."""

    ambient_c: float
    loading_k: float
    model_hot_spot_c: float
    reference_hot_spot_c: float
    model_faa: float
    reference_faa: float
    passes: bool


class ValidationReport(BaseModel):
    """Everything the console's validation view renders."""

    thermal_verification: list[ThermalVerificationPoint]
    thermal_max_abs_residual_c: float
    aging_validation: list[AgingValidationPoint]
    design_point: DesignPointCheck
    thermal_reference: str = "IEEE C57.91 Clause 7 closed-form steady state"
    aging_reference: str = "IEEE C57.91 Annex A 6 degC rule (approximation)"


def six_degree_rule_faa(hot_spot_c: float) -> float:
    """The rule-of-thumb aging factor: 2^((theta_H - 110) / 6)."""
    return 2.0 ** ((hot_spot_c - HOTSPOT_REFERENCE_C) / SIX_DEGREE_RULE_INTERVAL_C)


def _settled_hot_spot_c(load_mva: float, ambient_c: float, stage: CoolingStage) -> float:
    """Integrate the thermal model to equilibrium and return its hot-spot."""
    model = TransformerThermalModel(ambient_c=ambient_c, cooling_stage=stage)
    hot_spot = ambient_c
    for _ in range(int(SETTLE_HOURS / SETTLE_DT_HOURS)):
        hot_spot = model.step(SETTLE_DT_HOURS, load_mva, ambient_c).hotspot_c
    return hot_spot


def _thermal_verification(stage: CoolingStage) -> list[ThermalVerificationPoint]:
    rated_mva = COOLING_STAGE_PARAMS[stage].rated_mva
    reference_model = TransformerThermalModel(cooling_stage=stage)
    points: list[ThermalVerificationPoint] = []
    for k in LOAD_RATIO_SWEEP:
        load_mva = k * rated_mva
        model_c = _settled_hot_spot_c(load_mva, DESIGN_POINT_AMBIENT_C, stage)
        reference_c = reference_model.steady_state(load_mva, DESIGN_POINT_AMBIENT_C, stage).hotspot_c
        points.append(
            ThermalVerificationPoint(
                loading_k=k,
                model_hot_spot_c=model_c,
                reference_hot_spot_c=reference_c,
                residual_c=model_c - reference_c,
            )
        )
    return points


def _aging_validation() -> list[AgingValidationPoint]:
    points: list[AgingValidationPoint] = []
    steps = int(round((AGING_SWEEP_END_C - AGING_SWEEP_START_C) / AGING_SWEEP_STEP_C))
    for index in range(steps + 1):
        hot_spot_c = AGING_SWEEP_START_C + index * AGING_SWEEP_STEP_C
        model_faa = aging_acceleration_factor(hot_spot_c)
        rule_faa = six_degree_rule_faa(hot_spot_c)
        points.append(
            AgingValidationPoint(
                hot_spot_c=hot_spot_c,
                model_faa=model_faa,
                six_degree_rule_faa=rule_faa,
                residual=model_faa - rule_faa,
            )
        )
    return points


def _design_point(stage: CoolingStage) -> DesignPointCheck:
    rated_mva = COOLING_STAGE_PARAMS[stage].rated_mva
    model_c = _settled_hot_spot_c(rated_mva, DESIGN_POINT_AMBIENT_C, stage)
    model_faa = aging_acceleration_factor(model_c)
    return DesignPointCheck(
        ambient_c=DESIGN_POINT_AMBIENT_C,
        loading_k=1.0,
        model_hot_spot_c=model_c,
        reference_hot_spot_c=HOTSPOT_REFERENCE_C,
        model_faa=model_faa,
        reference_faa=1.0,
        passes=abs(model_c - HOTSPOT_REFERENCE_C) < 0.5 and abs(model_faa - 1.0) < 0.05,
    )


@lru_cache(maxsize=len(CoolingStage))
def transformer_validation_report(
    stage: CoolingStage = CoolingStage.ONAN,
) -> ValidationReport:
    """Build the V&V report for one cooling stage (cached; inputs are static)."""
    thermal = _thermal_verification(stage)
    return ValidationReport(
        thermal_verification=thermal,
        thermal_max_abs_residual_c=max(abs(p.residual_c) for p in thermal),
        aging_validation=_aging_validation(),
        design_point=_design_point(stage),
    )
