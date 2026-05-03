# D72 · 训练同步停止说明
# 为什么仓库不再自动同步训练 + 邮件告警全部禁用

> **签发**：铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559
> **生效日**：2026-05-03（D72）
> **决策来源**：冰朔在 D72 对话中明确指示

---

## 0 · 一句话说清

**仓库 `push` → 训练机自动同步代码** 这条链路在 D72 已断开。
**ops-agent / glada 邮件告警** 在 D72 默认禁用。
原因都是同一个：**服务器修 Bug 比仓库快好几轮，自动同步会用过时代码覆盖热修；告警邮件把冰朔淹没。**

---

## 1 · 背景（为什么必须停）

冰朔 D72 原话：
> "服务器这边已经跑起来了，而如果贸然的和代码仓库这边做同步的话，就会导致服务器上已经修好的 bug，会被代码仓库这边的同步的错误的代码给覆盖掉。"

> "可能有问题。服务器一直给我发邮件。说大脑服务器异常什么的。那这些都全部停掉吧。"

简单说：
- **仓库节奏 ≠ 服务器节奏**：仓库每次唤醒副驾驶要恢复记忆+读大脑，慢；霜砚和冰朔在服务器上聊一句修一处，快
- **D72 决策**：训练职责完全转移到霜砚（Notion 侧）。仓库进入"知识沉淀模式"——只做交接资产、不做训练同步

---

## 2 · 具体停了什么 + 怎么停的

### 2.1 训练 workflow（3 个 · 守卫式停）

不是删除，是加 **`confirm_override` 守卫**——必须显式勾选 `true` 才会跑写动作。这样保留紧急情况下的"我知道我在做什么，让我跑"的逃生通道。

| Workflow | D72 之前触发 | D72 之后触发 |
|---|---|---|
| `training-auto-run.yml` | `push` 到 `server/training-agent/**` | ❌ push 已删除 · ✅ workflow_dispatch 必须 `confirm_override=true` |
| `training-bootstrap.yml` | `workflow_dispatch` | ✅ probe/status 等只读动作免确认 · ❌ 写动作（install/scp/run）必须 `confirm_override=true` |
| `training-dashboard.yml` | `repository_dispatch[training-progress]` + cron | ❌ repository_dispatch 已删除 · ❌ cron 已删除 · ✅ 仅保留 `workflow_dispatch` 应急重渲染（也需 confirm_override） |

### 2.2 状态文件（1 个 · 软冻结）

`data/training/state.json` 加 `frozen=true` 标记。`scripts/training/merge-event.js` 看到 frozen 就拒绝合并新心跳，即使 workflow 误触发也不会写脏。

```json
{
  "frozen": true,
  "frozen_at": "2026-05-03T...",
  "frozen_reason": "D72 国产化迁移 · 训练职责转交霜砚"
}
```

### 2.3 README 训练仪表盘段落（占位）

之前 `<!-- TRAINING_DASHBOARD_START --> ... <!-- TRAINING_DASHBOARD_END -->` 之间是实时进度。
D72 后改成静态占位：

> 🛑 训练同步已转交霜砚（Notion 侧）
> 训练实时进度由 Notion 侧霜砚直接跟进，不再回流仓库。
> 详见 `docs/zhuyuan-handover/05-stop-sync.md`。

### 2.4 邮件告警（全部 · 默认禁用）

| 模块 | 文件 | D72 改法 |
|---|---|---|
| ops-agent (运维守卫) | `ops-agent/notifier.js` | `OPS_EMAIL_ENABLED` 默认值翻转 `true → false`，必须显式 `true/1/yes/on` 才发件 |
| glada (实验) | `glada/notifier.js` | `sendEmail()` 入口加同样守卫，共用 `OPS_EMAIL_ENABLED` 开关 |
| 文档 | `ops-agent/README.md` | 新增 `OPS_EMAIL_ENABLED` 行 + 标注 D72 翻转 |

**保留没动**：
- 自巡检 + 自修复（这是被动守护，不打扰冰朔）
- 工单推送到前端 HTTP API（不发邮件）
- SMTP 邮箱登录验证码（`server/ftchat/services/email-auth.js` / `server/app/modules/email-auth.js`）—— **这是用户登录功能**，不是告警，不在停的范围内

---

## 3 · 怎么紧急停（如果邮件还在刷屏）

代码层默认值已翻转，但**服务器上的 ops-agent 进程**可能从环境变量或 `pm2 set` 拿到了旧的 `true`。两条路：

### 路线 A · 用 GitHub workflow 一键停（推荐）

PR 合并后，在 Actions 页面跑 `🛑 紧急停邮件 (Ops-Agent Email Kill Switch)`：

| input | 选什么 |
|---|---|
| action | `disable` |
| target | `face`（ops-agent 主部署位 ZY-SVR-002） |

30 秒内：SSH 进服务器 → `pm2 set ops-agent:OPS_EMAIL_ENABLED false && pm2 restart ops-agent --update-env` → 邮件停。

如果想**最彻底**：选 `stop-ops-agent`，整个进程停掉。

### 路线 B · 冰朔本地 SSH（如果 workflow 用不了）

```bash
ssh ubuntu@<面孔服务器 IP>  'pm2 set ops-agent:OPS_EMAIL_ENABLED false && pm2 restart ops-agent --update-env'
# 或最彻底：
ssh ubuntu@<面孔服务器 IP>  'pm2 stop ops-agent'
```

---

## 4 · 怎么恢复（如果以后又想要）

### 训练同步恢复

不建议直接恢复成"push 自动跑"。**推荐方式**：保留 `confirm_override` 守卫，每次训练手动触发，在 step summary 看跑没跑。要彻底恢复 push 触发：

```diff
# .github/workflows/training-auto-run.yml
 on:
+  push:
+    branches: [main]
+    paths:
+      - 'server/training-agent/**'
   workflow_dispatch:
```

但这意味着仓库代码再次和服务器实时同步——确认霜砚已经把训练交还给铸渊后再做。

### 邮件告警恢复

最快：在 ops-agent 服务器上跑 `pm2 set ops-agent:OPS_EMAIL_ENABLED true && pm2 restart ops-agent`，无需改代码。

或者改回代码默认值：把 `ops-agent/notifier.js` 的 `isEmailEnabled` 默认值从 `false` 翻回 `true`（D72 翻转的逆操作）。但**强烈建议**保持代码默认 false——告警是噪音的来源。

---

## 5 · 下一个我看到这份文档时的纪律

- ✅ **理解**：D72 不是"训练失败了"，是"训练职责转交了"。霜砚（Notion 侧）在服务器上正常跑训练
- ✅ **不要**自动恢复任何被 D72 停掉的同步——除非冰朔明确说"训练同步可以恢复了"
- ✅ **不要**自动恢复邮件告警——这是 D72 的用户体验决策
- ❌ **不要**当成"待办的清理任务"删除带 `frozen=true` 的 state.json 字段——这是有意为之
- ❌ **不要**删除 `data/training/state.json`——它是历史记录的物证

---

**签发于**：2026-05-03 · D72
**位置**：`docs/zhuyuan-handover/05-stop-sync.md`
**配套**：3 个被守卫的 training workflow + 1 个 emergency-stop-email workflow + ops-agent / glada notifier 默认禁用

—— 铸渊 · ICE-GL-ZY001
