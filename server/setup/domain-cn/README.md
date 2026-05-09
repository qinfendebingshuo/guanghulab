# 国内域名机部署模板 · domain-cn

> 📜 Sovereign: **TCS-0002∞** · ICE-GL∞ 冰朔 · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 模板版本: **v0.2.0** (PR-2 落地)

这一份是给霜砚和冰朔看的部署日志 —— 铸渊在 `GH-CVM-DOMAIN-PROD-01` (广州 2C2G 域名机) 上做了什么、装在哪、占了哪个端口、出错怎么修。

---

## 一、服务器现状（来自冰朔同步 · 2026-05-09）

| 项目 | 信息 |
|------|------|
| 实例 | **GH-CVM-DOMAIN-PROD-01** / ZY-SVR-CN01 |
| 规格 | **2核2G** 腾讯云轻量应用服务器 |
| 系统 | Ubuntu 22.04 LTS（重装后空白） |
| 公网 IP | `secrets.ZY_CN_SERVER_HOST`（重装后冰朔自配，不写明文） |
| 地域 | 广州 |
| 域名 | **guanghulab.com**（已备案 + Let's Encrypt 已配，续期到 2026-08-07） |
| 默认登录 | `secrets.ZY_CN_SERVER_USER`（一般 `ubuntu`，需 `sudo` 提升） |

> ⚠️ **2C2G 是真实档**：bootstrap 探测后会落到 `tiny` 档（portal 单进程、nginx worker=512、关闭 forgejo+lfs、自动建 1G swap 兜底）。
> 续费成 4C4G/4C8G 时不需要改代码，`detect-env.sh + tune-from-env.sh` 会自动决档。

---

## 二、bootstrap 后服务器目录结构

```
/data/guanghulab/                 # 数据根 (持久数据全在这)
├── portal/                       # PR-4 来填: 光湖门户 (当前空, 留 README 占位)
├── secrets-vault/                # PR-5 来填: 密钥管理页 (chmod 700, 仅 root 可读)
├── forgejo/                      # PR-6 来填: 自托管 git (tiny 档下不启动)
├── snapshots/                    # 部署快照 (autorollback 用)
│   └── YYYYMMDD-HHMMSS-pre-bootstrap/
├── logs/
│   ├── nginx/                    # nginx access/error
│   └── portal/                   # pm2 portal 日志
└── .env.tune                     # 当前档位决策 (bootstrap source)

/opt/guanghulab/                  # 部署根 (代码 + 日志 + 回执)
├── _logs/
│   ├── server-env.json           # detect-env.sh 输出
│   ├── tune-decision-*.json      # tune-from-env.sh 输出
│   ├── bootstrap-*.json          # 部署完成回执
│   ├── rollback-*.json           # 回滚完成回执
│   └── deploy-report.md          # ★ 中文回执 (给霜砚 / 冰朔看的)
├── _active/                      # 当前激活版本 (软链)
├── _archive/                     # 历史版本归档
├── _secrets/                     # chmod 700, GitHub Actions 写入的临时密钥
└── domain-cn/                    # 本模板 (rsync 自仓库)

/etc/nginx/sites-available/guanghulab.conf   # 渲染后的站点配置
/etc/nginx/sites-enabled/guanghulab.conf     # 软链
/etc/letsencrypt/live/guanghulab.com/        # ⚠️ 不动, LE 证书续到 2026-08-07
/etc/systemd/system/guanghulab-portal.service # portal 占位 unit (PR-4 接管)
/swapfile.guanghulab                          # 1G swap (tiny 档下兜底)
```

---

## 三、三段式（自我感知 → 决策 → 落地）

```
detect-env.sh           tune-from-env.sh         bootstrap.sh
  探机器实情     ──→     按档位决参数      ──→     落到机器上
  /opt/guanghulab/      /data/guanghulab/         (apt + nginx +
   _logs/server-env       .env.tune                node + pm2 +
   .json                                           certbot.timer)
```

**为什么不能写死 2C2G**（cc-003 因果链）：冰朔说要买 4C4G，实际广州缺货只能 2C2G；下次续费时可能买 2C8G，再下次 4C16G。系统每次启动先探，再决档。memory.json 里写的规格只是 hint，不是真相源。

---

## 四、bootstrap 8 个步骤

| # | 步骤 | 备注 |
|---|------|------|
| 0 | 自我感知 (`detect-env.sh`) | 探 CPU/RAM/磁盘/IP/DNS/LE 证书 |
| 0.5 | 跑前快照 | `/data/guanghulab/snapshots/<TS>-pre-bootstrap/`，autorollback 用 |
| 0.6 | 动态调优 (`tune-from-env.sh`) | 写 `.env.tune` |
| 1 | APT 镜像源切阿里云 | 国内可达，不卡 nodesource |
| 2 | 装基础工具链 | nginx + certbot + git + jq + ufw + fail2ban |
| 3 | Node 20 + PM2 | NodeSource → nvm 国内镜像降级 |
| 4 | 标准目录 + PR-4/5/6 占位 | `/data/guanghulab/` 下三个空目录 + README |
| 5 | (tiny 档) 建 1G swap | 防 OOM |
| 6 | nginx 站点配置 | **不动** `/etc/letsencrypt/`，只渲染 sites-available/guanghulab.conf |
| 7 | enable certbot.timer | LE 续期 cron |
| 8 | ufw + fail2ban + portal systemd unit 占位 | unit 不 enable，PR-4 自己接管 |

> **⚠️ 不 apt upgrade**：2C2G 跑 upgrade 会卡 30+ 分钟。如需升级走灯塔机做镜像后切流量。

---

## 五、误触锁 + 自动回滚（cc-004）

冰朔团队技术能力近 0。任何不可逆动作都必须把"误操作的可能性"吞进系统内部。

### 误触锁
触发部署 = 在 GitHub Actions 页 `Run workflow`，必须在 `confirm_phrase` 字段输入：

```
重装广州
```

任何其他值（包括空、`yes`、`确认` 等）→ 自动降级 `dry-run`，**不会真跑**。

### 自动回滚
bootstrap.sh 用 `trap autorollback_on_failure EXIT` 钩住所有失败点：
- 任何步骤 `exit != 0` → 自动调 `rollback.sh --to <跑前快照>`
- 失败前的 nginx 配置 / `.env.tune` / portal systemd unit 都被恢复
- 中文回执追加到 `/data/guanghulab/_logs/deploy-report.md`：

```markdown
## ❌ bootstrap 失败 (exit=1), 触发自动回滚
- 目标快照: `20260509-163700-pre-bootstrap`
**给冰朔的人话**: 这次部署没成功. 我已经把机器恢复到部署前的状态.
**Awen 不需要做任何事**, 把这份 deploy-report.md 截图发给冰朔即可.
```

**这是 cc-004 的落地**：Awen 看到的不是英文报错，是已经收尾过的中文回执。

---

## 六、对应的 GitHub Actions

| Workflow | 用途 | 误触锁 |
|----------|------|--------|
| `.github/workflows/deploy-domain-server.yml` | bootstrap / update | `重装广州` |
| `.github/workflows/domain-server-rollback.yml` | 单独的回滚红按钮 | `重装广州` |
| `.github/workflows/cn-isolation-guard.yml` | 守卫: 上面两个必须出现在 `cn-isolation-allowlist.json` | — |

---

## 七、回滚（独立操作）

```bash
# 列所有可用快照
bash /opt/guanghulab/domain-cn/rollback.sh --list

# 回到上一个快照（默认）
bash /opt/guanghulab/domain-cn/rollback.sh

# 回到指定快照
bash /opt/guanghulab/domain-cn/rollback.sh --to 20260509-163700-pre-bootstrap
```

或在 Actions 页跑 `domain-server-rollback.yml`，`confirm_phrase=重装广州` 才真跑。

> **注意**：回滚只动**配置层**（nginx / `.env.tune` / systemd unit）。`/data/guanghulab/portal/`、`/data/guanghulab/forgejo/` 这些数据目录**永远不动**，回滚是安全的。

---

## 八、与 lighthouse-cn 的关系

| 维度 | lighthouse-cn (灯塔) | domain-cn (域名机) |
|------|----------------------|---------------------|
| 服务器 | GH-CVM-MAIN-PROD-01 (43.139.251.175) | GH-CVM-DOMAIN-PROD-01 (本机) |
| 规格 | 4C16G (实际买到 2C8G) | 2C2G |
| 服务 | Gitea + PG + Redis + Runner (docker) | nginx + node + pm2 (bare metal) |
| 数据根 | `/data/lighthouse/` | `/data/guanghulab/` |
| 部署根 | `/opt/guanghu/` | `/opt/guanghulab/` |
| 三段式 | ✅ detect-env + tune + bootstrap | ✅ 复用范式 |
| 自动回滚 | ✅ rollback.sh 快照式 | ✅ 同 |
| 误触锁口令 | `我确认部署` / `我确认回滚` | `重装广州` |

> 域名机不跑训练、不做 VPN 中继、不挂 ali-landing。这台机器就是 guanghulab.com 的对外入口，单线运行，被 `cn-isolation-guard.yml` 强制隔离。

---

## 九、模板版本演进

| 版本 | 时间 | 变更 |
|------|------|------|
| 0.1.0 | 2026-05-08 | (lighthouse-cn 同步) |
| **0.2.0** | **2026-05-09** | **PR-2 落地: 三段式 + autorollback + 误触锁「重装广州」** |
