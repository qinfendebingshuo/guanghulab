# -*- coding: utf-8 -*-
"""导出格式化器 v2 · Export Formatter

保留v1 JSONL结构化导出作为数据管道。
v2新增语义导出模式（配合SemanticExtractor）。
"""
import json
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from dataclasses import dataclass

logger = logging.getLogger("guanghu.sync.export")


@dataclass
class ExportRecord:
    """JSONL导出记录"""
    page_id: str
    title: str
    content: str
    source_url: str
    exported_at: str
    properties: Dict[str, Any] = None
    semantic: Dict[str, Any] = None

    def __post_init__(self):
        if self.properties is None:
            self.properties = {}
        if self.semantic is None:
            self.semantic = {}


class ExportFormatter:
    """JSONL导出格式化器
    
    v1: 结构化JSONL(页面字段平铺)
    v2: 语义增强JSONL(附带语义提取结果)
    """

    def __init__(self, include_semantic: bool = False):
        self.include_semantic = include_semantic

    def format_record(self, page_data: Dict[str, Any]) -> str:
        """v1: 结构化导出单条记录"""
        record = ExportRecord(
            page_id=page_data.get("id", ""),
            title=page_data.get("title", ""),
            content=page_data.get("content", ""),
            source_url=self._build_source_url(page_data.get("id", "")),
            exported_at=datetime.now(timezone.utc).isoformat(),
            properties=page_data.get("properties", {}),
        )

        if self.include_semantic and "semantic" in page_data:
            record.semantic = page_data["semantic"]

        obj = {
            "page_id": record.page_id,
            "title": record.title,
            "content": record.content,
            "source_url": record.source_url,
            "exported_at": record.exported_at,
            "properties": record.properties,
        }
        if record.semantic:
            obj["semantic"] = record.semantic

        return json.dumps(obj, ensure_ascii=False)

    def format_batch(self, pages: List[Dict[str, Any]]) -> str:
        """批量JSONL导出"""
        lines = []
        for page in pages:
            try:
                lines.append(self.format_record(page))
            except Exception as e:
                logger.warning("Failed to format page: " + str(e))
        return "\n".join(lines)

    def _build_source_url(self, page_id: str) -> str:
        """\u6784\u5efa\u9875\u9762URL"""
        if not page_id:
            return ""
        base = "https://www.notion.so/"
        clean_id = page_id.replace("-", "")
        return base + clean_id
