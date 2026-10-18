#!/usr/bin/env bash
#
# One command to get the demo in front of people.
#
# Brings up whatever the agent needs (a local Ollama, if that is what the app
# resolves to), then the backend and the console, and does not report ready
# until each one actually answers. Ctrl-C stops everything it started.
#
# The provider is resolved by asking the application, not by re-deciding here:
# agent/provider.py prefers a hosted key over local Ollama, so duplicating that
# rule in shell would eventually contradict it. If a key is set, this script
# never touches Ollama.
#
# Usage:
#   make demo                 start; reclaim ports held by a previous demo
#   make demo-restart         same, but reclaim the ports from anything
#   scripts/demo.sh --help

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BACKEND_PORT=8000
CONSOLE_PORT=5173
BACKEND_HEALTH="http://localhost:${BACKEND_PORT}/api/validation/transformer"
CONSOLE_URL="http://localhost:${CONSOLE_PORT}"
OLLAMA_HOST="${ARKAFORGE_OLLAMA_HOST:-http://localhost:11434}"

# Pin the model in memory for the whole session. Ollama's default is to unload
# after ~5 minutes idle, and reloading 4.7 GB adds ~20 s to the first analysis
# -- which lands on a prospect who clicks "Run analysis" after a quiet moment.
OLLAMA_KEEP_ALIVE="${ARKAFORGE_OLLAMA_KEEP_ALIVE:--1}"

LOG_DIR="${TMPDIR:-/tmp}"
LOG_DIR="${LOG_DIR%/}/arkaforge-demo"
mkdir -p "$LOG_DIR"
BACKEND_LOG="${LOG_DIR}/backend.log"
CONSOLE_LOG="${LOG_DIR}/console.log"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RED=$'\033[31m'; AMBER=$'\033[33m'
GREEN=$'\033[32m'; RESET=$'\033[0m'

say()  { printf '%s\n' "$*"; }
step() { printf '  %s…%s ' "$1" "$RESET"; }
ok()   { printf '%sok%s %s\n' "$GREEN" "$RESET" "${1:-}"; }
warn() { printf '%s%s%s\n' "$AMBER" "$1" "$RESET"; }
die()  { printf '\n%serror:%s %s\n' "$RED" "$RESET" "$1" >&2; exit 1; }

FORCE_RESTART=0
for arg in "$@"; do
  case "$arg" in
    --restart|-r) FORCE_RESTART=1 ;;
    --help|-h)
      sed -n '2,17p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
      exit 0 ;;
    *) die "unknown option: ${arg}   (try --help)" ;;
  esac
done

# Track only what we start, so Ctrl-C never kills a server the user already had.
BACKEND_PID=""
CONSOLE_PID=""
STARTED_OLLAMA=0

cleanup() {
  # Stop only what this run started. An exit that never launched anything --
  # a refusal in the port guard, most importantly -- must leave whatever owns
  # those ports alone. The first version of this killed the user's own
  # already-running servers on its way out of that very check.
  if [ -z "$BACKEND_PID" ] && [ -z "$CONSOLE_PID" ]; then
    return
  fi

  printf '\n%sstopping…%s\n' "$DIM" "$RESET"
  # npm run dev spawns vite as a child and does not forward SIGTERM to it, so
  # the port stays bound unless the listener itself is killed -- but only ever
  # for a port this script bound.
  if [ -n "$CONSOLE_PID" ]; then
    kill "$CONSOLE_PID" 2>/dev/null
    lsof -ti:"$CONSOLE_PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  fi
  if [ -n "$BACKEND_PID" ]; then
    kill "$BACKEND_PID" 2>/dev/null
    lsof -ti:"$BACKEND_PORT" -sTCP:LISTEN 2>/dev/null | xargs kill 2>/dev/null
  fi
  if [ "$STARTED_OLLAMA" = "1" ]; then
    say "${DIM}Ollama was started by this script and is left running.${RESET}"
  fi
  say "stopped."
}
trap cleanup EXIT INT TERM

wait_for() {  # wait_for <label> <seconds> <command...>
  local label="$1" limit="$2"; shift 2
  local i=0
  while [ "$i" -lt "$limit" ]; do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
    i=$((i + 1))
  done
  return 1
}

# Anything that is recognisably this project's own stack. Deliberately narrow:
# reclaiming a port is destructive, so a process we cannot identify is left
# alone unless --restart says otherwise.
OURS_PATTERN='uvicorn main:app|arkaforge|arka-forge|node_modules/.bin/vite|npm run dev'

reclaim_port() {  # reclaim_port <port> <label>
  local port="$1" label="$2" pids cmds
  pids="$(lsof -ti:"${port}" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
  [ -z "${pids// /}" ] && return 0

  cmds="$(ps -o command= -p ${pids} 2>/dev/null)"
  if [ "$FORCE_RESTART" != "1" ] && ! printf '%s' "$cmds" | grep -qiE "$OURS_PATTERN"; then
    die "port ${port} is held by something this script does not recognise:
       $(printf '%s' "$cmds" | head -2)
       Leaving it alone. Re-run with --restart (or: make demo-restart) to take
       the port anyway."
  fi

  kill ${pids} 2>/dev/null
  wait_for "${label}" 10 bash -c "! lsof -ti:${port} -sTCP:LISTEN >/dev/null 2>&1" \
    || { kill -9 ${pids} 2>/dev/null; sleep 1; }

  if lsof -ti:"${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    die "could not free port ${port}. Still held by PID(s): ${pids}"
  fi
  return 0
}

say ""
say "${BOLD}ArkaForge substation twin — demo startup${RESET}"
say ""

# --- 0. Reclaim the ports so a stale session never blocks a demo -------------
step "ports ${BACKEND_PORT}/${CONSOLE_PORT}"
RECLAIMED=""
for spec in "${BACKEND_PORT}:backend" "${CONSOLE_PORT}:console"; do
  port="${spec%%:*}"; label="${spec##*:}"
  if lsof -ti:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
    reclaim_port "$port" "$label"
    RECLAIMED="${RECLAIMED}${label} "
  fi
done
if [ -n "$RECLAIMED" ]; then ok "reclaimed from a previous session (${RECLAIMED% })"; else ok "free"; fi

# --- 1. Which provider will the agent actually use? -------------------------
step "resolving agent provider"
PROVIDER_LINE="$(
  cd backend && uv run --python 3.12 --extra api --extra agent python -c '
from agent.provider import resolve_provider
c = resolve_provider()
print("\t".join([c.kind.value, c.model, c.base_url or ""]))
' 2>/dev/null | tail -1
)"
[ -n "$PROVIDER_LINE" ] || die "could not resolve the agent provider.
       Try:  make install"

PROVIDER_KIND="$(printf '%s' "$PROVIDER_LINE" | cut -f1)"
PROVIDER_MODEL="$(printf '%s' "$PROVIDER_LINE" | cut -f2)"
ok "${PROVIDER_KIND}:${PROVIDER_MODEL}"

# --- 2. Local model: make sure Ollama is up, has the model, and stays warm ---
if [ "$PROVIDER_KIND" = "ollama" ]; then

  step "ollama service"
  if curl -sf -m 3 "${OLLAMA_HOST}/api/tags" >/dev/null 2>&1; then
    ok "already running"
  else
    command -v ollama >/dev/null 2>&1 || die "Ollama is not installed, and no
       ANTHROPIC_API_KEY or OPENAI_API_KEY is set, so the agent has no model to
       reach. Install it from https://ollama.com, or export a hosted key."

    if [ -d "/Applications/Ollama.app" ]; then
      open -a Ollama            # menu-bar app owns the serve process on macOS
    else
      nohup ollama serve >"${LOG_DIR}/ollama.log" 2>&1 &
    fi
    STARTED_OLLAMA=1

    wait_for "ollama" 45 curl -sf -m 3 "${OLLAMA_HOST}/api/tags" \
      || die "Ollama did not start within 45s. Check ${LOG_DIR}/ollama.log"
    ok "started"
  fi

  step "model ${PROVIDER_MODEL}"
  if curl -sf -m 5 "${OLLAMA_HOST}/api/tags" | grep -q "\"${PROVIDER_MODEL}\""; then
    ok "present"
  else
    printf '\n'
    warn "  ${PROVIDER_MODEL} is not pulled yet — downloading (several GB, one time)…"
    ollama pull "$PROVIDER_MODEL" || die "could not pull ${PROVIDER_MODEL}"
    step "model ${PROVIDER_MODEL}"; ok "pulled"
  fi

  # Load it now and pin it, so the first "Run analysis" of the demo is not the
  # one that pays the load cost in front of an audience.
  step "warming model (first load takes ~20s)"
  curl -sf -m 300 "${OLLAMA_HOST}/api/generate" \
    -H 'Content-Type: application/json' \
    -d "{\"model\":\"${PROVIDER_MODEL}\",\"prompt\":\"\",\"keep_alive\":${OLLAMA_KEEP_ALIVE}}" \
    >/dev/null 2>&1 && ok "loaded and pinned" || warn "could not pre-warm (demo still works, first run will be slower)"
fi

# --- 3. Backend --------------------------------------------------------------
step "backend on :${BACKEND_PORT}"
( cd backend && exec uv run --python 3.12 --extra api --extra agent \
    uvicorn main:app --port "$BACKEND_PORT" ) >"$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
wait_for "backend" 90 curl -sf -m 3 "$BACKEND_HEALTH" \
  || die "backend did not come up within 90s. Last lines of ${BACKEND_LOG}:
$(tail -15 "$BACKEND_LOG" 2>/dev/null)"
ok

# --- 4. Console --------------------------------------------------------------
step "console on :${CONSOLE_PORT}"
( cd console && exec npm run dev -- --port "$CONSOLE_PORT" --strictPort ) \
  >"$CONSOLE_LOG" 2>&1 &
CONSOLE_PID=$!
wait_for "console" 90 curl -sf -m 3 "$CONSOLE_URL" \
  || die "console did not come up within 90s. Last lines of ${CONSOLE_LOG}:
$(tail -15 "$CONSOLE_LOG" 2>/dev/null)"
ok

# --- 5. Hand over ------------------------------------------------------------
say ""
say "  ${BOLD}Open:${RESET}  ${BOLD}${CONSOLE_URL}${RESET}"
say "  ${DIM}agent:  ${PROVIDER_KIND}:${PROVIDER_MODEL}${RESET}"
say "  ${DIM}logs:   ${BACKEND_LOG}${RESET}"
say "  ${DIM}        ${CONSOLE_LOG}${RESET}"

if [ "$PROVIDER_KIND" = "ollama" ]; then
  say ""
  warn "  Local model — do not present its prose as authoritative."
  say "  ${DIM}RESEARCH-LOG.md §9: a local 7B stated a net value with the sign"
  say "  flipped from what its own tool returned. The ranked options table reads"
  say "  from tool output, so trust the table over the narrative — and say so if"
  say "  a number is questioned. Set ANTHROPIC_API_KEY for a prospect-facing run.${RESET}"
fi

say ""
say "  ${DIM}Ctrl-C to stop.${RESET}"
say ""

wait
