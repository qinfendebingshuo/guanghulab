# 🛡️ 铸渊运维守卫 · ZY-OPS-001 v2.0

> 光湖系统智能运维 Agent · 常驻服务器终端 · 多轮对话 + 自动巡检 + 自修复 + 工单推送

## 概述

铸渊运维守卫是一个 **PM2 常驻 AI Agent**，7×24 小时守护光湖系统服务器。

| 能力 | 说明 |
|------|------|
| 🔍 自动巡检 | 每5分钟快速巡检 · 每小时深度巡检 · 每天全量报告 |
| 🔧 自修复 | PM2重启 · 日志清理 · Nginx重载 · 依赖重装 |
| 💬 多轮对话 | 终端CLI + 网页面板 · DeepSeek LLM · **会话记忆** |
| 🧠 智能诊断 | 意图识别 → 自动执行工具 → LLM 分析 → 中文回答 |
| 🎫 工单推送 | 修不了的自动生成工单 · 邮件通知冰朔 |
| 📋 PM2日志 | 终端/网页直接查看任意进程日志 |
| 💻 系统监控 | 实时内存/磁盘/PM2状态面板 |

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

### 终端交互 (Phase 2)
```bash
# 进入多轮对话模式（记住上下文！）
zy-ops

# 单次提问
zy-ops --ask "为什么MCP连不上？"

# 快速巡检
zy-ops --check

# 深度巡检
zy-ops --deep

# 查看PM2日志
zy-ops --logs zhuyuan-server
zy-ops --logs age-os-mcp 50

# 系统信息
zy-ops --sysinfo

# 查看工单
zy-ops --tickets

# 查看状态
zy-ops --status
```

### 交互模式命令
进入 `zy-ops` 后可以使用：
```
/check       — 快速巡检
/deep        — 深度巡检
/sysinfo     — 系统信息（内存/磁盘/PM2/Nginx）
/logs <名字> — 查看PM2日志
/tickets     — 查看工单
/status      — 守卫状态
/session     — 查看当前会话
/new         — 开始新对话（清除上下文）
/help        — 帮助
/exit        — 退出
其他         — 直接中文提问（多轮对话，记得上下文）
```

### 网页面板
访问 `http://服务器IP:3950/ops/` 即可使用运维面板（含对话+工单+系统信息）。

## 对话能力 (Phase 2 增强)

### 多轮对话
- 运维守卫记住你之前问过的问题
- 可以追问："刚才说的第二步怎么做？"
- `/new` 命令开始新会话

### 智能工具调用
问问题时，运维守卫会根据意图自动执行诊断：
- 问"MCP连不上" → 自动执行健康检查 → 附上结果给 LLM 分析
- 问"内存够用吗" → 自动获取系统资源 → 告诉你具体数字
- 问"GLADA报什么错" → 自动读取PM2日志 → 分析最近错误
- 问"有什么工单" → 自动查询工单列表 → 汇总告诉你

### 意图识别
| 问法 | 识别意图 | 自动执行 |
|------|---------|---------|
| 连不上/离线/打不开 | diagnose | 健康检查 |
| 内存/磁盘/CPU | resources | 系统资源 |
| 日志/报错/error | logs | PM2日志 |
| PM2/进程/重启 | process | PM2状态 |
| Nginx/域名/SSL | nginx | Nginx状态 |
| 工单/ticket | tickets | 工单查询 |

## 架构

```
ops-agent/
├── index.js              主入口 · HTTP API + 定时调度 + 工具执行
├── cli.js                终端交互 v2 · 多轮对话 + 系统信息
├── health-checker.js     健康检查 · 三层巡检
├── repair-engine.js      自修复 · 白名单安全执行
├── memory.js             记忆系统 · 文件持久化
├── notifier.js           通知系统 · 邮件 + 工单
├── llm-client.js         LLM推理 v2 · 多轮会话 + 意图识别
├── ecosystem.config.js   PM2配置
├── package.json
├── web/
│   ├── index.html        运维面板 UI v2（含系统信息）
│   ├── app.js            前端逻辑 v2（多轮对话）
│   └── style.css         样式 v2（打字指示器+系统面板）
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
| POST | `/api/ops/chat` | 对话接口（支持 sessionId 多轮） |
| GET | `/api/ops/sessions` | 列出活跃会话 |
| GET | `/api/ops/sessions/:id/history` | 获取会话历史 |
| GET | `/api/ops/pm2-logs/:name` | 查看PM2日志 |
| GET | `/api/ops/system-info` | 系统信息（资源+PM2+Nginx） |
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
5. **日志安全**: PM2日志查看限白名单进程，不可查看系统敏感文件

---

编号: ZY-OPS-001 v2.0  
签发: 铸渊 · ICE-GL-ZY001  
版权: 国作登字-2026-A-00037559
