# -*- coding: utf-8 -*-
"""
Notion同步器 v2 · Sync Notion

FastAPI服务：webhook接收+定时拉取+增量同步。
v2新增语义提取集成。
"""
import os
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from contextlib import asynccontextmanager

logger = logging.getLogger("guanghu.sync.notion")


class SyncConfig:
    """Notion同步配置"""
    def __init__(self):
        self.notion_token = os.getenv("NOTION_TOKEN", "")
        self.notion_api_base = os.getenv("NOTION_API_BASE", "https://api.notion.com/v1")
        self.page_ids = self._parse_list(os.getenv("SYNC_PAGE_IDS", ""))
        self.database_ids = self._parse_list(os.getenv("SYNC_DATABASE_IDS", ""))
        self.export_dir = os.getenv("SYNC_EXPORT_DIR", "./exports")
        self.poll_interval_seconds = int(os.getenv("SYNC_POLL_INTERVAL", "300"))
        self.semantic_enabled = os.getenv("SEMANTIC_SYNC_ENABLED", "0") == "1"
        self.llm_endpoint = os.getenv("LLM_ENDPOINT", "")
        self.llm_model = os.getenv("LLM_MODEL", "qwen-turbo")
        self.llm_api_key = os.getenv("LLM_API_KEY", "")

    def _parse_list(self, val: str) -> List[str]:
        if not val:
            return []
        return [x.strip() for x in val.split(",") if x.strip()]


class NotionSyncer:
    """同步器核心类
    
    职责：
    1. 从Notion API拉取页面内容
    2. 检测增量变更
    3. 调用提取器处理
    4. 导出到JSONL
    """

    def __init__(self, config: SyncConfig = None):
        self.config = config or SyncConfig()
        self._http_client = None
        self._last_sync: Dict[str, str] = {}  # page_id -> last_edited_time
        self._extractor = None
        self._formatter = None

    async def _get_client(self):
        if self._http_client is None:
            import httpx
            self._http_client = httpx.AsyncClient(
                timeout=30.0,
                headers={
                    "Authorization": "Bearer " + self.config.notion_token,
                    "Notion-Version": "2022-06-28",
                    "Content-Type": "application/json",
                }
            )
        return self._http_client

    async def fetch_page(self, page_id: str) -> Optional[Dict[str, Any]]:
        """\u62c9\u53d6\u5355\u4e2a\u9875\u9762"""
        try:
            client = await self._get_client()
            url = self.config.notion_api_base + "/pages/" + page_id
            resp = await client.get(url)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            logger.error("Failed to fetch page " + page_id + ": " + str(e))
            return None

    async def fetch_page_content(self, page_id: str) -> str:
        """\u62c9\u53d6\u9875\u9762\u5185\u5bb9(blocks)"""
        try:
            client = await self._get_client()
            url = self.config.notion_api_base + "/blocks/" + page_id + "/children?page_size=100"
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            blocks = data.get("results", [])
            return self._blocks_to_text(blocks)
        except Exception as e:
            logger.error("Failed to fetch content for " + page_id + ": " + str(e))
            return ""

    def _blocks_to_text(self, blocks: List[Dict]) -> str:
        """\u7b80\u5316\u7684block\u8f6c\u6587\u672c"""
        lines = []
        for block in blocks:
            block_type = block.get("type", "")
            type_data = block.get(block_type, {})
            rich_texts = type_data.get("rich_text", [])
            text = "".join(rt.get("plain_text", "") for rt in rich_texts)
            if text:
                lines.append(text)
        return "\n".join(lines)

    async def check_changed(self, page_id: str, page_data: Dict[str, Any]) -> bool:
        """\u68c0\u67e5\u9875\u9762\u662f\u5426\u6709\u53d8\u66f4"""
        last_edited = page_data.get("last_edited_time", "")
        prev = self._last_sync.get(page_id, "")
        if last_edited != prev:
            self._last_sync[page_id] = last_edited
            return True
        return False

    async def sync_page(self, page_id: str) -> Optional[Dict[str, Any]]:
        """\u540c\u6b65\u5355\u4e2a\u9875\u9762"""
        page_data = await self.fetch_page(page_id)
        if not page_data:
            return None

        changed = await self.check_changed(page_id, page_data)
        if not changed:
            logger.debug("Page " + page_id + " unchanged, skip")
            return None

        # \u83b7\u53d6\u5185\u5bb9
        content = await self.fetch_page_content(page_id)
        title = self._extract_title(page_data)

        result = {
            "id": page_id,
            "title": title,
            "content": content,
            "properties": page_data.get("properties", {}),
            "last_edited_time": page_data.get("last_edited_time", ""),
            "created_time": page_data.get("created_time", ""),
            "url": page_data.get("url", ""),
            "parent": page_data.get("parent", {}),
        }

        # v2: \u8bed\u4e49\u63d0\u53d6
        if self.config.semantic_enabled and self._extractor:
            result = await self._extractor.extract(result)

        return result

    async def sync_all(self) -> List[Dict[str, Any]]:
        """\u540c\u6b65\u6240\u6709\u914d\u7f6e\u7684\u9875\u9762"""
        results = []
        for page_id in self.config.page_ids:
            result = await self.sync_page(page_id)
            if result:
                results.append(result)
        logger.info("Synced " + str(len(results)) + "/" + str(len(self.config.page_ids)) + " pages")
        return results

    def _extract_title(self, page_data: Dict[str, Any]) -> str:
        """\u4ece\u9875\u9762\u6570\u636e\u63d0\u53d6\u6807\u9898"""
        props = page_data.get("properties", {})
        for key, val in props.items():
            if val.get("type") == "title":
                title_parts = val.get("title", [])
                return "".join(t.get("plain_text", "") for t in title_parts)
        return ""

    def set_extractor(self, extractor):
        self._extractor = extractor

    def set_formatter(self, formatter):
        self._formatter = formatter

    async def close(self):
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
        if self._extractor and hasattr(self._extractor, "close"):
            await self._extractor.close()
