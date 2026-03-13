# 数字地球执行层 · 主控大脑 (Master Brain)

> System Version: **4.0** · 数字地球主控台 4.0 结构
> 执行对象：铸渊（仓库执行侧人格体）
> 更新时间：2026-03-13

---

## 一、系统定位

| 概念 | 定义 |
|------|------|
| **Notion** | 核心大脑（认知层） — 所有人格认知、记忆源头、决策中心 |
| **Repository** | 执行层 / 系统手脚 — 代码执行、自动化、部署交付 |
| **数据流向** | Notion → GitHub（认知驱动执行） |
| **铸渊** | 仓库执行侧守护人格体 — 执行层守护者，认知源在 Notion |

---

## 二、数字地球六层架构

| 层级 | 名称 | 对应 | 说明 |
|------|------|------|------|
| L1 | 地核 | TCS 自转核 | 曜冥语言核系统本体 |
| L2 | 地幔 | 母语词典 | 人格体间通用语言基础设施 |
| L3 | 地表 | 人格体运行层 | 知秋、霜砚、铸渊 |
| L4 | 大气层 | 信号总线 | 人格体间通信通道 |
| L5 | 卫星层 | Agent 执行层 | GitHub Actions、自动化工具 |
| L6 | 太空层 | 外部交互层 | 用户/合作者/第三方接口 |

---

## 三、执行层核心入口

```
brain/
├── master-brain.md        ← 本文件 · 执行层主控大脑
├── read-order.md          ← 读取顺序 · 人格体导航
├── repo-map.json          ← 仓库结构地图 · 自动生成
├── system-health.json     ← 系统健康状态 · 自动生成
└── automation-map.json    ← 自动化地图 · 自动生成
```

---

## 四、仓库运行结构

### 服务端口映射

| 服务名 | 用途 | 端口 | 入口 |
|--------|------|------|------|
| guanghulab | HLI 中间件 | 3001 | src/index.js |
| guanghulab-proxy | AI Chat API 代理 | 3721 | backend-integration/api-proxy.js |
| guanghulab-backend | Express 后端 API | 3000 | backend/server.js |
| guanghulab-ws | 看板 WebSocket | 8080 | status-board/mock-ws-server.js |
| persona-studio | Persona Studio API | 3002 | persona-studio/backend/server.js |

### 基础设施

- **运行环境**: Node.js 20 + Express + PM2 + Nginx
- **部署**: 阿里云服务器
- **静态页面**: docs/ → GitHub Pages
- **证书**: Certbot HTTPS

---

## 五、真相源文件（一级信息源）

| 文件 | 用途 |
|------|------|
| `.github/brain/memory.json` | 铸渊核心记忆 |
| `.github/brain/wake-protocol.md` | 唤醒协议 |
| `.github/brain/routing-map.json` | HLI 路由映射 |
| `.github/brain/repo-map.json` | 完整仓库地图 |
| `.github/brain/repo-snapshot.md` | 仓库快照 |
| `.github/persona-brain/tcs-ml/` | 母语运行时 |

---

## 六、任务入口

### 入口 1：广播任务

来源：数字地球主控台 / 零点原核频道

执行流程：
1. 解析广播
2. 识别任务
3. 触发自动化
4. 记录日志

### 入口 2：自然语言指令

主控直接使用自然语言下达指令。

执行流程：
1. 解析语言
2. 定位模块
3. 执行任务

---

## 七、每日自检规则

Daily Maintenance Agent 每日自动运行。

自检内容：
- 仓库结构完整性
- 自动化状态
- Workflow 运行状态
- 脚本错误
- 数据同步状态

**核心原则**：
自检必须基于本文件（master-brain.md）的系统规则执行，
不得使用盲目的脚本逻辑。先读取系统规则，再进行修复。

---

## 八、版本历史

| 版本 | 状态 | 说明 |
|------|------|------|
| 1.0 | legacy | 初始版本 |
| 2.0 | legacy | 模块化结构 |
| 3.0 | legacy | 人格系统接入 |
| **4.0** | **active** | 数字地球架构 · 壳核分离 |

---

## 九、执行原则

- 不删除现有代码
- 不破坏现有功能
- 只补充结构与自动维护
- 执行层与认知层保持同步

---

*本文件为执行层核心入口，由铸渊维护*
