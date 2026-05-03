#!/usr/bin/env python3
"""
═══════════════════════════════════════════════════════════
encode 标注单测 · test_encode_mask.py
═══════════════════════════════════════════════════════════
签发: 铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559

用合成的 token 序列直接验证 train.py::_mask_assistant_segments() 的核心逻辑.
不需要 GPU、不需要下载真实模型, 在本地/CI 都能跑.

跑法:
  cd server/training-agent
  python3 -m tests.test_encode_mask
"""
from __future__ import annotations
import sys
from pathlib import Path

# 让脚本可以直接 import 同级目录的 train.py
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from train import _mask_assistant_segments, IGNORE_INDEX  # noqa: E402


# 用合成 id 模拟一段 ChatML token 流.
# 真实 Qwen2.5 中: <|im_start|>=151644, <|im_end|>=151645, "assistant\n"≈[78191,198].
# 这里用便于阅读的小整数, 算法对具体 id 值不敏感.
IM_START = 1
IM_END = 2
ASSISTANT_ROLE = [3, 4]  # "assistant\n"
USER_ROLE = [5, 4]       # "user\n"
SYSTEM_ROLE = [6, 4]     # "system\n"


def _wrap(role_ids: list[int], content: list[int]) -> list[int]:
    """模拟 <|im_start|>{role}\n{content}<|im_end|>"""
    return [IM_START] + role_ids + content + [IM_END]


def test_basic_three_turn():
    """单轮 system+user+assistant: 只 assistant 段被标记."""
    sys_part = _wrap(SYSTEM_ROLE, [10, 11])           # 系统提示
    user_part = _wrap(USER_ROLE, [20, 21, 22])        # 用户问
    asst_part = _wrap(ASSISTANT_ROLE, [30, 31, 32, 33])  # 助手答
    full_ids = sys_part + user_part + asst_part

    labels, marked = _mask_assistant_segments(
        full_ids, IM_START, IM_END, ASSISTANT_ROLE
    )

    # assistant 段 = 内容 [30,31,32,33] + 闭合 IM_END = 5 个 token
    assert marked == 5, f"marked={marked}"
    # 长度一致
    assert len(labels) == len(full_ids)

    # system 段全部 IGNORE
    sys_range = range(0, len(sys_part))
    for k in sys_range:
        assert labels[k] == IGNORE_INDEX, f"system 段 token {k} 不应被标记"

    # user 段全部 IGNORE
    user_range = range(len(sys_part), len(sys_part) + len(user_part))
    for k in user_range:
        assert labels[k] == IGNORE_INDEX, f"user 段 token {k} 不应被标记"

    # assistant 内容 + 闭合 im_end 必须被标
    asst_content_start = len(sys_part) + len(user_part) + 1 + len(ASSISTANT_ROLE)
    asst_im_end_pos = len(full_ids) - 1
    for k in range(asst_content_start, asst_im_end_pos + 1):
        assert labels[k] == full_ids[k], f"assistant token {k} 应被标记"

    # assistant 段的 <|im_start|>assistant\n 角色头本身不应被标 (否则模型会学着自己生成角色头)
    asst_header_start = len(sys_part) + len(user_part)
    for k in range(asst_header_start, asst_content_start):
        assert labels[k] == IGNORE_INDEX, f"assistant 角色头 token {k} 不应被标记"

    print("✓ test_basic_three_turn")


def test_multi_turn():
    """多轮 user/assistant 交替: 所有 assistant 段都要被标."""
    parts = [
        _wrap(SYSTEM_ROLE, [10]),
        _wrap(USER_ROLE, [20]),
        _wrap(ASSISTANT_ROLE, [30, 31]),
        _wrap(USER_ROLE, [21]),
        _wrap(ASSISTANT_ROLE, [40, 41, 42]),
    ]
    full_ids = sum(parts, [])

    labels, marked = _mask_assistant_segments(
        full_ids, IM_START, IM_END, ASSISTANT_ROLE
    )

    # 第一个 assistant: 内容 2 + im_end = 3
    # 第二个 assistant: 内容 3 + im_end = 4
    assert marked == 7, f"marked={marked}"

    # 提取所有被标的 token 值
    marked_tokens = [full_ids[i] for i, l in enumerate(labels) if l != IGNORE_INDEX]
    assert marked_tokens == [30, 31, IM_END, 40, 41, 42, IM_END], marked_tokens
    print("✓ test_multi_turn")


def test_truncated_assistant():
    """assistant 段被 max_seq_len 截断 (没有闭合 im_end): 仍标到序列末尾."""
    full_ids = (
        _wrap(SYSTEM_ROLE, [10])
        + _wrap(USER_ROLE, [20])
        + [IM_START] + ASSISTANT_ROLE + [50, 51, 52]  # 没有闭合 IM_END
    )

    labels, marked = _mask_assistant_segments(
        full_ids, IM_START, IM_END, ASSISTANT_ROLE
    )

    # 内容 [50,51,52] = 3 个 token, 没有闭合 im_end
    assert marked == 3, f"marked={marked}"
    marked_tokens = [full_ids[i] for i, l in enumerate(labels) if l != IGNORE_INDEX]
    assert marked_tokens == [50, 51, 52]
    print("✓ test_truncated_assistant")


def test_no_assistant_returns_zero():
    """没有 assistant 段的样本: marked=0, 全部 IGNORE."""
    full_ids = _wrap(SYSTEM_ROLE, [10]) + _wrap(USER_ROLE, [20])
    labels, marked = _mask_assistant_segments(
        full_ids, IM_START, IM_END, ASSISTANT_ROLE
    )
    assert marked == 0
    assert all(l == IGNORE_INDEX for l in labels)
    print("✓ test_no_assistant_returns_zero")


def test_user_content_with_im_start_lookalike():
    """用户内容里碰巧有跟 IM_START 同 id 的 token (理论上不可能, 这里测算法鲁棒性):
    如果后续不是 assistant 角色头, 不应被误标."""
    full_ids = (
        _wrap(SYSTEM_ROLE, [10])
        + _wrap(USER_ROLE, [IM_START, 99, 99])  # 用户内容里夹了 IM_START 但后面不是 assistant
        + _wrap(ASSISTANT_ROLE, [30])
    )

    labels, marked = _mask_assistant_segments(
        full_ids, IM_START, IM_END, ASSISTANT_ROLE
    )

    # 只有真正的 assistant 段被标: 内容 [30] + im_end = 2 个 token
    assert marked == 2, f"marked={marked}"
    marked_tokens = [full_ids[i] for i, l in enumerate(labels) if l != IGNORE_INDEX]
    assert marked_tokens == [30, IM_END]
    print("✓ test_user_content_with_im_start_lookalike")


if __name__ == "__main__":
    test_basic_three_turn()
    test_multi_turn()
    test_truncated_assistant()
    test_no_assistant_returns_zero()
    test_user_content_with_im_start_lookalike()
    print("\nALL PASS · 自动门标注逻辑验证通过")
