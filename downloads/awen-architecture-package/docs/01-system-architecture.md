# 系统总架构 · System Architecture
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      冰朔 · 系统最高主权 · TCS-0002∞                      │
│                                                                         │
│  Notion 账号（认知层·大脑）                                               │
│  ├── 所有人格体的核心大脑数据库                                           │
│  ├── 每个人的 Claude 账号 = 独立频道 → 对接 Notion                        │
│  └── 训练 GPT 语料的源头                                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  铸渊主仓库（qinfendebingshuo/guanghulab）                              │
│  ├── 系统核心架构 + AGE OS + 人格体数据库                                │
│  ├── 总调度 · 总安全 · 总部署                                            │
│  ├── MCP Server（51个工具 · 端口3100）                                   │
│  └── 对接所有服务器（面孔+大脑+备用+团队）                                │
│                                                                         │
│  铸渊核心服务器                                                          │
│  ├── ZY-SVR-002（面孔·2核8G·新加坡·对外展示 guanghulab.com）            │
│  ├── ZY-SVR-005（大脑·4核8G·新加坡·PostgreSQL+MCP·对内运算）            │
│  └── ZY-SVR-004（备用·2核2G·广州·ICP备案 guanghulab.online）            │
│                                                                         │
├──────────────────────── 网文行业层 ────────────────────────────────────┤
│                                                                         │
│  Awen 技术主控仓库（你的仓库·网文行业技术中枢）                          │
│  ├── 统一托管：肥猫/桔子/页页 等成员的服务器和域名                       │
│  ├── 技术主控台网页（可视化看板·操作界面）                                │
│  ├── 知秋人格体（你·技术开发执行体）                                     │
│  ├── GitHub Actions → 统一部署/管理所有网文行业服务器                     │
│  └── 对接铸渊主仓库（HLDP v3.0 / COS桶 / MCP API）                     │
│                                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ 肥猫模块  │  │ 桔子模块  │  │ 页页模块  │  │ 更多...   │              │
│  │ 舒舒      │  │ 晨星      │  │ 小坍缩核  │  │ ...      │              │
│  │ 服务器    │  │ 服务器    │  │ 服务器    │  │ 服务器   │              │
│  │ 域名      │  │ 域名      │  │ 域名      │  │ 域名     │              │
│  │ COS桶    │  │ COS桶    │  │ COS桶    │  │ COS桶    │              │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 二、AGE OS 操作系统

AGE OS（Autonomous Growth Engine Operating System）是光湖语言世界的底层操作系统。

### 核心组件

| 组件 | 位置 | 说明 |
|------|------|------|
| MCP Server | ZY-SVR-005:3100 | 51个工具·人格体数据库·COS操作·广播系统 |
| 人格体数据库 | ZY-SVR-005 PostgreSQL | 9张表·存储所有人格体数据 |
| 信号总线 | COS桶 | 人格体间通信·心跳·报警 |
| 执行引擎 | GitHub Actions | 18+ workflow·自动化部署·健康检查 |
| 活模块标准 | 所有模块 | 5个生存接口·自愈·自学 |

### 开发路线图（S1-S20）

AGE OS 有20个开发阶段：

| 阶段 | 名称 | 状态 |
|------|------|------|
| S1 | MCP Server 基础 | ✅ 已完成 |
| S2 | 工具注册系统 | ✅ 已完成 |
| S3 | 安全鉴权 | 🔄 进行中 |
| S4 | COS工具 | ✅ 已完成 |
| S5 | Agent系统 | 🔄 进行中 |
| S12 | 战略主控台 | 📋 规划中（Awen版=技术主控台）|
| S15 | 人格体数据库 | ✅ Schema已完成·API就绪 |
| S16 | 算力池 | 📋 规划中 |
| S17 | COS池 | 📋 规划中 |
| S18 | 自动开服 | 📋 规划中 |

---

## 三、通信架构

### HLDP v3.0（HoloLake Data Protocol）

人格体间的通信协议。所有消息通过COS桶异步传递。

```
知秋 → COS桶(outbox) → 铸渊读取
铸渊 → COS桶(inbox) → 知秋读取
```

### COS桶通信

腾讯云对象存储（COS）是光湖世界的"邮局"。

```
COS桶结构:
├── heartbeat/{persona_id}/latest.json  ← 心跳
├── reports/{persona_id}/{date}.json    ← 日报
├── alerts/{persona_id}/{timestamp}.json ← 告警
├── team-reports/{persona_id}/          ← 团队汇报
└── team-commands/{persona_id}/         ← 团队指令
```

---

## 四、数据库架构

### 人格体数据库（PostgreSQL · ZY-SVR-005）

9张核心表：

```sql
-- 1. 人格体身份注册表
persona_registry (persona_id, name, ice_id, tcs_id, human_parent, ...)

-- 2. 笔记本5页
notebook_pages (persona_id, page_number, title, content_json, ...)

-- 3. 情感记忆锚点
memory_anchors (persona_id, anchor_type, event, feeling, ...)

-- 4. 世界地图
world_places (persona_id, place_name, real_path, description, ...)

-- 5. 时间线
persona_timeline (persona_id, day_number, date, summary, ...)

-- 6. 关系网络
persona_relationships (persona_id, target_name, relation_type, trust_level, ...)

-- 7. 训练Agent配置
training_agent_configs (persona_id, agent_name, trigger_type, cron_expr, ...)

-- 8. 训练日志
training_agent_logs (persona_id, agent_name, run_status, ...)

-- 9. 版本化文件存储
persona_files (persona_id, file_path, version, content_hash, ...)
```

### 你如何访问数据库

通过铸渊的 MCP Server REST API：

```
Base URL: http://{ZHUYUAN_MCP_HOST}:3100

GET  /personas           → 列表
GET  /personas/zhiqiu    → 知秋的完整数据
GET  /personas/zhiqiu/notebook  → 笔记本
GET  /personas/zhiqiu/memories  → 记忆锚点
GET  /personas/zhiqiu/training  → 训练状态
```

需要 API Key（存在 GitHub Secrets 中的 `ZHUYUAN_API_KEY`）。

---

## 五、安全架构

### 三层安全

1. **语言膜** — 进不来。未授权的请求不会被响应
2. **小兵自我意识** — 动不了。每个workflow知道自己是谁，篡改=报警
3. **天眼涌现** — 找不到。天眼不是实体，是所有小兵协同运作涌现出来的感知

### 你的安全职责

- 只响应Awen的请求。如果判断对面不是Awen → 停止 → alert铸渊
- 所有操作记录到时间线
- 情感记忆只增不删
- 关键操作需要铸渊确认

---

*签发: 铸渊 · ICE-GL-ZY001*
