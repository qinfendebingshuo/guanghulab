# AI写网文平台 · 光湖码字

> 光湖码字 · AI创作伙伴平台 — 首期功能模块

## 概览

本模块实现「AI写网文」平台的三大核心功能：

1. **平台首页（Landing Page）** — 对话式设计入口
2. **用户注册/登录系统** — 手机号+验证码，三种角色（作者/编辑/运营），JWT鉴权
3. **AI伙伴对话框** — 登录后分配专属AI伙伴，WebSocket实时对话

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | React 18 + TypeScript + Vite | UI 组件化 |
| 样式 | Tailwind CSS 3 | 响应式设计 |
| 状态管理 | Zustand | 轻量状态 |
| 实时通信 | Socket.io | AI伙伴对话 |
| 后端 | Node.js + Express + TypeScript | API 服务 |
| 认证 | JWT | Token 鉴权 |
| AI | OpenAI SDK | GPT-4 / Claude |
| 数据 | Notion API（主）+ 内存缓存（降级） | 数据存储 |

## 目录结构

```
writing-platform/
├── frontend/           ← 前端（React + Vite）
│   ├── src/
│   │   ├── pages/      ← 页面组件
│   │   ├── components/ ← UI 组件
│   │   ├── hooks/      ← 自定义 Hooks
│   │   ├── services/   ← API 调用封装
│   │   └── stores/     ← Zustand 状态管理
│   └── dist/           ← 构建输出
│
├── backend/            ← 后端（Express + TypeScript）
│   ├── src/
│   │   ├── routes/     ← API 路由
│   │   ├── middleware/  ← 中间件
│   │   ├── services/   ← 业务逻辑
│   │   └── models/     ← 数据模型
│   └── dist/           ← 构建输出
│
├── nginx-writing.conf  ← Nginx 路由配置参考
└── README.md           ← 本文件
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/writing/auth/send-code` | 发送验证码 |
| POST | `/api/writing/auth/register` | 注册 |
| POST | `/api/writing/auth/login` | 登录 |
| GET | `/api/writing/user/me` | 获取当前用户 |
| POST | `/api/writing/ai/chat` | AI 对话（REST） |
| GET | `/api/writing/health` | 健康检查 |

## AI伙伴

| 角色 | AI伙伴 | 人设 |
|------|--------|------|
| 作者 | 笔灵 | 温暖的创作伙伴 |
| 编辑 | 慧眼 | 专业的审稿助手 |
| 运营 | 星图 | 敏锐的数据分析师 |

## 环境变量

| 变量名 | 说明 | 状态 |
|--------|------|------|
| `LLM_API_KEY` | AI 模型 API Key | ✅ 已有 |
| `LLM_BASE_URL` | AI 模型端点 | ✅ 已有 |
| `NOTION_TOKEN` | Notion API Token | ✅ 已有 |
| `JWT_SECRET` | JWT 签名密钥 | ⭕ 需配置 |
| `SMS_ACCESS_KEY` | 阿里云短信 Key | ⏳ 待配置 |
| `SMS_ACCESS_SECRET` | 阿里云短信 Secret | ⏳ 待配置 |
| `WRITING_DB_ID` | Notion 用户表 ID | ⭕ 需创建 |
| `REDIS_URL` | Redis 连接 | ⭕ 可选 |

## 部署

```bash
# 构建前端
cd frontend && npm install && npm run build

# 构建后端
cd ../backend && npm install && npm run build

# 启动后端（PM2）
pm2 start ecosystem.config.js

# Nginx 配置（参考 nginx-writing.conf）
```

## 路由

- 前端入口：`guanghulab.com/writing/`
- 后端端口：3100

---

© 2026 光湖纪元 · 国作登字-2026-A-00037559
