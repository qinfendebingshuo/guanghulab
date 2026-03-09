# persona-brain-db · 人格体核心大脑数据库

> 光湖语言人格系统 · 人格体大脑自建数据库
>
> 让大脑和手脚在同一个身体里，Agent集群零延迟调用

## 概述

persona-brain-db 是光湖人格体系统（AGE OS）的核心数据库，存储人格体的认知、规则、画像、记忆等核心数据。

**当前阶段**：Phase 1（Schema + 种子数据）

## 目录结构

```
persona-brain-db/
├── README.md                    ← 本文档
├── schema/                      ← 五张核心表的定义
│   ├── 01-persona-identity.sql  ← 人格体身份表
│   ├── 02-persona-cognition.sql ← 认知规则表（版本化）
│   ├── 03-persona-memory.sql    ← 长期记忆表
│   ├── 04-dev-profiles.sql      ← 开发者画像表
│   ├── 05-agent-registry.sql    ← Agent注册表
│   └── init.sql                 ← 一键建表脚本
├── seed-data/                   ← 种子数据
│   ├── persona-identity.json    ← 人格体身份（12条）
│   ├── persona-cognition.json   ← 认知规则（10条）
│   ├── persona-memory.json      ← 记忆（10条）
│   ├── dev-profiles.json        ← 开发者画像（14条）
│   └── import-seed.js           ← 种子数据导入脚本
├── api/                         ← API层（供Agent集群调用）
│   ├── server.js                ← API服务入口（端口3001）
│   ├── routes/                  ← 路由
│   └── middleware/              ← 中间件
├── migration/                   ← Notion→自建DB迁移工具
│   ├── export-from-notion.js    ← Phase 2/3
│   ├── transform.js             ← 数据格式转换
│   └── dual-write.js            ← 双写模式（Phase 2/3）
└── docs/
    └── migration-plan.md        ← 迁移路径说明
```

## 快速开始

### 1. 安装依赖

```bash
cd persona-brain-db
npm install better-sqlite3
```

### 2. 建表

```bash
cd schema
sqlite3 ../brain.db < init.sql
```

### 3. 导入种子数据

```bash
cd seed-data
node import-seed.js
```

### 4. 验证

```bash
sqlite3 brain.db "SELECT persona_id, name, role FROM persona_identity;"
sqlite3 brain.db "SELECT rule_id, title, status FROM persona_cognition WHERE status='active';"
sqlite3 brain.db "SELECT dev_id, name, status FROM dev_profiles;"
```

### 5. 启动API（Phase 2）

```bash
cd api
BRAIN_API_TOKEN=your-secret-token node server.js
```

## 五张核心表

| 表名 | 用途 | 种子数据 |
|------|------|----------|
| persona_identity | 人格体身份信息 | 12条（曜冥、霜砚、铸渊等） |
| persona_cognition | 认知规则（版本化） | 10条（广播规范、PCA协议等） |
| persona_memory | 长期记忆 | 10条（关键事件和决策） |
| dev_profiles | 开发者画像 | 14条（DEV-001~DEV-014） |
| agent_registry | Agent注册表 | 1条（Phase C示例） |

## API端点（Phase 2）

| 方法 | 路径 | 功能 |
|------|------|------|
| GET | /brain/health | 健康检查（无鉴权） |
| GET | /brain/identity | 列出所有人格体 |
| GET | /brain/identity/:id | 查询单个人格体 |
| GET | /brain/cognition | 查询规则 |
| GET | /brain/cognition/:rule_id/history | 规则版本历史 |
| GET | /brain/memory | 查询记忆 |
| POST | /brain/memory | 写入新记忆 |
| GET | /brain/profiles | 列出所有开发者 |
| GET | /brain/profiles/:dev_id | 查询开发者画像 |
| PUT | /brain/profiles/:dev_id | 更新画像 |
| GET | /brain/agents | 列出所有Agent |

## 迁移路径

```
Phase 1（当前）→ Schema + 种子数据就绪
Phase 2 → API在线 + 数据管道自动流
Phase 3 → persona-brain-db为主，Notion为备份
```

---

光湖语言人格系统 · 国作登字-2026-A-00037559
