import { useCallback, useEffect, useRef } from "react";

import { PROJECTION_POLL_MS, fetchProjection, fetchValidation } from "@/lib/api";
import {
  LIVE_ATTEMPTS_BEFORE_FALLBACK,
  RecordedPlayer,
  recordedModeRequested,
} from "@/lib/recorded";
import { useConsoleStore } from "@/lib/store";
import type { ClientMessage } from "@/lib/types";
import { ConsoleSocket } from "@/lib/ws";

/**
 * Owns the console's two backend channels: the telemetry WebSocket and the
 * polled REST analyses. Returns a `send` for client intents.
 *
 * The projection depends on live twin state so it is polled; the V&V report is
 * static for a cooling stage, so it is refetched only when that changes.
 */
export function useTwinConnection(): (message: ClientMessage) => void {
  const socketRef = useRef<ConsoleSocket | null>(null);
  const setProjection = useConsoleStore((state) => state.setProjection);
  const setValidation = useConsoleStore((state) => state.setValidation);
  const coolingStage = useConsoleStore((state) => state.snapshot?.transformer.cooling_stage);

  useEffect(() => {
    const player = new RecordedPlayer();
    let socket: ConsoleSocket | null = null;

    if (recordedModeRequested()) {
      void player.start();
    } else {
      socket = new ConsoleSocket({
        attemptsBeforeGiveUp: LIVE_ATTEMPTS_BEFORE_FALLBACK,
        // The backend is unreachable: play the captured run rather than leave a
        // prospect looking at a dead dashboard. Reconnection keeps trying
        // underneath, so a backend that comes back takes over again.
        onGiveUp: () => void player.start(),
        // Drop the played-back history on handover so the charts do not present
        // recorded frames as live ones.
        onLive: () => {
          player.stop();
          useConsoleStore.getState().clearTimeline();
        },
      });
      socketRef.current = socket;
      socket.connect();
    }

    return () => {
      player.dispose();
      socket?.dispose();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (recordedModeRequested()) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const poll = async () => {
      try {
        setProjection(await fetchProjection(controller.signal));
      } catch {
        // Backend unreachable: keep the last band rather than blanking the view.
      }
      if (!controller.signal.aborted) {
        timer = setTimeout(() => void poll(), PROJECTION_POLL_MS);
      }
    };
    void poll();

    return () => {
      controller.abort();
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [setProjection]);

  useEffect(() => {
    if (recordedModeRequested()) return;
    const controller = new AbortController();
    fetchValidation(controller.signal)
      .then(setValidation)
      .catch(() => {
        // Leave the panel in its loading state; it is not a demo-stopper.
      });
    return () => controller.abort();
  }, [setValidation, coolingStage]);

  return useCallback((message: ClientMessage) => {
    socketRef.current?.send(message);
  }, []);
}
