"""Large Power Transformer thermal + insulation-aging model.

Physics follows IEEE Std C57.91 (Guide for Loading Mineral-Oil-Immersed
Transformers), Clause 7 (top-oil + hot-spot thermal model) and Annex A
(insulation aging / the 6 degC rule). See docs/domain-transformer.md.

Every constant cites its source. Load ratio K and ambient temperature are
inputs; hot-spot temperature is a derived state with thermal inertia (it lags
load via the oil and winding time constants) -- it is never an instantaneous
function of load.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum

# --- Rated thermal parameters (IEEE C57.91, Table; 65 degC-rise thermally
# --- upgraded insulation). See docs/domain-transformer.md.
TOP_OIL_RISE_RATED_C: float = 55.0  # DELTA_TO,R: top-oil rise over ambient at rated load
HOTSPOT_RISE_OVER_TOP_OIL_RATED_C: float = 25.0  # DELTA_(H/TO),R: hot-spot rise over top-oil at rated
LOSS_RATIO_R: float = 8.0  # R: ratio of load loss (rated) to no-load loss
WINDING_EXPONENT_M: float = 0.8  # m: winding exponent
WINDING_TIME_CONSTANT_H: float = 7.0 / 60.0  # tau_W ~7 min, expressed in hours

# --- Insulation aging (IEEE C57.91 Annex A, 65 degC-rise insulation).
# F_AA = exp( B/(theta_ref+273) - B/(theta_H+273) ), B = 15000, theta_ref = 110 degC.
AGING_CONSTANT_B: float = 15000.0  # C57.91 Annex A activation constant (65 degC-rise)
HOTSPOT_REFERENCE_C: float = 110.0  # reference hot-spot for normal (F_AA = 1) aging
KELVIN_OFFSET: float = 273.0
# theta_ref + 273 = 383 K; precomputed so F_AA(110 degC) == 1.0 exactly.
_REFERENCE_KELVIN: float = HOTSPOT_REFERENCE_C + KELVIN_OFFSET

# Normal insulation life basis (C57.91 Annex; 180 000 h ~ 20.55 yr).
NORMAL_INSULATION_LIFE_HOURS: float = 180_000.0


class CoolingStage(str, Enum):
    """Cooling stages, the transformer's primary thermal lever.

    Engaging a stage raises the rated MVA (so K falls for the same load) and,
    for forced cooling, drives the oil exponent toward 1.0 and shortens the
    top-oil time constant. See docs/domain-transformer.md, "Cooling stages".
    """

    ONAN = "ONAN"  # oil natural, air natural
    ONAF = "ONAF"  # + fans
    OFAF = "OFAF"  # + oil pumps + fans


@dataclass(frozen=True)
class CoolingStageParams:
    """Per-stage rated capacity and thermal coefficients (C57.91)."""

    rated_mva: float
    oil_exponent_n: float  # n: oil exponent (0.8 ONAN -> 1.0 forced)
    top_oil_time_constant_h: float  # tau_TO


# ONAN/ONAF/OFAF ratings for the reference 150/200/250 MVA unit.
# n and tau_TO per C57.91 guidance (natural -> forced cooling).
COOLING_STAGE_PARAMS: dict[CoolingStage, CoolingStageParams] = {
    CoolingStage.ONAN: CoolingStageParams(rated_mva=150.0, oil_exponent_n=0.8, top_oil_time_constant_h=3.0),
    CoolingStage.ONAF: CoolingStageParams(rated_mva=200.0, oil_exponent_n=0.9, top_oil_time_constant_h=2.0),
    CoolingStage.OFAF: CoolingStageParams(rated_mva=250.0, oil_exponent_n=1.0, top_oil_time_constant_h=1.25),
}


def ultimate_top_oil_rise_c(load_ratio_k: float, oil_exponent_n: float) -> float:
    """Ultimate (steady-state) top-oil rise over ambient at load ratio K.

    C57.91 Clause 7:  DELTA_TO,ult = DELTA_TO,R * [ (K^2 * R + 1) / (R + 1) ]^n
    """
    numerator = load_ratio_k**2 * LOSS_RATIO_R + 1.0
    return TOP_OIL_RISE_RATED_C * (numerator / (LOSS_RATIO_R + 1.0)) ** oil_exponent_n


def ultimate_hotspot_rise_over_top_oil_c(load_ratio_k: float) -> float:
    """Ultimate hot-spot rise over top-oil at load ratio K.

    C57.91 Clause 7:  DELTA_H,ult = DELTA_(H/TO),R * K^(2m)
    """
    return HOTSPOT_RISE_OVER_TOP_OIL_RATED_C * load_ratio_k ** (2.0 * WINDING_EXPONENT_M)


def aging_acceleration_factor(hotspot_c: float) -> float:
    """Insulation aging acceleration factor F_AA (C57.91 Annex A).

    F_AA = exp( B/(theta_ref+273) - B/(theta_H+273) ).
    F_AA(110 degC) = 1.0 (normal aging). The "6 degC rule" is the rule-of-thumb
    that F_AA roughly doubles per ~6-7 degC over the reference; this exact
    Arrhenius form is authoritative (doubling occurs at ~6.9 degC).
    """
    return _exp(AGING_CONSTANT_B / _REFERENCE_KELVIN - AGING_CONSTANT_B / (hotspot_c + KELVIN_OFFSET))


def _exp(x: float) -> float:
    # Local import kept off the hot module top-level; math.exp is exact enough.
    from math import exp

    return exp(x)


@dataclass
class TransformerState:
    """Derived thermal state of the transformer at a point in time."""

    top_oil_c: float
    hotspot_c: float
    load_ratio_k: float
    aging_factor_faa: float
    cooling_stage: CoolingStage
    cumulative_loss_of_life_hours: float


@dataclass
class TransformerThermalModel:
    """Stateful C57.91 thermal model integrated with an explicit Euler step.

    State variables: top-oil temperature and hot-spot rise over top-oil. Both
    relax toward their ultimate values with their respective time constants, so
    a step in load does not instantly move the hot-spot.
    """

    ambient_c: float = 30.0
    cooling_stage: CoolingStage = CoolingStage.ONAN
    _top_oil_c: float = field(init=False)
    _hotspot_rise_c: float = field(init=False)
    _cumulative_lol_hours: float = field(default=0.0, init=False)

    def __post_init__(self) -> None:
        # Initialize at thermal equilibrium for zero load (no self-heating).
        self._top_oil_c = self.ambient_c
        self._hotspot_rise_c = 0.0

    def load_ratio(self, load_mva: float, cooling_stage: CoolingStage | None = None) -> float:
        stage = cooling_stage or self.cooling_stage
        return load_mva / COOLING_STAGE_PARAMS[stage].rated_mva

    def clone(self) -> TransformerThermalModel:
        """Copy the full thermal state so a what-if run cannot disturb the live twin."""
        other = TransformerThermalModel(ambient_c=self.ambient_c, cooling_stage=self.cooling_stage)
        other._top_oil_c = self._top_oil_c
        other._hotspot_rise_c = self._hotspot_rise_c
        other._cumulative_lol_hours = self._cumulative_lol_hours
        return other

    def step(
        self,
        dt_hours: float,
        load_mva: float,
        ambient_c: float,
        cooling_stage: CoolingStage | None = None,
    ) -> TransformerState:
        """Advance the thermal state by dt_hours under the given load/ambient."""
        if cooling_stage is not None:
            self.cooling_stage = cooling_stage
        self.ambient_c = ambient_c
        params = COOLING_STAGE_PARAMS[self.cooling_stage]
        k = load_mva / params.rated_mva

        top_oil_ult = self.ambient_c + ultimate_top_oil_rise_c(k, params.oil_exponent_n)
        self._top_oil_c += dt_hours * (top_oil_ult - self._top_oil_c) / params.top_oil_time_constant_h

        hotspot_rise_ult = ultimate_hotspot_rise_over_top_oil_c(k)
        self._hotspot_rise_c += (
            dt_hours * (hotspot_rise_ult - self._hotspot_rise_c) / WINDING_TIME_CONSTANT_H
        )

        hotspot_c = self._top_oil_c + self._hotspot_rise_c
        faa = aging_acceleration_factor(hotspot_c)
        self._cumulative_lol_hours += faa * dt_hours

        return TransformerState(
            top_oil_c=self._top_oil_c,
            hotspot_c=hotspot_c,
            load_ratio_k=k,
            aging_factor_faa=faa,
            cooling_stage=self.cooling_stage,
            cumulative_loss_of_life_hours=self._cumulative_lol_hours,
        )

    def steady_state_of_record(self, load_mva: float) -> TransformerState:
        """Report the *currently integrated* state without advancing it.

        Distinct from `steady_state`, which is the analytic equilibrium: this is
        where the model actually is right now, for reads that must not mutate.
        """
        params = COOLING_STAGE_PARAMS[self.cooling_stage]
        hotspot_c = self._top_oil_c + self._hotspot_rise_c
        return TransformerState(
            top_oil_c=self._top_oil_c,
            hotspot_c=hotspot_c,
            load_ratio_k=load_mva / params.rated_mva,
            aging_factor_faa=aging_acceleration_factor(hotspot_c),
            cooling_stage=self.cooling_stage,
            cumulative_loss_of_life_hours=self._cumulative_lol_hours,
        )

    def steady_state(
        self, load_mva: float, ambient_c: float, cooling_stage: CoolingStage | None = None
    ) -> TransformerState:
        """Analytic thermal equilibrium (t -> infinity) at fixed load/ambient.

        Used for validation against C57.91 worked values and as a fast headroom
        probe; bypasses time-constant integration.
        """
        stage = cooling_stage or self.cooling_stage
        params = COOLING_STAGE_PARAMS[stage]
        k = load_mva / params.rated_mva
        top_oil_c = ambient_c + ultimate_top_oil_rise_c(k, params.oil_exponent_n)
        hotspot_c = top_oil_c + ultimate_hotspot_rise_over_top_oil_c(k)
        return TransformerState(
            top_oil_c=top_oil_c,
            hotspot_c=hotspot_c,
            load_ratio_k=k,
            aging_factor_faa=aging_acceleration_factor(hotspot_c),
            cooling_stage=stage,
            cumulative_loss_of_life_hours=self._cumulative_lol_hours,
        )
