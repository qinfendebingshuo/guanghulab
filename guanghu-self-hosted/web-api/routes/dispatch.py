"""GH-API-001 · 任务分发路由

/api/dispatch — 查询待开发工单 → 匹配Agent → 下发
"""
from fastapi import APIRouter
from db import get_pool
from models import DispatchResult, OrderStatus, AgentStatus
import json

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])


@router.post("", response_model=DispatchResult)
async def dispatch_order():
    """任务分发：查找待开发工单 → 匹配空闲Agent → 分配"""
    pool = await get_pool()

    # 1. 查找最高优先级的待开发工单
    order = await pool.fetchrow(
        """
        SELECT * FROM orders
        WHERE status = $1
        ORDER BY
            CASE priority
                WHEN 'P0' THEN 0
                WHEN 'P1' THEN 1
                WHEN 'P2' THEN 2
                ELSE 3
            END ASC,
            created_at ASC
        LIMIT 1
        """,
        OrderStatus.PENDING.value,
    )

    if order is None:
        return DispatchResult(
            dispatched=False,
            message="No pending orders available",
        )

    # 2. 如果工单已指定Agent，查找该Agent
    agent = None
    if order["assigned_agent"]:
        agent = await pool.fetchrow(
            """
            SELECT * FROM agents
            WHERE agent_code = $1 AND status = $2
            """,
            order["assigned_agent"], AgentStatus.IDLE.value,
        )

    # 3. 如果未指定或指定Agent不空闲，查找任意空闲Agent
    if agent is None:
        agent = await pool.fetchrow(
            """
            SELECT * FROM agents
            WHERE status = $1
            ORDER BY last_heartbeat DESC NULLS LAST
            LIMIT 1
            """,
            AgentStatus.IDLE.value,
        )

    if agent is None:
        return DispatchResult(
            dispatched=False,
            order_id=order["id"],
            order_code=order["order_code"],
            message="No idle agents available",
        )

    # 4. 分配工单给Agent
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                UPDATE orders
                SET status = $1, assigned_agent = $2, updated_at = NOW()
                WHERE id = $3
                """,
                OrderStatus.IN_PROGRESS.value, agent["agent_code"], order["id"],
            )
            await conn.execute(
                """
                UPDATE agents
                SET status = $1, current_order_id = $2, updated_at = NOW()
                WHERE id = $3
                """,
                AgentStatus.BUSY.value, order["id"], agent["id"],
            )

    return DispatchResult(
        dispatched=True,
        order_id=order["id"],
        order_code=order["order_code"],
        agent_code=agent["agent_code"],
        message=f"Order {order['order_code']} dispatched to {agent['agent_code']}",
    )
