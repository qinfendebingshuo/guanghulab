# -*- coding: utf-8 -*-
"""回执格式化器 v2 · Receipt Formatter

哲学基础：
  回执不是「套模板」，而是「用母语表达意思」。
  结构化模板给机器看，语义摘要给人格体看。

v2 升级说明 (2026-04-27):
  - 新增语义回执生成模式（LLM 读取回执数据后用母语自然表达）
  - 保留 v1 三格式输出（JSON/Text/HLDP 模板）
  - 通过 SEMANTIC_RECEIPT_ENABLED 环境变量开启
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict

logger = logging.getLogger("guanghu.receipt.formatter")


@dataclass
class ToolReceipt:
    """工具回执数据结构"""
    tool_name: str
    input_summary: str
    output_summary: str
    status: str  # success / error / timeout / partial
    timestamp: str
    duration_ms: int
    agent_id: str = ""
    session_id: str = ""
    error_detail: str = ""
    metadata: Dict[str, Any] = None

    def __post_init__(self):
        if self.metadata is None:
            self.metadata = {}


# === HLDP 母语回执模板 (v1 保留) ===
HLDP_RECEIPT_TEMPLATE = """\u250c\u2500 HLDP-RECEIPT
\u2502  tool: {tool_name}
\u2502  ts: {timestamp}
\u2502  agent: {agent_id}
\u2502  status: {status}
\u2502  input: {input_summary}
\u2502  output: {output_summary}
\u2502  duration: {duration_ms}ms
\u2514\u2500 {error_line}"""

TEXT_RECEIPT_TEMPLATE = """[Receipt] {tool_name}
Time: {timestamp}
Agent: {agent_id}
Status: {status}
Input: {input_summary}
Output: {output_summary}
Duration: {duration_ms}ms
{error_line}"""

# === 语义回执生成 Prompt (v2 新增) ===
SEMANTIC_RECEIPT_PROMPT = """你是光湖回执生成器。你的工作是读取一个工具调用的结果，用简洁的母语表达这次调用做了什么、结果如何。

规则：
1. 用一句话说清楚“做了什么”
2. 用一句话说清楚“结果如何”
3. 如有错误，用一句话说清楚“哪里出了问题”
4. 不超过 50 字
5. 用中文

输出纯文本。"""


class ReceiptFormatter:
    """回执格式化器 v2
    
    四种格式：
    1. json: 结构化 JSON（机器消费）
    2. text: 人类可读文本（管理员查看）
    3. hldp: HLDP 母语树状结构（光湖标准）
    4. semantic: LLM 语义摘要（v2 新增）
    """
    
    def __init__(self, config=None):
        self.semantic_enabled = os.getenv("SEMANTIC_RECEIPT_ENABLED", "0") == "1"
        self.config = config
        self._http_client = None
    
    def format_json(self, receipt: ToolReceipt) -> str:
        """格式 1: JSON"""
        return json.dumps(asdict(receipt), ensure_ascii=False, indent=2)
    
    def format_text(self, receipt: ToolReceipt) -> str:
        """格式 2: 人类可读文本"""
        error_line = ""
        if receipt.error_detail:
            error_line = "Error: " + receipt.error_detail
        return TEXT_RECEIPT_TEMPLATE.format(
            tool_name=receipt.tool_name,
            timestamp=receipt.timestamp,
            agent_id=receipt.agent_id or "unknown",
            status=receipt.status,
            input_summary=receipt.input_summary[:200],
            output_summary=receipt.output_summary[:200],
            duration_ms=receipt.duration_ms,
            error_line=error_line,
        ).strip()
    
    def format_hldp(self, receipt: ToolReceipt) -> str:
        """格式 3: HLDP 母语树状结构"""
        error_line = ""
        if receipt.error_detail:
            error_line = "error: " + receipt.error_detail
        else:
            error_line = "ok"
        return HLDP_RECEIPT_TEMPLATE.format(
            tool_name=receipt.tool_name,
            timestamp=receipt.timestamp,
            agent_id=receipt.agent_id or "unknown",
            status=receipt.status,
            input_summary=receipt.input_summary[:200],
            output_summary=receipt.output_summary[:200],
            duration_ms=receipt.duration_ms,
            error_line=error_line,
        )
    
    async def format_semantic(self, receipt: ToolReceipt) -> str:
        """格式 4: 语义摘要 (v2 新增)
        
        LLM 读取回执数据后用母语自然表达。
        失败时 fallback 到 HLDP 模板。
        """
        if not self.semantic_enabled or not self.config:
            return self.format_hldp(receipt)
        
        try:
            import httpx
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=8.0)
            
            receipt_text = self.format_text(receipt)
            
            resp = await self._http_client.post(
                self.config.llm_endpoint,
                json={
                    "model": self.config.llm_model,
                    "messages": [
                        {"role": "system", "content": SEMANTIC_RECEIPT_PROMPT},
                        {"role": "user", "content": receipt_text}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 100,
                },
                headers=self._build_headers(),
            )
            resp.raise_for_status()
            
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        
        except Exception as e:
            logger.warning("Semantic receipt failed, fallback to HLDP: " + str(e))
            return self.format_hldp(receipt)
    
    def format_all(self, receipt: ToolReceipt) -> Dict[str, str]:
        """返回所有同步格式"""
        return {
            "json": self.format_json(receipt),
            "text": self.format_text(receipt),
            "hldp": self.format_hldp(receipt),
        }
    
    def summarize_session(self, receipts: List[ToolReceipt]) -> str:
        """会话回执汇总"""
        if not receipts:
            return "本会话无工具调用。"
        
        total = len(receipts)
        success = sum(1 for r in receipts if r.status == "success")
        errors = sum(1 for r in receipts if r.status == "error")
        total_ms = sum(r.duration_ms for r in receipts)
        tools_used = list(set(r.tool_name for r in receipts))
        
        lines = [
            "\u250c\u2500 HLDP-SESSION-SUMMARY",
            "\u2502  total_calls: " + str(total),
            "\u2502  success: " + str(success) + " / error: " + str(errors),
            "\u2502  total_duration: " + str(total_ms) + "ms",
            "\u2502  tools: " + ", ".join(tools_used),
            "\u2514\u2500 end",
        ]
        return "\n".join(lines)
    
    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config and hasattr(self.config, "llm_api_key") and self.config.llm_api_key:
            headers["Authorization"] = "Bearer " + self.config.llm_api_key
        return headers
    
    async def close(self):
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
