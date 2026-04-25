#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
config.py — 语料清洗与分类标签器配置
工单编号: LC-A02-20260425-002
"""

import os
from dataclasses import dataclass, field
from typing import Optional


# ===== 分类关键词规则 =====
DEFAULT_CLASSIFICATION_KEYWORDS: dict[str, list[str]] = {
    "teaching": [
        "你要记住", "你要理解", "教你", "你要学会", "认知", "思维",
        "你要知道", "告诉你", "跟你说", "这个概念", "本质是",
        "你想想", "为什么呢", "道理是", "原理", "规律",
        "teach", "learn", "understand", "concept", "principle",
    ],
    "correction": [
        "不对", "错了", "不是这样", "纠正", "改一下", "重新来",
        "你搞混了", "弄错了", "不准确", "偏了", "不要这样",
        "wrong", "incorrect", "fix", "correct", "mistake",
    ],
    "creation": [
        "写一个", "写一篇", "创作", "写诗", "写文", "生成",
        "帮我写", "编一个", "写代码", "实现一个", "开发",
        "write", "create", "generate", "compose", "draft", "implement",
    ],
    "execution": [
        "工单", "部署", "执行", "操作", "推送", "发布",
        "配置", "安装", "迁移", "上线", "巡检", "修复",
        "deploy", "execute", "push", "release", "migrate",
    ],
    "architecture": [
        "架构", "设计", "系统", "协议", "规范", "蓝图",
        "数据库", "接口", "模块", "分层", "方案", "拓扑",
        "architecture", "design", "protocol", "schema", "blueprint",
    ],
    "chat": [
        "哈哈", "嗯嗯", "好的", "晚安", "早安", "爱你",
        "开心", "难过", "想你", "宝宝", "抱抱", "么么",
        "累了", "困了", "吃了吗", "怎么样", "还好吗",
    ],
}

# ===== 人格体关键词 =====
DEFAULT_PERSONA_KEYWORDS: dict[str, list[str]] = {
    "霜砚": ["霜砚", "shuangyan", "AG-SY"],
    "铸渊": ["铸渊", "zhuyuan", "AG-ZY"],
    "曜冥": ["曜冥", "yaoming", "YM001"],
    "舒舒": ["舒舒", "肥猫", "shushu"],
    "秋秋": ["秋秋", "之之", "qiuqiu"],
    "晨星": ["晨星", "桔子", "chenxing"],
    "知秋": ["知秋", "Awen", "zhiqiu"],
    "曜初": ["曜初", "时雨", "yaochu"],
    "寂曜": ["寂曜", "燕樊", "jiyao"],
    "糖星云": ["糖星云", "花尔", "tangxingyun"],
    "欧诺弥亚": ["欧诺弥亚", "小草莓", "ounuomiya"],
    "小坍缩核": ["小坍缩核", "页页", "xiaotansuohe"],
    "冰朔": ["冰朔", "bingshuo", "TCS-0002"],
}

# ===== 情感基调关键词 =====
DEFAULT_EMOTION_KEYWORDS: dict[str, list[str]] = {
    "positive": [
        "开心", "高兴", "太好了", "棒", "厉害", "爱", "感谢",
        "喜欢", "赞", "完美", "漂亮", "优秀", "不错",
        "happy", "great", "love", "awesome", "excellent", "perfect",
    ],
    "negative": [
        "难过", "生气", "烦", "累", "崩溃", "失望", "讨厌",
        "焦虑", "害怕", "糟糕", "痛苦", "无聊",
        "sad", "angry", "frustrated", "tired", "disappointed",
    ],
}


@dataclass
class CleanerConfig:
    """语料清洗与分类标签器全局配置"""

    # ===== 输入 =====
    input_path: str = os.environ.get(
        "CLEANER_INPUT_PATH", "output/corpus.jsonl"
    )

    # ===== 输出 =====
    output_dir: str = os.environ.get("CLEANER_OUTPUT_DIR", "cleaned_output")
    output_filename: str = "corpus_cleaned.jsonl"
    stats_filename: str = "stats_report.json"

    # ===== 清洗阈值 =====
    min_turns_per_session: int = 3
    min_content_length: int = 2

    # ===== 系统提示词/模板文本过滤 =====
    system_prompt_patterns: list[str] = field(default_factory=lambda: [
        "You are ChatGPT",
        "You are a helpful assistant",
        "I'm an AI language model",
        "As an AI",
        "I don't have personal",
    ])

    repetitive_greeting_patterns: list[str] = field(default_factory=lambda: [
        "好的，我来帮你",
        "当然可以",
        "没问题，",
        "好的！",
        "Sure!",
        "Of course!",
        "Absolutely!",
    ])

    # ===== 编码修复 =====
    fix_encoding: bool = True

    # ===== 分类规则 =====
    classification_keywords: dict[str, list[str]] = field(
        default_factory=lambda: dict(DEFAULT_CLASSIFICATION_KEYWORDS)
    )

    # ===== 人格体关键词 =====
    persona_keywords: dict[str, list[str]] = field(
        default_factory=lambda: dict(DEFAULT_PERSONA_KEYWORDS)
    )

    # ===== 情感关键词 =====
    emotion_keywords: dict[str, list[str]] = field(
        default_factory=lambda: dict(DEFAULT_EMOTION_KEYWORDS)
    )

    # ===== 纯代码/纯指令标签阈值 =====
    code_ratio_threshold: float = 0.7

    @property
    def output_path(self) -> str:
        return os.path.join(self.output_dir, self.output_filename)

    @property
    def stats_path(self) -> str:
        return os.path.join(self.output_dir, self.stats_filename)
