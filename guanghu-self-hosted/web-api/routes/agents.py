"""GH-API-001 · Agent路由

/api/agents — 注册 · 列表 · 心跳
/api/agents/{id}/status — 状态更新
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Query
from db import get_pool
from models import (
    AgentRegister, AgentResponse, AgentStatusUpdate,
    AgentHeartbeat, AgentStatus, MessageResponse,
)
import json

router = APIRouter(prefix="/api/agents", tags=["agents"])


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

    result = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("capabilities"), str):
            d["capabilities"] = json.loads(d["capabilities"])
        result.append(AgentResponse(**d))
    return result


@router.post("", response_model=AgentResponse, status_code=201)
async def register_agent(body: AgentRegister):
    """注册Agent"""
    pool = await get_pool()

    existing = await pool.fetchrow(
        "SELECT * FROM agents WHERE agent_code = $1", body.agent_code
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail=f"Agent {body.agent_code} already registered")

    row = await pool.fetchrow(
        """
        INSERT INTO agents (agent_code, name, status, capabilities, prefix)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        """,
        body.agent_code, body.name, AgentStatus.IDLE.value,
        json.dumps(body.capabilities), body.prefix,
    )
    d = dict(row)
    if isinstance(d.get("capabilities"), str):
        d["capabilities"] = json.loads(d["capabilities"])
    return AgentResponse(**d)


@router.post("/heartbeat", response_model=MessageResponse)
async def agent_heartbeat(body: AgentHeartbeat):
    """Agent心跳"""
    pool = await get_pool()
    now = datetime.now(timezone.utc)
    result = await pool.execute(
        """
        UPDATE agents
        SET last_heartbeat = $1, status = $2, current_order_id = $3, updated_at = $1
        WHERE agent_code = $4
        """,
        now, body.status.value, body.current_order_id, body.agent_code,
    )
    if result == "UPDATE 0":
        raise HTTPException(status_code=404, detail=f"Agent {body.agent_code} not found")
    return MessageResponse(message=f"Heartbeat received for {body.agent_code}")


@router.get("/{agent_id}", response_model=AgentResponse)
async def get_agent(agent_id: int):
    """获取Agent详情"""
    pool = await get_pool()
    row = await pool.fetchrow("SELECT * FROM agents WHERE id = $1", agent_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    d = dict(row)
    if isinstance(d.get("capabilities"), str):
        d["capabilities"] = json.loads(d["capabilities"])
    return AgentResponse(**d)


@router.patch("/{agent_id}/status", response_model=AgentResponse)
async def update_agent_status(agent_id: int, body: AgentStatusUpdate):
    """更新Agent状态"""
    pool = await get_pool()
    row = await pool.fetchrow(
        """
        UPDATE agents
        SET status = $1, current_order_id = $2, updated_at = NOW()
        WHERE id = $3
        RETURNING *
        """,
        body.status.value, body.current_order_id, agent_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    d = dict(row)
    if isinstance(d.get("capabilities"), str):
        d["capabilities"] = json.loads(d["capabilities"])
    return AgentResponse(**d)
