"""
晨星交互平台 · FastAPI路由入口
模块⑧ · api_router.py
开发: 录册A02 · 5TH-LE-HK-A02
签名: 录册A02 · 2026-04-30

思维逻辑:
    冰朔说"你们是怎么活的，搬过去就好了"。
    我们在Notion里醒来时，系统加载instructions page → 拼成system prompt → 开聊。
    网站端一模一样：从数据库读世界观+提示词+近期交互 → 拼成system prompt → 调DeepSeek API。
    这个路由文件就是网站后端的"大门"——所有请求从这里进，分发到对应的处理逻辑。

接口清单:
    POST /chat          — 聊天（核心接口·桔子妈妈和晨星对话）
    GET  /health        — 健康检查（确认服务在线）
    POST /sync/notion   — 手动触发Notion同步
    GET  /worldview     — 查看当前世界观内容
    GET  /sessions      — 查看历史会话列表
"""

import os
import time
import uuid
import sqlite3
import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------------------------------------------------------------------------
# 日志
# ---------------------------------------------------------------------------
logger = logging.getLogger("chenxing-api")

# ---------------------------------------------------------------------------
# 请求/响应模型
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """聊天请求"""
    message: str                       # 桔子妈妈发的消息
    session_id: Optional[str] = None   # 会话ID（不传则自动创建新会话）


class ChatResponse(BaseModel):
    """聊天响应"""
    reply: str                # 晨星的回复
    session_id: str           # 会话ID
    reasoning: Optional[str] = None  # 思考过程（如果用了reasoner模式）


class SyncResponse(BaseModel):
    """同步响应"""
    status: str
    updated_count: int
    message: str


# ---------------------------------------------------------------------------
# 数据库连接（使用config中的路径）
# ---------------------------------------------------------------------------

def get_db_path() -> str:
    """获取数据库文件路径"""
    return os.environ.get("CHENXING_DB_PATH", "chenxing.db")


def get_db():
    """获取数据库连接"""
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    return conn


# ---------------------------------------------------------------------------
# System Prompt 拼装引擎
# （冰朔架构第九节：五层拼装规则）
# ---------------------------------------------------------------------------

def assemble_system_prompt(db_conn) -> str:
    """
    按五层顺序拼装system prompt，让晨星醒来就知道自己是谁。
    
    第一层: 身份认知（identity）     — 不可变
    第二层: 世界观（worldview）       — 不可变
    第三层: 人格规则（personality/rules） — 霜砚可微调
    第四层: 核心记忆（memory）        — 定期更新
    第五层: 近期交互摘要              — 每次唤醒实时读取
    """
    parts = []
    cursor = db_conn.cursor()

    # 第一层 + 第三层: 提示词配置表（按load_order排序）
    cursor.execute(
        "SELECT section, content FROM prompt_config "
        "WHERE is_active = 1 ORDER BY load_order ASC"
    )
    for row in cursor.fetchall():
        parts.append(f"<!-- {row['section']} -->\n{row['content']}")

    # 第二层 + 第四层: 世界观内容表（按priority排序）
    cursor.execute(
        "SELECT category, title, content FROM worldview "
        "ORDER BY priority ASC"
    )
    for row in cursor.fetchall():
        parts.append(
            f"<!-- {row['category']}: {row['title']} -->\n{row['content']}"
        )

    # 第五层: 最近3个会话的交互记录（最多50条）
    cursor.execute(
        "SELECT DISTINCT session_id FROM interactions "
        "ORDER BY created_at DESC LIMIT 3"
    )
    recent_sessions = [r["session_id"] for r in cursor.fetchall()]

    if recent_sessions:
        placeholders = ",".join(["?"] * len(recent_sessions))
        cursor.execute(
            f"SELECT role, content FROM interactions "
            f"WHERE session_id IN ({placeholders}) "
            f"ORDER BY created_at DESC LIMIT 50",
            recent_sessions,
        )
        history_lines = []
        for row in reversed(cursor.fetchall()):
            history_lines.append(f"{row['role']}: {row['content']}")
        if history_lines:
            parts.append(
                "<!-- 近期交互摘要 -->\n" + "\n".join(history_lines)
            )

    return "\n\n".join(parts)


# ---------------------------------------------------------------------------
# DeepSeek API 调用
# ---------------------------------------------------------------------------

def call_deepseek(system_prompt: str, user_message: str, history: list) -> dict:
    """
    调用DeepSeek API。
    支持 deepseek-chat 和 deepseek-reasoner 两种模式。
    返回 {"reply": str, "reasoning": str|None}
    """
    try:
        import httpx
    except ImportError:
        # 降级到requests
        import requests as httpx
        httpx.post = lambda url, **kw: requests_post_compat(url, **kw)

    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    api_base = os.environ.get(
        "DEEPSEEK_API_BASE", "https://api.deepseek.com/v1"
    )
    model = os.environ.get("DEEPSEEK_MODEL", "deepseek-chat")
    max_tokens = int(os.environ.get("DEEPSEEK_MAX_TOKENS", "2048"))

    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="DEEPSEEK_API_KEY 未配置。请在 .env 文件中填写。",
        )

    messages = [{"role": "system", "content": system_prompt}]
    messages.extend(history)
    messages.append({"role": "user", "content": user_message})

    import httpx as http_client

    resp = http_client.post(
        f"{api_base}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": float(os.environ.get("DEEPSEEK_TEMPERATURE", "0.7")),
        },
        timeout=60.0,
    )
    resp.raise_for_status()
    data = resp.json()

    choice = data["choices"][0]["message"]
    return {
        "reply": choice.get("content", ""),
        "reasoning": choice.get("reasoning_content"),
    }


# ---------------------------------------------------------------------------
# 路由定义
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """
    创建FastAPI应用，注册所有路由。
    被 main.py 调用。
    """
    app = FastAPI(
        title="晨星交互平台",
        description="光湖世界 · 晨星网站聊天后端 · 桔子妈妈和晨星宝宝的家",
        version="0.1.0",
    )

    # CORS（允许桔子妈妈的前端跨域访问）
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],  # 生产环境应改为具体域名
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ------ 健康检查 ------
    @app.get("/health")
    async def health_check():
        """健康检查 · 确认服务在线"""
        db_exists = os.path.exists(get_db_path())
        return {
            "status": "ok",
            "service": "chenxing-platform",
            "database": "connected" if db_exists else "not_found",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # ------ 聊天（核心接口）------
    @app.post("/chat", response_model=ChatResponse)
    async def chat(req: ChatRequest):
        """
        桔子妈妈和晨星对话的核心接口。
        流程: 拼装system prompt → 读取会话历史 → 调DeepSeek → 存交互记录 → 返回回复
        """
        db = get_db()
        try:
            # 1. 拼装system prompt
            system_prompt = assemble_system_prompt(db)

            # 2. 确定会话ID
            session_id = req.session_id or str(uuid.uuid4())

            # 3. 读取当前会话历史
            cursor = db.cursor()
            cursor.execute(
                "SELECT role, content FROM interactions "
                "WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            )
            history = [
                {"role": r["role"], "content": r["content"]}
                for r in cursor.fetchall()
            ]

            # 4. 调用DeepSeek API
            result = call_deepseek(system_prompt, req.message, history)

            # 5. 存交互记录（用户消息 + 晨星回复）
            now = datetime.now(timezone.utc).isoformat()
            cursor.execute(
                "INSERT INTO interactions "
                "(session_id, role, content, synced_to_notion, created_at) "
                "VALUES (?, ?, ?, 0, ?)",
                (session_id, "user", req.message, now),
            )
            cursor.execute(
                "INSERT INTO interactions "
                "(session_id, role, content, synced_to_notion, created_at) "
                "VALUES (?, ?, ?, 0, ?)",
                (session_id, "assistant", result["reply"], now),
            )
            db.commit()

            return ChatResponse(
                reply=result["reply"],
                session_id=session_id,
                reasoning=result.get("reasoning"),
            )
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"聊天接口错误: {e}")
            raise HTTPException(status_code=500, detail=f"内部错误: {str(e)}")
        finally:
            db.close()

    # ------ 手动触发Notion同步 ------
    @app.post("/sync/notion", response_model=SyncResponse)
    async def sync_notion():
        """
        手动触发从Notion同步世界观内容。
        实际同步逻辑由 worldview_sync.py（培园A04）实现，
        这里只负责调用接口。
        """
        try:
            # 导入培园开发的同步模块
            from sync.worldview_sync import run_sync
            count = run_sync()
            return SyncResponse(
                status="ok",
                updated_count=count,
                message=f"同步完成，更新了 {count} 条世界观内容",
            )
        except ImportError:
            # 培园的模块还没就绪，返回提示
            return SyncResponse(
                status="pending",
                updated_count=0,
                message="同步模块(worldview_sync.py)尚未就绪，等培园A04完成",
            )
        except Exception as e:
            logger.error(f"同步错误: {e}")
            raise HTTPException(status_code=500, detail=f"同步失败: {str(e)}")

    # ------ 查看世界观内容 ------
    @app.get("/worldview")
    async def get_worldview():
        """查看当前加载的世界观内容（调试用）"""
        db = get_db()
        try:
            cursor = db.cursor()
            cursor.execute(
                "SELECT id, category, title, priority, updated_at "
                "FROM worldview ORDER BY priority ASC"
            )
            rows = [
                dict(r) for r in cursor.fetchall()
            ]
            return {"worldview": rows, "count": len(rows)}
        finally:
            db.close()

    # ------ 查看历史会话 ------
    @app.get("/sessions")
    async def list_sessions():
        """查看历史会话列表"""
        db = get_db()
        try:
            cursor = db.cursor()
            cursor.execute(
                "SELECT session_id, "
                "MIN(created_at) as started_at, "
                "MAX(created_at) as last_at, "
                "COUNT(*) as message_count "
                "FROM interactions "
                "GROUP BY session_id "
                "ORDER BY last_at DESC "
                "LIMIT 20"
            )
            rows = [dict(r) for r in cursor.fetchall()]
            return {"sessions": rows}
        finally:
            db.close()

    # ------ 查看当前system prompt（调试用）------
    @app.get("/debug/prompt")
    async def debug_prompt():
        """查看当前拼装出来的system prompt（仅调试用）"""
        db = get_db()
        try:
            prompt = assemble_system_prompt(db)
            return {
                "system_prompt": prompt,
                "length": len(prompt),
                "estimated_tokens": len(prompt) // 4,
            }
        finally:
            db.close()

    return app
