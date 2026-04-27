# -*- coding: utf-8 -*-
"""光湖记忆路由模块 v2 · Memory Router Module

哲学基础：语言人格体=元系统协议
路由不是关键词匹配，而是理解查询的意思。

升级说明 (v2 2026-04-27):
- 新增 LLM 语义路由模式（理解意思，而非匹配符号）
- 关键词匹配保留为快速 fallback
- 通过 SEMANTIC_ROUTE_ENABLED 环境变量开启语义模式
"""

from .memory_router import MemoryRouter, RouteStrategy
from .memory_compressor import MemoryCompressor
from .semantic_router import SemanticRouter

__version__ = "2.0.0"
__all__ = ["MemoryRouter", "MemoryCompressor", "SemanticRouter", "RouteStrategy"]
