<!-- LIGHTHOUSE_MIGRATION_START -->
## 🏮 光湖搬家进度 · Lighthouse Migration

> 📜 Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559 · 守护: 铸渊 ICE-GL-ZY001
>
> 主服务器: **GH-CVM-MAIN-PROD-01** · `43.139.251.175` · 4C16G · 广州六区 · 数据盘 `/data` (100G)

### 阶段 0 · 国内服务器环境提前烤好（铸渊）

- [x] `server/setup/lighthouse-cn/bootstrap.sh` (Docker / Gitea / Postgres / Redis / Runner)
- [x] `server/setup/lighthouse-cn/docker-compose.yml`
- [x] `server/setup/lighthouse-cn/gitea/app.ini.template`
- [x] `server/setup/lighthouse-cn/nginx/lighthouse.conf`
- [x] `server/setup/lighthouse-cn/README.md` (给霜砚的部署日志)
- [x] `.github/workflows/lighthouse-cn-deploy.yml` (手动触发: bootstrap/update/rollback)
- [x] `server/setup/lighthouse-cn/gitea-secrets-template.yaml` (CN_* 占位)
- [x] `server/setup/lighthouse-cn/migration-checklist.md`

### 阶段 1 · COS 中转

- [x] `scripts/migration/snapshot-to-cos.js`
- [x] `scripts/migration/restore-from-cos.sh`
- [ ] 冰朔本地跑一次 snapshot-to-cos
- [ ] COS 桶名落定 (`ZY_COS_MIGRATION_BUCKET`)

### 阶段 2 · 灯塔 bootstrap

- [ ] 冰朔配齐 5.1 节 19 个 Secrets
- [ ] 触发 `lighthouse-cn-deploy` (server_target=main, stage=bootstrap)
- [ ] 浏览器登录 Gitea 拿 Runner Token
- [ ] 触发 stage=update 启 Runner

### 阶段 3 · 工作流迁移

- [x] `scripts/migration/convert-workflows.js`（自检 56 个 workflow → 56 个转换成功 / 1 个 review-needed）
- [ ] 在国内 Gitea 仓库跑转换 + review

### 阶段 4 · 神笔马良

- [x] `mcp-servers/zhuyuan-pen/` 骨架（笔尖 / 墨 / 纸 / 取物钩）
- [x] 8 个能力（fs.read / fs.write / http.get / shell.run / llm.chat / cos.put / gitea.api / notion.api）
- [x] 自检 `tests/test-pen.js` 通过
- [ ] v0.2: LLM 直接合成 main() 体

### 阶段 5 · 灰度上线

- [ ] 灯塔门户首页内容
- [ ] 操作系统总控台 API（lighthouse-console）
- [ ] 第一条公告 / 广播心跳

<!-- LIGHTHOUSE_MIGRATION_END -->

---

## 🌙 天眼夜间修复引擎 · 仪表盘

> 📜 Copyright: 国作登字-2026-A-00037559 · TCS-0002∞ 冰朔
>
> 引擎版本: v3.0 | 指令编号: ZY-TIANYAN-AUTOFIX-2026-0324-001

---

### 系统状态

| 指标 | 值 |
|------|----|
| 引擎版本 | v3.0 |
| 上次扫描 | 待首次运行 |
| 扫描结果 | ⏳ 等待首次扫描 |
| 自动修复 | — |
| 需人工处理 | — |
| 待合并 PR | — |

### 👁️ Merge Watchdog 状态

| 指标 | 值 |
|------|----|
| 活跃看守 | 0 |
| 已确认修复 | 0 |
| 已升级（需人工） | 0 |

### 最近7天修复历史

| 日期 | 扫描 | 发现 | 自动修复 | 人工处理 | PR | 看守状态 |
|------|------|------|----------|----------|----|----------|
| — | — | — | — | — | — | — |

### 待处理事项

> ✅ 当前无待处理事项

---

### CRON 调度总览

| 时间 (CST) | 任务 | Workflow | 类型 |
|------------|------|----------|------|
| 04:00-04:10 | 每日微休眠 | 系统内置 | 休眠 |
| 08:30 | 天眼每日巡检 | tianyan-daily-patrol.yml | 巡检 |
| 周一 10:00 | Token主刷新A | renew-gdrive-tokens.yml | 生命线 |
| 12:15 每天 | Token安全网 | check-token-health.yml | 生命线 |
| 周四 10:00 | Token主刷新B | renew-gdrive-tokens.yml | 生命线 |
| 周六 20:00-00:00 | 周末大休眠 | 系统内置 | 休眠 |
| **23:00 每天** | **天眼夜间自动修复** | **tianyan-nightly-scan.yml** | **生命线** ⭐ |

### 看守者五条铁律

1. 🛡️ 看守者自身不修改代码 — 只观察、记录、通知
2. 🔒 最多重试 3 次 — 硬上限，不可覆盖
3. 🔄 每轮修复策略必须不同
4. 📧 邮件必须包含具体操作步骤
5. 🤫 成功后绝对静默 — 只更新仪表盘

---

> 🤖 此仪表盘由铸渊夜间修复引擎自动维护
> ⏰ 冰朔每日晨间审阅即可
