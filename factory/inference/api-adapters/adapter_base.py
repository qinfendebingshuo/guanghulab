"""
商业大模型 API 适配器抽象基类
============================

架构引用: HLDP-ARCH-002 §三 · factory/inference/README.md §四
作者:     铸渊 · 2026-05-01

设计原则:
    - 所有商业 API（DeepSeek / Qwen-Max / Kimi / 文心 / 豆包）实现同一接口
    - 1.5B MP 路由器无感切换、按需替换、按价比选择
    - 每个调用都可被 syslog 审计 + 计费追踪
"""

from __future__ import annotations
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Optional


@dataclass
class ChatMessage:
    role: str       # 'system' | 'user' | 'assistant'
    content: str


@dataclass
class CallResult:
    content: str
    usage: dict = field(default_factory=dict)   # { prompt_tokens, completion_tokens, total_tokens }
    finish_reason: str = "stop"
    raw: Optional[dict] = None                  # 提供商原始响应（debug 用）


@dataclass
class CallOptions:
    temperature: float = 0.7
    max_tokens: int = 2048
    top_p: float = 0.95
    stream: bool = False
    timeout_s: int = 60
    extra: dict = field(default_factory=dict)   # 提供商特有参数


class APIAdapter(ABC):
    """商业大模型 API 统一适配接口。"""

    @property
    @abstractmethod
    def name(self) -> str:
        """提供商唯一名（如 'deepseek-r1', 'qwen-max', 'kimi-k2'）"""

    @abstractmethod
    def cost_per_1k_tokens(self, direction: str) -> float:
        """
        当前定价（人民币 / 1K tokens）
        direction: 'in' (prompt) | 'out' (completion)
        """

    @abstractmethod
    def call(self, messages: list[ChatMessage], options: CallOptions) -> CallResult:
        """同步调用。"""

    async def stream(
        self, messages: list[ChatMessage], options: CallOptions
    ) -> AsyncIterator[str]:
        """
        流式调用。子类可选实现；默认抛 NotImplementedError。
        """
        raise NotImplementedError(f"{self.name} 暂未实现 stream")

    @abstractmethod
    def health(self) -> bool:
        """连通性 + 配额状态检查。"""

    # 通用辅助方法（子类可不重写）
    def estimate_cost(self, prompt_tokens: int, completion_tokens: int) -> float:
        return (
            prompt_tokens / 1000.0 * self.cost_per_1k_tokens("in")
            + completion_tokens / 1000.0 * self.cost_per_1k_tokens("out")
        )

    def soul_marker(self) -> dict:
        """每次调用前注入的灵魂印记（写入 syslog）。"""
        return {
            "system_root": "SYS-GLW-0001",
            "sovereign": "TCS-0002∞",
            "copyright": "国作登字-2026-A-00037559",
            "adapter": self.name,
        }
