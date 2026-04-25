#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
cleaner.py — 语料清洗器
工单编号: LC-A02-20260425-002

职责:
  · 去除系统提示词/模板文本/重复的开场白
  · 修复编码问题（乱码检测+修复）
  · 过滤过短对话（少于3轮的对话session）
  · 过滤纯指令/纯代码的对话（保留但打标签）

输入: corpus-collector 输出的 JSONL
  每行: {role, content, timestamp, source, session_id}
输出: 清洗后的 Turn 列表 + 清洗统计
"""

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Iterator, TextIO

from config import CleanerConfig


@dataclass
class CleanStats:
    """清洗过程统计"""
    total_input: int = 0
    removed_system_prompt: int = 0
    removed_repetitive_greeting: int = 0
    removed_short_session: int = 0
    encoding_fixed: int = 0
    flagged_code_heavy: int = 0
    total_output: int = 0


def _is_system_prompt(content: str, patterns: list[str]) -> bool:
    """检测是否为系统提示词/模板文本"""
    for pat in patterns:
        if pat.lower() in content[:500].lower():
            return True
    return False


def _is_repetitive_greeting(content: str, patterns: list[str]) -> bool:
    """检测是否为重复开场白（仅检测开头）"""
    trimmed = content.strip()[:60]
    for pat in patterns:
        if trimmed.startswith(pat):
            return True
    return False


def _fix_encoding(text: str) -> tuple[str, bool]:
    """尝试修复常见编码乱码，返回 (修复后文本, 是否修复过)"""
    fixed = False
    # 常见 mojibake: UTF-8 被当作 latin-1 读取
    try:
        encoded = text.encode("latin-1")
        decoded = encoded.decode("utf-8")
        if decoded != text:
            return decoded, True
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass

    # 替换常见乱码占位符
    replacements = {
        "\ufffd": "",   # Unicode replacement character
        "\x00": "",     # null byte
    }
    result = text
    for old, new in replacements.items():
        if old in result:
            result = result.replace(old, new)
            fixed = True

    return result, fixed


def _code_line_ratio(content: str) -> float:
    """估算 content 中代码行占比"""
    lines = content.strip().split("\n")
    if not lines:
        return 0.0
    code_indicators = (
        "import ", "from ", "def ", "class ", "return ",
        "if ", "for ", "while ", "try:", "except",
        "const ", "let ", "var ", "function ",
        "  ", "\t", "{", "}", "=>", "//", "#!",
        "```",
    )
    code_lines = sum(
        1 for line in lines
        if any(line.strip().startswith(ind) or ind in line for ind in code_indicators)
    )
    return code_lines / len(lines)


def read_jsonl(fp: TextIO) -> Iterator[dict]:
    """逐行读取 JSONL，跳过空行和解析失败行"""
    for lineno, line in enumerate(fp, 1):
        line = line.strip()
        if not line:
            continue
        try:
            yield json.loads(line)
        except json.JSONDecodeError:
            # 跳过损坏行
            continue


def clean_corpus(
    input_fp: TextIO,
    config: CleanerConfig | None = None,
) -> tuple[list[dict], CleanStats]:
    """
    主清洗流程。

    返回:
        (cleaned_turns, stats)
    """
    if config is None:
        config = CleanerConfig()

    stats = CleanStats()

    # 第一遍: 读取所有 turn，按 session 分组
    sessions: dict[str, list[dict]] = defaultdict(list)
    for record in read_jsonl(input_fp):
        stats.total_input += 1

        content = record.get("content", "")
        role = record.get("role", "")

        # 1. 编码修复
        if config.fix_encoding and content:
            content_fixed, was_fixed = _fix_encoding(content)
            if was_fixed:
                stats.encoding_fixed += 1
                record["content"] = content_fixed
                content = content_fixed

        # 2. 去除系统提示词（role=system 或内容匹配）
        if role == "system" or _is_system_prompt(
            content, config.system_prompt_patterns
        ):
            stats.removed_system_prompt += 1
            continue

        # 3. 去除重复开场白（仅 assistant 角色）
        if role == "assistant" and _is_repetitive_greeting(
            content, config.repetitive_greeting_patterns
        ):
            stats.removed_repetitive_greeting += 1
            continue

        session_id = record.get("session_id", "__unknown__")
        sessions[session_id].append(record)

    # 第二遍: 过滤过短 session + 打代码标签
    cleaned: list[dict] = []
    for session_id, turns in sessions.items():
        if len(turns) < config.min_turns_per_session:
            stats.removed_short_session += len(turns)
            continue

        for turn in turns:
            content = turn.get("content", "")
            # 打代码重标签
            code_ratio = _code_line_ratio(content)
            if code_ratio >= config.code_ratio_threshold:
                turn.setdefault("_flags", []).append("code_heavy")
                stats.flagged_code_heavy += 1

            cleaned.append(turn)

    stats.total_output = len(cleaned)
    return cleaned, stats
