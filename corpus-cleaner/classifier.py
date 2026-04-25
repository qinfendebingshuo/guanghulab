#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
classifier.py — 对话分类器
工单编号: LC-A02-20260425-002

按以下6种类型分类（纯规则+关键词，不调用外部LLM）:
  · teaching   — 教学：冰朔教人格体认知/思维/行为
  · correction — 纠正：冰朔纠正人格体错误
  · creation   — 创作：写文/写诗/写代码等创造性任务
  · execution  — 执行：工单/部署/操作类任务
  · chat       — 闲聊：日常对话/情感交流
  · architecture — 架构：系统设计/架构讨论

算法:
  1. 将同一 session 的所有 turn 拼接为一个文本块
  2. 统计每种分类关键词的命中数
  3. 命中数最高的分类胜出，相同时按优先级顺序
  4. 全部无命中 → 默认 chat
"""

from collections import defaultdict

from config import CleanerConfig

# 优先级顺序（当命中数相同时，排在前面的优先）
CLASSIFICATION_PRIORITY = [
    "teaching",
    "correction",
    "architecture",
    "creation",
    "execution",
    "chat",
]


def classify_session(
    turns: list[dict],
    config: CleanerConfig | None = None,
) -> str:
    """
    对一组属于同一 session 的 turn 进行分类。

    Args:
        turns: 同一 session_id 下的所有 turn dict
        config: 配置（提供分类关键词）

    Returns:
        分类名称 str
    """
    if config is None:
        config = CleanerConfig()

    keywords_map = config.classification_keywords

    # 拼接所有 content
    full_text = "\n".join(
        turn.get("content", "") for turn in turns
    ).lower()

    # 统计命中
    hit_counts: dict[str, int] = defaultdict(int)
    for category, keywords in keywords_map.items():
        for kw in keywords:
            # 用 lower 匹配
            count = full_text.count(kw.lower())
            hit_counts[category] += count

    # 找最高命中数
    max_hits = max(hit_counts.values()) if hit_counts else 0

    if max_hits == 0:
        return "chat"  # 默认分类

    # 按优先级顺序，返回第一个达到最高命中数的分类
    for cat in CLASSIFICATION_PRIORITY:
        if hit_counts.get(cat, 0) == max_hits:
            return cat

    # fallback
    return "chat"


def classify_single_turn(
    turn: dict,
    config: CleanerConfig | None = None,
) -> str:
    """
    对单条 turn 进行分类（当不需要 session 级别分类时使用）。
    """
    return classify_session([turn], config=config)
