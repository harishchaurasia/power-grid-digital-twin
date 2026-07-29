/**
 * Recorded-scenario playback.
 *
 * The fallback docs/architecture.md requires: with the backend unreachable, the
 * console plays a captured run instead of showing a dead dashboard. A prospect
 * on the marketing site should never meet a spinner.
 *
 * Playback feeds the *same* store actions as the live WebSocket, so every panel,
 * chart and the 3D scene work unchanged — there is no second rendering path to
 * keep in step.
 */

import { useConsoleStore } from "@/lib/store";
import type { HotSpotProjection, TwinSnapshot, ValidationReport } from "@/lib/types";

export const RECORDING_URL = "/recorded/scenario.json";

/** Give the live backend this many failed attempts before falling back. */
export const LIVE_ATTEMPTS_BEFORE_FALLBACK = 3;

interface Recording {
  twinning_rate_hz: number;
  sim_hours_per_frame: number;
  frames: TwinSnapshot[];
  projections: { sim_time_hours: number; projection: HotSpotProjection }[];
  validation: ValidationReport;
}

/** `?mode=recorded` forces playback. Reads this document's own URL only. */
export function recordedModeRequested(): boolean {
  return new URLSearchParams(window.location.search).get("mode") === "recorded";
}

export class RecordedPlayer {
  private timer: ReturnType<typeof setInterval> | null = null;
  private frame = 0;
  private projectionIndex = 0;
  private recording: Recording | null = null;
  private disposed = false;
  private running = false;

  async start(): Promise<boolean> {
    this.running = true;
    const store = useConsoleStore.getState();
    try {
      const response = await fetch(RECORDING_URL);
      if (!response.ok) throw new Error(String(response.status));
      this.recording = (await response.json()) as Recording;
    } catch {
      // No recording available either: leave the connection state alone so the
      // UI keeps reporting the real problem rather than inventing a new one.
      return false;
    }
    // The backend can come back while this fetch is in flight; starting playback
    // then would clobber live state with a second timeline.
    if (this.disposed || !this.running) return false;

    store.setValidation(this.recording.validation);
    store.setConnection("recorded");
    this.tick();
    this.timer = setInterval(() => this.tick(), 1000 / this.recording.twinning_rate_hz);
    return true;
  }

  /**
   * Halt playback without discarding the recording, so a backend that drops
   * again can be covered by `start()` without refetching.
   */
  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.frame = 0;
    this.projectionIndex = 0;
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private tick(): void {
    const recording = this.recording;
    if (!recording) return;
    const store = useConsoleStore.getState();

    const snapshot = recording.frames[this.frame];
    if (!snapshot) return;

    store.applyServerMessage({
      type: "telemetry",
      payload: snapshot,
      timestamp: snapshot.timestamp_ms,
    });

    // Advance the projection whenever playback passes its capture time.
    const next = recording.projections[this.projectionIndex];
    if (next && snapshot.sim_time_hours >= next.sim_time_hours) {
      store.setProjection(next.projection);
      this.projectionIndex += 1;
    }

    this.frame += 1;
    if (this.frame >= recording.frames.length) {
      // Loop, and reset the derived series so the replay reads as a fresh run
      // rather than one continuous ever-climbing trace.
      this.frame = 0;
      this.projectionIndex = 0;
      store.clearTimeline();
    }
  }
}
