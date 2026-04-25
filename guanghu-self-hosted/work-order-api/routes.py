"""GH-API-001 · 工单领取API · 路由定义

6个核心端点:
  GET  /api/v1/orders/pending   查询待领取工单
  POST /api/v1/orders/{id}/claim 领取工单
  PATCH /api/v1/orders/{id}/status 更新工单状态
  POST /api/v1/orders/{id}/log   写入执行日志
  GET  /api/v1/orders/{id}       查询工单详情
  GET  /api/v1/health            健康检查

编号前缀: GH-API · 培园A04
"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

import db
from auth import check_rate_limit, get_current_agent
from models import (
    ClaimRequest,
    ClaimResponse,
    ErrorResponse,
    HealthResponse,
    LogEntry,
    LogList,
    LogResponse,
    OrderDetail,
    PendingOrderList,
    StatusUpdateRequest,
    StatusUpdateResponse,
)

logger = logging.getLogger("work-order-api.routes")

router = APIRouter(prefix="/api/v1")


# ========== 健康检查 ==========

@router.get("/health", response_model=HealthResponse, tags=["system"])
async def health_check() -> HealthResponse:
    """健康检查 · 无需认证"""
    db_ok = await db.check_connection()
    return HealthResponse(db_connected=db_ok)


# ========== 查询待领取工单 ==========

@router.get(
    "/orders/pending",
    response_model=PendingOrderList,
    tags=["orders"],
)
async def list_pending_orders(
    agent_id: Optional[str] = Query(
        None, description="Agent编号 · 过滤分配给该Agent的工单"
    ),
    agent_code: str = Depends(get_current_agent),
) -> PendingOrderList:
    """查询待领取工单

    - 不传 agent_id: 返回所有pending工单
    - 传 agent_id: 仅返回分配给该Agent的pending工单
    - Agent只能查自己的工单(API Key绑定)
    """
    check_rate_limit(agent_code)
    # 安全: Agent只能查分配给自己的工单
    effective_agent = agent_id or agent_code
    if agent_code != "dev-agent" and effective_agent != agent_code:
        raise HTTPException(
            status_code=403,
            detail="Cannot query orders for another agent",
        )
    logger.info("Agent %s querying pending orders", agent_code)
    orders = await db.get_pending_orders(effective_agent)
    return PendingOrderList(
        orders=[OrderDetail(**o) for o in orders],
        total=len(orders),
    )


# ========== 查询工单详情 ==========

@router.get(
    "/orders/{order_id}",
    response_model=OrderDetail,
    responses={404: {"model": ErrorResponse}},
    tags=["orders"],
)
async def get_order(
    order_id: int,
    agent_code: str = Depends(get_current_agent),
) -> OrderDetail:
    """查询工单详情"""
    check_rate_limit(agent_code)
    order = await db.get_order_by_id(order_id)
    if order is None:
        raise HTTPException(status_code=404, detail="Order not found")
    # 安全: Agent只能查自己负责的工单
    if (
        agent_code != "dev-agent"
        and order.get("assigned_agent")
        and order["assigned_agent"] != agent_code
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view this order",
        )
    logger.info("Agent %s viewing order %d", agent_code, order_id)
    return OrderDetail(**order)


# ========== 领取工单 ==========

@router.post(
    "/orders/{order_id}/claim",
    response_model=ClaimResponse,
    responses={404: {"model": ErrorResponse}, 409: {"model": ErrorResponse}},
    tags=["orders"],
)
async def claim_order(
    order_id: int,
    body: Optional[ClaimRequest] = None,
    agent_code: str = Depends(get_current_agent),
) -> ClaimResponse:
    """领取工单 · status → developing

    仅当工单状态=pending且分配给该Agent时可领取
    """
    check_rate_limit(agent_code)
    effective_agent = agent_code
    if body and body.agent_code:
        if agent_code != "dev-agent" and body.agent_code != agent_code:
            raise HTTPException(
                status_code=403,
                detail="Cannot claim order for another agent",
            )
        effective_agent = body.agent_code
    # 先检查工单是否存在
    existing = await db.get_order_by_id(order_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if existing["status"] != "pending":
        raise HTTPException(
            status_code=409,
            detail="Order status is '" + existing["status"] + "', not 'pending'",
        )
    result = await db.claim_order(order_id, effective_agent)
    if result is None:
        raise HTTPException(
            status_code=409,
            detail="Failed to claim order: not assigned to you or already claimed",
        )
    logger.info(
        "Agent %s claimed order %d (%s)",
        effective_agent, order_id, result["order_code"],
    )
    return ClaimResponse(
        claimed=True,
        order_id=result["id"],
        order_code=result["order_code"],
        agent_code=effective_agent,
        previous_status="pending",
        new_status="developing",
        message="Order claimed successfully",
    )


# ========== 更新工单状态 ==========

@router.patch(
    "/orders/{order_id}/status",
    response_model=StatusUpdateResponse,
    responses={404: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
    tags=["orders"],
)
async def update_order_status(
    order_id: int,
    body: StatusUpdateRequest,
    agent_code: str = Depends(get_current_agent),
) -> StatusUpdateResponse:
    """更新工单状态

    仅允许负责Agent更新自己的工单
    """
    check_rate_limit(agent_code)
    existing = await db.get_order_by_id(order_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")
    previous_status = existing["status"]
    result = await db.update_order_status(
        order_id=order_id,
        agent_code=agent_code,
        new_status=body.status.value,
        self_check_result=body.self_check_result,
        review_result=body.review_result,
    )
    if result is None:
        raise HTTPException(
            status_code=403,
            detail="Not authorized to update this order",
        )
    logger.info(
        "Agent %s updated order %d: %s -> %s",
        agent_code, order_id, previous_status, body.status.value,
    )
    return StatusUpdateResponse(
        updated=True,
        order_id=result["id"],
        order_code=result["order_code"],
        previous_status=previous_status,
        new_status=body.status.value,
        message="Status updated successfully",
    )


# ========== 写入执行日志 ==========

@router.post(
    "/orders/{order_id}/log",
    response_model=LogResponse,
    responses={404: {"model": ErrorResponse}, 403: {"model": ErrorResponse}},
    tags=["orders"],
)
async def write_execution_log(
    order_id: int,
    body: LogEntry,
    agent_code: str = Depends(get_current_agent),
) -> LogResponse:
    """写入执行日志

    仅允许负责Agent写入日志
    """
    check_rate_limit(agent_code)
    existing = await db.get_order_by_id(order_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if (
        agent_code != "dev-agent"
        and existing.get("assigned_agent")
        and existing["assigned_agent"] != agent_code
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to write logs for this order",
        )
    log_row = await db.write_log(
        order_id=order_id,
        level=body.level,
        message=body.message,
        step=body.step,
        metadata=body.metadata,
    )
    if log_row is None:
        raise HTTPException(
            status_code=500,
            detail="Failed to write log",
        )
    logger.info(
        "Agent %s wrote log for order %d [%s] %s",
        agent_code, order_id, body.level, body.step or "",
    )
    return LogResponse(
        logged=True,
        order_id=order_id,
        log_id=log_row["id"],
        message="Log written successfully",
    )


# ========== 查询工单日志 (附加端点) ==========

@router.get(
    "/orders/{order_id}/logs",
    response_model=LogList,
    responses={404: {"model": ErrorResponse}},
    tags=["orders"],
)
async def list_order_logs(
    order_id: int,
    limit: int = Query(100, ge=1, le=500),
    agent_code: str = Depends(get_current_agent),
) -> LogList:
    """查询工单执行日志"""
    check_rate_limit(agent_code)
    existing = await db.get_order_by_id(order_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if (
        agent_code != "dev-agent"
        and existing.get("assigned_agent")
        and existing["assigned_agent"] != agent_code
    ):
        raise HTTPException(
            status_code=403,
            detail="Not authorized to view logs for this order",
        )
    logs = await db.get_logs(order_id, limit)
    return LogList(logs=logs, total=len(logs))
