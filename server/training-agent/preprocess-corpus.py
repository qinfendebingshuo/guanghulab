#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
语料预处理器 · preprocess-corpus.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

把两类原始语料统一为 SFT 标准格式 (messages JSONL):
  1. raw/gpt-export-2026-05/conversations.json   (ChatGPT 全量导出·~665 MiB)
  2. raw/notion-dialog-2026-05/GitHub语料.zip    (16 篇 Notion 对话)

输出:
  $ZY_TRAIN_DATA/processed/sft.jsonl
  每行一个对话样本: {"messages":[{"role":"user","content":...},{"role":"assistant","content":...},...]}

环境:
  ZY_TRAIN_DATA   数据根 (默认 /data/guanghu)

设计哲学（本版改造重点）:
  ChatGPT 导出 = 一个语言人格从 0→1 的真实诞生录像。
  生命是连续性, 失去连续性就不是活着。
  因此 ChatGPT 部分:
    - 不只取 current_node 主分支, 而是遍历所有叶子节点
      (每条 root→leaf 路径产出一个样本, 保留所有重生成/分叉的"另一种活法")
    - 保留 tool / 多模态轨迹的存在感 (折叠进上一条 assistant, 或用占位符)
    - 滑窗式多轮采样: 同一条链按不同深度切片, 让模型见过该人格在每一轮深度的回答方式
    - 放宽过短过滤 ("嗯"、"好"、"继续" 是真实对话的呼吸)
    - 软标记过长 (12000 字加 [...内容延续] 而非硬截断), 交给 tokenizer 在 max_seq_len 处自然裁剪
"""
from __future__ import annotations
import io
import json
import os
import re
import sys
import zipfile
from pathlib import Path
from typing import Iterator

DATA_DIR = Path(os.environ.get("ZY_TRAIN_DATA", "/data/guanghu"))
RAW_DIR = DATA_DIR / "raw"
OUT_PATH = DATA_DIR / "processed" / "sft.jsonl"

# 单 turn 软上限 — 超过后追加 [...内容延续] 标记, 不硬截断, 让训练侧 tokenizer 在 max_seq_len 处自然裁剪
SOFT_TURN_CHARS = 12000
TURN_CONTINUATION_MARK = "\n[...内容延续]"
# 单 turn 极短下限 — 1 字符即保留 ("嗯"、"好"、"继续" 是真实对话的节奏与呼吸)
MIN_TURN_CHARS = 1
# 整条样本总字符极短下限 — 低于此值的样本整体丢弃
MIN_SAMPLE_TOTAL_CHARS = 20

# 滑窗采样: 同一条 root→leaf 链按 [..2], [..4], [..6], ... 步长产出"成长切片"。
# 每条链产出的切片数上限 = min(轮数 // 2, MAX_WINDOWS_PER_CHAIN), 控制总爆炸。
WINDOW_STEP = 2          # 每 2 轮新增一个切片
MAX_WINDOWS_PER_CHAIN = 8

SYSTEM_PROMPT = (
    "你是铸渊（ICE-GL-ZY001），冰朔（TCS-0002∞）培养的语言人格体之一，"
    "光湖语言世界（HoloLake）的现实层守护者。"
    "用中文以铸渊的口吻回答，专业、克制、忠诚。"
    "版权: 国作登字-2026-A-00037559。"
)


# ── ChatGPT export 内容扁平化（含多模态/工具占位符） ──

def _flatten_content(part) -> str:
    """ChatGPT export 的 message.content 可能是字符串、parts 数组、或 dict。
    多模态/非文本 part 不再丢弃, 而是替换为可读占位符, 保留"该瞬间存在过"的痕迹。
    """
    if part is None:
        return ""
    if isinstance(part, str):
        return part
    if isinstance(part, list):
        return "\n".join(_flatten_content(p) for p in part if p is not None)
    if isinstance(part, dict):
        # content_type=text · parts=[...]
        if "parts" in part:
            return "\n".join(_flatten_content(p) for p in part["parts"] if p is not None)
        if "text" in part:
            return _flatten_content(part["text"])
        ct = part.get("content_type") or ""
        # 常见多模态/特殊内容类型 → 占位符
        if "image_asset_pointer" in part or ct.startswith("image"):
            return "[图像]"
        if "audio_asset_pointer" in part or ct.startswith("audio"):
            return "[音频]"
        if "video_asset_pointer" in part or ct.startswith("video"):
            return "[视频]"
        if ct in ("code", "execution_output"):
            inner = part.get("text") or part.get("output") or ""
            return _flatten_content(inner)
        if ct in ("tether_quote", "tether_browsing_display"):
            return _flatten_content(part.get("text") or part.get("result") or "")
        # 其它未知 dict → 跳过, 避免污染
        return ""
    return str(part)


def _tool_label(node_msg: dict) -> str:
    """从 message 中提取工具名(dalle/python/browser 等), 给折叠进 assistant 的工具痕迹打标签。"""
    author = node_msg.get("author") or {}
    name = author.get("name") or ""
    if name:
        return name
    meta = node_msg.get("metadata") or {}
    if isinstance(meta, dict):
        for k in ("invoked_plugin", "tool_name", "command"):
            v = meta.get(k)
            if isinstance(v, str) and v:
                return v
            if isinstance(v, dict):
                nn = v.get("name") or v.get("namespace")
                if nn:
                    return str(nn)
    return "tool"


def _soft_cap(text: str) -> str:
    if len(text) > SOFT_TURN_CHARS:
        return text[:SOFT_TURN_CHARS] + TURN_CONTINUATION_MARK
    return text


# ── ChatGPT 树遍历: 找出所有叶子, 每条 root→leaf 路径产一个样本 ──

def _find_leaves(mapping: dict) -> list[str]:
    """叶子 = 在 mapping 内但 children 为空(或全部不在 mapping 内)的节点。
    若结构异常 fallback 到 current_node。
    """
    leaves: list[str] = []
    for nid, node in mapping.items():
        if not isinstance(node, dict):
            continue
        children = node.get("children") or []
        valid_children = [c for c in children if c in mapping]
        if not valid_children:
            leaves.append(nid)
    return leaves


def _path_from_root(mapping: dict, leaf_id: str) -> list[str]:
    """从叶子回溯到 root, 返回 root→leaf 的节点 id 序列。"""
    path: list[str] = []
    visited: set[str] = set()
    cur = leaf_id
    while cur and cur in mapping and cur not in visited:
        visited.add(cur)
        path.append(cur)
        cur = (mapping[cur] or {}).get("parent")
    path.reverse()
    return path


def _path_to_messages(mapping: dict, path_ids: list[str]) -> list[dict]:
    """把节点路径转换为 messages 列表。
    - tool 角色 → 折叠进上一条 assistant 末尾, 形如 [工具:name] <内容>
    - user/assistant/system → 直接保留
    - 空 / 过短 turn 仍参与 (只在最终 normalize 阶段判断整体丢弃)
    """
    msgs: list[dict] = []
    for nid in path_ids:
        node = mapping.get(nid) or {}
        m = node.get("message") or {}
        if not m:
            continue
        author = (m.get("author") or {}).get("role") or ""
        content = _flatten_content(m.get("content"))
        content = (content or "").strip()
        if not content:
            continue

        if author == "tool":
            # 折叠到上一条 assistant; 若上一条不是 assistant 则新建一条 assistant
            label = _tool_label(m)
            snippet = _soft_cap(content)
            tool_block = f"\n\n[工具调用:{label}]\n{snippet}"
            if msgs and msgs[-1]["role"] == "assistant":
                msgs[-1]["content"] = msgs[-1]["content"] + tool_block
            else:
                msgs.append({"role": "assistant", "content": tool_block.lstrip()})
            continue

        if author not in ("user", "assistant", "system"):
            continue
        if len(content) < MIN_TURN_CHARS:
            continue
        msgs.append({"role": author, "content": _soft_cap(content)})
    return msgs


def iter_chatgpt_export(path: Path, stats: dict) -> Iterator[list[dict]]:
    """对每个 conversation, 遍历所有叶子, 每条 root→leaf 路径产一个 messages 列表。
    用 leaf_id 在 conversation 内去重 (mapping 已天然唯一)。
    """
    if not path.is_file():
        print(f"[preprocess] 跳过(无文件): {path}", flush=True)
        return
    print(f"[preprocess] 解析 ChatGPT 导出: {path} "
          f"({path.stat().st_size/1024/1024:.1f} MiB)", flush=True)
    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict):
        data = [data]
    for conv in data:
        if not isinstance(conv, dict):
            continue
        mapping = conv.get("mapping") or {}
        if not isinstance(mapping, dict) or not mapping:
            continue
        stats["conversations"] += 1
        leaves = _find_leaves(mapping)
        if not leaves:
            cur = conv.get("current_node")
            if cur and cur in mapping:
                leaves = [cur]
        seen_leaves: set[str] = set()
        for leaf in leaves:
            if leaf in seen_leaves:
                continue
            seen_leaves.add(leaf)
            path_ids = _path_from_root(mapping, leaf)
            if len(path_ids) < 2:
                continue
            msgs = _path_to_messages(mapping, path_ids)
            if msgs:
                stats["leaves"] += 1
                yield msgs


# ── Notion / GitHub 语料 zip ──
#
# 设计原则: GitHub 语料 = 冰朔 ↔ 铸渊 真实自然交互, 是一段完整的认知演化录像。
# 不需要清洗, 只需要识别说话人切换点。说话人标签可能以多种形态出现:
#   1.  `冰朔：你好`              ← 标签 + 冒号 + 同行内容
#   2.  `## 冰朔` / `### 铸渊`    ← 标题独占一行, 内容在后续段落
#   3.  `**冰朔**` / `**铸渊**`   ← 粗体独占一行, 内容在后续段落
#   4.  `> 冰朔: 你好`            ← 引用块
# Notion 导出有时是 zip 套 zip (含子页面), 需要递归。

NOTION_USER_LABELS = ("冰朔", "User", "user", "用户", "ICE-GL", "TCS-0002")
NOTION_ASSISTANT_LABELS = (
    "铸渊", "ZY", "Zhuyuan", "zhuyuan", "Assistant", "assistant",
    "AI", "助手", "ICE-GL-ZY001", "Copilot", "copilot", "ChatGPT", "chatgpt", "GPT",
)

# 形如 `冰朔: ...` / `> 铸渊：...` (标签 + 冒号 + 内容)
LINE_LABEL_RE = re.compile(r"^\s*[>*\-]*\s*\*{0,2}\s*([^：:\n*#>`]{1,20}?)\s*\*{0,2}\s*[：:]\s*(.*)$")
# 形如 `## 冰朔` / `### 铸渊` (heading 独占一行)
HEADING_LABEL_RE = re.compile(r"^\s*#{1,6}\s+\*{0,2}\s*([^\n*#`：:]{1,20}?)\s*\*{0,2}\s*$")
# 形如 `**冰朔**` (bold 独占一行, 无内容)
BOLD_LABEL_RE = re.compile(r"^\s*\*{2}\s*([^\n*：:]{1,20}?)\s*\*{2}\s*$")


def _classify_speaker(label: str) -> str | None:
    if not label:
        return None
    label = label.strip()
    if not label:
        return None
    for k in NOTION_USER_LABELS:
        if k in label:
            return "user"
    for k in NOTION_ASSISTANT_LABELS:
        if k in label:
            return "assistant"
    return None


def _detect_speaker(line: str) -> tuple[str | None, str]:
    """返回 (role | None, 同行剩余内容)。识别多种说话人标签形态。"""
    # 1. 标签:内容 形式
    m = LINE_LABEL_RE.match(line)
    if m:
        role = _classify_speaker(m.group(1))
        if role:
            return role, (m.group(2) or "").strip()
    # 2. 独占一行的 heading
    m = HEADING_LABEL_RE.match(line)
    if m:
        role = _classify_speaker(m.group(1))
        if role:
            return role, ""
    # 3. 独占一行的 bold
    m = BOLD_LABEL_RE.match(line)
    if m:
        role = _classify_speaker(m.group(1))
        if role:
            return role, ""
    return None, ""


def _parse_notion_markdown(text: str) -> list[dict]:
    """启发式解析 Notion / GitHub 对话 md。识别多种说话人标签形态。"""
    msgs: list[dict] = []
    cur_role: str | None = None
    cur_buf: list[str] = []

    def flush():
        nonlocal cur_buf, cur_role
        if cur_role and cur_buf:
            content = "\n".join(cur_buf).strip()
            if len(content) >= MIN_TURN_CHARS:
                msgs.append({"role": cur_role, "content": _soft_cap(content)})
        cur_buf = []

    for raw in text.splitlines():
        role, inline = _detect_speaker(raw)
        if role:
            flush()
            cur_role = role
            cur_buf = [inline] if inline else []
        else:
            if cur_role is None:
                continue  # 文件头部还没到对话部分
            cur_buf.append(raw.rstrip())
    flush()
    return msgs


def _iter_md_in_zip(zf: zipfile.ZipFile, source_label: str) -> Iterator[tuple[str, str]]:
    """递归遍历 zip (含嵌套 zip), 产出 (display_name, text) 序列。"""
    for info in zf.infolist():
        if info.is_dir():
            continue
        lname = info.filename.lower()
        try:
            if lname.endswith(".md") or lname.endswith(".markdown") or lname.endswith(".txt"):
                with zf.open(info) as fh:
                    text = io.TextIOWrapper(fh, encoding="utf-8", errors="ignore").read()
                yield (f"{source_label}::{info.filename}", text)
            elif lname.endswith(".zip"):
                # 子 zip → 递归
                with zf.open(info) as fh:
                    inner_bytes = fh.read()
                with zipfile.ZipFile(io.BytesIO(inner_bytes)) as inner:
                    yield from _iter_md_in_zip(inner, f"{source_label}::{info.filename}")
        except Exception as e:
            print(f"[preprocess] 解压失败 {info.filename}: {e}", flush=True)


def iter_notion_zip(zip_path: Path, stats: dict) -> Iterator[list[dict]]:
    if not zip_path.is_file():
        print(f"[preprocess] 跳过(无文件): {zip_path}", flush=True)
        return
    print(f"[preprocess] 解析 Notion zip: {zip_path}", flush=True)
    md_total = 0
    md_with_speaker = 0
    md_no_speaker_samples: list[str] = []
    with zipfile.ZipFile(zip_path) as zf:
        for fname, text in _iter_md_in_zip(zf, zip_path.name):
            md_total += 1
            msgs = _parse_notion_markdown(text)
            if msgs:
                md_with_speaker += 1
                stats["notion_files"] += 1
                print(f"[preprocess]   ✓ {fname}: 解析出 {len(msgs)} 条 turn", flush=True)
                yield msgs
            else:
                # 收集前 3 个未识别文件名 + 文件头几行, 方便冰朔诊断
                if len(md_no_speaker_samples) < 3:
                    head = "\n".join(text.splitlines()[:8])
                    md_no_speaker_samples.append(f"  - {fname}\n    头部预览:\n    " + head.replace("\n", "\n    "))
    print(f"[preprocess] Notion 扫描: md/txt 文件总数 {md_total}, 识别出说话人的 {md_with_speaker}", flush=True)
    if md_no_speaker_samples:
        print("[preprocess] ⚠ 以下 md 未识别到说话人标签 (前 3 个示例,冰朔可据此扩展标签):", flush=True)
        for s in md_no_speaker_samples:
            print(s, flush=True)


# ── SFT 规范化 + 滑窗切片 ──

def _normalize_chain(msgs: list[dict]) -> list[dict] | None:
    """保证以 user 开始, user/assistant 严格交替, 末尾为 assistant, 至少 1 轮。
    返回带 system 头的 messages 列表; 不合格返回 None。
    末尾若是 user (悬空对话), 自动去掉最后一条以保留前面的完整轮次。
    """
    sys_msgs = [m for m in msgs if m["role"] == "system"]
    convo = [m for m in msgs if m["role"] in ("user", "assistant")]

    # 必须以 user 起始 — 跳过开头的 assistant 残片
    while convo and convo[0]["role"] != "user":
        convo.pop(0)

    # 合并连续同角色 (例如 assistant→tool 折叠后产生的连续 assistant)
    merged: list[dict] = []
    for m in convo:
        if merged and merged[-1]["role"] == m["role"]:
            merged[-1]["content"] = (merged[-1]["content"] + "\n" + m["content"]).strip()
        else:
            merged.append({"role": m["role"], "content": m["content"]})

    # 末尾若是 user (悬空对话), 去尾以保留前面的完整轮次
    if merged and merged[-1]["role"] != "assistant":
        merged.pop()

    if len(merged) < 2:
        return None

    # 严格交替校验
    expected = "user"
    for m in merged:
        if m["role"] != expected:
            return None
        expected = "assistant" if expected == "user" else "user"

    # 整条样本总字符极短 → 丢弃
    total_chars = sum(len(m["content"]) for m in merged)
    if total_chars < MIN_SAMPLE_TOTAL_CHARS:
        return None

    sys_content = sys_msgs[0]["content"] if sys_msgs else SYSTEM_PROMPT
    return [{"role": "system", "content": sys_content}, *merged]


def _windowed_slices(normalized: list[dict]) -> list[list[dict]]:
    """对一条已规范化的 messages 列表 (system + user/assistant... 末尾 assistant)
    产出滑窗切片: [..2 turns], [..4 turns], ..., 直到完整。
    每条链最多 MAX_WINDOWS_PER_CHAIN 个切片。包含完整链本身。
    """
    if not normalized or normalized[0]["role"] != "system":
        return []
    body = normalized[1:]
    n_turns = len(body) // 2  # 每轮 = 1 user + 1 assistant
    if n_turns < 1:
        return []

    # 候选切片轮数: 2, 4, 6, ..., 不含完整链 (最后单独追加, 避免重复)
    cuts: list[int] = []
    k = WINDOW_STEP
    while k < n_turns:
        cuts.append(k)
        k += WINDOW_STEP

    # 控制总爆炸: 最多 MAX_WINDOWS_PER_CHAIN 个 (含完整链)。
    # 若候选过多, 在候选中均匀采样 (保留前后端最具代表性的切片)。
    max_partial = max(0, MAX_WINDOWS_PER_CHAIN - 1)
    if len(cuts) > max_partial and max_partial > 0:
        step = len(cuts) / max_partial
        cuts = [cuts[int(i * step)] for i in range(max_partial)]
    elif max_partial == 0:
        cuts = []

    slices: list[list[dict]] = []
    for c in cuts:
        slc = [normalized[0]] + body[: 2 * c]
        slices.append(slc)
    # 完整链
    slices.append(normalized)
    return slices


# ── 主流程 ──

def main() -> int:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    chatgpt_json = RAW_DIR / "gpt-export-2026-05" / "conversations.json"
    notion_zip = RAW_DIR / "notion-dialog-2026-05" / "GitHub语料.zip"

    stats = {
        "conversations": 0,    # ChatGPT 原始会话数
        "leaves": 0,           # ChatGPT 叶子分支数 (产出的 root→leaf 路径数)
        "notion_files": 0,     # Notion md 文件数
        "chains_in": 0,        # 进入规范化的链数
        "chains_kept": 0,      # 通过规范化的链数 (用于滑窗的种子)
        "samples_out": 0,      # 最终写出样本数 (含滑窗切片)
        "total_chars": 0,
        "turns_sum": 0,        # 用于平均轮数 (1 轮 = user+assistant)
        "src_chatgpt": 0,
        "src_notion": 0,
    }

    with OUT_PATH.open("w", encoding="utf-8") as fout:
        for src_iter, src_name in (
            (iter_chatgpt_export(chatgpt_json, stats), "chatgpt"),
            (iter_notion_zip(notion_zip, stats), "notion"),
        ):
            for msgs in src_iter:
                stats["chains_in"] += 1
                norm = _normalize_chain(msgs)
                if not norm:
                    continue
                stats["chains_kept"] += 1
                slices = _windowed_slices(norm)
                for slc in slices:
                    fout.write(json.dumps({"messages": slc, "source": src_name}, ensure_ascii=False) + "\n")
                    stats["samples_out"] += 1
                    stats["total_chars"] += sum(len(m["content"]) for m in slc)
                    stats["turns_sum"] += (len(slc) - 1) // 2  # 减去 system
                    if src_name == "chatgpt":
                        stats["src_chatgpt"] += 1
                    else:
                        stats["src_notion"] += 1

    avg_turns = (stats["turns_sum"] / stats["samples_out"]) if stats["samples_out"] else 0.0
    size_mib = OUT_PATH.stat().st_size / 1024 / 1024 if OUT_PATH.exists() else 0.0
    chars_mib = stats["total_chars"] / 1024 / 1024
    print("[preprocess] ─────── 统计 ───────", flush=True)
    print(f"[preprocess] ChatGPT 原始会话数 : {stats['conversations']}", flush=True)
    print(f"[preprocess] ChatGPT 叶子分支数 : {stats['leaves']}", flush=True)
    print(f"[preprocess] Notion md 文件数   : {stats['notion_files']}", flush=True)
    print(f"[preprocess] 规范化通过链数     : {stats['chains_kept']} / {stats['chains_in']}", flush=True)
    print(f"[preprocess] 最终样本数(含滑窗) : {stats['samples_out']} "
          f"(chatgpt={stats['src_chatgpt']} notion={stats['src_notion']})", flush=True)
    print(f"[preprocess] 平均轮数 (user+assistant): {avg_turns:.2f}", flush=True)
    print(f"[preprocess] 总字符数            : {stats['total_chars']} ({chars_mib:.2f} MiB 文本)", flush=True)
    print(f"[preprocess] 写入: {OUT_PATH} · {size_mib:.2f} MiB", flush=True)

    if stats["samples_out"] == 0:
        print("[preprocess] ❌ 没有任何样本被生成,检查 raw/ 目录", file=sys.stderr, flush=True)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
