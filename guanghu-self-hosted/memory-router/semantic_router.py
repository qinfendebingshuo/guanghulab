# -*- coding: utf-8 -*-
"""语义路由器 v2 · Semantic Router

哲学基础：
  语言人格体天生拥有语言的理解力和翻译能力。
  路由不是关键词匹配，而是理解查询的意思。
  “上次冰朔说了什么关于部署的事” —— 这不是关键词问题，是意思问题。

与旧版关键词路由的关系：
  - 语义路由是主路径（开启时）
  - 关键词路由是快速 fallback（语义路由超时/失败/未开启时）
  - 向后完全兼容：不开启语义模式时，行为与 v1 完全一致
"""
import json
import logging
import asyncio
from enum import Enum
from typing import Optional, Dict, Any
from dataclasses import dataclass

logger = logging.getLogger("guanghu.memory.semantic_router")


class RouteStrategy(str, Enum):
    """路由策略枚举"""
    NONE = "none"                       # 不需要记忆
    HOT_ONLY = "hot_only"               # 只查热层（最近30分钟）
    HOT_AND_WARM = "hot_and_warm"       # 查热层+温层（24小时）
    SEMANTIC_SEARCH = "semantic_search" # 全层语义搜索
    PERMANENT = "permanent"             # 查永久层专属记忆
    FULL = "full"                       # 全层遍历


@dataclass
class RouteDecision:
    """路由决策结果"""
    strategy: RouteStrategy
    reasoning: str          # 为什么这样路由（语义理解的解释）
    context_hint: str       # 给记忆检索的上下文提示
    confidence: float       # 置信度 0.0-1.0
    source: str             # "semantic" or "keyword_fallback"


# === 语义路由 Prompt ===
# 这是“活的逻辑”的核心：让大模型理解查询的意思。
SEMANTIC_ROUTE_SYSTEM_PROMPT = """你是光湖记忆路由器。你的工作是理解一个查询的意思，然后决定需要从哪个记忆层获取上下文。

记忆层：
- hot: 最近30分钟的对话记忆（刚刚发生的事）
- warm: 最近24小时的对话记忆（今天的事）
- permanent: 永久记忆（身份、规则、重要永久认知）
- semantic_search: 全层语义搜索（跨时间找相关记忆）

输出 JSON 格式：
{"strategy": "hot_only|hot_and_warm|semantic_search|permanent|full|none", "reasoning": "简短解释", "context_hint": "给检索的提示", "confidence": 0.0-1.0}

只输出 JSON，不要其他文字。"""


class SemanticRouter:
    """语义路由器：用大模型理解查询意思，决定记忆路由策略"""
    
    def __init__(self, config):
        """
        Args:
            config: RouteConfig 实例
        """
        self.config = config
        self._http_client = None
    
    async def _get_http_client(self):
        """Lazy init httpx client"""
        if self._http_client is None:
            try:
                import httpx
                self._http_client = httpx.AsyncClient(
                    timeout=self.config.semantic_route_timeout
                )
            except ImportError:
                logger.warning("httpx not installed, semantic routing unavailable")
                return None
        return self._http_client
    
    async def route(self, query: str, agent_id: str = "") -> Optional[RouteDecision]:
        """语义路由：理解查询意思，返回路由决策
        
        Args:
            query: 用户查询文本
            agent_id: 当前 Agent 标识（用于上下文）
        
        Returns:
            RouteDecision 或 None（失败时返回 None，由调用方 fallback）
        """
        if not self.config.semantic_route_enabled:
            return None
        
        client = await self._get_http_client()
        if client is None:
            return None
        
        try:
            user_msg = f"Agent: {agent_id}\nQuery: {query}" if agent_id else f"Query: {query}"
            
            resp = await client.post(
                self.config.llm_endpoint,
                json={
                    "model": self.config.llm_model,
                    "messages": [
                        {"role": "system", "content": SEMANTIC_ROUTE_SYSTEM_PROMPT},
                        {"role": "user", "content": user_msg}
                    ],
                    "temperature": self.config.semantic_route_temperature,
                    "max_tokens": 200,
                },
                headers=self._build_headers(),
            )
            resp.raise_for_status()
            
            data = resp.json()
            content = data["choices"][0]["message"]["content"].strip()
            
            # 解析 JSON 响应
            # 处理可能的 markdown 代码块包装
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
                content = content.strip()
            
            parsed = json.loads(content)
            
            strategy = RouteStrategy(parsed.get("strategy", "semantic_search"))
            return RouteDecision(
                strategy=strategy,
                reasoning=parsed.get("reasoning", ""),
                context_hint=parsed.get("context_hint", ""),
                confidence=float(parsed.get("confidence", 0.5)),
                source="semantic",
            )
        
        except asyncio.TimeoutError:
            logger.warning(f"Semantic route timeout ({self.config.semantic_route_timeout}s), will fallback to keyword")
            return None
        except json.JSONDecodeError as e:
            logger.warning(f"Semantic route JSON parse error: {e}")
            return None
        except Exception as e:
            logger.error(f"Semantic route error: {e}", exc_info=True)
            return None
    
    def _build_headers(self) -> Dict[str, str]:
        """构建 HTTP 请求头"""
        headers = {"Content-Type": "application/json"}
        if self.config.llm_api_key:
            headers["Authorization"] = f"Bearer {self.config.llm_api_key}"
        return headers
    
    async def close(self):
        """关闭 HTTP 客户端"""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
