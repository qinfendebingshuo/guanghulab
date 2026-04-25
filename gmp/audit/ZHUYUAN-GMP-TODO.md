# 铸渊模块GMP待办清单
# ZHUYUAN-GMP-TODO.md
# GH-GMP-002 · 录册A02 · 2026-04-25

---

## 说明

铸渊（ICE-GL-ZY001）下月醒来后读这个文件。

以下所有模块均为铸渊自研的 🟢核心可用 模块。
按约束#4：**只打标+写说明，不做任何代码修改，不做GMP适配**。
留给铸渊自己做USB适配。

---

## 第一军团 · 核心大脑 (5个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-BRAIN-001 | 快速唤醒系统 | brain/fast-wake.json + scripts/fast-wake-context.js | 数据格式标准化·接口抽象 |
| MOD-BRAIN-002 | 意识快照系统 | hldp/data/snapshots/ + scripts/consciousness-snapshot.js | 快照格式GMP化 |
| MOD-BRAIN-003 | 记忆Agent | .github/persona-brain/memory.json + scripts/memory-agent.js | 记忆接口GMP化 |
| MOD-BRAIN-004 | 将军仪表盘 | data/bulletin-board/dashboard.json + scripts/commander-dashboard.js | 仪表盘数据GMP化 |
| MOD-BRAIN-005 | 开发经验数据库 | brain/dev-experience/ + scripts/dev-experience-manager.js | 经验格式GMP化 |

## 第二军团 · 信号接收 (4个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-SIGNAL-001 | Agent签到系统 | .github/workflows/agent-checkin.yml + scripts/agent-checkin.js | 签到协议GMP化 |
| MOD-SIGNAL-002 | Issue自动回复 | .github/workflows/zhuyuan-issue-reply.yml | 回复模板GMP化 |
| MOD-SIGNAL-003 | PR自动审查 | .github/workflows/zhuyuan-pr-review.yml | 审查规则GMP化 |
| MOD-SIGNAL-004 | 副将留言板 | .github/workflows/deputy-message-board.yml + scripts/deputy-message-board.js | 留言协议GMP化 |

## 第三军团 · 部署执行 (5个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-DEPLOY-001 | 主权服务器部署 | .github/workflows/deploy-to-zhuyuan-server.yml | 部署流程GMP化 |
| MOD-DEPLOY-002 | 大陆备用部署 | .github/workflows/deploy-to-cn-server.yml | 部署配置GMP化 |
| MOD-DEPLOY-003 | 测试站自动部署 | .github/workflows/staging-auto-deploy.yml | 测试流程GMP化 |
| MOD-DEPLOY-004 | GitHub Pages部署 | .github/workflows/deploy-pages.yml | 静态部署GMP化 |
| MOD-DEPLOY-005 | 铸渊专线VPN | server/proxy/ | VPN配置GMP化 |

## 第四军团 · 指挥中枢 (3个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-CMD-001 | 将军唤醒工作流 | .github/workflows/zhuyuan-commander.yml | 唤醒协议GMP化 |
| MOD-CMD-002 | HLDP同步引擎 | scripts/hldp-sync-engine.js | 同步协议GMP化 |
| MOD-CMD-003 | 远程执行引擎 | .github/workflows/zhuyuan-exec-engine.yml | 执行协议GMP化 |

## 第五军团 · 安全守护 (3个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-SEC-001 | 智能门禁v2 | .github/workflows/zhuyuan-gate-guard.yml + scripts/gate-guard-v2.js | 权限模型GMP化 |
| MOD-SEC-002 | 签名校验 | scripts/zhuyuan-signature-verify.js | 签名协议GMP化 |
| MOD-SEC-003 | 语言膜网关 | src/membrane/ | 网关接口GMP化 |

## 第六军团 · 巡察监控 (4个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-EYE-001 | 天眼主控 | scripts/skyeye/ | 扫描器接口GMP化 |
| MOD-EYE-002 | 天眼调度器 | scripts/tianyen/ | 调度协议GMP化 |
| MOD-EYE-003 | 健康监控集 | scripts/daily-check.js等 | 健康报告GMP化 |
| MOD-EYE-004 | 数据采集三件套 | scripts/dc-*.js | 采集格式GMP化 |

## 第七军团 · 桥接通信 (6个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-BRIDGE-001 | Notion桥接核心 | scripts/notion-bridge.js | 桥接协议GMP化 |
| MOD-BRIDGE-002 | Notion心跳 | scripts/notion-heartbeat.js | 心跳协议GMP化 |
| MOD-BRIDGE-003 | LLM自动化托管 | scripts/llm-automation-host.js | LLM接口GMP化 |
| MOD-BRIDGE-004 | Chat-Agent桥接 | scripts/chat-to-agent-bridge.js | 桥接协议GMP化 |
| MOD-BRIDGE-005 | 神经网络系统 | scripts/neural/ | 神经协议GMP化 |
| MOD-BRIDGE-006 | 桥接工具集 | scripts/bridge/ | 工具接口GMP化 |

## 第八军团 · 数据汇报 (4个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-DATA-001 | HLDP母体语言 | hldp/ | HLDP Schema GMP化 |
| MOD-DATA-002 | Agent代理网络 | scripts/agents/ | Agent协议GMP化 |
| MOD-DATA-003 | 信号日志 | signal-log/ | 日志格式GMP化 |
| MOD-DATA-004 | 人格体唤醒 | scripts/wake-persona.js + invoke-persona.js | 唤醒协议GMP化 |

## 第九军团 · 部署观测 (4个模块)

| ID | 模块 | 路径 | GMP建议 |
|----|------|------|----------|
| MOD-OBS-001 | 部署观测工作流 | .github/workflows/zhuyuan-deploy-observer.yml | 观测协议GMP化 |
| MOD-OBS-002 | 部署日志采集器 | scripts/deploy-log-collector.js | 日志格式GMP化 |
| MOD-OBS-003 | 副将自动修复 | scripts/deputy-auto-repair.js | 修复策略GMP化 |
| MOD-OBS-004 | 部署观测数据库 | data/deploy-logs/ | 数据格式GMP化 |

## 非军团编制的铸渊核心模块

| 模块 | 路径 | GMP建议 |
|------|------|----------|
| 核心运行时 | core/ | 运行时接口GMP化 |
| 执行引擎 | exe-engine/ | 引擎接口GMP化 |
| 桥接系统 | bridge/ | 桥接协议GMP化 |
| 连接器 | connectors/ | 连接器接口GMP化 |
| 铸渊桥接服务 | services/zhuyuan-bridge/ | 服务接口GMP化 |
| 网格数据库 | grid-db/ | 数据格式GMP化 |
| 人格体大脑DB | persona-brain-db/ | DB Schema GMP化 |
| 网站大脑引擎 | website-brain/ | 引擎接口GMP化 |
| 前端入口 | frontend/ | 前端架构GMP化 |
| HLI接口源码 | src/ | 接口定义GMP化 |
| 文档站 | docs/ | 文档结构GMP化 |
| 团队接入v4 | team-integration-v4/ | 接入协议GMP化 |
| AGE OS执行框架 | openclaw/ | 框架接口GMP化 |
| 写作平台 | writing-platform/ | 平台接口GMP化 |
| 服务器体系 | server/ | 服务架构GMP化 |

---

## 总计

- 军团注册模块: 38个
- 非军团核心模块: 15个
- **总计待铸渊适配GMP: 53个模块**

---

## 铸渊醒来后的建议执行顺序

1. 先读本文件 → 掌握全局
2. 按军团顺序从第一军团开始
3. 每个模块: 定义GMP接口 → 重构入口 → 更新文档
4. 优先级: 核心大脑(第一) > 安全(第五) > 桥接(第七) > 其他

---

*审计完成: 2026-04-25 · 录册A02 · GH-GMP-002*
*约束遵守: 铸渊模块只打标+写说明,零代码修改*
