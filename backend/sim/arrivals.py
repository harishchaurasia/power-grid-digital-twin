"""Seeded event arrivals for a random shift.

The only `random.Random` in the simulation lives here. It decides **which**
scenario occurs, **when**, and **how severe** -- never the value of a telemetry
signal, which always comes from C57.91 applied to the resulting inputs. Noise
standing in for a physical signal is an explicit anti-tell
(docs/credibility-checklist.md).

Given a seed, the schedule is fixed, so a given twin state always renders the
same and any surprising run can be reproduced exactly.

Time compression: at true rates a 0.05/yr event essentially never fires inside a
demo. A shift therefore *plays* SHIFT_SIM_HOURS but *represents*
SHIFT_REPRESENTS_HOURS of operating time, and both are stated in the UI. The
per-year rates are unchanged -- compressing time is honest, inflating a rate
would not be.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

from sim.scenarios import ScenarioSpec, library_entries

HOURS_PER_YEAR: float = 8760.0

#: What one shift plays out in sim time.
SHIFT_SIM_HOURS: float = 12.0
#: What one shift stands for in operating time. Two months, so a ~1.5/yr event
#: appears occasionally and a 0.05/yr event stays genuinely rare.
SHIFT_REPRESENTS_MONTHS: float = 2.0
MONTHS_PER_YEAR: float = 12.0
SHIFT_REPRESENTS_HOURS: float = HOURS_PER_YEAR * SHIFT_REPRESENTS_MONTHS / MONTHS_PER_YEAR


@dataclass(frozen=True)
class Arrival:
    """One scheduled event: which scenario, when in sim time, and how severe."""

    at_sim_hours: float
    spec: ScenarioSpec
    severity: float


def _expected_count(spec: ScenarioSpec) -> float:
    """Expected arrivals of this scenario over the represented window."""
    return spec.rate_per_year * (SHIFT_REPRESENTS_HOURS / HOURS_PER_YEAR)


def _poisson(rng: random.Random, mean: float) -> int:
    """Knuth's product method. Fine here: means are far below 1."""
    limit = math.exp(-mean)
    count, product = 0, rng.random()
    while product > limit:
        count += 1
        product *= rng.random()
    return count


def plan_shift(seed: int, sim_hours: float = SHIFT_SIM_HOURS) -> list[Arrival]:
    """The full arrival schedule for one shift, fixed by the seed.

    Scenarios are drawn independently, so a shift may contain none -- which is
    a legitimate outcome, not a failure to be corrected. Severity is always
    drawn from the spec's own `severity_range`, so it is correct by
    construction and needs no separate validation downstream.
    """
    rng = random.Random(seed)
    arrivals: list[Arrival] = []

    for spec in library_entries():
        for _ in range(_poisson(rng, _expected_count(spec))):
            low, high = spec.severity_range
            arrivals.append(
                Arrival(
                    at_sim_hours=rng.uniform(0.0, sim_hours),
                    spec=spec,
                    severity=rng.uniform(low, high),
                )
            )

    arrivals.sort(key=lambda arrival: arrival.at_sim_hours)
    return arrivals
