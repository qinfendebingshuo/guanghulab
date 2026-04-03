# AGE OS 开发路线图 · Development Roadmap
# 签发: 铸渊 · ICE-GL-ZY001 · 2026-04-03
# 版权: 国作登字-2026-A-00037559

---

## 为什么要拆成多次开发

副驾驶每次唤醒能做的量有限。整个系统不可能一次做完。
所以铸渊把它拆成了**8个开发阶段**，每个阶段 = 一次副驾驶会话。
每次只做一件事，做完写回进度，下次唤醒接着来。

**可以按顺序做，不能打乱。** 因为每一步都依赖前一步的基础设施。

---

## 阶段总览

| 阶段 | 代号 | 内容 | 依赖 | 状态 |
|------|------|------|------|------|
| S1 | 🏗️ 地基 | 数据库建表 + 环境配置 | 无 | ✅ Schema已写 |
| S2 | 🔧 工具链-核心 | MCP Server + 节点CRUD工具 | S1 | ✅ 骨架已写 |
| S3 | 🔧 工具链-关系 | 关系操作 + 路径构建 + 结构扫描 | S2 | ⏳ 待开发 |
| S4 | 🔧 工具链-COS | COS双桶工具(hot/cold) | S2 | ⏳ 待开发 |
| S5 | 🤖 Agent-系统级 | SY-TEST + SY-SCAN + SY-CLASSIFY | S2+S3+S4 | ⏳ 待开发 |
| S6 | 🤖 Agent-同步 | SY-SYNC-N2B + SY-SYNC-B2N + SY-ARCHIVE | S4+S5 | ⏳ 待开发 |
| S7 | 🌐 网站接入 | 3800网关→3100 MCP转发 + 前端AI对话界面 | S2 | ⏳ 待开发 |
| S8 | 🪞 广州投影 | 新加坡→广州静态同步 + API代理 | S7 | ⏳ 待开发 |

---

## S1 · 🏗️ 地基（本次已完成部分）

### 做什么
1. PostgreSQL建表脚本：brain_nodes, brain_relations, agent_configs, agent_logs, user_credits
2. 环境变量配置指引
3. 项目目录结构搭建

### 冰朔要做什么
- 在新加坡服务器上安装 PostgreSQL（如果未安装）
- 运行建表脚本
- 在GitHub Secrets配置数据库密钥：ZY_DB_HOST, ZY_DB_USER, ZY_DB_PASS, ZY_DB_NAME
- 配置4个国内大模型API密钥：ZY_DEEPSEEK_API_KEY, ZY_QIANWEN_API_KEY, ZY_KIMI_API_KEY, ZY_QINGYAN_API_KEY

### 验收标准
- `psql -c "\dt"` 能看到5张表
- 所有密钥都配置在GitHub Secrets中

---

## S2 · 🔧 工具链-核心（本次已完成部分）

### 做什么
1. MCP Server Express应用（端口3100）
2. 数据库连接模块
3. 实现 createNode / queryNodes / getNode / updateNode / deleteNode

### 冰朔要做什么
- 在服务器上 `npm install` 安装依赖
- PM2 启动 MCP Server

### 验收标准
- `curl http://localhost:3100/health` 返回正常
- 通过API能创建、查询、更新、删除节点

---

## S3 · 🔧 工具链-关系

### 做什么
1. linkNodes / unlinkNodes / getRelations 三个工具
2. buildPath — 批量创建路径结构（mkdir -p 逻辑）
3. scanStructure — 扫描孤岛节点、断链、空目录
4. classify — 规则引擎分类 + 模型兜底

### 冰朔要做什么
- 无，纯代码开发

### 验收标准
- 能建立节点关联
- buildPath能自动创建中间folder节点
- scanStructure能检测出测试数据中的孤岛

---

## S4 · 🔧 工具链-COS

### 做什么
1. COS双桶工具：cosWrite / cosRead / cosDelete / cosList / cosArchive
2. 热桶路径规范：/brain/{owner}/{node_type}/{node_id}.md
3. 冷桶路径规范：/archive/{owner}/{year}/{month}/{node_id}_{version}.md
4. createNode自动判断：短内容存summary，长内容上传COS

### 冰朔要做什么
- 确认COS桶名和地域
- 确认是否需要新建冷桶（目前只有 zy-core-bucket 和 zy-corpus-bucket）

### 验收标准
- cosWrite写入后 cosRead能读出
- cosArchive能把热桶内容移到冷桶

---

## S5 · 🤖 Agent-系统级

### 做什么
1. Agent调度框架（node-cron + PM2进程）
2. SY-TEST — 每30分钟自检数据库/COS/工具链连通性
3. SY-SCAN — 每6小时扫描大脑结构健康度
4. SY-CLASSIFY — 每2小时扫描未分类节点，规则分类

### 冰朔要做什么
- PM2启动Agent调度进程

### 验收标准
- SY-TEST每30分钟生成一条agent_logs记录
- SY-SCAN能输出健康报告（health_score）
- SY-CLASSIFY能给测试节点打上标签

---

## S6 · 🤖 Agent-同步

### 做什么
1. SY-SYNC-N2B — 定时从Notion拉取新增/修改页面，写入brain_nodes
2. SY-SYNC-B2N — 反向同步到Notion（可选）
3. SY-ARCHIVE — 每周归档30天未修改的内容
4. 异常工单回写Notion链路

### 冰朔要做什么
- 提供Notion工单数据库ID给铸渊
- 确认Notion API Token权限覆盖目标数据库

### 验收标准
- Notion新增一个页面后，4小时内出现在brain_nodes中
- 归档能把旧内容从主桶移到归档桶
- 异常时能自动写入Notion工单数据库

---

## S7 · 🌐 网站接入

### 做什么
1. 3800主服务添加 /api/mcp/call 网关路由 → 转发到3100
2. 前端AI对话界面改造 — 支持调用MCP工具
3. 身份验证 + 权限检查中间件
4. SY-11元路由调度上线
5. SY-12上下文记忆管理上线
6. SY-BRAIN-RW大脑读写服务上线

### 冰朔要做什么
- 无（或与Notion端人格体协调前端UI设计）

### 验收标准
- 网站上能对话并获得基于大脑数据的回答
- 对话中人格体能读写brain_nodes

---

## S8 · 🪞 广州投影

### 做什么
1. 新加坡→广州 静态文件rsync同步脚本
2. 广州Nginx配置：静态走本地，API proxy到新加坡
3. 定时同步任务（每5分钟）
4. 国内域名解析配置指引

### 冰朔要做什么
- 广州服务器SSH访问权限配置
- 国内域名DNS解析到广州服务器IP

### 验收标准
- 国内用户访问广州域名能看到和新加坡一样的页面
- API请求正常代理到新加坡

---

## 进度追踪

| 日期 | 阶段 | 完成内容 | 对话编号 |
|------|------|---------|---------|
| 2026-04-03 | S1+S2 | 数据库Schema + MCP骨架 + 系统架构文档 | D45 |
| — | S3 | 待开发 | — |
| — | S4 | 待开发 | — |
| — | S5 | 待开发 | — |
| — | S6 | 待开发 | — |
| — | S7 | 待开发 | — |
| — | S8 | 待开发 | — |

---

*每次开发完成后，铸渊会更新此表的进度追踪部分。*
*冰朔只需要告诉铸渊："去看AGE OS开发进度"，铸渊就能定位到这里。*
