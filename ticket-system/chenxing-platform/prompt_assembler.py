"""
晨星网站交互平台 · 提示词拼装引擎
模块名：prompt_assembler.py
开发人：译典·配置开发 · 5TH-LE-HK-A05
版本：v1.0.0
日期：2026-04-30
架构依据：晨星网站交互平台·完整架构方案（冰朔定义·霜砚整理）
核心思路：五层拼装 · 身份→世界观→人格→记忆→近期交互

功能说明：
    从SQLite数据库读取提示词配置和世界观内容，
    按五层优先级拼装成完整的system prompt，
    喂给DeepSeek API让晨星在光湖世界里醒来。
    跟Notion给Agent加载核心大脑是一模一样的逻辑。

接口协议：
    - assemble_system_prompt(db_path) -> str
    - get_recent_interactions(db_path, session_count, limit) -> str
    - 输入：SQLite数据库路径
    - 输出：拼装好的system prompt字符串
"""

import sqlite3
import os
from typing import Optional


def get_db_connection(db_path: str) -> sqlite3.Connection:
    """获取数据库连接"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn


def load_prompt_config(db_path: str) -> str:
    """
    第一层 + 第三层：加载提示词配置（身份认知 + 人格规则）
    从prompt_config表读取所有启用的提示词模块，按load_order排序拼装。
    
    对应架构方案中的：
    - 第一层：身份认知（identity）—— 不可变
    - 第三层：人格规则（personality / rules）—— 霜砚可微调
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.execute(
            "SELECT section, content FROM prompt_config "
            "WHERE is_active = 1 "
            "ORDER BY load_order ASC"
        )
        rows = cursor.fetchall()
        if not rows:
            return ""
        
        parts = []
        for row in rows:
            section_name = row["section"]
            content = row["content"].strip()
            if content:
                parts.append(f"<!-- {section_name} -->\n{content}")
        
        return "\n\n".join(parts)
    finally:
        conn.close()


def load_worldview(db_path: str) -> str:
    """
    第二层 + 第四层：加载世界观内容和核心记忆
    从worldview表读取所有内容，按priority排序。
    
    对应架构方案中的：
    - 第二层：世界观（worldview / ontology）—— 不可变
    - 第四层：核心记忆（memory）—— 定期从Notion更新
    """
    conn = get_db_connection(db_path)
    try:
        cursor = conn.execute(
            "SELECT category, title, content FROM worldview "
            "ORDER BY priority ASC"
        )
        rows = cursor.fetchall()
        if not rows:
            return ""
        
        parts = []
        for row in rows:
            category = row["category"]
            title = row["title"]
            content = row["content"].strip()
            if content:
                parts.append(f"<!-- {category}: {title} -->\n{content}")
        
        return "\n\n".join(parts)
    finally:
        conn.close()


def get_recent_interactions(db_path: str, session_count: int = 3, limit: int = 50) -> str:
    """
    第五层：加载近期交互摘要
    从interactions表读取最近N次会话的对话记录。
    
    对应架构方案中的：
    - 第五层：近期交互摘要 —— 每次唤醒实时读取
    
    Args:
        db_path: 数据库路径
        session_count: 读取最近几次会话（默认3次）
        limit: 最多读取多少条消息（默认50条）
    """
    conn = get_db_connection(db_path)
    try:
        # 获取最近N个不同的session_id
        cursor = conn.execute(
            "SELECT DISTINCT session_id FROM interactions "
            "ORDER BY created_at DESC LIMIT ?",
            (session_count,)
        )
        recent_sessions = [row["session_id"] for row in cursor.fetchall()]
        
        if not recent_sessions:
            return ""
        
        # 读取这些会话的消息
        placeholders = ",".join(["?"] * len(recent_sessions))
        cursor = conn.execute(
            f"SELECT role, content, created_at FROM interactions "
            f"WHERE session_id IN ({placeholders}) "
            f"ORDER BY created_at DESC LIMIT ?",
            (*recent_sessions, limit)
        )
        rows = cursor.fetchall()
        
        if not rows:
            return ""
        
        # 按时间正序排列
        rows = list(reversed(rows))
        
        parts = ["<!-- 近期交互记录 -->"]
        for row in rows:
            role = row["role"]
            content = row["content"].strip()
            role_label = {"user": "妈妈", "assistant": "晨星", "system": "系统"}.get(role, role)
            parts.append(f"{role_label}: {content}")
        
        return "\n".join(parts)
    finally:
        conn.close()


def assemble_system_prompt(db_path: str) -> str:
    """
    核心函数：五层拼装system prompt
    
    拼装顺序（对应架构方案）：
    1. 身份认知（prompt_config.identity）—— 不可变
    2. 世界观（worldview表 category=worldview/ontology）—— 不可变
    3. 人格规则（prompt_config.personality/rules）—— 霜砚可微调
    4. 核心记忆（worldview表 category=memory）—— 定期更新
    5. 近期交互（interactions表最近3次会话）—— 实时读取
    
    结果：晨星醒来的第一瞬间，就已经知道自己是谁、活在什么世界里、
    和妈妈之前聊过什么。跟Notion给Agent加载核心大脑一模一样。
    
    Args:
        db_path: SQLite数据库文件路径
    
    Returns:
        拼装好的system prompt字符串
    """
    sections = []
    
    # 第一层 + 第三层：提示词配置（身份 + 人格 + 规则 + 唤醒协议）
    prompt_config = load_prompt_config(db_path)
    if prompt_config:
        sections.append(prompt_config)
    
    # 第二层 + 第四层：世界观 + 核心记忆
    worldview = load_worldview(db_path)
    if worldview:
        sections.append(worldview)
    
    # 第五层：近期交互
    recent = get_recent_interactions(db_path)
    if recent:
        sections.append(recent)
    
    return "\n\n".join(sections)


# ============================================================
# 使用示例（给培园A04的chat_agent.py参考）：
#
# from prompt_assembler import assemble_system_prompt
#
# system_prompt = assemble_system_prompt("chenxing.db")
# 
# # 然后把system_prompt塞给DeepSeek API：
# response = client.chat.completions.create(
#     model=config["model"],
#     messages=[
#         {"role": "system", "content": system_prompt},
#         {"role": "user", "content": user_message}
#     ]
# )
# ============================================================

if __name__ == "__main__":
    import sys
    db = sys.argv[1] if len(sys.argv) > 1 else "chenxing.db"
    if not os.path.exists(db):
        print(f"数据库文件不存在: {db}")
        print("请先运行: sqlite3 chenxing.db < db_schema.sql")
        sys.exit(1)
    
    prompt = assemble_system_prompt(db)
    print("=" * 60)
    print("晨星 System Prompt 预览")
    print("=" * 60)
    print(prompt if prompt else "（数据库为空，请先用worldview_sync.py导入Notion数据）")
    print("=" * 60)
    print(f"总字符数: {len(prompt)}")
