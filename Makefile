PY := 3.12
UV := uv run --python $(PY)
BACKEND := cd backend &&
CONSOLE := cd console &&

.PHONY: demo demo-restart dev backend console sim typecheck lint test test-e2e install build record

# One command to show this to someone. Reclaims the ports from a previous demo,
# starts Ollama if the agent resolves to a local model (and pre-loads it, so the
# first analysis is not the slow one), then backend + console, waiting until each
# actually answers. Ctrl-C stops it.
demo:
	@./scripts/demo.sh

# Same, but takes ports 8000/5173 from whatever holds them -- including a process
# this script cannot identify as ours. For when a stale session must not stand
# between you and a live demo.
demo-restart:
	@./scripts/demo.sh --restart

install:
	$(BACKEND) uv sync --python $(PY) --extra dev --extra api --extra sim --extra agent
	$(CONSOLE) npm install

# --extra agent is not optional: without it the app imports but `agent_invoke`
# fails at runtime, which is the kind of thing that only shows up mid-demo.
backend:
	$(BACKEND) $(UV) --extra api --extra agent uvicorn main:app --reload --port 8000

console:
	$(CONSOLE) npm run dev

# Backend + console concurrently. The console dev server proxies /api and /ws
# to the backend, so both are reachable on http://localhost:5173.
dev:
	@$(MAKE) -j2 backend console

# Headless physics runner for validation by eye.
sim:
	$(BACKEND) $(UV) python -m sim

build:
	$(CONSOLE) npm run build

# Capture a scenario run to static JSON so the console can play it back when the
# backend or GPU host is unreachable (docs/architecture.md fallbacks).
record:
	$(BACKEND) $(UV) --extra api --extra agent python -m sim.record

# Backend physics + console unit/component tests. Fast; no servers needed.
test:
	$(BACKEND) $(UV) --extra dev --extra api --extra agent pytest -q
	$(CONSOLE) npm run test

# Browser-level flows in real Chrome. Separate target because it starts its own
# Vite server (and a backend, for the live-handover spec), so it is slower and
# needs the ports free. Uses the installed Chrome -- no browser download.
test-e2e:
	$(CONSOLE) npm run test:e2e

lint:
	$(BACKEND) $(UV) --extra dev ruff check .
	$(CONSOLE) npm run lint

typecheck:
	$(BACKEND) $(UV) --extra dev --extra api --extra sim --extra agent --with pyright pyright
	$(CONSOLE) npm run typecheck
