"""The recorded fallback is what a prospect meets when the backend is down.

These hold the two things that matter about it: it opens with visible motion
rather than a frozen dashboard, and it still shows the whole physical arc
(nominal -> critical -> relief under OFAF) that makes the fallback worth
showing at all.
"""

from __future__ import annotations

from typing import Any

import pytest

from sim.record import (
    OPENING_MOTION_BUDGET_S,
    TWINNING_RATE_HZ,
    VISIBLE_DELTA_C,
    capture,
    opening_dead_air_seconds,
)


@pytest.fixture(scope="module")
def recording() -> dict[str, Any]:
    return capture()


@pytest.fixture(scope="module")
def frames(recording: dict[str, Any]) -> list[dict[str, Any]]:
    return recording["frames"]


def test_opens_with_visible_motion(frames: list[dict[str, Any]]) -> None:
    """No dead air at the top: the twin must be seen to move, quickly.

    The twin is at thermal equilibrium at t=0, so any long opening baseline is
    a scripting choice, not physics -- and it reads as a broken demo.
    """
    dead_air = opening_dead_air_seconds(frames)
    assert dead_air <= OPENING_MOTION_BUDGET_S, (
        f"playback is motionless for {dead_air:.1f} s; budget is "
        f"{OPENING_MOTION_BUDGET_S:.1f} s. Shorten BASELINE_HOURS."
    )


def test_opening_baseline_is_not_skipped_entirely(frames: list[dict[str, Any]]) -> None:
    """A viewer still needs a beat of nominal state to compare the event against."""
    assert opening_dead_air_seconds(frames) > 1.0 / TWINNING_RATE_HZ


def test_arc_reaches_critical_then_recovers(frames: list[dict[str, Any]]) -> None:
    """Shortening the opening must not cost the story the recording exists to tell."""
    statuses = [f["transformer"]["status"] for f in frames]
    assert statuses[0] == "nominal"
    assert "critical" in statuses

    peak_index = max(range(len(frames)), key=lambda i: frames[i]["transformer"]["hot_spot_c"])
    peak = frames[peak_index]["transformer"]["hot_spot_c"]
    final = frames[-1]["transformer"]["hot_spot_c"]
    assert peak > 120.0, f"peak hot-spot {peak:.1f} C never enters the critical band"
    assert final < peak - VISIBLE_DELTA_C, "playback ends without showing the intervention working"
    assert frames[-1]["transformer"]["cooling_stage"] == "OFAF"


def test_sim_time_is_monotonic(frames: list[dict[str, Any]]) -> None:
    """Playback maps frame index to sim time, so a stall or jump would mislead."""
    times = [f["sim_time_hours"] for f in frames]
    assert all(b > a for a, b in zip(times, times[1:]))


def test_projections_carry_uncertainty(recording: dict[str, Any]) -> None:
    """The fallback must not quietly drop the confidence bands the live path shows."""
    assert recording["projections"]
    for entry in recording["projections"]:
        projection = entry["projection"]
        low = projection["ci95_low_c"]
        high = projection["ci95_high_c"]
        assert len(low) == len(high) == len(projection["expected_c"]) > 0
        assert all(lo <= hi for lo, hi in zip(low, high))
        # The band opens with horizon: a flat band would mean the uncertainty
        # was dropped somewhere in the capture.
        assert (high[-1] - low[-1]) > (high[0] - low[0])
