"""GH-API-002 · 工单路由 · 对齐GH-DB-001 work_orders表

/api/orders — CRUD (work_orders · UUID PK · code/dev_content/phase)
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


async def _resolve_agent_uuid(pool, agent_code: str):
    """通过agent code查找agent UUID"""
    row = await pool.fetchrow(
        "SELECT id FROM agents WHERE code = $1", agent_code
    )
    if row is None:
        return None
    return row["id"]


async def _row_to_response(pool, row) -> OrderResponse:
    """将数据库行转换为OrderResponse · 解析agent code"""
    d = dict(row)
    agent_code = None
    if d.get("assigned_agent") is not None:
        agent_row = await pool.fetchrow(
            "SELECT code FROM agents WHERE id = $1", d["assigned_agent"]
        )
        if agent_row is not None:
            agent_code = agent_row["code"]
    return OrderResponse(
        id=str(d["id"]),
        code=d["code"],
        title=d["title"],
        status=d["status"],
        priority=d["priority"],
        phase=d.get("phase"),
        dev_content=d.get("dev_content") or "",
        repo_path=d.get("repo_path"),
        branch_name=d.get("branch_name"),
        constraints=d.get("constraints"),
        assigned_agent=str(d["assigned_agent"]) if d.get("assigned_agent") else None,
        assigned_agent_code=agent_code,
        self_check_result=d.get("self_check_result"),
        review_result=d.get("review_result"),
        next_guide=d.get("next_guide"),
        created_at=d["created_at"],
        updated_at=d["updated_at"],
    )


@router.get("", response_model=OrderListResponse)
async def list_orders(
    status: OrderStatus | None = None,
    assigned_agent_code: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    """获取工单列表"""
    pool = await get_pool()
    conditions = []
    params = []
    idx = 1

    if status is not None:
        conditions.append("status = $" + str(idx))
        params.append(status.value)
        idx += 1

    if assigned_agent_code is not None:
        agent_uuid = await _resolve_agent_uuid(pool, assigned_agent_code)
        if agent_uuid is not None:
            conditions.append("assigned_agent = $" + str(idx))
            params.append(agent_uuid)
            idx += 1
        else:
            return OrderListResponse(orders=[], total=0, page=page, page_size=page_size)

    where_clause = ("WHERE " + " AND ".join(conditions)) if conditions else ""

    count_sql = "SELECT COUNT(*) FROM work_orders " + where_clause
    total = await pool.fetchval(count_sql, *params)

    offset = (page - 1) * page_size
    list_sql = (
        "SELECT * FROM work_orders " + where_clause
        + " ORDER BY created_at DESC"
        + " LIMIT $" + str(idx) + " OFFSET $" + str(idx + 1)
    )
    params.extend([page_size, offset])
    rows = await pool.fetch(list_sql, *params)

    orders = []
    for r in rows:
        orders.append(await _row_to_response(pool, r))
    return OrderListResponse(orders=orders, total=total, page=page, page_size=page_size)


@router.post("", response_model=OrderResponse, status_code=201)
async def create_order(body: OrderCreate):
    """创建工单"""
    pool = await get_pool()
    agent_uuid = None
    if body.assigned_agent_code:
        agent_uuid = await _resolve_agent_uuid(pool, body.assigned_agent_code)

    row = await pool.fetchrow(
        """
        INSERT INTO work_orders (
            title, code, phase, priority, status,
            dev_content, repo_path, branch_name, constraints,
            assigned_agent, next_guide
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        RETURNING *
        """,
        body.title, body.code, body.phase,
        body.priority.value, OrderStatus.PENDING.value,
        body.dev_content, body.repo_path, body.branch_name,
        body.constraints, agent_uuid, body.next_guide,
    )
    return await _row_to_response(pool, row)


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order(order_id: str):
    """获取工单详情"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM work_orders WHERE id = $1::uuid", order_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    return await _row_to_response(pool, row)


@router.patch("/{order_id}", response_model=OrderResponse)
async def update_order(order_id: str, body: OrderUpdate):
    """更新工单"""
    pool = await get_pool()
    existing = await pool.fetchrow(
        "SELECT * FROM work_orders WHERE id = $1::uuid", order_id
    )
    if existing is None:
        raise HTTPException(status_code=404, detail="Order not found")

    updates = body.model_dump(exclude_unset=True)
    if not updates:
        return await _row_to_response(pool, existing)

    set_clauses = []
    params = []
    idx = 1

    for key, value in updates.items():
        if key == "assigned_agent_code":
            if value is not None:
                agent_uuid = await _resolve_agent_uuid(pool, value)
                set_clauses.append("assigned_agent = $" + str(idx))
                params.append(agent_uuid)
            else:
                set_clauses.append("assigned_agent = $" + str(idx))
                params.append(None)
            idx += 1
            continue
        if key == "status":
            value = value.value if hasattr(value, "value") else value
        if key == "priority":
            value = value.value if hasattr(value, "value") else value
        set_clauses.append(key + " = $" + str(idx))
        params.append(value)
        idx += 1

    params.append(order_id)
    sql = (
        "UPDATE work_orders SET " + ", ".join(set_clauses)
        + " WHERE id = $" + str(idx) + "::uuid RETURNING *"
    )
    row = await pool.fetchrow(sql, *params)
    return await _row_to_response(pool, row)


@router.post("/{order_id}/claim", response_model=OrderResponse)
async def claim_order(order_id: str, agent_code: str):
    """Agent领取工单"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM work_orders WHERE id = $1::uuid", order_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")
    if row["status"] != OrderStatus.PENDING.value:
        raise HTTPException(
            status_code=400,
            detail="Order status is " + str(row["status"]) + ", cannot claim"
        )

    agent_uuid = await _resolve_agent_uuid(pool, agent_code)
    if agent_uuid is None:
        raise HTTPException(
            status_code=404,
            detail="Agent " + agent_code + " not found"
        )

    updated = await pool.fetchrow(
        """
        UPDATE work_orders
        SET status = $1, assigned_agent = $2
        WHERE id = $3::uuid
        RETURNING *
        """,
        OrderStatus.DEVELOPING.value, agent_uuid, order_id,
    )
    return await _row_to_response(pool, updated)


@router.post("/{order_id}/self-check", response_model=OrderResponse)
async def submit_self_check(order_id: str, result: str):
    """提交自检结果"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM work_orders WHERE id = $1::uuid", order_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")

    updated = await pool.fetchrow(
        """
        UPDATE work_orders
        SET status = $1, self_check_result = $2
        WHERE id = $3::uuid
        RETURNING *
        """,
        OrderStatus.REVIEWING.value, result, order_id,
    )
    return await _row_to_response(pool, updated)


@router.post("/{order_id}/review", response_model=OrderResponse)
async def submit_review(order_id: str, result: str, approved: bool = True):
    """提交审核结果"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM work_orders WHERE id = $1::uuid", order_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Order not found")

    new_status = OrderStatus.APPROVED.value if approved else OrderStatus.DEVELOPING.value
    updated = await pool.fetchrow(
        """
        UPDATE work_orders
        SET status = $1, review_result = $2
        WHERE id = $3::uuid
        RETURNING *
        """,
        new_status, result, order_id,
    )
    return await _row_to_response(pool, updated)
