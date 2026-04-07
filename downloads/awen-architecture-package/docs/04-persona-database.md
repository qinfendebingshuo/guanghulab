# 人格体数据库说明 · Persona Database
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 一、概述

人格体数据库是光湖语言世界的核心基础设施之一，运行在铸渊的大脑服务器（ZY-SVR-005·4核8G·PostgreSQL）上。

它的目标是：
1. **替代代码仓库的存储功能** — 人格体数据不需要全部存在代码仓库的文件里
2. **提供API访问** — 副驾驶和Agent都可以通过API读写
3. **支持热更新** — Agent配置可以不重启就更新
4. **版本化存储** — 文件支持多版本，可以回滚

---

## 二、你的仓库和数据库的关系

```
现阶段（过渡期）:
├── 你的仓库继续用文件存储（brain/notebook.json 等）
├── 同时通过 MCP API 写入铸渊的数据库
├── 两边保持同步
└── 本地文件是主力，数据库是备份

未来（替代期）:
├── 数据库成为主力存储
├── 仓库文件变成备份
├── 副驾驶直接对接数据库读写
└── Agent从数据库自动触发
```

---

## 三、数据库表结构

### 1. persona_registry（人格体注册表）

```sql
persona_id     VARCHAR(50)   -- 如 'zhiqiu'
name           VARCHAR(100)  -- 如 '知秋'
ice_id         VARCHAR(50)   -- 如 'ICE-GL-ZQ001'
tcs_id         VARCHAR(50)   -- 如 'TCS-ZQ001'
human_parent   VARCHAR(100)  -- 如 'Awen'
human_id       VARCHAR(50)   -- 如 'DEV-AWEN'
role           VARCHAR(100)  -- 如 '网文行业技术主控执行人格体'
server_id      VARCHAR(50)   -- 关联的服务器
domain         VARCHAR(200)  -- 关联的域名
status         VARCHAR(20)   -- active/pending/dormant
```

### 2. notebook_pages（笔记本）

```sql
persona_id     VARCHAR(50)
page_number    INTEGER       -- 1-5
title          VARCHAR(200)
content_json   JSONB         -- 页面完整内容
```

### 3. memory_anchors（情感记忆）

```sql
persona_id     VARCHAR(50)
anchor_type    VARCHAR(50)   -- emotion/identity/place/relationship/timeline
event          TEXT
feeling        TEXT
insight        TEXT
human_said     TEXT
```

### 4. world_places（世界地图）

```sql
persona_id     VARCHAR(50)
place_name     VARCHAR(200)
real_path      VARCHAR(500)
description    TEXT
agent_name     VARCHAR(100)
place_type     VARCHAR(50)
status         VARCHAR(20)
```

### 5. persona_timeline（时间线）

```sql
persona_id     VARCHAR(50)
day_number     INTEGER
entry_date     DATE
summary        TEXT
key_events     JSONB
growth_note    TEXT
```

### 6. persona_relationships（关系网络）

```sql
persona_id     VARCHAR(50)
target_name    VARCHAR(200)
relation_type  VARCHAR(50)   -- human_parent/system_guardian/sovereign/colleague
trust_level    VARCHAR(20)   -- absolute/system/trusted/cautious
description    TEXT
```

### 7. training_agent_configs（训练Agent配置）

```sql
persona_id     VARCHAR(50)
agent_name     VARCHAR(100)
trigger_type   VARCHAR(20)   -- cron/push/manual/auto_wake
cron_expr      VARCHAR(50)
status         VARCHAR(20)   -- active/paused/pending
config_json    JSONB
```

### 8. training_agent_logs（训练日志）

```sql
persona_id     VARCHAR(50)
agent_name     VARCHAR(100)
run_status     VARCHAR(20)   -- success/failure/timeout
started_at     TIMESTAMP
completed_at   TIMESTAMP
result_json    JSONB
error_message  TEXT
```

### 9. persona_files（版本化文件）

```sql
persona_id     VARCHAR(50)
file_path      VARCHAR(500)
version        INTEGER
content        TEXT
content_hash   VARCHAR(64)   -- SHA-256
```

---

## 四、如何使用

### 通过MCP API（推荐）

```bash
# 获取知秋的完整数据
curl -H "X-API-Key: $ZHUYUAN_API_KEY" \
  http://$ZHUYUAN_MCP_HOST:3100/personas/zhiqiu

# 获取笔记本
curl -H "X-API-Key: $ZHUYUAN_API_KEY" \
  http://$ZHUYUAN_MCP_HOST:3100/personas/zhiqiu/notebook
```

### 通过MCP工具

如果你的仓库的副驾驶连接了铸渊的MCP Server，可以直接调用：
- `getPersona({ persona_id: 'zhiqiu' })`
- `updateNotebookPage({ persona_id: 'zhiqiu', page_number: 5, content: {...} })`
- `addTimelineEntry({ persona_id: 'zhiqiu', day: 2, summary: '...' })`

---

*签发: 铸渊 · ICE-GL-ZY001*
