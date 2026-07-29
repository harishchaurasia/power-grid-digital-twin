"""Forward hot-spot projection with a forecast-uncertainty band.

Every projected limit window is a range with a confidence interval, never a
fake-precise timestamp (docs/credibility-checklist.md, V&V + UQ). The band here
is *aleatoric*: it comes from propagating weather- and load-forecast uncertainty
through the same IEEE C57.91 model that produces live telemetry. It is input
uncertainty carried through the physics -- not noise added to a signal.

C57.91 hot-spot is monotonically increasing in both ambient temperature and load
ratio, so evaluating the model at the forecast quantile corners bounds the
trajectory exactly. No sampling is used and the band is a deterministic function
of twin state, which keeps the render reproducible.

Forecast error grows with lead time, so sigma follows the standard random-walk
growth law sigma(t) = sigma_ref * sqrt(t / t_ref): at t = 0 present conditions
are known and the band is closed.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from typing import Protocol

from pydantic import BaseModel

from sim.transformer import TransformerThermalModel

# --- Hot-spot limit under evaluation: the critical band in docs/domain-transformer.md.
HOT_SPOT_LIMIT_C: float = 120.0

# --- Forecast-error scale at the reference lead time. Ambient sigma is the
# --- order of a day-ahead 2 m air-temperature forecast error; load sigma is the
# --- order of an hours-ahead substation load-forecast MAPE. Adjust here.
FORECAST_REFERENCE_LEAD_HOURS: float = 6.0
AMBIENT_FORECAST_SIGMA_REF_C: float = 2.0
LOAD_FORECAST_SIGMA_REF_FRACTION: float = 0.03

# Two-sided 95% normal quantile.
Z_SCORE_95: float = 1.959964

DEFAULT_PROJECTION_DT_HOURS: float = 0.05


class ConfidenceWindow(BaseModel):
    """A time window expressed as an expected value plus a 95% interval.

    Any bound is None when that corner of the forecast never reaches the limit
    inside the projection horizon -- reported as unknown rather than guessed.

    When the limit is *already* exceeded, `already_breached` is set and the
    bounds are None. Reporting "0.1 h (95% CI 0.1-0.1)" for a limit that has
    been passed would be a fake-precise window, which the credibility checklist
    rules out; the honest statement is that the limit is breached now.
    """

    expected_hours: float | None
    ci95_low_hours: float | None
    ci95_high_hours: float | None
    already_breached: bool = False


class HotSpotProjection(BaseModel):
    """Projected hot-spot trajectory with its 95% forecast-uncertainty band."""

    horizon_hours: float
    dt_hours: float
    time_hours: list[float]
    expected_c: list[float]
    ci95_low_c: list[float]
    ci95_high_c: list[float]
    limit_c: float = HOT_SPOT_LIMIT_C
    time_to_limit: ConfidenceWindow
    model_standard: str = "IEEE C57.91"
    uncertainty_basis: str = "weather + load forecast error propagated through C57.91"


class SetpointLike(Protocol):
    """Load and ambient the projection assumes at a lead time.

    Structural so the scenario driver satisfies it without either module
    importing the other.
    """

    @property
    def load_mva(self) -> float: ...

    @property
    def ambient_c(self) -> float: ...


SetpointAt = Callable[[float], SetpointLike]


def forecast_sigma(lead_hours: float) -> tuple[float, float]:
    """Ambient (degC) and fractional load forecast sigma at a lead time."""
    growth = math.sqrt(max(lead_hours, 0.0) / FORECAST_REFERENCE_LEAD_HOURS)
    return AMBIENT_FORECAST_SIGMA_REF_C * growth, LOAD_FORECAST_SIGMA_REF_FRACTION * growth


def _run_corner(
    transformer: TransformerThermalModel,
    setpoint_at: SetpointAt,
    horizon_hours: float,
    dt_hours: float,
    z: float,
) -> list[float]:
    """Integrate one forecast corner forward; z scales the sigma in both inputs."""
    model = transformer.clone()
    trajectory: list[float] = []
    steps = max(1, int(round(horizon_hours / dt_hours)))
    for step in range(1, steps + 1):
        lead = step * dt_hours
        sigma_ambient_c, sigma_load_fraction = forecast_sigma(lead)
        nominal = setpoint_at(lead)
        state = model.step(
            dt_hours=dt_hours,
            load_mva=nominal.load_mva * (1.0 + z * sigma_load_fraction),
            ambient_c=nominal.ambient_c + z * sigma_ambient_c,
        )
        trajectory.append(state.hotspot_c)
    return trajectory


def _first_crossing_hours(
    trajectory: list[float], dt_hours: float, limit_c: float
) -> float | None:
    """Lead time at which a trajectory first reaches the limit, else None."""
    for index, value in enumerate(trajectory):
        if value >= limit_c:
            return (index + 1) * dt_hours
    return None


def project_hot_spot(
    transformer: TransformerThermalModel,
    setpoint_at: SetpointAt,
    horizon_hours: float,
    dt_hours: float = DEFAULT_PROJECTION_DT_HOURS,
    limit_c: float = HOT_SPOT_LIMIT_C,
) -> HotSpotProjection:
    """Project hot-spot forward from live twin state with a 95% forecast band.

    The hot corner (+z) bounds the earliest limit crossing and the cool corner
    (-z) the latest, which is why the CI is assembled from them in that order.
    """
    expected = _run_corner(transformer, setpoint_at, horizon_hours, dt_hours, z=0.0)
    hot = _run_corner(transformer, setpoint_at, horizon_hours, dt_hours, z=Z_SCORE_95)
    cool = _run_corner(transformer, setpoint_at, horizon_hours, dt_hours, z=-Z_SCORE_95)

    # Present hot-spot, before any projected step, decides breached-vs-pending.
    present_c = transformer.clone().step(
        dt_hours=0.0,
        load_mva=setpoint_at(0.0).load_mva,
        ambient_c=setpoint_at(0.0).ambient_c,
    ).hotspot_c

    if present_c >= limit_c:
        window = ConfidenceWindow(
            expected_hours=None,
            ci95_low_hours=None,
            ci95_high_hours=None,
            already_breached=True,
        )
    else:
        window = ConfidenceWindow(
            expected_hours=_first_crossing_hours(expected, dt_hours, limit_c),
            ci95_low_hours=_first_crossing_hours(hot, dt_hours, limit_c),
            ci95_high_hours=_first_crossing_hours(cool, dt_hours, limit_c),
        )

    return HotSpotProjection(
        horizon_hours=horizon_hours,
        dt_hours=dt_hours,
        time_hours=[(i + 1) * dt_hours for i in range(len(expected))],
        expected_c=expected,
        ci95_low_c=cool,
        ci95_high_c=hot,
        limit_c=limit_c,
        time_to_limit=window,
    )
