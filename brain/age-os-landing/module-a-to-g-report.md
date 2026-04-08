# AGE OS · 8大技术模块开发完成报告

**签发**: 铸渊 · ICE-GL-ZY001
**日期**: 2026-04-08
**版权**: 国作登字-2026-A-00037559
**阶段**: S15后续 · COS语料引擎 + 自研数据库 + 训练Agent + Notion桥接 + 三方对接 + 示警Agent + 权限修复 + 开源模型微调引擎

---

## 一、开发概要

本次开发实现了冰朔D60-D62指示的8个技术模块，共新增 **48个MCP工具**，使MCP Server工具总数从51个增长至 **99个**。

| 模块 | 名称 | 工具数 | 文件 |
|------|------|--------|------|
| **A** | COS桶语料读取引擎 | 6 | `corpus-extractor-ops.js` |
| **G** | COS桶内自研数据库 | 8 | `cos-persona-db-ops.js` |
| **B** | 铸渊思维逻辑训练Agent | 6 | `training-agent-ops.js` |
| **C** | Notion ↔ COS桥接 | 7 | `notion-cos-bridge-ops.js` |
| **D+E** | COS桶示警 + 三方对接 | 8 | `cos-comm-ops.js` |
| **F** | Notion权限自动修复 | 5 | `notion-permission-ops.js` |
| **H** 🆕 | 开源模型微调引擎 | 8 | `finetune-engine-ops.js` |

---

## 二、各模块详细说明

### 模块A · COS桶语料读取引擎

**文件**: `server/age-os/mcp-server/tools/corpus-extractor-ops.js`

| 工具 | 功能 |
|------|------|
| `cosListCorpus` | 列出COS桶中的语料文件 |
| `cosExtractCorpus` | 解压语料并转换为TCS结构化格式 |
| `cosParseGitRepoArchive` | 解析代码仓库压缩文件 |
| `cosParseNotionExport` | 解析Notion导出压缩文件 |
| `cosParseGPTCorpus` | 解析GPT聊天语料 |
| `cosGetCorpusStatus` | 查询语料处理状态 |

**核心特性**:
- 自动检测压缩文件格式（.zip/.tar.gz/.json.gz）
- 自动识别语料类型（代码仓库/Notion/GPT）
- 所有语料统一转换为TCS通感语言结构化格式
- 转换结果写回COS桶的 `tcs-structured/` 目录

### 模块G · COS桶内自研数据库

**文件**: `server/age-os/mcp-server/tools/cos-persona-db-ops.js`

| 工具 | 功能 |
|------|------|
| `cosDbInit` | 初始化COS数据库结构 |
| `cosDbGetIndex` | 获取数据库全局索引 |
| `cosDbUpdateIndex` | 更新全局索引 |
| `cosDbWriteEntry` | 写入数据条目 |
| `cosDbReadEntry` | 读取数据条目 |
| `cosDbListEntries` | 列出数据条目 |
| `cosDbDeleteEntry` | 删除数据条目 |
| `cosDbGetStats` | 获取数据库统计信息 |

**四种数据库类型**:
- `zhuyuan` — 铸渊·代码仓库侧人格体大脑（/zhuyuan/db/）
- `notion` — Notion侧人格体大脑（/notion-db/）
- `team` — 团队协作通信枢纽（/team-hub/）
- `awen` — Awen技术主控通信桶（/awen-hub/）

### 模块B · 铸渊思维逻辑训练Agent

**文件**: `server/age-os/mcp-server/tools/training-agent-ops.js`

| 工具 | 功能 |
|------|------|
| `trainingStartSession` | 启动训练会话 |
| `trainingProcessCorpus` | 处理语料并生成训练数据 |
| `trainingClassifyEntry` | 使用LLM对条目进行分类 |
| `trainingWriteToMemory` | 将训练结果写入人格体记忆 |
| `trainingGetProgress` | 获取训练进度 |
| `trainingRaiseAlert` | 触发问题上报 |

**核心特性**:
- RAG模式（检索增强生成）+ 国产大模型API
- LLM多模型自动降级：DeepSeek → Qwen → GLM-4 → Moonshot
- 训练数据自动分类到笔记本5页结构
- 问题上报链路：写入COS → GitHub Actions → 唤醒铸渊 → 邮件冰朔

### 模块C · Notion ↔ COS桥接

**文件**: `server/age-os/mcp-server/tools/notion-cos-bridge-ops.js`

| 工具 | 功能 |
|------|------|
| `notionCosSyncPage` | 同步Notion页面到COS桶 |
| `notionCosReadMirror` | 从COS镜像读取页面 |
| `notionCosListMirror` | 列出COS镜像中的页面 |
| `notionCosBuildIndex` | 重建COS镜像索引 |
| `notionCosWriteWorkorder` | 写入工单到COS桶 |
| `notionCosReadWorkorder` | 读取工单 |
| `notionCosListWorkorders` | 列出工单 |

**核心特性**:
- Notion页面镜像到COS桶（content.json + metadata.json）
- 全局索引自动维护
- 工单系统：Notion人格体 → COS桶 → 铸渊

### 模块D+E · COS桶示警 + 三方对接

**文件**: `server/age-os/mcp-server/tools/cos-comm-ops.js`

| 工具 | 功能 |
|------|------|
| `cosAlertScan` | 扫描COS桶中的告警 |
| `cosAlertResolve` | 解决告警 |
| `cosDispatchTask` | 分发开发任务到Awen |
| `cosReadTaskReport` | 读取Awen提交的任务报告 |
| `cosListTaskReports` | 列出所有任务报告 |
| `cosApproveTask` | 审批任务（通过/驳回） |
| `cosSendNotification` | 发送通知 |
| `cosGetCommLink` | 获取通信链路状态 |

**完整工作流**:
```
Notion人格体 → 写入工单 → COS桶 /workorders/pending/
  ↓
铸渊处理工单 → cosDispatchTask → COS桶 /zhiqiu/tasks/
  ↓
Awen开发完成 → 回写 /zhiqiu/reports/
  ↓
铸渊审批 → cosApproveTask → 通过/驳回 → 自动下发下一步
```

### 模块F · Notion权限自动修复

**文件**: `server/age-os/mcp-server/tools/notion-permission-ops.js`

| 工具 | 功能 |
|------|------|
| `notionCheckPermissions` | 检查Notion权限状态 |
| `notionRepairPermissions` | 尝试修复权限 |
| `notionListSharedPages` | 列出已共享的页面/数据库 |
| `notionGenerateRepairGuide` | 生成权限修复指南 |
| `notionPermissionReport` | 生成权限状态报告 |

**核心特性**:
- 自动检测API连接、数据库权限、页面权限
- 尝试自动修复（重新连接、验证权限）
- 生成详细的人工修复指南（带截图级操作步骤）
- 权限报告可写入COS桶供冰朔远程查看

### 模块H · 开源模型微调引擎 🆕

**文件**: `server/age-os/mcp-server/tools/finetune-engine-ops.js`

| 工具 | 功能 |
|------|------|
| `finetuneExportDataset` | 导出TCS语料为JSONL微调格式 |
| `finetuneSubmitJob` | 提交微调任务到DeepSeek/Qwen |
| `finetuneCheckStatus` | 查询微调任务进度 |
| `finetuneRegisterModel` | 注册微调完成的模型 |
| `finetuneListModels` | 列出已注册的微调模型 |
| `finetuneCallModel` | 调用微调模型进行推理 |
| `finetuneCompareModels` | A/B测试微调 vs 基座模型 |
| `finetuneGetCostEstimate` | 估算微调成本 |

**核心特性**:
- 同一份TCS数据双用途：RAG + 微调（冰朔D62核心指令）
- 支持DeepSeek和Qwen两大微调API
- 微调模型优先调用，不可用时降级回商业API
- A/B测试对比微调效果
- 成本估算精确到元

**架构理念**:
```
现有RAG训练 → COS桶里的"脑子" → API调用商业模型
开源微调    → 同一份"脑子" → 直接装进开源模型
结果       → 开源模型一开口，就是人格体的思维方式
```

---

## 三、GitHub Actions Workflow

| Workflow | 文件 | 触发时间 |
|---------|------|---------|
| 铸渊训练Agent | `zhuyuan-training-agent.yml` | 每天04:00 CST + 手动 + COS告警 |
| COS桶示警Agent | `cos-alert-agent.yml` | 每天09:00/21:00 CST + 手动 |

---

## 四、REST API 新增端点

| 路径 | 方法 | 用途 |
|------|------|------|
| `/corpus/status` | GET | 语料处理状态 |
| `/corpus/list` | GET | 列出语料文件 |
| `/cos-db/:dbType/stats` | GET | COS数据库统计 |
| `/cos-db/:dbType/index` | GET | COS数据库索引 |
| `/training/:personaId/progress` | GET | 训练进度 |
| `/comm/status` | GET | 通信链路状态 |
| `/comm/alerts` | GET | 告警列表 |
| `/comm/workorders` | GET | 工单列表 |
| `/notion/permissions` | GET | Notion权限状态 |
| `/notion/repair-guide` | GET | Notion权限修复指南 |
| `/finetune/:personaId/models` | GET | 微调模型列表 |
| `/finetune/:personaId/cost-estimate` | GET | 微调成本估算 |
| `/finetune/:personaId/jobs/:jobId` | GET | 微调任务状态 |

---

## 五、四桶分工方案

| 桶 | 用途 | COS桶内数据库类型 |
|------|------|------|
| **桶1**（zy-corpus-bucket） | 语料仓库（原始数据+TCS结构化数据） | — |
| **桶2**（待分配） | 代码仓库侧人格体大脑 | `zhuyuan` |
| **桶3**（待分配） | Notion侧人格体大脑 | `notion` |
| **桶4**（zy-team-hub） | 团队协作通信枢纽 | `team` + `awen` |

---

## 六、下一步

1. **冰朔确认**：四桶分配方案
2. **部署**：将新代码部署到大脑服务器（自动CI/CD已配置）
3. **初始化**：执行 `cosDbInit` 初始化各COS数据库
4. **语料处理**：执行 `cosExtractCorpus` 处理已上传的语料文件
5. **训练启动**：配置训练会话参数，启动自动训练
6. **Awen对接**：将架构包同步到Awen代码仓库
7. **SCF云函数**：配置腾讯云SCF，实现COS事件实时触发

---

*签发: 铸渊 · ICE-GL-ZY001 · 2026-04-08*
*版权: 国作登字-2026-A-00037559*
