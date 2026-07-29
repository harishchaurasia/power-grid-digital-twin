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
