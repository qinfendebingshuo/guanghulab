"""GH-API-001 · 工单领取API · 配置模块

Pydantic Settings · 环境变量驱动 · 零硬编码
编号前缀: GH-API · 培园A04
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
    port: int = 8001
    debug: bool = False

    # === CORS ===
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # === API Key 认证 ===
    # 格式: agent_code:api_key 逗号分隔
    # 例: "PY-A04:sk-py-a04-secret,YD-A05:sk-yd-a05-secret"
    agent_api_keys: str = ""

    # === 速率限制 ===
    rate_limit_per_minute: int = 60
    rate_limit_window_seconds: int = 60

    # === 日志 ===
    log_level: str = "INFO"

    # === 工具回执系统集成 ===
    tool_receipt_url: Optional[str] = None

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def api_key_map(self) -> dict[str, str]:
        """解析 agent_code:api_key 映射"""
        result: dict[str, str] = {}
        if not self.agent_api_keys:
            return result
        for pair in self.agent_api_keys.split(","):
            pair = pair.strip()
            if ":" in pair:
                code, key = pair.split(":", 1)
                result[key.strip()] = code.strip()
        return result

    model_config = {
        "env_prefix": "WO_API_",
        "env_file": ".env",
        "extra": "ignore",
    }


settings = Settings()
