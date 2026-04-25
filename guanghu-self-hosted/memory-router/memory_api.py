"""Memory API - FastAPI routes for Memory Router
PY-A04-20260425-003

Endpoints:
  POST   /route                          -> route query, return assembled context
  POST   /memories                       -> write memory
  GET    /memories/search                 -> semantic search
  GET    /memories/permanent/{persona_id} -> get permanent memories
  POST   /compress                        -> compress conversation to HLDP
"""
from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from config import settings
from memory_compressor import ConversationTurn, MemoryCompressor, SessionSummary
from memory_router import (
    AssembledContext,
    ContextNeed,
    MemoryRouter,
    RoutingDecision,
)
from memory_store import (
    Memory,
    MemoryType,
    PgMemoryStore,
    SqliteMemoryStore,
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------


class RouteRequest(BaseModel):
    """Body for POST /route."""

    user_input: str = Field(description="User's message")
    session_id: str = Field(default="", description="Session ID")
    persona_id: str = Field(default="", description="Persona ID")
    query_embedding: list[float] | None = Field(
        default=None, description="Optional embedding for semantic search"
    )


class WriteMemoryRequest(BaseModel):
    """Body for POST /memories."""

    persona_id: str = Field(description="Persona ID")
    content: str = Field(description="Memory content")
    memory_type: MemoryType = Field(
        default=MemoryType.COLD, description="Memory type"
    )
    session_id: str = Field(default="", description="Session ID")
    embedding: list[float] | None = Field(
        default=None, description="Content embedding vector"
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class SearchRequest(BaseModel):
    """Query params for GET /memories/search."""

    query_embedding: list[float] = Field(
        description="Query embedding vector"
    )
    persona_id: str = Field(description="Persona ID")
    top_k: int = Field(default=5, description="Number of results")


class CompressRequest(BaseModel):
    """Body for POST /compress."""

    session_id: str = Field(default="", description="Session ID")
    persona_id: str = Field(default="", description="Persona ID")
    turns: list[ConversationTurn] = Field(
        description="Conversation turns to compress"
    )


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

_store: PgMemoryStore | SqliteMemoryStore | None = None
_router_instance: MemoryRouter | None = None
_compressor = MemoryCompressor()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown hook."""
    global _store, _router_instance
    if settings.use_sqlite:
        store = SqliteMemoryStore()
        store.connect()
        _store = store
    else:
        store = PgMemoryStore()
        await store.connect()
        _store = store
    _router_instance = MemoryRouter(store=_store)
    yield
    if isinstance(_store, PgMemoryStore):
        await _store.close()
    elif isinstance(_store, SqliteMemoryStore):
        _store.close()


app = FastAPI(
    title="Memory Router",
    description="HLDP-ARCH-001 L3 · Memory routing, storage, and compression",
    version="0.1.0",
    lifespan=lifespan,
)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@app.post("/route", response_model=AssembledContext)
async def route_query(body: RouteRequest):
    """Route a user query and return assembled context."""
    decision = _router_instance.route_query(
        user_input=body.user_input,
        session_id=body.session_id,
        persona_id=body.persona_id,
    )
    if isinstance(_store, PgMemoryStore):
        context = await _router_instance.assemble_context_async(
            decision=decision,
            query_embedding=body.query_embedding,
        )
    else:
        context = _router_instance.assemble_context_sync(
            decision=decision,
            query_embedding=body.query_embedding,
        )
    return context


@app.post("/memories", status_code=201)
async def write_memory(body: WriteMemoryRequest):
    """Write a memory to the store."""
    if body.memory_type in (MemoryType.HOT, MemoryType.WARM):
        if isinstance(_store, PgMemoryStore):
            mid = await _store.write_short_term(
                session_id=body.session_id,
                summary=body.content,
                persona_id=body.persona_id,
                embedding=body.embedding,
            )
        else:
            mid = _store.write_short_term(
                session_id=body.session_id,
                summary=body.content,
                persona_id=body.persona_id,
                embedding=body.embedding,
            )
    else:
        if isinstance(_store, PgMemoryStore):
            mid = await _store.write_long_term(
                persona_id=body.persona_id,
                content=body.content,
                memory_type=body.memory_type,
                session_id=body.session_id,
                embedding=body.embedding,
                metadata=body.metadata,
            )
        else:
            mid = _store.write_long_term(
                persona_id=body.persona_id,
                content=body.content,
                memory_type=body.memory_type,
                session_id=body.session_id,
                embedding=body.embedding,
                metadata=body.metadata,
            )
    return {"memory_id": mid}


@app.post("/memories/search")
async def search_memories(body: SearchRequest):
    """Semantic search over memories."""
    if isinstance(_store, PgMemoryStore):
        results = await _store.search_semantic(
            query_embedding=body.query_embedding,
            persona_id=body.persona_id,
            top_k=body.top_k,
        )
    else:
        results = _store.search_semantic(
            query_embedding=body.query_embedding,
            persona_id=body.persona_id,
            top_k=body.top_k,
        )
    return {"count": len(results), "memories": [m.model_dump() for m in results]}


@app.get("/memories/permanent/{persona_id}")
async def get_permanent_memories(persona_id: str):
    """Get all permanent memories for a persona."""
    if isinstance(_store, PgMemoryStore):
        memories = await _store.get_permanent(persona_id)
    else:
        memories = _store.get_permanent(persona_id)
    return {
        "persona_id": persona_id,
        "count": len(memories),
        "memories": [m.model_dump() for m in memories],
    }


@app.post("/compress", response_model=SessionSummary)
async def compress_conversation(body: CompressRequest):
    """Compress conversation turns into HLDP summary."""
    summary = _compressor.summarize_session(
        session_id=body.session_id,
        persona_id=body.persona_id,
        turns=body.turns,
    )
    return summary


# ---------------------------------------------------------------------------
# Standalone runner
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "memory_api:app",
        host=settings.api_host,
        port=settings.api_port,
        reload=True,
    )
