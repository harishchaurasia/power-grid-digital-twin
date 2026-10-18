"""Console WebSocket: streams twin telemetry and accepts scenario/intervention intents.

A single shared Simulation represents the one substation node (scope: one node,
per docs/CLAUDE.md). The manager advances it at the twinning rate in a background
task and broadcasts each snapshot to every connected console.
"""

from __future__ import annotations

import asyncio
import contextlib
import random
import time

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import TypeAdapter, ValidationError

from agent.loop import run_agent
from agent.provider import resolve_provider
from agent.tools import TwinTools
from api.schemas import (
    AgentDoneMessage,
    AgentFinalMessage,
    AgentStartedMessage,
    AgentThinkingMessage,
    ClientMessage,
    ErrorMessage,
    StateChangeMessage,
    TelemetryMessage,
    ToolCallMessage,
    ToolResultMessage,
    intervention_to_cooling_stage,
)
from sim.arrivals import Arrival, plan_shift
from sim.scenario import DEFAULT_TWINNING_RATE_HZ, Simulation
from sim.state import AssetStatus, TwinSnapshot

log = structlog.get_logger(__name__)

SIM_HOURS_PER_TICK: float = 0.02  # sim-time acceleration: ~6 sim-hours in 30 wall-seconds
#: Upper bound for a server-picked seed when the client omits one (brief step 3).
RANDOM_SEED_UPPER_BOUND: int = 10_000
_CLIENT_ADAPTER: TypeAdapter[ClientMessage] = TypeAdapter(ClientMessage)

router = APIRouter()


class SimulationManager:
    """Owns the shared twin, the tick loop, and connected console clients."""

    def __init__(self, twinning_rate_hz: float = DEFAULT_TWINNING_RATE_HZ) -> None:
        self._sim = Simulation(twinning_rate_hz=twinning_rate_hz)
        self._clients: set[WebSocket] = set()
        self._tick_interval_s = 1.0 / twinning_rate_hz
        self._prev_transformer_status: AssetStatus | None = None
        self._agent_running = False
        self._task: asyncio.Task[None] | None = None
        # Random-shift tracking. Only one shift's arrivals are pending at a time,
        # matching the one-node, one-active-scenario scope (docs/CLAUDE.md).
        # `plan_shift` times arrivals relative to the shift's own start, so the
        # sim clock at the moment the shift began must be remembered too.
        self._pending_arrivals: list[Arrival] = []
        self._shift_seed: int | None = None
        self._shift_start_sim_hours: float | None = None

    @property
    def simulation(self) -> Simulation:
        """The single shared twin, for read-only analyses served over REST."""
        return self._sim

    async def start(self) -> None:
        if self._task is None:
            # A fresh app lifespan is a fresh session: no scenario or shift
            # carries over from a prior run (docs/CLAUDE.md: "no persistence
            # beyond session"). Cheap no-op the first time, since __init__
            # already leaves the twin at baseline.
            self._sim.reset()
            self._prev_transformer_status = None
            self._clear_shift()
            self._task = asyncio.create_task(self._run())

    async def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._task
            self._task = None

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._clients.add(ws)
        log.info("console_connected", clients=len(self._clients))

    def disconnect(self, ws: WebSocket) -> None:
        self._clients.discard(ws)
        log.info("console_disconnected", clients=len(self._clients))

    async def handle_message(self, raw: str, ws: WebSocket) -> None:
        try:
            msg = _CLIENT_ADAPTER.validate_json(raw)
        except ValidationError as exc:
            await ws.send_text(ErrorMessage(message=f"invalid message: {exc.errors()}").model_dump_json())
            return

        match msg.type:
            case "trigger_scenario":
                if msg.scenario == "reset":
                    self._sim.reset()
                    self._prev_transformer_status = None
                else:
                    self._sim.trigger_scenario(scenario_id=msg.scenario)
                # A manual action takes explicit control: any scenario running
                # afterwards must not be mis-stamped with a stale shift seed.
                self._clear_shift()
                log.info("scenario_intent", scenario=msg.scenario)
            case "start_random_shift":
                seed = msg.seed if msg.seed is not None else random.randrange(RANDOM_SEED_UPPER_BOUND)
                now = self._sim.snapshot()
                self._pending_arrivals = plan_shift(seed)
                self._shift_seed = seed
                self._shift_start_sim_hours = now.sim_time_hours
                log.info(
                    "random_shift_started",
                    seed=seed,
                    arrivals=len(self._pending_arrivals),
                    scenario_already_active=now.scenario is not None,
                )
            case "apply_intervention":
                stage = intervention_to_cooling_stage(msg.intervention)
                if stage is not None:
                    self._sim.set_cooling_stage(stage)
                log.info("intervention_applied", intervention=msg.intervention)
            case "select_asset":
                log.info("asset_selected", asset=msg.asset)
            case "agent_invoke":
                if self._agent_running:
                    await ws.send_text(
                        ErrorMessage(message="agent already running").model_dump_json()
                    )
                    return
                self._agent_running = True
                try:
                    await self._run_agent(ws)
                finally:
                    self._agent_running = False

    async def _run_agent(self, ws: WebSocket) -> None:
        """Stream one agent analysis to the requesting console.

        Events go only to the console that asked, not the broadcast: an analysis
        is a response to one operator, not shared twin state.
        """
        tools = TwinTools(self._sim)
        cfg = resolve_provider()
        log.info("agent_invoked", provider=cfg.kind.value, model=cfg.model)
        try:
            async for event in run_agent(tools, cfg):
                message = _AGENT_EVENT_TO_MESSAGE.get(event.type)
                if message is None:
                    continue
                await ws.send_text(message(**event.payload).model_dump_json())
        except Exception as exc:  # noqa: BLE001 - reported, never faked
            log.warning("agent_stream_failed", error=str(exc))
            await ws.send_text(
                ErrorMessage(message=f"agent unavailable: {exc}").model_dump_json()
            )
        finally:
            await ws.send_text(
                AgentDoneMessage(timestamp=int(time.time() * 1000)).model_dump_json()
            )

    def _clear_shift(self) -> None:
        self._pending_arrivals = []
        self._shift_seed = None
        self._shift_start_sim_hours = None

    def _fire_due_arrivals(self, snap: TwinSnapshot) -> None:
        """Fire shift arrivals whose scheduled time has passed.

        `arrival.at_sim_hours` is relative to when the shift was started, not
        the twin's absolute sim clock, so it is offset by
        `_shift_start_sim_hours` before comparing to `snap.sim_time_hours`.

        `Scenario.trigger` (sim/scenario.py) is a no-op while a scenario is
        already active, so only one arrival can ever start a scenario; a
        second arrival landing mid-scenario is dropped, not queued. That is
        the existing single-scenario behaviour -- logged here explicitly so
        it is a deliberate, visible outcome rather than a silent one.
        """
        if self._shift_start_sim_hours is None:
            return
        due = snap.sim_time_hours - self._shift_start_sim_hours
        scenario_active = snap.scenario is not None
        while self._pending_arrivals and self._pending_arrivals[0].at_sim_hours <= due:
            arrival = self._pending_arrivals.pop(0)
            if scenario_active:
                log.info(
                    "shift_arrival_dropped",
                    scenario=arrival.spec.id,
                    at_sim_hours=arrival.at_sim_hours,
                    reason="scenario_already_active",
                )
                continue
            self._sim.trigger_scenario(arrival.spec.id, arrival.severity)
            scenario_active = True
            log.info(
                "shift_arrival_fired",
                scenario=arrival.spec.id,
                severity=arrival.severity,
                at_sim_hours=arrival.at_sim_hours,
            )

    async def _run(self) -> None:
        while True:
            snap = self._sim.tick(SIM_HOURS_PER_TICK)
            self._fire_due_arrivals(snap)
            if self._shift_seed is not None and snap.scenario is not None:
                # Stamp the seed after firing: the frame in which an arrival
                # fires still carries last tick's (unseeded) scenario field,
                # the next tick's snapshot reflects it.
                snap = snap.model_copy(
                    update={"scenario": snap.scenario.model_copy(update={"seed": self._shift_seed})}
                )
            now_ms = int(time.time() * 1000)
            messages = [TelemetryMessage(payload=snap, timestamp=now_ms).model_dump_json()]

            status = snap.transformer.status
            if self._prev_transformer_status is not None and status != self._prev_transformer_status:
                messages.append(
                    StateChangeMessage(
                        asset="transformer",
                        from_status=self._prev_transformer_status,
                        to_status=status,
                        timestamp=now_ms,
                    ).model_dump_json(by_alias=True)
                )
            self._prev_transformer_status = status

            await self._broadcast(messages)
            await asyncio.sleep(self._tick_interval_s)

    async def _broadcast(self, messages: list[str]) -> None:
        dead: list[WebSocket] = []
        for ws in self._clients:
            try:
                for m in messages:
                    await ws.send_text(m)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


_AGENT_EVENT_TO_MESSAGE = {
    "agent_started": AgentStartedMessage,
    "agent_thinking": AgentThinkingMessage,
    "tool_call": ToolCallMessage,
    "tool_result": ToolResultMessage,
    "agent_final": AgentFinalMessage,
    "agent_error": lambda message: ErrorMessage(message=message),
}


manager = SimulationManager()


@router.websocket("/ws/console")
async def console_endpoint(ws: WebSocket) -> None:
    await manager.connect(ws)
    try:
        while True:
            raw = await ws.receive_text()
            await manager.handle_message(raw, ws)
    except WebSocketDisconnect:
        manager.disconnect(ws)
