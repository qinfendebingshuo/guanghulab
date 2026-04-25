#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
test_parser.py — parser.py 单元测试
工单编号: LC-A02-20260425-001

验证:
  1. parse_conversation 正确解析 GPT conversation 结构
  2. stream_conversations 流式解析顶层数组
  3. 空/异常数据不崩溃
  4. 时间排序正确
  5. 多模态内容只提取文本
"""

import io
import json
import unittest

from parser import (
    Turn,
    parse_conversation,
    stream_conversations,
    _epoch_to_iso,
    _extract_content_text,
)


class TestEpochToIso(unittest.TestCase):
    def test_valid_epoch(self):
        result = _epoch_to_iso(0.0)
        self.assertEqual(result, "1970-01-01T00:00:00+00:00")

    def test_none(self):
        self.assertIsNone(_epoch_to_iso(None))

    def test_recent_epoch(self):
        # 2025-01-01 00:00:00 UTC = 1735689600
        result = _epoch_to_iso(1735689600.0)
        self.assertIn("2025-01-01", result)


class TestExtractContentText(unittest.TestCase):
    def test_simple_parts(self):
        content = {"parts": ["Hello", " world"]}
        self.assertEqual(_extract_content_text(content), "Hello\n world")

    def test_mixed_parts(self):
        content = {"parts": ["text", {"image": "base64"}, {"text": "more"}]}
        self.assertEqual(_extract_content_text(content), "text\nmore")

    def test_none_content(self):
        self.assertEqual(_extract_content_text(None), "")

    def test_empty_parts(self):
        self.assertEqual(_extract_content_text({"parts": []}), "")


class TestParseConversation(unittest.TestCase):
    def _make_conv(self, title="test_session", messages=None):
        """构造一个最小化的 GPT conversation dict"""
        mapping = {}
        for i, (role, text, ts) in enumerate(messages or []):
            mapping[f"node_{i}"] = {
                "message": {
                    "author": {"role": role},
                    "content": {"parts": [text]},
                    "create_time": ts,
                }
            }
        return {"title": title, "mapping": mapping}

    def test_basic_parse(self):
        conv = self._make_conv(messages=[
            ("user", "你好", 1000.0),
            ("assistant", "你好！有什么可以帮你的？", 1001.0),
        ])
        turns = parse_conversation(conv)
        self.assertEqual(len(turns), 2)
        self.assertEqual(turns[0].role, "user")
        self.assertEqual(turns[0].content, "你好")
        self.assertEqual(turns[1].role, "assistant")
        self.assertEqual(turns[0].session_id, "test_session")

    def test_time_ordering(self):
        conv = self._make_conv(messages=[
            ("assistant", "回复", 2000.0),
            ("user", "问题", 1000.0),
        ])
        turns = parse_conversation(conv)
        self.assertEqual(turns[0].content, "问题")
        self.assertEqual(turns[1].content, "回复")

    def test_empty_content_skipped(self):
        conv = self._make_conv(messages=[
            ("system", "", 100.0),
            ("user", "有内容", 200.0),
        ])
        turns = parse_conversation(conv)
        self.assertEqual(len(turns), 1)
        self.assertEqual(turns[0].content, "有内容")

    def test_no_message_node(self):
        conv = {
            "title": "edge",
            "mapping": {
                "node_0": {},  # no 'message' key
                "node_1": {"message": None},
            }
        }
        turns = parse_conversation(conv)
        self.assertEqual(len(turns), 0)

    def test_missing_title_uses_id(self):
        conv = {"id": "fallback_id", "mapping": {
            "n": {
                "message": {
                    "author": {"role": "user"},
                    "content": {"parts": ["hi"]},
                    "create_time": 100.0,
                }
            }
        }}
        turns = parse_conversation(conv)
        self.assertEqual(turns[0].session_id, "fallback_id")


class TestStreamConversations(unittest.TestCase):
    def _json_bytes(self, obj) -> io.BytesIO:
        return io.BytesIO(json.dumps(obj).encode("utf-8"))

    def test_stream_single(self):
        data = [{"title": "s1", "mapping": {}}]
        convs = list(stream_conversations(self._json_bytes(data), buffer_size=64))
        self.assertEqual(len(convs), 1)
        self.assertEqual(convs[0]["title"], "s1")

    def test_stream_multiple(self):
        data = [
            {"title": "s1", "mapping": {}},
            {"title": "s2", "mapping": {}},
            {"title": "s3", "mapping": {}},
        ]
        convs = list(stream_conversations(self._json_bytes(data), buffer_size=32))
        self.assertEqual(len(convs), 3)
        titles = [c["title"] for c in convs]
        self.assertEqual(titles, ["s1", "s2", "s3"])

    def test_stream_empty_array(self):
        convs = list(stream_conversations(io.BytesIO(b"[]"), buffer_size=16))
        self.assertEqual(len(convs), 0)

    def test_stream_small_buffer(self):
        """极小 buffer 验证增量解析不崩溃"""
        data = [{"title": "tiny", "mapping": {"n": {"message": {
            "author": {"role": "user"},
            "content": {"parts": ["hello world"]},
            "create_time": 100.0,
        }}}}]
        convs = list(stream_conversations(self._json_bytes(data), buffer_size=8))
        self.assertEqual(len(convs), 1)


if __name__ == "__main__":
    unittest.main()
