#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
classifier.py — 对话分类器
工单编号: LC-A02-20260425-002

按以下6种类型对对话session进行分类:
  · teaching   — 教学: 冰朔教人格体认知/思维/行为
  · correction — 纠正: 冰朔纠正人格体错误
  · creation   — 创作: 写文/写诗/写代码等创造性任务
  · execution  — 执行: 工单/部署/操作类任务
  · chat       — 闲聊: 日常对话/情感交流
  · architecture — 架构: 系统设计/架构讨论

实现: 纯规则+关键词, 不依赖外部LLM API
输入: 清洗后的 turn 列表 (按session分组)
输出: 每个session的分类标签
"""

from collections import Counter
from typing import Optional

from config import CleanerConfig, DEFAULT_CLASSIFICATION_KEYWORDS


# 分类优先级 (数字越小优先级越高, 用于平票打破)
_PRIORITY = {
    "correction": 0,
    "teaching": 1,
    "architecture": 2,
    "execution": 3,
    "creation": 4,
    "chat": 5,
}


def _count_keyword_hits(
    text: str,
    keywords: dict[str, list[str]],
) -> Counter:
    """
    统计文本中各分类关键词的命中次数。
    返回 Counter({category: hit_count, ...})
    """
    hits: Counter = Counter()
    text_lower = text.lower()
    for category, kw_list in keywords.items():
        for kw in kw_list:
            # 统计每个关键词在文本中出现的次数
            count = text_lower.count(kw.lower())
            if count > 0:
                hits[category] += count
    return hits


def classify_session(
    turns: list[dict],
    keywords: Optional[dict[str, list[str]]] = None,
) -> str:
    """
    对一组 turn (同一 session) 进行分类。

    策略:
      1. 合并session内所有turn的content
      2. 统计各分类关键词命中次数
      3. 取命中最多的分类; 若平票则按优先级选择
      4. 若无命中则默认 "chat"

    Args:
        turns: 同一session的turn列表, 每个turn为dict含 role/content
        keywords: 分类关键词字典, 默认使用config中的

    Returns:
        分类标签字符串
    """
    if keywords is None:
        keywords = DEFAULT_CLASSIFICATION_KEYWORDS

    # 合并所有content
    combined = "\n".join(
        turn.get("content", "") for turn in turns
    )

    if not combined.strip():
        return "chat"

    hits = _count_keyword_hits(combined, keywords)

    if not hits:
        return "chat"

    # 找到最高命中数
    max_count = hits.most_common(1)[0][1]

    # 收集所有达到最高命中数的分类
    top_categories = [
        cat for cat, cnt in hits.items() if cnt == max_count
    ]

    if len(top_categories) == 1:
        return top_categories[0]

    # 平票: 按优先级排序
    top_categories.sort(key=lambda c: _PRIORITY.get(c, 99))
    return top_categories[0]


def classify_turns(
    turns: list[dict],
    config: Optional[CleanerConfig] = None,
) -> dict[str, str]:
    """
    对所有turn按session分组后逐session分类。

    Args:
        turns: 所有清洗后的turn列表
        config: 配置对象

    Returns:
        {session_id: classification}
    """
    if config is None:
        config = CleanerConfig()

    # 按session分组
    sessions: dict[str, list[dict]] = {}
    for turn in turns:
        sid = turn.get("session_id", "__unknown__")
        sessions.setdefault(sid, []).append(turn)

    results: dict[str, str] = {}
    for sid, session_turns in sessions.items():
        results[sid] = classify_session(
            session_turns,
            keywords=config.classification_keywords,
        )

    return results


def classify_single_turn(turn: dict, keywords: Optional[dict[str, list[str]]] = None) -> str:
    """
    对单条turn分类 (用于逐行标注场景)。
    """
    return classify_session([turn], keywords=keywords)
