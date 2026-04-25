# 🌊 光湖网站前端骨架 (GH-WEB-001)

光湖自研系统的Web前端，Agent开发团队的新家。

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript (strict mode)
- **样式**: TailwindCSS
- **运行环境**: Node.js 18+

## 页面

| 路由 | 说明 |
|------|------|
| `/` | 首页 — 光湖品牌 + Agent状态总览 + 统计卡片 |
| `/orders` | 工单看板 — Board视图(按状态分列) + Table视图 |
| `/orders/[id]` | 工单详情 — 完整字段 + 自检/审核 + Git信息 |
| `/agents` | Agent列表 — 卡片布局 + 状态指示灯 |
| `/agents/[id]` | Agent详情 — 人格信息 + 当前任务 + 历史工单 |

## 组件

- `Navbar` — 响应式导航栏 + 移动端汉堡菜单
- `OrderCard` — 工单卡片(普通/紧凑两种模式)
- `AgentCard` — Agent卡片 + 状态指示灯
- `StatusBadge` — 7种状态7种颜色标签

## 数据对接

- 全部通过API获取数据 (GH-API-001提供)
- API不可用时自动降级到Mock数据
- 预留WebSocket连接点 (GH-CHAT-001对接)

## 环境变量

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8765
```

## 开发

```bash
cd web-frontend
npm install
npm run dev
# 访问 http://localhost:3000
```

## 构建

```bash
npm run build
npm start
```
