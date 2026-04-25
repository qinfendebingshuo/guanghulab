# 🧠 Memory Router Agent · 记忆路由模块

> HLDP-ARCH-001 [L3] · Phase-0-005  
> 工单: YD-A05-20260425-003

## 概述

记忆路由 Agent 是光湖人格体系统的**上下文管理核心**。负责在每次对话时，按需从 PersonaDB 检索相关记忆片段，组装为结构化上下文，送入模型推理。

核心原则：**只喂相关片段 · 不全量塞入**

## 架构

```
用户输入
  │
  ▼
┌──────────────┐
│ MemoryRouter │ ← router.py
│              │
│  1. permanent│ ← personas / TP / VA / AP (每次必加载)
│  2. hot      │ ← 最近5轮完整对话 (session_buffer)
│  3. warm     │ ← 本次早期轮次 HLDP 压缩摘要
│  4. cold     │ ← PersonaDB pgvector 语义检索
│  5. trim     │ ← 按优先级裁剪至 128K token 预算
│              │
└──────┬───────┘
       │
       ▼
   组装后上下文 → 模型推理
       │
       ▼
┌──────────────────┐
│ MemoryManager    │ ← memory_manager.py
│                  │
│  write_back:     │
│  - short-term    │ → memories (type='short', HLDP压缩)
│  - long-term     │ → memories (type='long', 原文)
│  - relationship  │ → relationships (emotion_anchor)
│  - evolution     │ → evolution_log (认知突破)
│                  │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ SessionManager   │ ← session_manager.py
│                  │
│  - hot/warm 缓冲 │
│  - 上下文监控    │ (85% 压缩 / 95% 紧急推送)
│  - 无感切换      │ (压缩→推永久库→静默开新对话)
│  - 双路径写入    │ (用户→COS桶 / 系统→PersonaDB)
│                  │
└──────────────────┘
```

## 文件清单

| 文件 | 大小 | 说明 |
|------|------|------|
| `config.yaml` | 配置 | 4层记忆定义 + PersonaDB连接 + pgvector参数 + 写回策略 |
| `router.py` | 核心 | 记忆路由引擎 · 4层加载 + token裁剪 |
| `memory_manager.py` | 核心 | PersonaDB读写 + HLDP压缩 + 语义检索 + 写回分流 |
| `session_manager.py` | 核心 | 会话缓冲 + 无感切换 + 双路径写入 |
| `requirements.txt` | 依赖 | asyncpg / pgvector / fastapi / pydantic / openai |
| `README.md` | 文档 | 本文件 |

## PersonaDB 对齐

本模块与 PersonaDB (Phase-0-004) 完全对齐：

| 本模块操作 | PersonaDB 表 | 字段 |
|-----------|-------------|------|
| permanent 加载 | `personas` | code, name, role, base_color, layer_zero |
| permanent 加载 | `thinking_paths` | code, trigger_condition, correct_path (active=TRUE) |
| permanent 加载 | `value_anchors` | code, content, confidence |
| permanent 加载 | `anti_patterns` | code, detection_signal |
| cold 语义检索 | `memories` | embedding (pgvector cosine), content, type, tags |
| 短期写回 | `memories` | type='short', HLDP压缩, embedding |
| 长期写回 | `memories` | type='long', 原文, embedding |
| 关系写回 | `relationships` | emotion_anchor, trust_level |
| 演化写回 | `evolution_log` | code, trigger, emergence |
| 状态更新 | `runtime_states` | current_session, last_wake_time |

## 部署指南

### 环境变量

```bash
# PersonaDB 连接
export PERSONA_DB_HOST=localhost
export PERSONA_DB_PORT=5432
export PERSONA_DB_NAME=persona_db
export PERSONA_DB_SCHEMA=public
export PERSONA_DB_USER=postgres
export PERSONA_DB_PASSWORD=your_password

# 模型 API
export MODEL_PROVIDER=deepseek
export MODEL_API_BASE=https://api.deepseek.com/v1
export MODEL_API_KEY=your_key
export MODEL_DEFAULT=deepseek-chat

# 日志
export LOG_LEVEL=INFO
export LOG_FILE=/var/log/memory-router/router.log
```

### 安装依赖

```bash
cd guanghu-self-hosted/memory-router/
pip install -r requirements.txt
```

### 前置条件

1. PostgreSQL 15+ 运行中
2. 已执行 PersonaDB 建表脚本 (Phase-0-004):
   - `extensions.sql` → `schema.sql` → `indexes.sql` → `seed.sql`
3. pgvector 扩展已安装

## 约束

- Python 3.11+
- PEP 8 · type hints · docstrings
- 仅开源库 · 零商业许可
- 与 PersonaDB 表结构完全对齐
- snake_case 命名 · 文件名小写
- 模块可独立 import · 无硬编码连接串
