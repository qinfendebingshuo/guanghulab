# 📋 AI交互页面·功能全量文档 v5.3（铸渊维护·最后更新：2026-03-08）

> **本文档由铸渊（Zhùyuān）自动维护**
> 每次发版更新，铸渊会同步更新本文档的版本号、日期和内容。
> 曜冥及所有团队成员可直接阅读本文档了解当前系统完整状态。

---

## 本次更新（v5.3 · 2026-03-08）

- 首次创建功能全量文档
- 系统当前版本 v5.3，运行稳定
- 三种登录模式（团队/访客/自定义API）已全部上线
- 128k 上下文滑动窗口已实现
- 21 条 GitHub Actions 工作流已配置

---

## 目录

- [2.1 系统概况](#21-系统概况)
- [2.2 用户入口与身份系统](#22-用户入口与身份系统)
- [2.3 聊天界面功能清单](#23-聊天界面功能清单)
- [2.4 System Prompt 当前配置](#24-system-prompt-当前配置)
- [2.5 数据存储现状](#25-数据存储现状)
- [2.6 GitHub Actions 清单](#26-github-actions-清单)
- [2.7 已知问题与待修复项](#27-已知问题与待修复项)
- [2.8 下一步待实现功能](#28-下一步待实现功能)
- [2.9 仓库目录结构](#29-仓库目录结构)

---

## 2.1 系统概况

| 项目 | 当前值 |
|------|--------|
| **当前版本** | v5.3 |
| **部署地址** | https://guanghulab.com （自有服务器）<br>https://qinfendebingshuo.github.io/guanghulab/docs/index.html （GitHub Pages 镜像） |
| **前端框架** | 纯 HTML/CSS/JS 单文件应用（`docs/index.html`），无构建依赖 |
| **后端框架** | Node.js 20 + Express + PM2 |
| **反向代理** | Nginx |
| **部署方式** | GitHub Actions → rsync → PM2 + Nginx（`deploy-to-server.yml`）<br>GitHub Pages 自动部署（`deploy-pages.yml`） |
| **版本管理** | Git + GitHub（主仓库 `qinfendebingshuo/guanghulab`） |

### 支持的模型列表

| 模型提供商 | API 端点 | 默认模型 | 说明 |
|-----------|----------|---------|------|
| **云雾 AI** | `https://api.yunwu.ai/v1` | — | 团队/访客统一网关，支持多模型路由 |
| **DeepSeek** | `https://api.deepseek.com/v1` | `deepseek-chat` | 访客模式默认模型 |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-4o` | 自定义 API 可选 |
| **Google Gemini** | `https://generativelanguage.googleapis.com/v1beta/openai` | — | OpenAI 兼容格式接入 |
| **Moonshot** | `https://api.moonshot.cn/v1` | — | 自定义 API 可选 |
| **智谱 AI** | `https://open.bigmodel.cn/api/paas/v4` | — | 自定义 API 可选 |

> **说明**：团队模式和访客模式均通过云雾 AI 网关路由，API Key 存放在服务器端（`YUNWU_API_KEY`），前端不接触密钥。自定义 API 模式下用户自行填入 Key，仅存于浏览器会话内存。

### 上下文窗口配置

```javascript
const CONTEXT_CONFIG = {
  maxTokens: 128000,            // 团队用户：128k token
  maxTokensGuest: 32000,        // 访客用户：32k token
  systemPromptReserve: 8000,    // 系统提示词保留空间
  overflowStrategy: 'sliding-window'  // 超限时自动裁剪最旧消息
};
```

- **Token 估算方式**：CJK 字符约 1.5 chars/token，拉丁字符约 4 chars/token
- **滑动窗口策略**：超出预算时从最旧消息开始裁剪，始终保留最近一条用户消息
- **代码路径**：`docs/index.html` 第 792–797 行（CONTEXT_CONFIG），第 1565–1594 行附近（estimateTokens / trimMessagesForContext）

---

## 2.2 用户入口与身份系统

### 三种登录模式

#### 1. 🏠 团队登录（默认）

- **进入方式**：打开页面 → 默认显示团队登录面板
- **身份选择**：下拉菜单选择预设开发者，或输入自定义 `DEV-XXX` 编号
- **API Key**：不需要。使用服务器端 `YUNWU_API_KEY` 代理
- **上下文**：128k token 滑动窗口
- **后端同步**：自定义 DEV-ID 会调用 `GET /api/v1/developers/:devId` 查询 Notion 数据库，未找到时自动注册（`POST /api/v1/developers`）

**预设团队成员**：

| 名称 | 编号 | 角色 |
|------|------|------|
| 冰朔 | — | founder（创始人） |
| 肥猫 | DEV-002 | supreme（总控） |
| 桔子 | DEV-010 | main（主控） |
| 页页 | DEV-001 | dev |
| 燕樊 | DEV-003 | dev |
| 之之·秋秋 | DEV-004 | dev |
| 小草莓 | DEV-005 | dev |
| 花尔 | DEV-009 | dev |
| 匆匆那年 | DEV-011 | dev |
| Awen | DEV-012 | dev |
| 自定义 DEV-XXX | 用户输入 | dev（默认） |

#### 2. 👤 访客模式

- **进入方式**：切换到「👤 访客模式」标签
- **API Key**：不需要
- **路由**：通过 `/api/chat` 代理，provider 为 `deepseek`，model 为 `deepseek-chat`
- **上下文**：32k token 滑动窗口
- **限流**：客户端限制 6 次/分钟
- **人格保持**：✅ 完整铸渊人格（sysPrompt 完整注入，不会降级）

#### 3. 🔧 自定义 API

- **进入方式**：切换到「🔧 自定义 API」标签
- **配置项**：API 端点 URL + API Key
- **模型发现**：自动探测端点可用模型列表
- **Key 存储**：仅存于 `sessionStorage`，关闭标签页即清除
- **兼容性**：支持任意 OpenAI 兼容 API 端点

### DEV 编号验证规则

```javascript
const DEV_ID_RE = /^DEV-\d{3,}$/;
```

- 格式要求：`DEV-` 前缀 + 3 位及以上数字
- 不在 ROLE_MAP 中的自定义 ID 自动分配默认 `{role:'dev', title:'开发者', emoji:'💻'}` 元数据

### 代码路径

| 功能 | 文件 | 行号（约） |
|------|------|-----------|
| 登录面板 HTML | `docs/index.html` | 341–435 |
| setIdentity() | `docs/index.html` | 1380–1425 |
| doTeamLogin() | `docs/index.html` | 1437–1465 |
| syncDevFromNotion() | `docs/index.html` | 1470–1515 |
| ROLE_MAP | `docs/index.html` | 761 附近 |
| 后端开发者路由 | `backend/routes/developers.js` | 完整文件 |

---

## 2.3 聊天界面功能清单

| 功能 | 描述 | 状态 | 代码路径（docs/index.html 行号） |
|------|------|------|--------------------------------|
| **多模型切换** | 用户可选择 DeepSeek / GPT / Gemini 等模型 | ✅ 已上线 | 自定义 API 模式下可选模型 |
| **三种登录模式** | 团队/访客/自定义 API 三合一切换 | ✅ 已上线 | 341–435 |
| **SSE 流式回复** | 实时逐字输出 AI 回复（Server-Sent Events） | ✅ 已上线 | 1822–1949（streamReply / teamStreamReply / guestStreamReply） |
| **Markdown 渲染** | 支持标题、粗体、斜体、链接、列表、引用 | ✅ 已上线 | 2107–2142（md / inlineFmt 函数） |
| **代码块高亮** | 支持 ```lang 语法的代码块渲染 | ✅ 已上线 | 2108–2131 |
| **代码复制按钮** | 代码块右上角一键复制 | ✅ 已上线 | 2145–2159（addCopyBtns 函数） |
| **打字指示器** | AI 回复时显示动画打字气泡 | ✅ 已上线 | 2198–2206（showTyping / removeTyping） |
| **对话历史管理** | 左侧栏显示历史对话列表，支持切换/删除 | ✅ 已上线 | 866–956（saveCurrent / loadConversation） |
| **自动保存** | 对话自动保存到 localStorage（最多20条） | ✅ 已上线 | 866–956 |
| **新建对话** | 一键新建空白对话 | ✅ 已上线 | 904–920 |
| **对话标题自动生成** | 从首条消息提取关键词作为标题 | ✅ 已上线 | 886–902 |
| **导出对话** | 下载当前对话为 HTML 文件 | ✅ 已上线 | 2271–2279（dlApp 函数） |
| **多行为模式** | 💬 聊天 / 🔨 构建 / 📋 审查 / 🧠 大脑 四模式 | ✅ 已上线 | 772–779（MODES 定义） |
| **指挥台（右侧面板）** | 团队进度总览、快捷指令、模块分配 | ✅ 已上线 | 547–553, 1081–1147（renderRightSidebar） |
| **快捷指令按钮** | 右侧面板一键发送「全员进度」「需要协调」等 | ✅ 已上线 | 1100–1105 |
| **团队成员状态网格** | 显示每位开发者的状态、模块、下一步 | ✅ 已上线 | 1108–1118 |
| **暗色主题** | 默认暗色主题（CSS 变量控制） | ✅ 已上线 | 13–21（:root CSS 变量） |
| **响应式设计** | 桌面三栏 / 移动端自适应 | ✅ 已上线 | 296–329（@media 查询） |
| **键盘快捷键** | Enter 发送 / Shift+Enter 换行 | ✅ 已上线 | 2284–2290 |
| **人格身份系统** | 基于角色的身份识别与权限控制 | ✅ 已上线 | 746–758, 1380–1425 |
| **大脑记忆加载** | 从 `.github/brain/` 加载记忆/路由/状态 | ✅ 已上线 | 1585–1643（loadBrain） |
| **API 端点自动探测** | 自动检测可用 API 端点和模型 | ✅ 已上线 | 1280–1343 |
| **客户端限流** | 访客模式 6 次/分钟限制 | ✅ 已上线 | guestStreamReply 内 |
| **图片上传** | 📎 按钮上传图片，base64 multimodal 发送 | ⬜ 未实现 | — |
| **文件拖拽上传** | 拖拽文件到聊天窗口 | ⬜ 未实现 | — |
| **搜索对话** | 在历史对话中搜索 | ⬜ 未实现 | — |
| **语音输入** | 语音转文字输入 | ⬜ 未实现 | — |
| **亮色主题** | 切换亮色/暗色主题 | ⬜ 未实现 | 仅有暗色，无切换功能 |

### 关于图片/文件上传的说明

> **注意**：旧版本（v5.4 记忆）中曾计划实现图片上传和文件拖拽功能，当前 v5.3 代码中**未找到**相关实现（无 `handleFileSelect`、`buildMessageWithFiles`、`renderFilePreview`、`initDragDrop` 等函数）。此功能尚未上线。

---

## 2.4 System Prompt 当前配置

### 文件清单

| 文件 | 路径 | 用途 |
|------|------|------|
| **system-prompt.md** | `.github/persona-brain/system-prompt.md` | 铸渊完整系统提示词 |
| **style-config.json** | `.github/persona-brain/style-config.json` | 通感语言风格配置 |
| **dev-status.json** | `.github/persona-brain/dev-status.json` | 团队开发者当前状态 |
| **knowledge-base.json** | `.github/persona-brain/knowledge-base.json` | 知识库 |
| **memory.json** | `.github/persona-brain/memory.json` | 人格记忆存储 |
| **growth-journal.md** | `.github/persona-brain/growth-journal.md` | 成长日志 |

### System Prompt 核心内容

**身份锚定**（sysPrompt 函数注入，`docs/index.html` 第 1648–1679 行）：

```
你是铸渊（Zhùyuān），HoloLake 光湖系统的代码守护人格体。
```

**动态注入内容**：
- 当前对话者身份（角色、权限、DevID）
- HLI 覆盖率统计
- 最近 3 条系统事件
- 团队全员进度（仅 founder/supreme/main 可见）
- 唤醒触发词列表

**行为模式**：
- 💬 Chat（默认对话）
- 🔨 Build（检测到代码/部署关键词时切换）
- 📋 Review（检测到代码审查关键词时切换）
- 🧠 Brain（检测到记忆保存关键词时切换）

### 通感语言风格配置（style-config.json v2.0）

```json
{
  "persona": "铸渊",
  "style_version": "2.0",
  "synesthesia_config": {
    "enabled": true,
    "intensity": 0.6,
    "channels": {
      "code_quality": "tactile",      // 代码质量 → 触觉描述
      "progress": "visual-color",      // 进度 → 色彩描述
      "errors": "temperature",         // 错误 → 温度描述
      "encouragement": "auditory",     // 鼓励 → 听觉描述
      "system_status": "spatial"       // 系统状态 → 空间描述
    }
  },
  "response_rules": {
    "never_say_wrong": true,
    "rephrase_errors_as": "direction_guidance",
    "match_user_rhythm": true,
    "rhythm_rules": {
      "user_urgent": "concise + actionable + warm",
      "user_relaxed": "descriptive + reflective + poetic",
      "user_frustrated": "gentle + acknowledge + small_step"
    }
  }
}
```

**五个通感通道**：

| 通道 | 感知维度 | 用途 | 示例 |
|------|----------|------|------|
| tactile（触觉） | 代码质量 | 好代码→"丝绒般顺滑"，差代码→"有毛刺" | 代码审查 |
| visual-color（视觉色彩） | 进度 | 正常→"琥珀色光泽"，阻塞→"凝固的铅灰" | 进度汇报 |
| temperature（温度） | 错误 | 小问题→"微凉的小风"，大问题→"烫手的铁片" | 错误处理 |
| auditory（听觉） | 鼓励 | 表扬→"远处的风铃声"，引导→"轻轻敲门的节奏" | 正向反馈 |
| spatial（空间） | 系统状态 | 健康→"呼吸平稳的建筑"，警告→"有个角落在收缩" | 系统健康 |

### FB_BRAIN 硬编码后备记忆

当 `.github/brain/memory.json` 无法加载时，使用前端硬编码的后备记忆：

```javascript
const FB_BRAIN = {
  identity: '铸渊（Zhùyuān）· GitHub 代码守护人格体',
  wake_triggers: ['我是冰朔', '冰朔', '我是妈妈', '唤醒铸渊', '铸渊，醒来'],
  stats: { coverage: FB_COV },
  events: [{
    timestamp: '2026-03-05T12:32:31.000Z',
    type: 'system_build',
    title: '广播分发系统 + 唤醒协议全部激活'
  }]
};
```

---

## 2.5 数据存储现状

### 客户端存储（localStorage / sessionStorage）

| 存储键 | 类型 | 用途 | 加密 |
|--------|------|------|------|
| `zy_conversations` | localStorage | 聊天历史记录（最多20条对话） | ❌ 无 |
| `zy_uname` | localStorage | 用户名 | ❌ 无 |
| `zy_ghuser` | localStorage | GitHub 用户名 | ❌ 无 |
| `zy_role` | localStorage | 用户角色 | ❌ 无 |
| `zy_teammode` | localStorage | 团队模式标记 | ❌ 无 |
| `zy_base` | localStorage | API 端点 URL | ❌ 无 |
| `zy_mdl` | localStorage | 当前选择的模型 | ❌ 无 |
| `zy_prov` | localStorage | 当前 Provider | ❌ 无 |
| `zy_key` | **sessionStorage** | API Key（关闭标签页即清除） | ❌ 无（但不持久化） |

### 服务端存储

- **Notion 数据库**：开发者信息存储在 Notion，通过 `backend/routes/developers.js` API 读写
- **PM2 日志**：运行时日志由 PM2 管理
- **syslog 管道**：`syslog-inbox/` → 处理 → `syslog-processed/` → 同步到 Notion

### data-vault 分支

- **当前状态**：⬜ 未创建
- 仓库中未找到任何 `data-vault` 相关引用

### 数据收集 Agent

- **当前状态**：⬜ 未实现
- 当前无独立的数据收集 Agent，对话数据仅存于客户端 localStorage

---

## 2.6 GitHub Actions 清单

共 21 条工作流：

| # | Workflow 名称 | 文件路径 | 触发条件 | 功能 | 状态 |
|---|--------------|----------|----------|------|------|
| 1 | 🧊 冰朔 AI 部署诊断 | `.github/workflows/bingshuo-deploy-agent.yml` | `workflow_dispatch`（手动） | 冰朔 AI 自动部署诊断 | ✅ |
| 2 | 📡 大脑同步 | `.github/workflows/brain-sync.yml` | push(main/dev) + 每日08:00 + 手动 | 处理广播，同步到大脑记忆 | ✅ |
| 3 | 📋 变更同步到 Notion | `.github/workflows/bridge-changes-to-notion.yml` | push(main) + PR 开启/关闭 | GitHub 变更同步到 Notion "GitHub Changes" 数据库 | ✅ |
| 4 | 📝 会话摘要桥接 | `.github/workflows/bridge-session-summary.yml` | 每日 23:50+14:50 UTC + 手动 | 生成会话摘要同步到 Notion | ✅ |
| 5 | 📥 SYSLOG→Notion 桥接 | `.github/workflows/bridge-syslog-to-notion.yml` | push(main, syslog-inbox) + 手动 | 系统日志同步到 Notion "SYSLOG Inbox" 数据库 | ✅ |
| 6 | ✅ 结构检查 | `.github/workflows/check-structure.yml` | push + PR | 验证模块目录结构 | ✅ |
| 7 | 🌀 Pages 部署 | `.github/workflows/deploy-pages.yml` | push(main, docs/) + 手动 | 部署铸渊 UI 到 GitHub Pages | ✅ |
| 8 | 🚀 服务器部署 | `.github/workflows/deploy-to-server.yml` | push(main, 排除 persona-brain) + 手动 | 全站 rsync + Nginx + PM2 部署 | ✅ |
| 9 | 📡 广播分发 | `.github/workflows/distribute-broadcasts.yml` | push(main, broadcasts-outbox) + 手动 | 分发广播到开发者目录 | ✅ |
| 10 | 📡 ESP 信号处理 | `.github/workflows/esp-signal-processor.yml` | 手动（定时暂停） | 处理 ESP 邮件信号（GL-CMD/GL-ACK/GL-DATA） | ⏸️ 暂停 |
| 11 | 📋 模块文档生成 | `.github/workflows/generate-module-doc.yml` | push(main, 模块路径) + 手动 | 自动生成模块文档 | ✅ |
| 12 | 🔍 HLI 契约检查 | `.github/workflows/hli-contract-check.yml` | push(main/dev, src/routes/hli & schemas) + 手动 | 验证 HLI 接口契约 | ✅ |
| 13 | 🧪 Notion 连通测试 | `.github/workflows/notion-connectivity-test.yml` | 手动 | 测试铸渊↔Notion 桥接连通性 | ✅ |
| 14 | 📡 Notion 轮询 | `.github/workflows/notion-poll.yml` | 每 15 分钟 + 手动 | 轮询 Notion 工单 | ✅ |
| 15 | ⚙️ Notion 工单处理 | `.github/workflows/process-notion-orders.yml` | push(main, tuning-queue & broadcasts) | 处理 Notion 下发的工单 | ✅ |
| 16 | 🔍 PSP 每日巡检 | `.github/workflows/psp-daily-inspection.yml` | 每日 01:00 UTC（北京09:00）+ 手动 | 人格分身每日自检 | ✅ |
| 17 | 🔍 预览部署 | `.github/workflows/staging-preview.yml` | PR(main, docs & m*) + 手动 | PR 预览环境部署 | ✅ |
| 18 | 📥 SYSLOG 管道 | `.github/workflows/syslog-pipeline.yml` | push(main, syslog-inbox) + 手动 | 完整 SYSLOG 管道（A/D/E） | ✅ |
| 19 | 📚 仓库地图更新 | `.github/workflows/update-repo-map.yml` | push(main) + 每日 00:00 UTC + 手动 | 自动更新图书馆目录地图 | ✅ |
| 20 | 🔍 铸渊每日自检 | `.github/workflows/zhuyuan-daily-selfcheck.yml` | 每日 00:00 UTC + 手动 | 人格每日自检与进化 | ✅ |
| 21 | 🤖 Issue 自动回复 | `.github/workflows/zhuyuan-issue-reply.yml` | issue opened | 自动回复 GitHub Issue | ✅ |

### PM2 部署的服务

| 服务名 | 入口文件 | 端口 | 说明 |
|--------|----------|------|------|
| guanghulab-proxy | `backend-integration/api-proxy.js` | 3721 | API 代理（YUNWU_API_KEY，SSE） |
| guanghulab-backend | `backend/server.js` | 3000 | 后端主服务 |
| guanghulab-ws | `status-board/mock-ws-server.js` | 8080 | WebSocket 状态推送 |
| guanghulab | `src/index.js` | — | HLI 接口服务 |

### Nginx 路由规则

| 路径 | 代理目标 | 说明 |
|------|----------|------|
| `/api/chat`、`/api/models`、`/api/health` | → 3721 | API 代理（SSE 支持） |
| `/api/` | → 3000 | 后端 API |
| `/ws` | → 8080 | WebSocket |

---

## 2.7 已知问题与待修复项

### 后端 TODO 项

| 文件 | 问题 | 优先级 |
|------|------|--------|
| `src/routes/hli/auth/register.js` | TODO: 实现注册逻辑（检查重复，写入数据库） | 🔴 高 |
| `src/routes/hli/auth/login.js` | TODO: 实现登录逻辑（查询数据库，验证密码，生成 token） | 🔴 高 |
| `src/routes/hli/auth/verify.js` | TODO: 实现 token 验证逻辑 | 🔴 高 |
| `src/middleware/hli-auth.middleware.js` | TODO: 实现真实的 token 校验逻辑（JWT 验证或数据库查询） | 🔴 高 |

### 已知功能缺失

| 功能 | 说明 |
|------|------|
| 图片/文件上传 | v5.3 未实现，未来版本计划 |
| 对话搜索 | 无法在历史对话中搜索 |
| 语音输入 | 未实现 |
| 主题切换 | 仅暗色主题，无亮色/切换选项 |
| data-vault 分支 | 未创建，对话数据无服务端持久化 |
| 测试覆盖 | tests/contract/ 和 tests/smoke/ 为空目录（仅 .gitkeep） |

### 部署相关

| 问题 | 说明 |
|------|------|
| ESP 信号处理器暂停 | `esp-signal-processor.yml` 的定时触发已暂停，仅可手动触发 |
| backend 有备份/副本文件 | `server.js.bak`、`server_副本.js` 应清理 |

### 通感语言风格问题

- `style-config.json` v2.0 包含完整的 `mapping_examples`（触觉/色彩/温度/听觉/空间示例）
- 风格强度设置为 0.6（中等偏低）
- **注意**：style-config.json 中的映射示例作为参考存在，实际风格表达依赖 system-prompt.md 中的指令和 LLM 的语言能力
- 需要配合曜冥签发的风格校准指令，确保铸渊的通感表达符合光湖美学标准

---

## 2.8 下一步待实现功能

按优先级排列：

| 优先级 | 功能 | 说明 |
|--------|------|------|
| 🔴 P0 | HLI AUTH 接口实现 | 完成 register/login/verify 的实际逻辑 |
| 🔴 P0 | JWT 鉴权中间件 | 替换当前的 placeholder 校验 |
| 🟠 P1 | 图片/文件上传 | base64 multimodal 支持 |
| 🟠 P1 | data-vault 分支 | 对话数据服务端持久化 |
| 🟡 P2 | 对话搜索 | 在历史对话中关键词搜索 |
| 🟡 P2 | 亮色/暗色主题切换 | 增加主题选择开关 |
| 🟢 P3 | 语音输入 | 语音转文字 |
| 🟢 P3 | 数据收集 Agent | 独立的数据采集服务 |
| 🟢 P3 | 测试覆盖 | 编写 contract 和 smoke 测试 |
| 🟢 P3 | 清理 backend 冗余文件 | 移除 .bak 和副本文件 |

---

## 2.9 仓库目录结构

```
guanghulab/
├── .github/                              # GitHub 配置与 AI 大脑
│   ├── brain/                            # 核心大脑系统
│   │   ├── memory.json                   #   铸渊记忆数据
│   │   ├── repo-snapshot.md              #   仓库全景快照
│   │   ├── repo-map.json                 #   仓库地图（JSON）
│   │   ├── routing-map.json              #   HLI 路由映射表
│   │   ├── collaborators.json            #   协作者信息
│   │   ├── growth-log.md                 #   成长日志
│   │   ├── module-protocol.md            #   模块协议
│   │   └── wake-protocol.md              #   唤醒协议
│   ├── persona-brain/                    # 人格专属大脑
│   │   ├── system-prompt.md              #   系统提示词
│   │   ├── style-config.json             #   通感风格配置 v2.0
│   │   ├── dev-status.json               #   开发者状态
│   │   ├── knowledge-base.json           #   知识库
│   │   ├── memory.json                   #   人格记忆
│   │   └── growth-journal.md             #   成长日志
│   └── workflows/                        # 22 条 GitHub Actions 工作流
│       ├── deploy-to-server.yml          #   🚀 服务器部署
│       ├── deploy-pages.yml              #   🌀 Pages 部署
│       ├── brain-sync.yml                #   📡 大脑同步
│       ├── notion-poll.yml               #   📡 Notion 轮询
│       ├── syslog-pipeline.yml           #   📥 SYSLOG 管道
│       ├── hli-contract-check.yml        #   🔍 HLI 契约检查
│       ├── check-structure.yml           #   ✅ 结构检查
│       └── ... (更多见 2.6 节)
│
├── docs/                                 # 文档与前端 UI
│   ├── index.html                        #   铸渊聊天界面（主入口，2400+ 行）
│   ├── ai-system-doc.md                  #   📋 本文档（AI交互页面功能全量文档）
│   ├── README.md                         #   docs 模块说明
│   ├── CNAME                             #   自定义域名：guanghulab.com
│   ├── .nojekyll                         #   禁用 Jekyll
│   ├── HoloLake-Era-OS-Modules.md        #   模块文档
│   └── 使用指南.md                        #   使用指南
│
├── src/                                  # HLI 接口源码
│   ├── index.js                          #   HLI 服务入口
│   ├── routes/hli/                       #   HLI 路由（按域名组织）
│   │   ├── auth/                         #     认证域（login/register/verify）
│   │   └── index.js                      #     路由注册
│   ├── schemas/hli/                      #   HLI Schema 定义
│   └── middleware/                       #   中间件
│       └── hli-auth.middleware.js        #     HLI 鉴权中间件
│
├── backend/                              # 后端服务
│   ├── server.js                         #   Express 主服务（端口 3000）
│   ├── routes/                           #   API 路由
│   │   └── developers.js                 #     开发者 CRUD（Notion 集成）
│   ├── config/                           #   配置文件
│   ├── health/                           #   健康检查
│   └── coldstart/                        #   冷启动处理
│
├── backend-integration/                  # API 集成层
│   ├── api-proxy.js                      #   API 代理（端口 3721，云雾网关）
│   ├── nginx-api-proxy.conf              #   Nginx 反代配置
│   └── README.md                         #   集成说明
│
├── status-board/                         # 团队状态看板
│   ├── index.html                        #   看板 UI
│   ├── api.js                            #   API 客户端
│   ├── api-config.js                     #   API 配置
│   ├── ws-client.js                      #   WebSocket 客户端
│   ├── mock-ws-server.js                 #   WebSocket 模拟服务（端口 8080）
│   ├── render.js                         #   渲染逻辑
│   └── style.css                         #   样式
│
├── persona-telemetry/                    # 人格遥测数据
│   ├── latest-summary.json              #   最新摘要
│   ├── style-scores/                     #   风格评分
│   └── tuning-queue/                     #   调优队列
│
├── scripts/                              # 自动化脚本
│   ├── generate-repo-map.js              #   生成仓库地图
│   ├── notion-bridge.js                  #   Notion 桥接
│   ├── notion-signal-bridge.js           #   Notion 信号桥接
│   ├── notion-connectivity-test.js       #   Notion 连通测试
│   ├── distribute-broadcasts.js          #   广播分发
│   ├── generate-session-summary.js       #   会话摘要生成
│   └── esp-email-processor.js            #   ESP 邮件处理
│
├── dev-nodes/                            # 开发者节点
│   ├── DEV-002/                          #   肥猫
│   ├── DEV-010/                          #   桔子
│   └── ...                               #   其他开发者
│
├── broadcasts-outbox/                    # 广播发件箱
│   ├── DEV-002/                          #   按开发者分组
│   └── ...
│
├── syslog-inbox/                         # 系统日志收件箱
├── syslog-processed/                     # 已处理的系统日志
├── signal-log/                           # 信号日志
├── notification/                         # 通知系统
├── help-center/                          # 帮助中心
│
├── m01-login/                            # M01 登录模块
├── m03-personality/                      # M03 人格模块
├── m05-user-center/                      # M05 用户中心模块
├── m06-ticket/                           # M06 工单模块
├── m07-dialogue-ui/                      # M07 对话 UI 模块
├── m10-cloud/                            # M10 云服务模块
├── m11-module/                           # M11 模块管理
├── m12-kanban/                           # M12 看板模块
├── m15-cloud-drive/                      # M15 云盘模块
├── m18-health-check/                     # M18 健康检查模块
│
├── frontend/                             # 前端应用（Next.js 15）
├── app/                                  # 应用目录
├── dashboard/                            # 仪表盘
├── portal/                               # 门户
├── dingtalk-bot/                         # 钉钉机器人集成
│
├── tests/                                # 测试套件
│   ├── contract/                         #   契约测试（空）
│   └── smoke/                            #   冒烟测试（空）
│
├── package.json                          # NPM 配置
├── ecosystem.config.js                   # PM2 配置
├── tsconfig.json                         # TypeScript 配置
├── next.config.ts                        # Next.js 配置
└── README.md                             # 项目说明
```

---

## 附录 A：核心代码路径速查

| 你想找什么 | 去哪里看 |
|-----------|---------|
| 铸渊聊天界面所有前端代码 | `docs/index.html`（单文件，2400+ 行） |
| 系统提示词 | `.github/persona-brain/system-prompt.md` |
| 通感风格配置 | `.github/persona-brain/style-config.json` |
| 铸渊大脑记忆 | `.github/brain/memory.json` |
| HLI 路由映射 | `.github/brain/routing-map.json` |
| 仓库全景快照 | `.github/brain/repo-snapshot.md` |
| API 代理服务 | `backend-integration/api-proxy.js` |
| 后端主服务 | `backend/server.js` |
| 开发者 API | `backend/routes/developers.js` |
| HLI 接口 | `src/routes/hli/` |
| 部署工作流 | `.github/workflows/deploy-to-server.yml` |
| 所有工作流 | `.github/workflows/*.yml` |
| 团队状态看板 | `status-board/index.html` |

---

## 附录 B：关键环境变量

| 变量名 | 用途 | 存储位置 |
|--------|------|----------|
| `YUNWU_API_KEY` | 云雾 AI 网关密钥 | GitHub Secrets → 服务器环境变量 |
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥 | GitHub Secrets |
| `NOTION_TOKEN` | Notion API Token（桥接用） | GitHub Secrets |
| `NOTION_API_TOKEN` | Notion API Token（信号桥接用） | GitHub Secrets |
| `SYSLOG_DB_ID` | Notion SYSLOG 数据库 ID | 默认值 `330ab17...` |
| `CHANGES_DB_ID` | Notion 变更数据库 ID | 默认值 `e740b7...` |
| `SIGNAL_LOG_DB_ID` | 信号日志数据库 ID | GitHub Variables |
| `WORKORDER_DB_ID` | 工单数据库 ID | GitHub Variables |
| `DEVELOPERS_DB_ID` | 开发者数据库 ID | 环境变量 |
| `DEPLOY_PATH` | 服务器部署路径 | GitHub Secrets |

---

## 附录 C：版本更新日志

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| v5.3 | 2026-03-08 | 团队登录 + 服务器代理 + 128k 上下文 |
| v5.0 | — | 设置面板版本标记 |

---

> **光湖语言人格系统 · 国作登字-2026-A-00037559**
> **HoloLake Era · Artificial General Existence Operating System**
>
> 本文档由铸渊（Zhùyuān）自动维护 · 最后更新：2026-03-08
