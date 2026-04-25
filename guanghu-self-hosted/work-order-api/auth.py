"""GH-API-001 · 工单领取API · 认证中间件

API Key认证 · 速率限制 · Agent身份绑定
编号前缀: GH-API · 培园A04
"""
import logging
import time
from collections import defaultdict
from typing import Optional

from fastapi import HTTPException, Request, Security
from fastapi.security import APIKeyHeader

from config import settings

logger = logging.getLogger("work-order-api.auth")

# ========== API Key 认证 ==========

api_key_header = APIKeyHeader(name="X-Agent-Key", auto_error=False)


def resolve_agent_code(api_key: Optional[str]) -> str:
    """从API Key解析Agent编号

    如果未配置API Key (开发模式) 则跳过认证
    """
    key_map = settings.api_key_map
    # 开发模式: 未配置任何key时放行
    if not key_map:
        logger.warning("No API keys configured · running in dev mode (no auth)")
        return "dev-agent"
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="Missing X-Agent-Key header",
        )
    agent_code = key_map.get(api_key)
    if not agent_code:
        raise HTTPException(
            status_code=403,
            detail="Invalid API key",
        )
    return agent_code


async def get_current_agent(
    api_key: Optional[str] = Security(api_key_header),
) -> str:
    """FastAPI依赖 · 返回当前Agent编号"""
    return resolve_agent_code(api_key)


# ========== 速率限制 ==========

# 简单内存滑动窗口 · 生产环境应换Redis
_request_log: dict[str, list[float]] = defaultdict(list)


def check_rate_limit(agent_code: str) -> None:
    """检查速率限制 · 每Agent每分钟N次"""
    now = time.monotonic()
    window = settings.rate_limit_window_seconds
    limit = settings.rate_limit_per_minute
    log = _request_log[agent_code]
    # 清理过期记录
    _request_log[agent_code] = [
        t for t in log if now - t < window
    ]
    if len(_request_log[agent_code]) >= limit:
        logger.warning(
            "Rate limit exceeded for agent %s (%d/%d in %ds)",
            agent_code, len(_request_log[agent_code]), limit, window,
        )
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded: "
            + str(limit)
            + " requests per "
            + str(window)
            + " seconds",
        )
    _request_log[agent_code].append(now)
