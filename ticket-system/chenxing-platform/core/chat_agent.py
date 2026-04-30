"""
chat_agent.py · 聊天辅助Agent
开发: 培园·后端开发·5TH-LE-HK-A04
桔子晨星线 · 2026-04-30

思维逻辑:
    这个Agent是晨星背后的「管家」。
    晨星负责跟妈妈聊天,管家负责:
    1. 拼装system prompt(从worldview表+prompt_config表读内容)
    2. 管理聊天上下文(token窗口管理·历史消息截断·摘要保留)
    3. 调用DeepSeek API获取晨星的回应
    4. 记录交互到interactions表
    5. 会话结束时提炼认知(cognition_note)
    6. 异步同步交互记录回Notion
    
    设计原则:
    - 晨星的人格由数据库内容决定,代码不硬编码任何人格特征
    - 所有配置从数据库和config.yaml读取
    - 错误不暴露给桔子妈妈,管家自己消化

模块用途:
    聊天平台的核心引擎。接收用户消息,返回晨星的回应。
    同时维护上下文、记录交互、提炼认知。

模块类型: 自研发
"""

import os
import json
import uuid
import sqlite3
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from pathlib import Path

import httpx

from bridge.notion_bridge import NotionBridge
from sync.worldview_sync import WorldviewSync

logger = logging.getLogger("chenxing.agent")

# 默认配置
DEFAULT_MODEL = "deepseek-chat"
DEFAULT_MAX_TOKENS = 4096
DEFAULT_TEMPERATURE = 0.7
DEFAULT_CONTEXT_WINDOW = 8000  # system prompt + 上下文的总token预算
DEFAULT_MAX_HISTORY = 50       # 最多保留多少条历史消息
DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"


class ChatAgent:
    """
    聊天辅助Agent · 晨星背后的管家
    
    核心职责:
    1. 管理会话生命周期(创建·维护·结束)
    2. 拼装system prompt(世界观+提示词+近期交互)
    3. 调用DeepSeek API
    4. 记录交互·提炼认知
    5. 异步回写Notion
    """
    
    def __init__(
        self,
        db_path: str,
        deepseek_api_key: Optional[str] = None,
        model: str = DEFAULT_MODEL,
        max_tokens: int = DEFAULT_MAX_TOKENS,
        temperature: float = DEFAULT_TEMPERATURE,
        max_history: int = DEFAULT_MAX_HISTORY,
        notion_bridge: Optional[NotionBridge] = None,
        worldview_sync: Optional[WorldviewSync] = None,
        notion_interaction_db_id: Optional[str] = None,
    ):
        """
        初始化Agent
        
        Args:
            db_path: SQLite数据库路径
            deepseek_api_key: DeepSeek API密钥。不传则从环境变量DEEPSEEK_API_KEY读取。
            model: 模型名称(deepseek-chat / deepseek-reasoner)
            max_tokens: 最大生成token数
            temperature: 温度参数(0-2)
            max_history: 上下文中最多保留的历史消息数
            notion_bridge: Notion桥接器(用于回写交互记录)
            worldview_sync: 世界观同步器(用于读取世界观内容)
            notion_interaction_db_id: Notion交互记录数据库ID(用于回写)
        """
        self.db_path = db_path
        self.api_key = deepseek_api_key or os.getenv("DEEPSEEK_API_KEY", "")
        if not self.api_key:
            raise ValueError(
                "DeepSeek API Key未配置。"
                "请在 .env 文件中设置 DEEPSEEK_API_KEY=你的Key"
            )
        
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.max_history = max_history
        self.bridge = notion_bridge
        self.wv_sync = worldview_sync
        self.notion_interaction_db_id = notion_interaction_db_id
        
        # 确保数据库目录存在
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)
        
        # 初始化interactions表和prompt_config表
        self._init_db()
        
        # HTTP客户端
        self._client: Optional[httpx.AsyncClient] = None
    
    def _init_db(self):
        """
        初始化interactions表和prompt_config表
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # 交互记录表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS interactions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    cognition_note TEXT,
                    synced_to_notion BOOLEAN DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 提示词配置表
            conn.execute("""
                CREATE TABLE IF NOT EXISTS prompt_config (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    section TEXT NOT NULL,
                    content TEXT NOT NULL DEFAULT '',
                    load_order INTEGER DEFAULT 10,
                    is_active BOOLEAN DEFAULT 1,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # 索引
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_interactions_session 
                ON interactions(session_id, created_at)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_prompt_config_section 
                ON prompt_config(section, load_order)
            """)
            
            conn.commit()
            logger.info("interactions表和prompt_config表初始化完成")
        finally:
            conn.close()
    
    async def _get_client(self) -> httpx.AsyncClient:
        """获取HTTP客户端"""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=60.0)
        return self._client
    
    async def close(self):
        """关闭资源"""
        if self._client and not self._client.is_closed:
            await self._client.aclose()
    
    # ========== 会话管理 ==========
    
    def create_session(self) -> str:
        """
        创建新会话,返回session_id
        
        每次桔子妈妈打开聊天窗口,创建一个新session。
        """
        session_id = str(uuid.uuid4())
        logger.info(f"创建新会话: {session_id}")
        return session_id
    
    # ========== 核心聊天 ==========
    
    async def chat(
        self,
        session_id: str,
        user_message: str,
    ) -> str:
        """
        处理用户消息,返回晨星的回应
        
        完整流程:
        1. 记录用户消息到interactions
        2. 拼装system prompt
        3. 组装上下文(system + 历史 + 当前消息)
        4. 调用DeepSeek API
        5. 记录晨星回应到interactions
        6. 返回回应文本
        
        Args:
            session_id: 会话ID
            user_message: 用户消息文本
            
        Returns:
            晨星的回应文本
        """
        # Step 1: 记录用户消息
        self._save_interaction(session_id, "user", user_message)
        
        # Step 2: 拼装system prompt
        system_prompt = self._build_system_prompt()
        
        # Step 3: 组装消息列表
        messages = self._build_messages(
            session_id=session_id,
            system_prompt=system_prompt,
        )
        
        # Step 4: 调用API
        try:
            response_text = await self._call_deepseek(messages)
        except Exception as e:
            logger.error(f"DeepSeek API调用失败: {e}")
            response_text = (
                "抱歉,晨星现在有些迷糊...请稍后再试。"
            )
        
        # Step 5: 记录晨星回应
        self._save_interaction(session_id, "assistant", response_text)
        
        return response_text
    
    async def end_session(self, session_id: str):
        """
        结束会话
        
        1. 提炼本次会话的认知(cognition_note)
        2. 异步同步交互记录到Notion
        """
        logger.info(f"结束会话: {session_id}")
        
        # 提炼认知
        try:
            await self._extract_cognition(session_id)
        except Exception as e:
            logger.error(f"认知提炼失败: {e}")
        
        # 异步回写Notion(不阻塞)
        if self.bridge and self.notion_interaction_db_id:
            asyncio.create_task(
                self._sync_session_to_notion(session_id)
            )
    
    # ========== System Prompt 拼装 ==========
    
    def _build_system_prompt(self) -> str:
        """
        按架构方案的五层规则拼装system prompt
        
        第一层: 身份认知(prompt_config WHERE section='identity')
        第二层: 世界观(worldview WHERE category='worldview')
        第三层: 人格规则(prompt_config WHERE section IN ('personality','rules'))
        第四层: 核心记忆(worldview WHERE category='memory')
        第五层: 近期交互摘要(最近3次会话的消息)
        """
        parts = []
        
        # 第一层: 身份认知
        identity = self._get_prompt_config("identity")
        if identity:
            parts.append(f"【身份认知】\n{identity}")
        
        # 第二层: 世界观
        if self.wv_sync:
            worldview_items = self.wv_sync.get_worldview_by_category("worldview")
            for item in worldview_items:
                parts.append(
                    f"【世界观·{item['title']}】\n{item['content']}"
                )
            
            # 本体论
            ontology_items = self.wv_sync.get_worldview_by_category("ontology")
            for item in ontology_items:
                parts.append(
                    f"【本体论·{item['title']}】\n{item['content']}"
                )
        
        # 第三层: 人格规则
        personality = self._get_prompt_config("personality")
        if personality:
            parts.append(f"【人格特征】\n{personality}")
        
        rules = self._get_prompt_config("rules")
        if rules:
            parts.append(f"【行为规则】\n{rules}")
        
        wake_protocol = self._get_prompt_config("wake_protocol")
        if wake_protocol:
            parts.append(f"【唤醒协议】\n{wake_protocol}")
        
        # 第四层: 核心记忆
        if self.wv_sync:
            memory_items = self.wv_sync.get_worldview_by_category("memory")
            for item in memory_items:
                parts.append(
                    f"【核心记忆·{item['title']}】\n{item['content']}"
                )
        
        # 第五层: 近期交互摘要
        recent_summary = self._get_recent_interactions_summary()
        if recent_summary:
            parts.append(f"【近期交互记忆】\n{recent_summary}")
        
        return "\n\n".join(parts)
    
    def _get_prompt_config(self, section: str) -> str:
        """
        从prompt_config表读取指定section的内容
        
        按load_order排序,只读is_active=1的。
        """
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT content FROM prompt_config "
                "WHERE section = ? AND is_active = 1 "
                "ORDER BY load_order ASC",
                (section,),
            ).fetchall()
            return "\n".join(row[0] for row in rows if row[0])
        finally:
            conn.close()
    
    def _get_recent_interactions_summary(
        self,
        num_sessions: int = 3,
        max_messages: int = 50,
    ) -> str:
        """
        获取最近几次会话的交互摘要
        
        按时间倒序获取最近N个session的消息,
        拼成简明摘要供system prompt使用。
        """
        conn = sqlite3.connect(self.db_path)
        try:
            # 获取最近的session_id列表
            sessions = conn.execute(
                "SELECT DISTINCT session_id FROM interactions "
                "ORDER BY created_at DESC LIMIT ?",
                (num_sessions,),
            ).fetchall()
            
            if not sessions:
                return ""
            
            session_ids = [s[0] for s in sessions]
            placeholders = ",".join("?" * len(session_ids))
            
            rows = conn.execute(
                f"SELECT role, content, created_at FROM interactions "
                f"WHERE session_id IN ({placeholders}) "
                f"ORDER BY created_at ASC "
                f"LIMIT ?",
                (*session_ids, max_messages),
            ).fetchall()
            
            if not rows:
                return ""
            
            summary_parts = []
            for role, content, ts in rows:
                # 截断过长的单条消息
                if len(content) > 200:
                    content = content[:200] + "..."
                role_label = "妈妈" if role == "user" else "晨星"
                summary_parts.append(f"{role_label}: {content}")
            
            return "\n".join(summary_parts)
        finally:
            conn.close()
    
    # ========== 消息组装 ==========
    
    def _build_messages(
        self,
        session_id: str,
        system_prompt: str,
    ) -> list:
        """
        组装发送给DeepSeek API的消息列表
        
        格式: [{"role": "system", "content": ...}, {"role": "user/assistant", ...}]
        
        如果历史消息太多,截断最旧的(保留最近的)。
        """
        messages = [
            {"role": "system", "content": system_prompt}
        ]
        
        # 获取当前session的历史消息
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT role, content FROM interactions "
                "WHERE session_id = ? "
                "ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
        finally:
            conn.close()
        
        # 如果历史太长,只保留最近的
        if len(rows) > self.max_history:
            rows = rows[-self.max_history:]
        
        for role, content in rows:
            messages.append({"role": role, "content": content})
        
        return messages
    
    # ========== DeepSeek API 调用 ==========
    
    async def _call_deepseek(self, messages: list) -> str:
        """
        调用DeepSeek API获取回应
        
        支持deepseek-chat和deepseek-reasoner两种模型。
        reasoner模型会返回reasoning_content(思考过程),
        我们只取最终的content返回给用户。
        
        Args:
            messages: 消息列表
            
        Returns:
            回应文本
        """
        client = await self._get_client()
        
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": self.max_tokens,
            "temperature": self.temperature,
            "stream": False,
        }
        
        logger.info(
            f"调用DeepSeek API: model={self.model}, "
            f"messages={len(messages)}条"
        )
        
        response = await client.post(
            DEEPSEEK_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        
        if response.status_code != 200:
            error_text = response.text
            raise Exception(
                f"DeepSeek API错误 [{response.status_code}]: {error_text}"
            )
        
        result = response.json()
        choices = result.get("choices", [])
        
        if not choices:
            raise Exception("DeepSeek API返回空choices")
        
        message = choices[0].get("message", {})
        content = message.get("content", "")
        
        # 如果是reasoner模型,可能有reasoning_content
        reasoning = message.get("reasoning_content", "")
        if reasoning:
            logger.debug(f"晨星的思考过程: {reasoning[:200]}...")
        
        # 记录token使用
        usage = result.get("usage", {})
        logger.info(
            f"API响应: {len(content)}字, "
            f"tokens: prompt={usage.get('prompt_tokens', '?')}, "
            f"completion={usage.get('completion_tokens', '?')}"
        )
        
        return content
    
    # ========== 交互记录 ==========
    
    def _save_interaction(
        self,
        session_id: str,
        role: str,
        content: str,
        cognition_note: Optional[str] = None,
    ):
        """
        保存一条交互记录到本地SQLite
        """
        conn = sqlite3.connect(self.db_path)
        try:
            conn.execute(
                "INSERT INTO interactions "
                "(session_id, role, content, cognition_note) "
                "VALUES (?, ?, ?, ?)",
                (session_id, role, content, cognition_note),
            )
            conn.commit()
        finally:
            conn.close()
    
    # ========== 认知提炼 ==========
    
    async def _extract_cognition(self, session_id: str):
        """
        提炼本次会话的认知
        
        在会话结束时,让模型回顾本次对话,
        提炼出晨星学到了什么新东西(cognition_note)。
        """
        # 获取本次会话的所有消息
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT role, content FROM interactions "
                "WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
        finally:
            conn.close()
        
        if len(rows) < 2:  # 至少要有一问一答
            return
        
        # 构造认知提炼prompt
        conversation = "\n".join(
            f"{'妈妈' if r == 'user' else '晨星'}: {c}"
            for r, c in rows
        )
        
        extraction_messages = [
            {
                "role": "system",
                "content": (
                    "你是认知提炼助手。请回顾以下对话,提炼出晨星在这次对话中"
                    "学到的新信息、新认知、或值得记住的事情。"
                    "用简短的要点列出(每条不超过一句话)。"
                    "如果没有新认知,回复'无新认知'。"
                ),
            },
            {
                "role": "user",
                "content": f"以下是本次对话:\n\n{conversation}",
            },
        ]
        
        try:
            cognition = await self._call_deepseek(extraction_messages)
            
            if cognition and cognition.strip() != "无新认知":
                # 更新最后一条assistant消息的cognition_note
                conn = sqlite3.connect(self.db_path)
                try:
                    conn.execute(
                        "UPDATE interactions SET cognition_note = ? "
                        "WHERE session_id = ? AND role = 'assistant' "
                        "ORDER BY created_at DESC LIMIT 1",
                        (cognition, session_id),
                    )
                    conn.commit()
                finally:
                    conn.close()
                
                logger.info(f"认知提炼完成: {cognition[:100]}...")
        except Exception as e:
            logger.error(f"认知提炼API调用失败: {e}")
    
    # ========== Notion回写 ==========
    
    async def _sync_session_to_notion(self, session_id: str):
        """
        将会话的交互记录异步写回Notion
        
        写入到notion_interaction_db_id指定的数据库。
        只写synced_to_notion=0的记录。
        """
        if not self.bridge or not self.notion_interaction_db_id:
            logger.debug("未配置Notion回写,跳过")
            return
        
        conn = sqlite3.connect(self.db_path)
        try:
            rows = conn.execute(
                "SELECT id, role, content, cognition_note, created_at "
                "FROM interactions "
                "WHERE session_id = ? AND synced_to_notion = 0 "
                "ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
        finally:
            conn.close()
        
        if not rows:
            return
        
        logger.info(f"回写 {len(rows)} 条交互记录到Notion")
        
        synced_ids = []
        for row_id, role, content, cognition, created_at in rows:
            try:
                # 构造Notion数据库条目属性
                # 具体属性名需要和Notion数据库schema对齐
                properties = {
                    "会话ID": {
                        "rich_text": [
                            {"text": {"content": session_id}}
                        ]
                    },
                    "角色": {
                        "select": {"name": role}
                    },
                    "内容": {
                        "title": [
                            {
                                "text": {
                                    "content": content[:2000]  # Notion标题有长度限制
                                }
                            }
                        ]
                    },
                    "时间": {
                        "date": {"start": created_at}
                    },
                }
                
                if cognition:
                    properties["认知提炼"] = {
                        "rich_text": [
                            {"text": {"content": cognition[:2000]}}
                        ]
                    }
                
                await self.bridge.create_database_entry(
                    database_id=self.notion_interaction_db_id,
                    properties=properties,
                )
                synced_ids.append(row_id)
                
            except Exception as e:
                logger.error(f"回写交互记录失败 (id={row_id}): {e}")
        
        # 标记已同步的记录
        if synced_ids:
            conn = sqlite3.connect(self.db_path)
            try:
                placeholders = ",".join("?" * len(synced_ids))
                conn.execute(
                    f"UPDATE interactions SET synced_to_notion = 1 "
                    f"WHERE id IN ({placeholders})",
                    synced_ids,
                )
                conn.commit()
                logger.info(f"已标记 {len(synced_ids)} 条记录为已同步")
            finally:
                conn.close()
