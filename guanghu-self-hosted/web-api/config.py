"""GH-API-001 · 光湖网站后端API · 配置模块

Pydantic Settings · 环境变量驱动 · 零硬编码
"""
from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    """应用配置 · 全部从环境变量读取"""

    # === 数据库 ===
    database_url: str = "postgresql://guanghu:guanghu@localhost:5432/guanghu"
    db_pool_min_size: int = 2
    db_pool_max_size: int = 10

    # === 服务 ===
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # === CORS ===
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # === JWT (Phase 2 预留) ===
    jwt_secret: str = "changeme-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    # === GitHub Webhook ===
    github_webhook_secret: Optional[str] = None

    # === 工具回执系统集成 (Phase 0) ===
    tool_receipt_url: Optional[str] = None

    # === 记忆路由集成 (Phase 0) ===
    memory_router_url: Optional[str] = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_prefix": "GH_API_", "env_file": ".env", "extra": "ignore"}


settings = Settings()
