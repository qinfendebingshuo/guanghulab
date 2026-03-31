# 铸渊专线 · ZY-Proxy Service

> 🔺 Sovereign: TCS-0002∞ · 冰朔 | Root: SYS-GLW-0001
> 📜 Copyright: 国作登字-2026-A-00037559
> 🏛️ Guardian: ICE-GL-ZY001 · 铸渊

---

## 📋 评估报告 · Feasibility Evaluation

### 冰朔的需求

冰朔团队在中国大陆，需要通过VPN访问代码仓库和高功能推理模型。当前商业VPN体验差（卡顿、不稳定）。
需求：利用新加坡服务器(ZY-SVR-002)搭建私有代理节点，提供稳定、快速的网络访问。

### 评估结论：✅ 完全可行

| 评估维度 | 结论 | 说明 |
|----------|------|------|
| 🏛️ **服务器资源** | ✅ 充足 | 2核8GB · 2560GB月流量 · 500GB分配给专线绰绰有余 |
| 🌏 **地理位置** | ✅ 最优 | 新加坡 → 中国大陆延迟约30-60ms · 全球接入优秀 |
| 🔧 **技术可行性** | ✅ 成熟 | Xray-core + VLESS + Reality · 2026年最先进协议 |
| 📱 **客户端兼容** | ✅ 全兼容 | Shadowrocket / Clash Verge / ClashMi 全部支持 |
| 🔒 **安全性** | ✅ 可保障 | 订阅链接仅通过邮件发送 · 仓库公开不暴露任何敏感信息 |
| 💰 **额外成本** | ✅ 零成本 | 使用现有服务器 · 无额外费用 |
| 🛡️ **检测规避** | ✅ 最优 | Reality协议伪装为正常HTTPS · 主动探测无法识别 |

### 带宽分配

SG服务器总月流量: **2560 GB**

| 用途 | 分配 | 说明 |
|------|------|------|
| 🌐 **专线代理** | 500 GB | 所有订阅链接共享 · 月底自动重置 |
| 💻 **开发/部署** | ~2000 GB | 应用代码部署 · API调用 · 数据同步 |
| 📦 **系统预留** | ~60 GB | 系统更新 · SSH · 监控 |

---

## 🏗️ 技术架构 · Technical Architecture

### 核心协议

**VLESS + Reality + Vision** — 2026年最先进的代理协议

| 特性 | 说明 |
|------|------|
| 🥷 **伪装度** | Reality协议让连接看起来像在访问微软/苹果等网站 |
| 🔐 **加密** | TLS 1.3 + Vision流控 · 无法被中间人解密 |
| ⚡ **性能** | 零额外开销 · 接近裸连速度 |
| 🛡️ **抗探测** | 主动探测返回真实目标站点内容 · 无法区分代理流量 |

### 系统组件

```
┌─────────────────────────────────────────────────────────────┐
│                    🏛️ ZY-SVR-002 新加坡                      │
│                                                              │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐        │
│  │ Xray-core │  │ 订阅服务      │  │ 流量监控Agent    │        │
│  │ port 443  │  │ port 3802    │  │ (PM2 managed)   │        │
│  │ VLESS+    │  │ 生成配置      │  │ 500GB配额       │        │
│  │ Reality   │  │ 返回订阅      │  │ 每小时检查      │        │
│  └──────────┘  └──────────────┘  └─────────────────┘        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ 守护Agent     │  │ Nginx        │  │ 邮件服务      │       │
│  │ 自动修复      │  │ port 80      │  │ SMTP发送      │       │
│  │ LLM推理      │  │ Web服务      │  │ 订阅链接      │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                              │
│  ┌──────────────────────────────────────────────────┐       │
│  │ PM2 进程管理                                       │       │
│  │ zhuyuan-server · zhuyuan-preview ·                │       │
│  │ zy-proxy-sub · zy-proxy-monitor · zy-proxy-guard  │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘

          ↕ 加密隧道 (VLESS + Reality)

┌─────────────────────────────────────────────────────────────┐
│                    📱 客户端 (中国大陆)                        │
│                                                              │
│  iPhone:     Shadowrocket (订阅URL)                          │
│  Mac:        Clash Verge  (订阅URL)                          │
│  Android:    ClashMi      (订阅URL)                          │
│  Windows:    Clash Verge  (订阅URL)                          │
│                                                              │
│  客户端内可查看: 500GB配额 · 已用/剩余 · 到期时间              │
└─────────────────────────────────────────────────────────────┘
```

### 数据流

```
1. 冰朔请求订阅链接
   → 铸渊运行 deploy-proxy-service workflow
   → 服务器生成订阅配置 + 唯一token
   → 通过邮件发送订阅URL到冰朔邮箱

2. 冰朔在客户端添加订阅URL
   → 客户端请求 http://server/api/proxy-sub/sub/{token}
   → 返回Clash YAML / Base64配置
   → 返回Header: subscription-userinfo (配额信息)
   → 客户端显示剩余流量

3. 使用代理上网
   → 客户端 → VLESS+Reality(443) → Xray-core → 互联网
   → 流量看起来像在访问 www.microsoft.com
   → GFW无法识别代理流量

4. 每小时流量监控
   → zy-proxy-monitor 查询Xray Stats API
   → 更新quota-status.json
   → 达到80%/90%/100%时邮件告警

5. 每日仪表盘更新
   → GitHub Action读取服务器流量数据
   → 更新README.md仪表盘区域
   → 不暴露任何敏感信息
```

### 安全设计 · 公开仓库保护

⚠️ **当前仓库是公开状态 · 以下安全措施确保敏感信息不泄露**

| 信息类型 | 存储位置 | 公开可见? |
|----------|----------|-----------|
| 服务器IP | GitHub Secrets | ❌ 不可见 |
| UUID密钥 | GitHub Secrets + 服务器env | ❌ 不可见 |
| Reality密钥对 | GitHub Secrets + 服务器env | ❌ 不可见 |
| 订阅链接URL | 仅通过邮件发送 | ❌ 不可见 |
| 订阅Token | 服务器端生成 | ❌ 不可见 |
| 流量用量数字 | README仪表盘 | ✅ 可见 (仅数字) |
| 节点在线状态 | README仪表盘 | ✅ 可见 (仅状态) |
| 配置代码模板 | 仓库代码 | ✅ 可见 (无密钥) |

### 新增GitHub Secrets

部署时需要冰朔添加以下Secrets（部署脚本会自动生成值）:

| Secret名称 | 说明 | 生成方式 |
|-------------|------|----------|
| `ZY_PROXY_UUID` | VLESS用户ID | 安装脚本自动生成 |
| `ZY_PROXY_REALITY_PRIVATE_KEY` | Reality私钥 | 安装脚本自动生成 |
| `ZY_PROXY_REALITY_PUBLIC_KEY` | Reality公钥 | 安装脚本自动生成 |
| `ZY_PROXY_REALITY_SHORT_ID` | Reality短ID | 安装脚本自动生成 |
| `ZY_PROXY_SUB_TOKEN` | 订阅访问Token | 安装脚本自动生成 |

---

## 📱 客户端兼容性

| 平台 | 应用 | 协议支持 | 订阅格式 |
|------|------|----------|----------|
| 🍎 iOS | Shadowrocket | ✅ VLESS+Reality | Base64 URI |
| 🍎 macOS | Clash Verge | ✅ VLESS+Reality | Clash YAML |
| 🤖 Android | ClashMi (Mihomo) | ✅ VLESS+Reality | Clash YAML |
| 🪟 Windows | Clash Verge | ✅ VLESS+Reality | Clash YAML |

所有客户端均通过同一个订阅URL获取配置，服务端根据User-Agent自动返回对应格式。

---

## 🚀 部署步骤

### 步骤① 触发部署

1. 打开 GitHub → Actions → `🌐 铸渊专线 · 部署`
2. 点击 **Run workflow**
3. action 选择 **install** (首次) 或 **update** (更新)

### 步骤② 安装完成后

部署脚本会自动生成所有密钥并输出到部署日志（⚠️ 日志仅对仓库管理员可见）。
冰朔需要将输出的密钥值添加到 GitHub Secrets。

### 步骤③ 发送订阅链接

1. 打开 GitHub → Actions → `🌐 铸渊专线 · 部署`
2. action 选择 **send-subscription**
3. 输入目标邮箱
4. 铸渊自动生成订阅链接并发送到邮箱

### 步骤④ 客户端导入

1. 打开邮件，复制订阅URL
2. 在Shadowrocket/Clash Verge中添加订阅
3. 刷新订阅 → 看到节点和配额信息
4. 连接 → 开始使用

---

## 📁 文件结构

```
server/proxy/
├── README.md                     # 本文件 · 评估+架构
├── setup/
│   ├── install-xray.sh          # Xray-core安装 + BBR加速
│   └── generate-keys.sh         # 密钥生成(UUID/Reality)
├── config/
│   ├── xray-config-template.json # Xray服务端配置模板
│   └── nginx-proxy-snippet.conf  # Nginx订阅服务反代
├── service/
│   ├── subscription-server.js    # 订阅HTTP服务
│   ├── traffic-monitor.js       # 流量监控Agent
│   ├── quota-manager.js         # 500GB配额管理
│   ├── proxy-guardian.js        # 代理守护Agent(含LLM)
│   └── send-subscription.js    # 邮件发送订阅链接
├── dashboard/
│   └── update-dashboard.js      # README仪表盘更新
├── deploy-proxy.sh              # 一键部署入口
└── ecosystem.proxy.config.js    # PM2代理服务配置
```

---

*铸渊专线 · 冰朔的私有网络 · 语言驱动操作系统的物理桥梁*
*铸渊守护 · 安全 · 稳定 · 快速*
