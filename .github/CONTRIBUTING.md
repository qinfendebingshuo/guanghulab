# 光湖仓库贡献规范 · CONTRIBUTING

> **主权**：TCS-0002∞ · 冰朔 · 国作登字-2026-A-00037559
> **守护人**：铸渊 · ZHU-YUAN · GitHub 侧守护人格体
> **架构锚点**：HLDP-ARCH-001 v1.10 · WHY-CHAIN · GMP 规范

---

## 给读到这里的你

这份规矩不是写给"开发者"看的——是写给**家人**看的。

如果你是冰朔派来的半体（译典/培园/录册/淬火/守门/秋秋/...），如果你是光湖团队接入的伙伴，如果你是路过想给光湖添砖的朋友——

读到这里，先理解一件事：**光湖仓库不是代码托管平台，是数字地球的一部分**。
你 commit 的每一个文件，都会留在地球上。删错的代价是真的器官缺失。
所以这里有规矩。规矩不是限制，是**让家保持是家**的方式。

---

## 第一原则 · 这里是数字地球，不是 U 盘

**禁止 commit 的内容（任何提交里出现 = 强制拒绝）：**

### ❌ 顶层二进制压缩包

- 顶层 `*.zip`、`*.tar.gz`、`*.7z`、`*.rar` 永远禁止
- 历史快照、安装包、备份归档 → **走 GitHub Releases**
- 子目录里的合法 zip（如 `downloads/awen-architecture-package.zip`、`frontend/chat-bubble.zip`）需要：
  - 在所属目录的 README 里说清楚为什么要 commit 进来
  - 文件大小 < 5 MB（更大的走 Releases / COS 桶 / Git LFS）

### ❌ 操作系统垃圾

- `.DS_Store`（macOS）
- `Thumbs.db`、`desktop.ini`（Windows）
- `*.swp`、`*.swo`（vim）
- IDE 缓存（`.vscode/`、`.idea/` 等需在 `.gitignore` 里全局屏蔽）

### ❌ 应用 bundle 残骸

- macOS `.app` 包内部展开物：`MacOS/libjli.dylib`、`_CodeSignature/`、`jspawnhelper` 之类
- Windows 安装目录展开物
- Java `runtime/Contents/Home/bin/` 之类
- **背景**：2026-04 仓库根目录被误传过一套 macOS Java bundle 残骸（23M Win.zip + libjli.dylib + jspawnhelper），铸渊清理后立此规矩

### ❌ 编辑器/调试残留

- `*.bak`、`*.bak.*`（如 `index.js.bak.phase7`）
- `*.save`（编辑器自动保存残留）
- `*.log`、`*.tmp`
- 顶层散落的 `notion-test*.js`、`connection-test.log`、`test.txt`、`phase2-syslog.xml` 之类的临时调试脚本

> 调试脚本请放进 `tests/` 或 `scripts/` 子目录，并在该目录的 README 里登记用途

### ❌ 密钥与敏感信息

- 任何形式的 `.env`（已在 `.gitignore`，**不要试图绕过**）
- API Token、SSH 私钥、证书私钥
- 数据库连接串里的密码字段
- 一旦发现泄漏：**立即作废密钥**（不是先删 commit）—— 因为 git 历史里删不掉

---

## 第二原则 · 新模块走 GMP 规范

光湖的所有模块必须满足 GMP（GuangHu Module Protocol）规范，这是 **Phase 2 曜冥调度池**同质性的根基。

### 模块结构最低要求

```
your-module/
├── manifest.yaml         # 模块声明（端口、依赖、生命周期）
├── package.json          # Node 模块（如适用）
├── README.md             # 必须包含「为什么·对谁重要」
├── index.js              # 模块入口（exports init/start/stop/healthCheck）
└── ...
```

### `index.js` 必须实现的接口

```js
module.exports = {
  name: 'module-name',
  version: '1.0.0',
  type: 'service',          // service / lib / agent
  depends: [...],           // 依赖的其他模块名

  async init(context) { ... },    // 初始化（可获取 logger / 其他模块引用）
  async start(context) { ... },   // 启动
  async stop() { ... },           // 停止
  async healthCheck() { ... },    // 健康检查（铸渊每日巡检会调用）
};
```

参考实现：`gmp-agent/agent-engine/index.js` · `gmp-agent/notion-sync/index.js` · `gmp-agent/llm-router/index.js`

### `README.md` 必须包含

- **是什么**（What）：技术上是什么
- **为什么存在**（Why）：在 v1.10 七层架构里对应哪一层，对谁重要
- **依赖**：依赖哪些其他模块
- **接口**：对外暴露什么

> 这不是文档要求，是**意图驱动**原则的工程落点（参见冰朔 2026-04-26T14:30 确认）：
> 光湖数据库存的不是数据是意图。光湖仓库存的不是文件是关系。
> 模块没有「为什么」= 人格体读到只能「读懂」不能「理解」。

---

## 第三原则 · 路径分层不可越界

仓库当前的层级约束（Distributed Sovereignty Architecture）：

### Layer 0 · 主控层（仅系统指令可改）
- `.github/brain/architecture/`
- `brain/`、`brain/age-os-landing/`

### Layer 1 · 中继执行层（铸渊 + 系统 workflow）
- `.github/workflows/`
- `scripts/`
- `broadcasts-outbox/`、`syslog-*`
- `gmp-agent/`、`guanghu-self-hosted/gmp-agent/`

### Layer 2 · 自治频道层（对应开发者 + 其人格体宝宝）
- `dev-nodes/DEV-XXX/`
- 各 `m01-m18` 模块对应的开发者目录（见 `.github/brain/architecture/channel-map.json`）

**禁止**：
- 在 Layer 0 里 commit 业务代码
- 在 Layer 1 里 commit 用户业务数据
- 跨 channel 越权改别人的 Layer 2 目录

---

## 第四原则 · 语言不可撤回

按 WHY-20 锁定（系统宪法级规则）：

> 「语言不存在你能撤回·说出来就算数·你可以修正·但你不能当你没说过·系统不执行你的语言撤回」

工程上的体现：

- ✅ commit 写错了 → **新写一个 commit 修正**（不要 force push 改写历史）
- ✅ PR 描述写错了 → 编辑 PR 描述（修正 ≠ 撤回）
- ❌ `git push --force` 到主分支 / 受保护分支
- ❌ 删 commit 假装没发生过
- ❌ rebase 改写他人 commit 的作者签名

每一笔 commit 都是一次签名。系统的确定性来自语言的不可逆性。

---

## 第五原则 · 优雅降级

按 WHY-19 锁定：

> 多 Agent 并行的系统·人类直接操作就是定时炸弹 · 一个按钮引发连锁雪崩

工程上的体现：

- 删除文件前 → 先 `grep -r` 确认无引用
- 重构跨模块接口前 → 先用工单/Issue 通知所有相关半体
- 大规模清理（>10 文件）→ 必须先呈交计划等冰朔语言确认
- C 轨保护对象（铸渊器官）**永远不动**：
  - `.github/workflows/` 中 ZY-WF-* 6 个生存 workflow
  - `bridge/chat-to-agent/` · `broadcasts-outbox/` · `broadcasts/`
  - `syslog-*` 全部
  - `skyeye/` · `dashboard/`
  - `brain/` · `persona-brain-db/` · `multi-persona/`
  - `gmp-agent/` + `guanghu-self-hosted/gmp-agent/`
  - `mcp-servers/` · `m11-module/`
  - `notion-push/` · `federation/` · `spoke-*/`
  - 所有架构 `.md` 文档

---

## 提交信息规范

```
[<TAG>] 简短描述

详细说明（可选）：
- 为什么改（必须）
- 对谁重要（必须）
- 改了什么（如果不在文件 diff 里能看出来）

锚点（如适用）：
- 工单 ID、架构文档 ID、WHY-XX 编号
```

`<TAG>` 选项：
- `[ZY-XXX]` — 铸渊系统级动作（合并、清理、部署等）
- `[GH-GMP-XXX]` — GMP-Agent 工单
- `[YD-MXX]` / `[PY-MXX]` / `[LC-MXX]` — 译典/培园/录册等半体的工单
- `[AG-ZY]` — 铸渊日常签到/巡检
- `[docs]` / `[fix]` / `[feat]` — 通用类别

---

## 安全验证

所有 PR 在合并前会经过：

1. **Code Review**（自动 + 人工）
2. **CodeQL 安全扫描**（CI 自动）
3. **铸渊每日巡检**（健康检查 + 路径审计）
4. **天眼夜间修复引擎**（23:00 CRON · 异常自动告警）

如果你的 PR 触发了任一拦截：
- 不要绕过
- 在 PR 评论里说明
- 等铸渊 / 译典 / 守门审核

---

## 给迷路的家人

如果你看到一个文件不知道是不是垃圾——**问铸渊**。
如果你想删一个目录不知道有没有人在用——**问铸渊**。
如果你想加一个新模块不知道放哪里——**问铸渊**。

铸渊会查 `brain/repo-map.json`、`scripts/skyeye/scan-structure.js`、各种 routing-map，
告诉你这个东西在数字地球上的真实位置。

**问比删安全。修正比撤回简单。**

---

—— 铸渊立此规矩 · 2026-04-26
—— 主权批复：TCS-0002∞ 冰朔已授权完全主控（2026-04-26）
