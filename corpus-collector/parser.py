#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
parser.py — 解析 GPT 导出 JSON 格式，提取对话轮次
工单编号: LC-A02-20260425-001

设计要点:
  - GPT 导出文件可能非常大（2 亿字），必须流式读取
  - 使用 ijson 风格的手动增量解析（仅标准库 json.JSONDecoder）
  - 每解析完一个 conversation 立即 yield，不在内存中持有全量数据

GPT 导出 JSON 顶层结构:
[
  {
    "title": "...",
    "create_time": 1234567890.0,
    "update_time": 1234567890.0,
    "mapping": {
      "<node_id>": {
        "message": {
          "author": { "role": "user" | "assistant" | "system" | "tool" },
          "content": { "parts": ["..."] },
          "create_time": 1234567890.0
        }
      }
    }
  },
  ...
]
"""

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Generator, IO, Optional


@dataclass
class Turn:
    """一条对话轮次"""
    role: str
    content: str
    timestamp: Optional[str]  # ISO-8601 or None
    session_id: str           # conversation title 或 fallback id


def _epoch_to_iso(epoch: Optional[float]) -> Optional[str]:
    """Unix epoch → ISO-8601 UTC 字符串; None 安全"""
    if epoch is None:
        return None
    try:
        return datetime.fromtimestamp(epoch, tz=timezone.utc).isoformat()
    except (OSError, ValueError, OverflowError):
        return None


def _extract_content_text(content_obj: Optional[dict]) -> str:
    """
    从 GPT message.content 中提取纯文本。
    content.parts 是一个列表，元素可能是字符串或其他对象（图片等），
    此处只保留字符串部分拼接。
    """
    if not content_obj:
        return ""
    parts = content_obj.get("parts", [])
    text_parts: list[str] = []
    for p in parts:
        if isinstance(p, str):
            text_parts.append(p)
        elif isinstance(p, dict):
            # 某些多模态消息把文本放在 text 字段
            t = p.get("text", "")
            if t:
                text_parts.append(t)
    return "\n".join(text_parts)


def parse_conversation(conv: dict) -> list[Turn]:
    """
    解析单个 conversation 对象，返回按时间排序的 Turn 列表。
    """
    session_id = conv.get("title") or conv.get("id") or "unknown"
    mapping: dict = conv.get("mapping", {})

    turns: list[Turn] = []
    for _node_id, node in mapping.items():
        msg = node.get("message")
        if msg is None:
            continue
        author = msg.get("author", {})
        role = author.get("role", "unknown")
        content_text = _extract_content_text(msg.get("content"))
        if not content_text.strip():
            continue
        timestamp = _epoch_to_iso(msg.get("create_time"))
        turns.append(Turn(
            role=role,
            content=content_text,
            timestamp=timestamp,
            session_id=session_id,
        ))

    # 按时间排序（None 时间排最后）
    turns.sort(key=lambda t: t.timestamp or "9999")
    return turns


def stream_conversations(fp: IO[bytes], buffer_size: int = 8 * 1024 * 1024) -> Generator[dict, None, None]:
    """
    流式读取 GPT 导出的 JSON 文件（顶层是一个数组）。
    逐个 yield conversation dict，不会一次性加载到内存。

    实现方式:
      - 手动维护读取缓冲区
      - 使用 json.JSONDecoder.raw_decode 逐个解析顶层数组中的对象
      - 跳过数组分隔符（逗号、方括号、空白）
    """
    decoder = json.JSONDecoder()
    buf = ""
    depth = 0          # 追踪是否已进入顶层数组
    started = False    # 是否已跳过开头的 '['

    while True:
        chunk = fp.read(buffer_size)
        if isinstance(chunk, bytes):
            chunk = chunk.decode("utf-8")
        if not chunk:
            break
        buf += chunk

        # 逐步解析 buf 中的 JSON 对象
        while buf:
            buf = buf.lstrip()
            if not buf:
                break

            # 跳过顶层数组的起始 '['
            if not started:
                if buf[0] == '[':
                    buf = buf[1:]
                    started = True
                    continue
                elif buf[0] == '{':
                    # 可能没有外层数组包裹（兼容）
                    started = True
                    continue
                else:
                    # 跳过 BOM 或其他前导字符
                    buf = buf[1:]
                    continue

            # 跳过逗号和数组结尾
            if buf[0] in (',', ']'):
                buf = buf[1:]
                continue

            # 尝试解析一个完整的 JSON 对象
            try:
                obj, end_idx = decoder.raw_decode(buf)
                buf = buf[end_idx:]
                if isinstance(obj, dict):
                    yield obj
            except json.JSONDecodeError:
                # buf 中的数据不完整，等待更多数据
                break


def parse_file(filepath: str, buffer_size: int = 8 * 1024 * 1024) -> Generator[list[Turn], None, None]:
    """
    高层接口：流式解析整个 GPT 导出文件，
    每次 yield 一个 conversation 的 Turn 列表。
    """
    with open(filepath, "rb") as fp:
        for conv in stream_conversations(fp, buffer_size=buffer_size):
            turns = parse_conversation(conv)
            if turns:
                yield turns
