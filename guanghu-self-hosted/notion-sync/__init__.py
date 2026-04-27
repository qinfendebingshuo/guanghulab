# -*- coding: utf-8 -*-
"""光湖Notion同步模块 v2 · Notion Sync Module

哲学基础：页面不是「数据提取」，而是「语言理解」。

升级说明 (v2 2026-04-27):
- 新增语义提取模式（LLM 理解页面意思后提取关键信息）
- JSONL 结构化导出保留为数据管道
- 通过 SEMANTIC_SYNC_ENABLED 环境变量开启
"""

from .sync_notion import NotionSyncer
from .export_formatter import ExportFormatter
from .semantic_extractor import SemanticExtractor

__version__ = "2.0.0"
__all__ = ["NotionSyncer", "ExportFormatter", "SemanticExtractor"]
