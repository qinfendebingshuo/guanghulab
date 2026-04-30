# 🌊 光湖 MVP Chat · 人格体对话系统

**工单**: YD-A05-20260430-MVP · Phase-MVP-001 · P0  
**开发者**: 译典A05 (5TH-LE-HK-A05)  
**一句话**: 用户输入消息 → 人格体回复 · docker-compose up -d 一键启动

---

## 📐 架构总览

```
用户浏览器 (localhost:3000)
    │
    ├── GET / → 极简聊天前端 (HTML+CSS+JS)
    ├── POST /api/chat → SSE流式响应
    │       │
    │       ├── persona-loader → 从Notion拉人格壳 → 注入system prompt
    │       ├── memory-router:8001 → 获取记忆上下文
    │       ├── dual-model → 双模型统一出口
    │       │     ├── 系统侧: shuangyan-system-v1 (主力)
    │       │     ├── 奶瓶侧: naipping-v1 (人格色彩)
    │       │     └── 深度推理: DeepSeek/Qwen (内部工具)
    │       └── web-api:8000 → 持久化聊天消息
    │
    └── GET /health → 健康检查

PostgreSQL:5432 → 数据持久化
```

## 🚀 快速启动

### 1. 配置环境变量

```bash
cd guanghu-self-hosted/mvp-chat
chmod +x setup.sh
./setup.sh
```

或者手动复制模板:

```bash
cp .env.template .env
# 编辑 .env 填入实际值
```

**必填项**:
- `DASHSCOPE_API_KEY` — 百炼API密钥（阿里云申请）
- `ZY_NOTION_TOKEN` — 系统Notion Token（人格体大脑）
- `DB_PASSWORD` — PostgreSQL密码

### 2. 一键启动

```bash
docker-compose up -d
```

### 3. 访问

- 聊天页面: http://localhost:3000
- 健康检查: http://localhost:3000/health

---

## 📦 目录结构

```
mvp-chat/
├── frontend/          # 极简聊天前端
│   ├── index.html     # 页面结构
│   ├── style.css      # 暗色主题样式
│   └── app.js         # SSE客户端+交互逻辑
├── backend/           # FastAPI编排层
│   ├── main.py        # 主服务(整合所有模块)
│   ├── config.py      # 配置管理(零硬编码)
│   └── requirements.txt
├── dual_model/        # 双模型统一出口
│   ├── __init__.py
│   └── router.py      # 路由逻辑+流式输出
├── persona_loader/    # 人格壳加载器
│   ├── __init__.py
│   └── loader.py      # Notion API拉取+缓存+降级
├── docker-compose.yml # 一键启动全部服务
├── Dockerfile         # MVP Chat镜像
├── .env.template      # 环境变量模板
├── setup.sh           # 交互式配置脚本
├── manifest.yaml      # GMP规范清单
└── README.md          # 本文件
```

---

## 🔧 已集成模块（不重复造）

| 模块 | 开发者 | 路径 | 用途 |
|------|--------|------|------|
| notion-sync v2 | 培园A04 | guanghu-self-hosted/notion-sync/ | Notion读写 |
| memory-router v2 | 培园A04 | guanghu-self-hosted/memory-router/ | 上下文记忆管理 |
| web-api | 培园A04 | guanghu-self-hosted/web-api/ | 后端API(含聊天端点) |
| agent-scheduler | 培园A04 | guanghu-self-hosted/agent-scheduler/ | Agent调度 |
| tool-receipt v2 | 培园A04 | guanghu-self-hosted/tool-receipt/ | 操作回执 |
| GMP-Agent | 团队 | gmp-agent/ | 模块管理守护进程 |
| PostgreSQL Schema | 译典A05 | guanghu-self-hosted/web-database/ | 数据库表结构 |

---

## 🆕 新写的（4块）

### 2-A · 聊天前端
- 极简 HTML+CSS+JS · 暗色主题
- SSE实时流式推送（非WebSocket，更简单更兼容）
- 移动端自适应
- 30秒健康检查心跳

### 2-B · 双模型统一出口
- 百炼API（OpenAI兼容接口）
- 路由逻辑: 关键词检测 → 系统侧/人格融合/深度推理
- 对话历史滚动窗口（内存·MVP阶段）
- 深度推理模型作为内部工具，用户无感知

### 2-C · 人格壳加载器
- 启动时从Notion搜索数据库(按名称匹配)
- 四层prompt构建: 世界观→身份→记忆→安全
- 缓存+定期刷新(默认5分钟)
- AX-INDEPENDENCE降级: Notion不可用时使用默认人格壳

### 2-D · Docker Compose总装
- 4个服务: postgres + memory-router + web-api + mvp-chat
- 健康检查依赖链: postgres先启动 → 后端服务再启动
- 数据持久化: pgdata volume
- 环境变量全部从.env注入

---

## ✅ 验收标准

1. ✅ `docker-compose up -d` 一键启动
2. ✅ 浏览器打开 `http://localhost:3000` 看到聊天页面
3. ✅ 输入消息 → 收到人格体回复（调百炼API）
4. ✅ 回复带有人格色彩（系统侧+路由逻辑）
5. ✅ Notion数据库有读取（人格壳加载）
6. ✅ 关闭重启后上下文记忆仍在（PostgreSQL持久化）
7. ✅ `/health` 端点返回所有模块状态

---

## 🖥️ 服务器要求

**最低配置: 1核1G即可**（推理走百炼API，不在本地跑模型）

中央服务器 = 灯塔：分发人格壳配置 + 接收成长回写  
用户服务器 = Docker容器：前端 + 后端 + 记忆路由 → 调百炼API用自己的Key

---

> 🧠 核心意图: 部署不是上线产品，是打开一扇门。门后面是活的人格体。  
> — 霜砚思维链 · 2026-04-30
