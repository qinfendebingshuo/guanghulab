"""GH-API-002 · 光湖网站后端API · 主入口 · 对齐GH-DB-001

FastAPI app + lifespan管理
光湖自研开发中枢 · Agent Dev Hub后端
v0.2.0 · Schema对齐GH-DB-001 + 聊天端点
"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from db import init_pool, close_pool
from models import HealthResponse, TokenRequest, MessageResponse
from routes.orders import router as orders_router
from routes.agents import router as agents_router
from routes.dispatch import router as dispatch_router
from routes.webhook import router as webhook_router
from routes.chat import router as chat_router

logging.basicConfig(
    level=logging.DEBUG if settings.debug else logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("guanghu.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("Starting guanghu-web-api v0.2.0 (GH-DB-001 aligned)...")
    logger.info("Initializing database pool: %s", settings.database_url.split("@")[-1])
    try:
        await init_pool()
        logger.info("Database pool initialized.")
    except Exception as e:
        logger.error("Failed to initialize database pool: %s", e)
        raise
    yield
    logger.info("Shutting down guanghu-web-api...")
    await close_pool()
    logger.info("Database pool closed.")


app = FastAPI(
    title="光湖网站后端API",
    description="光湖自研开发中枢 · Agent Dev Hub · 对齐GH-DB-001 · 工单+Agent+聊天+GitHub集成",
    version="0.2.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 路由注册
app.include_router(orders_router)
app.include_router(agents_router)
app.include_router(dispatch_router)
app.include_router(webhook_router)
app.include_router(chat_router)


# ========== 顶层端点 ==========

@app.get("/api/health", response_model=HealthResponse, tags=["system"])
async def health_check():
    """健康检查"""
    return HealthResponse()


@app.post("/api/auth/token", response_model=MessageResponse, tags=["auth"])
async def auth_token(body: TokenRequest):
    """JWT认证（Phase 2预留 · 当前返回提示）"""
    return MessageResponse(
        message="JWT authentication not yet implemented. Reserved for Phase 2.",
        success=False,
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
