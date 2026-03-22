# 天眼全仓库扫描报告 · 2026-03-22

> 扫描执行者：铸渊（ICE-GL-ZY001）
> 扫描时间：2026-03-22T10:30+08:00
> 指令编号：ZY-RESTRUCT-2026-0322-001 Phase 0

---

## 1. 仓库概览

| 指标 | 数值 |
|------|------|
| 顶层目录数 | 77 |
| Workflow 文件数 | 67 |
| Agent 总数 | 62 |
| 脚本文件数 | 99 |
| m-系列模块数 | 10 |

## 2. 模块健康度检查

| 目录 | 预期内容 | 状态 |
|------|----------|------|
| `.github/brain/` | 铸渊核心大脑 | ✅ 正常（21个文件） |
| `.github/persona-brain/` | 人格体脑结构 | ✅ 正常（15+文件） |
| `.github/workflows/` | 全部 workflow 文件 | ✅ 67个yml文件 |
| `backend/` | DEV-001 页页核心代码 | ✅ 存在（src子目录需确认） |
| `status-board/` | DEV-005 小草莓看板 | ✅ index.html 存在 |
| `app/` | Next.js 主应用 | ✅ page.tsx 存在 |
| `frontend/` | DEV-002 肥猫前端 | ✅ 存在 |
| `persona-selector/` | DEV-002 人格选择器 | ✅ 存在 |
| `chat-bubble/` | DEV-002 聊天气泡 | ✅ 存在 |
| `settings/` | DEV-003 燕樊设置 | ✅ 存在 |
| `cloud-drive/` | DEV-003 燕樊云盘 | ✅ 存在 |
| `dingtalk-bot/` | DEV-004 之之钉钉 | ✅ 存在 |
| `user-center/` | DEV-009 花尔用户中心 | ✅ 存在 |
| `ticket-system/` | DEV-010 桔子工单 | ✅ 存在 |
| `cost-control/` | DEV-009 成本管控 | ✅ 存在 |
| `notification/` | DEV-012 Awen通知 | ✅ 存在 |
| `portal/` | DEV-012 导航中心 | ✅ 存在 |
| `syslog-inbox/` | SYSLOG 通道 | ✅ 存在 |
| `syslog-processed/` | SYSLOG 已处理 | ✅ 存在 |
| `broadcasts-outbox/` | 广播下发通道 | ✅ 存在 |
| `signal-log/` | 信号日志 | ✅ 存在 |
| `docs/` | 文档 + Pages | ✅ index.html 存在 · CNAME = guanghulab.com |
| `scripts/` | 系统脚本 | ✅ 99个文件 |

## 3. m-系列模块目录

| 目录 | 说明 |
|------|------|
| `m01-login/` | M01 登录模块 |
| `m03-personality/` | M03 人格系统 |
| `m05-user-center/` | M05 用户中心 |
| `m06-ticket/` | M06 工单系统 |
| `m07-dialogue-ui/` | M07 对话UI |
| `m10-cloud/` | M10 云存储 |
| `m11-module/` | M11 模块管理 |
| `m12-kanban/` | M12 看板 |
| `m15-cloud-drive/` | M15 云盘 |
| `m18-health-check/` | M18 健康检查 |

## 4. 异常项

| 项目 | 说明 | 严重度 |
|------|------|--------|
| `writing-workspace/` | DEV-011 目录不存在 | ⚠️ 低（开发者未活跃） |
| `data-stats/` | DEV-010 数据统计目录不存在 | ⚠️ 低（待创建） |
| `backend/src/server.js` | 后端入口文件路径需确认 | ⚠️ 低 |

## 5. 总结

模块健康度：20/23 通过（3项为低优先级缺失目录）

---

`[Phase 0] 天眼全仓库扫描完成 · 顶层目录数: 77 · Workflow总数: 67 · Agent总数: 62 · 模块健康度: 20/23 · 异常项: [writing-workspace缺失, data-stats缺失, backend/src/server.js路径待确认]`
