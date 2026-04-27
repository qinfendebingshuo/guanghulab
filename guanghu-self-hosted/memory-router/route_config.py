# -*- coding: utf-8 -*-
"""路由配置 · Route Configuration

v2 升级：支持 LLM 语义路由配置
语义路由默认关闭，通过环境变量 SEMANTIC_ROUTE_ENABLED=1 开启
LLM 端点走 config 配置，不硬编码
"""
import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class RouteConfig:
    """路由配置"""
    # === 基础配置 ===
    hot_window_minutes: int = 30
    warm_window_hours: int = 24
    max_results: int = 20
    
    # === 语义路由配置 (v2 新增) ===
    semantic_route_enabled: bool = field(default_factory=lambda: os.getenv("SEMANTIC_ROUTE_ENABLED", "0") == "1")
    llm_endpoint: str = field(default_factory=lambda: os.getenv("LLM_ENDPOINT", "http://localhost:8080/v1/chat/completions"))
    llm_model: str = field(default_factory=lambda: os.getenv("LLM_MODEL", "deepseek-r1"))
    llm_api_key: str = field(default_factory=lambda: os.getenv("LLM_API_KEY", ""))
    semantic_route_timeout: float = 5.0  # 语义路由超时秒数，超时则 fallback 到关键词
    semantic_route_temperature: float = 0.1  # 低温度，路由决策需要确定性
    
    # === 记忆层配置 ===
    hot_layer_path: str = field(default_factory=lambda: os.getenv("MEMORY_HOT_PATH", "./memory/hot"))
    warm_layer_path: str = field(default_factory=lambda: os.getenv("MEMORY_WARM_PATH", "./memory/warm"))
    permanent_layer_path: str = field(default_factory=lambda: os.getenv("MEMORY_PERMANENT_PATH", "./memory/permanent"))
    
    @classmethod
    def from_env(cls) -> "RouteConfig":
        """从环境变量加载配置"""
        return cls(
            hot_window_minutes=int(os.getenv("MEMORY_HOT_WINDOW_MIN", "30")),
            warm_window_hours=int(os.getenv("MEMORY_WARM_WINDOW_HR", "24")),
            max_results=int(os.getenv("MEMORY_MAX_RESULTS", "20")),
        )
