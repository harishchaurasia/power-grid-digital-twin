import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RECORDING_URL, RecordedPlayer, recordedModeRequested } from "@/lib/recorded";
import { useConsoleStore } from "@/lib/store";
import { projection, snapshot, validation } from "@/test/fixtures";

const store = () => useConsoleStore.getState();

const RECORDING = {
  twinning_rate_hz: 10,
  sim_hours_per_frame: 0.02,
  frames: [
    snapshot({ simTimeHours: 0.02, hotSpotC: 96.5 }),
    snapshot({ simTimeHours: 0.04, hotSpotC: 97.5 }),
    snapshot({ simTimeHours: 0.06, hotSpotC: 98.5 }),
  ],
  projections: [
    { sim_time_hours: 0.02, projection: projection() },
    { sim_time_hours: 0.06, projection: projection() },
  ],
  validation: validation(),
};

const FRAME_MS = 1000 / RECORDING.twinning_rate_hz;

function mockFetch(body: unknown, ok = true): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response)),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("recordedModeRequested", () => {
  it("reads only this document's own URL -- never window.parent (iframe-safe)", () => {
    window.history.replaceState({}, "", "/?mode=recorded");
    expect(recordedModeRequested()).toBe(true);
    window.history.replaceState({}, "", "/");
    expect(recordedModeRequested()).toBe(false);
  });
});

describe("playback", () => {
  it("announces recorded mode and publishes the captured V&V report", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();

    await expect(player.start()).resolves.toBe(true);

    expect(fetch).toHaveBeenCalledWith(RECORDING_URL);
    expect(store().connection).toBe("recorded");
    expect(store().validation).not.toBeNull();
    player.dispose();
  });

  it("feeds frames through the same store path as the live socket", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();
    await player.start();

    // start() paints frame 0 immediately so the view is never empty.
    expect(store().snapshot?.transformer.hot_spot_c).toBe(96.5);
    vi.advanceTimersByTime(FRAME_MS);
    expect(store().snapshot?.transformer.hot_spot_c).toBe(97.5);
    expect(store().ticksReceived).toBe(2);
    player.dispose();
  });

  it("loops and resets derived series so a replay is not one ever-climbing trace", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();
    await player.start();

    vi.advanceTimersByTime(FRAME_MS * 3); // past the last frame, back to the start
    expect(store().snapshot?.transformer.hot_spot_c).toBe(96.5);
    expect(store().ticksReceived).toBe(1);
    player.dispose();
  });

  it("leaves connection state alone when there is no recording to play", async () => {
    // Nothing to fall back to: the UI must keep reporting the real problem
    // rather than claiming a playback that is not happening.
    mockFetch(null, false);
    store().setConnection("reconnecting");
    const player = new RecordedPlayer();

    await expect(player.start()).resolves.toBe(false);

    expect(store().connection).toBe("reconnecting");
    player.dispose();
  });
});

describe("handover back to live", () => {
  it("stops ticking once stopped", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();
    await player.start();

    player.stop();
    const ticksAtStop = store().ticksReceived;
    vi.advanceTimersByTime(FRAME_MS * 10);

    expect(store().ticksReceived).toBe(ticksAtStop);
  });

  it("does not start playback when the backend returns mid-fetch", async () => {
    // The defect this exists for: `onGiveUp` starts a fetch, the backend
    // recovers, `onLive` stops the player -- but the in-flight fetch then
    // resolved and started ticking anyway, interleaving recorded frames with
    // live ones in the same charts.
    let release: (value: Response) => void = () => {};
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal("fetch", vi.fn(() => pending));

    const player = new RecordedPlayer();
    const starting = player.start();

    store().setConnection("open"); // live socket came back
    player.stop();

    release({ ok: true, json: () => Promise.resolve(RECORDING) } as Response);
    await expect(starting).resolves.toBe(false);

    expect(store().connection).toBe("open");
    vi.advanceTimersByTime(FRAME_MS * 10);
    expect(store().ticksReceived).toBe(0);
  });

  it("can resume playback if the backend drops again", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();
    await player.start();
    player.stop();

    await expect(player.start()).resolves.toBe(true);
    expect(store().connection).toBe("recorded");
    vi.advanceTimersByTime(FRAME_MS);
    expect(store().ticksReceived).toBeGreaterThan(0);
    player.dispose();
  });

  it("stays stopped after dispose, even if start is called again", async () => {
    mockFetch(RECORDING);
    const player = new RecordedPlayer();
    player.dispose();

    await expect(player.start()).resolves.toBe(false);
    vi.advanceTimersByTime(FRAME_MS * 10);
    expect(store().ticksReceived).toBe(0);
  });
});
