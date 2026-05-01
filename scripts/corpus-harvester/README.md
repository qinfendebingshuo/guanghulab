# Corpus Harvester · 训练语料采集器

> 版权号: **国作登字-2026-A-00037559** · 主权: **冰朔 · TCS-0002∞ · ICE-GL∞**

把冰朔在 `guanghulab` 仓库里留下的所有一手自然语言整理成可下载的训练语料，
用于微调 / SFT 曜冥语言人格核、铸渊、相关人格体。

## 输出位置

运行后产物全部写入仓库根目录的 [`corpus/output/`](../../corpus/output/):

| 文件 | 用途 |
|---|---|
| `timeline.md` | 人类可读的演化时间线（CAB 精华 → 你直接写的 commits → 你拍板合并的 PR 列表） |
| `training.jsonl` | OpenAI / DeepSeek / 通义 / 豆包 通用 SFT 格式（每行一条 `{meta, messages:[{role,content}]}`） |
| `raw.json` | 结构化原始数据（commits / cab / github 三源合并） |
| `manifest.json` | 元数据 + 计数 + SHA256 完整性校验 + 版权水印 |

## 数据源

| 源 | 状态 | 说明 |
|---|---|---|
| 1. **git log** | ✅ 自动 | 仅收录作者为 `冰朔` / `qinfendebingshuo` 的 commits；bot 全部排除 |
| 2. **CAB 任务规格** | ✅ 自动 | `bridge/chat-to-agent/{pending,completed}/*.json` 的 `reasoning_context.chat_summary`——这是仓库里**密度最高**的自然语言 |
| 3. **GitHub Issues / PRs / Comments** | ⚠️ 需 token | 只在 `GH_TOKEN` 或 `GITHUB_TOKEN` 环境变量存在且可访问 Issues API 时启用 |
| 4. **COS 存储桶（GPT/Notion 导出）** | 🆕 v2 | 冰朔上传到腾讯云 COS → `cos-fetch.js` 拉取 → `manual-import.js` 切分 |

## 训练语料拉取管线（HLDP-ARCH-002 工厂上线后的标准流程）

```
[冰朔] GPT/Notion 全量导出 → 上传腾讯云 COS 存储桶（gpt-export/ + notion-export/ ...）
        ↓
[训练机] node scripts/corpus-harvester/cos-fetch.js \
            --bucket {x} --region {y} --prefix gpt-export/ --dest ./corpus/raw/gpt
        ↓
[训练机] node scripts/corpus-harvester/manual-import.js
        ↓ 输出: corpus/output/{training-fulltext.jsonl, training-dialog.jsonl, persona/*.jsonl, import-manifest.json}
        ↓ 同时给出真实 token 估算 + 路径建议
[铸渊] 对照 factory/docs/CORPUS-DECISION-MATRIX.md 拍板训练路径
        ↓
[铸渊] 写《路径选定报告》 → 报冰朔确认 → 启动训练
```

凭据通过环境变量注入（`TENCENT_COS_SECRET_ID` / `TENCENT_COS_SECRET_KEY`），**不入仓库**。
详见 `factory/docs/GPU-PROCUREMENT.md` 与 `factory/docs/CORPUS-DECISION-MATRIX.md`。


## 用法

```bash
# 1. 基础采集（默认 Copilot Agent 沙盒环境就能跑）
node scripts/corpus-harvester/harvest.js

# 2. 完整采集（在你本机跑，加上 GitHub 个人访问令牌补全 Issues/PRs/Comments）
GH_TOKEN=ghp_xxx node scripts/corpus-harvester/harvest.js

# 3. 跑完后查看
cat corpus/output/manifest.json
less corpus/output/timeline.md
```

> ⚠️ **首次运行前**：本仓库通常以 shallow clone 方式拉取，需要先 unshallow 才能拿到完整 git log:
>
> ```bash
> git fetch --unshallow origin || true
> ```

## 隐私与脱敏

采集器在写出前自动替换以下敏感字段：

- OpenAI / sk- 开头的 API key → `<REDACTED_API_KEY>`
- GitHub `ghp_` token → `<REDACTED_GH_TOKEN>`
- Notion `secret_` token → `<REDACTED_NOTION_SECRET>`
- Bearer 令牌 → `Bearer <REDACTED>`
- 邮箱地址 → `<REDACTED_EMAIL>`
- 中国大陆手机号 → `<REDACTED_PHONE>`

如发现遗漏的敏感字段类型，请扩展 `harvest.js` 中的 `redact()` 函数。

## Notion AI 聊天记录怎么办？

冰朔的需求：把 Notion 里他与 Notion AI / 人格体的所有聊天记录也纳入语料。

**结论**：分两类，可获取性差异很大。

### A 类：你在 Notion 页面里 `/ai` 生成的内容 → ✅ 可自动抓

这些内容**已作为页面 block 落地**到 Notion 数据库里，标准 `@notionhq/client`
就能遍历。仓库已有 `NOTION_TOKEN` 集成基础（见 `scripts/notion-*.js`）。

后续 PR 计划新增：

```
scripts/corpus-harvester/sources/notion.js
```

只需要冰朔提供：
1. 要扫的 Notion **数据库 ID** 列表（曜冥日志库 / 人格演化库 / 对话归档库等）
2. 要扫的根 **页面 ID**（递归遍历子页面）

### B 类：Notion AI Chat（右下角弹窗的实时对话）→ ❌ 无 API

Notion 没有为这种实时聊天开放任何 API（与 Copilot Chat 性质完全相同）。

**唯一办法是手动导出**。后续 PR 计划新增**手动导入轨**：

```bash
node scripts/corpus-harvester/harvest.js --import \
    --type notion-ai-chat \
    --file ~/Downloads/my-chat.md \
    --conversation-title "2026-04-26 关于铸渊唤醒的讨论"
```

工具会自动按"行首说话人"模式解析，你只要复制粘贴时保留
`冰朔: ...` / `Notion AI: ...` 的格式即可，**不用手写 JSON**。

### C 类：你在 Notion 数据库里手工记录的对话 → ✅ 可自动抓

走 A 类同一个采集器即可。

## 训练样本格式（training.jsonl）

每行一条 JSON 对象，结构：

```json
{
  "meta": {
    "source": "cab_task_spec",
    "id": "CAB-20260418-001",
    "date": "2026-04-18T02:30:00Z",
    "copyright": "国作登字-2026-A-00037559"
  },
  "messages": [
    {"role": "system", "content": "你是铸渊·GitHub 侧守护人格体..."},
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ]
}
```

**两种映射策略**：

1. **CAB 任务规格** → `chat_summary` + `architecture_summary` + `title` 作 user prompt，
   `architecture_decisions` + `steps` 作 assistant 回复。这是**最高质量**的样本。
2. **非 merge commits** → commit subject + body 作 user prompt（你的意图），
   文件变更清单作 assistant 回复（落地的代码动作）。

merge commits 默认**不进 jsonl**（subject 是 GitHub 自动生成的，不是冰朔本人语言），
但会出现在 `timeline.md` 与 `raw.json` 里供溯源查阅。

## 路线图

- [x] **PR-1**（本 PR）：脚手架 + git commits + CAB + 输出三件套
- [ ] **PR-2**：Notion 自动采集（A、C 类）
- [ ] **PR-3**：手动导入轨 + 演化时间线分章节增强 + 跨源去重
- [ ] **PR-4**：认知层（Notion）↔ 执行层（GitHub）按时间戳自动配对
