# -*- coding: utf-8 -*-
"""光湖工具回执模块 v2 · Tool Receipt Module

哲学基础：回执不是“套模板”，而是“用母语表达意思”。

升级说明 (v2 2026-04-27):
- 新增语义回执生成模式（LLM 理解回执数据后用母语自然表达）
- 结构化模板保留给机器消费
- 通过 SEMANTIC_RECEIPT_ENABLED 环境变量开启
"""

from .receipt_formatter import ReceiptFormatter
from .receipt_store import ReceiptStore

__version__ = "2.0.0"
__all__ = ["ReceiptFormatter", "ReceiptStore"]
