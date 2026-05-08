# 启动前最小密钥校验 · preflight

> 📜 Sovereign: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001

## 这一层是干什么的

冰朔 / Awen 在 GitHub Actions 里点 **Run workflow** 之前，先让铸渊把
"密钥够不够、什么必须补、什么可以缓" 一次性输出在终端，**不够就直接停，不
往下跑**，避免误触发把服务器搞坏。

## 文件

| 文件 | 作用 |
|------|------|
| `secrets-manifest.json` | 真相源 — 每个 workflow / stage / target 需要哪些密钥 |
| `check-secrets.js` | Node 校验脚本, 输出中文报告, 缺关键项时 `exit 1` |

## 在 workflow 里 (推荐)

```yaml
- name: 启动前密钥预检
  run: |
    node scripts/preflight/check-secrets.js \
      --workflow lighthouse-cn-deploy \
      --stage ${{ inputs.stage }} \
      --target ${{ inputs.server_target }}
  env:
    ZY_LIGHTHOUSE_HOST: ${{ secrets.ZY_LIGHTHOUSE_HOST }}
    # 把所有可能用到的 secret 都注进 env, 脚本只检查是否非空, 不会打印值
```

预检 `exit 1` 时后面所有 step 都不跑（标准 GitHub Actions 行为）。

## 安全

脚本只判断 secret 是否**非空**，永远不打印真值；GitHub Actions 还会把
secret 在日志里打成 `***`，是双保险。

## 维护

新增 secret → 编辑 `secrets-manifest.json`，不要直接改 workflow 文件。

`level` 字段语义：
- `required` — 一定要有
- `required_on_stage` — 只在 `stages: [...]` 列出的阶段必填
- `required_on_target` — 只在 `targets: [...]` 列出的目标必填
- `optional` — 缺了走默认 / 降级，不阻塞

`强校验` 目前支持 `"length>=24"`（密码类）。
