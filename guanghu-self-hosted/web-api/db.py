"""GH-API-001 · 数据库连接池

asyncpg连接池 · lifespan管理
"""
import asyncpg
from typing import Optional

from config import settings

_pool: Optional[asyncpg.Pool] = None


async def get_pool() -> asyncpg.Pool:
    """获取连接池（必须在lifespan init之后调用）"""
    global _pool
    if _pool is None:
        raise RuntimeError("Database pool not initialized. Call init_pool() first.")
    return _pool


async def init_pool() -> asyncpg.Pool:
    """初始化连接池"""
    global _pool
    _pool = await asyncpg.create_pool(
        dsn=settings.database_url,
        min_size=settings.db_pool_min_size,
        max_size=settings.db_pool_max_size,
    )
    return _pool


async def close_pool() -> None:
    """关闭连接池"""
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None
