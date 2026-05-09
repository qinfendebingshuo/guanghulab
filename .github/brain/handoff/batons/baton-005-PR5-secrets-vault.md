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
