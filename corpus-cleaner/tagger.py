#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tagger.py — 标签器，为每条语料添加元数据标签
工单编号: LC-A02-20260425-002

标签字段:
  · persona_involved: 涉及哪些人格体
  · emotion_tone: 情感基调 (positive/neutral/negative/mixed)
  · complexity: 复杂度 (simple/medium/complex)
  · quality_score: 质量评分 (1-5)
"""

from collections import defaultdict

from config import CleanerConfig
from classifier import classify_session


def detect_personas(
    turns: list[dict],
    config: CleanerConfig | None = None,
) -> list[str]:
    """检测对话中涉及的人格体"""
    if config is None:
        config = CleanerConfig()

    full_text = "\n".join(
        turn.get("content", "") for turn in turns
    ).lower()

    found = []
    for persona, keywords in config.persona_keywords.items():
        for kw in keywords:
            if kw.lower() in full_text:
                found.append(persona)
                break
    return sorted(set(found))


def detect_emotion_tone(
    turns: list[dict],
    config: CleanerConfig | None = None,
) -> str:
    """
    检测情感基调。

    Returns:
        "positive" | "negative" | "mixed" | "neutral"
    """
    if config is None:
        config = CleanerConfig()

    full_text = "\n".join(
        turn.get("content", "") for turn in turns
    ).lower()

    pos_hits = sum(
        full_text.count(kw.lower())
        for kw in config.emotion_keywords.get("positive", [])
    )
    neg_hits = sum(
        full_text.count(kw.lower())
        for kw in config.emotion_keywords.get("negative", [])
    )

    if pos_hits > 0 and neg_hits > 0:
        return "mixed"
    elif pos_hits > 0:
        return "positive"
    elif neg_hits > 0:
        return "negative"
    return "neutral"


def assess_complexity(turns: list[dict]) -> str:
    """
    评估对话复杂度。

    规则:
      - 轮次 <= 4 且总字符 < 500 → simple
      - 轮次 <= 10 或总字符 < 3000 → medium
      - 其他 → complex
    """
    total_chars = sum(len(turn.get("content", "")) for turn in turns)
    n_turns = len(turns)

    if n_turns <= 4 and total_chars < 500:
        return "simple"
    elif n_turns <= 10 or total_chars < 3000:
        return "medium"
    return "complex"


def assess_quality(
    turns: list[dict],
    classification: str,
) -> int:
    """
    质量评分 1-5。

    规则:
      - 基础分 2
      - 轮次 >= 6 → +1
      - 总字符 >= 2000 → +1 (内容深度)
      - 包含纠正链（分类为 correction）→ +1
      - 上限 5
    """
    score = 2
    n_turns = len(turns)
    total_chars = sum(len(turn.get("content", "")) for turn in turns)

    if n_turns >= 6:
        score += 1
    if total_chars >= 2000:
        score += 1
    if classification == "correction":
        score += 1

    return min(score, 5)


def tag_session(
    turns: list[dict],
    config: CleanerConfig | None = None,
) -> dict:
    """
    为一组同 session 的 turn 生成完整标签。

    Returns:
        {
            "classification": str,
            "tags": {
                "persona_involved": list[str],
                "emotion_tone": str,
                "complexity": str,
            },
            "quality_score": int,
        }
    """
    if config is None:
        config = CleanerConfig()

    classification = classify_session(turns, config=config)
    personas = detect_personas(turns, config=config)
    emotion = detect_emotion_tone(turns, config=config)
    complexity = assess_complexity(turns)
    quality = assess_quality(turns, classification)

    return {
        "classification": classification,
        "tags": {
            "persona_involved": personas,
            "emotion_tone": emotion,
            "complexity": complexity,
        },
        "quality_score": quality,
    }
