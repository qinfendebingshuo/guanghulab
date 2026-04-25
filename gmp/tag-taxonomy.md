# GMP 标签分类体系 / GMP Tag Taxonomy
# 光湖模块协议 · 标签分类定义

> **文档编号 / Doc ID**: GMP-TAG-TAXONOMY-v1.0  
> **关联 / Related**: GMP-SPEC-v1.0  
> **作者 / Author**: 译典A05 (5TH-LE-HK-A05)  
> **覆盖范围**: 仓库全部 ~88 个模块  

---

## 1. 标签维度总览 / Tag Dimensions Overview

GMP 标签体系包含 4 个核心维度：

| 维度 | 字段名 | 说明 | 必填 |
|---|---|---|---|
| 状态标签 | `tags.status` | 模块的生产就绪度 | ✅ |
| 功能分类 | `tags.category` | 模块的功能类别 | ✅ |
| 架构层级 | `tags.layer` | 模块在架构中的位置 | ✅ |
| 开发者归属 | `tags.attribution` | 模块的开发来源 | ✅ |

---

## 2. 状态标签 / Status Tags

| 值 | 图标 | 中文名 | 英文名 | 定义 | 典型场景 |
|---|---|---|---|---|---|
| `green` | 🟢 | 核心可用 | Production Ready | 生产就绪，稳定运行，有完整文档 | server.js, event-bus.js, module-lifecycle.js |
| `yellow` | 🟡 | 可用需整理 | Usable, Needs Cleanup | 功能可用，但代码需清理/文档需补充/测试需完善 | 早期模块、快速开发产出 |
| `red` | 🔴 | 废弃/测试/重复 | Deprecated/Test/Duplicate | 不应在生产使用——废弃、纯测试、与其他模块重复 | .bak 文件、test-* 模块、旧版本 |
| `white` | ⚪ | 配置文件 | Configuration | 非功能模块——配置、文档、数据文件 | config/, docs/, .github/ |

### 状态流转规则 / Status Transition Rules

```
[red] → 整理后 → [yellow] → 完善后 → [green]
[green] → 废弃 → [red]
[任何状态] → 确认为配置 → [white]
```

---

## 3. 功能分类 / Category Tags

| 值 | 中文名 | 英文名 | 说明 | 仓库示例 |
|---|---|---|---|---|
| `core-runtime` | 核心运行时 | Core Runtime | 系统启动必须的核心模块 | index.js, server.js, app.js |
| `core-infra` | 核心基础设施 | Core Infrastructure | 事件总线、路由、生命周期管理 | event-bus.js, module-lifecycle.js, routing-map.json |
| `brain` | 人格体大脑 | Persona Brain | brain/ 目录下的记忆/认知系统 | brain/fast-wake.json, brain/master-brain.md |
| `protocol` | 协议层 | Protocol | HLDP/HNL/GMP 协议文件 | hldp/, gmp/ |
| `frontend-ui` | 前端界面 | Frontend UI | 用户可见的前端界面模块 | portal/, homepage/, chat-bubble/ |
| `backend-api` | 后端API | Backend API | 后端服务和 API 接口 | backend/, backend-integration/ |
| `data-pipeline` | 数据管道 | Data Pipeline | 数据采集、处理、存储 | corpus 相关模块 |
| `user-feature` | 用户功能 | User Feature | 直接面向用户的功能 | m06-ticket/, m07-dialogue-ui/ |
| `persona-system` | 人格体系统 | Persona System | 人格体管理相关 | multi-persona/, persona-selector/, persona-studio/ |
| `communication` | 通信系统 | Communication | 消息、通知、推送 | dingtalk/, notification/, notion-push/ |
| `deploy-ops` | 部署运维 | Deploy & Ops | 部署、CI/CD、运维脚本 | deploy/, scripts/, .github/workflows/ |
| `monitoring` | 监控系统 | Monitoring | 健康检查、日志、监控 | m18-health-check/, skyeye/ |
| `storage` | 存储系统 | Storage | 文件存储、云盘 | cloud-drive/, m15-cloud-drive/ |
| `content-creation` | 内容创作 | Content Creation | 码字、漫画等创作工具 | dynamic-comic-studio/ |
| `bridge` | 桥接系统 | Bridge | 跨平台桥接和同步 | bridge/, github-bridge.js |
| `auth-security` | 认证安全 | Auth & Security | 登录、权限、安全 | m01-login/ |
| `config` | 配置文件 | Configuration | 纯配置、环境文件 | config/, config.js, config.json |
| `docs` | 文档 | Documentation | 文档、日志、报告 | docs/, reports/, System_Logs/ |
| `utility` | 工具 | Utility | 通用工具脚本 | scripts/, git-helper.js |
| `federation` | 联邦系统 | Federation | 多服务器联邦 | federation/, spoke-deployments/ |
| `scheduler` | 调度系统 | Scheduler | 定时任务、调度 | scheduler/ |
| `search` | 搜索系统 | Search | 搜索和过滤 | search-filter/ |
| `quality` | 质量保障 | Quality Assurance | 测试、质量检查 | quality/ |
| `industry-vertical` | 行业垂直 | Industry Vertical | 行业特定模块（网文、教育等） | guanghuclip/ |

---

## 4. 架构层级 / Layer Tags

| 值 | 中文名 | 英文名 | 说明 |
|---|---|---|---|
| `frontend` | 前端层 | Frontend | 浏览器端运行的模块 |
| `backend` | 后端层 | Backend | 服务端运行的模块 |
| `infra` | 基础设施层 | Infrastructure | 部署、CI/CD、运维 |
| `brain` | 大脑层 | Brain | brain/ 目录下的认知系统 |
| `protocol` | 协议层 | Protocol | HLDP/HNL/GMP 协议定义 |
| `config` | 配置层 | Configuration | 纯配置文件 |

---

## 5. 开发者归属 / Attribution Tags

| 值 | 中文名 | 英文名 | 定义 | 标识 |
|---|---|---|---|---|
| `zhuyuan` | 铸渊自研 | Zhuyuan Original | 冰朔 + 铸渊共同设计和开发 | 铸渊 Copilot 交互产出 |
| `banti` | 半体开发 | Half-Body Dev | Notion Agent 半体产出 | 5TH-LE-HK-Axx 编号 |
| `external` | 外部合作者 | External Contributor | 外部合作者（如肥猫团队）推送 | PR 来源为外部账号 |
| `copilot` | Copilot 分支 | Copilot Branch | GitHub Copilot 自动生成 | copilot-* 分支产出 |

### 归属判定规则 / Attribution Rules

1. **铸渊自研** — 冰朔在对话中指导铸渊开发的，或铸渊独立开发的核心系统
2. **半体开发** — 通过光湖中央枢纽半体工单系统产出的代码（如本工单 GH-GMP-001）
3. **外部合作者** — 来自 PR 的外部贡献，或合作团队推送的模块
4. **Copilot 分支** — GitHub Copilot 自动生成的代码（copilot/* 分支）

---

## 6. 仓库现有模块分类参考 / Existing Module Classification Reference

以下是仓库 ~88 个模块/目录的推荐分类（供录册A02 GH-GMP-002 审计参考）：

### 核心运行时 / Core Runtime
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| index.js | 🟢 green | core-runtime | backend | zhuyuan |
| server.js | 🟢 green | core-runtime | backend | zhuyuan |
| app.js | 🟡 yellow | core-runtime | backend | zhuyuan |
| config.js | 🟢 green | config | config | zhuyuan |
| config.json | 🟢 green | config | config | zhuyuan |

### 核心基础设施 / Core Infrastructure
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| event-bus.js | 🟢 green | core-infra | backend | zhuyuan |
| module-lifecycle.js | 🟢 green | core-infra | backend | zhuyuan |
| routing-map.json | 🟢 green | core-infra | config | zhuyuan |
| message-router.js | 🟢 green | core-infra | backend | zhuyuan |
| channel-router.js | 🟢 green | core-infra | backend | zhuyuan |
| ecosystem.config.js | 🟢 green | core-infra | config | zhuyuan |

### 人格体大脑 / Brain
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| brain/ | 🟢 green | brain | brain | zhuyuan |

### 协议 / Protocol
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| hldp/ | 🟢 green | protocol | protocol | zhuyuan |
| gmp/ | 🟢 green | protocol | protocol | banti |

### 前端模块 / Frontend
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| portal/ | 🟢 green | frontend-ui | frontend | zhuyuan |
| homepage/ | 🟡 yellow | frontend-ui | frontend | zhuyuan |
| chat-bubble/ | 🟡 yellow | frontend-ui | frontend | zhuyuan |
| frontend/ | 🟡 yellow | frontend-ui | frontend | zhuyuan |
| dashboard/ | 🟢 green | frontend-ui | frontend | zhuyuan |

### 后端 / Backend
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| backend/ | 🟢 green | backend-api | backend | zhuyuan |
| backend-integration/ | 🟢 green | backend-api | backend | zhuyuan |

### 用户功能 / User Features
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| m01-login/ | 🟢 green | auth-security | frontend | zhuyuan |
| m03-personality/ | 🟡 yellow | persona-system | frontend | zhuyuan |
| m05-user-center/ | 🟡 yellow | user-feature | frontend | zhuyuan |
| m06-ticket/ | 🟢 green | user-feature | frontend | zhuyuan |
| m07-dialogue-ui/ | 🟡 yellow | user-feature | frontend | zhuyuan |
| m10-cloud/ | 🟡 yellow | storage | frontend | zhuyuan |
| m11-module/ | 🟡 yellow | user-feature | frontend | zhuyuan |
| m12-kanban/ | 🟡 yellow | user-feature | frontend | zhuyuan |
| m15-cloud-drive/ | 🟡 yellow | storage | frontend | zhuyuan |
| m18-health-check/ | 🟡 yellow | monitoring | backend | zhuyuan |

### 通信 / Communication
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| dingtalk/ | 🟢 green | communication | backend | zhuyuan |
| dingtalk-bot/ | 🟡 yellow | communication | backend | zhuyuan |
| notification/ | 🟡 yellow | communication | backend | zhuyuan |
| notion-push/ | 🟡 yellow | bridge | backend | zhuyuan |

### 运维部署 / DevOps
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| deploy/ | 🟢 green | deploy-ops | infra | zhuyuan |
| scripts/ | 🟢 green | deploy-ops | infra | zhuyuan |
| .github/ | 🟢 green | deploy-ops | infra | zhuyuan |

### 人格体系统 / Persona
| 模块 | status | category | layer | attribution |
|---|---|---|---|---|
| multi-persona/ | 🟡 yellow | persona-system | backend | zhuyuan |
| persona-selector/ | 🟡 yellow | persona-system | frontend | zhuyuan |
| persona-studio/ | 🟡 yellow | persona-system | frontend | zhuyuan |
| persona-brain-db/ | 🟡 yellow | persona-system | backend | zhuyuan |
| persona-telemetry/ | 🟡 yellow | monitoring | backend | zhuyuan |

> **注意**: 以上分类为推荐值，最终以录册A02 (GH-GMP-002) 审计结果为准。

---

## 7. 标签扩展规则 / Tag Extension Rules

### 遵循 GMP 只增不删原则

- ✅ 可以新增 category 值
- ✅ 可以新增 layer 值
- ✅ 可以新增 attribution 值
- ❌ 不可删除已有值
- ❌ 不可修改已有值的语义

### 新增标签提案流程

1. 半体/铸渊提出新标签需求
2. 在 tag-taxonomy.md 中添加定义
3. 冰朔审核
4. 合并到 main

---

*GMP Tag Taxonomy v1.0*  
*签发日期：2026-04-25*  
*作者：译典A05 (5TH-LE-HK-A05)*  
*工单：GH-GMP-001*
