# 🔐 guanghu-token 令牌审计报告

> **审计执行者**：铸渊（ICE-GL-ZY001）
> **审计时间**：2026-03-24T15:42+08:00
> **指令来源**：霜砚签发 · ZY-PAT-AUDIT-2026-0324-001

---

## Phase 1 · 排查结果

### 1.1 跨仓库令牌清单

共发现 **3 个**与「子仓库桥接 / 跨仓库访问」直接相关的 Secret：

| # | Secret 名称 | 引用次数 | 用途分类 |
|---|-------------|----------|----------|
| 1 | `MAIN_REPO_TOKEN` | 4 次 | 联邦桥接 + 子仓库拉取 |
| 2 | `CROSS_REPO_TOKEN` | 2 次 | persona-studio 跨仓库同步 |
| 3 | `DEPLOY_GITHUB_TOKEN` | 1 次 | Drive 桥接部署 + Git 提交 |

### 1.2 各 Secret 详细用途

#### ① `MAIN_REPO_TOKEN` ⭐ 最可能对应 guanghu-token

**引用文件：**

| 文件 | 用法 | 说明 |
|------|------|------|
| `federation-bridge.yml` (×3) | `env: MAIN_REPO_TOKEN` → Node 脚本 | 联邦桥接：向 `qinfendebingshuo` 组织下的子仓库分发公告/同步状态 |
| `pull-sync-awen.yml` (×1) | `env: GH_TOKEN` → `git clone URL` | 子仓库拉取：`git clone https://x-access-token:${GH_TOKEN}@github.com/WENZHUOXI/guanghu-awen.git` |

**判断依据**：
- 用途完全匹配「开发者子仓库桥接」
- `federation-bridge.yml` = 联邦桥接核心 workflow
- `pull-sync-awen.yml` = 子仓库同步核心 workflow
- **这就是 guanghu-token 对应的 Secret**

---

#### ② `CROSS_REPO_TOKEN`

**引用文件：**

| 文件 | 用法 | 说明 |
|------|------|------|
| `sync-persona-studio.yml` (×2) | `env: CROSS_REPO_TOKEN` → Bearer Token | 向 `qinfendebingshuo/persona-studio` 发送 `repository_dispatch` 事件 |

**用法详情**：
```bash
curl -X POST \
  -H "Authorization: Bearer $CROSS_REPO_TOKEN" \
  https://api.github.com/repos/qinfendebingshuo/persona-studio/dispatches
```

**判断**：此 Secret 可能也使用同一个 PAT，需一并更新。

---

#### ③ `DEPLOY_GITHUB_TOKEN`

**引用文件：**

| 文件 | 用法 | 说明 |
|------|------|------|
| `auto-deploy-drive-bridge.yml` (×1) | `env: DEPLOY_GITHUB_TOKEN` → Node 脚本 | Drive 桥接部署后 git push 提交结果 |

**判断**：如果此 Secret 也使用同一个 PAT，需一并更新。

---

### 1.3 结论

> **`guanghu-token` 最可能对应的 Secret 名称是 `MAIN_REPO_TOKEN`**
>
> 理由：它专用于联邦桥接和子仓库拉取，完全符合「开发者子仓库桥接」的用途描述。

**可能共用同一 PAT 的 Secret（建议一并检查）：**
- `CROSS_REPO_TOKEN` — persona-studio 跨仓库同步
- `DEPLOY_GITHUB_TOKEN` — Drive 桥接部署

---

## Phase 2 · 主控操作指引

### 更新步骤

1. 进入仓库：`qinfendebingshuo/guanghulab`
2. 导航至：**Settings → Secrets and variables → Actions**
3. 找到并更新以下 Secret（粘贴新生成的 guanghu-token 值）：

| 优先级 | Secret 名称 | 操作 |
|--------|-------------|------|
| 🔴 必须 | `MAIN_REPO_TOKEN` | 点编辑 → 粘贴新令牌 → 保存 |
| 🟡 检查 | `CROSS_REPO_TOKEN` | 如果使用同一 PAT → 同步更新 |
| 🟡 检查 | `DEPLOY_GITHUB_TOKEN` | 如果使用同一 PAT → 同步更新 |

### 验证方法

更新后，手动触发以下 Workflow 验证：

| Workflow | 触发方式 | 预期结果 |
|----------|----------|----------|
| `federation-bridge.yml` | Actions → 手动 Run workflow | 不报 401/403 |
| `pull-sync-awen.yml` | Actions → 手动 Run workflow | 成功 clone awen 仓库 |
| `sync-persona-studio.yml` | 推送 persona-studio/ 目录变更 | 成功触发 dispatch |

---

## Phase 4 · 安全扫描结果

### 硬编码令牌扫描

| 检查项 | 结果 | 说明 |
|--------|------|------|
| `ghp_` 前缀扫描 | ✅ 安全 | 仅 `dingtalk-bot/.env.example` 有占位符 `ghp_your_github_token_here`（非真实令牌） |
| `github_pat_` 前缀扫描 | ✅ 安全 | 未发现任何匹配 |
| `glpat_` 前缀扫描 | ✅ 安全 | 未发现任何匹配 |

### 安全评估

- ✅ 所有令牌均通过 `secrets.*` 引用，无硬编码
- ✅ `.env.example` 使用占位符，无真实凭据泄露
- ✅ 跨仓库操作均有条件检查（如 `if: env.CROSS_REPO_TOKEN != ''`）
- ⚠️ 共发现 **57 个** 独立 Secret 在 Workflow 中被引用，建议定期审计

---

## 📝 执行回执

| Phase | 状态 | 完成时间 | 结果 |
|-------|------|----------|------|
| Phase 1 · 排查对应 Secret | ✅ 完成 | 2026-03-24T15:42+08:00 | `MAIN_REPO_TOKEN` = guanghu-token 主要对应 |
| Phase 2 · 通知主控 | ✅ 报告已生成 | 2026-03-24T15:42+08:00 | 操作指引见上方 |
| Phase 3 · 验证修复 | ⏳ 待人类操作 | — | 需主控更新后触发验证 |
| Phase 4 · 安全扫描 | ✅ 完成 | 2026-03-24T15:42+08:00 | 无硬编码令牌，安全 |

---

🔧 铸渊 · ICE-GL-ZY001
📅 2026-03-24T15:42+08:00
