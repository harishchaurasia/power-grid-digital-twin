"""Bounded time-series history of twin state.

Backs the agent's `query_history` tool. The agent must be able to say "hot-spot
has risen 9.4 degC/h over the last 40 minutes" and have that be a *measured*
trend from recorded twin state, not an impression -- so the summary statistics
are computed here rather than left to the model
(docs/CLAUDE.md hard rule 3: the agent never invents numbers).
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass

from pydantic import BaseModel

from sim.state import TwinSnapshot

# One sample per 0.05 sim-hours (3 sim-minutes) over a 72 h horizon.
HISTORY_SAMPLE_INTERVAL_HOURS: float = 0.05
HISTORY_MAX_SAMPLES: int = 1500

#: Signals the agent may query, mapped to their unit. Anything outside this set
#: is rejected rather than guessed at, so a typo cannot silently return zeros.
TRANSFORMER_SIGNALS: dict[str, str] = {
    "hot_spot_c": "degC",
    "top_oil_c": "degC",
    "loading_k": "ratio",
    "node_load_mva": "MVA",
    "aging_factor_faa": "ratio",
    "cumulative_loss_of_life_hours": "h",
}
AMBIENT_SIGNALS: dict[str, str] = {"air_temp_c": "degC"}


@dataclass(frozen=True)
class HistorySample:
    sim_time_hours: float
    values: dict[str, float]


class HistorySummary(BaseModel):
    """Summary statistics over the queried window."""

    min: float
    max: float
    mean: float
    latest: float
    trend_per_hour: float


class HistoryResult(BaseModel):
    signal: str
    unit: str
    window_hours: float
    sample_count: int
    samples: list[list[float]]
    summary: HistorySummary


class TwinHistory:
    """Ring buffer of sampled twin state."""

    def __init__(self, max_samples: int = HISTORY_MAX_SAMPLES) -> None:
        self._samples: deque[HistorySample] = deque(maxlen=max_samples)
        self._next_sample_at = 0.0

    def record(self, snapshot: TwinSnapshot) -> None:
        """Sample the snapshot if enough sim-time has elapsed since the last."""
        if snapshot.sim_time_hours < self._next_sample_at:
            return
        t = snapshot.transformer
        self._samples.append(
            HistorySample(
                sim_time_hours=snapshot.sim_time_hours,
                values={
                    "hot_spot_c": t.hot_spot_c,
                    "top_oil_c": t.top_oil_c,
                    "loading_k": t.loading_k,
                    "node_load_mva": t.node_load_mva,
                    "aging_factor_faa": t.aging_factor_faa,
                    "cumulative_loss_of_life_hours": t.cumulative_loss_of_life_hours,
                    "air_temp_c": snapshot.ambient.air_temp_c,
                },
            )
        )
        self._next_sample_at = snapshot.sim_time_hours + HISTORY_SAMPLE_INTERVAL_HOURS

    def clear(self) -> None:
        self._samples.clear()
        self._next_sample_at = 0.0

    @property
    def sample_count(self) -> int:
        return len(self._samples)

    def query(self, signal: str, window_hours: float) -> HistoryResult:
        """Return samples of one signal over the trailing window, with summary.

        Raises KeyError for an unknown signal so a bad tool call fails loudly
        instead of returning plausible-looking nothing.
        """
        unit = TRANSFORMER_SIGNALS.get(signal) or AMBIENT_SIGNALS.get(signal)
        if unit is None:
            known = sorted({**TRANSFORMER_SIGNALS, **AMBIENT_SIGNALS})
            raise KeyError(f"unknown signal {signal!r}; known signals: {known}")

        if not self._samples:
            raise LookupError("no twin history recorded yet")

        latest_t = self._samples[-1].sim_time_hours
        cutoff = latest_t - window_hours
        window = [s for s in self._samples if s.sim_time_hours >= cutoff]
        if not window:
            window = [self._samples[-1]]

        values = [s.values[signal] for s in window]
        return HistoryResult(
            signal=signal,
            unit=unit,
            window_hours=window_hours,
            sample_count=len(window),
            samples=[[round(s.sim_time_hours, 4), round(s.values[signal], 4)] for s in window],
            summary=HistorySummary(
                min=min(values),
                max=max(values),
                mean=sum(values) / len(values),
                latest=values[-1],
                trend_per_hour=_trend_per_hour(window, signal),
            ),
        )


def _trend_per_hour(window: list[HistorySample], signal: str) -> float:
    """Least-squares slope in units per sim-hour; 0.0 if the window is a point."""
    n = len(window)
    if n < 2:
        return 0.0
    xs = [s.sim_time_hours for s in window]
    ys = [s.values[signal] for s in window]
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    denominator = sum((x - mean_x) ** 2 for x in xs)
    if denominator == 0.0:
        return 0.0
    numerator = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    return numerator / denominator
