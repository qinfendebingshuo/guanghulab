"""Memory Store - Storage layer for Memory Router
PY-A04-20260425-003

Provides:
  - write_short_term(session_id, summary, persona_id) -> memory_id
  - write_long_term(persona_id, content, memory_type, ...) -> memory_id
  - search_semantic(query_embedding, persona_id, top_k) -> list[Memory]
  - get_permanent(persona_id) -> list[Memory]

Backends:
  - PgMemoryStore:     async, PostgreSQL + pgvector  (production)
  - SqliteMemoryStore: sync,  SQLite stdlib          (local testing, semantic mock)
"""
from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

import asyncpg
from pydantic import BaseModel, Field

from config import settings


# ---------------------------------------------------------------------------
# Domain models
# ---------------------------------------------------------------------------


class MemoryType(str, Enum):
    """Memory type enum matching L3 architecture."""

    HOT = "hot"
    WARM = "warm"
    COLD = "cold"
    PERMANENT = "permanent"


class MemoryStatus(str, Enum):
    """Memory status."""

    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"


class Memory(BaseModel):
    """Single memory record."""

    memory_id: str = Field(description="UUID of the memory")
    persona_id: str = Field(description="Persona that owns this memory")
    session_id: str = Field(default="", description="Session ID")
    memory_type: MemoryType = Field(description="hot/warm/cold/permanent")
    content: str = Field(description="Memory content (plain text or HLDP)")
    created_at: str = Field(description="ISO-8601 creation timestamp")
    accessed_at: str = Field(description="ISO-8601 last-access timestamp")
    access_count: int = Field(default=0, description="Number of accesses")
    status: MemoryStatus = Field(default=MemoryStatus.ACTIVE)
    metadata: dict[str, Any] = Field(default_factory=dict)
    similarity: float | None = Field(
        default=None, description="Cosine similarity score (search results only)"
    )


# ---------------------------------------------------------------------------
# PostgreSQL backend (production)
# ---------------------------------------------------------------------------


class PgMemoryStore:
    """Async memory store backed by PostgreSQL + pgvector."""

    def __init__(self) -> None:
        self._pool: asyncpg.Pool | None = None

    async def connect(self) -> None:
        """Create the asyncpg connection pool."""
        self._pool = await asyncpg.create_pool(
            host=settings.db.host,
            port=settings.db.port,
            database=settings.db.name,
            user=settings.db.user,
            password=settings.db.password,
            min_size=settings.db.min_pool,
            max_size=settings.db.max_pool,
        )

    async def close(self) -> None:
        """Close the connection pool."""
        if self._pool:
            await self._pool.close()

    # ---- write ----

    async def write_short_term(
        self,
        session_id: str,
        summary: str,
        persona_id: str,
        embedding: list[float] | None = None,
    ) -> str:
        """Write a short-term (hot) memory. Returns memory_id."""
        return await self._write(
            persona_id=persona_id,
            session_id=session_id,
            memory_type=MemoryType.HOT,
            content=summary,
            embedding=embedding,
        )

    async def write_long_term(
        self,
        persona_id: str,
        content: str,
        memory_type: MemoryType = MemoryType.COLD,
        session_id: str = "",
        embedding: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Write a long-term memory. Returns memory_id."""
        return await self._write(
            persona_id=persona_id,
            session_id=session_id,
            memory_type=memory_type,
            content=content,
            embedding=embedding,
            metadata=metadata,
        )

    async def _write(
        self,
        persona_id: str,
        session_id: str,
        memory_type: MemoryType,
        content: str,
        embedding: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Internal: insert a memory row."""
        mid = str(uuid.uuid4())
        emb_str = _format_pgvector(embedding) if embedding else None
        meta_json = json.dumps(metadata or {}, ensure_ascii=False)
        await self._pool.execute(
            """
            INSERT INTO memories
                (memory_id, persona_id, session_id, memory_type,
                 content, embedding, metadata)
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7::jsonb)
            """,
            uuid.UUID(mid),
            persona_id,
            session_id,
            memory_type.value,
            content,
            emb_str,
            meta_json,
        )
        return mid

    # ---- read ----

    async def search_semantic(
        self,
        query_embedding: list[float],
        persona_id: str,
        top_k: int | None = None,
    ) -> list[Memory]:
        """Semantic search via pgvector cosine similarity."""
        k = top_k or settings.cold_search_top_k
        emb_str = _format_pgvector(query_embedding)
        rows = await self._pool.fetch(
            """
            SELECT *,
                   1 - (embedding <=> $1::vector) AS similarity
              FROM memories
             WHERE persona_id = $2
               AND status = 'active'
               AND embedding IS NOT NULL
             ORDER BY embedding <=> $1::vector
             LIMIT $3
            """,
            emb_str,
            persona_id,
            k,
        )
        return [_pg_row_to_memory(r, similarity=r["similarity"]) for r in rows]

    async def get_permanent(self, persona_id: str) -> list[Memory]:
        """Get all permanent memories for a persona."""
        rows = await self._pool.fetch(
            """
            SELECT * FROM memories
             WHERE persona_id = $1
               AND memory_type = 'permanent'
               AND status = 'active'
             ORDER BY created_at
            """,
            persona_id,
        )
        return [_pg_row_to_memory(r) for r in rows]

    async def get_session_memories(
        self, session_id: str, memory_type: MemoryType | None = None
    ) -> list[Memory]:
        """Get memories for a session, optionally filtered by type."""
        if memory_type:
            rows = await self._pool.fetch(
                """
                SELECT * FROM memories
                 WHERE session_id = $1
                   AND memory_type = $2
                   AND status = 'active'
                 ORDER BY created_at DESC
                """,
                session_id,
                memory_type.value,
            )
        else:
            rows = await self._pool.fetch(
                """
                SELECT * FROM memories
                 WHERE session_id = $1
                   AND status = 'active'
                 ORDER BY created_at DESC
                """,
                session_id,
            )
        return [_pg_row_to_memory(r) for r in rows]


def _format_pgvector(embedding: list[float]) -> str:
    """Format a list of floats as a pgvector string literal."""
    return "[" + ",".join(str(v) for v in embedding) + "]"


def _pg_row_to_memory(
    row: asyncpg.Record, similarity: float | None = None
) -> Memory:
    """Convert an asyncpg Record to a Memory model."""
    return Memory(
        memory_id=str(row["memory_id"]),
        persona_id=row["persona_id"],
        session_id=row["session_id"],
        memory_type=MemoryType(row["memory_type"]),
        content=row["content"],
        created_at=row["created_at"].isoformat(),
        accessed_at=row["accessed_at"].isoformat(),
        access_count=row["access_count"],
        status=MemoryStatus(row["status"]),
        metadata=(
            json.loads(row["metadata"])
            if isinstance(row["metadata"], str)
            else (row["metadata"] or {})
        ),
        similarity=similarity,
    )


# ---------------------------------------------------------------------------
# SQLite backend (local testing fallback)
# ---------------------------------------------------------------------------


class SqliteMemoryStore:
    """Sync memory store backed by SQLite (for local testing).

    Note: Semantic search is NOT supported in SQLite.
    search_semantic() returns an empty list. Use mock embeddings in tests.
    """

    def __init__(self, db_path: str | None = None) -> None:
        self._db_path = db_path or settings.sqlite_path
        self._conn: sqlite3.Connection | None = None

    def connect(self) -> None:
        """Open (or create) the SQLite database and ensure the table exists."""
        Path(self._db_path).parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(self._db_path)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS memories (
                memory_id    TEXT PRIMARY KEY,
                persona_id   TEXT NOT NULL,
                session_id   TEXT NOT NULL DEFAULT '',
                memory_type  TEXT NOT NULL
                             CHECK (memory_type IN ('hot','warm','cold','permanent')),
                content      TEXT NOT NULL,
                created_at   TEXT NOT NULL,
                accessed_at  TEXT NOT NULL,
                access_count INTEGER NOT NULL DEFAULT 0,
                status       TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','archived','deleted')),
                metadata     TEXT DEFAULT '{}'
            )
            """
        )
        self._conn.commit()

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()

    # ---- write ----

    def write_short_term(
        self,
        session_id: str,
        summary: str,
        persona_id: str,
        embedding: list[float] | None = None,
    ) -> str:
        """Write a short-term (hot) memory. Returns memory_id."""
        return self._write(
            persona_id=persona_id,
            session_id=session_id,
            memory_type=MemoryType.HOT,
            content=summary,
        )

    def write_long_term(
        self,
        persona_id: str,
        content: str,
        memory_type: MemoryType = MemoryType.COLD,
        session_id: str = "",
        embedding: list[float] | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Write a long-term memory. Returns memory_id."""
        return self._write(
            persona_id=persona_id,
            session_id=session_id,
            memory_type=memory_type,
            content=content,
            metadata=metadata,
        )

    def _write(
        self,
        persona_id: str,
        session_id: str,
        memory_type: MemoryType,
        content: str,
        metadata: dict[str, Any] | None = None,
    ) -> str:
        """Internal: insert a memory row."""
        now = datetime.now(timezone.utc).isoformat()
        mid = str(uuid.uuid4())
        self._conn.execute(
            """
            INSERT INTO memories
                (memory_id, persona_id, session_id, memory_type,
                 content, created_at, accessed_at, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                mid,
                persona_id,
                session_id,
                memory_type.value,
                content,
                now,
                now,
                json.dumps(metadata or {}, ensure_ascii=False),
            ),
        )
        self._conn.commit()
        return mid

    # ---- read ----

    def search_semantic(
        self,
        query_embedding: list[float],
        persona_id: str,
        top_k: int | None = None,
    ) -> list[Memory]:
        """Semantic search stub - SQLite has no pgvector. Returns empty list."""
        return []

    def get_permanent(self, persona_id: str) -> list[Memory]:
        """Get all permanent memories for a persona."""
        cur = self._conn.execute(
            """
            SELECT * FROM memories
             WHERE persona_id = ?
               AND memory_type = 'permanent'
               AND status = 'active'
             ORDER BY created_at
            """,
            (persona_id,),
        )
        return [_sqlite_row_to_memory(r) for r in cur.fetchall()]

    def get_session_memories(
        self, session_id: str, memory_type: MemoryType | None = None
    ) -> list[Memory]:
        """Get memories for a session, optionally filtered by type."""
        if memory_type:
            cur = self._conn.execute(
                """
                SELECT * FROM memories
                 WHERE session_id = ?
                   AND memory_type = ?
                   AND status = 'active'
                 ORDER BY created_at DESC
                """,
                (session_id, memory_type.value),
            )
        else:
            cur = self._conn.execute(
                """
                SELECT * FROM memories
                 WHERE session_id = ?
                   AND status = 'active'
                 ORDER BY created_at DESC
                """,
                (session_id,),
            )
        return [_sqlite_row_to_memory(r) for r in cur.fetchall()]

    def get_memory(self, memory_id: str) -> Memory | None:
        """Fetch a single memory by ID."""
        cur = self._conn.execute(
            "SELECT * FROM memories WHERE memory_id = ?",
            (memory_id,),
        )
        row = cur.fetchone()
        return _sqlite_row_to_memory(row) if row else None


def _sqlite_row_to_memory(row: sqlite3.Row) -> Memory:
    """Convert a sqlite3.Row to a Memory model."""
    return Memory(
        memory_id=row["memory_id"],
        persona_id=row["persona_id"],
        session_id=row["session_id"],
        memory_type=MemoryType(row["memory_type"]),
        content=row["content"],
        created_at=row["created_at"],
        accessed_at=row["accessed_at"],
        access_count=row["access_count"],
        status=MemoryStatus(row["status"]),
        metadata=json.loads(row["metadata"]) if row["metadata"] else {},
    )
