# 光湖 Portal · 后端 (Express)

> 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> PR-4 · baton-004

## 这是什么

`guanghulab.com` 后端 —— 单进程 Express, 跑在 ZY-SVR-CN01 (广州 2C2G) 上,
由 pm2 守护, 内存上限 512M, max_restarts=20。

**不是** 通用 Web 框架。它的存在只是为了:
1. 提供本地 SQLite 对话历史 (`conversations.sqlite`)
2. 把浏览器的 `/api/chat` 请求**字节级**转发到 AutoDL 推理端 (cc-002)
3. 切模型 = 转发到推理端 `/v1/switch-model`
4. 给前端右栏喂本地快照 (人格库 / 模块注册表), **不调 GitHub API**

## 文件结构

```
server/portal/
├── server.js                     ← Express 入口
├── package.json                  ← 仅 express + better-sqlite3
├── ecosystem.config.js           ← pm2 配置 (max_memory_restart=512M)
├── db/
│   └── init.js                   ← SQLite schema + WAL
├── lib/
│   └── inference-client.js       ← 推理端点热加载 + SSE 字节管道
├── routes/
│   ├── conversations.js          ← 列表 / 新建 / 历史
│   ├── chat.js                   ← /api/chat (SSE)
│   ├── active-model.js           ← 当前模型 / 切换
│   ├── persona-db.js             ← 人格层右栏 (只读快照)
│   └── manifest.js               ← 开发层右栏 (本地 manifest)
├── tests/
│   ├── strip-system.test.js      ← cc-002 三道关回归
│   └── routes-smoke.test.js      ← 路由冒烟 (mock 推理)
└── README.md
```

## 因果链落地点

| 因果链 | 在后端怎么体现 |
|---|---|
| **cc-002** 三道关 | `lib/inference-client.js#_strip_system_messages` + `routes/chat.js` 入口 filter + 推理端 server.py 入口 strip — 三层防御, 任意一层都能挡住 system role 注入 |
| **cc-003** 不写死 | `inference-client.init` 每次请求都 stat `inference-endpoint.json` mtime, 文件被 `refresh-autodl-endpoint.yml` 重写后**下一次请求**就用新值, 不需要 restart |
| **cc-004** 中文 | 所有 4xx/5xx body 走 `{error, code, message:"中文"}`, Awen 看截图就能懂 |
| 2C2G 内存约束 | better-sqlite3 同步连接 (省一份 worker 内存), pm2 单 instance, body limit 256K, 单条消息 8K 上限 |

## 路由

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/health` | portal + 推理端探活, 顶栏健康胶囊用 |
| GET | `/api/active-model` | 当前激活的模型 |
| POST | `/api/active-model` | `{name:"mother"\|"coder"}` 切换, 同步转发推理端 |
| GET | `/api/conversations` | 对话列表 (200 条上限) |
| POST | `/api/conversations` | 新建 |
| GET | `/api/conversations/:id/messages` | 历史 (1000 条上限) |
| POST | `/api/chat` | SSE 字节管道, 直转 AutoDL `/v1/chat/completions` |
| GET | `/api/persona-db` | 人格层右栏 (本地快照, 30s 缓存) |
| GET | `/api/manifest` | 开发层右栏 (本地 manifest, 30s 缓存) |

静态:
- `GET /` → `frontend/lighthouse-portal/index.html` (兜底, nginx 上线后由 nginx 直发)
- `GET /_static/*` → `frontend/lighthouse-portal/assets/*` (兜底, nginx 上线后由 nginx 直发)

## 推理端点文件 (PR-3 写)

`PORTAL_DATA_DIR/inference-endpoint.json`:

```json
{
  "scheme": "https",
  "host": "u123-456.autodl.com",
  "port": 12345,
  "bearer": "可选",
  "updated_at": "2026-05-09T..."
}
```

由 `.github/workflows/refresh-autodl-endpoint.yml` 在冰朔每次 AutoDL 重开后写入。
本进程**不重启**, 下次请求自动读新值 (mtime 变了就重 parse)。

## 启动

### 本地调试

```bash
cd server/portal
npm install
PORTAL_DATA_DIR=/tmp/portal-dev npm run dev
# 浏览器访问 http://127.0.0.1:3000/
```

### 生产 (pm2)

由 `.github/workflows/deploy-domain-server.yml` SSH 到 ZY-SVR-CN01 后执行:

```bash
cd /data/guanghulab/portal
npm ci --omit=dev
pm2 startOrReload ecosystem.config.js --update-env
pm2 save
```

### nginx

`server/setup/domain-cn/nginx/guanghulab.conf.template` 已经追加反代:

```nginx
location /_static/ {
    alias /data/guanghulab/portal/static/;
}
location / {
    proxy_pass http://127.0.0.1:3000/;
    # ... SSE 必需:
    proxy_buffering off;
    proxy_cache off;
    proxy_read_timeout 300s;
}
```

## 测试

```bash
cd server/portal
npm test
```

包含:
- `tests/strip-system.test.js` — `_strip_system_messages` cc-002 回归
- `tests/routes-smoke.test.js` — Express 路由冒烟 (推理端 mock 成 503 时, /api/chat 优雅降级)
