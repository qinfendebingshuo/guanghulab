"""GH-API-002 · Agent路由 · 对齐GH-DB-001 agents表

/api/agents — 注册 · 列表 · 心跳 (code/name/role · UUID PK)
/api/agents/{id}/status — 状态更新
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException
from db import get_pool
from models import (
    AgentRegister, AgentResponse, AgentStatusUpdate,
    AgentHeartbeat, AgentStatus, MessageResponse,
)

router = APIRouter(prefix="/api/agents", tags=["agents"])


def _row_to_agent(row) -> AgentResponse:
    """将数据库行转换为AgentResponse"""
    d = dict(row)
    return AgentResponse(
        id=str(d["id"]),
        code=d["code"],
        name=d["name"],
        role=d.get("role"),
        status=d["status"],
        last_heartbeat=d.get("last_heartbeat"),
        boot_config_ref=d.get("boot_config_ref"),
        persona_db_ref=str(d["persona_db_ref"]) if d.get("persona_db_ref") else None,
        created_at=d["created_at"],
    )


@router.get("", response_model=list[AgentResponse])
async def list_agents(status: AgentStatus | None = None):
    """获取Agent列表"""
    pool = await get_pool()
    if status is not None:
        rows = await pool.fetch(
            "SELECT * FROM agents WHERE status = $1 ORDER BY created_at DESC",
            status.value,
        )
    else:
        rows = await pool.fetch("SELECT * FROM agents ORDER BY created_at DESC")
    return [_row_to_agent(r) for r in rows]


@router.post("", response_model=AgentResponse, status_code=201)
async def register_agent(body: AgentRegister):
    """注册Agent"""
    pool = await get_pool()
    existing = await pool.fetchrow(
        "SELECT * FROM agents WHERE code = $1", body.code
    )
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail="Agent " + body.code + " already registered"
        )

    row = await pool.fetchrow(
        """
        INSERT INTO agents (code, name, role, status, boot_config_ref)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        body.code, body.name, body.role,
        AgentStatus.OFFLINE.value, body.boot_config_ref,
    )
    return _row_to_agent(row)


@router.post("/heartbeat", response_model=MessageResponse)
async def agent_heartbeat(body: AgentHeartbeat):
    """Agent心跳"""
    pool = await get_pool()
    now = datetime.now(timezone.utc)
    result = await pool.execute(
        """
        UPDATE agents
        SET last_heartbeat = $1, status = $2
        WHERE code = $3
        """,
        now, body.status.value, body.code,
    )
    if result == "UPDATE 0":
        raise HTTPException(
            status_code=404,
            detail="Agent " + body.code + " not found"
        )
    return MessageResponse(message="Heartbeat received for " + body.code)


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: str):
    """获取Agent详情"""
    pool = await get_pool()
    row = await pool.fetchrow(
        "SELECT * FROM agents WHERE id = $1::uuid", agent_id
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _row_to_agent(row)


@router.patch("/{agent_id}/status", response_model=AgentResponse)
async def update_agent_status(agent_id: str, body: AgentStatusUpdate):
    """更新Agent状态"""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE agents
        SET status = $1
        WHERE id = $2::uuid
        RETURNING *
        """,
        body.status.value, agent_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return _row_to_agent(row)
