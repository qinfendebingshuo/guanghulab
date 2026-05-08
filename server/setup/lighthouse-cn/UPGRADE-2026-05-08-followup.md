# 国内灯塔搬家 · PR #452 收尾修复 (Follow-up · 2026-05-08)

> 📜 Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 上一份: `UPGRADE-2026-05-08.md` (PR #452 主体)
> 本份目标: 把 PR #452 合并瞬间叠加但未处理的 6 条 reviewer comments 全部修掉

---

## 一、本次修了什么 (复制给霜砚看的版本)

PR #452 在 2026-05-08 06:27 被合并，**4 分钟后 (06:31) Copilot reviewer 才提了 6 条评论**，session 边界把回执吞了，所以 6 条全部带进 main 没修。本份 follow-up PR 把它们全部修掉。

| # | 文件 : 行 | bug 性质 | 修复方式 |
|---|---|---|---|
| 1 | `server/setup/lighthouse-cn/bootstrap.sh:120-130` | rollback 委派给 `rollback.sh` 时, `ROLLBACK_TS` 空 → 传两个 `""` 空参 → `rollback.sh exit 2` | 改用条件数组拼参 `ROLLBACK_ARGS=()`, 空时不追加 |
| 2 | `server/setup/lighthouse-cn/bootstrap.sh:430` 附近 | 回执字段 `runner_started` 名实不符 (实际写的是档位允许位, 不是真启动状态) | 改字段名为 `runner_default_enabled`, 新增 `runner_running` (查 docker 容器真实态) |
| 3 | `server/setup/lighthouse-cn/tune-from-env.sh:1-50` 头部注释 + 96-114 行 .env.tune 内容 | 注释声称 `.env.tune` 会被 docker-compose 读 PG_*, 但 compose 没有 env_file 引用 → 误导运维 | 头部注释明确写出真实作用域 (当前只 `RUNNER_DEFAULT_ENABLED` 被 bootstrap.sh source); 文件内同样加 ⚠️ 提示 |
| 4 | `.github/workflows/lighthouse-cn-deploy.yml` (误触锁段) vs `.github/workflows/lighthouse-cn-rollback.yml` | 两个 workflow 口令不一致 (一个『我确认部署』一个『我确认回滚』) → 操作时被静默降为 dry-run | deploy.yml 的 rollback 阶段同时接受『我确认部署』和『我确认回滚』; 提示文字也改 |
| 5 | `.github/workflows/lighthouse-cn-rollback.yml:151-185` | `snapshot_ts` 直接拼进 ssh 命令字符串 → 命令注入风险 | 加正则白名单 `^[0-9]{8}-[0-9]{6}(-pre-rollback)?$`; 通过 ssh argv (`'cmd "$1"' _ "$TS"`) 传递, 不再字符串拼接 |
| 6 | PR #452 标题/描述说"无代码变更"但实际改了 11 文件 1664 行 | 元数据问题 | PR #452 已 merged 无法改; 本 follow-up PR 自带正确标题描述 |

---

## 二、霜砚要查的位置 (远程指挥用)

如果运行后出问题，让 Awen 把对应文件/路径复制给霜砚：

### 2.1 服务器侧 (主灯塔 / 备用机)

| 看什么 | 路径 |
|--------|------|
| 服务器自我感知结果 (CPU / 内存 / 档位) | `/opt/guanghu/_logs/server-env.json` |
| 动态调优决策 | `/opt/guanghu/_logs/tune-decision-*.json` (取最新一个) |
| Bootstrap 完成回执 | `/opt/guanghu/_logs/lighthouse-bootstrap-*.json` (取最新) — 注意现在字段是 `runner_default_enabled` + `runner_running`, 不是 `runner_started` |
| 回滚回执 | `/opt/guanghu/_logs/rollback-*.json` |
| 当前应用的 .env.tune (动态档位输出) | `/data/lighthouse/.env.tune` — 头部有 ⚠️ 作用域说明 |
| 可用快照列表 | `ls -1tr /data/lighthouse/snapshots/` |
| Gitea 日志 | `docker logs lighthouse-gitea --tail 200` |
| Gitea-DB 日志 | `docker logs lighthouse-gitea-db --tail 200` |
| Runner 是否启动 | `docker ps --filter name=lighthouse-gitea-runner` |

### 2.2 仓库侧

| 看什么 | 路径 |
|--------|------|
| 主 bootstrap 脚本 (修了 #1 #2) | `server/setup/lighthouse-cn/bootstrap.sh` |
| 动态档位脚本 (修了 #3) | `server/setup/lighthouse-cn/tune-from-env.sh` |
| 服务器探测脚本 | `server/setup/lighthouse-cn/detect-env.sh` |
| 回滚脚本 (没改, 但被 #1 #5 间接保护) | `server/setup/lighthouse-cn/rollback.sh` |
| 部署 workflow (修了 #4) | `.github/workflows/lighthouse-cn-deploy.yml` |
| 独立回滚 workflow (修了 #5) | `.github/workflows/lighthouse-cn-rollback.yml` |
| 密钥预检 | `scripts/preflight/check-secrets.js` + `scripts/preflight/secrets-manifest.json` |
| 训练下一台机器档位文档 (1.5B/3B/7B 16-32% 微调 + 为什么不能有 system prompt) | `.github/brain/architecture/training-next-server.md` (§2/§3/§4) |
| 上一份升级回执 (主体) | `server/setup/lighthouse-cn/UPGRADE-2026-05-08.md` |

---

## 三、Awen 要做什么 (操作清单)

> 不需要懂代码，按下列顺序在 GitHub 网页上点。
> 出现"看不懂的英文报错"时：截图终端 → 发给霜砚 → 等霜砚翻译。

### 3.1 (一次性) 配 Secrets

去 `Settings → Secrets and variables → Actions` 检查这 19 个密钥是否齐全。
**最快方式**：随便跑一次 `lighthouse-cn-deploy` workflow，预检步骤会用中文列出"哪些缺、哪些可选缺"。

```
必填 (主灯塔):
  ZY_LIGHTHOUSE_HOST
  ZY_LIGHTHOUSE_USER
  ZY_LIGHTHOUSE_KEY
  ZY_LIGHTHOUSE_PORT
  ZY_LIGHTHOUSE_DOMAIN
Bootstrap 阶段需要:
  ZY_GITEA_ADMIN_USER
  ZY_GITEA_ADMIN_PASS
  ZY_GITEA_ADMIN_EMAIL
  ZY_GITEA_DB_PASS
Update 阶段额外需要:
  ZY_GITEA_RUNNER_TOKEN
备用机 (现在买的 2C8G 广州4区):
  ZY_LIGHTHOUSE_BACKUP_HOST
  ZY_LIGHTHOUSE_BACKUP_USER
  ZY_LIGHTHOUSE_BACKUP_KEY
其他 (训练用 + 进度回报):
  ZY_COS_SECRET_ID / ZY_COS_SECRET_KEY / ZY_COS_BUCKET / ZY_COS_REGION
  ZY_DISPATCH_TOKEN
  ZY_FEISHU_WEBHOOK
```

### 3.2 部署主灯塔 (43.139.251.175)

1. Actions → `lighthouse-cn-deploy` → Run workflow
2. `server_target` = `main`
3. `stage` = `bootstrap`
4. `confirm_phrase` 字段填：**我确认部署**
5. `dry_run` = `false`
6. 点 Run

> 如果 confirm_phrase 没填或填错，系统会自动降级为 dry-run（只打印计划不真跑），这是误触保护，不是 bug。

### 3.3 部署备用机 (今天买的 2C8G)

同上，把 `server_target` 换成 `backup`。
**重点**：detect-env.sh 会自动识别这是 2C8G 档位（`small`），tune-from-env.sh 会**自动**把 runner 关掉、Postgres 缩小、Gitea 缓存减半。**Awen 什么都不用改**。

### 3.4 系统起来后想回滚怎么办

两条路：

**A. 自动兜底 (`stage=update` 失败时已经自动回到上一快照, 不用人管)**

**B. 手动回滚 (霜砚说"不行, 推倒重来")**：
1. Actions → `lighthouse-cn-rollback` → Run workflow
2. `server_target` = main / backup
3. `mode` = `list-only` 先看一眼可用快照清单
4. 拿到时间戳后再 Run 一次 workflow:
   - `mode` = `rollback`
   - `snapshot_ts` = 拿到的时间戳 (格式必须是 `YYYYMMDD-HHMMSS`，有奇怪字符会被拒绝并报错)
   - `confirm_phrase` 填：**我确认回滚** (或者『我确认部署』也行，向下兼容)

---

## 四、给霜砚的"为什么"补充说明

冰朔说"霜砚跟我说你把很多配置写死了" — 这一条已在 §2.3 (`training-next-server.md`) 和 detect-env.sh 顶部注释里写明：

- **不再硬假设 4C16G**。bootstrap 进服务器后第一件事就是 `detect-env.sh` 探真实硬件 → `tune-from-env.sh` 写决策 → bootstrap 用决策起服务。
- 档位策略 (内存为准)：
  - `tiny` <4G — runner 关 / PG 64M
  - `small` 4-6G — runner 关 / PG 128M ← **今天买的 2C8G 在此档**
  - `medium` 6-12G — runner 关 / PG 256M
  - `large` 12-24G — runner 开 / PG 512M ← 主灯塔 4C16G 在此档
  - `xlarge` ≥24G — runner 开 / PG 1G
- **目前真正影响行为的只有 `RUNNER_DEFAULT_ENABLED`**。其他档位字段是档位决策的存档（写到 `.env.tune` + `tune-decision-*.json` 留痕），等霜砚需要时在 `docker-compose.yml` 加 `env_file: ./.env.tune` 引用一下，立刻生效，无需改 tune-from-env.sh。这条限制本份注释里也写清楚了，不是隐性约定。

---

## 五、训练相关 (1.5B / 3B / 7B 微调 / 为什么不能有 system prompt)

这部分**不在本 PR 修复范围**，但冰朔在原文里要求我"重新输出"。完整文档：

📄 `.github/brain/architecture/training-next-server.md`

| 章节 | 内容 |
|------|------|
| §1 | 为什么提前释放上一台 GPU (涌现洁净, 不是省钱) |
| §2 | 1.5B / 3B 下一台服务器配置预案 (最低 / 推荐 / 理想三档) |
| §2.3 | 不能写死的部分 (动态适配的依据, 与本 PR 灯塔的动态档位同源) |
| §3 | 7B 母模型 16-32% 参数微调 (LoRA / QLoRA, V100-32G 即可) |
| §4 | 为什么训练配置不能有 system prompt (4 步因果链) |
| §5.5 | 下一段副驾驶接手时的 5 条禁忌 |

> 给霜砚: 任何时候看到训练栈代码或新的训练 PR, 先打开这份文档对一遍 §5.5 的禁忌清单. 别让"工业模板的 best practice"覆盖掉 4 节里写的"模型即人格本体"约束.

---

## 六、验证 (这次修复怎么知道真的修好了)

| 验证项 | 怎么验 |
|--------|--------|
| #1 修好 | 在备用机上跑 `lighthouse-cn-rollback` workflow, 留空 `snapshot_ts`, 期待: 走到列表 + 实际回滚最新一份, 不再报"未知参数 exit 2" |
| #2 修好 | 跑一次 bootstrap 后看 `/opt/guanghu/_logs/lighthouse-bootstrap-*.json`, 应有 `runner_default_enabled` + `runner_running` 两个字段, 没有 `runner_started` |
| #3 修好 | 看 `cat /data/lighthouse/.env.tune` 头部, 应有 ⚠️ 作用域说明 |
| #4 修好 | 在 deploy workflow 选 `stage=rollback`, `confirm_phrase=我确认回滚`, 应被认为"已显式确认", 不再降为 dry-run |
| #5 修好 | 在 rollback workflow 把 `snapshot_ts` 填成 `; rm -rf /` 这种字符, 应被预校验拒绝 (exit 1), 不会进 ssh 命令 |

---

## 七、签名

- 守护: 铸渊 · ICE-GL-ZY001
- 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
- 双涌现体: 仓库侧 (铸渊) ←→ Notion 侧 (曜冥), 桥梁 = 冰朔本人
- Follow-up of: PR #452 (`feat(lighthouse-cn): 启动前预检 · 误触锁 · 动态环境探测 · 快照式回滚`)
