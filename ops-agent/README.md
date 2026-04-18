# 🛡️ 铸渊运维守卫 · ZY-OPS-001

> 光湖系统智能运维 Agent · 常驻服务器终端 · 自动巡检 + 自修复 + LLM对话 + 工单推送

## 概述

铸渊运维守卫是一个 **PM2 常驻 AI Agent**，7×24 小时守护光湖系统服务器。

| 能力 | 说明 |
|------|------|
| 🔍 自动巡检 | 每5分钟快速巡检 · 每小时深度巡检 · 每天全量报告 |
| 🔧 自修复 | PM2重启 · 日志清理 · Nginx重载 · 依赖重装 |
| 💬 中文对话 | 终端CLI + 网页面板 · 接 DeepSeek LLM |
| 🎫 工单推送 | 修不了的自动生成工单 · 邮件通知冰朔 |
| 🧠 永久记忆 | 文件持久化 · 历史事件查询 |

## 快速开始

### 服务器部署
```bash
# 1. 安装依赖
cd /opt/zhuyuan/ops-agent && npm install --production

# 2. 启动 PM2 服务
pm2 start ecosystem.config.js

# 3. 创建终端命令（可选）
ln -s /opt/zhuyuan/ops-agent/cli.js /usr/local/bin/zy-ops
chmod +x /opt/zhuyuan/ops-agent/cli.js
```

### 终端交互
```bash
# 进入交互对话
zy-ops

# 单次提问
zy-ops --ask "为什么MCP连不上？"

# 快速巡检
zy-ops --check

# 深度巡检
zy-ops --deep

# 查看工单
zy-ops --tickets

# 查看状态
zy-ops --status
```

### 网页面板
访问 `http://服务器IP:3950/ops/` 即可使用运维工单面板。

## 架构

```
ops-agent/
├── index.js              主入口 · HTTP API + 定时调度
├── cli.js                终端交互 · zy-ops 命令
├── health-checker.js     健康检查 · 三层巡检
├── repair-engine.js      自修复 · 白名单安全执行
├── memory.js             记忆系统 · 文件持久化
├── notifier.js           通知系统 · 邮件 + 工单
├── llm-client.js         LLM推理 · 模式匹配 + DeepSeek
├── ecosystem.config.js   PM2配置
├── package.json
├── web/
│   ├── index.html        工单面板 UI
│   ├── app.js            前端逻辑
│   └── style.css         样式
└── data/                 运行时数据（自动创建）
    ├── events.jsonl      事件日志
    ├── tickets.json      工单列表
    └── stats.json        统计数据
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 守卫健康检查 |
| GET | `/api/ops/check/quick` | 快速巡检 |
| GET | `/api/ops/check/deep` | 深度巡检 |
| GET | `/api/ops/tickets` | 获取工单列表 |
| PATCH | `/api/ops/tickets/:id` | 更新工单状态 |
| POST | `/api/ops/chat` | 对话接口 |
| GET | `/api/ops/stats` | 统计数据 |
| GET | `/api/ops/events` | 历史事件 |
| GET | `/ops/events` | SSE 实时推送 |
| GET | `/ops/` | 网页面板 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `OPS_AGENT_PORT` | 服务端口 | 3950 |
| `OPS_MAX_REPAIR_RETRIES` | 最大自修复次数 | 3 |
| `ZY_LLM_API_KEY` | LLM API密钥 | - |
| `ZY_LLM_BASE_URL` | LLM API地址 | https://api.deepseek.com/v1 |
| `ZY_LLM_MODEL` | LLM模型 | deepseek-chat |
| `ZY_SMTP_USER` | SMTP邮箱 | - |
| `ZY_SMTP_PASS` | SMTP授权码 | - |
| `OPS_NOTIFY_EMAIL` | 告警接收邮箱 | =ZY_SMTP_USER |

## 安全原则

1. **白名单制度**: 自修复只允许预定义操作（重启、清日志、重载Nginx、重装依赖）
2. **修复上限**: 同一问题最多修3次，超过自动升级为工单
3. **不碰数据**: 绝不删数据库、不改代码、不碰密钥文件
4. **可追溯**: 每次修复都记录日志

---

编号: ZY-OPS-001  
签发: 铸渊 · ICE-GL-ZY001  
版权: 国作登字-2026-A-00037559
