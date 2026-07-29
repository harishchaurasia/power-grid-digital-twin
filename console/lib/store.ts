/**
 * Cross-component console state (Zustand). Holds only what the backend sent:
 * no value in here is computed from physics on the client.
 */

import { create } from "zustand";

import type {
  AssetId,
  ConnectionState,
  HotSpotProjection,
  ServerMessage,
  ToolCallEvent,
  TwinSnapshot,
  ValidationReport,
} from "@/lib/types";

/** Telemetry arrives at the 10 Hz twinning rate; thin it for the charts. */
const HISTORY_SAMPLE_EVERY = 2;
const HISTORY_MAX_POINTS = 300;
const STATE_CHANGE_LOG_MAX = 8;

export interface HistorySample {
  simTimeHours: number;
  hotSpotC: number;
  topOilC: number;
  ambientC: number;
  loadingK: number;
  agingFactorFaa: number;
}

export interface StateChangeEntry {
  id: string;
  asset: AssetId;
  from: string;
  to: string;
  simTimeHours: number;
}

interface ConsoleState {
  connection: ConnectionState;
  snapshot: TwinSnapshot | null;
  history: HistorySample[];
  stateChanges: StateChangeEntry[];
  projection: HotSpotProjection | null;
  validation: ValidationReport | null;
  selectedAsset: AssetId;
  lastError: string | null;
  ticksReceived: number;

  agentRunning: boolean;
  agentProvider: { provider: string; model: string; local: boolean } | null;
  agentThinking: string[];
  agentToolCalls: ToolCallEvent[];
  agentFinal: string | null;

  setConnection: (connection: ConnectionState) => void;
  applyServerMessage: (message: ServerMessage) => void;
  setProjection: (projection: HotSpotProjection | null) => void;
  setValidation: (validation: ValidationReport | null) => void;
  selectAsset: (asset: AssetId) => void;
  clearTimeline: () => void;
  dismissRecommendation: () => void;
}

function toSample(snapshot: TwinSnapshot): HistorySample {
  const t = snapshot.transformer;
  return {
    simTimeHours: snapshot.sim_time_hours,
    hotSpotC: t.hot_spot_c,
    topOilC: t.top_oil_c,
    ambientC: snapshot.ambient.air_temp_c,
    loadingK: t.loading_k,
    agingFactorFaa: t.aging_factor_faa,
  };
}

export const useConsoleStore = create<ConsoleState>()((set) => ({
  connection: "connecting",
  snapshot: null,
  history: [],
  stateChanges: [],
  projection: null,
  validation: null,
  selectedAsset: "transformer",
  lastError: null,
  ticksReceived: 0,

  agentRunning: false,
  agentProvider: null,
  agentThinking: [],
  agentToolCalls: [],
  agentFinal: null,

  setConnection: (connection) => set({ connection }),

  setProjection: (projection) => set({ projection }),

  setValidation: (validation) => set({ validation }),

  selectAsset: (selectedAsset) => set({ selectedAsset }),

  dismissRecommendation: () => set({ agentFinal: null }),

  clearTimeline: () =>
    set({
      history: [],
      stateChanges: [],
      projection: null,
      lastError: null,
      ticksReceived: 0,
      agentThinking: [],
      agentToolCalls: [],
      agentFinal: null,
    }),

  applyServerMessage: (message) =>
    set((state) => {
      switch (message.type) {
        case "telemetry": {
          const ticksReceived = state.ticksReceived + 1;
          const keep = ticksReceived % HISTORY_SAMPLE_EVERY === 0;
          if (!keep) {
            return { snapshot: message.payload, ticksReceived };
          }
          const history = [...state.history, toSample(message.payload)];
          return {
            snapshot: message.payload,
            ticksReceived,
            history:
              history.length > HISTORY_MAX_POINTS
                ? history.slice(history.length - HISTORY_MAX_POINTS)
                : history,
          };
        }
        case "state_change": {
          const entry: StateChangeEntry = {
            id: `${message.asset}-${message.timestamp}-${message.to}`,
            asset: message.asset,
            from: message.from,
            to: message.to,
            simTimeHours: state.snapshot?.sim_time_hours ?? 0,
          };
          return {
            stateChanges: [entry, ...state.stateChanges].slice(0, STATE_CHANGE_LOG_MAX),
          };
        }
        case "agent_started":
          return {
            agentRunning: true,
            agentProvider: {
              provider: message.provider,
              model: message.model,
              local: message.local,
            },
            agentThinking: [],
            agentToolCalls: [],
            agentFinal: null,
            lastError: null,
          };
        case "agent_thinking":
          return { agentThinking: [...state.agentThinking, message.text] };
        case "tool_call":
          return {
            agentToolCalls: [
              ...state.agentToolCalls,
              { call_id: message.call_id, tool: message.tool, input: message.input },
            ],
          };
        case "tool_result":
          return {
            agentToolCalls: state.agentToolCalls.map((c) =>
              c.call_id === message.call_id ? { ...c, output: message.output } : c,
            ),
          };
        case "agent_final":
          return { agentFinal: message.text };
        case "agent_done":
          return { agentRunning: false };
        case "error":
          return { lastError: message.message, agentRunning: false };
      }
    }),
}));
