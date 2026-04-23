# 🧭 霜砚开发导航 · AG-SY-DEV-NAV

> **用途**: 霜砚(AG-SY-01)每次从 Notion 做开发时，**第一件事**读这个文件。
> 做完后**最后一件事**更新这个文件。
> 不用满仓库翻，所有上下文都在这里。
>
> 最后更新: 2026-04-23T16:15+08:00
> 更新者: 霜砚(AG-SY-01)

---

## 📁 仓库结构地图

```
guanghulab/
├── docs/                  # GitHub Pages 前端 (guanghuyaoming.com)
│   ├── index.html         # 主页·零点原核频道 (地球+HUD+三扁门)
│   ├── channel.html       # 映川频道 (对话+系统状态) [PR#428]
│   └── CNAME              # guanghuyaoming.com
├── glada/                 # GLADA · 光湖自主开发Agent
│   ├── service.js         # 主服务入口 (HTTP API + 执行循环)
│   ├── service-entry.js   # 入口包装器 (自动注入web扩展) [PR#428]
│   ├── web-extensions.js  # Web扩展 (CORS+映川对话+系统状态) [PR#428]
│   ├── ecosystem.config.js # PM2配置
│   ├── cognitive-foundation.js # 底层认知 (映川+晨曦一体)
│   ├── context-builder.js # 上下文构建器 v2.0
│   ├── persona-loader.js  # 人格加载器
│   ├── memory-store.js    # 双层记忆 (COS热桶+冷桶)
│   ├── model-router.js    # 模型路由器 (自动发现+分类)
│   ├── task-receiver.js   # 任务接收器
│   ├── execution-loop.js  # 执行循环
│   ├── step-executor.js   # 步骤执行器
│   ├── notifier.js        # 通知器
│   └── nginx-brain.conf.example # Nginx配置示例 [PR#428]
├── mcp-servers/
│   └── zhuyuan-mcp/       # 铸渊自建MCP Server v1.0 [PR#426]
│       ├── index.js       # 主文件 (10个工具, ESM)
│       ├── package.json   # 依赖: express, @modelcontextprotocol/sdk, zod
│       └── README.md      # 部署文档
├── brain/                 # 铸渊大脑 / Agent记忆
│   ├── shuangyan-dev-nav.md  # ← 你正在读的这个文件
│   ├── master-brain.md    # 执行层主脑
│   ├── agent-registry.json # Agent注册表
│   └── ...
├── server/                # 服务器应用
├── .github/workflows/     # GitHub Actions (104+)
└── ...
```

---

## 📌 活跃PR状态

| PR | 分支 | 状态 | 说明 | 最后SHA |
|----|------|------|------|--------|
| #428 | `feat/yingchuan-web-chat` | ✅ 待合并 | 映川Web频道 (对话+系统状态) | `765012e9` |
| #426 | `feat/zhuyuan-mcp-v1` | ✅ 待合并 | 铸渊自建MCP Server | `8f0ed020` |
| #427 | `feat/glada-yingchuan-persona` | ✅ 已合并 | GLADA映川人格集成 | 已入main |

### PR #428 文件清单
- `glada/web-extensions.js` — 后端: CORS + 映川对话API + 系统状态API
- `glada/service-entry.js` — 入口包装器 (Express原型拦截注入)
- `glada/ecosystem.config.js` — PM2入口改为 service-entry.js
- `glada/nginx-brain.conf.example` — Nginx HTTPS反代配置示例
- `docs/channel.html` — 前端频道页 (湖光主题)

### PR #426 文件清单
- `mcp-servers/zhuyuan-mcp/index.js` — 10个工具, ESM, MCP Streamable HTTP
- `mcp-servers/zhuyuan-mcp/package.json` — 依赖清单
- `mcp-servers/zhuyuan-mcp/README.md` — 部署文档 (有Copilot建议待修: --env语法)

---

## 🛠️ 关键架构决策记录

### GLADA Web扩展 — 为什么用包装器而不改service.js
- service.js 有24KB，直接改风险大
- `service-entry.js` 拦截 `Express.application.listen()`，在监听前注入web-extensions
- 这样 service.js 完全不动，两个文件解耦
- ecosystem.config.js 入口从 `service.js` 改为 `service-entry.js`

### MCP Server — 为什么用 Streamable HTTP stateless
- Notion Custom Agent 原生支持 MCP Streamable HTTP
- stateless 模式不需要session管理，每次请求独立
- 端口复用 3900 (待讨论：是否跟 GLADA 分开)

### 映川对话安全设计
- CORS白名单: guanghuyaoming.com, guanghulab.online, localhost
- 速率限制: 对话20/min, 状态30/min
- 会话上限: MAX_SESSIONS=200, LRU淘汰最老
- MCP auth: 未配密钥只允许localhost, timingSafeEqual防时序攻击

---

## 💻 服务器环境

| 服务器 | IP | 用途 | 关键进程 |
|--------|-----|------|--------|
| ZY-BRAIN (大脑) | 43.156.237.110 | GLADA运行 | glada-agent (PM2 id=11, port 3900) |
| ZY-FACE (面孔) | 43.134.16.246 | 前端服务 | zhuyuan-server, zhuyuan-preview, novel-api |

### 大脑服务器部署路径
- 代码: `/opt/zhuyuan/guanghulab/`
- 日志: `/var/log/glada/`
- PM2: `pm2 start glada/ecosystem.config.js`
- 关键环境变量: `ZY_LLM_API_KEY`, `ZY_LLM_BASE_URL`, `ZY_MCP_SECRET`

### 域名映射
- `guanghuyaoming.com` → GitHub Pages (`docs/`)
- `brain.guanghuyaoming.com` → ZY-BRAIN:3900 (Nginx HTTPS) [**待配置**]

---

## 💾 COS存储

- 热桶: `zy-core-bucket-1317346199` (ap-guangzhou)
- 冷桶: `zy-corpus-bucket-1317346199` (ap-guangzhou)
- 映川记忆路径: `glada/yingchuan-memory/`
- 密钥: `ZY_OSS_KEY`, `ZY_OSS_SECRET`, `ZY_COS_REGION`

---

## ⏳ 待办事项

- [ ] 合并 PR #428 (映川Web频道) → 部署到大脑服务器
- [ ] 合并 PR #426 (铸渊MCP) → 部署到面孔服务器 + Notion连接
- [ ] 配置DNS: `brain.guanghuyaoming.com` A记录 → 43.156.237.110
- [ ] 配置Nginx + SSL: 参考 `nginx-brain.conf.example`
- [ ] PR #426 README: 修PM2 `--env` 语法 (优先级低)

---

## 📝 开发会话日志

### 2026-04-23 · 霜砚第一次完整开发会话

**完成:**
1. ✅ GitHub MCP测试 (42个工具确认可用)
2. ✅ PR #426: 铸渊MCP Server v1.0 (10个运维工具)
3. ✅ PR #427: GLADA映川人格集成 (5个文件) → 已合并+部署
4. ✅ PR #428: 映川Web频道 (web-extensions + channel.html + service-entry)
5. ✅ Copilot安全审查修复 (PR#426 auth加固 + PR#428 session上限)
6. ✅ 建立本导航文件

**关键发现:**
- `list_branches` 只返回前30个分支 (字母序)，找特定分支要用 `pull_request_read` + `method: 'get'` 获取 head.ref
- `get_file_contents` 要用 `ref` 参数指定分支 SHA，不能用 `branch`
- `push_files` 可以更新已有文件，不需要SHA
- 服务器布局: 大脑(GLADA) 和 面孔(前端服务) 是两台机器

---

## 🔧 GitHub MCP 工具备忘录

### 常用工具
- `push_files` — 推文件到分支 (可创建+更新)
- `create_branch` — 创建分支 (from: 指定源分支)
- `create_pull_request` — 创PR
- `get_file_contents` — 读文件 (**用ref不用branch**)
- `pull_request_read` + `method:'get'` — 获取PR详情 (包含 head SHA)
- `list_commits` — 查提交历史
- `search_code` — 搜代码 (注意: 搜全GitHub不仅本仓库)

### 不存在的工具 (别试)
- `list_repository_secrets` ❌
- `list_workflows` ❌
- `get_pull_request` ❌ (用 `pull_request_read`)

---

*本文件由霜砚(AG-SY-01)维护，每次开发会话结束时更新。*
*如果你是霜砚并且正在读这个文件，先检查“待办事项”和“活跃PR状态”，然后再开始工作。*
