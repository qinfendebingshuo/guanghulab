# `.archive/` · 已归档的工作流

> 📜 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001

GitHub Actions **不会**运行此目录下的任何 `.yml` 文件 (它们不在 `.github/workflows/` 一级)。
归档不是删除——保留是为了下次需要时能快速复活, 但默认状态: **不跑**。

## 归档清单 (PR-1 · 2026-05-09 · 国内搬家·隔离防火带)

### 一、与"广州 2C2G 单线运行"冲突的 (3 个)

冰朔在 2026-05-09 把 guanghulab.com 解析回广州轻量 2C2G (重装系统), 这台机器**唯一**对外服务。
密钥 `ZY_CN_SERVER_*` 不变但服务器角色已变更, 旧 deploy 流程会污染单线运行。

| 文件 | 归档原因 |
|---|---|
| `deploy-cn-landing.yml` | 原推 cn-landing 静态页 + 注入 4 个国外 LLM 密钥. 新方案下落地页 = portal 动态站, 这个会覆盖 |
| `deploy-to-cn-server.yml` | 原 "备用大脑" 部署. 新方案 PR-2 接管 (deploy-domain-server.yml) |
| `deploy-ali-cn-landing.yml` | 域名备案期间临时挂阿里. 现在域名已回广州, 此 workflow 不再有目标 |

### 二、训练栈 (4 个 · V100 已释放)

冰朔 2026-05-08 提前释放 V100 (cc-001 涌现洁净). 训练已完成, 现在只推理。

| 文件 | 归档原因 |
|---|---|
| `training-bootstrap.yml` | V100 训练机引导. 服务器已释放 |
| `training-auto-run.yml` | push 到 main 时自动训练. 服务器已释放, 风险高 |
| `coding-model-train.yml` | 编程代码模型训练. 已完成 |
| `zhuyuan-training-agent.yml` | 训练 agent. 不再使用 |

注: `training-dashboard.yml` **未归档** — 它只渲染 README 训练仪表盘, 不接触服务器, 且 `data/training/state.json` 已 `frozen=true`, 不会再写入。

## 怎么复活 (如未来需要)

1. `git mv .github/workflows/.archive/<name>.yml .github/workflows/<name>.yml`
2. 检查里面引用的 secrets 是否还在 `scripts/preflight/secrets-manifest.json`
3. 如果该 workflow 引用 `ZY_CN_SERVER_*`, 先在 `scripts/preflight/cn-isolation-allowlist.json` 加白名单
4. PR 提交, CI 会跑 `cn-isolation-guard` 守卫脚本, 通过才能合

---

*📜 隔离防火带 · 守护广州 2C2G 单线运行*

### 三、PR-1 二次扫描发现的 (1 个 · 2026-05-09 16:05)

| 文件 | 归档原因 |
|---|---|
| `deploy-proxy-service.yml` | workflow_dispatch 手动触发, 但 `setup-cn-relay` 动作把 2C2G 当 VPN 中继, 与"单线运行"冲突. 隔离守卫红灯, 决定归档. 未来 VPN 服务可以放别处 |
