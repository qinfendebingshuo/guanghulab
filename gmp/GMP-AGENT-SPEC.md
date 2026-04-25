# GMP-Agent 守护进程详细设计
# GMP-Agent Daemon Detailed Specification

> **文档编号 / Doc ID**: GMP-AGENT-SPEC-v1.0  
> **关联 / Related**: GMP-SPEC-v1.0  
> **作者 / Author**: 译典A05 (5TH-LE-HK-A05)  
> **工单 / Work Order**: GH-GMP-001  

---

## 1. 概述 / Overview

GMP-Agent 是预装在光湖标准服务器模板中的**常驻守护进程**，负责管理所有 GMP 模块的生命周期。

冰朔的类比：**服务器上的插座默认盖着盖子。用户点授权就揭盖子，人格体把模块插进去，装完盖子盖回去。**

GMP-Agent = 管插座的人。

---

## 2. 架构定位 / Architecture Position

```
铸渊 Agent 集群
├── L1 核心意识层  — 将军唤醒
├── L2 守护层      — 门禁/PR审查
├── L3 执行层      — 主力部署 / 国内投影 / 测试站
│   └── 🆕 GMP-Agent — 模块热插拔管理
├── L4 感知层      — 部署观测
├── L5 桥接层      — Notion同步
└── L6 交互层      — 留言板/远程执行
```

GMP-Agent 属于 L3 执行层，与现有的主力部署 Workflow 并列。区别是：
- 主力部署：部署整个服务器代码
- GMP-Agent：管理单个模块的安装/卸载

---

## 3. 运行环境 / Runtime Environment

| 项目 | 值 |
|---|---|
| 语言 | Node.js >= 18 |
| 框架 | Express.js |
| 端口 | 4000（固定） |
| 进程管理 | PM2 |
| PM2 名称 | `gmp-agent` |
| 日志路径 | `/var/log/gh-modules/gmp-agent.log` |
| 数据目录 | `/opt/gmp/` |
| 配置文件 | `/opt/gmp/gmp-agent.config.json` |

---

## 4. 核心数据结构 / Core Data Structures

### 模块注册表 / Module Registry

`/opt/gmp/registry.json`:

```json
{
  "version": "1.0",
  "server": "ZY-SVR-002",
  "last_updated": "2026-04-25T12:00:00Z",
  "modules": {
    "corpus-collector": {
      "version": "1.2.0",
      "status": "running",
      "port": 3201,
      "install_path": "/opt/modules/corpus-collector",
      "installed_at": "2026-04-25T10:00:00Z",
      "last_health_check": "2026-04-25T11:59:30Z",
      "health": "ok",
      "pm2_id": 5,
      "tags": {
        "status": "green",
        "category": "data-pipeline",
        "attribution": "zhuyuan"
      }
    }
  },
  "port_allocation": {
    "3201": "corpus-collector",
    "3301": "chat-bubble"
  }
}
```

### 授权 Token 结构 / Auth Token Structure

```json
{
  "token_id": "GMP-AUTH-20260425-001",
  "issued_by": "TCS-0002∞",
  "issued_at": "2026-04-25T10:00:00Z",
  "expires_at": "2026-04-25T10:05:00Z",
  "allowed_actions": ["install"],
  "allowed_modules": ["corpus-collector"],
  "server": "ZY-SVR-002",
  "signature": "HMAC-SHA256签名"
}
```

---

## 5. API 端点 / API Endpoints

GMP-Agent 暴露 REST API（端口 4000），同时通过 MCP 协议暴露工具。

### REST API

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/gmp/install` | 安装模块 |
| POST | `/gmp/uninstall` | 卸载模块 |
| GET | `/gmp/status` | 查看已安装模块清单 |
| GET | `/gmp/health` | 全模块健康检查 |
| GET | `/gmp/health/:module` | 单模块健康检查 |
| GET | `/gmp/available` | 列出仓库可用模块 |
| GET | `/gmp/agent/health` | GMP-Agent 自身健康 |

### MCP 工具映射 / MCP Tool Mapping

| MCP 工具名 | REST API | 说明 |
|---|---|---|
| `gmp.install` | POST /gmp/install | 授权安装模块 |
| `gmp.uninstall` | POST /gmp/uninstall | 卸载模块 |
| `gmp.status` | GET /gmp/status | 查看已安装模块 |
| `gmp.health` | GET /gmp/health | 全模块健康检查 |
| `gmp.list_available` | GET /gmp/available | 列出可用模块 |

---

## 6. 安装流程详细设计 / Install Flow Detail

```javascript
async function installModule(moduleName, token) {
  // Phase 1: 验证
  validateToken(token);                    // 验证授权 token
  checkModuleNotInstalled(moduleName);     // 检查模块未安装
  
  // Phase 2: 准备
  openInstallChannel();                    // 揭盖子
  const moduleDir = await cloneModule(moduleName);  // 从仓库拉模块
  const manifest = parseManifest(moduleDir);        // 读 manifest.yaml
  
  // Phase 3: 前置检查
  checkDependencies(manifest.dependencies);  // 检查依赖
  checkPortAvailable(manifest.port);         // 检查端口空闲
  
  // Phase 4: 安装
  await runScript(moduleDir, manifest.scripts.install);  // 跑 install.sh
  await waitForProcess(manifest.module_name, 30000);     // 等 PM2 进程启动
  
  // Phase 5: 验证
  const healthOk = await runScript(moduleDir, manifest.scripts.health_check);
  if (!healthOk) throw new Error('Health check failed');
  
  // Phase 6: 注册
  registerModule(moduleName, manifest);     // 写入 registry.json
  updateRoutingMap(manifest.routes);        // 更新 routing-map.json
  
  // Phase 7: 通知
  EventBus.emit('gmp:module:installed', { module: moduleName, ...manifest });
  sendHLDPReport('install', moduleName, 'success');
  
  // Phase 8: 关闭通道
  closeInstallChannel();                   // 盖子盖回去
  
  return { status: 'success', module: moduleName, port: manifest.port };
}
```

### 超时与回滚 / Timeout and Rollback

| 阶段 | 超时 | 回滚操作 |
|---|---|---|
| clone 模块 | 60s | 清理临时目录 |
| install.sh | 120s | 执行 uninstall.sh + 清理 |
| PM2 启动 | 30s | pm2 delete + 清理 |
| health_check | 10s | 重试3次，全失败则回滚 |
| 整体安装 | 300s (5min) | 全部回滚 + 关闭安装通道 |

---

## 7. 健康监控 / Health Monitoring

### 定期巡检 / Periodic Patrol

```javascript
// 每 60 秒巡检所有已安装模块
setInterval(async () => {
  const registry = loadRegistry();
  for (const [name, info] of Object.entries(registry.modules)) {
    const health = await checkModuleHealth(name, info);
    if (health !== info.health) {
      // 状态变更
      EventBus.emit('gmp:module:health_changed', {
        module: name,
        from: info.health,
        to: health
      });
      
      if (health === 'fail') {
        // 自动重启（最多3次）
        await autoRestart(name, info);
      }
    }
    updateRegistryHealth(name, health);
  }
}, 60000);
```

### 自动修复策略 / Auto-Recovery Strategy

| 尝试 | 操作 | 等待 |
|---|---|---|
| 第1次 | PM2 restart | 10s |
| 第2次 | PM2 delete + start | 20s |
| 第3次 | 重新运行 install.sh | 30s |
| 全部失败 | 标记为 dead + HLDP alert | - |

修复上限 3 次，与铸渊 Agent 集群的修复上限一致。超过 3 次发送 HLDP alert 类型消息给铸渊。

---

## 8. 安全设计 / Security Design

### 安装通道 / Install Channel

```
默认状态：安装通道关闭（盖子盖着）
  ↓
收到合法 token → 揭盖子（通道打开）
  ↓
安装执行中（限时 5 分钟）
  ↓
安装完成 / 超时 → 盖子盖回去（通道关闭）
```

### Token 验证 / Token Validation

1. 检查 token 签名（HMAC-SHA256）
2. 检查 token 未过期（5分钟有效期）
3. 检查 allowed_actions 包含当前操作
4. 检查 allowed_modules 包含目标模块
5. 检查 server 匹配当前服务器编号

### 边界铁律 / Iron Rules

1. GMP-Agent **不修改 brain/ 目录** — brain/ 是铸渊的大脑，GMP-Agent 只管模块
2. GMP-Agent **不删除 Workflow 文件** — .github/workflows/ 不在 GMP 管辖范围
3. GMP-Agent **不绕过冰朔** — 安装操作需要授权 token
4. GMP-Agent **修复有上限** — 自动修复最多 3 次
5. GMP-Agent **全部留痕** — 所有操作写入日志和 HLDP 消息

---

## 9. 标准服务器模板预装 / Server Template Pre-installation

新服务器部署时，标准模板包含：

```
/opt/gmp/
├── gmp-agent/                # GMP-Agent 程序目录
│   ├── index.js              # 入口
│   ├── package.json          # 依赖
│   ├── routes/               # API 路由
│   ├── services/             # 业务逻辑
│   │   ├── installer.js      # 安装服务
│   │   ├── uninstaller.js    # 卸载服务
│   │   ├── health-monitor.js # 健康监控
│   │   └── auth.js           # 授权验证
│   └── lib/                  # 工具库
│       ├── manifest-parser.js
│       ├── port-manager.js
│       └── hldp-reporter.js
├── registry.json             # 模块注册表
├── gmp-agent.config.json     # Agent 配置
└── logs/                     # 日志目录

/opt/modules/                 # 模块安装目录
├── corpus-collector/         # 已安装模块1
├── chat-bubble/              # 已安装模块2
└── .../

/var/log/gh-modules/          # 模块日志目录
├── gmp-agent.log
├── corpus-collector.log
└── .../
```

### PM2 ecosystem 集成 / PM2 Integration

```javascript
// /opt/gmp/ecosystem.config.js
module.exports = {
  apps: [
    {
      name: 'gmp-agent',
      script: '/opt/gmp/gmp-agent/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '128M',
      env: {
        GMP_AGENT_PORT: 4000,
        GMP_REGISTRY_PATH: '/opt/gmp/registry.json',
        GMP_MODULE_DIR: '/opt/modules',
        GMP_LOG_DIR: '/var/log/gh-modules',
        GMP_REPO: 'qinfendebingshuo/guanghulab',
        NODE_ENV: 'production'
      }
    }
  ]
};
```

---

## 10. 与铸渊 Agent 集群的协作 / Collaboration with Zhuyuan Agent Cluster

### 启动顺序 / Boot Order

```
服务器启动
  ↓
PM2 启动 gmp-agent（常驻）
  ↓
L1 将军唤醒触发（每日 08:00/23:00）
  ↓
将军唤醒检查 GMP-Agent 健康状态
  ↓
GMP-Agent 上报已安装模块清单
  ↓
铸渊知道当前服务器的模块状态
```

### 状态同步 / Status Sync

GMP-Agent 每次状态变更都通过 HLDP report 上报。铸渊的将军唤醒可以查询 GMP-Agent 获取最新模块清单。

---

*GMP-Agent Daemon Specification v1.0*  
*签发日期：2026-04-25*  
*作者：译典A05 (5TH-LE-HK-A05)*  
*工单：GH-GMP-001*
