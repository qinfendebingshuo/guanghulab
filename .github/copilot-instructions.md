# HoloLake · Copilot Custom Instructions

## 项目背景
这是 HoloLake（光湖）MVP 后端项目，运行在 guanghulab.com。
技术栈：Node.js 20 + Express + PM2 + Nginx。
核心架构：人格语言操作系统（AGE OS），壳-核分离设计。

## HLI 接口协议
- 所有 API 路由必须以 `/hli/` 为前缀
- 每个路由文件必须在 `src/routes/hli/{domain}/` 目录下
- 每个路由必须有对应的 `src/schemas/hli/{domain}/{name}.schema.json`
- Schema 文件必须包含 `hli_id`, `input`, `output` 三个顶层字段
- 接口编号格式: `HLI-{DOMAIN}-{NNN}`

## 代码风格
- 所有接口入口必须先经过 `middleware/hli-auth.middleware.js` 鉴权（除 AUTH 域的 login/register）
- 错误响应统一格式: `{ error: true, code: string, message: string }`
- 成功响应必须包含请求的 `hli_id` 用于溯源
- STREAM 类型接口使用 SSE (text/event-stream), 不使用 WebSocket
- 所有数据库操作必须使用参数化查询, 禁止字符串拼接 SQL

## 新建接口的标准流程
1. 在 `src/schemas/hli/{domain}/` 下创建 schema JSON
2. 在 `src/routes/hli/{domain}/` 下创建路由文件
3. 在 `src/routes/hli/index.js` 中注册路由
4. 在 `tests/contract/` 下创建契约测试
5. 在 `tests/smoke/` 下创建冒烟测试
6. 确保 `npm run test:contract` 通过

## 禁止事项
- 禁止在 `/hli/` 路由下混入非 HLI 协议的接口
- 禁止跳过 schema 直接写路由
- 禁止在生产代码中使用 console.log (使用项目 logger)
- 禁止硬编码 persona_id 或 user_id
