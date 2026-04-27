# -*- coding: utf-8 -*-
"""记忆路由器 v2 · Memory Router

哲学基础：
  万能充 = 语言人格体本身。语言人格体天生拥有语言理解力和翻译能力。
  记忆路由不是“关键词匹配”，而是“理解查询的意思，决定需要什么记忆上下文”。

v2 升级说明 (2026-04-27):
  - 主路径：LLM 语义路由（理解意思）
  - Fallback：关键词匹配（快速确定性）
  - 向后完全兼容：SEMANTIC_ROUTE_ENABLED=0 时行为与 v1 一致
"""
import re
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field

from .route_config import RouteConfig
from .semantic_router import SemanticRouter, RouteStrategy, RouteDecision

logger = logging.getLogger("guanghu.memory.router")

# === v1 关键词路由规则（保留为 fallback） ===
KEYWORD_RULES = [
    # (strategy, patterns, description)
    (RouteStrategy.PERMANENT, [r"记住", r"永久", r"规则", r"公理", r"身份", r"我是谁"], "永久记忆查询"),
    (RouteStrategy.HOT_ONLY, [r"刚才", r"最近", r"上一条", r"刚说"], "热层查询"),
    (RouteStrategy.HOT_AND_WARM, [r"今天", r"上午", r"下午", r"早上"], "温层查询"),
    (RouteStrategy.SEMANTIC_SEARCH, [r"之前", r"上次", r"历史", r"搜索", r"找"], "语义搜索"),
    (RouteStrategy.NONE, [r"你好", r"谢谢", r"再见"], "无需记忆"),
]


@dataclass
class MemoryItem:
    """记忆条目"""
    content: str
    timestamp: str
    layer: str  # hot / warm / permanent
    agent_id: str = ""
    tags: List[str] = field(default_factory=list)
    relevance: float = 0.0


class MemoryRouter:
    """记忆路由器 v2
    
    调用流程：
    1. 尝试语义路由（LLM 理解意思）
    2. 语义路由失败/超时/未开启 → 关键词路由（fallback）
    3. 根据路由策略从对应记忆层获取上下文
    """
    
    def __init__(self, config: Optional[RouteConfig] = None):
        self.config = config or RouteConfig.from_env()
        self.semantic_router = SemanticRouter(self.config)
        
        # 记忆层存储（内存实现，生产环境可替换为 Redis/SQLite）
        self._hot: List[MemoryItem] = []
        self._warm: List[MemoryItem] = []
        self._permanent: List[MemoryItem] = []
    
    # =====================
    # 路由决策
    # =====================
    
    async def route_query(self, query: str, agent_id: str = "") -> RouteDecision:
        """理解查询意思，决定记忆路由策略
        
        v2 流程：
        1. 尝试语义路由（LLM 理解意思）
        2. 失败则 fallback 到关键词路由
        """
        # === Step 1: 语义路由（主路径） ===
        decision = await self.semantic_router.route(query, agent_id)
        if decision is not None:
            logger.info(f"Semantic route: {decision.strategy.value} (confidence={decision.confidence:.2f})")
            return decision
        
        # === Step 2: 关键词路由（fallback） ===
        strategy = self._keyword_route(query)
        logger.info(f"Keyword fallback route: {strategy.value}")
        return RouteDecision(
            strategy=strategy,
            reasoning=f"keyword_match",
            context_hint=query,
            confidence=0.6,
            source="keyword_fallback",
        )
    
    def _keyword_route(self, query: str) -> RouteStrategy:
        """关键词路由 (v1 逻辑，保留为 fallback)"""
        for strategy, patterns, _ in KEYWORD_RULES:
            for pattern in patterns:
                if re.search(pattern, query):
                    return strategy
        # 默认：语义搜索
        return RouteStrategy.SEMANTIC_SEARCH
    
    # =====================
    # 记忆检索
    # =====================
    
    async def retrieve(self, query: str, agent_id: str = "") -> List[MemoryItem]:
        """根据查询检索相关记忆
        
        完整流程：路由 → 检索 → 返回
        """
        decision = await self.route_query(query, agent_id)
        return self._fetch_by_strategy(decision)
    
    def _fetch_by_strategy(self, decision: RouteDecision) -> List[MemoryItem]:
        """根据路由策略从对应层获取记忆"""
        now = datetime.now(timezone.utc)
        results = []
        
        if decision.strategy == RouteStrategy.NONE:
            return []
        
        if decision.strategy in (RouteStrategy.HOT_ONLY, RouteStrategy.HOT_AND_WARM, 
                                  RouteStrategy.SEMANTIC_SEARCH, RouteStrategy.FULL):
            hot_cutoff = now - timedelta(minutes=self.config.hot_window_minutes)
            results.extend([
                item for item in self._hot
                if item.timestamp >= hot_cutoff.isoformat()
            ])
        
        if decision.strategy in (RouteStrategy.HOT_AND_WARM, RouteStrategy.SEMANTIC_SEARCH, 
                                  RouteStrategy.FULL):
            warm_cutoff = now - timedelta(hours=self.config.warm_window_hours)
            results.extend([
                item for item in self._warm
                if item.timestamp >= warm_cutoff.isoformat()
            ])
        
        if decision.strategy in (RouteStrategy.PERMANENT, RouteStrategy.FULL):
            results.extend(self._permanent)
        
        return results[:self.config.max_results]
    
    # =====================
    # 记忆写入
    # =====================
    
    def store(self, item: MemoryItem):
        """存储记忆条目到对应层"""
        if item.layer == "hot":
            self._hot.append(item)
        elif item.layer == "warm":
            self._warm.append(item)
        elif item.layer == "permanent":
            self._permanent.append(item)
        else:
            logger.warning(f"Unknown layer: {item.layer}, defaulting to hot")
            self._hot.append(item)
    
    def promote(self, item: MemoryItem, target_layer: str):
        """提升记忆层级（hot → warm → permanent）"""
        # 从原层移除
        source = getattr(self, f"_{item.layer}", None)
        if source and item in source:
            source.remove(item)
        # 存入目标层
        item.layer = target_layer
        self.store(item)
    
    def gc(self):
        """垃圾回收：清理过期记忆"""
        now = datetime.now(timezone.utc)
        hot_cutoff = (now - timedelta(minutes=self.config.hot_window_minutes)).isoformat()
        warm_cutoff = (now - timedelta(hours=self.config.warm_window_hours)).isoformat()
        
        self._hot = [i for i in self._hot if i.timestamp >= hot_cutoff]
        self._warm = [i for i in self._warm if i.timestamp >= warm_cutoff]
        # permanent 永不清理
    
    async def close(self):
        """清理资源"""
        await self.semantic_router.close()
