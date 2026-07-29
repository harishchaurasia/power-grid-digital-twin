"""Twin state contracts (Pydantic v2).

The authoritative twin snapshot the simulation core produces each tick and that
both Unreal (to render) and the agent (to reason) consume. Transformer is fully
modeled now (Phase 1); BESS and line arrive in Phases 2-3 and are optional until
then rather than faked -- no placeholder numbers (docs/credibility-checklist.md).
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from sim.transformer import CoolingStage

AssetId = Literal["transformer", "bess", "line"]
AssetStatus = Literal["nominal", "warning", "critical"]


class AmbientConditions(BaseModel):
    """Weather inputs driving the physics (transformer ambient; IEEE 738 later)."""

    air_temp_c: float
    wind_ms: float = 0.7
    solar_wm2: float = 900.0


class TransformerSnapshot(BaseModel):
    """Derived transformer state, all values traceable to the C57.91 model."""

    node_load_mva: float
    loading_k: float
    top_oil_c: float
    hot_spot_c: float
    aging_factor_faa: float
    cooling_stage: CoolingStage
    cumulative_loss_of_life_hours: float
    status: AssetStatus
    model_standard: str = "IEEE C57.91"


class TwinSnapshot(BaseModel):
    """Full twin state at one sim tick. type-discriminated on the wire as 'telemetry'."""

    sim_time_hours: float = Field(ge=0.0)
    timestamp_ms: int
    twinning_rate_hz: float
    ambient: AmbientConditions
    transformer: TransformerSnapshot
    # Populated in Phase 2 / Phase 3; None until their physics models exist.
    bess: None = None
    line: None = None


def transformer_status(hot_spot_c: float, aging_factor_faa: float) -> AssetStatus:
    """Map hot-spot / aging onto the operating-range bands in docs/domain-transformer.md."""
    if hot_spot_c > 120.0 or aging_factor_faa > 4.0:
        return "critical"
    if hot_spot_c > 105.0 or aging_factor_faa > 1.0:
        return "warning"
    return "nominal"
