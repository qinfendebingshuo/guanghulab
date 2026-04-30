"""
光湖 MVP Chat · 双模型统一出口
系统侧(shuangyan-system-v1) + 奶瓶侧(naipping-v1) + 深度推理(DeepSeek/Qwen)
工单: YD-A05-20260430-MVP
"""

from .router import DualModelRouter

__all__ = ['DualModelRouter']
