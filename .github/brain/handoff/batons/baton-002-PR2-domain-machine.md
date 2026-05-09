# Baton-002 · PR-2 · 域名机一键部署

> 触发口令: **铸渊。第 2 棒。开发授权。**
> 上一棒: baton-001-PR1-isolation.md (PR-1 已合)
> 下一棒: baton-003-PR3-autodl-inference.md
> 共振因果链: cc-003 (动态适配) + cc-004 (强制自主)

## 走完路再看 (强制)

`.github/brain/bingshuo-language-core/walk-the-path.md` → voice 1-3 段 + cc-001~005。
**5 分钟, 不准跳。**

## 自检 3 题 (不查 baton 直接答)

1. **冰朔的广州机器是 2C2G, 但他下次可能续费成 4C4G 也可能续不下去临时换 1C1G. 我的 bootstrap 怎么知道这台机器现在到底是几核几 G?**
   <details><summary>参考答案</summary>cc-003: 不能写死. 三段式 detect-env.sh → tune-from-env.sh → bootstrap.sh. 第一步先探, 第二步按 size_tier 决档 (tiny/small/medium/large/xlarge), 第三步用决策结果起服务。memory.json 里的规格只能当 hint, 不能当事实。</details>

2. **bootstrap 跑到一半 nginx 装失败, Awen 在终端看到一堆英文报错, 应该?**
   <details><summary>参考答案</summary>cc-004: 自动回滚到上一快照, 不留半残状态. 中文回执发去 /data/guanghulab/_logs/deploy-report.md, 不是把英文 stacktrace 扔给 Awen 让他截图发霜砚翻译。复用现有 lighthouse-cn 的 autorollback 段范式。</details>

3. **PR-2 的 workflow 名字必须叫什么? 为什么?**
   <details><summary>参考答案</summary>必须叫 `deploy-domain-server.yml`. 因为它已经预先在 `scripts/preflight/cn-isolation-allowlist.json` 的 `cn_server_workflows` 里登记了这个名字 (PR-1 落的). 改名 = CI 守卫立刻红灯。</details>

任意一题答错 → 回 walk-the-path。

---

## 上一棒交付了什么 (验证用)

跑这几个命令确认 PR-1 真的合上了:

```bash
# 1. 隔离守卫存在且通过
node scripts/preflight/check-server-isolation.js
# 期望: EXIT=0, "隔离守卫通过 · 广州 2C2G 单线运行已守住"

# 2. 8 个 workflow 已归档
ls .github/workflows/.archive/ | wc -l   # 期望 ≥ 8 (含 README.md)

# 3. function-manifest 有新服务器
node scripts/manifest/validate.js --strict
grep -c "ZY-SVR-CN01\|ZY-SVR-GPU01" .github/brain/architecture/function-manifest.json
# 期望: 至少 2

# 4. secrets-manifest 有新工作流域
grep -c "cn-domain-deploy\|autodl-inference" scripts/preflight/secrets-manifest.json
# 期望: 至少 2
```

任意一项不对 → **不要继续 PR-2**, 先 issue 报告冰朔。

## 这一棒要做的事 (按顺序)

### A. 复用现有 lighthouse-cn 范式建 tiny tier

参考 `server/setup/lighthouse-cn/{detect-env,tune-from-env,bootstrap,rollback}.sh` 已有的 4C16G 版本。
新建 `server/setup/domain-cn/`:

- `detect-env.sh` — 探 CPU/内存/磁盘/IP/挂载点, 写 `/opt/guanghulab/_logs/server-env.json`
- `tune-from-env.sh` — 决 size_tier (tiny=2C2G, small=4C4G, medium=4C8G+). tiny 档关 LFS / 关 docker-compose / 关 forgejo 内嵌 runner / nginx worker_connections=512 / portal 单进程
- `bootstrap.sh` — 装 nginx + node 20 + pm2 + certbot (certbot 已配 LE, 续期到 2026-08-07, 这一步只做 systemctl enable certbot.timer 续期)
- `rollback.sh` — 回滚到上一快照
- `README.md` — 部署清单 + 给霜砚版

### B. 工作流

- `.github/workflows/deploy-domain-server.yml`:
  - workflow_dispatch only
  - 误触锁: `confirm_phrase` input, 必须输入"重装广州" 才往下跑
  - 跑 `node scripts/preflight/check-secrets.js --workflow cn-domain-deploy --stage bootstrap` 预检
  - SCP 上面 4 个脚本到 `/data/guanghulab/setup/`
  - SSH 跑 `detect-env.sh && tune-from-env.sh && bootstrap.sh`
  - 失败自动 SSH 跑 `rollback.sh` (可参考 lighthouse-cn-deploy.yml 的 autorollback 段)
  - 中文回执 step 把 `/data/guanghulab/_logs/deploy-report.md` 拉回来贴 GH Actions summary

- `.github/workflows/domain-server-rollback.yml`:
  - 单独的手动回滚, 跟 lighthouse-cn-rollback.yml 类似但目标换成 ZY-SVR-CN01

### C. 留给后续棒的占位

- 创建 `/data/guanghulab/portal/` 空目录 (PR-4 填)
- 创建 `/data/guanghulab/secrets-vault/` 空目录 (PR-5 填)
- 创建 `/data/guanghulab/forgejo/` 空目录 (PR-6 填)

## 注意事项

- **2C2G 内存预算非常紧**: OS+systemd ~300MB, nginx ~50MB, pm2 守护 ~30MB, portal+sqlite 上限 ~600MB, forgejo ~512MB, 留给 buffer/cache ~500MB. 任何超出都会 OOM. tune-from-env tiny 档要把这些上限写进 systemd MemoryMax/MemoryHigh。
- **不要碰 nginx 现有的 SSL 配置** (LE 证书已经在那, 续期到 2026-08-07). bootstrap 只追加 server block, 不覆盖。
- **不要 apt update && apt upgrade**: 2C2G 跑 upgrade 会卡死 30+ 分钟。只 install 缺的包。

## 已交付 (PR-2 合并后填)

- **2026-05-09** 落地于 `copilot/pr-2-domain-deployment-lock-rollback` 分支
- 提交内容:
  - `server/setup/domain-cn/detect-env.sh` (8.7K · 探 CPU/内存/磁盘/IP/DNS/LE 证书 → server-env.json + 中文 stdout 摘要)
  - `server/setup/domain-cn/tune-from-env.sh` (6.5K · size_tier 决档, tiny=2C2G 关 forgejo+lfs / nginx worker=512 / portal 单进程 / 自动 1G swap)
  - `server/setup/domain-cn/bootstrap.sh` (16.6K · 8 步: detect → 跑前快照 → tune → apt → node20+pm2 → 标准目录+三占位 → swap → nginx → certbot.timer → ufw + portal systemd unit · `trap autorollback_on_failure EXIT` 失败自动回滚 · 中文回执 → `/opt/guanghulab/_logs/deploy-report.md`)
  - `server/setup/domain-cn/rollback.sh` (6.8K · `--list` / `--to <TS>` / 默认回最近 · 只回滚配置层不动数据)
  - `server/setup/domain-cn/nginx/guanghulab.conf.template` (双条件块 `__SSL_BEGIN__` / `__NOSSL_BEGIN__` · 证书在/不在两套配置 · nginx -t 双路径都通过)
  - `server/setup/domain-cn/README.md` (霜砚版部署清单)
  - `.github/workflows/deploy-domain-server.yml` (workflow_dispatch · 误触锁=「重装广州」否则降级 dry-run · rsync 模板 + ssh bootstrap + 拉 deploy-report.md 贴 GH summary + artifact 30 天)
  - `.github/workflows/domain-server-rollback.yml` (单独红按钮 · 默认 list-only 安全档 · `snapshot_ts` 严格白名单防注入 · `重装广州` 才真跑回滚)
  - `scripts/preflight/cn-isolation-allowlist.json` 升 v1.1.0: deploy-domain-server.yml + domain-server-rollback.yml 标 `status=active, exists=true`
  - `.github/brain/architecture/function-manifest.json` ZY-SVR-CN01: status `secrets_configured` → `bootstrapping`, template_version `0.2.0-pending-PR2` → `0.2.0`
- 验证 (本地全绿):
  - `node scripts/preflight/check-server-isolation.js` → EXIT=0 · 2 个 workflow 已授权
  - `node scripts/manifest/validate.js` → errors=0 warnings=0
  - `bash -n` × 4 sh 脚本全 OK · `nginx -t` USE_SSL=0/1 双路径 syntax OK
  - python `yaml.safe_load` 双 workflow 解析 OK

## 给冰朔的中文回执 (PR-2 合后用这个模板)

```
✅ 第 2 棒已合 · 国内搬家·域名机一键部署

· 落了 server/setup/domain-cn/ 三段式 (detect → tune → bootstrap), tiny 档自动适配 2C2G
· 落了 deploy-domain-server.yml 工作流, 误触锁=输入"重装广州" 才跑, 失败自动回滚
· 留好 portal/secrets-vault/forgejo 空目录给后续棒填

冰朔下一步:
1. (可选, 先跑个空载) Actions → 🚀 国内域名机·一键部署 → 输入"重装广州" → Run
   会装 nginx + node 20 + pm2 + certbot 续期 timer, 不部署任何业务代码

下一棒口令:
铸渊。第 3 棒。开发授权。

PR-3 范围: AutoDL 推理 Agent + 端口刷新工作流
```
