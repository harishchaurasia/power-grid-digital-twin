"""Arrivals decide WHICH event and WHEN -- never the value of a signal."""

from __future__ import annotations

from sim.arrivals import SHIFT_REPRESENTS_HOURS, SHIFT_SIM_HOURS, plan_shift


def test_same_seed_gives_an_identical_shift() -> None:
    """An unreproducible demo failure is an unfixable one."""
    a = plan_shift(seed=4718)
    b = plan_shift(seed=4718)
    assert [(x.at_sim_hours, x.spec.id, x.severity) for x in a] == [
        (y.at_sim_hours, y.spec.id, y.severity) for y in b
    ]


def test_different_seeds_diverge() -> None:
    seeds = [plan_shift(seed=s) for s in range(40)]
    signatures = {tuple((a.spec.id, round(a.at_sim_hours, 3)) for a in shift) for shift in seeds}
    assert len(signatures) > 1


def test_a_quiet_shift_is_reachable() -> None:
    """A twin that always produces drama is a slideshow, not a twin."""
    assert any(plan_shift(seed=s) == [] for s in range(200))


def test_arrivals_land_inside_the_shift_and_in_order() -> None:
    for seed in range(30):
        arrivals = plan_shift(seed=seed)
        times = [a.at_sim_hours for a in arrivals]
        assert times == sorted(times)
        assert all(0.0 <= t <= SHIFT_SIM_HOURS for t in times)


def test_severity_stays_inside_each_scenario_range() -> None:
    for seed in range(60):
        for arrival in plan_shift(seed=seed):
            low, high = arrival.spec.severity_range
            assert low <= arrival.severity <= high


def test_heat_waves_dominate_the_draw() -> None:
    """Rates must actually govern frequency, or the sourcing is decoration."""
    counts: dict[str, int] = {}
    for seed in range(400):
        for arrival in plan_shift(seed=seed):
            counts[arrival.spec.id] = counts.get(arrival.spec.id, 0) + 1
    assert counts.get("heatwave_load_spike", 0) > counts.get("cooling_bank_failure", 0)


def test_time_compression_is_explicit() -> None:
    """The shift is compressed; the underlying rates are not inflated."""
    assert SHIFT_REPRESENTS_HOURS > SHIFT_SIM_HOURS
