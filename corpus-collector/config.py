#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
config.py — 语料采集 Agent 配置项
工单编号: LC-A02-20260425-001
"""

import os
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class CollectorConfig:
    """语料采集全局配置"""

    # ===== 输入 =====
    input_path: str = os.environ.get(
        "CORPUS_INPUT_PATH", "conversations.json"
    )

    # ===== 输出 =====
    output_dir: str = os.environ.get("CORPUS_OUTPUT_DIR", "output")
    output_filename: str = "corpus.jsonl"

    # ===== 过滤规则 =====
    # ISO-8601 日期字符串，None 表示不限
    time_range_start: Optional[str] = None
    time_range_end: Optional[str] = None

    # 是否按 session（conversation）分割输出
    split_by_session: bool = False

    # ===== 去重 =====
    enable_dedup: bool = True

    # ===== 流式读取 =====
    # 每次从文件缓冲区读取的字节数（默认 8 MB）
    read_buffer_size: int = 8 * 1024 * 1024

    # ===== 角色过滤 =====
    # 只保留这些角色的消息；空列表 = 全部保留
    allowed_roles: list[str] = field(default_factory=list)

    @property
    def output_path(self) -> str:
        return os.path.join(self.output_dir, self.output_filename)
