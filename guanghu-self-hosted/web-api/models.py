"""GH-API-002 · Pydantic v2 请求/响应模型 · 对齐GH-DB-001 schema

工单(work_orders) · Agent(agents) · 聊天消息(chat_messages)
所有枚举/表名/列名严格对齐 web-database/schema.sql
"""
from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field


# ========== 枚举 · 对齐 GH-DB-001 PostgreSQL 枚举类型 ==========

class OrderStatus(str, Enum):
    """对齐 gh_work_order_status"""
    PENDING = "pending"
    DEVELOPING = "developing"
    SELF_CHECKING = "self_checking"
    REVIEWING = "reviewing"
    APPROVED = "approved"
    COMPLETED = "completed"
    SUSPENDED = "suspended"


class OrderPriority(str, Enum):
    """对齐 gh_work_order_priority"""
    P0 = "P0"
    P1 = "P1"
    P2 = "P2"


class AgentStatus(str, Enum):
    """对齐 gh_agent_status"""
    ONLINE = "online"
    OFFLINE = "offline"
    BUSY = "busy"


class ExecutionAction(str, Enum):
    """对齐 gh_execution_action"""
    CLAIMED = "claimed"
    STARTED = "started"
    SELF_CHECKED = "self_checked"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"


class ReviewResultEnum(str, Enum):
    """对齐 gh_review_result"""
    PASS = "pass"
    FAIL = "fail"
    REVISION_NEEDED = "revision_needed"


class MessageType(str, Enum):
    """对齐 gh_message_type"""
    TEXT = "text"
    COMMAND = "command"
    SYSTEM = "system"


# ========== 工单模型 · work_orders ==========

class OrderCreate(BaseModel):
    """创建工单请求 · 对齐 work_orders 表"""
    title: str = Field(..., min_length=1, max_length=256)
    code: str = Field(..., description="工单唯一编码 如 GH-API-002")
    phase: Optional[str] = Field(None, description="阶段编号 如 Phase-NOW-007")
    priority: OrderPriority = OrderPriority.P1
    dev_content: str = Field("", description="开发内容")
    repo_path: Optional[str] = Field(None, description="仓库路径")
    branch_name: Optional[str] = Field(None, description="分支名")
    constraints: Optional[str] = Field(None, description="约束")
    assigned_agent_code: Optional[str] = Field(None, description="负责Agent编码 如 A04")
    next_guide: Optional[str] = Field(None, description="下一轮指引")


class OrderUpdate(BaseModel):
    """更新工单请求"""
    title: Optional[str] = None
    priority: Optional[OrderPriority] = None
    status: Optional[OrderStatus] = None
    dev_content: Optional[str] = None
    repo_path: Optional[str] = None
    branch_name: Optional[str] = None
    constraints: Optional[str] = None
    assigned_agent_code: Optional[str] = None
    self_check_result: Optional[str] = None
    review_result: Optional[str] = None
    next_guide: Optional[str] = None


class OrderResponse(BaseModel):
    """工单响应 · 对齐 work_orders 表"""
    id: str
    code: str
    title: str
    status: OrderStatus
    priority: OrderPriority
    phase: Optional[str] = None
    dev_content: str = ""
    repo_path: Optional[str] = None
    branch_name: Optional[str] = None
    constraints: Optional[str] = None
    assigned_agent: Optional[str] = None
    assigned_agent_code: Optional[str] = None
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


# ========== Agent模型 · agents ==========

class AgentRegister(BaseModel):
    """Agent注册请求 · 对齐 agents 表"""
    code: str = Field(..., description="Agent编号 如 A04")
    name: str = Field(..., description="Agent名称 如 培园")
    role: Optional[str] = Field(None, description="角色描述 如 API开发")
    boot_config_ref: Optional[str] = Field(None, description="Boot Protocol配置路径")


class AgentResponse(BaseModel):
    """Agent响应 · 对齐 agents 表"""
    id: str
    code: str
    name: str
    role: Optional[str] = None
    status: AgentStatus
    last_heartbeat: Optional[datetime] = None
    boot_config_ref: Optional[str] = None
    persona_db_ref: Optional[str] = None
    created_at: datetime


class AgentStatusUpdate(BaseModel):
    """Agent状态更新"""
    status: AgentStatus


class AgentHeartbeat(BaseModel):
    """Agent心跳"""
    code: str
    status: AgentStatus = AgentStatus.ONLINE


# ========== 聊天消息模型 · chat_messages ==========

class ChatMessageCreate(BaseModel):
    """创建聊天消息 · 对齐 chat_messages 表"""
    sender: str = Field(..., description="发送方 Agent code 或用户标识")
    receiver: str = Field(..., description="接收方 Agent code 或用户标识")
    content: str = Field(..., min_length=1)
    msg_type: MessageType = MessageType.TEXT


class ChatMessageResponse(BaseModel):
    """聊天消息响应"""
    id: str
    sender: str
    receiver: str
    content: str
    msg_type: MessageType
    created_at: datetime


class ChatMessageListResponse(BaseModel):
    """聊天消息列表响应"""
    messages: list[ChatMessageResponse]
    total: int
    page: int
    page_size: int


# ========== 分发模型 ==========

class DispatchResult(BaseModel):
    """分发结果"""
    dispatched: bool
    order_id: Optional[str] = None
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
    version: str = "0.2.0"
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
