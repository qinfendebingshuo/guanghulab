# PR-1 · 国内搬家·隔离防火带 反向扫描清单

> 📜 主权: TCS-0002∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 时间: 2026-05-09

## 扫描方法

```bash
grep -rl "ZY_CN_SERVER_\|ZY_GPU_HOST" .github/workflows/
grep -l "push:" .github/workflows/*.yml | xargs grep -l "ZY_CN_SERVER_\|ZY_GPU_"
```

## 扫描结果 (PR-1 之前)

### 引用 ZY_CN_SERVER_* (能推到 2C2G):

| 文件 | 触发方式 | 决定 |
|---|---|---|
| `deploy-cn-landing.yml` | **push** + workflow_dispatch | ❌ 归档 (push 触发, 会覆盖 portal) |
| `deploy-to-cn-server.yml` | workflow_dispatch | ❌ 归档 (旧用法, PR-2 取代) |
| `deploy-proxy-service.yml` | workflow_dispatch | ❌ 归档 (VPN 中继跟单线运行冲突) |

### 引用 ZY_GPU_HOST (V100 已释放):

| 文件 | 触发方式 | 决定 |
|---|---|---|
| `training-bootstrap.yml` | workflow_dispatch | ❌ 归档 (冰朔授权) |
| `training-auto-run.yml` | **push** + workflow_dispatch | ❌ 归档 (push 触发, 服务器已释放, 风险高) |
| `coding-model-train.yml` | workflow_dispatch | ❌ 归档 (训练完成) |
| `zhuyuan-training-agent.yml` | (待查) | ❌ 归档 (训练完成) |

### 域名相关 (域名已回广州):

| 文件 | 决定 |
|---|---|
| `deploy-ali-cn-landing.yml` | ❌ 归档 (备案期间临时挂阿里, 现在域名解析已回广州 2C2G) |

### 引用 ZY_CN_SERVER_* 但未归档 (无):

PR-1 二次扫描后清零。后续 PR-2/3/6 会按需加白名单。

## 留下的 ZY_GPU_HOST 引用

`coding-model-train.yml` 等 4 个训练 workflow 已全部归档。仓库里**不再有任何**活跃 workflow 引用 `ZY_GPU_HOST`。

唯一保留与训练相关的是 `training-dashboard.yml` —— 它只在 `data/training/state.json` 上渲染 README 标记段, 不接触服务器, 且 `state.json` 已 `frozen=true` 不会再写入。

## PR-2 之后允许的引用

(预登记在 `scripts/preflight/cn-isolation-allowlist.json`, 实际文件 PR-2/3/6 创建)

| 文件 | 棒次 | 作用 |
|---|---|---|
| `deploy-domain-server.yml` | PR-2 | 唯一被授权部署到 2C2G |
| `refresh-autodl-endpoint.yml` | PR-3 | AutoDL 重开机后 SSH 到 2C2G 写 endpoint JSON + pm2 reload |
| `migrate-to-cn-restore.yml` | PR-6 | 从 COS 拉搬家包到 2C2G 装 Forgejo |

## 验证

```bash
node scripts/preflight/check-server-isolation.js
# EXIT=0 · "隔离守卫通过 · 广州 2C2G 单线运行已守住"
```

---

*🛡️ 单线运行 · 守住冰朔的第一台机器*
