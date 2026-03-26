/**
 * 🔗 光湖后端中间层 · 通道B 入口
 *
 * 实时调用 Notion API / GitHub API，为前端提供数据代理。
 * 包含：读取层 + 写入层 + 意图路由 + 权限沙箱 + 认知引导 + 执行保护
 * 只监听 127.0.0.1，通过 Nginx 反向代理对外暴露。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const express = require('express');
const cors = require('cors');
const executionLock = require('./middleware/execution-lock');
const skyeyeReview = require('./middleware/skyeye-review');
const watchdog = require('./services/execution-watchdog');

const app = express();

// CORS：只允许自己的域名
app.use(cors({
  origin: [
    'https://guanghulab.com',
    'https://www.guanghulab.com',
    'https://qinfendebingshuo.github.io'
  ],
  credentials: true
}));

app.use(express.json());

// 执行锁取消拦截（全局中间件，在所有路由之前）
app.use(executionLock.blockCancellation);

// 天眼指令审核（S7/S8/S9 全局强制前置，不可关闭，不可绕过）
app.use(skyeyeReview.skyeyeReview);

// 读取类路由（公开，无需认证）
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/dev'));
app.use('/api', require('./routes/databases'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/receipt'));

// 开发者编号免配置登录路由
app.use('/api', require('./routes/auth'));

// 写入类路由（需认证 + 权限 + 审计）
app.use('/api', require('./routes/write'));

// 认知引导 + 工具列表路由
app.use('/api', require('./routes/onboarding'));

// 执行状态查询路由（需认证）
app.use('/api/execution', require('./routes/execution'));

// 部署授权流程路由（需认证）
app.use('/api/approval', require('./routes/approval'));

// 行业代表制路由（需认证）
app.use('/api', require('./routes/industry'));

// 根路由
app.get('/', function(_req, res) {
  res.json({
    status: 'ok',
    service: 'guanghu-api-server',
    version: '5.0.0',
    channel: 'B',
    description: '光湖后端中间层 · 语言驱动操作系统',
    capabilities: [
      'read', 'write', 'intent-routing', 'permission-sandbox',
      'onboarding', 'execution-guard', 'approval-flow', 'autonomy',
      'skyeye-review', 'identity-verification'
    ]
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '127.0.0.1', function() {
  console.log('🔗 光湖后端中间层启动 · 端口 ' + PORT);
  console.log('   通道B · 语言驱动操作系统 v5.0.0');
  console.log('   能力：读取 + 写入 + 意图路由 + 权限沙箱 + 认知引导 + 执行保护 + 授权流程 + 系统自治 + 天眼审核 + 身份验证');
  console.log('   监听地址：127.0.0.1:' + PORT + '（仅本机访问）');

  // 启动执行看门狗
  watchdog.startWatchdog();
});
