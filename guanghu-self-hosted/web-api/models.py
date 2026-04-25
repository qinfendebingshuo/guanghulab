"""GH-API-001 · Pydantic v2 请求/响应模型

工单 · Agent · 分发 · Webhook
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ========== 枚举 ==========

class OrderStatus(str, Enum):
    PENDING = "pending"          # 待开发
    IN_PROGRESS = "in_progress"  # 开发中
    SELF_CHECK = "self_check"    # 自检中
    AWAITING_REVIEW = "awaiting_review"  # 待审查
    REVIEWING = "reviewing"      # 审核中
    COMPLETED = "completed"      # 已完成
    SUSPENDED = "suspended"      # 暂缓


class OrderPriority(str, Enum):
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


class AgentStatus(str, Enum):
    IDLE = "idle"
    BUSY = "busy"
    OFFLINE = "offline"
    ERROR = "error"


# ========== 工单模型 ==========

class OrderCreate(BaseModel):
    """创建工单请求"""
    title: str = Field(..., min_length=1, max_length=200)
    order_code: str = Field(..., description="编号 如 PY-A04-20260425-001")
    phase_code: Optional[str] = Field(None, description="阶段编号")
    priority: OrderPriority = OrderPriority.P1
    description: str = Field("", description="开发内容")
    repo_path: Optional[str] = Field(None, description="仓库路径")
    branch_name: Optional[str] = Field(None, description="分支名")
    constraints: Optional[str] = Field(None, description="约束")
    assigned_agent: Optional[str] = Field(None, description="负责Agent")
    next_guide: Optional[str] = Field(None, description="下一轮指引")


class OrderUpdate(BaseModel):
    """更新工单请求"""
    title: Optional[str] = None
    priority: Optional[OrderPriority] = None
    status: Optional[OrderStatus] = None
    description: Optional[str] = None
    repo_path: Optional[str] = None
    branch_name: Optional[str] = None
    constraints: Optional[str] = None
    assigned_agent: Optional[str] = None
    self_check_result: Optional[str] = None
    review_result: Optional[str] = None
    next_guide: Optional[str] = None


class OrderResponse(BaseModel):
    """工单响应"""
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


class OrderListResponse(BaseModel):
    """工单列表响应"""
    orders: list[OrderResponse]
    total: int
    page: int
    page_size: int


# ========== Agent模型 ==========

class AgentRegister(BaseModel):
    """Agent注册请求"""
    agent_code: str = Field(..., description="Agent编号 如 培园A04")
    name: str = Field(..., description="Agent名称")
    capabilities: list[str] = Field(default_factory=list, description="能力列表")
    prefix: str = Field("", description="编号前缀 如 PY-A04")


class AgentResponse(BaseModel):
    """Agent响应"""
    id: int
    agent_code: str
    name: str
    status: AgentStatus
    capabilities: list[str] = []
    prefix: str = ""
    current_order_id: Optional[int] = None
    last_heartbeat: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class AgentStatusUpdate(BaseModel):
    """Agent状态更新"""
    status: AgentStatus
    current_order_id: Optional[int] = None


class AgentHeartbeat(BaseModel):
    """Agent心跳"""
    agent_code: str
    status: AgentStatus = AgentStatus.IDLE
    current_order_id: Optional[int] = None


# ========== 分发模型 ==========

class DispatchResult(BaseModel):
    """分发结果"""
    dispatched: bool
    order_id: Optional[int] = None
    order_code: Optional[str] = None
    agent_code: Optional[str] = None
    message: str = ""


# ========== Webhook模型 ==========

class GitHubWebhookEvent(BaseModel):
    """GitHub Webhook事件（简化）"""
    action: Optional[str] = None
    ref: Optional[str] = None
    repository: Optional[dict] = None
    sender: Optional[dict] = None
    commits: Optional[list] = None
    pull_request: Optional[dict] = None


# ========== 通用 ==========

class HealthResponse(BaseModel):
    """健康检查响应"""
    status: str = "ok"
    version: str = "0.1.0"
    service: str = "guanghu-web-api"


class TokenRequest(BaseModel):
    """JWT认证请求（Phase 2预留）"""
    username: str
    password: str


class TokenResponse(BaseModel):
    """JWT认证响应（Phase 2预留）"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MessageResponse(BaseModel):
    """通用消息响应"""
    message: str
    success: bool = True
