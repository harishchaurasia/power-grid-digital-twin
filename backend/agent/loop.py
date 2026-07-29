"""The agent tool-use loop.

Emits structured events as it goes -- thinking text, each tool call, each tool
result, the final answer -- so the console can show the reasoning rather than
assert it. Showing the tool traffic is the whole point: it is what turns "trust
our AI" into "here is what it read and what it computed"
(RESEARCH-LOG Agent C, differentiator 1).
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from typing import Any

import structlog

from agent.prompts import INVOKE_PROMPT, SYSTEM_PROMPT
from agent.provider import (
    MAX_TOKENS,
    TEMPERATURE,
    ProviderConfig,
    ProviderKind,
    resolve_provider,
    to_anthropic_tools,
    to_openai_tools,
)
from agent.tools import TwinTools, tool_schemas

log = structlog.get_logger(__name__)

#: Hard stop on the loop. Four tools plus a comparison of three plans is ~7
#: calls; beyond a dozen the model is looping rather than working.
MAX_ITERATIONS = 12


@dataclass
class AgentEvent:
    """One streamable step of the agent's work."""

    type: str
    payload: dict[str, Any] = field(default_factory=dict)


class AgentUnavailable(RuntimeError):
    """No provider could be reached. Surfaced honestly rather than faked."""


async def run_agent(tools: TwinTools, config: ProviderConfig | None = None) -> AsyncIterator[AgentEvent]:
    """Run one analysis, yielding events as they happen."""
    cfg = config or resolve_provider()
    yield AgentEvent("agent_started", {"provider": cfg.kind.value, "model": cfg.model, "local": cfg.is_local})

    try:
        if cfg.kind is ProviderKind.ANTHROPIC:
            iterator = _run_anthropic(tools, cfg)
        else:
            iterator = _run_openai_compatible(tools, cfg)
        async for event in iterator:
            yield event
    except AgentUnavailable:
        raise
    except Exception as exc:  # noqa: BLE001 - surfaced to the console verbatim
        log.warning("agent_failed", provider=cfg.kind.value, error=str(exc))
        yield AgentEvent("agent_error", {"message": f"{type(exc).__name__}: {exc}"})


async def _run_openai_compatible(
    tools: TwinTools, cfg: ProviderConfig
) -> AsyncIterator[AgentEvent]:
    """OpenAI chat-completions loop. Also drives Ollama, which speaks it."""
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise AgentUnavailable("openai package not installed") from exc

    client = AsyncOpenAI(api_key=cfg.api_key, base_url=cfg.base_url)
    openai_tools = to_openai_tools(tool_schemas())
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": INVOKE_PROMPT},
    ]

    for _ in range(MAX_ITERATIONS):
        response = await client.chat.completions.create(
            model=cfg.model,
            messages=messages,  # type: ignore[arg-type]
            tools=openai_tools,  # type: ignore[arg-type]
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
        )
        choice = response.choices[0].message

        if choice.content:
            yield AgentEvent("agent_thinking", {"text": choice.content})

        # The SDK's tool_call union includes a custom-tool variant with no
        # .function; we only ever declare function tools, so narrow to those.
        calls = [c for c in (choice.tool_calls or []) if c.type == "function"]
        if not calls:
            yield AgentEvent("agent_final", {"text": choice.content or ""})
            return

        messages.append(
            {
                "role": "assistant",
                "content": choice.content or "",
                "tool_calls": [
                    {
                        "id": c.id,
                        "type": "function",
                        "function": {"name": c.function.name, "arguments": c.function.arguments},
                    }
                    for c in calls
                ],
            }
        )

        for call in calls:
            name = call.function.name
            args = _parse_arguments(call.function.arguments)
            yield AgentEvent("tool_call", {"call_id": call.id, "tool": name, "input": args})
            result = tools.dispatch(name, args)
            yield AgentEvent("tool_result", {"call_id": call.id, "tool": name, "output": result})
            messages.append(
                {"role": "tool", "tool_call_id": call.id, "content": json.dumps(result)}
            )

    yield AgentEvent("agent_error", {"message": f"stopped after {MAX_ITERATIONS} iterations"})


async def _run_anthropic(tools: TwinTools, cfg: ProviderConfig) -> AsyncIterator[AgentEvent]:
    """Anthropic native tool-use loop."""
    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:  # pragma: no cover - dependency guard
        raise AgentUnavailable("anthropic package not installed") from exc

    client = AsyncAnthropic(api_key=cfg.api_key)
    anthropic_tools = to_anthropic_tools(tool_schemas())
    messages: list[dict[str, Any]] = [{"role": "user", "content": INVOKE_PROMPT}]

    for _ in range(MAX_ITERATIONS):
        response = await client.messages.create(
            model=cfg.model,
            max_tokens=MAX_TOKENS,
            temperature=TEMPERATURE,
            system=SYSTEM_PROMPT,
            tools=anthropic_tools,  # type: ignore[arg-type]
            messages=messages,  # type: ignore[arg-type]
        )

        text = "".join(b.text for b in response.content if b.type == "text")
        if text:
            yield AgentEvent("agent_thinking", {"text": text})

        tool_uses = [b for b in response.content if b.type == "tool_use"]
        if not tool_uses:
            yield AgentEvent("agent_final", {"text": text})
            return

        messages.append({"role": "assistant", "content": response.content})
        results: list[dict[str, Any]] = []
        for block in tool_uses:
            args = dict(block.input) if isinstance(block.input, dict) else {}
            yield AgentEvent("tool_call", {"call_id": block.id, "tool": block.name, "input": args})
            output = tools.dispatch(block.name, args)
            yield AgentEvent(
                "tool_result", {"call_id": block.id, "tool": block.name, "output": output}
            )
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(output),
                }
            )
        messages.append({"role": "user", "content": results})

    yield AgentEvent("agent_error", {"message": f"stopped after {MAX_ITERATIONS} iterations"})


def _parse_arguments(raw: str | None) -> dict[str, Any]:
    """Tolerate a model emitting empty or malformed arguments."""
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}
