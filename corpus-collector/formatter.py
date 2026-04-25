#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
formatter.py — 将解析后的 Turn 转为训练语料格式（JSONL）
工单编号: LC-A02-20260425-001

输出字段: {role, content, timestamp, source, session_id}
"""

import json
from typing import TextIO

from parser import Turn

SOURCE_TAG = "chatgpt-export"


def format_turn(turn: Turn, source: str = SOURCE_TAG) -> dict:
    """Turn → JSONL 行 dict"""
    return {
        "role": turn.role,
        "content": turn.content,
        "timestamp": turn.timestamp,
        "source": source,
        "session_id": turn.session_id,
    }


def write_turns_jsonl(
    turns: list[Turn],
    fp: TextIO,
    source: str = SOURCE_TAG,
) -> int:
    """
    将一组 Turn 写入 JSONL 文件句柄，返回写入行数。
    """
    count = 0
    for turn in turns:
        line = json.dumps(format_turn(turn, source=source), ensure_ascii=False)
        fp.write(line + "\n")
        count += 1
    return count
