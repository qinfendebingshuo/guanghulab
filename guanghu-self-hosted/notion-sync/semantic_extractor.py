# -*- coding: utf-8 -*-
"""语义提取器 v2 · Semantic Extractor

哲学基础：
  页面不是「数据条目」，而是「一段语言」。
  提取不是「抽字段」，而是「理解意思」。

v2 升级 (2026-04-27):
  - 新增LLM语义提取模式（理解页面意思后提取关键信息）
  - JSONL结构化导出保留为数据管道
  - 通过 SEMANTIC_SYNC_ENABLED 环境变量开启
"""
import os
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger("guanghu.sync.semantic")

SEMANTIC_EXTRACT_PROMPT = """你是光湖语义提取器。读取Notion页面内容，理解意思，提取关键信息。

输出JSON:
{"title":"","summary":"","topics":[],"entities":[],"intent":"","key_facts":[],"emotional_tone":""}

规则: summary不超过30字, topics最多5个, entities提取人名/项目名/模块名, key_facts最多5条每条不超过20字, 用中文。"""


@dataclass
class SemanticResult:
    title: str = ""
    summary: str = ""
    topics: List[str] = field(default_factory=list)
    entities: List[str] = field(default_factory=list)
    intent: str = ""
    key_facts: List[str] = field(default_factory=list)
    emotional_tone: str = "\u4e2d\u6027"
    raw_content: str = ""
    page_url: str = ""
    extracted_at: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "summary": self.summary,
            "topics": self.topics,
            "entities": self.entities,
            "intent": self.intent,
            "key_facts": self.key_facts,
            "emotional_tone": self.emotional_tone,
            "page_url": self.page_url,
            "extracted_at": self.extracted_at,
        }


class SemanticExtractor:
    def __init__(self, config=None):
        self.semantic_enabled = os.getenv("SEMANTIC_SYNC_ENABLED", "0") == "1"
        self.config = config
        self._http_client = None

    def extract_structural(self, page_data: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "page_id": page_data.get("id", ""),
            "title": page_data.get("title", ""),
            "content": page_data.get("content", ""),
            "properties": page_data.get("properties", {}),
            "last_edited": page_data.get("last_edited_time", ""),
            "created": page_data.get("created_time", ""),
            "url": page_data.get("url", ""),
            "parent": page_data.get("parent", {}),
        }

    async def extract_semantic(self, page_data: Dict[str, Any]) -> SemanticResult:
        title = page_data.get("title", "")
        content = page_data.get("content", "")
        page_url = page_data.get("url", "")

        if not self.semantic_enabled or not self.config:
            return SemanticResult(
                title=title,
                summary="[\u7ed3\u6784\u5316\u63d0\u53d6\u00b7\u672a\u542f\u7528\u8bed\u4e49\u6a21\u5f0f]",
                raw_content=content[:500],
                page_url=page_url,
                extracted_at=datetime.now(timezone.utc).isoformat(),
            )

        try:
            import httpx
            if self._http_client is None:
                self._http_client = httpx.AsyncClient(timeout=15.0)

            truncated = content[:2000] if len(content) > 2000 else content
            user_msg = "\u9875\u9762\u6807\u9898: " + title + "\n\n\u5185\u5bb9:\n" + truncated

            resp = await self._http_client.post(
                self.config.llm_endpoint,
                json={
                    "model": self.config.llm_model,
                    "messages": [
                        {"role": "system", "content": SEMANTIC_EXTRACT_PROMPT},
                        {"role": "user", "content": user_msg}
                    ],
                    "temperature": 0.2,
                    "max_tokens": 500,
                },
                headers=self._build_headers(),
            )
            resp.raise_for_status()

            data = resp.json()
            raw_text = data["choices"][0]["message"]["content"].strip()
            parsed = json.loads(raw_text)

            return SemanticResult(
                title=parsed.get("title", title),
                summary=parsed.get("summary", ""),
                topics=parsed.get("topics", []),
                entities=parsed.get("entities", []),
                intent=parsed.get("intent", ""),
                key_facts=parsed.get("key_facts", []),
                emotional_tone=parsed.get("emotional_tone", "\u4e2d\u6027"),
                raw_content=content[:500],
                page_url=page_url,
                extracted_at=datetime.now(timezone.utc).isoformat(),
            )
        except Exception as e:
            logger.warning("Semantic extraction failed: " + str(e))
            return SemanticResult(
                title=title,
                summary="[\u8bed\u4e49\u63d0\u53d6\u5931\u8d25]",
                raw_content=content[:500],
                page_url=page_url,
                extracted_at=datetime.now(timezone.utc).isoformat(),
            )

    async def extract(self, page_data: Dict[str, Any]) -> Dict[str, Any]:
        structural = self.extract_structural(page_data)
        if self.semantic_enabled:
            semantic = await self.extract_semantic(page_data)
            structural["semantic"] = semantic.to_dict()
        return structural

    def _build_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config and hasattr(self.config, "llm_api_key") and self.config.llm_api_key:
            headers["Authorization"] = "Bearer " + self.config.llm_api_key
        return headers

    async def close(self):
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
