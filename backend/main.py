"""ArkaForge backend: FastAPI app hosting the console WebSocket + twin sim loop."""

from __future__ import annotations

import contextlib
from collections.abc import AsyncIterator

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api import rest, ws_console

log = structlog.get_logger(__name__)

ALLOWED_ORIGINS = [
    "https://demo.arkaforge.com",
    "http://localhost:5173",
    "http://localhost:3000",
]


@contextlib.asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    await ws_console.manager.start()
    log.info("backend_started")
    try:
        yield
    finally:
        await ws_console.manager.stop()
        log.info("backend_stopped")


app = FastAPI(title="ArkaForge Twin Backend", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"http://localhost:\d+",
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(ws_console.router)
app.include_router(rest.router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
