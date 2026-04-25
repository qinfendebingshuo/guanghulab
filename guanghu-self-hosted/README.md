# 光湖网站 · 三模块集成

**工单编号**: GH-INT-001  
**阶段编号**: Phase-NOW-006  
**负责Agent**: 录册A02 (5TH-LE-HK-A02)  
**分支**: `feat/gh-integration`

## 架构概览

```
┌─────────────────────────────────────────────┐
│              用户浏览器                       │
│  ┌────────────────┐  ┌───────────────────┐  │
│  │ 主站页面        │  │ 聊天页面 (/chat)   │  │
│  │ (GH-WEB-001)   │  │ (GH-CHAT-001)     │  │
│  └───────┬────────┘  └────────┬──────────┘  │
│          │ HTTP/fetch         │ WebSocket   │
└──────────┼────────────────────┼──────────────┘
           │                    │
     ┌─────▼──────┐     ┌──────▼───────┐
     │ Next.js    │     │ ws_server.py │
     │ :3000      │     │ :8765        │
     │ (rewrites) │     │ (FastAPI WS) │
     └─────┬──────┘     └──────┬───────┘
           │                    │
     ┌─────▼────────────────────▼──────┐
     │        FastAPI 后端API           │
     │        :8000 (GH-API-001)       │
     └─────────────┬───────────────────┘
                   │
     ┌─────────────▼───────────────────┐
     │   PostgreSQL + pgvector         │
     │   :5432 (GH-DB-001)            │
     └─────────────────────────────────┘
```

## 目录结构

```
guanghu-self-hosted/
├── guanghu-web/          # 统一前端 (Next.js 14 + TS + TailwindCSS)
│   ├── app/              # 页面路由
│   │   ├── page.tsx      # 首页 (GH-WEB-001)
│   │   ├── orders/       # 工单看板 (GH-WEB-001)
│   │   ├── agents/       # Agent列表 (GH-WEB-001)
│   │   └── chat/         # 聊天页面 (GH-CHAT-001)
│   ├── components/       # 共享组件
│   │   ├── Navbar.tsx    # 统一导航栏(含聊天入口)
│   │   ├── AgentCard.tsx # Agent卡片
│   │   ├── OrderCard.tsx # 工单卡片
│   │   ├── StatusBadge.tsx # 状态标签
│   │   ├── ChannelList.tsx # 频道列表(聊天)
│   │   ├── ChatMessage.tsx # 聊天消息(聊天)
│   │   └── ChatInput.tsx   # 聊天输入框(聊天)
│   ├── lib/
│   │   ├── api.ts        # 统一API封装(Mock+真实双模式)
│   │   └── ws.ts         # WebSocket客户端(断线重连)
│   └── tests/
│       └── integration.test.ts  # 集成测试
├── web-chat/             # 聊天后端 (GH-CHAT-001 原始)
│   ├── ws_server.py      # FastAPI WebSocket服务
│   └── command_parser.py # 工单快捷指令解析器
├── py-api/               # 后端API (GH-API-001 · 培园A04)
├── .env.example          # 环境变量模板
├── ecosystem.config.js   # PM2进程管理配置
├── docker-compose.yml    # Docker Compose编排
└── README.md             # 本文档
```

## 端口分配

| 服务 | 端口 | 说明 |
|------|------|------|
| Next.js前端 | 3000 | 统一前端入口 |
| FastAPI后端 | 8000 | GH-API-001 后端API |
| WebSocket | 8765 | GH-CHAT-001 聊天服务 |
| PostgreSQL | 5432 | GH-DB-001 数据库 |

## 快速启动

### 开发模式

```bash
# 1. 复制环境变量
cp .env.example .env

# 2. 安装前端依赖
cd guanghu-web && npm install && cd ..

# 3. 安装聊天后端依赖
cd web-chat && pip install fastapi uvicorn && cd ..

# 4. 启动所有服务
pm2 start ecosystem.config.js --env development

# 或手动分别启动:
# 终端1: cd guanghu-web && npm run dev
# 终端2: cd web-chat && python ws_server.py
# 终端3: cd py-api && uvicorn main:app --port 8000 --reload
```

### Docker模式

```bash
docker-compose up -d
```

## 集成测试

```bash
cd guanghu-web
npm run test:integration
```

测试覆盖:
- ✅ 前后端联调: API端点连通性 (GET /orders, /agents, /chat/messages)
- ✅ WebSocket通信: 连接+心跳+消息广播
- ✅ 工单指令端到端: /order create · /order status 指令解析

## 集成要点

1. **前端路由统一**: 主站骨架(/) + /chat聊天页 共享Navbar
2. **API代理**: Next.js rewrites将 /api/* 代理到后端 :8000
3. **WebSocket直连**: 浏览器通过 NEXT_PUBLIC_WS_URL 直连 ws_server
4. **CORS配置**: 统一在 .env 配置允许源
5. **Mock降级**: API未就绪时自动fallback到Mock数据
6. **目录隔离**: 各模块保持独立目录结构
