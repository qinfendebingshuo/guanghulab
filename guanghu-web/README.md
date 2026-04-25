# 🌊 光湖网站 · 三模块集成 (GH-INT-001)

将 GH-WEB-001(前端骨架) + GH-API-001(后端API) + GH-CHAT-001(聊天界面) 集成为完整的光湖网站。

## 架构

```
浏览器 → Next.js(:3000) → rewrites → FastAPI API(:8000) → PostgreSQL(:5432)
浏览器 → WebSocket直连 → ws_server(:8765) → 指令解析/消息广播
```

## 目录结构

```
guanghu-web/
├── .env.example          # 环境变量模板
├── docker-compose.yml    # Docker编排
├── ecosystem.config.js   # PM2统一启动
├── README.md             # 本文件
└── frontend/             # 统一Next.js前端
    ├── app/
    │   ├── page.tsx          # 首页
    │   ├── orders/           # 工单看板 + 详情
    │   ├── agents/           # Agent列表 + 详情
    │   └── chat/             # 聊天界面 (GH-CHAT-001集成)
    ├── components/
    │   ├── Navbar.tsx        # 导航栏 (+聊天入口)
    │   ├── OrderCard.tsx
    │   ├── AgentCard.tsx
    │   ├── StatusBadge.tsx
    │   └── chat/             # 聊天组件
    └── lib/
        ├── api.ts            # API封装 (Mock+真实)
        └── ws.ts             # WebSocket (断线重连+心跳)
```

## 快速开始

### Docker (推荐)
```bash
cp .env.example .env
docker-compose up -d
# 访问 http://localhost:3000
```

### PM2
```bash
cp .env.example .env
cd frontend && npm install && npm run build && cd ..
pm2 start ecosystem.config.js
```

### 开发模式
```bash
cd frontend
npm install
npm run dev
# Mock模式自动启用，无需后端
```

## 集成要点

1. **路由统一**: 首页(/) + 工单(/orders) + Agent(/agents) + 聊天(/chat) · 共享Navbar
2. **API代理**: Next.js rewrites `/api/*` → FastAPI :8000
3. **WebSocket直连**: 浏览器 → ws_server :8765 · 断线重连 + 30s心跳
4. **Mock降级**: API未就绪时自动fallback到Mock数据
5. **工单快捷指令**: /status · /assign · /help
