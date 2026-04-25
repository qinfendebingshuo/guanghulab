"""
工单快捷指令解析器
GH-CHAT-001 · Phase-NOW-005

支持的指令:
  /order create {标题}         → 创建工单
  /order status               → 查看所有工单状态
  /order assign {编号} {Agent} → 分配工单
  /deploy {模块}               → 触发部署(预留)
"""

import re
from dataclasses import dataclass
from typing import Optional


@dataclass
class CommandResult:
    """指令解析结果"""
    command: str           # 原始指令
    action: str            # 动作: order_create / order_status / order_assign / deploy / unknown
    params: dict           # 解析出的参数
    response: str          # 返回给用户的文本
    success: bool          # 是否解析成功


class CommandParser:
    """工单快捷指令解析器"""

    # 指令正则
    PATTERNS = {
        "order_create": re.compile(r"^/order\s+create\s+(.+)$", re.IGNORECASE),
        "order_status": re.compile(r"^/order\s+status\s*$", re.IGNORECASE),
        "order_assign": re.compile(
            r"^/order\s+assign\s+(\S+)\s+(\S+)$", re.IGNORECASE
        ),
        "deploy": re.compile(r"^/deploy\s+(\S+)$", re.IGNORECASE),
    }

    def parse(self, raw: str) -> CommandResult:
        """
        解析一条指令文本，返回 CommandResult
        """
        text = raw.strip()

        # /order create {标题}
        m = self.PATTERNS["order_create"].match(text)
        if m:
            title = m.group(1).strip()
            return CommandResult(
                command=text,
                action="order_create",
                params={"title": title},
                response=f"📋 工单创建请求已提交: **{title}**\n(后续接入GH-API-001后自动创建)",
                success=True,
            )

        # /order status
        m = self.PATTERNS["order_status"].match(text)
        if m:
            return CommandResult(
                command=text,
                action="order_status",
                params={},
                response="📊 工单状态查询已提交\n(后续接入GH-API-001后返回实时工单列表)",
                success=True,
            )

        # /order assign {编号} {Agent}
        m = self.PATTERNS["order_assign"].match(text)
        if m:
            order_id = m.group(1)
            agent = m.group(2)
            return CommandResult(
                command=text,
                action="order_assign",
                params={"order_id": order_id, "agent": agent},
                response=f"🔧 工单分配请求: {order_id} → {agent}\n(后续接入GH-API-001后自动分配)",
                success=True,
            )

        # /deploy {模块}
        m = self.PATTERNS["deploy"].match(text)
        if m:
            module = m.group(1)
            return CommandResult(
                command=text,
                action="deploy",
                params={"module": module},
                response=f"🚀 部署请求: {module}\n(预留功能 · 后续对接CI/CD)",
                success=True,
            )

        # 未知指令
        return CommandResult(
            command=text,
            action="unknown",
            params={},
            response=(
                f"❓ 未知指令: `{text}`\n"
                "支持的指令:\n"
                "  `/order create 标题` — 创建工单\n"
                "  `/order status` — 查看工单状态\n"
                "  `/order assign 编号 Agent` — 分配工单\n"
                "  `/deploy 模块` — 触发部署"
            ),
            success=False,
        )
