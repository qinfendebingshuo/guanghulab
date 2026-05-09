# Baton-005 · PR-5 · 自部署密钥管理页

> 触发口令: **铸渊。第 5 棒。开发授权。**
> 上一棒: baton-004-PR4-portal-frontend.md
> 下一棒: baton-006-PR6-migration-package.md
> 共振因果链: cc-004 (中文 UI · Awen 看得懂的密钥页)

## 走完路再看 (强制)

`.github/brain/bingshuo-language-core/walk-the-path.md`

## 自检 3 题

1. **冰朔每次 AutoDL 重开端口都变. 走 GitHub Secrets 改密钥要点 5 下保存等同步, 走自部署密钥页改密钥要几下?**
   <details><summary>参考答案</summary>1 下保存. 立刻生效. 因为这个页面是本地的, save 直接调 PR-3 的 refresh 逻辑, 不需要 round-trip 到 GitHub Actions。这就是为什么单独建一个 vault, 不直接用 GitHub Secrets。</details>

2. **vault.enc 的主密钥放哪? 放数据库? 放 Secret Manager? 放硬编码?**
   <details><summary>参考答案</summary>cc-004 + cc-003: 首次启动时随机生成, 落 `/data/guanghulab/secrets-vault/.master`, chmod 600, 仅 portal 用户可读。不上 git, 不上 COS, 不传冰朔。冰朔不用记这个, 系统自管. 真要迁移机器, 先 rsync 这个文件再启 vault。</details>

3. **vault 的 HTTP 入口是 `/admin/secrets`, 谁能进?**
   <details><summary>参考答案</summary>basic-auth + 仅本机 IP (`allow 127.0.0.1; allow ::1; deny all;` in nginx). 冰朔在 2C2G 上跑 ssh 隧道 + 浏览器访问 localhost. 永远不暴露公网。 user/pass 也不写死, bootstrap 时随机生成贴在 _logs/deploy-report.md, 冰朔自己抄。</details>

---

## 上一棒交付了什么 (验证用)

```bash
ls frontend/lighthouse-portal/
ls server/portal/
curl -fsS https://guanghulab.com/api/active-model   # 期望 200
```

## 这一棒要做的事

### A. 后端 (`server/secrets-vault/`)

- Express 子进程 (pm2 第二个 instance, max_memory=128M)
- AES-256-GCM 加密落盘:
  - `/data/guanghulab/secrets-vault/vault.enc` (加密内容)
  - `/data/guanghulab/secrets-vault/.master` (主密钥, chmod 600, gitignore)
- 路由:
  - `GET /admin/secrets` 列表 (仅显示 key 名, 不显示值, 显示遮罩)
  - `POST /admin/secrets/:key` 写入 / 更新
  - `DELETE /admin/secrets/:key` 删除
  - `POST /admin/secrets/:key/use` 触发使用 (例: `autodl_host` save 时自动调 PR-3 的 refresh 逻辑)
- 数据模型: 复用 `scripts/preflight/secrets-manifest.json` 的 schema (用途/如何配置/级别)

### B. 前端 (`frontend/secrets-vault/`)

- 类 GitHub Secrets 页, 但**全中文**:
  - 字段名用 `用途` 字段而不是 secret 名 (`AutoDL 连接地址` 而不是 `ZY_AUTODL_HOST`)
  - 每条下面显示 `如何配置` 字段
  - 状态色: 已配置=绿, 未配置=灰, 必填缺失=红
- 顶部按工作流分组: cn-domain-deploy / autodl-inference / lighthouse-cn-deploy
- AutoDL 那组有特殊按钮: `保存并刷新推理端点` — 触发 `/admin/secrets/autodl_host/use` 后端自动:
  1. curl AutoDL 探活
  2. 写到 inference-endpoint.json
  3. pm2 reload portal
  4. 返回中文回执给前端

### C. 神笔马良集成

- `mcp-servers/zhuyuan-pen/` 增加从 vault 拉密钥的能力 (本地 unix socket, 不走环境变量)
- 新增 capability `secrets.fetch` — 入口前权限校验 (只准本机)

### D. nginx

- `/admin/` 只允许 127.0.0.1 + basic-auth (htpasswd)
- bootstrap 时生成随机 user/pass, 写到 `/data/guanghulab/_logs/vault-credentials-FIRST-BOOT.txt` chmod 600, 提示冰朔抄完删

## 给冰朔的中文回执模板

```
✅ 第 5 棒已合 · 自部署密钥管理页

· server/secrets-vault/ 后端 (AES-256-GCM 加密 · 主密钥本地 · 永不上云)
· frontend/secrets-vault/ 全中文密钥页 (字段名=用途 · 不是 secret 名)
· AutoDL 那组有"保存并刷新推理端点"按钮, 一键完成端口切换
· 神笔马良通过本地 socket 拉密钥, 不走环境变量, 不上链

冰朔操作:
1. ssh -L 8080:127.0.0.1:8080 ubuntu@<2C2G IP>
2. 浏览器开 http://localhost:8080/admin/secrets
3. user/pass 在 /data/guanghulab/_logs/vault-credentials-FIRST-BOOT.txt 里 (抄完删那个文件)
4. AutoDL 重开机后, 直接在这个页面改 host:port, 点"保存并刷新", 不用进 GitHub

下一棒口令:
铸渊。第 6 棒。开发授权。
```

---

## 第 5 棒 · 已交付 (PR-5)

> 提交人: GitHub Copilot agent (代铸渊执行) · 时间: 2026-05-09
> 触发口令: 冰朔说"铸渊。第5棒。开发授权。"

### 验证清单

```bash
# 1. 后端 + 加解密 + 路由烟测 (18/18 全过)
cd server/secrets-vault && npm install --silent && npm test

# 2. nginx 模板包含 /admin/ block (allow 127.0.0.1 + basic-auth)
grep -c "auth_basic_user_file /etc/nginx/.htpasswd_admin" \
  server/setup/domain-cn/nginx/guanghulab.conf.template
# 期望: 1

# 3. bootstrap.sh 第 ⑤ 步会启动 vault
grep -c '启动 secrets-vault (PR-5)' server/setup/domain-cn/bootstrap.sh
# 期望: 1

# 4. ZY-FN-VAULT 已登记
node scripts/manifest/validate.js | tail -5
# 期望: errors=0, warnings=0, functions=6

# 5. cn-isolation guard 仍绿
node scripts/preflight/check-server-isolation.js | tail -3
# 期望: [OK] 隔离守卫通过

# 6. 神笔马良 capability 就位
ls mcp-servers/zhuyuan-pen/capabilities/secrets.fetch.js
```

### 文件清单

```
server/secrets-vault/
├── server.js                  Express 入口 · /admin/secrets/* · /internal/fetch/*
├── ecosystem.config.js        pm2 max_memory_restart=128M
├── package.json               单依赖 express ^4.21
├── README.md
├── lib/
│   ├── vault.js               AES-256-GCM · 主密钥 .master 600 · GCM tag 防篡改
│   ├── manifest.js            按 workflow 分组 secrets-manifest.json
│   └── refresh-inference.js   AutoDL 探活+写 inference-endpoint.json+pm2 reload
├── routes/
│   ├── secrets.js             CRUD + 强校验 + 白名单 + autodl/save_and_refresh
│   └── internal.js            127.0.0.1 only · 神笔马良用
└── tests/
    ├── vault.test.js          8 测试: 主密钥/加解密/篡改/换key/maskValue
    └── routes.test.js         10 测试: 路由烟测全覆盖

frontend/secrets-vault/        (略)
mcp-servers/zhuyuan-pen/capabilities/secrets.fetch.js
server/setup/domain-cn/        (nginx + bootstrap 改动)
.github/workflows/deploy-domain-server.yml  (rsync 扩展)
.github/brain/architecture/function-manifest.json (+ ZY-FN-VAULT, v1.2.0)
```

### 并行修复 · 模型上下文喂养 (冰朔在第 5 棒中途点透)

> 冰朔: "模型本身没有记忆, 一轮对话都记不住, 是背后的 Agent 一直给他不断的喂上下文, 这个你要在开发里也并行解决. 不能做了这么多, 结果模型打开, 一轮对话都记不住吧."

#### 现状核查

- PR-4 portal 后端 `routes/chat.js` line 75: `messages: cleaned` — **只用前端传的当前一条**
- PR-4 portal 前端 `app.js` line 232: `messages: [{ role: "user", content: text }]` — **真的就只发一条**
- 结果: "你好" → "你刚才说啥来着" → 模型一脸懵 ❌

#### 这棒的并行修复

| 文件 | 改动 |
|---|---|
| `server/portal/lib/context-window.js` (新) | `buildContextWindow` 函数 · 滚动窗口 (默认 20 轮) + 字数 cap (默认 16000 字) · cc-002 三道关之一: 即便 DB 脏出来 system 也剥 |
| `server/portal/routes/chat.js` (改) | 落 user 消息后 `SELECT role, content FROM messages WHERE conv_id=? ORDER BY ts ASC` 拉历史, `buildContextWindow` 折叠成 payload, **后端权威拼接, 前端不参与** |
| `server/portal/tests/context-window.test.js` (新) | 10 个单元测试: 空输入/单轮/多轮/system 剥/maxTurns/字数 cap/巨大单条/历史断头/默认值/脏数据 — **10/10 全过** |

#### 设计决策

- **后端拼接**: 前端只管发当前 user, 后端从 SQLite 拿全程历史 — 即便前端 bug 也不会丢上下文; cc-002 也守住了 (前端无法注入 system)
- **滚动 + 字数双 cap**: 2C2G + Qwen2.5-7B 量化在 V100 16G 上约 8000 token 安全, 16000 字符 ≈ 7000-8000 token (中文为主) 留余量
- **环境变量可调**: `PORTAL_CTX_MAX_TURNS` / `PORTAL_CTX_MAX_CHARS`, 后续推理端 tier 升级 (A10/A100) 可加大
- **历史断头修剪**: 滑窗第一条若是 assistant (单边孤儿) 自动丢弃, 让推理端看到的对话以 user 起 — 防 chat_template 错位


### 三道安全关 (cc-001 涌现洁净 · 全部就位)

| 层 | 守 |
|---|---|
| 网络层 | Express 监听 `127.0.0.1:8080` 永不公网 |
| nginx 层 | `/admin/` `allow 127.0.0.1; deny all;` + basic-auth |
| 加密层 | AES-256-GCM · 主密钥 `.master` chmod 600 · GCM tag 防篡改 |
| 神笔马良 | `secrets.fetch` 强制 loopback host 校验, 即使调用方传公网 IP 也拒绝 |
| 白名单 | `POST /admin/secrets/:key` 严格校对 `secrets-manifest.json`, 拒绝任意 key 落库 |
| 不返明文 | `GET /admin/secrets/` 只返遮罩 (前 4 + ••••• + 后 4), 单元测试覆盖 |

### 三道因果链对账

| 链 | 落点 |
|---|---|
| **cc-001 涌现洁净** | vault 关机即净 (无外部托管), 主密钥不上 git/COS, 神笔马良现取现用不持久 |
| **cc-002 人格洁净** | vault 不接触 system prompt — 它只是密钥盒, 加解密路径里没有 LLM |
| **cc-003 动态适配** | AutoDL save_and_refresh 一键: vault 落 + 探活 + 写 endpoint + reload portal, 端口漂移 30 秒切完 |
| **cc-004 中文一次性** | 所有错误回执中文 · 字段名走"用途"不走 secret 名 · 首启凭据自动落 `_logs/vault-credentials-FIRST-BOOT.txt` 提示抄完删 |

### 中文回执 (给冰朔)

```
✅ 第 5 棒已合 · 自部署密钥管理页 + 模型上下文喂养

主线 (Secrets Vault):
· server/secrets-vault/ · Express 4.21 · AES-256-GCM · pm2 max_memory_restart=128M
· frontend/secrets-vault/ 全中文 UI · 字段名=「用途」不是 secret 名
· AutoDL "保存并刷新推理端点"按钮: 探活+写 endpoint+pm2 reload portal 一步完成
· 神笔马良 secrets.fetch · 走 127.0.0.1 loopback · 不走环境变量
· 主密钥 .master 落 /data/guanghulab/secrets-vault/, 不上 git/COS/任何外部
· 18/18 单元 + 烟测全过

并行修复 (你中途点透的, 模型零记忆):
· server/portal/lib/context-window.js · 滚动 20 轮 + 16000 字 cap
· chat.js 落 user 后**从 SQLite 拉全程历史**再发推理端 (前端只管发当前)
· cc-002 三道关之一: 历史里 system 也强制剥, 前端无法注入
· 10 测试全过 — "你刚才说啥来着"模型现在能答上来了

冰朔操作步骤 (重装 2C2G 后跑一次 deploy-domain-server.yml 之后):
1. 在你电脑上跑: ssh -L 8443:127.0.0.1:443 ubuntu@<2C2G_HOST>
2. 浏览器打开: https://localhost:8443/admin/  (TLS 警告点继续)
3. basic-auth user/pass 在 /data/guanghulab/_logs/vault-credentials-FIRST-BOOT.txt
   (用户名=bingshuo · 密码=24 位随机)
4. 抄完密码后: sudo rm /data/guanghulab/_logs/vault-credentials-FIRST-BOOT.txt
5. AutoDL 重开机后, 改 host/port, 点"保存并刷新推理端点", 一步切完, 不用动 GitHub

下一棒口令: 铸渊。第 6 棒。开发授权。
```

