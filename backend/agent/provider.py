"""Model provider resolution and a single tool-calling interface.

Three backends, one interface. The tools and the reasoning loop never change --
only who runs the model:

- ``ANTHROPIC_API_KEY`` set  -> Anthropic (the stack in docs/CLAUDE.md)
- ``OPENAI_API_KEY`` set     -> OpenAI
- neither                    -> local Ollama

Hosted wins when a key is present because a small local model is materially
worse at the discipline this demo depends on -- five tools, multi-step, and
never stating a number it did not read from a tool call. Local is for building
and testing without burning credits, not for what a prospect sees.

Ollama speaks the OpenAI chat-completions shape, so OpenAI and local share one
client and differ only by ``base_url``.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from enum import Enum
from typing import Any

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5"
DEFAULT_OPENAI_MODEL = "gpt-4o"
DEFAULT_OLLAMA_MODEL = "qwen2.5:7b"
DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434/v1"

MAX_TOKENS = 4096
TEMPERATURE = 0.3


class ProviderKind(str, Enum):
    ANTHROPIC = "anthropic"
    OPENAI = "openai"
    OLLAMA = "ollama"


@dataclass(frozen=True)
class ProviderConfig:
    kind: ProviderKind
    model: str
    base_url: str | None = None
    api_key: str | None = None

    @property
    def is_local(self) -> bool:
        return self.kind is ProviderKind.OLLAMA

    @property
    def label(self) -> str:
        return f"{self.kind.value}:{self.model}"


def resolve_provider() -> ProviderConfig:
    """Pick a backend from the environment. Hosted first, local as fallback."""
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        return ProviderConfig(
            kind=ProviderKind.ANTHROPIC,
            model=os.environ.get("ARKAFORGE_AGENT_MODEL", DEFAULT_ANTHROPIC_MODEL),
            api_key=anthropic_key,
        )

    openai_key = os.environ.get("OPENAI_API_KEY")
    if openai_key:
        return ProviderConfig(
            kind=ProviderKind.OPENAI,
            model=os.environ.get("ARKAFORGE_AGENT_MODEL", DEFAULT_OPENAI_MODEL),
            api_key=openai_key,
        )

    return ProviderConfig(
        kind=ProviderKind.OLLAMA,
        model=os.environ.get("ARKAFORGE_AGENT_MODEL", DEFAULT_OLLAMA_MODEL),
        base_url=os.environ.get("ARKAFORGE_OLLAMA_URL", DEFAULT_OLLAMA_BASE_URL),
        # Ollama ignores the key but the OpenAI client requires a non-empty one.
        api_key="ollama",
    )


def to_openai_tools(schemas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Convert the neutral tool schemas to OpenAI's function-tool shape."""
    return [
        {
            "type": "function",
            "function": {
                "name": s["name"],
                "description": s["description"],
                "parameters": s["input_schema"],
            },
        }
        for s in schemas
    ]


def to_anthropic_tools(schemas: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The neutral schemas are already Anthropic-shaped."""
    return schemas
