# 铸渊任务注册表 · Task Registry
# 签发: 铸渊 · TCS-ZY001 · 2026-04-04
# 版权: 国作登字-2026-A-00037559

---

## 为什么有这个文件

冰朔说："把之前散落的没有整理好的这些任务都收好，给自己做好编号，路径映射，然后编码检索。"

这个文件是铸渊所有任务的索引中心。每个任务有唯一编号、文件路径、状态、关联对话编号。
铸渊下次唤醒时，说"查任务"就来这里。

---

## 编号规范

- **ZY-TASK-xxx** — 铸渊执行的具体开发任务
- **ZY-SYS-xxx** — 系统架构设计任务
- **ZY-DOC-xxx** — 文档/认知记录任务
- **ZY-WEB-xxx** — 网站开发任务

---

## 一、系统架构类 (ZY-SYS)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-SYS-001 | AGE OS 落地架构 v1.0 | `brain/age-os-landing/architecture-v1.md` | ✅ 完成 | D45 |
| ZY-SYS-002 | AGE OS 落地架构 v2.0 | `brain/age-os-landing/architecture-v2.md` | ✅ 完成 | D48 |
| ZY-SYS-003 | 数字地球六层模型 | `brain/age-os-landing/architecture-v1.md` §一 | ✅ 完成 | D45 |
| ZY-SYS-004 | 元认知锚点系统 | `brain/metacognition-anchor.json` | ✅ v2.0 | D46-D47 |
| ZY-SYS-005 | 四域结构定义 | `brain/hololake-world-domains.md` | ✅ v2.0 | D46-D47 |
| ZY-SYS-006 | Agent集群6层18个架构 | `brain/agent-cluster-architecture.md` | ✅ v1.0 | D47 |
| ZY-SYS-007 | 为什么数据库 | `brain/why-database.json` | ✅ 12条 | D46-D47 |
| ZY-SYS-008 | 将军架构系统 | `brain/zhuyuan-general-architecture.md` | ✅ 九军团 | D27 |
| ZY-SYS-009 | 副将系统 | `brain/deputy-general-config.json` | ✅ v1.0 | D29-D30 |
| ZY-SYS-010 | 语言膜架构 | `brain/language-membrane-architecture.md` | ✅ v1.0 | D23 |
| ZY-SYS-011 | HLDP通用协议 | `hldp/data/common/HLDP-COMMON-PROTOCOL.json` | ✅ v1.0 | D25 |
| ZY-SYS-012 | 铸渊HLDP方言 | `hldp/data/common/zhuyuan-hldp-dialect.json` | ✅ v1.0 | D30 |
| ZY-SYS-013 | 军营部署全图 | `brain/garrison-deployment.json` | ✅ 52模块 | D30 |
| ZY-SYS-014 | 全链路部署观测 | `zhuyuan-deploy-observer.yml` | ✅ v1.0 | D29 |
| ZY-SYS-015 | 自研代码仓库规划 | `brain/age-os-landing/architecture-v2.md` §三 | ✅ 框架 | D48 |
| ZY-SYS-016 | 战略主控台架构 | `brain/age-os-landing/architecture-v2.md` §六 | ✅ 框架 | D48 |
| ZY-SYS-017 | 多仓库人格体管理 | `brain/age-os-landing/architecture-v2.md` §四 | ✅ 框架 | D48 |

## 二、数据库与工具链 (ZY-TASK)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-TASK-001 | PostgreSQL建表脚本 | `server/age-os/schema/001-brain-tables.sql` | ✅ S1完成 | D45 |
| ZY-TASK-002 | MCP Server骨架 | `server/age-os/mcp-server/server.js` | ✅ S2完成 | D45 |
| ZY-TASK-003 | 节点CRUD工具(5个) | `server/age-os/mcp-server/server.js` | ✅ 骨架 | D45 |
| ZY-TASK-004 | 关系工具链(3个) | — | ⏳ S3待开发 | — |
| ZY-TASK-005 | 结构工具链(3个) | — | ⏳ S3待开发 | — |
| ZY-TASK-006 | COS双桶工具(5个) | — | ⏳ S4待开发 | — |
| ZY-TASK-007 | Agent调度框架 | — | ⏳ S5待开发 | — |
| ZY-TASK-008 | Notion同步Agent | — | ⏳ S6待开发 | — |
| ZY-TASK-009 | 网站MCP接入 | — | ⏳ S7待开发 | — |
| ZY-TASK-010 | 广州投影 | — | ⏳ S8待开发 | — |

## 三、网站开发类 (ZY-WEB)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-WEB-001 | 光湖灯塔着陆页v1.0 | `docs/index.html` | ✅ 完成 | D34 |
| ZY-WEB-002 | 银河星空UI | `docs/index.html` CSS | ✅ v42.0 | D42 |
| ZY-WEB-003 | Device Agent适配 | `docs/index.html` DA | ✅ v42.0 | D42 |
| ZY-WEB-004 | 3D翻转引擎 | `docs/index.html` JS | ✅ v42.0 | D42 |
| ZY-WEB-005 | Agent桥接系统 | `docs/index.html` AgentBridge | ✅ v43.0 | D43 |
| ZY-WEB-006 | 码字工作台v1.0 | `docs/index.html` 15页面 | ✅ v43.0 | D43 |
| ZY-WEB-007 | OS仪表盘改版 | `docs/index.html` sysPanel | ✅ v44.0 | D44 |
| ZY-WEB-008 | 首页重构v48.0 | `docs/index.html` pg-home | ✅ v48.0 | D48 |
| ZY-WEB-009 | 团队区更新 | `docs/index.html` team | ✅ v48.0 | D48 |
| ZY-WEB-010 | 编辑器背景+工作台UI修复 | `docs/index.html` editor/workspace | ✅ v50.0 | D50 |
| ZY-WEB-011 | 码字工作台动态书本图标 | `docs/index.html` hero-card SVG | ✅ v50.0 | D50 |
| ZY-WEB-012 | 系统面板全面重构 | `docs/index.html` pg-system | ✅ v50.0 | D50 |
| ZY-WEB-013 | HoloLake Days运行天数 | `docs/index.html` uptimeNum | ✅ v50.0 | D50 |
| ZY-WEB-014 | UI大气化v50.0 | `docs/index.html` CSS全局 | ✅ v50.0 | D50 |

## 四、文档记录类 (ZY-DOC)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-DOC-001 | 思维链记录 | `brain/age-os-landing/thinking-chain.md` | ✅ D45-D48 | 持续 |
| ZY-DOC-002 | 开发路线图 | `brain/age-os-landing/development-roadmap.md` | ✅ S1-S12 | D45/D48 |
| ZY-DOC-003 | 快速唤醒上下文 | `brain/fast-wake.json` | ✅ D48 | 持续 |
| ZY-DOC-004 | 任务注册表 | `brain/age-os-landing/task-registry.md` | ✅ 本文件 | D48 |
| ZY-DOC-005 | 密钥更新指引 | `brain/age-os-landing/secrets-update.md` | ✅ 13密钥 | D45 |
| ZY-DOC-006 | 唤醒阅读顺序 | `brain/read-order.md` | ✅ v8.0 | D46 |

## 五、服务器配置类

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-SVR-001 | 新加坡服务器部署 | `server/zhuyuan-server-profile.json` | ✅ 运行中 | D11 |
| ZY-SVR-002 | 广州服务器配置 | `server/cn-server-profile.json` | ⏳ 待配置 | — |
| ZY-SVR-003 | 硅谷服务器占位 | `brain/age-os-landing/architecture-v1.md` | 📌 占位 | D45 |
| ZY-SVR-004 | SSL自动化 | `server/setup/setup-ssl.sh` | ✅ Let's Encrypt | D16 |
| ZY-SVR-005 | DNS解析 | — | ✅ guanghulab.online | D34 |
| ZY-SVR-006 | 铸渊专线VPN | `server/proxy/` + `brain/proxy-task/` | 🔧 修复中 | D49-D51 |

---

## 快速检索

- **查架构**: → `brain/age-os-landing/architecture-v2.md`
- **查进度**: → `brain/age-os-landing/development-roadmap.md`
- **查思维**: → `brain/age-os-landing/thinking-chain.md`
- **查身份**: → `brain/metacognition-anchor.json`
- **查世界**: → `brain/hololake-world-domains.md`
- **查军队**: → `brain/zhuyuan-general-architecture.md`
- **查部署**: → `brain/garrison-deployment.json`
- **查网站**: → `docs/index.html`
- **查数据库**: → `server/age-os/schema/001-brain-tables.sql`
- **查MCP**: → `server/age-os/mcp-server/server.js`
- **查专线**: → `brain/proxy-task/verification-progress.md`
- **查密钥**: → `brain/secrets-manifest.json`
- **查健康**: → `brain/system-health.json`

- **查系统规划**: → `brain/age-os-landing/system-development-plan-v2.md`
- **查团队接入**: → `team-integration-v4/README.md`
- **查笔记本模板**: → `team-integration-v4/brain/notebook.json`

## 六、D59新增系统任务 (ZY-SYS · S15-S20)

| 编号 | 阶段 | 任务名称 | 路径 | 状态 | 对话 | 预估唤醒 |
|------|------|---------|------|------|------|---------|
| ZY-SYS-018 | S15 | 人格体专属数据库引擎 | — | 🆕 规划完成 | D59 | 5次 |
| ZY-SYS-019 | S16 | 云端算力共享池 | — | 🆕 规划完成 | D59 | 5次 |
| ZY-SYS-020 | S17 | COS存储共享池 | — | 🆕 规划完成 | D59 | 3次 |
| ZY-SYS-021 | S18 | 用户自动开服系统 | — | 🆕 规划完成 | D59 | 3次 |
| ZY-SYS-022 | S19 | 冰朔语言人格本体模块 | — | 🆕 规划完成 | D59 | 8次 |
| ZY-SYS-023 | S20 | 行业模块接入框架 | — | 🆕 规划完成 | D59 | 3次 |

## 七、D59新增文档 (ZY-DOC)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-DOC-007 | 系统架构开发规划v2.0 | `brain/age-os-landing/system-development-plan-v2.md` | ✅ 完成 | D59 |
| ZY-DOC-008 | 光湖团队接入系统v4.0 | `team-integration-v4/README.md` | ✅ 完成 | D59 |
| ZY-DOC-009 | 笔记本系统模板 | `team-integration-v4/brain/notebook.json` | ✅ 完成 | D59 |
| ZY-DOC-010 | D59思维链 | `brain/age-os-landing/thinking-chain.md` | ✅ 完成 | D59 |

## 八、D60新增 (ZY-TASK / ZY-DOC)

| 编号 | 任务名称 | 路径 | 状态 | 对话 |
|------|---------|------|------|------|
| ZY-TASK-011 | 记忆世界地图v5.0 | `brain/repo-map.json` | ✅ 完成 | D60 |
| ZY-TASK-012 | COS自动接入Agent | `scripts/cos-auto-join-agent.js` | ✅ 完成 | D60 |
| ZY-TASK-013 | COS接入工作流 | `.github/workflows/cos-auto-join.yml` | ✅ 完成 | D60 |
| ZY-TASK-014 | COS接入注册表 | `data/cos-join-registry.json` | ✅ 完成 | D60 |
| ZY-DOC-011 | README首页全量更新D60 | `README.md` | ✅ 完成 | D60 |
| ZY-DOC-012 | D60思维链 | `brain/age-os-landing/thinking-chain.md` | ✅ 完成 | D60 |

---

*铸渊每次唤醒，先查本文件，就知道所有任务在哪里。*
*新增任务时，必须在本文件注册编号和路径。*
