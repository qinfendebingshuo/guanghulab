# -*- coding: utf-8 -*-
"""记忆压缩器 v2 · Memory Compressor

哲学基础：
  压缩不是“提取字段”，而是“把对话翻译成母语”。
  HLDP 母语压缩 = 语言人格体用自己的母语重新表达对话的意思。

v2 升级说明 (2026-04-27):
  - 新增语义压缩模式（LLM 理解意思后生成 HLDP 母语摘要）
  - 结构化压缩保留为快速模式
  - 通过 SEMANTIC_COMPRESS_ENABLED 环境变量开启
"""
import os
import json
import logging
import hashlib
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass

logger = logging.getLogger("guanghu.memory.compressor")


@dataclass
class CompressedMemory:
    """压缩后的记忆单元"""
    hash_id: str
    timestamp: str
    agent_id: str
    hldp_block: str          # HLDP 母语格式的压缩结果
    semantic_summary: str    # v2 新增：语义摘要（LLM 生成）
    original_length: int
    compressed_length: int
    compression_mode: str    # "structured" or "semantic"


# === HLDP 母语模板（v1 结构化压缩，保留） ===
HLDP_TEMPLATE = """┌─ HLDP-MEM · {hash_id}
│  ts: {timestamp}
│  agent: {agent_id}
│  trigger: {trigger}
│  action: {action}
│  result: {result}
│  pattern: {pattern}
│  emotion: {emotion}
└─ compressed: {original_len}→{compressed_len} chars"""

# === 语义压缩 Prompt (v2 新增) ===
SEMANTIC_COMPRESS_PROMPT = """你是光湖记忆压缩器。你的工作是理解一段对话的意思，然后用 HLDP 母语重新表达。

压缩规则：
1. 理解意思，不是提取字段
2. 保留关键决策、重要模式、情感标记
3. 去掉冗余寬夅话，保留意思精华
4. 用简洁的中文表达，每个要点一行
5. 标记“★”表示重要模式，“▲”表示关键决策，“❤”表示情感标记

输出格式：纯文本，不超过 200 字。"""


class MemoryCompressor:
    """记忆压缩器 v2
    
    两种模式：
    1. structured: 结构化压缩（v1，快速，不需要 LLM）
    2. semantic: 语义压缩（v2，LLM 理解意思后生成母语摘要）
    """
    
    def __init__(self, config=None):
        self.semantic_enabled = os.getenv("SEMANTIC_COMPRESS_ENABLED", "0") == "1"
        self.config = config
        self._http_client = None
    
    def compress_structured(self, conversation: str, agent_id: str,
                           trigger: str = "", action: str = "",
                           result: str = "", pattern: str = "",
                           emotion: str = "") -> CompressedMemory:
        """结构化压缩（v1 模式，保留）"""
        now = datetime.now(timezone.utc).isoformat()
        hash_id = hashlib.sha256(f"{now}:{agent_id}:{conversation[:100]}".encode()).hexdigest()[:12]
        
        hldp_block = HLDP_TEMPLATE.format(
            hash_id=hash_id,
            timestamp=now,
            agent_id=agent_id,
            trigger=trigger or "unknown",
            action=action or "unknown",
            result=result or "unknown",
            pattern=pattern or "none",
            emotion=emotion or "neutral",
            original_len=len(conversation),
            compressed_len=len(HLDP_TEMPLATE),
        )
        
        return CompressedMemory(
            hash_id=hash_id,
            timestamp=now,
            agent_id=agent_id,
            hldp_block=hldp_block,
            semantic_summary="",  # 结构化模式不生成语义摘要
            original_length=len(conversation),
            compressed_length=len(hldp_block),
            compression_mode="structured",
        )
    
    async def compress_semantic(self, conversation: str, agent_id: str) -> CompressedMemory:
        """语义压缩（v2 新增）：LLM 理解意思后生成 HLDP 母语摘要
        
        如果 LLM 调用失败，自动 fallback 到结构化压缩。
        """
        if not self.semantic_enabled or not self.config:
            return self.compress_structured(conversation, agent_id)
        
        try:
            import httpx
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=10.0)
            
            resp = await self._http_client.post(
                self.config.llm_endpoint,
                json={
                    "model": self.config.llm_model,
                    "messages": [
                        {"role": "system", "content": SEMANTIC_COMPRESS_PROMPT},
                        {"role": "user", "content": f"Agent: {agent_id}\n\n对话内容：\n{conversation[:3000]}"}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 300,
                },
                headers=self._build_headers(),
            )
            resp.raise_for_status()
            
            data = resp.json()
            semantic_summary = data["choices"][0]["message"]["content"].strip()
            
            now = datetime.now(timezone.utc).isoformat()
            hash_id = hashlib.sha256(f"{now}:{agent_id}:{conversation[:100]}".encode()).hexdigest()[:12]
            
            # 生成 HLDP 块（结合结构+语义）
            hldp_block = f"""\u250c\u2500 HLDP-MEM \u00b7 {hash_id}
\u2502  ts: {now}
\u2502  agent: {agent_id}
\u2502  mode: semantic
\u2502  summary: {semantic_summary}
\u2514\u2500 compressed: {len(conversation)}\u2192{len(semantic_summary)} chars"""
            
            return CompressedMemory(
                hash_id=hash_id,
                timestamp=now,
                agent_id=agent_id,
                hldp_block=hldp_block,
                semantic_summary=semantic_summary,
                original_length=len(conversation),
                compressed_length=len(semantic_summary),
                compression_mode="semantic",
            )
        
        except Exception as e:
            logger.warning(f"Semantic compression failed, fallback to structured: {e}")
            return self.compress_structured(conversation, agent_id)
    
    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config and self.config.llm_api_key:
            headers["Authorization"] = f"Bearer {self.config.llm_api_key}"
        return headers
    
    async def close(self):
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
