"""Wire contracts between backend and console (mirrors console TS types).

type-discriminated JSON per docs/architecture.md. Pydantic v2 on the backend;
the console mirrors these as a discriminated union on `type`.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import BaseModel, Field

from sim.state import AssetId, AssetStatus, TwinSnapshot
from sim.transformer import CoolingStage

# --- Interventions available in the transformer slice (Phase 1 subset).
InterventionId = Literal["cooling_onaf", "cooling_ofaf", "hold"]

_COOLING_INTERVENTIONS: dict[InterventionId, CoolingStage] = {
    "cooling_onaf": CoolingStage.ONAF,
    "cooling_ofaf": CoolingStage.OFAF,
}


def intervention_to_cooling_stage(intervention: InterventionId) -> CoolingStage | None:
    return _COOLING_INTERVENTIONS.get(intervention)


# --- Server -> console -----------------------------------------------------
class TelemetryMessage(BaseModel):
    type: Literal["telemetry"] = "telemetry"
    payload: TwinSnapshot
    timestamp: int


class StateChangeMessage(BaseModel):
    type: Literal["state_change"] = "state_change"
    asset: AssetId
    from_status: AssetStatus = Field(serialization_alias="from")
    to_status: AssetStatus = Field(serialization_alias="to")
    timestamp: int

    model_config = {"populate_by_name": True}


class ErrorMessage(BaseModel):
    type: Literal["error"] = "error"
    message: str


# --- Agent stream. docs/architecture.md defines final_recommendation as the
# --- structured AgentRecommendation; the Phase 1 agent emits prose, so the
# --- final message carries `text` and the structured form lands with the
# --- cross-asset agent in Phase 4. Deviation recorded in RESEARCH-LOG.
class AgentStartedMessage(BaseModel):
    type: Literal["agent_started"] = "agent_started"
    provider: str
    model: str
    local: bool


class AgentThinkingMessage(BaseModel):
    type: Literal["agent_thinking"] = "agent_thinking"
    text: str


class ToolCallMessage(BaseModel):
    type: Literal["tool_call"] = "tool_call"
    call_id: str
    tool: str
    input: dict[str, object]


class ToolResultMessage(BaseModel):
    type: Literal["tool_result"] = "tool_result"
    call_id: str
    tool: str
    output: dict[str, object]


class AgentFinalMessage(BaseModel):
    type: Literal["agent_final"] = "agent_final"
    text: str


class AgentDoneMessage(BaseModel):
    type: Literal["agent_done"] = "agent_done"
    timestamp: int


ServerMessage = Annotated[
    Union[
        TelemetryMessage,
        StateChangeMessage,
        ErrorMessage,
        AgentStartedMessage,
        AgentThinkingMessage,
        ToolCallMessage,
        ToolResultMessage,
        AgentFinalMessage,
        AgentDoneMessage,
    ],
    Field(discriminator="type"),
]


# --- Console -> server -----------------------------------------------------
class TriggerScenarioMessage(BaseModel):
    type: Literal["trigger_scenario"]
    scenario: Literal["heatwave_load_spike", "reset"]


class AgentInvokeMessage(BaseModel):
    type: Literal["agent_invoke"]


class ApplyInterventionMessage(BaseModel):
    type: Literal["apply_intervention"]
    intervention: InterventionId


class SelectAssetMessage(BaseModel):
    type: Literal["select_asset"]
    asset: AssetId


ClientMessage = Annotated[
    Union[
        TriggerScenarioMessage,
        AgentInvokeMessage,
        ApplyInterventionMessage,
        SelectAssetMessage,
    ],
    Field(discriminator="type"),
]
