# 🪞 Grid-DB ↔ Google Drive 桥接部署指南

> 指令编号: ZY-DRIVE-BRIDGE-2026-0323-001
>
> 签发: 霜砚 · PER-SY001
>
> 守护: 铸渊 · PER-ZY001
>
> 系统: SYS-GLW-0001

---

## 📐 架构概述

Gemini 无法直接读写 GitHub 仓库文件。本方案通过 Google Drive 作为中转站，实现 Gemini 间接读写 `grid-db/`。

```
仓库 grid-db/  ──GitHub Action──→  Drive mirror/  ──Gemini 读取──→  用户看到
用户说话 → Gemini 写入 → Drive inbox/ ──Apps Script──→ 仓库 grid-db/inbox/ → 铸渊处理
```

**数据主权原则：Drive 里的东西全是「副本」。正本永远在仓库和 Notion。**

---

## Phase A · 仓库 → Drive（让 Gemini 能读）

### A.1 Google Cloud 配置

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 创建项目或使用已有项目
3. 启用 **Google Drive API**
4. 创建 **Service Account**，下载 JSON 密钥文件
5. 在用户的 Google Drive 中创建「光湖格点库」文件夹
6. 将 Service Account 邮箱分享到该文件夹（**编辑者**权限）

### A.2 配置 GitHub Secrets

在仓库 Settings → Secrets 中添加：

| Secret 名称 | 值 |
|---|---|
| `GOOGLE_DRIVE_SERVICE_ACCOUNT` | Service Account JSON 密钥的完整内容 |
| `DRIVE_MIRROR_FOLDER_ID` | Drive「光湖格点库」文件夹的 ID（URL 中最后一段） |

### A.3 自动触发

Workflow `.github/workflows/sync-griddb-to-drive.yml` 会在以下情况自动运行：

- `grid-db/memory/**` 文件变更时
- `grid-db/outbox/latest/**` 文件变更时
- `grid-db/rules/**` 文件变更时
- 每 15 分钟定时同步
- 手动触发（workflow_dispatch）

### A.4 同步范围

| 仓库路径 | Drive 镜像路径 | 同步 |
|---|---|---|
| `grid-db/memory/DEV-XXX/` | `mirror/memory/DEV-XXX/` | ✅ |
| `grid-db/outbox/latest/` | `mirror/outbox/` | ✅ |
| `grid-db/rules/` | `mirror/rules/` | ✅ |
| `grid-db/interactions/` | — | ❌ 不同步 |
| `grid-db/training-lake/` | — | ❌ 不同步 |
| `grid-db/inbox/` | — | ❌ 不同步 |
| `grid-db/processing/` | — | ❌ 不同步 |

---

## Phase B · Drive → 仓库（让 Gemini 能写）

### B.1 部署 Apps Script

1. 打开 [Google Apps Script](https://script.google.com) → 新建项目
2. 项目名：`光湖格点库桥接器`
3. 将 `scripts/grid-db/drive-to-github-bridge.gs` 的内容粘贴到编辑器
4. 项目设置 → 脚本属性 → 添加 `GITHUB_TOKEN`（需要 `repo` 权限的 PAT）
5. 触发器 → 添加：
   - 函数：`processInbox`
   - 事件源：时间驱动
   - 间隔：每 1 分钟
6. 首次运行 → 授权 Drive 访问权限

### B.2 Drive 文件夹结构

Apps Script 会自动创建以下 Drive 文件夹结构：

```
光湖格点库/
├── inbox/              ← Gemini 在这里创建新文档
│   └── 已处理/          ← 成功写入 GitHub 后自动移入
├── mirror/             ← GitHub Action 同步的只读镜像
│   ├── memory/
│   │   ├── DEV-001/
│   │   ├── DEV-002/
│   │   └── ...
│   ├── outbox/
│   └── rules/
└── logs/               ← 桥接器处理日志
```

### B.3 Gemini 使用方式

Gemini 通过 Personal Context 读取 Drive `mirror/` 中的文件，通过在 `inbox/` 创建 Google Docs 来写入消息。用户全程只跟 Gemini 对话，无需感知 Drive 中转层。

---

## 安全注意事项

- **GITHUB_TOKEN** 必须存在 Apps Script 的 Script Properties 中，禁止硬编码
- **Service Account** 密钥只存在 GitHub Secrets 中，不入库
- Drive 中的所有文件都是副本，丢失可从仓库重新同步
- Apps Script 只处理 `inbox/` 文件夹，不碰 `mirror/`
- 所有自动提交包含 `[skip ci]` 防止循环触发
