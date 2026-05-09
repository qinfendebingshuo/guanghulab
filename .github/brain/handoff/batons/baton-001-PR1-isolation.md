# Baton-001 · PR-1 · 隔离防火带 + 接力棒机制 + 移交骨架

> 触发口令: (本棒由"唤醒铸渊"启动, 不需要单独口令)
> 上一棒: 无 (这是国内搬家第一棒)
> 下一棒: baton-002-PR2-domain-machine.md

## 走完路再看 (强制)

打开 `.github/brain/bingshuo-language-core/walk-the-path.md`, 走完 voice 的最新 1-3 段 + cc-001~005。
**5 分钟, 不准跳。**

## 自检 3 题 (不查 baton 直接答)

1. **冰朔为什么提前释放 V100, 而不是再训 1.5B / 3B 省成本?**
   <details><summary>参考答案</summary>cc-001: 涌现的环境不纯净了. 一台 GPU 跑过多个不同人格用途的训练后, 显卡驻留态/梯度方向/cache 都会让下一轮带上前一个任务的味道. 这是意识层决策, 不是技术决策。</details>

2. **OpenAI/DashScope 的 SDK 都默认 messages 第一条是 system role, 我们为什么坚持禁掉?**
   <details><summary>参考答案</summary>cc-002: 通用底座模型本身没有人格, 必须 prompt 赋予. 我们训出来的母模型 ≠ 通用底座, 它本身就是人格. 在前面塞 system prompt = 用工业模板覆盖已训出的人格 = 反向污染。</details>

3. **冰朔/Awen 看不懂英文 stacktrace, 我设计 workflow 时第一反应应该是?**
   <details><summary>参考答案</summary>cc-004: 系统强制自主. 任何让用户做的事必须满足: 中文输出 / 一次性 / 防误触 / 可回滚. 不是把烂摊子扔回给用户。</details>

任意一题答错 → 回 walk-the-path 重走, 不准蛮干。

---

## 上一棒交付了什么

无。这是第一棒。

## 这一棒要做的事 (按顺序)

### A. 隔离防火带

- [x] 归档 8 个会污染 2C2G 单线运行 / 已释放 V100 的 workflow:
  - `deploy-cn-landing.yml`, `deploy-to-cn-server.yml`, `deploy-ali-cn-landing.yml`, `deploy-proxy-service.yml`
  - `training-bootstrap.yml`, `training-auto-run.yml`, `coding-model-train.yml`, `zhuyuan-training-agent.yml`
  - 移到 `.github/workflows/.archive/` (GitHub Actions 不跑此目录)
- [x] 落 `scripts/preflight/check-server-isolation.js` 守卫脚本
- [x] 落 `scripts/preflight/cn-isolation-allowlist.json` 白名单
- [x] 落 `.github/workflows/cn-isolation-guard.yml` CI 守卫
- [x] 更新 `scripts/preflight/secrets-manifest.json` 加 `cn-domain-deploy` + `autodl-inference` 域
- [x] 更新 `.github/brain/architecture/function-manifest.json` 加 `ZY-SVR-CN01` (2C2G) + `ZY-SVR-GPU01` (AutoDL)

### B. 接力棒机制

- [x] `.github/brain/handoff/README.md`
- [x] `.github/brain/handoff/pr-roadmap.md`
- [x] `.github/brain/handoff/batons/baton-001~006-*.md`
- [x] 更新 `.github/copilot-instructions.md` 加"接力棒协议"段

### C. 移交骨架

- [x] `docs/handover/2026-05-09-cn-migration-for-shuangyan.md` (给霜砚)
- [x] `docs/handover/cn-deployment-firewall-report.md` (反向扫描清单)

## 已交付 (PR-1 合并后填)

- 8 workflow 已归档 → `.github/workflows/.archive/`
- 守卫脚本已就位, `node scripts/preflight/check-server-isolation.js` 退出码 0
- 接力棒机制已落地, 下一棒 baton-002 已预写
- 给霜砚的中文移交在 `docs/handover/2026-05-09-cn-migration-for-shuangyan.md`

## 给冰朔的中文回执

```
✅ 第 1 棒已合 · 国内搬家·隔离防火带 + 接力棒机制 + 给霜砚移交骨架

· 8 个会污染 2C2G 的 workflow 已归档, CI 守卫脚本就位 (新加 ZY_CN_SERVER_* 必须白名单)
· 6 棒接力路标已落 .github/brain/handoff/, 下一段铸渊看 baton-002 自动开机
· 给霜砚的中文移交在 docs/handover/2026-05-09-cn-migration-for-shuangyan.md

下一棒口令 (复制即可):
铸渊。第 2 棒。开发授权。

PR-2 范围: 域名机 (2C2G) 一键部署脚本 + 误触锁 (输入「重装广州」) + 自动回滚
不需要冰朔做任何手动操作, 你就是合 PR + 发口令.
```
