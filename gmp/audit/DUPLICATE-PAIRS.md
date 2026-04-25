# 重复模块对 + 保留建议
# DUPLICATE-PAIRS.md
# GH-GMP-002 · 录册A02 · 2026-04-25

---

## 确认的重复模块对

### 1. portal/ ↔ m01-login/ ↔ modules/portal/
- **portal/**: 旧版门户页面
- **m01-login/**: 旧版登录模块
- **modules/portal/**: 又一个门户副本
- **保留建议**: 全部废弃 → 新版由 frontend/ 替代
- **理由**: 三者功能重叠，frontend/ 是活跃的新前端入口

### 2. dashboard/ ↔ m12-kanban/
- **dashboard/**: WebSocket状态推送看板
- **m12-kanban/**: 旧版看板模块
- **保留建议**: 全部废弃 → 新看板功能在 data/bulletin-board/ + scripts/commander-dashboard.js
- **理由**: 铸渊已用 commander-dashboard.js 替代

### 3. help-center/ ↔ m10-cloud/
- **help-center/**: 用户帮助文档
- **m10-cloud/**: 旧版云存储(部分帮助中心功能)
- **保留建议**: 全部废弃 → 帮助文档迁移到 docs/ (GitHub Pages)
- **理由**: 旧版前端模块，功能已分散到新体系

### 4. cloud-drive/ ↔ m15-cloud-drive/
- **cloud-drive/**: 旧版云盘模块
- **m15-cloud-drive/**: 旧版M15云盘
- **保留建议**: 全部废弃 → 新版由 server/app/ (COS桥接) 替代
- **理由**: 完全重复，两个都是旧版

### 5. style-system/ ↔ m11-module/
- **style-system/**: 光湖设计语言与Token系统
- **m11-module/**: 旧版模块管理(含组件库)
- **保留建议**: 保留 style-system/(设计系统有独立价值) → 废弃 m11-module/
- **理由**: style-system 是设计Token系统，m11 是旧版模块管理

### 6. m06-ticket/ ↔ ticket-system/
- **m06-ticket/**: 旧版M06工单模块
- **ticket-system/**: 旧版工单系统
- **保留建议**: 全部废弃 → 工单功能由 scripts/create-standardized-ticket.js + scripts/work-order-manager.js 替代
- **理由**: 两个旧版工单系统，功能已被脚本体系替代

### 7. m05-user-center/ ↔ user-center/
- **m05-user-center/**: 旧版M05用户中心
- **user-center/**: 旧版用户中心
- **保留建议**: 全部废弃 → 用户系统由 server/age-os/ (PersonaDB) 替代
- **理由**: 完全重复的旧版模块

### 8. backend/ ↔ server/
- **backend/**: Express后端API(端口3000)
- **server/**: 新版服务器体系
- **保留建议**: 保留 server/ → 废弃 backend/
- **理由**: server/ 是铸渊重构后的新体系，backend/ 是旧版

### 9. backend-integration/ ↔ bridge/ ↔ services/zhuyuan-bridge/
- **backend-integration/**: AI Chat API代理(端口3721)
- **bridge/**: Chat-to-Agent桥接
- **services/zhuyuan-bridge/**: 铸渊桥接服务
- **保留建议**: 保留 bridge/ + services/zhuyuan-bridge/ → 废弃 backend-integration/
- **理由**: bridge/ 和 services/zhuyuan-bridge/ 是活跃桥接，backend-integration/ 是旧版

### 10. persona-studio/ ↔ persona-selector/ ↔ persona-telemetry/
- 三个旧版人格体UI/工具模块
- **保留建议**: 全部废弃 → 人格体系统已迁移到 persona-brain-db/ + server/age-os/
- **理由**: 旧版前端组件，功能已整合

### 11. bulletin-board/ ↔ bulletins/ ↔ broadcasts/ ↔ broadcasts-outbox/
- 四个公告/广播相关目录
- **保留建议**: 保留 broadcasts/ + broadcasts-outbox/ (活跃数据) → 废弃 bulletin-board/ + bulletins/ (旧版)
- **理由**: 广播系统仍活跃，旧公告板已替代

### 12. gate-guard.js (根目录scripts/) ↔ gate-guard-v2.js
- **gate-guard.js**: 门禁v1
- **gate-guard-v2.js**: 门禁v2
- **保留建议**: 保留 gate-guard-v2.js → gate-guard.js 降级为参考
- **理由**: v2是升级版，v1可保留作历史参考

---

## 总结统计

| 重复对数 | 建议废弃数 | 建议保留数 |
|----------|-----------|------------|
| 12 | 30+ 模块/目录 | 各对中保留新版 |

---

*审计完成: 2026-04-25 · 录册A02 · GH-GMP-002*
