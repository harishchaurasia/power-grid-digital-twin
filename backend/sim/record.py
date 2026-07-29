"""Capture a scenario run to static JSON for the console's offline fallback.

docs/architecture.md requires the demo never hard-fail: with the backend or GPU
host unreachable, the console falls back to recorded playback. Recording the
*real* simulation rather than hand-writing a fixture means the fallback shows
the same C57.91 physics as the live path -- a fabricated fixture would be a
credibility hole hiding inside the safety net.

Run with `make record`.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from sim.scenario import Simulation
from sim.transformer import CoolingStage
from sim.validation import transformer_validation_report

#: Matches the live tick in api/ws_console.py so playback runs at demo pace.
SIM_HOURS_PER_TICK = 0.02
TWINNING_RATE_HZ = 10.0

#: Scripted beats, in sim-hours: settle, event, then the operator intervention.
SETTLE_HOURS = 1.2
TRIGGER_AT_HOURS = 1.2
INTERVENE_AT_HOURS = 5.6
INTERVENE_STAGE = CoolingStage.OFAF
TOTAL_HOURS = 9.0

PROJECTION_EVERY_HOURS = 0.5
PROJECTION_HORIZON_HOURS = 6.0

OUTPUT_PATH = Path(__file__).resolve().parents[2] / "console/public/recorded/scenario.json"


def capture() -> dict[str, Any]:
    """Run the scripted scenario and collect everything the console renders."""
    sim = Simulation()
    frames: list[dict[str, Any]] = []
    projections: list[dict[str, Any]] = []

    triggered = False
    intervened = False
    next_projection_at = 0.0
    elapsed = 0.0

    while elapsed < TOTAL_HOURS:
        if not triggered and elapsed >= TRIGGER_AT_HOURS:
            sim.trigger_scenario()
            triggered = True
        if not intervened and elapsed >= INTERVENE_AT_HOURS:
            sim.set_cooling_stage(INTERVENE_STAGE)
            intervened = True

        snapshot = sim.tick(SIM_HOURS_PER_TICK)
        elapsed = snapshot.sim_time_hours
        frames.append(snapshot.model_dump(mode="json"))

        if elapsed >= next_projection_at:
            projections.append(
                {
                    "sim_time_hours": round(elapsed, 4),
                    "projection": sim.project(
                        horizon_hours=PROJECTION_HORIZON_HOURS
                    ).model_dump(mode="json"),
                }
            )
            next_projection_at = elapsed + PROJECTION_EVERY_HOURS

    return {
        "version": 1,
        "generated_by": "make record",
        "note": (
            "Recorded from the live IEEE C57.91 simulation, not hand-written. "
            "Played back when the backend is unreachable."
        ),
        "twinning_rate_hz": TWINNING_RATE_HZ,
        "sim_hours_per_frame": SIM_HOURS_PER_TICK,
        "script": {
            "trigger_at_hours": TRIGGER_AT_HOURS,
            "intervene_at_hours": INTERVENE_AT_HOURS,
            "intervene_stage": INTERVENE_STAGE.value,
        },
        "frames": frames,
        "projections": projections,
        # Static for a cooling stage, so one copy covers the whole playback.
        "validation": transformer_validation_report(CoolingStage.ONAN).model_dump(mode="json"),
    }


def main() -> None:
    data = capture()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(data, separators=(",", ":")))

    peak = max(f["transformer"]["hot_spot_c"] for f in data["frames"])
    size_kb = OUTPUT_PATH.stat().st_size / 1024
    print(f"wrote {OUTPUT_PATH.relative_to(Path.cwd().parent)}  ({size_kb:.0f} kB)")
    print(f"  frames      : {len(data['frames'])}")
    print(f"  projections : {len(data['projections'])}")
    print(f"  peak hot-spot: {peak:.1f} degC")


if __name__ == "__main__":
    main()
