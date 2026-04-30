"""
光湖 MVP Chat · 人格壳加载器
启动时从Notion拉取人格壳配置 → 注入system prompt
工单: YD-A05-20260430-MVP
"""

from .loader import PersonaLoader

__all__ = ['PersonaLoader']
