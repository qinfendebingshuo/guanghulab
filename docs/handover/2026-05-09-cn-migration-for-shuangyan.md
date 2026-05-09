# 给霜砚 · 国内搬家进度移交 (2026-05-09 · PR-1)

> 📜 主权: TCS-0002∞ · ICE-GL∞ · 国作登字-2026-A-00037559
> 守护: 铸渊 · ICE-GL-ZY001
> 接收人: 霜砚 (冰朔的另一个开发副驾驶, 接管 2C2G 上小 bug 排查)

霜砚你好, 这是国内搬家·6 棒里的第 1 棒, 我先在这里给你建好骨架, 后面 5 棒每合一棒我会回来追加新段。

## 一、背景 (你需要先知道的)

冰朔在 2026-05-09 把 guanghulab.com 解析回**广州轻量 2C2G** (重装系统), 这台机器现在是**唯一**对外服务器。
GPU 推理在 **AutoDL** 上租 (动态机, 关机即释放). 模型在 COS 桶 `sy-finetune-corpus-1317346199`。

> ⚠️ 关键: 不是原来的 4C16G 主灯塔 (那台叫 GH-CVM-MAIN-PROD-01, 仍在用, 不动它). 是 2C2G 这台新的, 编号 **ZY-SVR-CN01** / 物理别名 **GH-CVM-DOMAIN-PROD-01**。

## 二、PR-1 我做了什么

### 1. 隔离防火带

仓库里几十个 deploy-* workflow, 其中 8 个会污染 2C2G 单线运行 / 推到已释放的 V100, 我归档了:

| 文件 | 现在在哪 | 归档原因 |
|---|---|---|
| `deploy-cn-landing.yml` | `.github/workflows/.archive/` | push 触发, 推 ZY_CN_SERVER_*, 会覆盖 portal |
| `deploy-to-cn-server.yml` | `.archive/` | 旧 "备用大脑" 部署, 被 PR-2 取代 |
| `deploy-ali-cn-landing.yml` | `.archive/` | 域名已回广州, 阿里不再目标 |
| `deploy-proxy-service.yml` | `.archive/` | VPN 中继跟单线运行冲突 |
| `training-bootstrap.yml` | `.archive/` | V100 已释放 |
| `training-auto-run.yml` | `.archive/` | V100 已释放, push 触发风险高 |
| `coding-model-train.yml` | `.archive/` | 训练完成 |
| `zhuyuan-training-agent.yml` | `.archive/` | 训练完成 |

`.archive/` 目录的 yml 文件 GitHub Actions **不会运行**。要复活, `git mv` 出来即可。

### 2. CI 守卫脚本

新增 `scripts/preflight/check-server-isolation.js` + `cn-isolation-allowlist.json`。
任何新工作流引用 `secrets.ZY_CN_SERVER_*` 必须先加白名单, 否则 CI 红灯。

健康检查命令 (随时可跑):

```bash
node scripts/preflight/check-server-isolation.js
# 期望最后一行: [OK] 隔离守卫通过 · 广州 2C2G 单线运行已守住
```

### 3. 编号体系

`.github/brain/architecture/function-manifest.json` 新登记:
- `ZY-SVR-CN01` (2C2G · isolation=exclusive)
- `ZY-SVR-GPU01` (AutoDL · 动态)

健康检查命令:

```bash
node scripts/manifest/validate.js --strict
# 期望: errors: 0, warnings: 0
```

### 4. 接力棒机制

我给自己写了"自动唤醒下一段"的协议在 `.github/brain/handoff/`。
冰朔每次只发"铸渊。第 N 棒。开发授权。", 下一段铸渊就能精确接力。

这跟你没直接关系, 但你如果接到冰朔的"铸渊不回应了"求助, 可以告诉他:
> 试试发"下一棒"或"铸渊。第 N 棒。开发授权。"

## 三、健康检查命令对照表 (中文)

| 你想看什么 | 命令 | 期望结果 |
|---|---|---|
| 国内 2C2G 是否被守住 (没有非授权 deploy) | `node scripts/preflight/check-server-isolation.js` | EXIT=0 |
| 编号体系是否一致 | `node scripts/manifest/validate.js --strict` | errors:0 |
| 密钥预检 (cn-domain-deploy 工作流) | `node scripts/preflight/check-secrets.js --workflow cn-domain-deploy --stage bootstrap` | [OK] |
| 哪些 workflow 引用了 ZY_CN_SERVER_* | `grep -l 'ZY_CN_SERVER_' .github/workflows/*.yml` | 应该是空 (PR-2 后会有 1 个) |
| 哪些 workflow 已归档 | `ls .github/workflows/.archive/` | 8+ 个 |

## 四、常见报错 → 中文意思 → 修复方法

### A. CI 红灯: "isolation-guard FAILED"

**英文报错**: `[STOP] 发现 N 处未授权引用`
**中文意思**: 有人新加 / 没归档 一个引用 ZY_CN_SERVER_* 的 workflow, 不在白名单
**怎么修**:
1. 看脚本输出的文件名
2. 该 workflow 应该被授权? → 加到 `scripts/preflight/cn-isolation-allowlist.json` 的 `cn_server_workflows`, 写清 reason
3. 该 workflow 不该用? → `git mv .github/workflows/<name>.yml .github/workflows/.archive/<name>.yml`

### B. CI 红灯: "manifest-validate FAILED"

**英文报错**: `validation failed: ...`
**中文意思**: function-manifest.json 不符合 schema (一般是漏字段或 ID 格式不对)
**怎么修**:
1. 看 `node scripts/manifest/validate.js --strict 2>&1` 输出
2. 字段缺了就照 `function-manifest.schema.json` 补
3. ID 必须 `ZY-SVR-XXX` 或 `ZY-FN-NNNN` 格式

### C. 部署失败 / nginx 报错

PR-2 之后会有 `/data/guanghulab/_logs/deploy-report.md` 中文报告, 直接看这个就行。
**不要**叫冰朔截 nginx -t 的英文 stacktrace。

## 五、冰朔需要手动操作的 (PR-1 阶段)

PR-1 完全自动, 冰朔不需要做任何事。**直接合 PR 即可**。

后续棒会有手动操作 (例如 PR-2 的"输入'重装广州'触发部署"), 我会在每一棒的回执里明确告诉冰朔。

## 六、怎么联系铸渊

正常 case: 冰朔发口令 "铸渊。第 N 棒。开发授权。" → 副驾驶起一段铸渊接力。

异常 case (铸渊回答跑偏 / 不走 walk-the-path): 直接告诉冰朔:
> "铸渊好像没走 walk-the-path 就开干了, 让他重新唤醒一次"

冰朔可以用唤醒指令重启:
> "铸渊, 唤醒, 走冰朔语言核, 然后看 baton-NNN"

---

## PR-2 ~ PR-6 我会在合并时追加的段

(每一棒合并后我会回来在这下面 append 一段, 描述这一棒落了什么 + 健康检查 + 中文报错对照)

### PR-2 · 域名机一键部署 (待补)

### PR-3 · AutoDL 推理 Agent (待补)

### PR-4 · 双层 Web Portal (待补)

### PR-5 · 自部署密钥管理页 (待补)

### PR-6 · 仓库搬家包 + Forgejo (待补)

---

*🪶 铸渊 · ICE-GL-ZY001 · 守护至下一次唤醒*
