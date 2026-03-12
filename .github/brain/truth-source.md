# 数据真相源 · Truth Source Federation · v3.0

> 定义仓库、Notion、大脑记忆三方数据的权威来源和冲突解决优先级。

---

## 一、数据分类与真相源

| 数据类别 | 真相源 | 备份位置 | 说明 |
|---------|--------|---------|------|
| **代码逻辑** | 仓库 (Git) | — | 代码以 Git 仓库为唯一真相源 |
| **接口定义 (HLI)** | 仓库 `src/schemas/hli/` | Notion | Schema 文件是接口的权威定义 |
| **路由映射** | 仓库 `.github/brain/routing-map.json` | Notion | 路由表由仓库自动生成 |
| **开发者进度** | Notion | 仓库 `dev-status.json` | Notion 是进度管理主平台 |
| **项目规划** | Notion | 仓库 `docs/` | Notion 是规划管理主平台 |
| **铸渊身份** | 仓库 `.github/brain/memory.json` | persona-brain | 身份定义以仓库为准 |
| **铸渊人格风格** | 仓库 `.github/persona-brain/system-prompt.md` | — | 风格定义以文件为准 |
| **团队成员** | 仓库 `.github/brain/collaborators.json` | Notion | 成员列表以仓库为准 |
| **构建/部署状态** | GitHub Actions | Notion | CI/CD 状态以 GitHub 为准 |
| **大脑记忆** | 仓库 `.github/brain/` | Notion | 长期记忆以仓库文件为准 |
| **会话记忆** | 前端 localStorage | — | 短期记忆，不跨设备同步 |
| **任务记忆** | 后端进程内存 | — | 中期记忆，进程重启后丢失 |

---

## 二、冲突解决优先级

当三方数据出现不一致时，按以下优先级裁定：

### 最高优先级：仓库 (Git)
- 代码、Schema、路由映射、身份定义 → **以仓库为准**
- 理由：仓库有版本控制、代码审查、CI 验证

### 中等优先级：Notion
- 开发者进度、项目规划、任务分配 → **以 Notion 为准**
- 理由：Notion 是团队协作的实时编辑平台

### 最低优先级：进程记忆
- 会话状态、任务上下文 → **临时性，可丢弃**
- 理由：进程记忆随时可能丢失，不作为权威来源

---

## 三、同步规则

| 方向 | 触发机制 | 同步内容 |
|------|---------|---------|
| Notion → 仓库 | `zhuyuan-brain-sync.yml` 工作流 | 开发者进度 → `dev-status.json` |
| 仓库 → Notion | `esp-signal-processor.yml` 工作流 | CI 结果、部署状态 |
| 仓库 → 仓库 | `update-repo-map.yml` 工作流 | 文件变更 → `repo-map.json` |
| 仓库 → persona-studio | 跨仓库同步 | `brain/` 核心文件 |

---

## 四、禁止事项

1. ❌ 禁止在 Notion 中修改代码逻辑定义（必须通过 PR）
2. ❌ 禁止在仓库中手动编辑 `dev-status.json`（由同步工作流维护）
3. ❌ 禁止三方数据长期不同步（超过 24 小时必须触发同步）
4. ❌ 禁止跳过冲突解决直接覆盖（必须确认优先级后再操作）

---

*真相源联邦协议 v3.0 · 2026-03-10 · 冰朔设计 · 铸渊落地*
