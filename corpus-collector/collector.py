#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
collector.py — 语料采集 Agent 主入口
工单编号: LC-A02-20260425-001

功能:
  1. 流式读取 GPT 导出的 conversations.json
  2. 解析对话轮次（role + content + timestamp）
  3. 去重
  4. 按 session 分割 或 合并输出 JSONL
  5. 输出统计：总对话轮数、去重后轮数、token 估算

用法:
  python collector.py                        # 使用默认配置
  python collector.py --input data/conversations.json --output output/
  python collector.py --split-by-session     # 每个 session 一个文件
  python collector.py --time-start 2025-01-01 --time-end 2026-01-01
"""

import argparse
import os
import sys
from datetime import datetime, timezone

from config import CollectorConfig
from parser import parse_file, Turn
from formatter import write_turns_jsonl
from dedup import Deduplicator

# tiktoken 可选依赖
try:
    import tiktoken
    _ENC = tiktoken.encoding_for_model("gpt-4")
    def estimate_tokens(text: str) -> int:
        return len(_ENC.encode(text))
except ImportError:
    def estimate_tokens(text: str) -> int:
        # 粗略估算: 1 token ≈ 4 字符（英文）/ 1.5 字符（中文混合）
        return max(1, len(text) // 2)


def _in_time_range(turn: Turn, start: str | None, end: str | None) -> bool:
    """判断 Turn 是否在时间范围内"""
    if turn.timestamp is None:
        return True  # 无时间戳 → 不过滤
    ts = turn.timestamp
    if start and ts < start:
        return False
    if end and ts > end:
        return False
    return True


def _filter_roles(turns: list[Turn], allowed: list[str]) -> list[Turn]:
    """按角色过滤"""
    if not allowed:
        return turns
    return [t for t in turns if t.role in allowed]


def run(cfg: CollectorConfig) -> None:
    """主执行流程"""
    os.makedirs(cfg.output_dir, exist_ok=True)

    dedup = Deduplicator()
    total_turns = 0
    total_tokens = 0
    session_count = 0

    if cfg.split_by_session:
        # 每个 session 单独输出一个 JSONL 文件
        for turns in parse_file(cfg.input_path, buffer_size=cfg.read_buffer_size):
            turns = _filter_roles(turns, cfg.allowed_roles)
            turns = [t for t in turns if _in_time_range(t, cfg.time_range_start, cfg.time_range_end)]
            if cfg.enable_dedup:
                turns = dedup.process(turns)
            if not turns:
                continue
            session_count += 1
            session_id = turns[0].session_id.replace("/", "_").replace(" ", "_")[:80]
            out_path = os.path.join(cfg.output_dir, f"session_{session_count:05d}_{session_id}.jsonl")
            with open(out_path, "w", encoding="utf-8") as fp:
                n = write_turns_jsonl(turns, fp)
                total_turns += n
                total_tokens += sum(estimate_tokens(t.content) for t in turns)
    else:
        # 合并输出到单个 JSONL
        with open(cfg.output_path, "w", encoding="utf-8") as fp:
            for turns in parse_file(cfg.input_path, buffer_size=cfg.read_buffer_size):
                turns = _filter_roles(turns, cfg.allowed_roles)
                turns = [t for t in turns if _in_time_range(t, cfg.time_range_start, cfg.time_range_end)]
                if cfg.enable_dedup:
                    turns = dedup.process(turns)
                if not turns:
                    continue
                session_count += 1
                n = write_turns_jsonl(turns, fp)
                total_turns += n
                total_tokens += sum(estimate_tokens(t.content) for t in turns)

    # ===== 输出统计 =====
    print("=" * 50)
    print("语料采集 Agent · 统计报告")
    print("=" * 50)
    print(f"输入文件:       {cfg.input_path}")
    print(f"会话数:         {session_count}")
    print(f"总对话轮数:     {dedup.total_in}")
    print(f"去重后轮数:     {dedup.total_out}")
    print(f"重复丢弃:       {dedup.duplicates}")
    print(f"输出轮数:       {total_turns}")
    print(f"Token 估算:     {total_tokens:,}")
    if cfg.split_by_session:
        print(f"输出目录:       {cfg.output_dir}/")
    else:
        print(f"输出文件:       {cfg.output_path}")
    print("=" * 50)


def main() -> None:
    ap = argparse.ArgumentParser(description="语料采集 Agent — 从 GPT 导出 JSON 提取训练语料")
    ap.add_argument("--input", "-i", default=None, help="GPT 导出 JSON 路径")
    ap.add_argument("--output", "-o", default=None, help="输出目录")
    ap.add_argument("--split-by-session", action="store_true", help="按 session 分割输出")
    ap.add_argument("--time-start", default=None, help="起始时间 (ISO-8601)")
    ap.add_argument("--time-end", default=None, help="截止时间 (ISO-8601)")
    ap.add_argument("--no-dedup", action="store_true", help="禁用去重")
    ap.add_argument("--roles", nargs="*", default=[], help="只保留指定角色 (如 user assistant)")
    args = ap.parse_args()

    cfg = CollectorConfig()
    if args.input:
        cfg.input_path = args.input
    if args.output:
        cfg.output_dir = args.output
    if args.split_by_session:
        cfg.split_by_session = True
    if args.time_start:
        cfg.time_range_start = args.time_start
    if args.time_end:
        cfg.time_range_end = args.time_end
    if args.no_dedup:
        cfg.enable_dedup = False
    if args.roles:
        cfg.allowed_roles = args.roles

    if not os.path.isfile(cfg.input_path):
        print(f"错误: 输入文件不存在 → {cfg.input_path}", file=sys.stderr)
        sys.exit(1)

    run(cfg)


if __name__ == "__main__":
    main()
