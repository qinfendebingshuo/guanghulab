# Baton-004 · PR-4 · 双层 Web Portal

> 触发口令: **铸渊。第 4 棒。开发授权。**
> 上一棒: baton-003-PR3-autodl-inference.md
> 下一棒: baton-005-PR5-secrets-vault.md
> 共振因果链: cc-002 (前端不传 system) + cc-004 (中文 UI)

## 走完路再看 (强制)

`.github/brain/bingshuo-language-core/walk-the-path.md`

## 自检 3 题

1. **冰朔说"光湖只有真实, 没有提示词". 前端 chat.js 调推理后端, messages 数组里第一条应该是什么?**
   <details><summary>参考答案</summary>cc-002: 第一条直接是 user. 不是 system. 前端不传, 后端不补, 推理端剥离 — 三道关。</details>

2. **2C2G 内存只够 portal 吃 ~600MB. SSR (Next.js) 还是静态 + Express?**
   <details><summary>参考答案</summary>静态 + Express. SSR 渲染会爆内存. 静态 HTML + 客户端渲染 + Express 只做 API + SSE 代理。</details>

3. **冰朔切到"现实开发层" tab, 右栏要展示模块注册表. 数据从哪儿来? 直接从 GitHub API 拉?**
   <details><summary>参考答案</summary>不从 GitHub API. 国内 2C2G 访问 GitHub API 不稳, 且会暴露主权. 直接读本地 git 镜像 (PR-6 的 forgejo) 里的 .github/brain/architecture/function-manifest.json. PR-4 阶段 forgejo 还没装, 先用每次部署时打包到本地的快照 /data/guanghulab/portal/data/manifest-snapshot.json。</details>

---

## 上一棒交付了什么 (验证用)

```bash
ls server/inference-agent/   # 期望: server.py setup-inference.sh detect-gpu.sh tune-inference.sh fetch-models.sh
ls .github/workflows/refresh-autodl-endpoint.yml
grep -A2 'refresh-autodl-endpoint.yml' scripts/preflight/cn-isolation-allowlist.json | grep '"exists": true'
```

## 这一棒要做的事

### A. 前端 (`frontend/lighthouse-portal/`)

- 不用 Next.js, 不用 SSR. 静态 HTML + vanilla JS (或 Vue 3 CDN 版, ESM)
- 思源黑体 (本地字体, 不走 Google Fonts CDN)
- 三栏布局:
  - 左栏: 新建对话 / 历史列表 (从 `/api/conversations` 拉)
  - 中栏: chat 区域 + 顶部 tab `[光湖语言人格层] [现实开发层]`, 切 tab = 调 `POST /api/active-model {name}`
  - 右栏: 看模式分:
    - 人格层 → `/api/persona-db` (复用 `persona-brain-db/` 已建数据, 只读卡片)
    - 开发层 → `/api/manifest` (本地 manifest 快照, 只读卡片)
- chat 走 SSE, byte-pipe 转发 (不重组, cc-002 落地)
- 每次发送, 前端只传 `messages: [{role: "user", content: "..."}]` — 永远不带 system

### B. 后端 (`server/portal/`)

- Express 单进程, pm2 起一份
- SQLite (`/data/guanghulab/portal/data/conversations.sqlite`):
  - `conversations(id, title, active_model, created_at, updated_at)`
  - `messages(id, conv_id, role, content, ts)`  · role 永远只有 user/assistant, 不存 system
- 路由:
  - `GET /api/conversations` 列表
  - `POST /api/conversations` 新建
  - `GET /api/conversations/:id/messages`
  - `POST /api/chat` SSE → 转发到 `inference-endpoint.json` 里的 AutoDL `/v1/chat/completions`
  - `GET /api/active-model` 当前
  - `POST /api/active-model {name: "mother"|"coder"}`
  - `GET /api/persona-db` 只读
  - `GET /api/manifest` 只读
- 启动时读 `/data/guanghulab/portal/data/inference-endpoint.json` (PR-3 写的)

### C. nginx 改造

- bootstrap 已经反代 443 → 127.0.0.1:3000 (portal)
- 静态资源 (字体/JS/CSS) 直接 nginx 服务, 不走 Express, 减负

### D. ecosystem.config.js (pm2)

- 单 instance, max_memory_restart=512M (内存上限保护)
- 日志走 `/data/guanghulab/_logs/portal-*.log`

## 给冰朔的中文回执模板

```
✅ 第 4 棒已合 · 双层 Web Portal

· frontend/lighthouse-portal/ 静态前端 (思源黑体 · 三栏布局 · 中文)
· server/portal/ Express 后端 (SQLite 对话历史 · SSE 字节管道转发 AutoDL · pm2 守护)
· nginx 反代静态 + API, 严禁 system prompt 三道关 (前端不传 / 后端不补 / 推理剥)
· 切 tab = 切模型, 切模型 = 调 AutoDL switch-model, 右栏跟 tab 联动

冰朔体验:
1. 打开 https://guanghulab.com 直接进
2. 左栏新建对话 / 历史
3. 中栏切 tab: 人格层 (母模型 + 右栏数据库) 或 开发层 (编程模型 + 右栏模块注册)
4. 中文输入, 字节流回, 真实人格

下一棒口令:
铸渊。第 5 棒。开发授权。
```
