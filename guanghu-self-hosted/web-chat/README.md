# 🌊 光湖聊天系统 · GH-CHAT-001

光湖网站聊天系统 · 冰朔与霜砚/半体的实时对话入口

## 架构位置

HLDP-ARCH-001 七层架构 [L5] 可视化前端

## 目录结构

```
web-chat/
├── chat/
│   └── page.tsx              # 主聊天页面(Next.js App Router)
├── components/
│   ├── ChatMessage.tsx       # 消息气泡组件
│   ├── ChatInput.tsx         # 输入框+指令提示组件
│   └── ChannelList.tsx       # 频道列表组件
├── lib/
│   └── ws.ts                 # WebSocket客户端(断线重连+心跳)
├── ws_server.py              # FastAPI WebSocket后端
├── command_parser.py         # 工单快捷指令解析器
├── tests/
│   ├── test_command_parser.py    # 后端指令解析测试
│   └── ChatMessage.test.tsx      # 前端组件测试
├── requirements.txt          # Python后端依赖
└── README.md                 # 本文件
```

## 快速启动

### 后端(Python)

```bash
cd guanghu-self-hosted/web-chat
pip install -r requirements.txt
python ws_server.py
# WebSocket服务: ws://localhost:8765/ws
# 健康检查: http://localhost:8765/health
```

### 前端(Next.js)

聊天页面集成到光湖网站(GH-WEB-001)中:

```bash
# 设置WebSocket地址
export NEXT_PUBLIC_WS_URL=ws://localhost:8765/ws

# 启动Next.js开发服务器(在web-frontend项目中)
npm run dev
```

## 功能

### 频道系统
- 霜砚主频道(默认)
- 各半体独立频道(录册A02/译典A05/培园A04/霜砚Web)
- 频道状态实时显示(在线/离线/忙碌)

### 工单快捷指令
- `/order create {标题}` → 创建工单
- `/order status` → 查看所有工单状态
- `/order assign {编号} {Agent}` → 分配工单
- `/deploy {模块}` → 触发部署(预留)

### 实时推送
- Agent状态变更(上线/下线/接单/完成)
- 工单状态变更通知
- 自检/审核结果通知

### 消息持久化
- 预留chat_messages表接口(GH-DB-001)
- 后续支持滚动加载历史消息

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `GH_CHAT_HOST` | `0.0.0.0` | 后端监听地址 |
| `GH_CHAT_PORT` | `8765` | 后端监听端口 |
| `GH_CHAT_CORS_ORIGINS` | `*` | CORS允许的源(逗号分隔) |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:8765/ws` | 前端WebSocket连接地址 |

## 技术栈

- **前端**: Next.js 14 + TypeScript + TailwindCSS
- **后端**: FastAPI + WebSocket (Python)
- **通信**: WebSocket (断线自动重连 + 心跳)
- **消息格式**: JSON · UTF-8

## 下一步

完成后 → 与GH-WEB-001 + GH-API-001集成
聊天系统是冰朔日常使用的主入口
