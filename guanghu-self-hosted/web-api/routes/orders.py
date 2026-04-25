"""GH-API-001 · 工单路由

/api/orders — CRUD
/api/orders/{id}/claim — Agent领取
/api/orders/{id}/self-check — 自检结果
/api/orders/{id}/review — 审核结果
"""
from fastapi import APIRouter, HTTPException, Query
from db import get_pool
from models import (
    OrderCreate, OrderUpdate, OrderResponse, OrderListResponse,
    OrderStatus, MessageResponse,
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


def _row_to_order(row: dict) -> OrderResponse:
    """将数据库行转换为OrderResponse"""
    import json
    return OrderResponse(**row)


@router.get("", response_model=OrderListResponse)
async def list_orders(
    status: OrderStatus | None = None,
    assigned_agent: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取工单列表"""
    pool = await get_pool()
    conditions = []
    params = []
    idx = 1

    if status is not None:
        conditions.append(f"status = ${idx}")
        params.append(status.value)
        idx += 1

    if assigned_agent is not None:
        conditions.append(f"assigned_agent = ${idx}")
        params.append(assigned_agent)
        idx += 1

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_sql = f"SELECT COUNT(*) FROM orders {where_clause}"
    total = await pool.fetchval(count_sql, *params)

    offset = (page - 1) * page_size
    list_sql = f"""
        SELECT * FROM orders {where_clause}
        ORDER BY created_at DESC
        LIMIT ${idx} OFFSET ${idx + 1}
    """
    params.extend([page_size, offset])
    rows = await pool.fetch(list_sql, *params)

    orders = [OrderResponse(**dict(r)) for r in rows]
    return OrderListResponse(orders=orders, total=total, page=page, page_size=page_size)


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(body: OrderCreate):
    """创建工单"""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        INSERT INTO orders (
            title, order_code, phase_code, priority, status,
            description, repo_path, branch_name, constraints,
            assigned_agent, next_guide
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        """,
        body.title, body.order_code, body.phase_code,
        body.priority.value, OrderStatus.PENDING.value,
        body.description, body.repo_path, body.branch_name,
        body.constraints, body.assigned_agent, body.next_guide,
    )
    return OrderResponse(**dict(row))


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: int):
    """获取工单详情"""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderResponse(**dict(row))


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(order_id: int, body: OrderUpdate):
    """更新工单"""
    pool = await get_pool()
    existing = await pool.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return OrderResponse(**dict(existing))

    set_clauses = []
    params = []
    idx = 1
    for key, value in updates.items():
        if key == "status":
            value = value.value if hasattr(value, "value") else value
        if key == "priority":
            value = value.value if hasattr(value, "value") else value
        set_clauses.append(f"{key} = ${idx}")
        params.append(value)
        idx += 1

    set_clauses.append("updated_at = NOW()")
    params.append(order_id)

    sql = f"UPDATE orders SET {', '.join(set_clauses)} WHERE id = ${idx} RETURNING *"
    row = await pool.fetchrow(sql, *params)
    return OrderResponse(**dict(row))


@router.post("/{order_id}/claim", response_model=OrderResponse)
async def claim_order(order_id: int, agent_code: str):
    """Agent领取工单"""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if row["status"] != OrderStatus.PENDING.value:
        raise HTTPException(status_code=400, detail=f"Order status is {row['status']}, cannot claim")

    updated = await pool.fetchrow(
        """
        UPDATE orders
        SET status = $1, assigned_agent = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        OrderStatus.IN_PROGRESS.value, agent_code, order_id,
    )
    return OrderResponse(**dict(updated))


@router.post("/{order_id}/self-check", response_model=OrderResponse)
async def submit_self_check(order_id: int, result: str):
    """提交自检结果"""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")

    updated = await pool.fetchrow(
        """
        UPDATE orders
        SET status = $1, self_check_result = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        OrderStatus.AWAITING_REVIEW.value, result, order_id,
    )
    return OrderResponse(**dict(updated))


@router.post("/{order_id}/review", response_model=OrderResponse)
async def submit_review(order_id: int, result: str, approved: bool = True):
    """提交审核结果"""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM orders WHERE id = $1", order_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = OrderStatus.COMPLETED.value if approved else OrderStatus.IN_PROGRESS.value
    updated = await pool.fetchrow(
        """
        UPDATE orders
        SET status = $1, review_result = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        new_status, result, order_id,
    )
    return OrderResponse(**dict(updated))
