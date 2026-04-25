"""GH-API-001 · 工单领取API · FastAPI应用入口

光湖自研平台 · Agent通过REST API领取工单
编号前缀: GH-API · 培园A04
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import db
from config import settings
from routes import router

# ========== 日志配置 ==========

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("work-order-api")


# ========== Lifespan ==========

@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期 · 启动时初始化DB · 关闭时释放连接池"""
    logger.info("Starting work-order-api on %s:%d", settings.host, settings.port)
    await db.init_pool()
    await db.ensure_tables()
    logger.info("Database ready")
    yield
    await db.close_pool()
    logger.info("Shutdown complete")


# ========== FastAPI App ==========

app = FastAPI(
    title="Guanghu Work Order API",
    description=(
        "光湖工单领取REST API · Agent通过HTTP接口领取工单 · "
        "解耦数据库依赖 · API Key认证 · 速率限制"
    ),
    version="0.1.0",
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

# 注册路由
app.include_router(router)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
