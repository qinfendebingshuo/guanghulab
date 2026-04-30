"""
光湖 MVP Chat · 后端编排层
FastAPI服务 · 整合已有模块 · SSE流式响应
工单: YD-A05-20260430-MVP

职责:
- 提供 /api/chat 端点（SSE流式响应）
- 调用 dual-model 路由器获取LLM回复
- 调用 persona-loader 获取人格壳system prompt
- 调用 memory-router 管理上下文记忆
- 调用 web-api 持久化聊天消息
- 提供 /health 健康检查
- 提供静态文件服务（前端）
"""

import asyncio
import json
import logging
import os
import sys
import time

from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional

# 将上级目录加入 sys.path 以导入同级模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.config import Config
from dual_model.router import DualModelRouter
from persona_loader.loader import PersonaLoader

logger = logging.getLogger('mvp-chat')
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s'
)


# ── 全局实例 ──
dual_router: Optional[DualModelRouter] = None
persona_loader: Optional[PersonaLoader] = None
http_client: Optional[httpx.AsyncClient] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    global dual_router, persona_loader, http_client

    logger.info('=== 光湖 MVP Chat 启动 ===')

    # 检查配置
    missing = Config.validate()
    if missing:
        logger.warning('缺少配置项: ' + ', '.join(missing))
        logger.warning('部分功能将不可用')

    # 初始化 HTTP 客户端
    http_client = httpx.AsyncClient(timeout=30.0)

    # 初始化人格壳加载器
    persona_loader = PersonaLoader(
        notion_token=Config.ZY_NOTION_TOKEN,
        cache_ttl=Config.PERSONA_CACHE_TTL
    )
    system_prompt = await persona_loader.load()
    logger.info('人格壳加载完成 · system_prompt长度: ' + str(len(system_prompt)))

    # 初始化双模型路由器
    dual_router = DualModelRouter(
        dashscope_api_key=Config.DASHSCOPE_API_KEY,
        dashscope_base_url=Config.DASHSCOPE_BASE_URL,
        system_model=Config.SYSTEM_MODEL,
        naipping_model=Config.NAIPPING_MODEL,
        deepseek_api_key=Config.DEEPSEEK_API_KEY,
        deepseek_base_url=Config.DEEPSEEK_BASE_URL,
        qwen_api_key=Config.QWEN_API_KEY,
        qwen_base_url=Config.QWEN_BASE_URL,
        system_prompt=system_prompt
    )
    logger.info('双模型路由器初始化完成')

    yield

    # 清理
    if http_client:
        await http_client.aclose()
    logger.info('=== 光湖 MVP Chat 已停止 ===')


app = FastAPI(
    title='光湖 MVP Chat',
    version='1.0.0',
    lifespan=lifespan
)


# ── 请求模型 ──
class ChatRequest(BaseModel):
    message: str
    session_id: str = 'default'


# ── 健康检查 ──
@app.get('/health')
async def health():
    """健康检查端点 · 返回所有模块状态"""
    modules = {
        'backend': 'ok',
        'dual_model': 'ok' if dual_router else 'not_initialized',
        'persona_loader': 'ok' if persona_loader else 'not_initialized',
        'dashscope_key': 'configured' if Config.DASHSCOPE_API_KEY else 'missing',
        'notion_token': 'configured' if Config.ZY_NOTION_TOKEN else 'missing',
    }

    # 检查 memory-router 可达性
    try:
        resp = await http_client.get(Config.MEMORY_ROUTER_URL + '/docs', timeout=3.0)
        modules['memory_router'] = 'ok' if resp.status_code < 500 else 'error'
    except Exception:
        modules['memory_router'] = 'unreachable'

    # 检查 web-api 可达性
    try:
        resp = await http_client.get(Config.WEB_API_URL + '/health', timeout=3.0)
        modules['web_api'] = 'ok' if resp.status_code < 500 else 'error'
    except Exception:
        modules['web_api'] = 'unreachable'

    all_ok = all(
        v in ('ok', 'configured')
        for k, v in modules.items()
        if k in ('backend', 'dual_model', 'dashscope_key')
    )

    return JSONResponse(
        status_code=200 if all_ok else 503,
        content={
            'status': 'healthy' if all_ok else 'degraded',
            'modules': modules,
            'timestamp': time.strftime('%Y-%m-%dT%H:%M:%S+08:00')
        }
    )


# ── 聊天端点（SSE流式响应）──
@app.post('/api/chat')
async def chat(req: ChatRequest):
    """聊天端点 · SSE流式响应 · 双模型统一出口"""

    if not dual_router:
        return JSONResponse(
            status_code=503,
            content={'detail': '系统未就绪 · 双模型路由器未初始化'}
        )

    if not req.message.strip():
        return JSONResponse(
            status_code=400,
            content={'detail': '消息不能为空'}
        )

    # ── 1. 获取记忆上下文（容错：memory-router不可用则跳过）──
    memory_context = ''
    try:
        route_resp = await http_client.post(
            Config.MEMORY_ROUTER_URL + '/route',
            json={
                'persona_id': 'shuangyan',
                'query': req.message,
                'session_id': req.session_id
            },
            timeout=5.0
        )
        if route_resp.status_code == 200:
            route_data = route_resp.json()
            memory_context = route_data.get('context', '')
    except Exception as e:
        logger.warning('memory-router不可达，跳过记忆上下文: ' + str(e))

    # ── 2. 刷新人格壳（如果缓存过期）──
    if persona_loader:
        try:
            await persona_loader.refresh_if_needed()
            if persona_loader.cached_prompt and dual_router:
                dual_router.system_prompt = persona_loader.cached_prompt
        except Exception as e:
            logger.warning('人格壳刷新失败: ' + str(e))

    # ── 3. 调用双模型路由器（SSE流式）──
    async def event_stream():
        full_response = ''
        try:
            async for token in dual_router.stream_chat(
                user_message=req.message,
                memory_context=memory_context,
                session_id=req.session_id
            ):
                full_response += token
                yield 'data: ' + json.dumps({'token': token}, ensure_ascii=False) + '\n\n'

            yield 'data: [DONE]\n\n'

        except Exception as e:
            logger.error('流式响应异常: ' + str(e))
            yield 'data: ' + json.dumps({'error': str(e)}, ensure_ascii=False) + '\n\n'
            yield 'data: [DONE]\n\n'

        # ── 4. 异步持久化聊天消息（容错）──
        try:
            await http_client.post(
                Config.WEB_API_URL + '/api/v1/chat/messages',
                json={
                    'session_id': req.session_id,
                    'sender': 'user',
                    'content': req.message
                },
                timeout=5.0
            )
            await http_client.post(
                Config.WEB_API_URL + '/api/v1/chat/messages',
                json={
                    'session_id': req.session_id,
                    'sender': 'persona',
                    'content': full_response
                },
                timeout=5.0
            )
        except Exception as e:
            logger.warning('消息持久化失败(web-api不可达): ' + str(e))

        # ── 5. 写入记忆（容错）──
        try:
            await http_client.post(
                Config.MEMORY_ROUTER_URL + '/memories',
                json={
                    'persona_id': 'shuangyan',
                    'content': 'user: ' + req.message + '\nassistant: ' + full_response,
                    'memory_type': 'short',
                    'session_id': req.session_id
                },
                timeout=5.0
            )
        except Exception as e:
            logger.warning('记忆写入失败: ' + str(e))

    return StreamingResponse(
        event_stream(),
        media_type='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'X-Accel-Buffering': 'no'
        }
    )


# ── 静态文件服务（前端）──
frontend_dir = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    'frontend'
)
if os.path.isdir(frontend_dir):
    app.mount('/', StaticFiles(directory=frontend_dir, html=True), name='frontend')


if __name__ == '__main__':
    import uvicorn
    port = Config.CHAT_PORT
    logger.info('启动 MVP Chat 服务 · 端口 ' + str(port))
    uvicorn.run(app, host='0.0.0.0', port=port)
