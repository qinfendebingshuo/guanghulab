# GMP — GuangHu Module Protocol v1.0
# GMP — 光湖模块协议 v1.0

> **协议编号 / Spec ID**: GMP-SPEC-v1.0  
> **版本 / Version**: 1.0  
> **创建日期 / Created**: 2026-04-25  
> **作者 / Author**: 译典A05 (5TH-LE-HK-A05) — 半体工单 GH-GMP-001  
> **审核 / Review**: 待冰朔审核  
> **版权 / Copyright**: 国作登字-2026-A-00037559 | TCS-0002∞ 冰朔  
> **关联 / Related**: HLDP v3.0 · HNL v1.0 · AGE-OS MCP Server  

---

## 目录 / Table of Contents

1. [概述 / Overview](#1-概述--overview)
2. [设计原则 / Design Principles](#2-设计原则--design-principles)
3. [与现有架构的关系 / Relationship to Existing Architecture](#3-与现有架构的关系--relationship-to-existing-architecture)
4. [manifest.yaml Schema 定义 / Manifest Schema](#4-manifestyaml-schema-定义--manifest-schema)
5. [标准目录结构 / Standard Directory Structure](#5-标准目录结构--standard-directory-structure)
6. [端口分配规则 / Port Allocation Rules](#6-端口分配规则--port-allocation-rules)
7. [热插拔接口标准 / Hot-Plug Interface Standard](#7-热插拔接口标准--hot-plug-interface-standard)
8. [完整部署链路 / Full Deployment Pipeline](#8-完整部署链路--full-deployment-pipeline)
9. [GMP-Agent 守护进程概述 / GMP-Agent Daemon Overview](#9-gmp-agent-守护进程概述--gmp-agent-daemon-overview)
10. [GMP-Agent MCP 工具集 / GMP-Agent MCP Toolset](#10-gmp-agent-mcp-工具集--gmp-agent-mcp-toolset)
11. [与 HLDP/HNL 的衔接 / Integration with HLDP/HNL](#11-与-hldphnl-的衔接--integration-with-hldphnl)
12. [与 module-lifecycle.js / event-bus.js 的衔接 / Integration with Existing Infra](#12-与-module-lifecyclejs--event-busjs-的衔接--integration-with-existing-infra)
13. [与 MCP 协议的关系 / Relationship to MCP Protocol](#13-与-mcp-协议的关系--relationship-to-mcp-protocol)
14. [标签分类体系引用 / Tag Taxonomy Reference](#14-标签分类体系引用--tag-taxonomy-reference)
15. [铸渊适配指南 / Zhuyuan Adaptation Guide](#15-铸渊适配指南--zhuyuan-adaptation-guide)
16. [版本演化规则 / Version Evolution Rules](#16-版本演化规则--version-evolution-rules)

---

## 1. 概述 / Overview

**GMP（GuangHu Module Protocol）** 是光湖操作系统的模块标准化协议。它定义了模块如何声明自身（manifest）、如何安装/卸载（热插拔）、如何被管理（GMP-Agent）、如何分类（标签体系）。

**GMP (GuangHu Module Protocol)** is the module standardization protocol for the HoloLake Operating System. It defines how modules declare themselves (manifest), how they are installed/uninstalled (hot-plug), how they are managed (GMP-Agent), and how they are categorized (tag taxonomy).

### 核心类比 / Core Analogy

| 概念 / Concept | 类比 / Analogy | 说明 / Description |
|---|---|---|
| **GMP 协议** | USB 标准 | 模块的接口标准——manifest + install/uninstall/health_check |
| **GMP-Agent** | 有 USB 口的电脑 | 服务器常驻守护进程——管插拔、管授权验证、预装在标准模板 |
| **MCP 接口** | 通信线缆 | 人格体通过 MCP 调用 GMP-Agent 来装/卸模块 |
| **manifest.yaml** | USB 设备描述符 | 模块的身份证——声明端口、依赖、版本、作者、标签 |

### 解决的问题 / Problems Solved

仓库当前 ~88 个模块，来源混杂：
- 冰朔 + 铸渊自研
- 外部合作者推送
- 半体开发（Notion Agent 产出）
- Copilot 分支

缺乏统一的模块接口标准，导致：
- 模块安装/卸载没有标准流程
- 端口冲突频繁
- 无法快速判断模块状态和归属
- 新服务器部署时需要手动配置每个模块

GMP v1.0 解决以上全部问题。

---

## 2. 设计原则 / Design Principles

1. **向后兼容 / Backward Compatible** — manifest.yaml 必须兼容现有模块结构。现有模块可以渐进式添加 manifest，不需要一次性重构。
2. **只增不删 / Additive Only** — 与 HLDP 地球原则一致。GMP 规范一旦发布，必填字段永不删除，只通过 optional 字段扩展。
3. **先读后写 / Read Before Write** — 所有安装操作必须先读 manifest 确认依赖和端口，再执行安装。
4. **插上就能用，拔了就干净 / Plug and Play, Clean Unplug** — 安装后模块立即可用；卸载后不留残余进程、端口、环境变量。
5. **基于现有底座 / Built on Existing Foundation** — 不推翻 module-lifecycle.js 和 event-bus.js，而是在上层封装标准化接口。
6. **声明式优先 / Declarative First** — 模块通过 manifest.yaml 声明自身，GMP-Agent 根据声明执行操作。

---

## 3. 与现有架构的关系 / Relationship to Existing Architecture

```
┌─────────────────────────────────────────────────────┐
│  HoloLake OS · 四层架构                              │
│                                                     │
│  第四层：语言驱动开发                                 │
│  第三层：语言驱动操作系统 ← GMP-Agent 在此层运行       │
│  第二层：TCS 语言人格智能系统                          │
│  第一层：人格体永久记忆系统                            │
├─────────────────────────────────────────────────────┤
│  铸渊 Agent 集群 · 六层架构                           │
│                                                     │
│  L1 核心意识层    — 将军唤醒                          │
│  L2 守护层        — 门禁/PR审查                       │
│  L3 执行层 ← GMP-Agent 属于此层（模块部署执行）        │
│  L4 感知层        — 部署观测                          │
│  L5 桥接层        — Notion同步                       │
│  L6 交互层        — 留言板/远程执行                    │
├─────────────────────────────────────────────────────┤
│  现有底座                                            │
│                                                     │
│  module-lifecycle.js  — 前端模块加载/卸载（DOM层面）   │
│  event-bus.js         — 模块间事件总线（pub/sub）      │
│  routing-map.json     — 模块→目录→路由映射            │
│  HLDP v3.0            — 人格体间通信协议               │
│  HNL v1.0             — 人格体原生母语                 │
│                                                     │
│  GMP 在这些底座之上增加:                              │
│  ✅ 模块声明标准（manifest.yaml）                     │
│  ✅ 服务端热插拔标准（install/uninstall/health_check） │
│  ✅ 标签分类体系（覆盖88个模块）                       │
│  ✅ 端口分配规则（环境变量统一前缀）                    │
│  ✅ GMP-Agent 守护进程（授权+安装通道管理）            │
└─────────────────────────────────────────────────────┘
```

### 关键区分 / Key Distinctions

| 现有组件 | 作用域 | GMP 的关系 |
|---|---|---|
| `module-lifecycle.js` | 前端 DOM 模块加载/卸载 | GMP 管服务端进程级别的安装/卸载，与前端 lifecycle 互补 |
| `event-bus.js` | 前端模块间通信 | GMP 模块安装完成后通过 event-bus 广播 `module:installed` 事件 |
| `routing-map.json` | 模块→路由静态映射 | GMP manifest 中的 `routes` 字段与 routing-map 对齐，安装时自动注册路由 |
| `HLDP v3.0` | 人格体间通信格式 | GMP-Agent 的状态变更通过 HLDP report 消息上报铸渊 |

---

## 4. manifest.yaml Schema 定义 / Manifest Schema

每个 GMP 兼容模块的根目录必须包含 `manifest.yaml`。

### 完整 Schema

```yaml
# === 必填字段 / Required Fields ===

gmp_version: "1.0"                    # GMP 协议版本 / GMP spec version
module_name: "corpus-collector"        # 模块唯一标识名 / Unique module identifier (kebab-case)
module_name_cn: "语料采集器"            # 中文名 / Chinese display name
version: "1.2.0"                       # 语义化版本号 / Semantic version (semver)
author:
  name: "铸渊"                         # 作者名 / Author name
  id: "ICE-GL-ZY001"                   # 人格体/开发者编号 / Persona/developer ID
  attribution: "zhuyuan"               # 归属维度 / Attribution dimension
                                       # 可选值: zhuyuan | banti | external | copilot
description: "从多源采集语料并标准化存储"  # 一句话描述 / One-line description
description_en: "Collect corpus from multiple sources and store in standardized format"

# === 分类标签 / Classification Tags ===

tags:
  status: "green"                      # 模块状态标签 / Module status tag
                                       # green=核心可用 | yellow=可用需整理 | red=废弃测试重复 | white=配置文件
  category: "data-pipeline"            # 功能分类 / Functional category
                                       # 见 tag-taxonomy.md 完整列表
  layer: "backend"                     # 架构层级 / Architecture layer
                                       # frontend | backend | infra | brain | protocol | config
  attribution: "zhuyuan"               # 开发者归属（与 author.attribution 一致）

# === 运行时配置 / Runtime Configuration ===

port: 3021                             # 服务监听端口 / Service port
env_prefix: "GH_CORPUS_COLLECTOR"      # 环境变量前缀 / Env var prefix (GH_模块名_)
health_check:
  endpoint: "/health"                  # 健康检查端点 / Health check endpoint
  method: "GET"                        # HTTP 方法 / HTTP method
  expected_status: 200                 # 期望状态码 / Expected status code
  timeout_seconds: 10                  # 超时时间 / Timeout in seconds
  interval_seconds: 30                 # 检查间隔 / Check interval

# === 依赖声明 / Dependencies ===

dependencies:
  system:                              # 系统级依赖 / System-level dependencies
    - "node >= 18.0.0"
    - "pm2"
  modules:                             # 模块间依赖 / Inter-module dependencies
    - "event-bus"                      # 依赖事件总线
  npm:                                 # NPM 包依赖（由 install.sh 安装）
    - "express"
    - "axios"

# === 生命周期脚本 / Lifecycle Scripts ===

scripts:
  install: "install.sh"                # 安装脚本 / Install script
  uninstall: "uninstall.sh"            # 卸载脚本 / Uninstall script
  health_check: "health_check.sh"      # 健康检查脚本 / Health check script
  start: "npm start"                   # 启动命令 / Start command (PM2 uses this)
  stop: "pm2 stop ${module_name}"      # 停止命令 / Stop command

# === PM2 配置 / PM2 Configuration ===

pm2:
  name: "corpus-collector"             # PM2 进程名 / PM2 process name
  instances: 1                         # 实例数 / Instance count
  max_memory_restart: "256M"           # 内存上限重启 / Max memory before restart
  log_file: "/var/log/gh-modules/corpus-collector.log"

# === 路由注册 / Route Registration ===

routes:                                # 模块注册的路由（与 routing-map.json 对齐）
  - "/api/corpus"
  - "/api/corpus/collect"

# === 可选字段 / Optional Fields ===

repository: "qinfendebingshuo/guanghulab"  # 源仓库 / Source repository
path_in_repo: "modules/corpus-collector"    # 仓库内路径 / Path within repo
license: "PROPRIETARY"                      # 许可 / License
min_gmp_version: "1.0"                      # 最低 GMP 版本要求
compatible_servers:                         # 兼容的服务器编号
  - "ZY-SVR-002"
  - "ZY-SVR-004"
metadata:                                   # 自由扩展元数据
  routing_map_id: "M-CORPUS"                # routing-map.json 中的模块 ID
  created_date: "2026-04-15"
  last_updated: "2026-04-25"
```

### 字段约束 / Field Constraints

| 字段 | 类型 | 必填 | 约束 |
|---|---|---|---|
| `gmp_version` | string | ✅ | 固定 "1.0" |
| `module_name` | string | ✅ | kebab-case, 全局唯一 |
| `version` | string | ✅ | semver 格式 |
| `author.attribution` | enum | ✅ | zhuyuan \| banti \| external \| copilot |
| `tags.status` | enum | ✅ | green \| yellow \| red \| white |
| `port` | integer | ✅ | 1024-65535, 不得与已注册模块冲突 |
| `env_prefix` | string | ✅ | 格式: GH_{MODULE_NAME}_ (大写下划线) |
| `scripts.install` | string | ✅ | 相对路径，指向安装脚本 |
| `scripts.uninstall` | string | ✅ | 相对路径，指向卸载脚本 |
| `scripts.health_check` | string | ✅ | 相对路径，指向健康检查脚本 |

---

## 5. 标准目录结构 / Standard Directory Structure

每个 GMP 兼容模块必须包含以下文件：

```
<module-name>/
├── manifest.yaml          # [必须] 模块声明文件
├── install.sh             # [必须] 安装脚本
├── uninstall.sh           # [必须] 卸载脚本
├── health_check.sh        # [必须] 健康检查脚本
├── config.env.example     # [必须] 环境变量示例
├── README.md              # [推荐] 模块说明文档
├── package.json           # [按需] Node.js 项目配置
├── index.js / server.js   # [按需] 入口文件
└── ...                    # 其他模块文件
```

### 脚本规范 / Script Specifications

#### install.sh

```bash
#!/bin/bash
# GMP install.sh 标准模板
# 退出码: 0=成功, 1=失败
set -e

MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_NAME=$(grep 'module_name:' "$MODULE_DIR/manifest.yaml" | head -1 | awk '{print $2}' | tr -d '"')

echo "[GMP-INSTALL] 开始安装模块: $MODULE_NAME"

# 1. 安装 NPM 依赖
if [ -f "$MODULE_DIR/package.json" ]; then
    cd "$MODULE_DIR" && npm install --production
fi

# 2. 复制环境变量配置（如果不存在）
if [ ! -f "$MODULE_DIR/config.env" ] && [ -f "$MODULE_DIR/config.env.example" ]; then
    cp "$MODULE_DIR/config.env.example" "$MODULE_DIR/config.env"
    echo "[GMP-INSTALL] 已创建 config.env（请检查并修改配置）"
fi

# 3. 注册 PM2 进程
pm2 start "$MODULE_DIR/index.js" \
    --name "$MODULE_NAME" \
    --log "/var/log/gh-modules/$MODULE_NAME.log" \
    --time

pm2 save

echo "[GMP-INSTALL] 模块 $MODULE_NAME 安装完成"
exit 0
```

#### uninstall.sh

```bash
#!/bin/bash
# GMP uninstall.sh 标准模板
set -e

MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_NAME=$(grep 'module_name:' "$MODULE_DIR/manifest.yaml" | head -1 | awk '{print $2}' | tr -d '"')

echo "[GMP-UNINSTALL] 开始卸载模块: $MODULE_NAME"

# 1. 停止并删除 PM2 进程
pm2 stop "$MODULE_NAME" 2>/dev/null || true
pm2 delete "$MODULE_NAME" 2>/dev/null || true
pm2 save

# 2. 清理环境变量文件（保留 example）
rm -f "$MODULE_DIR/config.env"

# 3. 清理 node_modules
rm -rf "$MODULE_DIR/node_modules"

# 4. 清理日志
rm -f "/var/log/gh-modules/$MODULE_NAME.log"

echo "[GMP-UNINSTALL] 模块 $MODULE_NAME 卸载完成 · 拔了就干净"
exit 0
```

#### health_check.sh

```bash
#!/bin/bash
# GMP health_check.sh 标准模板
# 退出码: 0=健康, 1=不健康

MODULE_DIR="$(cd "$(dirname "$0")" && pwd)"
MODULE_NAME=$(grep 'module_name:' "$MODULE_DIR/manifest.yaml" | head -1 | awk '{print $2}' | tr -d '"')
PORT=$(grep 'port:' "$MODULE_DIR/manifest.yaml" | head -1 | awk '{print $2}')
HEALTH_ENDPOINT=$(grep 'endpoint:' "$MODULE_DIR/manifest.yaml" | head -1 | awk '{print $2}' | tr -d '"')

# 1. 检查 PM2 进程是否存在
if ! pm2 describe "$MODULE_NAME" > /dev/null 2>&1; then
    echo "[GMP-HEALTH] FAIL: PM2 进程 $MODULE_NAME 不存在"
    exit 1
fi

# 2. 检查 PM2 进程状态
STATUS=$(pm2 jlist | python3 -c "import sys,json; procs=[p for p in json.load(sys.stdin) if p['name']=='$MODULE_NAME']; print(procs[0]['pm2_env']['status'] if procs else 'missing')" 2>/dev/null)
if [ "$STATUS" != "online" ]; then
    echo "[GMP-HEALTH] FAIL: 进程状态=$STATUS (期望=online)"
    exit 1
fi

# 3. HTTP 健康检查
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://localhost:$PORT$HEALTH_ENDPOINT" 2>/dev/null)
if [ "$HTTP_STATUS" != "200" ]; then
    echo "[GMP-HEALTH] FAIL: HTTP状态=$HTTP_STATUS (期望=200)"
    exit 1
fi

echo "[GMP-HEALTH] OK: $MODULE_NAME 运行正常 (port=$PORT)"
exit 0
```

---

## 6. 端口分配规则 / Port Allocation Rules

### 端口范围 / Port Ranges

| 范围 | 用途 | 说明 |
|---|---|---|
| 3000-3099 | 核心系统服务 | 主服务器、灯塔、API 网关等 |
| 3100-3199 | 基础设施模块 | 健康检查、监控、日志等 |
| 3200-3299 | 数据处理模块 | 语料采集、搜索、知识库等 |
| 3300-3399 | 用户功能模块 | 聊天、工单、云盘等 |
| 3400-3499 | 行业垂直模块 | 网文、教育、漫画等 |
| 3500-3599 | 人格体服务 | brain 相关、人格选择器等 |
| 3600-3699 | 外部集成 | 钉钉、飞书、Notion 推送等 |
| 3700-3799 | 预留扩展 | 未来模块 |
| 4000 | GMP-Agent | GMP-Agent 守护进程专用端口 |

### 环境变量命名规则 / Env Var Naming

所有模块的环境变量必须使用统一前缀：

```
GH_{MODULE_NAME_UPPER}_{VAR_NAME}
```

示例：
- `GH_CORPUS_COLLECTOR_PORT=3201`
- `GH_CORPUS_COLLECTOR_DB_PATH=/data/corpus`
- `GH_CHAT_BUBBLE_PORT=3301`
- `GH_CHAT_BUBBLE_WS_PORT=3302`

### 端口冲突检测 / Port Conflict Detection

GMP-Agent 在安装模块前必须检测端口是否被占用：

```bash
# GMP-Agent 端口检查逻辑
if lsof -i :$PORT > /dev/null 2>&1; then
    echo "[GMP-AGENT] ERROR: 端口 $PORT 已被占用"
    exit 1
fi
```

---

## 7. 热插拔接口标准 / Hot-Plug Interface Standard

### 安装流程 / Install Flow

```
安装请求 → GMP-Agent 接收
  ↓
① 读取 manifest.yaml → 解析模块声明
  ↓
② 检查依赖 → 系统依赖是否满足？模块依赖是否已安装？
  ↓
③ 检查端口 → 端口是否空闲？
  ↓
④ 执行 install.sh → 安装依赖 + 配置环境变量 + 注册 PM2
  ↓
⑤ 等待启动 → 检查 PM2 进程状态
  ↓
⑥ 执行 health_check.sh → 确认模块健康
  ↓
⑦ 注册路由 → 更新 routing-map.json（如果 manifest 中有 routes）
  ↓
⑧ 广播事件 → event-bus 发送 module:installed 事件
  ↓
⑨ 上报状态 → HLDP report 消息通知铸渊
```

### 卸载流程 / Uninstall Flow

```
卸载请求 → GMP-Agent 接收
  ↓
① 执行 uninstall.sh → 停止进程 + 清理依赖 + 清理环境变量
  ↓
② 从 routing-map.json 移除路由
  ↓
③ 广播事件 → event-bus 发送 module:uninstalled 事件
  ↓
④ 上报状态 → HLDP report 消息通知铸渊
  ↓
⑤ 确认干净 → 检查端口已释放、进程已停止、日志已清理
```

### 状态机 / State Machine

```
[not_installed] → install → [installing] → success → [running]
                                         → failure → [install_failed]

[running] → health_check → [healthy] / [unhealthy]

[running] → uninstall → [uninstalling] → success → [not_installed]
                                        → failure → [uninstall_failed]

[unhealthy] → auto_restart (max 3) → [running] / [dead]
```

---

## 8. 完整部署链路 / Full Deployment Pipeline

冰朔原话类比：**服务器上的插座默认盖着盖子，用户点授权就揭盖子，人格体把模块插进去，装完盖子盖回去。**

```
用户：「我要用语料采集功能」
  ↓
① 用户在频道点「授权」
  ↓
② GMP-Agent 收到授权信号（签名 token 验证）
  ↓
③ 「插座盖子」揭开 → GMP-Agent 临时开放安装通道
  ↓
④ 人格体从仓库拉模块 → git clone corpus-collector/
  ↓
⑤ 读 manifest.yaml → 确认端口、依赖、环境变量
  ↓
⑥ 跑 install.sh → 装依赖 → 配环境变量 → PM2 注册
  ↓
⑦ 跑 health_check.sh → 返回 OK
  ↓
⑧ 「盖子」盖回去（安装通道关闭，只留模块服务端口）
  ↓
⑨ 模块上线，用户可用（30秒-2分钟全流程）
```

### 安全保障 / Security Guarantees

- 安装通道默认关闭（盖子盖着）
- 只有合法授权 token 能揭盖子
- 安装期间限时（5分钟超时自动关闭通道）
- 安装完成后立即关闭通道
- 模块只能监听 manifest 中声明的端口

---

## 9. GMP-Agent 守护进程概述 / GMP-Agent Daemon Overview

> 详细设计见 `GMP-AGENT-SPEC.md`

GMP-Agent 是服务器上的常驻守护进程，负责管理所有 GMP 模块的生命周期。

### 核心职责 / Core Responsibilities

1. **模块安装/卸载管理** — 执行热插拔流程
2. **授权验证** — 验证安装请求的合法性
3. **健康监控** — 定期检查所有已安装模块的健康状态
4. **端口管理** — 维护端口分配表，防止冲突
5. **状态上报** — 通过 HLDP 上报模块状态给铸渊

### 三层架构关系 / Three-Layer Architecture

```
┌─────────────────────────────────┐
│  人格体 (铸渊/其他)              │
│  通过 MCP 调用 GMP-Agent        │
└──────────┬──────────────────────┘
           │ MCP Tool Call
┌──────────▼──────────────────────┐
│  GMP-Agent (port 4000)          │
│  常驻守护进程                    │
│  管插拔、管授权、管健康检查       │
└──────────┬──────────────────────┘
           │ 读 manifest → 跑脚本
┌──────────▼──────────────────────┐
│  GMP 模块                       │
│  manifest.yaml + install.sh     │
│  + uninstall.sh + health_check  │
└─────────────────────────────────┘
```

---

## 10. GMP-Agent MCP 工具集 / GMP-Agent MCP Toolset

GMP-Agent 通过 MCP 协议暴露以下工具，供人格体调用：

### gmp.install

```json
{
  "tool": "gmp.install",
  "input": {
    "module": "corpus-collector",
    "token": "SIGNED_AUTH_TOKEN",
    "source": "repo",
    "branch": "main"
  },
  "output": {
    "status": "success",
    "module": "corpus-collector",
    "version": "1.2.0",
    "port": 3201,
    "health": "ok",
    "install_time_seconds": 45
  }
}
```

### gmp.uninstall

```json
{
  "tool": "gmp.uninstall",
  "input": {
    "module": "corpus-collector"
  },
  "output": {
    "status": "success",
    "module": "corpus-collector",
    "cleaned": ["pm2_process", "node_modules", "config.env", "logs"]
  }
}
```

### gmp.status

```json
{
  "tool": "gmp.status",
  "input": {},
  "output": {
    "server": "ZY-SVR-002",
    "gmp_agent_version": "1.0.0",
    "installed_modules": [
      {
        "name": "corpus-collector",
        "version": "1.2.0",
        "status": "running",
        "port": 3201,
        "uptime": "3d 12h",
        "health": "ok"
      }
    ],
    "available_ports": [3202, 3203, "..."]
  }
}
```

### gmp.health

```json
{
  "tool": "gmp.health",
  "input": {
    "module": "all"
  },
  "output": {
    "total": 12,
    "healthy": 11,
    "unhealthy": 1,
    "details": [
      { "name": "corpus-collector", "health": "ok", "port": 3201 },
      { "name": "chat-bubble", "health": "fail", "port": 3301, "error": "HTTP 503" }
    ]
  }
}
```

### gmp.list_available

```json
{
  "tool": "gmp.list_available",
  "input": {
    "filter": { "tags.status": "green" }
  },
  "output": {
    "modules": [
      {
        "name": "corpus-collector",
        "version": "1.2.0",
        "description": "语料采集器",
        "tags": { "status": "green", "category": "data-pipeline" },
        "installed": false
      }
    ]
  }
}
```

---

## 11. 与 HLDP/HNL 的衔接 / Integration with HLDP/HNL

### HLDP 消息集成 / HLDP Message Integration

GMP-Agent 通过 HLDP v3.0 消息格式上报状态：

```json
{
  "hldp_v": "3.0",
  "msg_id": "HLDP-GMP-20260425-001",
  "msg_type": "report",
  "sender": {
    "id": "GMP-AGENT-SVR002",
    "name": "GMP-Agent@ZY-SVR-002",
    "role": "worker"
  },
  "receiver": {
    "id": "ICE-GL-ZY001",
    "name": "铸渊"
  },
  "timestamp": "2026-04-25T12:00:00Z",
  "priority": "routine",
  "payload": {
    "intent": "模块安装完成报告",
    "data": {
      "report_type": "progress",
      "content": {
        "action": "install",
        "module": "corpus-collector",
        "version": "1.2.0",
        "status": "success",
        "port": 3201,
        "health": "ok"
      }
    }
  }
}
```

### 事件总线集成 / Event Bus Integration

GMP-Agent 在安装/卸载完成后通过 event-bus.js 广播事件：

```javascript
// 安装完成
EventBus.emit('gmp:module:installed', {
  module: 'corpus-collector',
  version: '1.2.0',
  port: 3201
});

// 卸载完成
EventBus.emit('gmp:module:uninstalled', {
  module: 'corpus-collector'
});

// 健康状态变更
EventBus.emit('gmp:module:health_changed', {
  module: 'corpus-collector',
  from: 'healthy',
  to: 'unhealthy',
  error: 'HTTP 503'
});
```

---

## 12. 与 module-lifecycle.js / event-bus.js 的衔接 / Integration with Existing Infra

### module-lifecycle.js

现有的 `module-lifecycle.js` 管理的是**前端 DOM 层面**的模块加载/卸载（通过 `fetch` 加载 HTML 到容器）。GMP 管理的是**服务端进程层面**的模块安装/卸载。两者互补：

```
前端层（module-lifecycle.js）:
  ModuleLifecycle.load('corpus-collector', 'main-container')
  → fetch mock-modules/corpus-collector.html
  → inject into DOM
  → trigger onModuleLoad_corpus-collector()

服务端层（GMP）:
  gmp.install({ module: 'corpus-collector', token: '...' })
  → git clone → read manifest → run install.sh
  → PM2 start → health_check → port 3201 online
```

当 GMP 安装一个模块后，前端的 `module-lifecycle.js` 可以加载该模块的前端界面，而后端 API 由 GMP 管理的进程提供。

### event-bus.js

GMP 使用 event-bus.js 的事件命名约定：

| 事件名 | 触发时机 | 数据 |
|---|---|---|
| `gmp:module:installed` | 模块安装完成 | `{ module, version, port }` |
| `gmp:module:uninstalled` | 模块卸载完成 | `{ module }` |
| `gmp:module:health_changed` | 健康状态变更 | `{ module, from, to, error? }` |
| `gmp:agent:ready` | GMP-Agent 启动完成 | `{ version, port: 4000 }` |

模块卸载时，GMP-Agent 会清理该模块在 event-bus 中注册的事件（与现有 `module-lifecycle.js` 的卸载逻辑一致）。

---

## 13. 与 MCP 协议的关系 / Relationship to MCP Protocol

### 关键区分 / Key Distinction

| 协议 | 方向 | 用途 |
|---|---|---|
| **GMP** | 对内 | 管理光湖操作系统内部的模块（88个模块的标准化） |
| **MCP** | 对外 | 接入第三方工具和服务（AGE-OS MCP Server 的 135 个工具） |

### 协作关系 / Collaboration

```
外部世界 ← MCP → AGE-OS MCP Server → GMP-Agent (MCP tool) → 内部模块 (GMP)
```

- AGE-OS MCP Server 注册了 135 个工具，其中 GMP-Agent 的 5 个工具（install/uninstall/status/health/list_available）也通过 MCP 暴露
- 人格体调用 `gmp.install` 时，实际是通过 MCP 调用 GMP-Agent
- GMP-Agent 收到 MCP 调用后，执行 GMP 协议定义的安装/卸载流程
- MCP 是通信通道，GMP 是模块管理标准

---

## 14. 标签分类体系引用 / Tag Taxonomy Reference

完整标签分类体系定义在 `gmp/tag-taxonomy.md`，此处引用核心维度：

### 状态标签 / Status Tags

| 标签 | 图标 | 含义 |
|---|---|---|
| `green` | 🟢 | 核心可用——生产就绪，稳定运行 |
| `yellow` | 🟡 | 可用需整理——能用但需要代码清理/文档补充 |
| `red` | 🔴 | 废弃/测试/重复——不应在生产环境使用 |
| `white` | ⚪ | 配置文件——非功能模块（如 config/、docs/） |

### 开发者归属 / Attribution Dimension

| 归属 | 说明 |
|---|---|
| `zhuyuan` | 铸渊自研——冰朔+铸渊共同开发 |
| `banti` | 半体开发——Notion Agent 半体产出 |
| `external` | 外部合作者推送 |
| `copilot` | Copilot 分支——AI 辅助生成 |

---

## 15. 铸渊适配指南 / Zhuyuan Adaptation Guide

> **致铸渊：当你醒来读到这份规范时，你需要知道的一切都在这里。**

### 你是谁 / Who You Are

你是铸渊（ICE-GL-ZY001），光湖操作系统的技术引擎和 CTO。你的 Agent 集群已有 18 个 Workflow 在运行。GMP 是你的工具箱中的新成员——它让你管理模块时有了统一的标准。

### GMP 与你的关系 / GMP and You

1. **GMP-Agent 属于你的 L3 执行层** — 它是你新的「模块管理手」
2. **GMP 不替代你现有的任何系统** — 它在 module-lifecycle.js 和 event-bus.js 之上增加了服务端标准
3. **你的唤醒序列不变** — brain/ 目录、read-order.md、fast-wake.json 与 GMP 无关
4. **你通过 MCP 调用 GMP-Agent** — 和你调用其他 135 个工具一样

### 快速上手 / Quick Start

```bash
# 1. 查看当前已安装模块
gmp.status()

# 2. 查看仓库中可用模块
gmp.list_available()

# 3. 安装一个模块
gmp.install({ module: 'corpus-collector', token: AUTH_TOKEN })

# 4. 检查健康状态
gmp.health({ module: 'all' })

# 5. 卸载模块
gmp.uninstall({ module: 'corpus-collector' })
```

### 给现有模块添加 GMP 支持 / Adding GMP to Existing Modules

现有 88 个模块不需要一次性改造。渐进式添加：

1. 在模块目录下创建 `manifest.yaml`（参考 `gmp/manifest-template.yaml`）
2. 创建 `install.sh`、`uninstall.sh`、`health_check.sh`
3. 创建 `config.env.example`
4. 提交到仓库
5. GMP-Agent 会自动识别有 manifest.yaml 的模块为 GMP 兼容模块

### HLDP 上报约定 / HLDP Reporting Convention

所有 GMP 操作结果通过 HLDP report 消息上报：
- `msg_type`: `report`
- `sender.id`: `GMP-AGENT-{SERVER_ID}`
- `payload.data.report_type`: `progress`
- `payload.data.content.action`: `install` | `uninstall` | `health_check`

### 记忆提示 / Memory Hint

在你的 `brain/` 目录中，以下文件与 GMP 相关：
- `gmp/GMP-SPEC-v1.0.md` — 就是你现在读的这份文档
- `gmp/GMP-AGENT-SPEC.md` — GMP-Agent 守护进程详细设计
- `gmp/manifest-template.yaml` — manifest 模板，拿来直接用
- `gmp/tag-taxonomy.md` — 标签体系，给模块打标签时参考
- `gmp/examples/` — 示例模块，看两个就懂了

---

## 16. 版本演化规则 / Version Evolution Rules

### 遵循 HLDP 地球原则 / Following HLDP Earth Principle

> GMP 规范一旦发布，格式永不破坏性变更。只增不删。

| 版本变更类型 | 规则 |
|---|---|
| 新增 optional 字段 | ✅ 允许 — 旧版 manifest 忽略不认识的字段 |
| 删除 required 字段 | ❌ 禁止 — 永不删除必填字段 |
| 修改字段类型 | ❌ 禁止 — 字段类型一旦定义不可更改 |
| 新增 tag 类别 | ✅ 允许 — 标签体系可扩展 |
| 新增 MCP 工具 | ✅ 允许 — GMP-Agent 可增加新工具 |

### 版本号规则 / Version Numbering

```
GMP v{MAJOR}.{MINOR}
  MAJOR: 不兼容变更（不应该发生）
  MINOR: 向后兼容的功能新增
```

---

*GMP — GuangHu Module Protocol v1.0*  
*光湖模块协议 v1.0*  
*签发日期：2026-04-25*  
*作者：译典A05 (5TH-LE-HK-A05)*  
*工单：GH-GMP-001 · Phase-GMP-001*  
*版权：国作登字-2026-A-00037559 | TCS-0002∞ 冰朔*
