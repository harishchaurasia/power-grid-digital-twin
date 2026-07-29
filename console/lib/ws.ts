/**
 * Console WebSocket client.
 *
 * Reconnects with exponential backoff (docs/architecture.md fallbacks) and is
 * iframe-safe: the URL is derived from this document's own location only, never
 * from `window.parent` or `window.top`.
 */

import { useConsoleStore } from "@/lib/store";
import type { ClientMessage, ServerMessage } from "@/lib/types";

const WS_PATH = "/ws/console";
const BACKOFF_BASE_MS = 500;
const BACKOFF_MAX_MS = 10_000;

function socketUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}${WS_PATH}`;
}

function backoffDelayMs(attempt: number): number {
  return Math.min(BACKOFF_BASE_MS * 2 ** attempt, BACKOFF_MAX_MS);
}

export class ConsoleSocket {
  private socket: WebSocket | null = null;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private onGiveUp: (() => void) | undefined;
  private onLive: (() => void) | undefined;
  private gaveUp = false;

  /**
   * `onGiveUp` fires once the live backend has failed `attempts` times, so the
   * caller can switch to recorded playback; reconnection keeps running
   * underneath. `onLive` fires when the backend comes back, so the caller can
   * stop that playback -- otherwise both feed the store and the charts
   * interleave two unrelated timelines.
   */
  constructor(
    options: { onGiveUp?: () => void; onLive?: () => void; attemptsBeforeGiveUp?: number } = {},
  ) {
    this.onGiveUp = options.onGiveUp;
    this.onLive = options.onLive;
    this.attemptsBeforeGiveUp = options.attemptsBeforeGiveUp ?? 3;
  }

  private attemptsBeforeGiveUp: number;

  connect(): void {
    if (this.disposed) return;

    if (!this.gaveUp) {
      const { setConnection } = useConsoleStore.getState();
      setConnection(this.attempt === 0 ? "connecting" : "reconnecting");
    }

    const socket = new WebSocket(socketUrl());
    this.socket = socket;

    socket.onopen = () => {
      this.attempt = 0;
      if (this.gaveUp) {
        this.gaveUp = false;
        this.onLive?.();
      }
      useConsoleStore.getState().setConnection("open");
    };

    socket.onmessage = (event: MessageEvent<string>) => {
      const message = parseServerMessage(event.data);
      if (message) {
        useConsoleStore.getState().applyServerMessage(message);
      }
    };

    // `onclose` fires after `onerror`, so scheduling the retry there alone
    // covers both failure paths without double-scheduling.
    socket.onclose = () => {
      this.socket = null;
      if (this.disposed) return;
      if (!this.gaveUp) {
        useConsoleStore.getState().setConnection("reconnecting");
      }
      this.scheduleRetry();
    };
  }

  send(message: ClientMessage): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  dispose(): void {
    this.disposed = true;
    if (this.retryTimer !== null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.close();
    }
    useConsoleStore.getState().setConnection("closed");
  }

  private scheduleRetry(): void {
    const delay = backoffDelayMs(this.attempt);
    this.attempt += 1;
    if (!this.gaveUp && this.attempt >= this.attemptsBeforeGiveUp) {
      this.gaveUp = true;
      this.onGiveUp?.();
    }
    this.retryTimer = setTimeout(() => this.connect(), delay);
  }
}

/**
 * A malformed frame is dropped rather than crashing the overlay -- the demo
 * must never hard-fail in front of a prospect.
 */
function parseServerMessage(raw: string): ServerMessage | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as { type?: unknown }).type === "string"
    ) {
      return parsed as ServerMessage;
    }
  } catch {
    // fall through
  }
  return null;
}
