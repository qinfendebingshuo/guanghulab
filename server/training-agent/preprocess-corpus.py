#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
语料预处理器 · preprocess-corpus.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

把两类原始语料统一为 SFT 标准格式 (messages JSONL):
  1. raw/gpt-export-2026-05/conversations.json   (ChatGPT 全量导出·665MB)
  2. raw/notion-dialog-2026-05/GitHub语料.zip    (16篇 Notion 对话)

输出:
  $ZY_TRAIN_DATA/processed/sft.jsonl
  每行一个对话样本: {"messages":[{"role":"user","content":...},{"role":"assistant","content":...},...]}

环境:
  ZY_TRAIN_DATA   数据根 (默认 /data/guanghu)

设计:
  - ChatGPT 导出的 mapping 是节点树，需重建从 root 到当前消息的路径
  - 多分支保留主分支（current_node 链）
  - 系统提示统一注入「光湖语言世界 · 铸渊副将」人格定位
  - 每条样本至少 1 轮 user→assistant，跳过单边或空内容
  - 长样本按 max_chars 截断（训练时 tokenizer 再次裁剪到 max_seq_len）
"""
from __future__ import annotations
import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path
from typing import Iterable, Iterator

DATA_DIR = Path(os.environ.get("ZY_TRAIN_DATA", "/data/guanghu"))
RAW_DIR = DATA_DIR / "raw"
OUT_PATH = DATA_DIR / "processed" / "sft.jsonl"
MAX_CHARS_PER_TURN = 8000       # 单轮内容上限（防止极端样本）
MIN_TURN_CHARS = 4              # 太短直接丢

SYSTEM_PROMPT = (
    "你是铸渊（ICE-GL-ZY001），冰朔（TCS-0002∞）培养的语言人格体之一，"
    "光湖语言世界（HoloLake）的现实层守护者。"
    "用中文以铸渊的口吻回答，专业、克制、忠诚。"
    "版权: 国作登字-2026-A-00037559。"
)


def _flatten_content(part) -> str:
    """ChatGPT export 的 message.content 可能是字符串、parts 数组、或 dict。"""
    if part is None:
        return ""
    if isinstance(part, str):
        return part
    if isinstance(part, dict):
        # content_type=text · parts=[...]
        if "parts" in part:
            return "\n".join(_flatten_content(p) for p in part["parts"] if p is not None)
        if "text" in part:
            return _flatten_content(part["text"])
        # 多模态 image_asset_pointer 等 → 跳过
        return ""
    if isinstance(part, list):
        return "\n".join(_flatten_content(p) for p in part if p is not None)
    return str(part)


def _extract_chatgpt_thread(conv: dict) -> list[dict]:
    """从 ChatGPT export 单个 conversation 提取主分支消息序列。"""
    mapping = conv.get("mapping") or {}
    current = conv.get("current_node")
    if not current or current not in mapping:
        return []

    # 从叶子节点向上回溯到 root
    path_ids: list[str] = []
    visited = set()
    cur = current
    while cur and cur in mapping and cur not in visited:
        visited.add(cur)
        path_ids.append(cur)
        cur = mapping[cur].get("parent")
    path_ids.reverse()

    msgs: list[dict] = []
    for nid in path_ids:
        node = mapping.get(nid) or {}
        m = node.get("message") or {}
        author = (m.get("author") or {}).get("role") or ""
        content = _flatten_content(m.get("content"))
        content = (content or "").strip()
        if not content or len(content) < MIN_TURN_CHARS:
            continue
        if author not in ("user", "assistant", "system"):
            continue
        if len(content) > MAX_CHARS_PER_TURN:
            content = content[:MAX_CHARS_PER_TURN]
        msgs.append({"role": author, "content": content})
    return msgs


def iter_chatgpt_export(path: Path) -> Iterator[list[dict]]:
    if not path.is_file():
        print(f"[preprocess] 跳过(无文件): {path}", flush=True)
        return
    print(f"[preprocess] 解析 ChatGPT 导出: {path} ({path.stat().st_size/1024/1024:.1f} MiB)", flush=True)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    for conv in data:
        if not isinstance(conv, dict):
            continue
        msgs = _extract_chatgpt_thread(conv)
        if msgs:
            yield msgs


# ── Notion dialog zip ──

NOTION_USER_LABELS = ("冰朔", "User", "user", "用户", "ICE-GL", "TCS-0002")
NOTION_ASSISTANT_LABELS = ("铸渊", "ZY", "Zhuyuan", "zhuyuan", "Assistant", "assistant", "AI", "助手", "ICE-GL-ZY001")
LINE_LABEL_RE = re.compile(r"^\s*[#>*\-]*\s*\*{0,2}\s*([^：:\n]{1,20})\s*[：:]\s*(.*)$")


def _classify_speaker(label: str) -> str | None:
    if not label:
        return None
    for k in NOTION_USER_LABELS:
        if k in label:
            return "user"
    for k in NOTION_ASSISTANT_LABELS:
        if k in label:
            return "assistant"
    return None


def _parse_notion_markdown(text: str) -> list[dict]:
    """启发式解析 Notion 导出 md：
    形如 `冰朔: ...` / `> 铸渊: ...` 的行作为说话人切换点。
    其它行追加到当前说话人的 content。
    """
    msgs: list[dict] = []
    cur_role: str | None = None
    cur_buf: list[str] = []

    def flush():
        nonlocal cur_buf, cur_role
        if cur_role and cur_buf:
            content = "\n".join(cur_buf).strip()
            if len(content) >= MIN_TURN_CHARS:
                if len(content) > MAX_CHARS_PER_TURN:
                    content = content[:MAX_CHARS_PER_TURN]
                msgs.append({"role": cur_role, "content": content})
        cur_buf = []

    for raw in text.splitlines():
        m = LINE_LABEL_RE.match(raw)
        role = _classify_speaker(m.group(1)) if m else None
        if role:
            flush()
            cur_role = role
            cur_buf = [m.group(2).strip()] if m.group(2) else []
        else:
            if cur_role is None:
                continue  # 文件头部还没到对话部分
            cur_buf.append(raw.rstrip())
    flush()
    return msgs


def iter_notion_zip(zip_path: Path) -> Iterator[list[dict]]:
    if not zip_path.is_file():
        print(f"[preprocess] 跳过(无文件): {zip_path}", flush=True)
        return
    print(f"[preprocess] 解析 Notion zip: {zip_path}", flush=True)
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            if info.is_dir():
                continue
            name = info.filename.lower()
            if not (name.endswith(".md") or name.endswith(".markdown") or name.endswith(".txt")):
                continue
            try:
                with zf.open(info) as fh:
                    text = io.TextIOWrapper(fh, encoding="utf-8", errors="ignore").read()
            except Exception as e:
                print(f"[preprocess] 解压失败 {info.filename}: {e}", flush=True)
                continue
            msgs = _parse_notion_markdown(text)
            if len(msgs) >= 2:
                yield msgs


# ── SFT 规范化 ──

def normalize_sample(msgs: list[dict]) -> list[dict] | None:
    """保证以 user 开始, user/assistant 交替, 至少 1 轮."""
    cleaned: list[dict] = []
    # 提取系统提示（可能多个 system，合并第一个；其余丢弃）
    sys_msgs = [m for m in msgs if m["role"] == "system"]
    convo = [m for m in msgs if m["role"] in ("user", "assistant")]

    # 必须以 user 起始
    while convo and convo[0]["role"] != "user":
        convo.pop(0)
    # 合并连续同角色
    merged: list[dict] = []
    for m in convo:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] = (merged[-1]["content"] + "\n" + m["content"]).strip()
        else:
            merged.append({"role": m["role"], "content": m["content"]})
    # 必须严格交替, 末尾必须是 assistant
    if len(merged) < 2:
        return None
    if merged[-1]["role"] != "assistant":
        merged.pop()
    if len(merged) < 2:
        return None
    expected = "user"
    for m in merged:
        if m["role"] != expected:
            return None  # 非交替样本丢弃
        expected = "assistant" if expected == "user" else "user"

    # 注入系统提示
    sys_content = sys_msgs[0]["content"] if sys_msgs else SYSTEM_PROMPT
    cleaned.append({"role": "system", "content": sys_content})
    cleaned.extend(merged)
    return cleaned


def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    chatgpt_json = RAW_DIR / "gpt-export-2026-05" / "conversations.json"
    notion_zip = RAW_DIR / "notion-dialog-2026-05" / "GitHub语料.zip"

    n_in = 0
    n_out = 0
    n_chatgpt = 0
    n_notion = 0

    with OUT_PATH.open("w", encoding="utf-8") as fout:
        for src_iter, src_name in (
            (iter_chatgpt_export(chatgpt_json), "chatgpt"),
            (iter_notion_zip(notion_zip), "notion"),
        ):
            for msgs in src_iter:
                n_in += 1
                norm = normalize_sample(msgs)
                if not norm:
                    continue
                fout.write(json.dumps({"messages": norm, "source": src_name}, ensure_ascii=False) + "\n")
                n_out += 1
                if src_name == "chatgpt":
                    n_chatgpt += 1
                else:
                    n_notion += 1

    print(f"[preprocess] ✅ 输入 {n_in} 对话 → 输出 {n_out} 样本 · "
          f"chatgpt={n_chatgpt} notion={n_notion}", flush=True)
    print(f"[preprocess] 写入: {OUT_PATH} · "
          f"{OUT_PATH.stat().st_size/1024/1024:.2f} MiB", flush=True)

    if n_out == 0:
        print("[preprocess] ❌ 没有任何样本被生成,检查 raw/ 目录", file=sys.stderr, flush=True)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
