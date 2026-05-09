# 光湖 Portal · 前端 (静态)

> 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> PR-4 · baton-004

## 这是什么

`guanghulab.com` 的对外入口前端 —— **纯静态 HTML + vanilla JS**, 无框架, 无 CDN。
设计目标是跑在 2C2G 的国内域名机 (ZY-SVR-CN01) 上, 由 nginx 直发, **不走 SSR**。

## 文件结构

```
frontend/lighthouse-portal/
├── index.html           ← 三栏 SPA 壳 (左栏历史 / 中栏聊天 / 右栏上下文)
├── assets/
│   ├── style.css        ← 中文字体回退栈 + 月白色配色 + 响应式
│   └── app.js           ← fetch + ReadableStream 解析 OpenAI 兼容 SSE
└── README.md
```

## 因果链落地点

| 因果链 | 在前端怎么体现 |
|---|---|
| **cc-002** 永远不传 system | `app.js` `sendMessage` 的 payload 永远只有 `[{role:"user", content}]`, 不存在任何路径会塞 system |
| **cc-003** 不写死硬件 | 不直接调推理端, 只调本地 `/api/*`; 推理端 host:port 漂移由后端 `inference-endpoint.json` 处理 |
| **cc-004** 中文优先 | 所有按钮 / 标签 / 错误信息中文, 字体走思源黑体本地回退栈 (不走 Google Fonts CDN) |

## 部署

`server/portal/` 后端启动时, Express 同时也兜底服务这一份静态; nginx 上线时把
`/_static/*` 直接 root 到这个目录, 减 portal 进程负担。

详见 `server/portal/README.md`。

## 调试

直接在仓库内启动后端 (端口 3000), 浏览器访问 `http://127.0.0.1:3000/`:

```bash
cd server/portal
npm install
npm run dev
```

不需要单独跑前端构建。
