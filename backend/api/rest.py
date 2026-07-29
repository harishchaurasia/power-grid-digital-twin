"""Read-only analyses the console fetches over HTTP.

These sit outside the WebSocket so the type-discriminated ServerMessage union in
docs/architecture.md stays exactly as documented. Both payloads are derived from
the same authoritative twin state the WS streams -- the console never computes
physics of its own.
"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from api.ws_console import manager
from sim.projection import HotSpotProjection
from sim.scenario import Simulation
from sim.validation import ValidationReport, transformer_validation_report

MIN_HORIZON_HOURS: float = 1.0
MAX_HORIZON_HOURS: float = 72.0
DEFAULT_HORIZON_HOURS: float = 6.0

router = APIRouter(prefix="/api")


def get_simulation() -> Simulation:
    return manager.simulation


SimulationDep = Annotated[Simulation, Depends(get_simulation)]


@router.get("/validation/transformer")
async def transformer_validation(sim: SimulationDep) -> ValidationReport:
    """V&V report for the transformer at the twin's current cooling stage."""
    return transformer_validation_report(sim.cooling_stage)


@router.get("/projection/transformer")
async def transformer_projection(
    sim: SimulationDep,
    horizon_hours: Annotated[
        float, Query(ge=MIN_HORIZON_HOURS, le=MAX_HORIZON_HOURS)
    ] = DEFAULT_HORIZON_HOURS,
) -> HotSpotProjection:
    """Hot-spot trajectory with its 95% forecast-uncertainty band."""
    return sim.project(horizon_hours=horizon_hours)
