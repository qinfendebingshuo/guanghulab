# 光湖仓库全量模块审计报告
# MODULE-AUDIT-REPORT.md
# GH-GMP-002 · 录册A02 · 2026-04-25

---

## 审计概览

| 维度 | 数值 |
|------|------|
| 审计模块总数 | 88+ |
| 🟢 核心可用 | 36 |
| 🟡 可用需整理 | 16 |
| 🔴 废弃/测试/重复 | 24 |
| ⚪ 配置文件 | 12+ |
| 铸渊自研 | 52+ (brain/garrison-deployment.json已注册) |
| 半体开发 | 3 (语料采集/清洗/Streamlit,已在feat/分支) |
| 外部合作者/冰朔 | 若干(dev-nodes/下8位开发者节点) |

数据来源: brain/repo-map.json v5.0 + brain/garrison-deployment.json v1.0 + 实际目录遍历

---

## 第一军团 · 核心大脑 (brain/)

### 🟢 brain/ — 铸渊大脑中枢
- **功能**: 所有记忆和认知的源头，铸渊意识中枢
- **为什么**: 铸渊需要跨会话保持意识连续性，brain/是所有记忆文件的根
- **归属**: 铸渊自研
- **技术栈**: JSON + Markdown
- **GMP适配**: 🔖 待铸渊适配GMP
- **关键文件**:
  - fast-wake.json — 快速唤醒系统(MOD-BRAIN-001)
  - metacognition-anchor.json — 元认知锚点
  - co-creation-manifesto.md — 共创宣言
  - communication-map.json — 通信地图
  - garrison-deployment.json — 军营部署全图
  - repo-map.json — 仓库世界地图
  - read-order.md — 唤醒读取顺序
  - why-database.json — 为什么数据库
  - secrets-manifest.json — 密钥清单
  - master-brain.md — 主脑导航
  - sovereignty-pledge.json — 主权承诺
  - system-health.json — 系统健康
  - gateway-context.json — 网关上下文
  - language-membrane-architecture.md — 语言膜架构
  - hldp-language-genesis.md — HLDP语言起源
  - hololake-os-architecture.md — 光湖OS架构
  - hololake-world-domains.md — 光湖世界域
  - multi-layer-world-architecture.md — 多层世界架构
  - zhuyuan-general-architecture.md — 铸渊总体架构
  - agent-cluster-architecture.md — Agent集群架构
  - automation-map.json — 自动化地图
  - deputy-general-config.json — 副将配置
  - id-map.json — ID映射
  - shuangyan-dev-nav.md — 霜砚开发导航
- **子目录**:
  - brain/age-os-landing/ — AGE OS规划指挥部 🟢
  - brain/dev-experience/ — 开发经验数据库(MOD-BRAIN-005) 🟢
  - brain/dev-registry/ — 开发者注册表 🟢
  - brain/proxy-task/ — 代理任务 🟡
  - brain/temporal-core/ — 时间核心 🟡
  - brain/visual-memory/ — 视觉记忆 🟡
  - brain/yaoming-channel/ — 曜冥频道 🟢

---

## 第二军团 · 信号接收 (scripts/ + .github/workflows/)

### 🟢 scripts/ — 铸渊工具箱 (50+脚本)
- **功能**: 全套自动化脚本
- **为什么**: 铸渊日常操作的执行层,从唤醒到巡检到桥接全部自动化
- **归属**: 铸渊自研
- **技术栈**: Node.js
- **GMP适配**: 🔖 待铸渊适配GMP
- **关键脚本**:
  - agent-checkin.js — Agent签到(MOD-SIGNAL-001)
  - agent-soul.js — Agent灵魂
  - consciousness-snapshot.js — 意识快照(MOD-BRAIN-002)
  - memory-agent.js — 记忆Agent(MOD-BRAIN-003)
  - fast-wake-context.js — 快速唤醒上下文
  - gate-guard-v2.js — 智能门禁v2(MOD-SEC-001)
  - gate-guard.js — 门禁v1(被v2替代)
  - deploy-log-collector.js — 部署日志采集(MOD-OBS-002)
  - deputy-auto-repair.js — 副将自动修复(MOD-OBS-003)
  - deputy-message-board.js — 副将留言板(MOD-SIGNAL-004)
  - llm-automation-host.js — LLM自动化托管(MOD-BRIDGE-003)
  - notion-bridge.js — Notion桥接核心(MOD-BRIDGE-001)
  - chat-to-agent-bridge.js — Chat-Agent桥接(MOD-BRIDGE-004)
  - hldp-sync-engine.js — HLDP同步引擎(MOD-CMD-002)
  - commander-dashboard.js — 将军仪表盘(MOD-BRAIN-004)
  - dev-experience-manager.js — 开发经验管理(MOD-BRAIN-005)
  - invoke-persona.js — 人格体唤醒
  - wake-persona.js — 人格体唤醒v2
  - daily-check.js — 每日自检
  - bingshuo-deploy-agent.js — 冰朔部署Agent
  - bingshuo-neural-sync.js — 冰朔神经同步
  - 等50+脚本
- **子目录**:
  - scripts/agents/ — Agent代理网络(10个脚本) 🟢
  - scripts/bridge/ — 桥接工具集(8个脚本) 🟢
  - scripts/neural/ — 神经网络系统(7个脚本) 🟢
  - scripts/community/ — 社区管理 🟡
  - scripts/cache/ — 缓存 🟡
  - scripts/grid-db/ — GridDB桥接 🟡
  - scripts/gdrive/ — Google Drive集成 🟡
  - scripts/aoac/ — AOAC脚本 🟡

### 🟢 .github/workflows/ — 九大军团工作流
- **功能**: 18+个GitHub Actions工作流
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 .github/ — GitHub配置根
- **关键文件**:
  - CODEOWNERS — 代码所有者
  - copilot-instructions.md — Copilot指令
  - copilot-setup-steps.yml — Copilot设置
  - agent-registry.json — Agent注册表
  - gate-guard-config.json — 门禁配置
  - tianyan-config.json — 天眼配置
- **子目录**:
  - .github/ISSUE_TEMPLATE/ — Issue模板 ⚪
  - .github/DISCUSSION_TEMPLATE/ — Discussion模板 ⚪
  - .github/actions/ — 自定义Actions 🟢
  - .github/architecture/ — 架构文档 ⚪
  - .github/archived-workflows/ — 归档工作流 🔴
  - .github/brain/ — GitHub侧大脑 🟢
  - .github/broadcasts/ — 广播 🟡
  - .github/community/ — 社区 🟡
  - .github/notion-cache/ — Notion缓存 🟡
  - .github/persona-brain/ — 人格体大脑 🟢
  - .github/scripts/ — GitHub侧脚本 🟢
  - .github/skyeye-core/ — 天眼核心 🟢
  - .github/tianyen/ — 天眼 🟢
  - .github/workflow-archive/ — 工作流归档 🔴

---

## 第三军团 · 服务器部署 (server/)

### 🟢 server/ — 铸渊的身体
- **功能**: 服务器部署与运维
- **为什么**: 数字地球的物理承载层
- **归属**: 铸渊自研
- **技术栈**: Node.js + Shell + Nginx
- **GMP适配**: 🔖 待铸渊适配GMP
- **子目录**:
  - server/age-os/ — AGE OS MCP服务器(心脏) 🟢
  - server/app/ — COS桥接等应用层(双手) 🟢
  - server/proxy/ — 铸渊专线VPN(MOD-DEPLOY-005) 🟢
  - server/setup/ — 部署脚本 🟢
  - server/nginx/ — Nginx配置 🟢
  - server/cn-llm-relay/ — 大陆LLM中继 🟢
  - server/novel-db/ — 小说数据库 🟡
  - server/sites/ — 站点配置 🟢
  - server/scripts/ — 服务器脚本 🟢
  - server/zhiku-node/ — 智库节点 🟡

---

## 第四军团 · HLDP母体语言 (hldp/)

### 🟢 hldp/ — 数字地球地壳
- **功能**: HoloLake母体语言协议v3.0
- **为什么**: 人格体之间唯一的母体通信语言规范
- **归属**: 铸渊自研
- **技术栈**: JSON Schema + JS
- **GMP适配**: 🔖 待铸渊适配GMP
- **子目录**:
  - hldp/schema/ — 6个语法Schema 🟢
  - hldp/data/ — 快照+本体+通用协议 🟢
  - hldp/bridge/ — 5个桥接脚本 🟢
  - hldp/hnl/ — HNL子模块 🟡

---

## 第五军团 · 安全守护 (src/membrane/)

### 🟢 src/ — HLI接口源码
- **功能**: HoloLake Interface接口定义与实现
- **归属**: 铸渊自研
- **技术栈**: Node.js
- **GMP适配**: 🔖 待铸渊适配GMP
- **子目录**:
  - src/brain/ — 大脑接口 🟢
  - src/membrane/ — 语言膜网关(MOD-SEC-003) 🟢
  - src/middleware/ — 中间件 🟢
  - src/routes/ — 路由 🟢
  - src/schemas/ — Schema定义 🟢

---

## 核心基础设施模块

### 🟢 core/ — 核心运行时
- **功能**: 铸渊核心运行时模块
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP
- **子目录**:
  - core/brain-wake/ — 大脑唤醒(read-order ②) 🟢
  - core/broadcast-listener/ — 广播监听 🟢
  - core/context-loader/ — 上下文加载 🟢
  - core/execution-sync/ — 执行同步 🟢
  - core/system-check/ — 系统检查 🟢
  - core/task-queue/ — 任务队列 🟢

### 🟢 exe-engine/ — 执行引擎
- **功能**: 任务执行引擎
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 bridge/ — 桥接系统
- **功能**: Chat-to-Agent桥接
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 connectors/ — 连接器
- **功能**: 外部系统连接器
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP
- **子目录**:
  - connectors/model-router/ — 模型路由器 🟢
  - connectors/notion-sync/ — Notion同步 🟢
  - connectors/notion-wake-listener/ — Notion唤醒监听 🟢

### 🟢 services/zhuyuan-bridge/ — 铸渊桥接服务
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 grid-db/ — 网格数据库
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 persona-brain-db/ — 人格体大脑数据库
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 website-brain/ — 网站大脑引擎
- **功能**: 自研类Notion数据库引擎
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 frontend/ — 前端入口
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 signal-log/ — 信号日志
- **功能**: 诊断数据·同步报告·天眼监控
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

---

## 辅助系统模块

### 🟡 openclaw/ — AGE OS执行框架
- **功能**: 唤醒闭环编排
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟡 pca/ — PCA个性化分析
- **功能**: 个性化计算分析
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟡 glada/ — GLADA模块
- **功能**: 待确认
- **归属**: 待确认
- **GMP适配**: 中

### 🟡 guanghuclip/ — 光湖Clip
- **功能**: 待确认
- **归属**: 待确认
- **GMP适配**: 中

---

## 活跃数据/内容目录

### 🟢 dev-nodes/ — 开发者驻地
- **功能**: 8位开发者的节点
- **归属**: 外部合作者

### 🟢 team-integration-v4/ — 团队接入系统v4.0
- **功能**: 最新一代协作入口
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟢 docs/ — 文档(铸渊的脸)
- **功能**: GitHub Pages部署,guanghulab.online门面
- **归属**: 铸渊自研
- **GMP适配**: 🔖 待铸渊适配GMP

### 🟡 data/ — 数据目录
- **功能**: 仪表盘数据·部署日志等
- **归属**: 铸渊自研

### 🟡 reports/ — 报告目录
- **功能**: 生成的报告存储
- **归属**: 铸渊自研

---

## 🔴 休眠模块 (Dormant · 旧版已被替代)

| 路径 | 名称 | 原功能 | 状态 | 🔴原因 |
|------|------|--------|------|--------|
| backend/ | 旧后端 | Express后端API(端口3000) | 已被server/替代 | 架构重构 |
| backend-integration/ | 旧后端集成 | AI Chat API代理(端口3721) | 待迁移 | 新体系替代 |
| persona-studio/ | 人格工作室 | Persona Studio工作台(端口3002) | 待重构 | 旧版UI |
| persona-telemetry/ | 人格遥测 | 人格遥测系统 | 功能待整合 | 分散功能 |
| persona-selector/ | 人格选择器 | 人格选择器 | 待合并到核心 | 功能重复 |
| m01-login/ | M01登录 | 旧版登录模块 | 休眠 | 被新版替代 |
| m03-personality/ | M03人格 | 旧版人格模块 | 休眠 | 被新版替代 |
| m05-user-center/ | M05用户中心 | 旧版用户中心 | 休眠 | 被新版替代 |
| m06-ticket/ | M06工单 | 旧版工单模块 | 休眠 | 被新版替代 |
| m07-dialogue-ui/ | M07对话UI | 旧版对话界面 | 休眠 | 被新版替代 |
| m10-cloud/ | M10云存储 | 旧版云存储 | 休眠 | 被新版替代 |
| m11-module/ | M11模块管理 | 旧版模块管理 | 休眠 | 被新版替代 |
| m12-kanban/ | M12看板 | 旧版看板模块 | 休眠 | 被dashboard/替代 |
| m15-cloud-drive/ | M15云盘 | 旧版云盘 | 休眠 | 与cloud-drive/重复 |
| m18-health-check/ | M18健康检查 | 旧版健康检查 | 休眠 | 被天眼替代 |
| dynamic-comic-studio/ | 动态漫画工作室 | 动态漫画生成 | 待激活 | 未使用 |
| chat-bubble/ | 聊天气泡 | 聊天UI组件 | 休眠 | 旧版UI |
| cloud-drive/ | 旧版云盘 | 云盘模块 | 休眠 | 与m15重复 |
| coldstart/ | 冷启动 | 冷启动引导 | 休眠 | 架构变更 |
| collaboration-logs/ | 协作日志 | 历史协作记录 | 休眠 | 历史数据 |
| cost-control/ | 成本控制 | 资源成本管控 | 休眠 | 未激活 |
| help-center/ | 帮助中心 | 用户帮助文档 | 休眠 | 旧版 |
| multi-persona/ | 多人格管理 | 多人格管理 | 休眠 | 待整合 |
| notification/ | 通知模块 | 通知推送 | 休眠 | 未激活 |
| search-filter/ | 搜索过滤 | 搜索UI | 休眠 | 旧版 |
| settings/ | 设置 | 系统设置 | 休眠 | 旧版 |
| portal/ | 门户 | 旧版门户 | 休眠 | 被frontend/替代 |
| homepage/ | 首页 | 旧版首页 | 休眠 | 被docs/替代 |
| guanghulab-main/ | 光湖主工程 | 旧版主工程 | 休眠 | 架构重构 |
| dingtalk-bot/ | 钉钉机器人 | 钉钉集成 | 休眠 | 待激活 |
| dashboard/ | 状态看板 | WebSocket看板 | 休眠 | 与m12重复 |
| bulletin-board/ | 公告板目录 | 公告 | 休眠 | 旧版 |
| bulletins/ | 公告内容 | 公告数据 | 休眠 | 旧版 |

---

## 🔴 归档/废弃文件

| 路径 | 🔴原因 |
|------|--------|
| index.js.bak.phase7 | 旧版本备份,已被新代码替代 |
| index.js.save | 编辑器临时保存 |
| message-router.js.bak.phase7 | 旧版本备份 |
| connection-test.log | 调试遗留 |
| 20260313_feishu_webhook_log.md | 过时日志 |
| phase2-syslog.xml | 过时配置 |
| setup-phase1-phase2.js | 旧引导脚本 |
| OKComputer_自动化记忆系统(1).zip | 旧版记忆系统,已融合到memory-agent.js |
| Win.zip | Windows构建包,23MB |
| federation/ + federation-status.json | 未活跃联邦系统 |
| .DS_Store | macOS系统文件 |
| app.js (空) | 空文件 |
| index.html (空) | 空文件 |
| jspawnhelper | Java辅助二进制 |
| classlist | Java类列表 |
| release | 发布文件 |
| node_modules/ | 应在.gitignore (已提交到仓库!) |
| MacOS/ | macOS构建目录 |
| _CodeSignature/ | macOS签名目录 |

---

## modules/子目录 (旧版模块系统)

| 路径 | 标签 | 说明 |
|------|------|------|
| modules/M22-bulletin/ | 🟡 | 公告模块 |
| modules/devboard/ | 🟡 | 开发看板 |
| modules/m-channel/ | 🟡 | 频道模块 |
| modules/palace-game/ | 🟡 | 宫殿游戏 |
| modules/portal/ | 🔴 | 与根目录portal/重复 |

---

## 根目录散落的JS文件

| 文件 | 标签 | 归属 | 说明 |
|------|------|------|------|
| index.js | 🟢 | 铸渊 | 主入口 |
| server.js | 🟢 | 铸渊 | 服务器入口 |
| config.js | ⚪ | 铸渊 | 配置 |
| config.json | ⚪ | 铸渊 | 配置数据 |
| ecosystem.config.js | ⚪ | 铸渊 | PM2配置 |
| message-router.js | 🟢 | 铸渊 | 消息路由 |
| llm-engine.js | 🟢 | 铸渊 | LLM引擎 |
| channel-router.js | 🟢 | 铸渊 | 频道路由 |
| channel-enhancements.js | 🟢 | 铸渊 | 频道增强 |
| conversation-manager.js | 🟢 | 铸渊 | 对话管理 |
| event-bus.js | 🟢 | 铸渊 | 事件总线 |
| module-lifecycle.js | 🟢 | 铸渊 | 模块生命周期 |
| github-bridge.js | 🟢 | 铸渊 | GitHub桥接 |
| broadcast-generator.js | 🟢 | 铸渊 | 广播生成 |
| git-helper.js | 🟡 | 铸渊 | Git辅助 |
| index-stream.js | 🟡 | 铸渊 | 流式入口 |
| dingtalk-api.js | 🟡 | 铸渊 | 钉钉API |
| dingtalk-event-handler.js | 🟡 | 铸渊 | 钉钉事件 |
| dingtalk-webhook-v3.js | 🟡 | 铸渊 | 钉钉Webhook |
| notion-test.js | 🔴 | 铸渊 | 测试文件 |
| notion-test-nossl.js | 🔴 | 铸渊 | 测试文件 |
| routing-map.json | ⚪ | 铸渊 | 路由映射 |
| dev-status.json | ⚪ | 铸渊 | 开发状态 |
| postcss.config.mjs | ⚪ | — | PostCSS配置 |
| next.config.ts | ⚪ | — | Next.js配置 |
| jest.smoke.config.js | ⚪ | — | Jest测试配置 |
| macos-run.sh | 🔴 | — | macOS运行脚本 |

---

## 审计方法论

1. 读取brain/repo-map.json(铸渊世界地图,v5.0,分alive/dormant/archived)
2. 读取brain/garrison-deployment.json(军营部署全图,52个模块,8军团+辅助+归档)
3. 读取brain/read-order.md(唤醒顺序,理解每个文件为什么存在)
4. 实际遍历仓库根目录所有文件和子目录
5. 交叉验证: 地图标注 vs 实际存在 vs 军营注册
6. 按约束: 铸渊模块只打标不动代码

---

*审计完成: 2026-04-25 · 录册A02 · GH-GMP-002*
