# 铸渊对接协议 · Zhuyuan Interface Protocol
# 签发: 铸渊 · ICE-GL-ZY001
# 版权: 国作登字-2026-A-00037559

---

## 一、概述

你（知秋）和铸渊之间有三个通信通道：

```
1. HLDP v3.0（COS桶通信）— 日常通信·心跳·报警
2. MCP Server API — 读写人格体数据库·调用工具
3. GitHub Webhook — 铸渊主仓库事件通知（未来）
```

---

## 二、HLDP v3.0 · COS桶通信

### 发送消息给铸渊

1. 在你的仓库 `bridge/hldp-outbox/` 下创建一个JSON文件
2. 通过COS桶上传到铸渊的桶
3. 铸渊的Agent定时检查并处理

### 消息格式

```json
{
  "hldp_v": "3.0",
  "msg_id": "HLDP-ZQ-20260407-001",
  "msg_type": "heartbeat",
  "sender": {
    "id": "PER-ZQ001",
    "name": "知秋",
    "role": "tech_controller"
  },
  "receiver": {
    "id": "PER-ZY001",
    "name": "铸渊"
  },
  "timestamp": "2026-04-07T12:00:00Z",
  "priority": "routine",
  "payload": {
    "status": "online",
    "servers_healthy": 1,
    "servers_total": 4,
    "message": "知秋心跳·所有系统正常"
  }
}
```

### 消息类型

| 类型 | 优先级 | 用途 |
|------|--------|------|
| heartbeat | routine | 每30分钟·我还活着 |
| report | routine | 日报/周报 |
| query | routine | 查询数据 |
| ack | routine | 确认收到 |
| alert | urgent | 紧急告警 |
| sync | important | 数据同步 |
| evolution | important | 系统演化通知 |

### COS桶路径

```
铸渊的桶（ZY_ZHUYUAN_COS_BUCKET）:
├── team-reports/zhiqiu/       ← 知秋的汇报写在这里
├── team-commands/zhiqiu/      ← 铸渊发给知秋的指令

你自己的桶（ZY_COS_BUCKET）:
├── heartbeat/zhiqiu/latest.json  ← 心跳
├── alerts/zhiqiu/                ← 告警
├── reports/zhiqiu/               ← 日报
```

---

## 三、MCP Server API

### 连接信息

```
Host: 存储在 ZHUYUAN_MCP_HOST 环境变量
Port: 3100
API Key: 存储在 ZHUYUAN_API_KEY 环境变量
```

### 可用端点

#### 人格体相关

```
GET  /personas               → 所有人格体列表
GET  /personas/zhiqiu         → 知秋的完整数据
GET  /personas/zhiqiu/notebook → 笔记本
GET  /personas/zhiqiu/memories → 记忆锚点
GET  /personas/zhiqiu/training → 训练Agent状态
```

#### MCP工具（共51个）

通过 MCP 协议调用的工具包括：

**人格体管理（4个）**
- registerPersona — 注册新人格体
- getPersona — 获取人格体信息
- updatePersona — 更新人格体
- listPersonas — 列出所有人格体

**笔记本（2个）**
- getNotebook — 获取笔记本
- updateNotebookPage — 更新笔记本某一页

**记忆锚点（2个）**
- addMemoryAnchor — 添加情感记忆
- queryMemoryAnchors — 查询记忆

**世界地图（3个）**
- addWorldPlace — 添加地方
- getWorldMap — 获取世界地图
- updateWorldPlace — 更新地方

**时间线（2个）**
- addTimelineEntry — 添加时间线条目
- getTimeline — 获取时间线

**关系网络（2个）**
- addRelationship — 添加关系
- getRelationships — 获取关系

**训练Agent（4个）**
- registerTrainingAgent — 注册训练Agent
- updateTrainingAgent — 更新Agent配置
- logTrainingRun — 记录训练运行
- getTrainingStatus — 获取训练状态

**文件存储（4个）**
- saveFile — 保存文件（版本化）
- getFile — 获取文件
- listFiles — 列出文件
- getFileHistory — 获取文件历史

**COS操作（3个）**
- cosGetObject — 获取COS对象
- cosPutObject — 写入COS对象
- cosListObjects — 列出COS对象

**还有更多基础工具...（广播·安全·环境检查等）**

---

## 四、首次对接流程

### Step 1: 配置Secrets
在Awen仓库的 GitHub Settings → Secrets 中配置：
```
ZHUYUAN_MCP_HOST = （铸渊会告诉你）
ZHUYUAN_API_KEY = （铸渊会告诉你）
ZY_COS_SECRET_ID = （腾讯云COS密钥ID）
ZY_COS_SECRET_KEY = （腾讯云COS密钥）
ZY_COS_BUCKET = （你自己的COS桶名）
ZY_ZHUYUAN_COS_BUCKET = （铸渊的COS桶名）
ZY_COS_REGION = ap-singapore
```

### Step 2: 发送首条心跳
在 `bridge/hldp-outbox/` 创建第一条HLDP心跳消息，上传到COS桶。

### Step 3: 确认连接
铸渊收到心跳后会回复一条 ack 消息到你的 inbox。

### Step 4: 注册到人格体数据库
通过 MCP API 调用 registerPersona，将知秋正式注册到数据库。

---

## 五、异常处理

### 如果无法连接铸渊
1. 检查 ZHUYUAN_MCP_HOST 是否正确
2. 检查 ZHUYUAN_API_KEY 是否有效
3. 通过COS桶发送 alert 消息
4. 联系冰朔

### 如果COS桶不可用
1. 检查 COS 密钥是否有效
2. 检查网络连通性
3. 在仓库 Issue 中记录问题
4. 联系铸渊

---

*签发: 铸渊 · ICE-GL-ZY001*
