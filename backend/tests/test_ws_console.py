"""End-to-end smoke test for the console WebSocket wiring."""

from __future__ import annotations

import json

from fastapi.testclient import TestClient

from main import app


def test_console_streams_wellformed_telemetry() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/console") as ws:
            frame = json.loads(ws.receive_text())
            assert frame["type"] == "telemetry"
            t = frame["payload"]["transformer"]
            assert t["model_standard"] == "IEEE C57.91"
            assert t["hot_spot_c"] > 0.0
            assert frame["payload"]["twinning_rate_hz"] == 10.0


def test_console_accepts_intents() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/console") as ws:
            ws.send_text(json.dumps({"type": "trigger_scenario", "scenario": "heatwave_load_spike"}))
            ws.send_text(json.dumps({"type": "apply_intervention", "intervention": "cooling_ofaf"}))
            # A well-formed telemetry frame still flows after accepting intents.
            frame = json.loads(ws.receive_text())
            assert frame["type"] in ("telemetry", "state_change")


def test_console_rejects_malformed_message() -> None:
    with TestClient(app) as client:
        with client.websocket_connect("/ws/console") as ws:
            ws.send_text(json.dumps({"type": "not_a_real_intent"}))
            # Drain frames until the error surfaces (telemetry is also streaming).
            for _ in range(20):
                frame = json.loads(ws.receive_text())
                if frame["type"] == "error":
                    return
            raise AssertionError("expected an error message for malformed input")


def test_scenario_library_is_served_with_its_sources() -> None:
    """The rates are a credibility surface; they must reach the client."""
    with TestClient(app) as client:
        response = client.get("/api/scenarios")
        assert response.status_code == 200
        entries = response.json()

    assert {e["id"] for e in entries} == {
        "heatwave_load_spike",
        "cooling_bank_failure",
        "feeder_pickup_step",
    }
    for entry in entries:
        assert entry["rate_per_year"] > 0
        assert entry["rate_source"]

    cooling = next(e for e in entries if e["id"] == "cooling_bank_failure")
    assert "CIGRE" in cooling["major_failure_rate_source"]


def test_triggering_a_named_scenario_changes_twin_state() -> None:
    with TestClient(app) as client, client.websocket_connect("/ws/console") as ws:
        ws.receive_json()
        ws.send_json({"type": "trigger_scenario", "scenario": "cooling_bank_failure"})
        for _ in range(20):
            message = ws.receive_json()
            if message["type"] == "telemetry" and message["payload"]["scenario"] is not None:
                assert message["payload"]["scenario"]["id"] == "cooling_bank_failure"
                return
    raise AssertionError("no telemetry reported the triggered scenario")


def test_random_shift_reports_its_seed() -> None:
    """A run nobody can reproduce is a run nobody can debug.

    Seed 84 (not the brief's 4718): `plan_shift(4718)` deterministically draws
    zero arrivals over the full 12-hour shift under the library's current,
    already-sourced rates (confirmed directly against `sim.arrivals.plan_shift`
    -- see task-5-report.md), so no telemetry could ever carry a scenario for
    that seed. 84's first arrival lands at ~0.05 shift-hours, well inside this
    loop.
    """
    with TestClient(app) as client, client.websocket_connect("/ws/console") as ws:
        ws.receive_json()
        ws.send_json({"type": "start_random_shift", "seed": 84})
        for _ in range(20):
            message = ws.receive_json()
            payload = message.get("payload")
            if message["type"] == "telemetry" and payload and payload["scenario"]:
                assert payload["scenario"]["seed"] == 84
                return
    raise AssertionError("no telemetry reported a seeded shift")
