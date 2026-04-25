"""
光湖聊天系统 · WebSocket后端服务
GH-CHAT-001 · Phase-NOW-005

FastAPI WebSocket endpoint
- 频道消息路由
- Agent状态广播
- 工单快捷指令处理
- 消息持久化预留(chat_messages表)
"""

import json
import os
import asyncio
from datetime import datetime, timezone
from typing import Dict, List, Set, Optional
from uuid import uuid4

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from command_parser import CommandParser, CommandResult

# ============================================================
# 配置
# ============================================================
HOST = os.getenv("GH_CHAT_HOST", "0.0.0.0")
PORT = int(os.getenv("GH_CHAT_PORT", "8765"))
ALLOWED_ORIGINS = os.getenv("GH_CHAT_CORS_ORIGINS", "*").split(",")

# ============================================================
# FastAPI 应用
# ============================================================
app = FastAPI(title="光湖聊天系统 WebSocket", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# 连接管理器
# ============================================================
class ConnectionManager:
    """WebSocket连接管理 · 频道订阅 · 消息广播"""

    def __init__(self):
        # channel_id -> set of websocket connections
        self.channels: Dict[str, Set[WebSocket]] = {}
        # all active connections
        self.active: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket, channel: str = "shuangyan"):
        await ws.accept()
        self.active.add(ws)
        if channel not in self.channels:
            self.channels[channel] = set()
        self.channels[channel].add(ws)

    def disconnect(self, ws: WebSocket):
        self.active.discard(ws)
        for ch_set in self.channels.values():
            ch_set.discard(ws)

    def switch_channel(self, ws: WebSocket, old_channel: str, new_channel: str):
        if old_channel in self.channels:
            self.channels[old_channel].discard(ws)
        if new_channel not in self.channels:
            self.channels[new_channel] = set()
        self.channels[new_channel].add(ws)

    async def broadcast(self, channel: str, message: dict):
        """向频道内所有连接广播消息"""
        targets = self.channels.get(channel, set()).copy()
        payload = json.dumps(message, ensure_ascii=False)
        for ws in targets:
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(ws)

    async def broadcast_all(self, message: dict):
        """向所有连接广播(状态变更等)"""
        payload = json.dumps(message, ensure_ascii=False)
        for ws in self.active.copy():
            try:
                await ws.send_text(payload)
            except Exception:
                self.disconnect(ws)


manager = ConnectionManager()
cmd_parser = CommandParser()

# ============================================================
# 消息持久化桩(预留对接GH-DB-001)
# ============================================================
async def persist_message(msg: dict):
    """
    消息持久化 · 预留接口
    后续接入GH-DB-001的chat_messages表
    当前仅打印日志
    """
    # TODO: INSERT INTO chat_messages (id, channel, sender, content, role, timestamp)
    pass


# ============================================================
# WebSocket端点
# ============================================================
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    channel = "shuangyan"  # 默认频道
    await manager.connect(ws, channel)
    try:
        while True:
            raw = await ws.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(json.dumps(
                    {"type": "error", "content": "消息格式错误 · 需要JSON"}, ensure_ascii=False
                ))
                continue

            msg_type = data.get("type", "chat")

            # 心跳
            if msg_type == "ping":
                await ws.send_text(json.dumps({"type": "pong"}))
                continue

            # 切换频道
            if msg_type == "switch_channel":
                new_ch = data.get("channel", channel)
                manager.switch_channel(ws, channel, new_ch)
                channel = new_ch
                continue

            # 聊天消息
            if msg_type == "chat":
                content = data.get("content", "").strip()
                if not content:
                    continue

                target_channel = data.get("channel", channel)

                # 检查是否为指令
                if content.startswith("/"):
                    result: CommandResult = cmd_parser.parse(content)
                    reply = {
                        "type": "chat",
                        "id": str(uuid4()),
                        "channel": target_channel,
                        "sender": "系统",
                        "content": result.response,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "role": "system",
                    }
                    await ws.send_text(json.dumps(reply, ensure_ascii=False))
                    await persist_message(reply)
                    continue

                # 普通消息 · 广播到频道
                msg = {
                    "type": "chat",
                    "id": data.get("id", str(uuid4())),
                    "channel": target_channel,
                    "sender": data.get("sender", "匿名"),
                    "content": content,
                    "timestamp": data.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    "role": data.get("role", "user"),
                }
                await manager.broadcast(target_channel, msg)
                await persist_message(msg)

    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception as e:
        manager.disconnect(ws)
        print(f"[WS] 连接异常: {e}")


# ============================================================
# 健康检查
# ============================================================
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "gh-chat-001",
        "connections": len(manager.active),
        "channels": list(manager.channels.keys()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# Agent状态变更API(供其他服务调用)
# ============================================================
@app.post("/api/agent-status")
async def update_agent_status(agent_id: str, status: str):
    """Agent状态变更 · 广播给所有客户端"""
    msg = {
        "type": "status",
        "agentId": agent_id,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_all(msg)
    return {"ok": True}


@app.post("/api/order-update")
async def order_update(content: str):
    """工单状态变更通知 · 广播给所有客户端"""
    msg = {
        "type": "order_update",
        "content": content,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    await manager.broadcast_all(msg)
    return {"ok": True}


# ============================================================
# 入口
# ============================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ws_server:app", host=HOST, port=PORT, reload=True)
