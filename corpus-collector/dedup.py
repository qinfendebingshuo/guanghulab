#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
dedup.py — 基于 content 哈希去重
工单编号: LC-A02-20260425-001

去重策略:
  - 对每条 Turn 的 content 做 SHA-256 哈希
  - 同一 role + content_hash 视为重复
  - 保留首次出现的 Turn，后续重复丢弃
"""

import hashlib
from typing import Generator

from parser import Turn


def _content_key(turn: Turn) -> str:
    """生成去重键: role + content 的 SHA-256"""
    h = hashlib.sha256(turn.content.encode("utf-8")).hexdigest()
    return f"{turn.role}:{h}"


class Deduplicator:
    """有状态去重器，维护已见哈希集合"""

    def __init__(self) -> None:
        self._seen: set[str] = set()
        self.total_in: int = 0
        self.total_out: int = 0
        self.duplicates: int = 0

    def process(self, turns: list[Turn]) -> list[Turn]:
        """过滤重复 Turn，返回去重后列表"""
        result: list[Turn] = []
        for t in turns:
            self.total_in += 1
            key = _content_key(t)
            if key in self._seen:
                self.duplicates += 1
                continue
            self._seen.add(key)
            self.total_out += 1
            result.append(t)
        return result

    def stream_dedup(
        self, turns_iter: Generator[list[Turn], None, None]
    ) -> Generator[list[Turn], None, None]:
        """对 conversation 级别的 Turn 流做去重"""
        for turns in turns_iter:
            deduped = self.process(turns)
            if deduped:
                yield deduped
