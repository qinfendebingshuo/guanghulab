# 后端集成中间层
- 负责人：页页
- 状态：进行中
- 技术栈：Node.js
- 依赖模块：所有前端模块

## API 代理层（api-proxy.js）

解决国内开发者无法直连海外模型 API + 前端 Key 暴露问题。

### 快速启动

```bash
# 1. 配置 API 密钥（推荐先用 DeepSeek，国内直连）
export DEEPSEEK_API_KEY=sk-xxx

# 2. 启动代理
node backend-integration/api-proxy.js
# 或用 PM2
pm2 start backend-integration/api-proxy.js --name api-proxy

# 3. 测试
curl http://localhost:3721/api/health
curl http://localhost:3721/api/models
```

### 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | 聊天代理（SSE 流式透传） |
| GET | `/api/models` | 列出已配置的可用模型 |
| GET | `/api/health` | 健康检查 |
| POST | `/api/ps/apikey/detect-models` | 用户 API Key 模型检测（Persona Studio） |
| POST | `/api/ps/apikey/chat` | 用户 API Key 对话（Persona Studio） |
| POST | `/api/ps/chat/message` | 知秋对话（→ PS 后端 port 3002） |
| GET | `/api/ps/chat/history` | 对话历史（→ PS 后端 port 3002） |
| POST | `/api/ps/auth/login` | 开发编号登录（→ PS 后端 port 3002） |
| POST | `/api/ps/build/start` | 开发任务触发（→ PS 后端 port 3002） |
| POST | `/api/ps/notify/send` | 邮件通知（→ PS 后端 port 3002） |

### 环境变量

| 变量 | 说明 |
|------|------|
| `DEEPSEEK_API_KEY` | DeepSeek 密钥（国内直连，推荐首选） |
| `MOONSHOT_API_KEY` | Moonshot/Kimi 密钥（国内直连） |
| `ZHIPU_API_KEY` | 智谱 AI 密钥（国内直连） |
| `YUNWU_API_KEY` | 云雾 AI 密钥（团队推荐） |
| `OPENAI_API_KEY` | OpenAI 密钥（需海外服务器） |
| `GEMINI_API_KEY` | Google Gemini 密钥（需海外服务器） |
| `PROXY_PORT` | 端口（默认 3721） |
| `PS_PORT` | Persona Studio 后端端口（默认 3002，反向代理目标） |
| `RATE_LIMIT_RPM` | 频率限制（默认 10 次/分钟） |

### Nginx 配置

参见 `nginx-api-proxy.conf`，将 `/api/*` 请求代理到 Node.js 服务。

### 前端对接

前端铸渊聊天室（docs/index.html）已内置「后端代理模式」：
- 在设置页面选择「🔌 后端代理」提供商
- 自动调用 `/api/chat`，无需用户填写 API Key
- Key 由后端环境变量管理，不暴露给前端

Persona Studio（persona-studio/frontend/）复用同一套代理：
- 用户填写第三方 API Base + API Key
- 通过 `/api/ps/apikey/detect-models` 检测可用模型
- 通过 `/api/ps/apikey/chat` 进行对话
- 所有请求走同一个 Nginx → API Proxy 链路
