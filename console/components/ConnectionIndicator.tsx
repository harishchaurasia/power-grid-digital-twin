import { useConsoleStore } from "@/lib/store";
import type { ConnectionState } from "@/lib/types";

const LABEL: Record<ConnectionState, string> = {
  connecting: "Connecting",
  open: "Live",
  reconnecting: "Reconnecting",
  closed: "Disconnected",
  recorded: "Recorded",
};

const DOT: Record<ConnectionState, string> = {
  connecting: "bg-text-tertiary",
  open: "bg-status-nominal",
  reconnecting: "bg-status-warning",
  closed: "bg-forge-red",
  // Amber, not red: playback is a working degraded mode, not a failure.
  recorded: "bg-status-warning",
};

export function ConnectionIndicator() {
  const connection = useConsoleStore((state) => state.connection);

  return (
    <span className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${DOT[connection]}`} aria-hidden="true" />
      <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-text-secondary">
        {LABEL[connection]}
      </span>
    </span>
  );
}
