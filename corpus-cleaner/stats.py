#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
stats.py — 统计报告生成器
工单编号: LC-A02-20260425-002

生成内容:
  · 各分类数量 (session级 + turn级)
  · 质量分布 (1-5分各多少session)
  · token统计 (估算)
  · 人格体分布
  · 情感基调分布
  · 复杂度分布

输出: JSON格式统计报告
"""

import json
import os
from collections import Counter, defaultdict
from typing import TextIO, Optional


def _estimate_tokens(text: str) -> int:
    """
    估算文本token数 (不依赖外部库)。
    粗略规则:
      · 中文: 每个汉字约 1.5 token
      · 英文: 每4个字符约 1 token
      · 混合取加权平均
    """
    if not text:
        return 0

    chinese_chars = sum(1 for c in text if '\u4e00' <= c <= '\u9fff')
    other_chars = len(text) - chinese_chars

    tokens = int(chinese_chars * 1.5 + other_chars / 4)
    return max(tokens, 1)


def generate_stats(turns: list[dict]) -> dict:
    """
    从已打标签的turn列表生成统计报告。

    Args:
        turns: 经过 tagger.tag_all_turns() 处理后的turn列表
               每条turn含: classification, tags

    Returns:
        统计报告字典
    """
    # --- 基础计数 ---
    total_turns = len(turns)

    # 按session分组
    sessions: dict[str, list[dict]] = {}
    for turn in turns:
        sid = turn.get("session_id", "__unknown__")
        sessions.setdefault(sid, []).append(turn)

    total_sessions = len(sessions)

    # --- 分类统计 (session级) ---
    classification_counter_session: Counter = Counter()
    for sid, session_turns in sessions.items():
        # session的分类取第一条turn的分类 (同session内一致)
        cls = session_turns[0].get("classification", "unknown")
        classification_counter_session[cls] += 1

    # --- 分类统计 (turn级) ---
    classification_counter_turn: Counter = Counter()
    for turn in turns:
        cls = turn.get("classification", "unknown")
        classification_counter_turn[cls] += 1

    # --- 质量分布 ---
    quality_counter: Counter = Counter()
    for sid, session_turns in sessions.items():
        tags = session_turns[0].get("tags", {})
        q = tags.get("quality_score", 0)
        quality_counter[q] += 1

    # --- 人格体分布 ---
    persona_counter: Counter = Counter()
    for sid, session_turns in sessions.items():
        tags = session_turns[0].get("tags", {})
        personas = tags.get("persona_involved", [])
        for p in personas:
            persona_counter[p] += 1

    # --- 情感基调分布 ---
    emotion_counter: Counter = Counter()
    for sid, session_turns in sessions.items():
        tags = session_turns[0].get("tags", {})
        emotion = tags.get("emotion_tone", "neutral")
        emotion_counter[emotion] += 1

    # --- 复杂度分布 ---
    complexity_counter: Counter = Counter()
    for sid, session_turns in sessions.items():
        tags = session_turns[0].get("tags", {})
        comp = tags.get("complexity", "medium")
        complexity_counter[comp] += 1

    # --- Token统计 ---
    total_tokens = 0
    tokens_by_classification: Counter = Counter()
    for turn in turns:
        content = turn.get("content", "")
        tokens = _estimate_tokens(content)
        total_tokens += tokens
        cls = turn.get("classification", "unknown")
        tokens_by_classification[cls] += tokens

    # --- 组装报告 ---
    report = {
        "summary": {
            "total_sessions": total_sessions,
            "total_turns": total_turns,
            "total_estimated_tokens": total_tokens,
        },
        "classification_by_session": dict(
            sorted(classification_counter_session.items())
        ),
        "classification_by_turn": dict(
            sorted(classification_counter_turn.items())
        ),
        "quality_distribution": {
            str(k): v for k, v in sorted(quality_counter.items())
        },
        "persona_distribution": dict(
            sorted(persona_counter.items(), key=lambda x: -x[1])
        ),
        "emotion_distribution": dict(
            sorted(emotion_counter.items())
        ),
        "complexity_distribution": dict(
            sorted(complexity_counter.items())
        ),
        "tokens_by_classification": dict(
            sorted(tokens_by_classification.items(), key=lambda x: -x[1])
        ),
    }

    return report


def write_stats_json(
    report: dict,
    fp: TextIO,
) -> None:
    """
    将统计报告写入JSON文件。
    """
    json.dump(report, fp, ensure_ascii=False, indent=2)
    fp.write("\n")


def print_stats_summary(report: dict) -> str:
    """
    生成可打印的统计摘要字符串。
    """
    lines = [
        "=" * 50,
        "语料清洗与分类标签 · 统计报告",
        "=" * 50,
        "",
        f"总session数: {report['summary']['total_sessions']}",
        f"总turn数:    {report['summary']['total_turns']}",
        f"估算token:   {report['summary']['total_estimated_tokens']}",
        "",
        "--- 分类分布 (session) ---",
    ]
    for cls, count in report["classification_by_session"].items():
        lines.append(f"  {cls}: {count}")

    lines.append("")
    lines.append("--- 质量分布 ---")
    for score, count in report["quality_distribution"].items():
        lines.append(f"  {score}分: {count} session")

    lines.append("")
    lines.append("--- 人格体分布 (top) ---")
    for persona, count in list(report["persona_distribution"].items())[:10]:
        lines.append(f"  {persona}: {count} session")

    lines.append("")
    lines.append("--- 情感基调 ---")
    for emotion, count in report["emotion_distribution"].items():
        lines.append(f"  {emotion}: {count}")

    lines.append("")
    lines.append("--- 复杂度 ---")
    for comp, count in report["complexity_distribution"].items():
        lines.append(f"  {comp}: {count}")

    lines.append("")
    lines.append("=" * 50)

    return "\n".join(lines)
