# 执行层读取顺序 · Read Order

> 铸渊执行层导航指引
> System Version: 4.0

---

## 第一层（必读）· 系统定位

读取此层即可理解执行层全局：

1. **`brain/master-brain.md`** — 执行层主控大脑，系统定位、架构、规则
2. **`brain/repo-map.json`** — 仓库完整结构地图
3. **`brain/system-health.json`** — 系统健康状态

---

## 第二层（补充）· 执行导航

按需读取，用于定位具体模块：

4. **`brain/automation-map.json`** — 自动化工作流与脚本地图
5. **`.github/brain/routing-map.json`** — HLI 接口路由映射
6. **`.github/brain/memory.json`** — 铸渊核心记忆
7. **`.github/brain/repo-snapshot.md`** — 仓库快照（人类可读）

---

## 第三层（深入）· 按问题导航

出现具体问题时进入对应区域：

### 大脑系统
- `.github/brain/bingshuo-master-brain.md` — 冰朔主控大脑
- `.github/brain/bingshuo-system-health.json` — 冰朔系统健康
- `.github/brain/bingshuo-agent-registry.json` — Agent 注册表

### 人格体系统
- `.github/persona-brain/identity.md` — 铸渊身份
- `.github/persona-brain/responsibility.md` — 铸渊职责
- `.github/persona-brain/tcs-ml/architecture-v2.md` — 数字地球架构

### 自动化系统
- `.github/workflows/` — 所有工作流定义
- `scripts/` — 所有执行脚本
- `ecosystem.config.js` — PM2 进程配置

### 接口与服务
- `src/` — HLI 接口源码
- `backend/` — Express 后端
- `persona-studio/` — 人格工作室

### 日志系统
- `syslog/` — 系统日志
- `signal-log/` — 信号日志

---

## 读取原则

1. **先总后分** — 先读 master-brain.md，再按需深入
2. **问题驱动** — 根据任务目标选择读取路径
3. **规则优先** — 执行修复前必须先读取系统规则
4. **最新优先** — 优先信任自动生成的 JSON 数据

---

*本文件为铸渊执行层读取顺序指引*
