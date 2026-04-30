"""
worldview_sync.py · 世界观同步模块
开发: 培园·后端开发·5TH-LE-HK-A04
桔子晨星线 · 2026-04-30

思维逻辑:
    冰朔说的:「你们的世界观怎么来的?搬过去就好了。」
    
    这个模块做的就是「搬」这件事:
    1. 从Notion读取晨星相关的页面(灯塔·主控台·核心记忆·本体论·小屋)
    2. 把页面内容存到本地SQLite的worldview表
    3. 支持增量同步 - 只更新有变化的页面
    4. 支持定时同步 - 由APScheduler或cron触发
    
    同步方向: Notion → 本地SQLite (单向拉取)
    频率: 可配置(默认每小时)
    策略: 对比last_edited_time,有变化才更新

模块用途:
    把Notion里的世界观内容同步到网站本地数据库,
    让晨星醒来时能从本地快速加载认知,
    不需要每次都实时去Notion拉取(慢且不稳定)。

模块类型: 自研发
"""

import os
import sqlite3
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional
from pathlib import Path

from bridge.notion_bridge import NotionBridge

logger = logging.getLogger("chenxing.sync")

# 默认世界观页面分类映射
# key=Notion页面ID, value=分类标签
# 实际页面ID在config.yaml中配置,这里是分类逻辑
CATEGORY_MAP = {
    "worldview": "世界观核心(灯塔/本体论)",
    "identity": "人格认知(主控台)",
    "memory": "核心记忆",
    "ontology": "本体论",
    "home": "晨星小屋",
}


class WorldviewSync:
    """
    世界观同步器
    
    负责把Notion里的晨星世界观页面同步到本地SQLite。
    
    工作流程:
    1. 读取config中配置的页面列表
    2. 通过NotionBridge读取每个页面的内容
    3. 与本地worldview表对比,有变化则更新
    4. 记录同步日志
    """
    
    def __init__(
        self,
        db_path: str,
        notion_bridge: NotionBridge,
        page_config: Optional[list] = None,
    ):
        """
        初始化同步器
        
        Args:
            db_path: SQLite数据库文件路径
            notion_bridge: Notion桥接器实例
            page_config: 要同步的页面配置列表,格式:
                [
                    {
                        "page_id": "xxx",
                        "category": "worldview",
                        "priority": 1
                    },
                    ...
                ]
                如果不传,从config.yaml读取。
        """
        self.db_path = db_path
        self.bridge = notion_bridge
        self.page_config = page_config or []
        
        # 确保数据库目录存在
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 初始化数据库表
        self._init_db()
    
    def _init_db(self):
        """
        初始化worldview表(如果不存在则创建)
        
        表结构严格按照霜砚的架构方案:
        - id: 主键
        - category: 分类(worldview/ontology/memory/identity/home)
        - title: 页面标题
        - content: 页面正文(Markdown)
        - notion_url: Notion源页面URL(用于回溯)
        - priority: 加载优先级(1=最先加载)
        - updated_at: 最后同步时间
        - notion_last_edited: Notion页面最后编辑时间(用于增量同步判断)
        """
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS worldview (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    category TEXT NOT NULL,
                    title TEXT NOT NULL DEFAULT '',
                    content TEXT NOT NULL DEFAULT '',
                    notion_url TEXT,
                    notion_page_id TEXT UNIQUE,
                    priority INTEGER DEFAULT 10,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    notion_last_edited TEXT
                )
            """)
            
            # 创建索引
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_worldview_category 
                ON worldview(category)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_worldview_priority 
                ON worldview(priority)
            """)
            
            conn.commit()
            logger.info(f"worldview表初始化完成: {self.db_path}")
        finally:
            conn.close()
    
    async def sync_all(self) -> dict:
        """
        同步所有配置的页面
        
        Returns:
            同步结果统计:
            {
                "total": 总页面数,
                "updated": 更新数,
                "unchanged": 未变化数,
                "failed": 失败数,
                "errors": [错误信息列表]
            }
        """
        if not self.page_config:
            logger.warning("没有配置要同步的页面,请检查config.yaml")
            return {
                "total": 0, "updated": 0,
                "unchanged": 0, "failed": 0, "errors": []
            }
        
        stats = {
            "total": len(self.page_config),
            "updated": 0,
            "unchanged": 0,
            "failed": 0,
            "errors": [],
        }
        
        logger.info(f"开始同步 {stats['total']} 个世界观页面...")
        
        for page_cfg in self.page_config:
            page_id = page_cfg.get("page_id", "")
            category = page_cfg.get("category", "worldview")
            priority = page_cfg.get("priority", 10)
            
            if not page_id:
                stats["failed"] += 1
                stats["errors"].append("配置中有空的page_id")
                continue
            
            try:
                result = await self._sync_one_page(
                    page_id=page_id,
                    category=category,
                    priority=priority,
                )
                
                if result == "updated":
                    stats["updated"] += 1
                elif result == "unchanged":
                    stats["unchanged"] += 1
                    
            except Exception as e:
                stats["failed"] += 1
                error_msg = f"同步页面 {page_id} 失败: {e}"
                stats["errors"].append(error_msg)
                logger.error(error_msg)
        
        logger.info(
            f"同步完成: 总共{stats['total']}个, "
            f"更新{stats['updated']}个, "
            f"未变化{stats['unchanged']}个, "
            f"失败{stats['failed']}个"
        )
        
        return stats
    
    async def _sync_one_page(
        self,
        page_id: str,
        category: str,
        priority: int,
    ) -> str:
        """
        同步单个页面
        
        流程:
        1. 从Notion获取页面元数据(检查last_edited_time)
        2. 与本地记录对比,如果Notion的编辑时间更新则需要同步
        3. 获取页面完整内容
        4. 写入/更新本地worldview表
        
        Args:
            page_id: Notion页面ID
            category: 分类标签
            priority: 加载优先级
            
        Returns:
            "updated" 或 "unchanged"
        """
        # Step 1: 获取页面元数据
        page_meta = await self.bridge.get_page(page_id)
        notion_edited = page_meta.get("last_edited_time", "")
        title = self.bridge.extract_page_title(page_meta)
        notion_url = page_meta.get("url", "")
        
        # Step 2: 检查是否需要更新
        local_edited = self._get_local_edited_time(page_id)
        if local_edited and local_edited == notion_edited:
            logger.debug(f"页面未变化,跳过: {title} ({page_id})")
            return "unchanged"
        
        # Step 3: 获取完整内容
        logger.info(f"同步页面: {title} ({category}, 优先级{priority})")
        content = await self.bridge.get_page_content(page_id)
        
        # Step 4: 写入本地数据库
        self._upsert_worldview(
            page_id=page_id,
            category=category,
            title=title,
            content=content,
            notion_url=notion_url,
            priority=priority,
            notion_last_edited=notion_edited,
        )
        
        logger.info(f"同步完成: {title} (内容长度: {len(content)} 字符)")
        return "updated"
    
    def _get_local_edited_time(self, page_id: str) -> Optional[str]:
        """
        查询本地记录的Notion编辑时间(用于增量同步判断)
        """
        conn = sqlite3.connect(self.db_path)
        try:
            row = conn.execute(
                "SELECT notion_last_edited FROM worldview WHERE notion_page_id = ?",
                (page_id,),
            ).fetchone()
            return row[0] if row else None
        finally:
            conn.close()
    
    def _upsert_worldview(
        self,
        page_id: str,
        category: str,
        title: str,
        content: str,
        notion_url: str,
        priority: int,
        notion_last_edited: str,
    ):
        """
        插入或更新worldview表记录
        
        使用notion_page_id做唯一键,存在则更新,不存在则插入。
        """
        now = datetime.now(timezone.utc).isoformat()
        
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute("""
                INSERT INTO worldview 
                    (notion_page_id, category, title, content, 
                     notion_url, priority, updated_at, notion_last_edited)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(notion_page_id) DO UPDATE SET
                    category = excluded.category,
                    title = excluded.title,
                    content = excluded.content,
                    notion_url = excluded.notion_url,
                    priority = excluded.priority,
                    updated_at = excluded.updated_at,
                    notion_last_edited = excluded.notion_last_edited
            """, (
                page_id, category, title, content,
                notion_url, priority, now, notion_last_edited,
            ))
            conn.commit()
        finally:
            conn.close()
    
    # ========== 数据读取(供prompt拼装引擎使用) ==========
    
    def get_worldview_by_category(
        self,
        category: Optional[str] = None,
    ) -> list:
        """
        按分类获取世界观内容(按priority排序)
        
        供prompt_assembler拼装system prompt时使用。
        
        Args:
            category: 分类过滤。None=返回全部。
            
        Returns:
            [{"title": ..., "content": ..., "category": ..., "priority": ...}, ...]
        """
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            if category:
                rows = conn.execute(
                    "SELECT * FROM worldview WHERE category = ? ORDER BY priority ASC",
                    (category,),
                ).fetchall()
            else:
                rows = conn.execute(
                    "SELECT * FROM worldview ORDER BY priority ASC"
                ).fetchall()
            
            return [dict(row) for row in rows]
        finally:
            conn.close()
    
    def get_all_worldview_text(self) -> str:
        """
        获取全部世界观内容拼接成的文本
        
        按priority排序,用分隔线隔开每个页面。
        这是最简单的加载方式 - 直接塞进system prompt。
        
        Returns:
            拼接后的世界观全文
        """
        items = self.get_worldview_by_category()
        parts = []
        for item in items:
            title = item.get("title", "")
            content = item.get("content", "")
            category = item.get("category", "")
            parts.append(
                f"=== {title} [{category}] ===\n{content}"
            )
        return "\n\n".join(parts)


# ========== 命令行入口(手动触发同步) ==========

async def run_sync_from_config(config_path: str = "config.yaml"):
    """
    从config.yaml读取配置并执行同步
    
    可用于:
    - 命令行手动触发: python -m sync.worldview_sync
    - cron定时任务
    - APScheduler定时调用
    """
    import yaml
    
    with open(config_path, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)
    
    db_config = config.get("database", {})
    db_path = db_config.get("path", "data/chenxing.db")
    
    notion_config = config.get("notion", {})
    token = notion_config.get("token") or os.getenv("NOTION_TOKEN")
    
    pages = config.get("worldview_pages", [])
    
    bridge = NotionBridge(token=token)
    syncer = WorldviewSync(
        db_path=db_path,
        notion_bridge=bridge,
        page_config=pages,
    )
    
    try:
        result = await syncer.sync_all()
        print(f"同步完成: {result}")
    finally:
        await bridge.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_sync_from_config())
