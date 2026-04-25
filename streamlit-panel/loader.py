#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
loader.py — 数据加载器
工单编号: LC-A02-002
阶段: Phase-0-007

加载 corpus-cleaner 输出的:
  · stats_report.json  — 统计报告
  · corpus_cleaned.jsonl — 清洗后语料(按行JSON)
"""

import json
from typing import Optional


def load_stats(path: str) -> Optional[dict]:
    """
    加载统计报告JSON。

    Args:
        path: stats_report.json 文件路径

    Returns:
        统计报告字典, 加载失败返回 None
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError, PermissionError):
        return None


def load_corpus(path: str) -> list[dict]:
    """
    加载清洗后的JSONL语料。

    每行格式: {role, content, timestamp, source, session_id,
              classification, tags: {persona_involved, emotion_tone,
              complexity, quality_score}}

    Args:
        path: corpus_cleaned.jsonl 文件路径

    Returns:
        turn列表, 文件不存在返回空列表
    """
    turns: list[dict] = []
    try:
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    turns.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
    except (FileNotFoundError, PermissionError):
        pass
    return turns


def group_by_session(turns: list[dict]) -> dict[str, list[dict]]:
    """
    按 session_id 分组。

    Args:
        turns: turn列表

    Returns:
        {session_id: [turn, ...]}
    """
    sessions: dict[str, list[dict]] = {}
    for turn in turns:
        sid = turn.get("session_id", "__unknown__")
        sessions.setdefault(sid, []).append(turn)
    return sessions


def extract_all_personas(turns: list[dict]) -> list[str]:
    """
    提取语料中出现的所有人格体名称(去重排序)。
    """
    personas: set[str] = set()
    for turn in turns:
        tags = turn.get("tags", {})
        for p in tags.get("persona_involved", []):
            personas.add(p)
    return sorted(personas)


def extract_all_classifications(turns: list[dict]) -> list[str]:
    """
    提取语料中出现的所有分类标签(去重排序)。
    """
    classifications: set[str] = set()
    for turn in turns:
        cls = turn.get("classification", "")
        if cls:
            classifications.add(cls)
    return sorted(classifications)
