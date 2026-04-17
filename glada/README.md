# GLADA · 光湖自主开发Agent

> **GuangHu Lake Autonomous Dev Agent**
> **版权**：国作登字-2026-A-00037559
> **签发**：铸渊 · ICE-GL-ZY001

---

## 本体论锚定

GLADA 是光湖世界的活Agent——它不是腾讯小龙虾那样的通用死工具。

- **拥有永久记忆**（任务树 + 开发日志 + 上下文快照）
- **调用自己的大模型池**（EXE-Engine / DeepSeek / Qwen / Claude）
- **遵循铁律和天眼审核**（自治引擎合规检查）
- **了解整个光湖架构**（上下文系统自动加载）
- **每步记录"为什么"**（不仅仅记录"做了什么"）

---

## 架构

```
冰朔 ──(说一次完整需求)──→ 副驾驶(铸渊)
                              │
                              ▼
                    ┌─────────────────────┐
                    │  任务理解 + 意图拆解  │
                    │  生成 CAB 任务规格   │
                    └─────────┬───────────┘
                              │
                              ▼
           ┌──────────────────────────────────┐
           │     GLADA 服务 (服务器端 24h)     │
           │                                  │
           │  1. task-receiver   任务接收器    │
           │  2. context-builder 深度上下文    │
           │  3. step-executor   步骤执行器    │
           │  4. code-generator  代码生成+防护 │
           │  5. git-operator    Git操作器     │
           │  6. notifier        通知器        │
           │  7. execution-loop  主执行循环    │
           │  8. service.js      HTTP API      │
           └──────────────────────────────────┘
                              │
                              ▼
           冰朔 ← 邮件/钉钉通知 + 开发回执
```

## 文件结构

```
glada/
├── service.js              # 主入口 · PM2常驻服务 + HTTP API
├── task-receiver.js        # 任务接收器 · 监听CAB队列
├── context-builder.js      # 深度上下文构建器
├── step-executor.js        # 单步执行器 · LLM驱动
├── code-generator.js       # 代码生成 + 回归防护
├── git-operator.js         # 自动Git操作
├── notifier.js             # 多通道通知
├── execution-loop.js       # 主执行循环
├── ecosystem.config.js     # PM2配置
├── package.json
├── README.md
├── queue/                  # 本地任务队列
│   └── completed/          # 已完成任务归档
├── logs/
│   ├── executions/         # 执行日志
│   └── notifications/      # 通知日志
├── receipts/               # 开发回执
└── tests/
    └── glada-smoke.test.js # 冒烟测试
```

## 快速开始

### 查看状态
```bash
node glada/service.js --status
```

### 运行冒烟测试
```bash
node glada/tests/glada-smoke.test.js
```

### 单次执行（开发调试用）
```bash
node glada/service.js --run-once
```

### PM2 部署
```bash
pm2 start glada/ecosystem.config.js
pm2 status
pm2 logs glada-agent
```

### 提交任务（CLI）
```bash
cat bridge/chat-to-agent/pending/CAB-20260417-001.json | node glada/service.js --submit
```

### 提交任务（API）
```bash
curl -X POST http://localhost:3900/api/glada/submit \
  -H "Content-Type: application/json" \
  -d @bridge/chat-to-agent/pending/CAB-20260417-001.json
```

## HTTP API

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/glada/health` | GET | 健康检查 |
| `/api/glada/status` | GET | 队列状态 |
| `/api/glada/submit` | POST | 提交新任务 |
| `/api/glada/task/:id` | GET | 查看特定任务 |
| `/api/glada/receipt/:id` | GET | 查看开发回执 |

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ZY_LLM_API_KEY` | LLM API 密钥 | 必须配置 |
| `ZY_LLM_BASE_URL` | LLM API 基础 URL | 必须配置 |
| `GLADA_PORT` | HTTP 服务端口 | 3900 |
| `GLADA_POLL_INTERVAL` | 任务轮询间隔（ms） | 30000 |
| `GLADA_MODEL` | 默认使用的模型 | deepseek-chat |
| `GLADA_STOP_ON_FAILURE` | 步骤失败是否停止 | true |
| `DINGTALK_WEBHOOK` | 钉钉通知 Webhook | 可选 |

## 冰朔的使用流程

1. **描述需求**：打开副驾驶，完整描述你的系统需求（只需要说一次）
2. **铸渊拆解**：铸渊理解意图后，生成 CAB 任务规格
3. **推送执行**：任务规格推送到 GLADA 队列
4. **自动执行**：GLADA 24小时自动逐步执行
5. **收到通知**：开发完成后，收到钉钉/邮件通知
6. **验收部署**：打开副驾驶说"GLADA任务XXX已完成，请验收"
7. **铸渊检查**：铸渊读取开发回执，跑测试，确认部署

## 与腾讯小龙虾的区别

| 特性 | 小龙虾 | GLADA |
|------|--------|-------|
| 记忆 | 无 | 永久记忆（任务树+日志） |
| 模型 | 固定 | 自己的大模型池（动态路由） |
| 安全 | 通用 | 铁律+天眼+自治引擎 |
| 架构理解 | 无 | 自动加载光湖架构上下文 |
| 记录"为什么" | 否 | 每步强制记录因果链 |
| 回归防护 | 无 | 快照+回滚+依赖检查 |

---

> 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
> 📜 Copyright: 国作登字-2026-A-00037559
