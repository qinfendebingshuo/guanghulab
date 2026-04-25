#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
config.py — 光湖语料可视化面板配置
工单编号: LC-A02-002
阶段: Phase-0-007
"""

import os
from dataclasses import dataclass


@dataclass
class PanelConfig:
    """面板全局配置 · 支持环境变量覆盖"""

    # ===== 数据源路径 =====
    stats_path: str = os.environ.get(
        "PANEL_STATS_PATH", "../cleaned_output/stats_report.json"
    )
    corpus_path: str = os.environ.get(
        "PANEL_CORPUS_PATH", "../cleaned_output/corpus_cleaned.jsonl"
    )

    # ===== 页面配置 =====
    page_title: str = "光湖语料面板"
    page_icon: str = "\U0001f4ca"  # 📊
    layout: str = "wide"

    # ===== 浏览器分页 =====
    explorer_page_size: int = 10
    content_preview_length: int = 500

    # ===== 质量评分范围 =====
    quality_min: int = 1
    quality_max: int = 5

    # ===== 6种分类标签(与corpus-cleaner对齐) =====
    classification_labels: tuple = (
        "teaching", "correction", "creation",
        "execution", "architecture", "chat",
    )

    # ===== 分类中文映射 =====
    classification_cn: dict = None

    def __post_init__(self):
        if self.classification_cn is None:
            self.classification_cn = {
                "teaching": "教学",
                "correction": "纠正",
                "creation": "创作",
                "execution": "执行",
                "architecture": "架构",
                "chat": "闲聊",
            }
