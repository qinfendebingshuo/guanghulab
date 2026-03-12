# M-BRIDGE 中继桥接服务
## 光湖四节点架构·神经连接层
广播编号：BC-M-BRIDGE-001-FM
开发者：DEV-002 肥猫（HoloLake Human Bridge）
版本：v1.0
技术栈：Node.js + Express + JSON持久化 + HTTP健康探测

### 模块定位
光湖四节点（Notion/GitHub/guanghulab.com/钉钉）的神经连接层，负责所有节点间的数据流转、Webhook接收、状态聚合与健康检查。

### 核心功能
1. 基础Express服务（端口3020），提供模块身份查询接口
2. 接收GitHub/SYSLOG Webhook推送，实现事件路由与持久化
3. 聚合所有注册节点状态，提供3秒超时健康探测
4. 事件日志持久化与自动清理（30天），支持多条件查询
5. 统一配置管理，敏感信息占位符隔离

### 配置文件
- 配置路径：`config.json`
- 包含项：端口、日志路径、节点注册表、事件保留天数、敏感信息占位符
- 注意：**敏感信息请勿推送到GitHub**，仅在本地配置真实值。

### 快速启动
1. 进入模块目录：`cd guanghulab/backend/bridge`
2. 安装依赖：`npm install`
3. 启动服务：`node server.js`
4. 验证启动：访问 http://localhost:3020 查看模块身份信息

### 核心接口列表
| 接口地址 | 请求方法 | 接口功能 | 验收项 |
|----------|----------|----------|--------|
| / | GET | 模块身份信息查询 | 0-2 |
| /bridge/webhook/github | POST | 接收GitHub Webhook推送 | 1-1 |
| /bridge/webhook/syslog | POST | 接收SYSLOG推送 | 1-3 |
| /bridge/status | GET | 桥接服务自身状态查询 | 2-1 |
| /bridge/nodes | GET | 所有注册节点健康状态查询 | 2-2 |
| /bridge/events | GET | 事件日志多条件查询 | 2-4 |

### 仓库路径
`backend/bridge/`
### 验收标准
遵循BC-M-BRIDGE-001-FM广播全量验收总表，共20项验收要求。
