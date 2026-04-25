"""GH-API-001 · 工单领取API · 数据库层

asyncpg连接池 · 工单CRUD · 执行日志
编号前缀: GH-API · 培园A04
"""
import asyncpg
import json
import logging
from datetime import datetime, timezone
from typing import Optional

from config import settings

logger = logging.getLogger("work-order-api.db")

_pool: Optional[asyncpg.Pool] = None


# ========== 连接池管理 ==========

async def init_pool() -> asyncpg.Pool:
    """初始化连接池"""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
    )
    logger.info("Database pool initialized")
    return _pool


async def close_pool() -> None:
    """关闭连接池"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
        logger.info("Database pool closed")


async def get_pool() -> asyncpg.Pool:
    """获取连接池"""
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized")
    return _pool


async def check_connection() -> bool:
    """检查数据库连接"""
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            await conn.fetchval("SELECT 1")
        return True
    except Exception as exc:
        logger.error("Database connection check failed: %s", exc)
        return False


# ========== 建表DDL ==========

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS work_orders (
    id              SERIAL PRIMARY KEY,
    title           TEXT NOT NULL,
    order_code      TEXT NOT NULL UNIQUE,
    phase_code      TEXT,
    priority        TEXT NOT NULL DEFAULT 'P1',
    status          TEXT NOT NULL DEFAULT 'pending',
    description     TEXT NOT NULL DEFAULT '',
    repo_path       TEXT,
    branch_name     TEXT,
    constraints_    TEXT,
    assigned_agent  TEXT,
    self_check_result TEXT,
    review_result   TEXT,
    next_guide      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wo_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_wo_agent  ON work_orders(assigned_agent);
CREATE INDEX IF NOT EXISTS idx_wo_code   ON work_orders(order_code);

CREATE TABLE IF NOT EXISTS execution_logs (
    id          SERIAL PRIMARY KEY,
    order_id    INT NOT NULL REFERENCES work_orders(id),
    level       TEXT NOT NULL DEFAULT 'INFO',
    message     TEXT NOT NULL,
    step        TEXT,
    metadata_   JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_log_order ON execution_logs(order_id);
"""


async def ensure_tables() -> None:
    """确保表存在"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute(CREATE_TABLES_SQL)
    logger.info("Database tables ensured")


# ========== 工单查询 ==========

def _row_to_dict(row: asyncpg.Record) -> dict:
    """asyncpg Record -> dict"""
    d = dict(row)
    # 重命名 constraints_ -> constraints
    if "constraints_" in d:
        d["constraints"] = d.pop("constraints_")
    # 重命名 metadata_ -> metadata
    if "metadata_" in d:
        raw = d.pop("metadata_")
        d["metadata"] = json.loads(raw) if raw else None
    return d


async def get_pending_orders(agent_id: Optional[str] = None) -> list[dict]:
    """查询待领取工单"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        if agent_id:
            rows = await conn.fetch(
                "SELECT * FROM work_orders "
                "WHERE status = 'pending' AND assigned_agent = $1 "
                "ORDER BY priority ASC, created_at ASC",
                agent_id,
            )
        else:
            rows = await conn.fetch(
                "SELECT * FROM work_orders "
                "WHERE status = 'pending' "
                "ORDER BY priority ASC, created_at ASC",
            )
    return [_row_to_dict(r) for r in rows]


async def get_order_by_id(order_id: int) -> Optional[dict]:
    """按ID查询工单"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM work_orders WHERE id = $1", order_id
        )
    return _row_to_dict(row) if row else None


async def get_order_by_code(order_code: str) -> Optional[dict]:
    """按编号查询工单"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "SELECT * FROM work_orders WHERE order_code = $1", order_code
        )
    return _row_to_dict(row) if row else None


# ========== 工单领取 ==========

async def claim_order(order_id: int, agent_code: str) -> Optional[dict]:
    """领取工单 · 事务安全

    仅当工单状态=pending且assigned_agent匹配时才能领取
    返回更新后的工单 · 或 None(条件不满足)
    """
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT * FROM work_orders "
                "WHERE id = $1 AND status = 'pending' "
                "FOR UPDATE",
                order_id,
            )
            if row is None:
                return None
            order = _row_to_dict(row)
            # 检查: 工单必须分配给该Agent
            if order.get("assigned_agent") and order["assigned_agent"] != agent_code:
                return None
            now = datetime.now(timezone.utc)
            updated = await conn.fetchrow(
                "UPDATE work_orders "
                "SET status = 'developing', updated_at = $1 "
                "WHERE id = $2 "
                "RETURNING *",
                now, order_id,
            )
            return _row_to_dict(updated) if updated else None


# ========== 状态更新 ==========

async def update_order_status(
    order_id: int,
    agent_code: str,
    new_status: str,
    self_check_result: Optional[str] = None,
    review_result: Optional[str] = None,
) -> Optional[dict]:
    """更新工单状态 · 仅允许负责Agent操作"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "SELECT * FROM work_orders WHERE id = $1 FOR UPDATE",
                order_id,
            )
            if row is None:
                return None
            order = _row_to_dict(row)
            # 权限校验: 仅负责Agent可更新
            if order.get("assigned_agent") and order["assigned_agent"] != agent_code:
                return None
            now = datetime.now(timezone.utc)
            updated = await conn.fetchrow(
                "UPDATE work_orders "
                "SET status = $1, "
                "    self_check_result = COALESCE($2, self_check_result), "
                "    review_result = COALESCE($3, review_result), "
                "    updated_at = $4 "
                "WHERE id = $5 "
                "RETURNING *",
                new_status, self_check_result, review_result, now, order_id,
            )
            return _row_to_dict(updated) if updated else None


# ========== 执行日志 ==========

async def write_log(
    order_id: int,
    level: str,
    message: str,
    step: Optional[str] = None,
    metadata: Optional[dict] = None,
) -> Optional[dict]:
    """写入执行日志"""
    pool = await get_pool()
    metadata_json = json.dumps(metadata) if metadata else None
    async with pool.acquire() as conn:
        row = await conn.fetchrow(
            "INSERT INTO execution_logs (order_id, level, message, step, metadata_) "
            "VALUES ($1, $2, $3, $4, $5::jsonb) "
            "RETURNING *",
            order_id, level, message, step, metadata_json,
        )
    return _row_to_dict(row) if row else None


async def get_logs(order_id: int, limit: int = 100) -> list[dict]:
    """查询工单执行日志"""
    pool = await get_pool()
    async with pool.acquire() as conn:
        rows = await conn.fetch(
            "SELECT * FROM execution_logs "
            "WHERE order_id = $1 "
            "ORDER BY created_at DESC "
            "LIMIT $2",
            order_id, limit,
        )
    return [_row_to_dict(r) for r in rows]
