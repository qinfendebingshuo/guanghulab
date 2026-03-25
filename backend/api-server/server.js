/**
 * 🔗 光湖后端中间层 · 通道B 入口
 *
 * 实时调用 Notion API / GitHub API，为前端提供数据代理。
 * 包含：读取层 + 写入层 + 意图路由 + 权限沙箱 + 认知引导
 * 只监听 127.0.0.1，通过 Nginx 反向代理对外暴露。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const express = require('express');
const cors = require('cors');

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

// 读取类路由（公开，无需认证）
app.use('/api', require('./routes/health'));
app.use('/api', require('./routes/dev'));
app.use('/api', require('./routes/databases'));
app.use('/api', require('./routes/chat'));
app.use('/api', require('./routes/receipt'));

// 写入类路由（需认证 + 权限 + 审计）
app.use('/api', require('./routes/write'));

// 认知引导 + 工具列表路由
app.use('/api', require('./routes/onboarding'));

// 根路由
app.get('/', function(_req, res) {
  res.json({
    status: 'ok',
    service: 'guanghu-api-server',
    version: '2.0.0',
    channel: 'B',
    description: '光湖后端中间层 · 语言驱动操作系统',
    capabilities: ['read', 'write', 'intent-routing', 'permission-sandbox', 'onboarding']
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, '127.0.0.1', function() {
  console.log('🔗 光湖后端中间层启动 · 端口 ' + PORT);
  console.log('   通道B · 语言驱动操作系统');
  console.log('   能力：读取 + 写入 + 意图路由 + 权限沙箱 + 认知引导');
  console.log('   监听地址：127.0.0.1:' + PORT + '（仅本机访问）');
});
