"""GH-API-001 · 工单领取API · Pydantic v2 模型

工单查询 · 领取 · 状态更新 · 执行日志
编号前缀: GH-API · 培园A04
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ========== 枚举 ==========

class OrderStatus(str, Enum):
    PENDING = "pending"
    DEVELOPING = "developing"
    SELF_CHECK = "self_check"
    AWAITING_REVIEW = "awaiting_review"
    REVIEWING = "reviewing"
    COMPLETED = "completed"
    SUSPENDED = "suspended"


class OrderPriority(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


# ========== 工单响应 ==========

class OrderDetail(BaseModel):
    """工单详情"""
    id: int
    title: str
    order_code: str
    phase_code: Optional[str] = None
    priority: OrderPriority
    status: OrderStatus
    description: str = ""
    repo_path: Optional[str] = None
    branch_name: Optional[str] = None
    constraints: Optional[str] = None
    assigned_agent: Optional[str] = None
    self_check_result: Optional[str] = None
    review_result: Optional[str] = None
    next_guide: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PendingOrderList(BaseModel):
    """待领取工单列表"""
    orders: list[OrderDetail]
    total: int


# ========== 领取请求 ==========

class ClaimRequest(BaseModel):
    """领取工单请求 (可选附加信息)"""
    agent_code: Optional[str] = Field(
        None,
        description="Agent编号 · 不传则从API Key推断",
    )


class ClaimResponse(BaseModel):
    """领取工单响应"""
    claimed: bool
    order_id: int
    order_code: str
    agent_code: str
    previous_status: str
    new_status: str = "developing"
    message: str = ""


# ========== 状态更新 ==========

class StatusUpdateRequest(BaseModel):
    """更新工单状态"""
    status: OrderStatus
    self_check_result: Optional[str] = Field(
        None,
        description="自检结果 · status=self_check 或 awaiting_review 时填写",
    )
    review_result: Optional[str] = Field(
        None,
        description="审核结果 · status=completed 时填写",
    )


class StatusUpdateResponse(BaseModel):
    """状态更新响应"""
    updated: bool
    order_id: int
    order_code: str
    previous_status: str
    new_status: str
    message: str = ""


# ========== 执行日志 ==========

class LogEntry(BaseModel):
    """执行日志条目"""
    level: str = Field("INFO", description="日志级别: INFO/WARN/ERROR")
    message: str = Field(..., min_length=1, max_length=2000)
    step: Optional[str] = Field(
        None,
        description="当前步骤 · 如 step_1_read_context",
    )
    metadata: Optional[dict] = Field(
        None,
        description="附加元数据",
    )


class LogResponse(BaseModel):
    """日志写入响应"""
    logged: bool
    order_id: int
    log_id: int
    message: str = ""


class LogList(BaseModel):
    """工单日志列表"""
    logs: list[dict]
    total: int


# ========== 通用 ==========

class HealthResponse(BaseModel):
    """健康检查"""
    status: str = "ok"
    version: str = "0.1.0"
    service: str = "guanghu-work-order-api"
    db_connected: bool = False


class ErrorResponse(BaseModel):
    """错误响应"""
    error: str
    detail: Optional[str] = None
