"""Intervention economics: what each option is worth, and what it costs.

The ranked, costed trade-off is the differentiator (RESEARCH-LOG Agent C) --
incumbent dashboards show the temperature, not the decision. So these numbers
carry the same burden as the physics: every constant cites its source, and the
agent reports what this module computes rather than estimating anything itself.

Cost parameters are documented in docs/domain-transformer.md ("Intervention
costs") and adjusted here, not in agent code. Where the domain doc gives
guidance rather than a figure, the value chosen is marked ASSUMED with its
basis -- an assumption stated plainly is honest; one buried in code is not.
"""

from __future__ import annotations

import math

from pydantic import BaseModel

from sim.transformer import (
    NORMAL_INSULATION_LIFE_HOURS,
    aging_acceleration_factor,
)

# --- Asset replacement (docs/domain-transformer.md; RESEARCH-LOG Agent A).
# Prices +77% since 2019; lead time ~128 weeks, so there is effectively no spare.
LPT_REPLACEMENT_USD: float = 1_400_000.0
LPT_LEAD_TIME_WEEKS: int = 128

# Insulation life is the asset's real consumable. Spreading replacement cost over
# the C57.91 normal-life basis gives the marginal cost of an hour of life.
LIFE_COST_USD_PER_EQUIVALENT_HOUR: float = LPT_REPLACEMENT_USD / NORMAL_INSULATION_LIFE_HOURS

# --- Energy value. ASSUMED: peak wholesale energy price for a summer peak in a
# data-centre-heavy zone. Directional, not a market quote.
PEAK_ENERGY_PRICE_USD_PER_MWH: float = 180.0

# --- Value of lost load. ASSUMED: commercial/industrial VOLL. Data-centre load
# sits at the high end of published ranges, hence the upper-single-digit
# thousands rather than the ~$1-3k used for residential.
VALUE_OF_LOST_LOAD_USD_PER_MWH: float = 9_000.0

# --- Cooling auxiliary power. ASSUMED from typical fan/pump ratings for a unit
# of this size; charged at the same energy price as served load.
COOLING_AUX_LOAD_MW: dict[str, float] = {"ONAN": 0.0, "ONAF": 0.06, "OFAF": 0.15}
# Fan/pump wear, amortised per hour of running. ASSUMED.
COOLING_WEAR_USD_PER_HOUR: dict[str, float] = {"ONAN": 0.0, "ONAF": 1.5, "OFAF": 4.0}

# --- Failure risk.
# Consequence: replacement plus the outage across a ~128-week lead time. The
# outage term dominates and is the tail risk the agent protects against.
FAILURE_CONSEQUENCE_USD: float = 12_000_000.0
# Hazard model: failure probability per hour rises with hot-spot on the same
# Arrhenius basis as insulation aging, anchored so that sustained operation at
# the 140 degC emergency band carries a materially non-zero hourly hazard.
# ASSUMED anchor -- a demo-scale calibration, deliberately simple and labelled.
FAILURE_HAZARD_AT_140C_PER_HOUR: float = 2.0e-4
_HAZARD_ANCHOR_C: float = 140.0

#: Fraction of node load that may be shed without breaching the data-centre
#: contract. ASSUMED.
SHEDDABLE_LOAD_FRACTION: float = 0.15


class InterventionEconomics(BaseModel):
    """Costed outcome of one plan over the horizon. All figures USD."""

    served_load_value_usd: float
    transformer_life_cost_usd: float
    cooling_cost_usd: float
    curtailment_cost_usd: float
    failure_risk_cost_usd: float
    net_value_usd: float
    equivalent_life_consumed_hours: float
    served_mwh: float
    unserved_mwh: float
    basis: str = "docs/domain-transformer.md — Intervention costs"


def failure_hazard_per_hour(hot_spot_c: float) -> float:
    """Hourly probability of failure at a given hot-spot.

    Scaled from the C57.91 aging-acceleration factor so failure risk and
    insulation aging share one temperature dependence, anchored at 140 degC.
    Simplified and demo-scale -- stated so it is not mistaken for a calibrated
    reliability model.
    """
    anchor = aging_acceleration_factor(_HAZARD_ANCHOR_C)
    return FAILURE_HAZARD_AT_140C_PER_HOUR * (aging_acceleration_factor(hot_spot_c) / anchor)


def evaluate(
    hot_spot_trajectory_c: list[float],
    served_mva_trajectory: list[float],
    offered_mva_trajectory: list[float],
    cooling_stage: str,
    dt_hours: float,
) -> InterventionEconomics:
    """Cost a plan from its simulated trajectory.

    Takes trajectories the twin produced rather than a summary, so life consumed
    and failure risk integrate the actual temperature path instead of being
    estimated from an endpoint.
    """
    life_hours = 0.0
    survival = 1.0
    served_mwh = 0.0
    unserved_mwh = 0.0

    for hot_spot_c, served, offered in zip(
        hot_spot_trajectory_c, served_mva_trajectory, offered_mva_trajectory
    ):
        life_hours += aging_acceleration_factor(hot_spot_c) * dt_hours
        survival *= math.exp(-failure_hazard_per_hour(hot_spot_c) * dt_hours)
        served_mwh += served * dt_hours
        unserved_mwh += max(0.0, offered - served) * dt_hours

    hours = len(hot_spot_trajectory_c) * dt_hours
    aux_mwh = COOLING_AUX_LOAD_MW.get(cooling_stage, 0.0) * hours
    cooling_cost = (
        aux_mwh * PEAK_ENERGY_PRICE_USD_PER_MWH
        + COOLING_WEAR_USD_PER_HOUR.get(cooling_stage, 0.0) * hours
    )

    served_value = served_mwh * PEAK_ENERGY_PRICE_USD_PER_MWH
    life_cost = life_hours * LIFE_COST_USD_PER_EQUIVALENT_HOUR
    curtailment_cost = unserved_mwh * VALUE_OF_LOST_LOAD_USD_PER_MWH
    failure_cost = (1.0 - survival) * FAILURE_CONSEQUENCE_USD

    return InterventionEconomics(
        served_load_value_usd=round(served_value, 2),
        transformer_life_cost_usd=round(life_cost, 2),
        cooling_cost_usd=round(cooling_cost, 2),
        curtailment_cost_usd=round(curtailment_cost, 2),
        failure_risk_cost_usd=round(failure_cost, 2),
        net_value_usd=round(
            served_value - life_cost - cooling_cost - curtailment_cost - failure_cost, 2
        ),
        equivalent_life_consumed_hours=round(life_hours, 3),
        served_mwh=round(served_mwh, 2),
        unserved_mwh=round(unserved_mwh, 2),
    )
