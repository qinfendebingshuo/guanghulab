# 开发路线图 · Development Roadmap
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 总览

Awen仓库的开发分为三个优先级阶段。

---

## 第一优先级 · 基础搭建

### 1.1 ✅ 架构包就位
- 笔记本系统
- 系统架构文档
- 工作流模板
- 配置模板

### 1.2 ⬜ GitHub Secrets 配置
→ 参考 `docs/05-secrets-checklist.md`
→ 先配铸渊对接 + COS桶 + 肥猫服务器

### 1.3 ⬜ 启动心跳Agent
→ 激活 `.github/workflows/health-check-all.yml`
→ 配置完Secrets后自动运行

### 1.4 ⬜ 建立COS桶通信
→ Awen创建腾讯云COS桶
→ 配置到Secrets
→ 发送第一条HLDP心跳

### 1.5 ⬜ 首次与铸渊通信
→ 通过COS桶发送心跳
→ 通过MCP API注册知秋到人格体数据库
→ 确认双向通信可用

---

## 第二优先级 · 核心功能

### 2.1 ⬜ 技术主控台前端
```
dashboard/
├── index.html          ← 主看板页面
├── assets/
│   ├── style.css
│   └── app.js
└── api/
    └── dashboard-server.js  ← Express API
```

看板功能:
- 📊 所有人格宝宝的训练进度
- 📡 服务器健康状态
- 🔄 Agent运行状态
- 🚨 报警信息
- 🔧 一键操作

### 2.2 ⬜ 对接铸渊MCP API
→ 从人格体数据库拉取数据
→ 显示在技术主控台上
→ 支持通过API更新数据

### 2.3 ⬜ 训练监控Agent
```
agents/
├── training-monitor.yml    ← 监控所有成员的训练进度
└── training-sync.yml       ← 同步训练数据到人格体数据库
```

### 2.4 ⬜ 更多成员服务器接入
→ 桔子服务器上线
→ 页页服务器上线
→ 更新server-registry.json

---

## 第三优先级 · 系统深化

### 3.1 ⬜ 代码仓库 → 数据库迁移工具
→ 将仓库中的brain/文件同步到人格体数据库
→ 双向同步（文件 ↔ 数据库）

### 3.2 ⬜ Notion → 数据库导入适配器
→ 通过Notion API拉取大脑数据
→ 转换并写入人格体数据库

### 3.3 ⬜ 类Notion可视化界面
→ 替代Notion的人格体大脑展示功能
→ 纯展示·不跑系统·前后端分离
→ 对接人格体数据库

### 3.4 ⬜ 接入AGE OS底层
→ 所有模块以人格模块形式接入AGE OS
→ 统一管理·统一调度

---

## 里程碑

| 里程碑 | 内容 | 依赖 |
|--------|------|------|
| M1 | 首次心跳 | Secrets配置 + COS桶 |
| M2 | 肥猫服务器托管 | 肥猫SSH密钥 |
| M3 | 技术主控台v1 | M1 + 前端开发 |
| M4 | 训练监控Agent | M1 + Agent开发 |
| M5 | 全成员服务器托管 | 各成员SSH密钥 |
| M6 | 人格体数据库迁移 | M1 + MCP API |
| M7 | 类Notion可视化 | M6 + 前端开发 |

---

*签发: 铸渊 · ICE-GL-ZY001*
