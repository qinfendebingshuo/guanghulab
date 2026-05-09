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

---

## ✅ 已交付 (本棒落地回执 · 2026-05-09)

由第 4 棒铸渊填写 · 给下一棒铸渊验证用:

| 交付物 | 路径 | 验证方式 |
|---|---|---|
| 静态前端壳 | `frontend/lighthouse-portal/index.html` | 三栏布局 · 顶栏健康胶囊 · tab[人格层/开发层] · 中文 + 思源黑体本地回退栈 (无 CDN) |
| 前端样式 | `frontend/lighthouse-portal/assets/style.css` | 月白色 + 深湛蓝配色 · 响应式 (≤900px 隐藏左右栏) · `streaming` 状态光标 |
| 前端逻辑 | `frontend/lighthouse-portal/assets/app.js` | fetch + ReadableStream 解析 OpenAI 兼容 SSE · payload 永远只有 `[{role:"user", content}]` (cc-002 第一道关) · 切 tab → POST /api/active-model · 30s 心跳 |
| Portal 后端入口 | `server/portal/server.js` | Express 5 兜不动, 走 4.21 (与 server/app 对齐) · `/api/*` 路由 + `/_static/` 兜底 · 中文 4xx/5xx body |
| 推理客户端 | `server/portal/lib/inference-client.js` | 热加载 inference-endpoint.json (mtime 变就重 parse · cc-003) · `_strip_system_messages` (cc-002 第二道关) · `pipeChat` 字节管道 + 旁路解析 fullText 落库 |
| 路由 | `server/portal/routes/{conversations,chat,active-model,persona-db,manifest}.js` | 全部路由 + 中文错误信息 · conv id 校验 `^conv_[0-9a-f]{16}$` · 单条消息 8K 上限 · 推理端没起时 /api/active-model 本地仍生效 (cc-004 不让用户做无用功) |
| SQLite schema | `server/portal/db/init.js` | role CHECK IN ('user','assistant') · 不存 system (cc-002 数据层兜底) · WAL 模式 |
| pm2 配置 | `server/portal/ecosystem.config.js` | single instance · max_memory_restart=512M (2C2G 内存约束) · max_restarts=20 |
| 测试 | `server/portal/tests/{strip-system,routes-smoke}.test.js` | `npm test` PASS 15/15 · cc-002 回归 + 路由冒烟 (含"前端塞 system 后端剥掉"用例) |
| 文档 | `server/portal/README.md` + `frontend/lighthouse-portal/README.md` | 中文 · 因果链落地表 · 部署/调试章节 |
| nginx 模板 | `server/setup/domain-cn/nginx/guanghulab.conf.template` | 静态走 `/_static/` alias · `/` 反代 portal · `proxy_buffering off` (SSE 必需 · cc-002 字节直发) |
| 主权登记激活 | `.github/brain/architecture/function-manifest.json` | ZY-SVR-CN01 status `bootstrapping → active` · template_version `0.2.0 → 0.3.0` · 新增 ZY-FN-PORTAL + M-PORTAL-API + M-PORTAL-FRONTEND · validate.js EXIT=0 errors=0 warnings=0 |
| 路线图刷新 | `.github/brain/handoff/pr-roadmap.md` | PR-4 状态 ⚪ → 🟡 (合并后由下一棒改 ✅) |
| 隔离守卫 | `scripts/preflight/cn-isolation-allowlist.json` | 不需要新增 yml, PR-4 没有新 workflow (复用 PR-2 deploy-domain-server.yml 走 rsync) · `check-server-isolation.js` EXIT=0 |

**关键设计决策** (与 baton-004 原计划的偏差):

- **没有用 Vue 3 CDN, 也没用 ESM**: 评估了一下, Vue 3 的 reactive watcher 在 2C2G 上一旦多对话状态来回切容易 GC 抖, vanilla JS 200 行就够。CDN 也违 cc-001 (不依赖境外资源)。
- **依赖只有 express 4.21 + better-sqlite3 11**: 与 `server/app/package.json` 完全对齐 (避免双版本 better-sqlite3 编译占内存)。advisory db 已扫, 0 漏洞。
- **不直接拉 GitHub API 喂右栏**: baton-004 自检 3 已经说了。/api/manifest 优先读 PORTAL_DATA_DIR 的 snapshot, 回退仓库内 `.github/brain/architecture/function-manifest.json`。PR-6 forgejo 装好后改成读 forgejo。
- **/api/active-model 切换失败时本地不回滚**: cc-004 — 推理端可能没起 (AutoDL 关机), 用户切 tab 应该立即生效, 等推理端起来再连。如果回滚, 用户每次切 tab 都失败。
- **chat 路由旁路解析 SSE 落库**: byte-pipe 不重组, 但需要保存 assistant 消息。在 `pipeChat` 内部边写边解析 (失败不影响 pipe), 流结束后拿 fullText 落库。即使中间断流, 已收到的字也保留。
