/**
 * Backend process control for the e2e suite.
 *
 * The fallback specs need the backend *absent* (which is the default -- the
 * Playwright webServer starts Vite alone) and the handover spec needs it to
 * appear mid-session. Driving the real uvicorn process rather than stubbing the
 * WebSocket is the point: the give-up-and-recover path is what shipped broken.
 */

import { spawn, type ChildProcess } from "node:child_process";
import { fileURLToPath, URL } from "node:url";

const BACKEND_DIR = fileURLToPath(new URL("../../backend", import.meta.url));
const HEALTH_URL = "http://localhost:8000/api/validation/transformer";

export async function backendReachable(): Promise<boolean> {
  try {
    const response = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1000) });
    return response.ok;
  } catch {
    return false;
  }
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  label: string,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** True when the Python toolchain is present, so specs can skip instead of fail. */
export async function backendRunnable(): Promise<boolean> {
  if (await backendReachable()) return true;
  return new Promise((resolve) => {
    const probe = spawn("uv", ["--version"], { stdio: "ignore" });
    probe.on("error", () => resolve(false));
    probe.on("exit", (code) => resolve(code === 0));
  });
}

export async function startBackend(): Promise<ChildProcess | null> {
  if (await backendReachable()) return null; // Someone else's; leave it running.
  const proc = spawn(
    "uv",
    ["run", "--python", "3.12", "--extra", "api", "--extra", "agent",
     "uvicorn", "main:app", "--port", "8000"],
    { cwd: BACKEND_DIR, stdio: "ignore" },
  );
  await waitFor(backendReachable, 60_000, "backend to start");
  return proc;
}

export async function stopBackend(proc: ChildProcess | null): Promise<void> {
  if (!proc) return;
  proc.kill("SIGTERM");
  await waitFor(async () => !(await backendReachable()), 30_000, "backend to stop");
}
