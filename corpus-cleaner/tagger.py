#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
tagger.py — 标签器: 为每条语料添加元数据标签
工单编号: LC-A02-20260425-002

标签维度:
  · persona_involved  — 涉及哪些人格体
  · emotion_tone      — 情感基调 (positive/neutral/negative/mixed)
  · complexity        — 复杂度 (simple/medium/complex)
  · quality_score     — 质量评分 (1-5)

实现: 纯规则+关键词, 不依赖外部LLM API
"""

from typing import Optional

from classifier import classify_session
from config import (
    CleanerConfig,
    DEFAULT_PERSONA_KEYWORDS,
    DEFAULT_EMOTION_KEYWORDS,
)


def detect_personas(
    text: str,
    persona_keywords: Optional[dict[str, list[str]]] = None,
) -> list[str]:
    """
    检测文本中涉及的人格体。

    Returns:
        涉及的人格体名称列表 (去重, 按首次出现排序)
    """
    if persona_keywords is None:
        persona_keywords = DEFAULT_PERSONA_KEYWORDS

    text_lower = text.lower()
    found: list[str] = []
    for persona, kw_list in persona_keywords.items():
        for kw in kw_list:
            if kw.lower() in text_lower:
                if persona not in found:
                    found.append(persona)
                break
    return found


def detect_emotion_tone(
    text: str,
    emotion_keywords: Optional[dict[str, list[str]]] = None,
) -> str:
    """
    检测文本的情感基调。

    Returns:
        "positive" | "negative" | "mixed" | "neutral"
    """
    if emotion_keywords is None:
        emotion_keywords = DEFAULT_EMOTION_KEYWORDS

    text_lower = text.lower()
    pos_count = sum(
        1 for kw in emotion_keywords.get("positive", [])
        if kw.lower() in text_lower
    )
    neg_count = sum(
        1 for kw in emotion_keywords.get("negative", [])
        if kw.lower() in text_lower
    )

    if pos_count > 0 and neg_count > 0:
        return "mixed"
    elif pos_count > 0:
        return "positive"
    elif neg_count > 0:
        return "negative"
    else:
        return "neutral"


def assess_complexity(turns: list[dict]) -> str:
    """
    评估一组turn(同一session)的复杂度。

    规则:
      · simple:  <= 5轮, 总字符 < 500
      · complex: >= 15轮 或 总字符 > 5000
      · medium:  其他
    """
    total_chars = sum(len(t.get("content", "")) for t in turns)
    num_turns = len(turns)

    if num_turns >= 15 or total_chars > 5000:
        return "complex"
    elif num_turns <= 5 and total_chars < 500:
        return "simple"
    else:
        return "medium"


def compute_quality_score(turns: list[dict]) -> int:
    """
    计算session质量评分 (1-5)。

    评分因子:
      · 轮次数: >10轮 +1
      · 内容深度: 平均content长度 > 200字 +1
      · 多角色: 有user和assistant +1
      · 有纠正链: 包含correction类关键词 +1
      · 基础分: 1
    """
    score = 1  # 基础分

    num_turns = len(turns)
    if num_turns >= 10:
        score += 1

    # 内容深度
    contents = [t.get("content", "") for t in turns]
    avg_len = sum(len(c) for c in contents) / max(num_turns, 1)
    if avg_len > 200:
        score += 1

    # 多角色
    roles = set(t.get("role", "") for t in turns)
    if len(roles) >= 2:
        score += 1

    # 纠正链检测
    combined = "\n".join(contents)
    correction_indicators = [
        "不对", "错了", "不是这样", "纠正", "改一下",
        "wrong", "incorrect", "fix",
    ]
    has_correction = any(
        ind in combined for ind in correction_indicators
    )
    if has_correction:
        score += 1

    return min(score, 5)


def tag_session(
    turns: list[dict],
    config: Optional[CleanerConfig] = None,
) -> dict:
    """
    为一个session生成完整的元数据标签。

    Returns:
        {
            "classification": str,
            "persona_involved": list[str],
            "emotion_tone": str,
            "complexity": str,
            "quality_score": int,
        }
    """
    if config is None:
        config = CleanerConfig()

    combined = "\n".join(t.get("content", "") for t in turns)

    classification = classify_session(
        turns, keywords=config.classification_keywords
    )
    personas = detect_personas(
        combined, persona_keywords=config.persona_keywords
    )
    emotion = detect_emotion_tone(
        combined, emotion_keywords=config.emotion_keywords
    )
    complexity = assess_complexity(turns)
    quality = compute_quality_score(turns)

    return {
        "classification": classification,
        "persona_involved": personas,
        "emotion_tone": emotion,
        "complexity": complexity,
        "quality_score": quality,
    }


def tag_all_turns(
    turns: list[dict],
    config: Optional[CleanerConfig] = None,
) -> list[dict]:
    """
    为所有turn打标签, 按session分组后标注, 然后将标签写回每条turn。

    每条turn会新增字段:
      · classification
      · tags: {persona_involved, emotion_tone, complexity, quality_score}

    Returns:
        标注后的turn列表 (原地修改并返回)
    """
    if config is None:
        config = CleanerConfig()

    # 按session分组
    sessions: dict[str, list[dict]] = {}
    for turn in turns:
        sid = turn.get("session_id", "__unknown__")
        sessions.setdefault(sid, []).append(turn)

    # 逐session打标签
    for sid, session_turns in sessions.items():
        tags = tag_session(session_turns, config=config)

        for turn in session_turns:
            turn["classification"] = tags["classification"]
            turn["tags"] = {
                "persona_involved": tags["persona_involved"],
                "emotion_tone": tags["emotion_tone"],
                "complexity": tags["complexity"],
                "quality_score": tags["quality_score"],
            }

    return turns
