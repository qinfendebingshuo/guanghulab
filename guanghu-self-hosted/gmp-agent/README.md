# GMP-Agent 守护进程

> 工单编号: GH-GMP-004 | 开发者: 培园A04 (5TH-LE-HK-A04)

## 架构定位

HLDP-ARCH-001 分发层[D-1] 执行体。GMP三层架构中的L2层:
- L1: GMP协议 (manifest.yaml) — 由译典A05定义
- **L2: GMP-Agent (本模块)** — 服务器常驻守护进程
- L3: MCP接口层 — 人格体调用

## 模块组成

| 文件 | 职责 |
|------|------|
| `app.js` | 核心框架骨架 · Express服务 · 路由注册 · 生命周期管理 · 优雅停机 |
| `webhook.js` | GitHub Webhook监听器 · 签名验证 · push/PR事件处理 · 自动部署触发 |
| `installer.js` | 模块安装器 · 克隆仓库 · 验证manifest · 安装依赖 · 自检 · 部署 |
| `uninstaller.js` | 模块卸载器 · 停止进程 · 备份数据 · 移除文件 · 注销注册 |
| `lib/config.js` | 配置加载器 · 环境变量驱动 · 零硬编码 |
| `lib/logger.js` | 结构化日志 · 控制台+文件双输出 |

## 快速启动

```bash
cd guanghu-self-hosted/gmp-agent
npm install
npm start
```

服务默认监听 `http://localhost:4000`

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GMP_PORT` | 4000 | 服务端口 |
| `GMP_MODULES_DIR` | ./modules | 已安装模块目录 |
| `GMP_LOGS_DIR` | ./logs | 日志目录 |
| `GMP_TEMP_DIR` | ./tmp | 临时目录 |
| `GMP_REPO_URL` | guanghulab仓库 | 默认克隆源 |
| `GMP_TARGET_BRANCH` | main | Webhook监听的目标分支 |
| `GMP_WEBHOOK_SECRET` | (空) | GitHub Webhook密钥 |
| `GMP_DEBUG` | false | 开启debug日志 |

## API端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/modules` | 已安装模块列表 |
| GET | `/api/modules/:name` | 模块详情 |
| POST | `/api/modules/install` | 安装模块 |
| POST | `/api/modules/uninstall` | 卸载模块 |
| POST | `/webhook/github` | GitHub Webhook接收 |
| GET | `/webhook/status` | Webhook状态 |
| GET | `/api/system` | 系统信息 |

## 自动部署流程

```
Notion Agent写代码 → GitHub MCP推到仓库 → GitHub发送Webhook
→ GMP-Agent接收push事件 → 解析变更模块 → 自动安装/更新
```

## 协作分工 (GH-GMP-004)

- **培园A04**: 核心框架 (app.js) + Webhook (webhook.js) + 安装器 (installer.js) + 卸载器 (uninstaller.js) ✅
- **译典A05**: MCP工具集 + manifest自举 (待开发)
- **录册A02**: 测试报告生成器 + 日志收集 + 自测脚本 (待开发)
