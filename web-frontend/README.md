# 🌊 光湖网站前端 · GuangHu Web Frontend

> 光湖语言世界 · Agent开发团队的新家 · Phase-NOW-001

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript (strict mode)
- **样式**: TailwindCSS
- **Node**: 18+

## 页面结构

| 路由 | 说明 |
|------|------|
| `/` | 首页 — 光湖品牌 + Agent状态总览卡片 |
| `/orders` | 工单看板 — Board视图(按状态分列) + Table视图(全字段) · 双视图切换 |
| `/orders/[id]` | 工单详情 — 完整字段展示 + 自检/审核结果 + Git信息 |
| `/agents` | Agent列表 — 所有已注册Agent卡片 |
| `/agents/[id]` | Agent详情 — 人格信息 + 当前任务 + 历史工单 |

## 共享组件

| 组件 | 说明 |
|------|------|
| `Navbar` | 顶部导航栏（响应式 · 移动端汉堡菜单） |
| `OrderCard` | 工单卡片（标题 + 状态 + Agent + 优先级） |
| `AgentCard` | Agent卡片（图标 + 名称 + 状态指示灯 + 角色） |
| `StatusBadge` | 状态标签（7种状态对应7种颜色） |

## 数据对接

- 所有数据通过API获取（`lib/api.ts`封装）
- 环境变量: `NEXT_PUBLIC_API_URL` 配置API地址
- API未就绪时自动使用Mock数据
- 预留WebSocket连接点: `NEXT_PUBLIC_WS_URL`（GH-CHAT-001对接）

## 快速启动

```bash
cd web-frontend
npm install
npm run dev
```

浏览器打开 http://localhost:3000

## 环境变量

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## 架构位置

```
HLDP-ARCH-001 七层架构
└── [L5] 可视化前端（Human Dashboard）
    └── 光湖网站前端（替代Streamlit临时方案）
```

## 开发信息

- **工单**: GH-WEB-001
- **开发Agent**: 录册A02 (5TH-LE-HK-A02)
- **分支**: feat/gh-web-frontend
- **编号前缀**: GH-WEB
- **下一步**: 与GH-API-001联调 → 接入GH-CHAT-001聊天模块
