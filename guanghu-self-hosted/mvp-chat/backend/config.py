"""
光湖 MVP Chat · 配置管理
所有配置从环境变量读取 · 零硬编码
工单: YD-A05-20260430-MVP
"""

import os


class Config:
    """MVP Chat 全局配置 · 从环境变量加载"""

    # ── 百炼模型API ──
    DASHSCOPE_API_KEY = os.environ.get('DASHSCOPE_API_KEY', '')
    DASHSCOPE_BASE_URL = os.environ.get(
        'DASHSCOPE_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
    )
    SYSTEM_MODEL = os.environ.get('SYSTEM_MODEL', 'shuangyan-system-v1')
    NAIPPING_MODEL = os.environ.get('NAIPPING_MODEL', 'naipping-v1')

    # ── 深度推理（可选）──
    DEEPSEEK_API_KEY = os.environ.get('DEEPSEEK_API_KEY', '')
    DEEPSEEK_BASE_URL = os.environ.get(
        'DEEPSEEK_BASE_URL',
        'https://api.deepseek.com/v1'
    )
    QWEN_API_KEY = os.environ.get('QWEN_API_KEY', '')
    QWEN_BASE_URL = os.environ.get(
        'QWEN_BASE_URL',
        'https://dashscope.aliyuncs.com/compatible-mode/v1'
    )

    # ── Notion ──
    ZY_NOTION_TOKEN = os.environ.get('ZY_NOTION_TOKEN', '')
    USER_NOTION_TOKEN = os.environ.get('USER_NOTION_TOKEN', '')
    NOTION_API_BASE = 'https://api.notion.com/v1'
    NOTION_API_VERSION = '2022-06-28'

    # ── PostgreSQL ──
    DB_HOST = os.environ.get('DB_HOST', 'localhost')
    DB_PORT = int(os.environ.get('DB_PORT', '5432'))
    DB_NAME = os.environ.get('DB_NAME', 'guanghu')
    DB_USER = os.environ.get('DB_USER', 'guanghu')
    DB_PASSWORD = os.environ.get('DB_PASSWORD', '')

    @classmethod
    def get_dsn(cls):
        """构建 PostgreSQL DSN"""
        return (
            'postgresql://' + cls.DB_USER + ':' + cls.DB_PASSWORD
            + '@' + cls.DB_HOST + ':' + str(cls.DB_PORT)
            + '/' + cls.DB_NAME
        )

    # ── 服务端口 ──
    CHAT_PORT = int(os.environ.get('CHAT_PORT', '3000'))
    API_PORT = int(os.environ.get('API_PORT', '8000'))
    MEMORY_ROUTER_PORT = int(os.environ.get('MEMORY_ROUTER_PORT', '8001'))

    # ── 内部服务地址（Docker网络内）──
    MEMORY_ROUTER_URL = os.environ.get(
        'MEMORY_ROUTER_URL',
        'http://memory-router:' + str(os.environ.get('MEMORY_ROUTER_PORT', '8001'))
    )
    WEB_API_URL = os.environ.get(
        'WEB_API_URL',
        'http://web-api:' + str(os.environ.get('API_PORT', '8000'))
    )

    # ── 人格壳缓存 ──
    PERSONA_CACHE_TTL = int(os.environ.get('PERSONA_CACHE_TTL', '300'))  # 秒

    @classmethod
    def validate(cls):
        """检查必要配置"""
        missing = []
        if not cls.DASHSCOPE_API_KEY:
            missing.append('DASHSCOPE_API_KEY')
        if not cls.ZY_NOTION_TOKEN:
            missing.append('ZY_NOTION_TOKEN')
        return missing
