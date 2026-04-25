"""Receipt Manager - Core business logic for Tool Receipt System
PY-A04-20260425-002

Provides:
  - record_call(tool_name, input_params, ...) -> receipt_id
  - update_result(receipt_id, output, status, duration) -> Receipt
  - get_receipt(receipt_id) -> Receipt | None
  - get_session_receipts(session_id) -> list[Receipt]

Backends:
  - PgReceiptManager:     async, PostgreSQL + asyncpg  (production)
  - SqliteReceiptManager: sync,  SQLite stdlib         (local testing)
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


class ReceiptStatus(str, Enum):
    """Status enum for tool receipts."""

    PENDING = "pending"
    SUCCESS = "success"
    ERROR = "error"
    TIMEOUT = "timeout"


class Receipt(BaseModel):
    """Single tool-call receipt record."""

    receipt_id: str = Field(description="UUID of the receipt")
    session_id: str = Field(description="Session / conversation ID")
    persona_id: str = Field(description="Persona that made the call")
    tool_name: str = Field(description="Name of the tool called")
    input_params: dict[str, Any] = Field(
        default_factory=dict, description="Tool input parameters"
    )
    output: dict[str, Any] | None = Field(
        default=None, description="Tool output"
    )
    status: ReceiptStatus = Field(
        default=ReceiptStatus.PENDING, description="Receipt status"
    )
    created_at: str = Field(description="ISO-8601 creation timestamp")
    updated_at: str = Field(description="ISO-8601 last-update timestamp")
    duration_ms: int | None = Field(
        default=None, description="Execution duration in milliseconds"
    )


# ---------------------------------------------------------------------------
# PostgreSQL backend (production)
# ---------------------------------------------------------------------------


class PgReceiptManager:
    """Async receipt manager backed by PostgreSQL + asyncpg."""

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

    async def record_call(
        self,
        tool_name: str,
        input_params: dict[str, Any],
        session_id: str = "",
        persona_id: str = "",
    ) -> str:
        """Create a new pending receipt. Returns receipt_id."""
        now = datetime.now(timezone.utc)
        rid = str(uuid.uuid4())
        await self._pool.execute(
            """
            INSERT INTO tool_receipts
                (receipt_id, session_id, persona_id, tool_name,
                 input_params, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $7)
            """,
            uuid.UUID(rid),
            session_id,
            persona_id,
            tool_name,
            json.dumps(input_params, ensure_ascii=False),
            ReceiptStatus.PENDING.value,
            now,
        )
        return rid

    async def update_result(
        self,
        receipt_id: str,
        output: dict[str, Any] | None,
        status: ReceiptStatus,
        duration_ms: int | None = None,
    ) -> Receipt | None:
        """Update receipt with tool output and final status."""
        row = await self._pool.fetchrow(
            """
            UPDATE tool_receipts
               SET output      = $2::jsonb,
                   status      = $3,
                   duration_ms = $4
             WHERE receipt_id = $1
            RETURNING *
            """,
            uuid.UUID(receipt_id),
            json.dumps(output, ensure_ascii=False) if output is not None else None,
            status.value,
            duration_ms,
        )
        return _pg_row_to_receipt(row) if row else None

    # ---- read ----

    async def get_receipt(self, receipt_id: str) -> Receipt | None:
        """Fetch a single receipt by ID."""
        row = await self._pool.fetchrow(
            "SELECT * FROM tool_receipts WHERE receipt_id = $1",
            uuid.UUID(receipt_id),
        )
        return _pg_row_to_receipt(row) if row else None

    async def get_session_receipts(self, session_id: str) -> list[Receipt]:
        """Fetch all receipts for a session, ordered by creation time."""
        rows = await self._pool.fetch(
            "SELECT * FROM tool_receipts WHERE session_id = $1 ORDER BY created_at",
            session_id,
        )
        return [_pg_row_to_receipt(r) for r in rows]


def _pg_row_to_receipt(row: asyncpg.Record) -> Receipt:
    """Convert an asyncpg Record to a Receipt model."""
    return Receipt(
        receipt_id=str(row["receipt_id"]),
        session_id=row["session_id"],
        persona_id=row["persona_id"],
        tool_name=row["tool_name"],
        input_params=(
            json.loads(row["input_params"])
            if isinstance(row["input_params"], str)
            else row["input_params"]
        ),
        output=(
            json.loads(row["output"])
            if isinstance(row["output"], str)
            else row["output"]
        ),
        status=ReceiptStatus(row["status"]),
        created_at=row["created_at"].isoformat(),
        updated_at=row["updated_at"].isoformat(),
        duration_ms=row["duration_ms"],
    )


# ---------------------------------------------------------------------------
# SQLite backend (local testing fallback)
# ---------------------------------------------------------------------------


class SqliteReceiptManager:
    """Sync receipt manager backed by SQLite (for local testing)."""

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
            CREATE TABLE IF NOT EXISTS tool_receipts (
                receipt_id   TEXT PRIMARY KEY,
                session_id   TEXT NOT NULL,
                persona_id   TEXT NOT NULL,
                tool_name    TEXT NOT NULL,
                input_params TEXT NOT NULL DEFAULT '{}',
                output       TEXT,
                status       TEXT NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','success','error','timeout')),
                created_at   TEXT NOT NULL,
                updated_at   TEXT NOT NULL,
                duration_ms  INTEGER
            )
            """
        )
        self._conn.commit()

    def close(self) -> None:
        """Close the database connection."""
        if self._conn:
            self._conn.close()

    # ---- write ----

    def record_call(
        self,
        tool_name: str,
        input_params: dict[str, Any],
        session_id: str = "",
        persona_id: str = "",
    ) -> str:
        """Create a new pending receipt. Returns receipt_id."""
        now = datetime.now(timezone.utc).isoformat()
        rid = str(uuid.uuid4())
        self._conn.execute(
            """
            INSERT INTO tool_receipts
                (receipt_id, session_id, persona_id, tool_name,
                 input_params, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                rid,
                session_id,
                persona_id,
                tool_name,
                json.dumps(input_params, ensure_ascii=False),
                ReceiptStatus.PENDING.value,
                now,
                now,
            ),
        )
        self._conn.commit()
        return rid

    def update_result(
        self,
        receipt_id: str,
        output: dict[str, Any] | None,
        status: ReceiptStatus,
        duration_ms: int | None = None,
    ) -> Receipt | None:
        """Update receipt with tool output and final status."""
        now = datetime.now(timezone.utc).isoformat()
        self._conn.execute(
            """
            UPDATE tool_receipts
               SET output      = ?,
                   status      = ?,
                   duration_ms = ?,
                   updated_at  = ?
             WHERE receipt_id = ?
            """,
            (
                json.dumps(output, ensure_ascii=False) if output is not None else None,
                status.value,
                duration_ms,
                now,
                receipt_id,
            ),
        )
        self._conn.commit()
        return self.get_receipt(receipt_id)

    # ---- read ----

    def get_receipt(self, receipt_id: str) -> Receipt | None:
        """Fetch a single receipt by ID."""
        cur = self._conn.execute(
            "SELECT * FROM tool_receipts WHERE receipt_id = ?",
            (receipt_id,),
        )
        row = cur.fetchone()
        return _sqlite_row_to_receipt(row) if row else None

    def get_session_receipts(self, session_id: str) -> list[Receipt]:
        """Fetch all receipts for a session, ordered by creation time."""
        cur = self._conn.execute(
            "SELECT * FROM tool_receipts WHERE session_id = ? ORDER BY created_at",
            (session_id,),
        )
        return [_sqlite_row_to_receipt(r) for r in cur.fetchall()]


def _sqlite_row_to_receipt(row: sqlite3.Row) -> Receipt:
    """Convert a sqlite3.Row to a Receipt model."""
    return Receipt(
        receipt_id=row["receipt_id"],
        session_id=row["session_id"],
        persona_id=row["persona_id"],
        tool_name=row["tool_name"],
        input_params=json.loads(row["input_params"]),
        output=json.loads(row["output"]) if row["output"] else None,
        status=ReceiptStatus(row["status"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        duration_ms=row["duration_ms"],
    )
