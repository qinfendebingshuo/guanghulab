"""receipt_store.py — 回执存储层

Phase-0-007 · YD-A05-20260425-005

职责:
    · PostgreSQL tool_receipts 表定义
    · asyncpg 连接池管理
    · CRUD 操作
    · 按 session / persona / 时间范围查询

表结构:
    tool_receipts (
        id              UUID PRIMARY KEY,
        session_id      VARCHAR(128) NOT NULL,
        persona_id      VARCHAR(32)  NOT NULL,
        tool_name       VARCHAR(128) NOT NULL,
        input_params    JSONB,
        output_result   JSONB,
        status          VARCHAR(16)  NOT NULL,  -- success / failure / timeout
        error_message   TEXT,
        timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
        duration_ms     INTEGER
    )
"""

from __future__ import annotations

import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

try:
    import asyncpg
except ImportError:
    asyncpg = None  # type: ignore[assignment]

logger = logging.getLogger("tool_receipt.store")

# ── 数据模型 ──────────────────────────────────────────────

_VALID_STATUSES = frozenset({"success", "failure", "timeout"})


@dataclass
class ReceiptRecord:
    """单条工具回执记录。"""

    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str = ""
    persona_id: str = ""
    tool_name: str = ""
    input_params: dict[str, Any] = field(default_factory=dict)
    output_result: dict[str, Any] = field(default_factory=dict)
    status: str = "success"
    error_message: str | None = None
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    duration_ms: int = 0

    def __post_init__(self) -> None:
        if self.status not in _VALID_STATUSES:
            raise ValueError(
                f"status 必须是 {_VALID_STATUSES} 之一，收到: {self.status!r}"
            )


# ── DDL ───────────────────────────────────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS tool_receipts (
    id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      VARCHAR(128) NOT NULL,
    persona_id      VARCHAR(32)  NOT NULL,
    tool_name       VARCHAR(128) NOT NULL,
    input_params    JSONB,
    output_result   JSONB,
    status          VARCHAR(16)  NOT NULL
                    CHECK (status IN ('success', 'failure', 'timeout')),
    error_message   TEXT,
    timestamp       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    duration_ms     INTEGER
);

CREATE INDEX IF NOT EXISTS idx_tool_receipts_session
    ON tool_receipts (session_id);
CREATE INDEX IF NOT EXISTS idx_tool_receipts_persona
    ON tool_receipts (persona_id);
CREATE INDEX IF NOT EXISTS idx_tool_receipts_timestamp
    ON tool_receipts (timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_tool_receipts_tool_name
    ON tool_receipts (tool_name);

COMMENT ON TABLE  tool_receipts              IS '工具回执系统 · 每次工具调用留痕';
COMMENT ON COLUMN tool_receipts.session_id   IS '对话会话 ID';
COMMENT ON COLUMN tool_receipts.persona_id   IS '执行人格体编号';
COMMENT ON COLUMN tool_receipts.tool_name    IS '工具名称';
COMMENT ON COLUMN tool_receipts.input_params IS '工具输入参数 JSONB';
COMMENT ON COLUMN tool_receipts.output_result IS '工具输出结果 JSONB';
COMMENT ON COLUMN tool_receipts.status       IS '状态: success / failure / timeout';
COMMENT ON COLUMN tool_receipts.error_message IS '失败时的错误信息';
COMMENT ON COLUMN tool_receipts.duration_ms  IS '调用耗时(毫秒)';
"""

# ── DSN 构建 ──────────────────────────────────────────────


def _get_dsn() -> str:
    """从环境变量构建 PostgreSQL DSN。

    支持环境变量:
        PERSONA_DB_DSN          — 完整 DSN（优先）
        PERSONA_DB_HOST         — 主机 (默认 127.0.0.1)
        PERSONA_DB_PORT         — 端口 (默认 5432)
        PERSONA_DB_USER         — 用户 (默认 postgres)
        PERSONA_DB_PASSWORD     — 密码
        PERSONA_DB_NAME         — 数据库名 (默认 persona_db)
    """
    dsn = os.environ.get("PERSONA_DB_DSN")
    if dsn:
        return dsn
    host = os.environ.get("PERSONA_DB_HOST", "127.0.0.1")
    port = os.environ.get("PERSONA_DB_PORT", "5432")
    user = os.environ.get("PERSONA_DB_USER", "postgres")
    password = os.environ.get("PERSONA_DB_PASSWORD", "")
    dbname = os.environ.get("PERSONA_DB_NAME", "persona_db")
    return f"postgresql://{user}:{password}@{host}:{port}/{dbname}"


# ── Store 类 ──────────────────────────────────────────────


class ReceiptStore:
    """工具回执 PostgreSQL 存储层。

    使用 asyncpg 连接池，与 PersonaDB 共享同一 PostgreSQL 实例。
    """

    def __init__(self, dsn: str | None = None, pool: Any | None = None) -> None:
        self._dsn = dsn or _get_dsn()
        self._pool: asyncpg.Pool | None = pool  # type: ignore[assignment]

    # ── 生命周期 ──────────────────────────────────────────

    async def connect(self) -> None:
        """初始化连接池并确保表存在。"""
        if asyncpg is None:
            raise RuntimeError("asyncpg 未安装，请执行: pip install asyncpg")
        if self._pool is None:
            self._pool = await asyncpg.create_pool(
                self._dsn, min_size=1, max_size=5
            )
            logger.info("连接池已创建: %s", self._dsn.split("@")[-1])
        await self._ensure_table()

    async def close(self) -> None:
        """关闭连接池。"""
        if self._pool is not None:
            await self._pool.close()
            self._pool = None
            logger.info("连接池已关闭")

    async def _ensure_table(self) -> None:
        """确保 tool_receipts 表和索引存在。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            await conn.execute(CREATE_TABLE_SQL)
        logger.info("tool_receipts 表已就绪")

    # ── 写入 ──────────────────────────────────────────────

    async def insert(self, record: ReceiptRecord) -> ReceiptRecord:
        """插入单条回执记录。"""
        assert self._pool is not None, "请先调用 connect()"
        import json as _json

        async with self._pool.acquire() as conn:
            await conn.execute(
                """
                INSERT INTO tool_receipts
                    (id, session_id, persona_id, tool_name,
                     input_params, output_result, status,
                     error_message, timestamp, duration_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                uuid.UUID(record.id),
                record.session_id,
                record.persona_id,
                record.tool_name,
                _json.dumps(record.input_params, ensure_ascii=False),
                _json.dumps(record.output_result, ensure_ascii=False),
                record.status,
                record.error_message,
                record.timestamp,
                record.duration_ms,
            )
        logger.debug("回执已写入: %s / %s", record.tool_name, record.id)
        return record

    async def insert_batch(self, records: list[ReceiptRecord]) -> list[ReceiptRecord]:
        """批量插入回执记录。"""
        assert self._pool is not None, "请先调用 connect()"
        import json as _json

        rows = [
            (
                uuid.UUID(r.id),
                r.session_id,
                r.persona_id,
                r.tool_name,
                _json.dumps(r.input_params, ensure_ascii=False),
                _json.dumps(r.output_result, ensure_ascii=False),
                r.status,
                r.error_message,
                r.timestamp,
                r.duration_ms,
            )
            for r in records
        ]
        async with self._pool.acquire() as conn:
            await conn.executemany(
                """
                INSERT INTO tool_receipts
                    (id, session_id, persona_id, tool_name,
                     input_params, output_result, status,
                     error_message, timestamp, duration_ms)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                """,
                rows,
            )
        logger.debug("批量写入 %d 条回执", len(records))
        return records

    # ── 查询 ──────────────────────────────────────────────

    async def get_by_id(self, receipt_id: str) -> ReceiptRecord | None:
        """按 ID 查询单条回执。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            row = await conn.fetchrow(
                "SELECT * FROM tool_receipts WHERE id = $1",
                uuid.UUID(receipt_id),
            )
        return self._row_to_record(row) if row else None

    async def query_by_session(
        self, session_id: str, limit: int = 100
    ) -> list[ReceiptRecord]:
        """按 session_id 查询回执（按时间倒序）。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM tool_receipts
                WHERE session_id = $1
                ORDER BY timestamp DESC
                LIMIT $2
                """,
                session_id,
                limit,
            )
        return [self._row_to_record(r) for r in rows]

    async def query_by_persona(
        self, persona_id: str, limit: int = 100
    ) -> list[ReceiptRecord]:
        """按 persona_id 查询回执（按时间倒序）。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM tool_receipts
                WHERE persona_id = $1
                ORDER BY timestamp DESC
                LIMIT $2
                """,
                persona_id,
                limit,
            )
        return [self._row_to_record(r) for r in rows]

    async def query_by_time_range(
        self,
        start: datetime,
        end: datetime,
        persona_id: str | None = None,
        limit: int = 500,
    ) -> list[ReceiptRecord]:
        """按时间范围查询回执（可选 persona 过滤）。"""
        assert self._pool is not None, "请先调用 connect()"
        if persona_id:
            query = """
                SELECT * FROM tool_receipts
                WHERE timestamp >= $1 AND timestamp <= $2
                  AND persona_id = $3
                ORDER BY timestamp DESC
                LIMIT $4
            """
            params: tuple[Any, ...] = (start, end, persona_id, limit)
        else:
            query = """
                SELECT * FROM tool_receipts
                WHERE timestamp >= $1 AND timestamp <= $2
                ORDER BY timestamp DESC
                LIMIT $3
            """
            params = (start, end, limit)
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(query, *params)
        return [self._row_to_record(r) for r in rows]

    async def query_by_tool_name(
        self, tool_name: str, limit: int = 100
    ) -> list[ReceiptRecord]:
        """按工具名称查询回执。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT * FROM tool_receipts
                WHERE tool_name = $1
                ORDER BY timestamp DESC
                LIMIT $2
                """,
                tool_name,
                limit,
            )
        return [self._row_to_record(r) for r in rows]

    # ── 删除 ──────────────────────────────────────────────

    async def delete_by_id(self, receipt_id: str) -> bool:
        """按 ID 删除单条回执。"""
        assert self._pool is not None, "请先调用 connect()"
        async with self._pool.acquire() as conn:
            result = await conn.execute(
                "DELETE FROM tool_receipts WHERE id = $1",
                uuid.UUID(receipt_id),
            )
        return result == "DELETE 1"

    # ── 内部工具 ──────────────────────────────────────────

    @staticmethod
    def _row_to_record(row: Any) -> ReceiptRecord:
        """将 asyncpg Row 转换为 ReceiptRecord。"""
        import json as _json

        input_params = row["input_params"]
        output_result = row["output_result"]
        if isinstance(input_params, str):
            input_params = _json.loads(input_params)
        if isinstance(output_result, str):
            output_result = _json.loads(output_result)

        return ReceiptRecord(
            id=str(row["id"]),
            session_id=row["session_id"],
            persona_id=row["persona_id"],
            tool_name=row["tool_name"],
            input_params=input_params or {},
            output_result=output_result or {},
            status=row["status"],
            error_message=row["error_message"],
            timestamp=row["timestamp"],
            duration_ms=row["duration_ms"] or 0,
        )
