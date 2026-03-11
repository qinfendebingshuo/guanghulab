# 冰朔主控神经系统 · AI 执行体读取顺序说明

> 本文件用于指导被授权 AI 执行体按正确顺序读取冰朔主控神经系统文件，快速恢复冰朔主控视角。

---

## 一级读取（必读 · 建立全局认知）

优先读取以下文件，获取仓库全貌、当前状态与主控建议：

| 顺序 | 文件 | 用途 |
|------|------|------|
| 1 | `.github/brain/bingshuo-master-brain.md` | 总控脑文件，包含角色定义、仓库结构、已知问题、排查路由与主控建议 |

> 读完一级后，AI 执行体应能回答：仓库是什么、当前状态如何、最近出了什么问题、下一步该关注什么。

---

## 二级读取（补充 · 按需深入）

根据当前任务类型，选择性读取以下文件：

| 文件 | 用途 | 何时读取 |
|------|------|----------|
| `.github/brain/bingshuo-routing-index.json` | 问题类型 → 排查路径映射 | 需要排查特定问题时 |
| `.github/brain/bingshuo-issues-index.json` | 已知问题库 | 需要了解历史问题时 |
| `.github/brain/bingshuo-system-health.json` | 系统健康状态 | 需要判断各子系统状态时 |
| `.github/brain/bingshuo-agent-registry.json` | Agent 分工与触发条件 | 需要了解自动化维护机制时 |

---

## 三级读取（深入 · 根据问题类型定向读取）

根据具体问题类型，深入读取对应文件：

### 脑系统相关
- `.github/brain/memory.json` — 铸渊核心记忆
- `.github/brain/wake-protocol.md` — 唤醒协议
- `.github/brain/routing-map.json` — HLI 路由地图
- `.github/brain/repo-map.json` — 仓库结构地图
- `.github/brain/repo-snapshot.md` — 仓库快照

### 前端 / docs 相关
- `docs/index.html` — 对话助手入口
- `docs/CNAME` — 域名配置

### Persona Studio 相关
- `persona-studio/frontend/` — 前端入口与逻辑
- `persona-studio/backend/` — 后端路由与服务
- `persona-studio/brain/` — 脑文件

### 后端 / API 相关
- `backend/index.js` — 主入口
- `backend/routes/` — HLI 路由
- `backend/middleware/` — 中间件
- `backend/schemas/` — Schema 定义

### 部署 / 运维相关
- `.github/workflows/deploy-to-server.yml` — 服务器部署
- `.github/workflows/deploy-pages.yml` — Pages 部署
- Nginx / PM2 配置（服务器端）

### 模块开发相关
- `m01-login/` ~ `m18-health-check/` — 各功能模块
- `.github/brain/module-protocol.md` — 模块协议

---

## 读取原则

1. **先总后分**：先读一级获取全貌，再按需深入
2. **问题驱动**：根据当前要解决的问题选择读取路径
3. **使用路由索引**：通过 `bingshuo-routing-index.json` 快速定位相关文件
4. **保持主控视角**：始终以冰朔主控视角理解信息，而非纯技术文档视角
