"""GH-API-002 · 任务分发路由 · 对齐GH-DB-001

/api/dispatch — 查询待开发工单(work_orders) → 匹配Agent(agents) → 下发
"""
from fastapi import APIRouter
from db import get_pool
from models import DispatchResult, OrderStatus, AgentStatus

router = APIRouter(prefix="/api/dispatch", tags=["dispatch"])


@router.post("", response_model=DispatchResult)
async def dispatch_order():
    """任务分发：查找待开发工单 → 匹配在线Agent → 分配"""
    pool = await get_pool()

    # 1. 查找最高优先级的待开发工单
    order = await pool.fetchrow(
        """
        SELECT * FROM work_orders
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

    # 2. 如果工单已指定Agent, 查找该Agent
    agent = None
    if order["assigned_agent"] is not None:
        agent = await pool.fetchrow(
            """
            SELECT * FROM agents
            WHERE id = $1 AND status = $2
            """,
            order["assigned_agent"], AgentStatus.ONLINE.value,
        )

    # 3. 如果未指定或指定Agent不在线, 查找任意在线Agent
    if agent is None:
        agent = await pool.fetchrow(
            """
            SELECT * FROM agents
            WHERE status = $1
            ORDER BY last_heartbeat DESC NULLS LAST
            LIMIT 1
            """,
            AgentStatus.ONLINE.value,
        )

    if agent is None:
        return DispatchResult(
            dispatched=False,
            order_id=str(order["id"]),
            order_code=order["code"],
            message="No online agents available",
        )

    # 4. 分配工单给Agent (事务安全)
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                """
                UPDATE work_orders
                SET status = $1, assigned_agent = $2
                WHERE id = $3
                """,
                OrderStatus.DEVELOPING.value, agent["id"], order["id"],
            )
            await conn.execute(
                """
                UPDATE agents
                SET status = $1
                WHERE id = $2
                """,
                AgentStatus.BUSY.value, agent["id"],
            )

    return DispatchResult(
        dispatched=True,
        order_id=str(order["id"]),
        order_code=order["code"],
        agent_code=agent["code"],
        message="Order " + order["code"] + " dispatched to " + agent["code"],
    )
