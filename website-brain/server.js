/**
 * 光湖网站总大脑 · L4 自研数据库引擎
 * Phase 1 骨架 · Express 入口
 *
 * 端口: 4000 (默认)
 * 架构: AGE OS · 五层架构 L4 层
 */
const express = require('express');
const app = express();

const PORT = process.env.WEBSITE_BRAIN_PORT || 4000;

// 中间件
app.use(express.json());

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'website-brain',
    version: '0.1.0',
    phase: 'Phase 1 · 骨架期',
    layer: 'L4 · 网站总大脑',
    system_node: 'GLW-SYS-0001',
    timestamp: new Date().toISOString()
  });
});

// API 路由挂载
app.use('/api/pages', require('./api/pages'));
app.use('/api/databases', require('./api/databases'));
app.use('/api/modules', require('./api/modules'));
app.use('/api/persona-state', require('./api/persona-state'));

// 404 处理
app.use((req, res) => {
  res.status(404).json({
    error: true,
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`
  });
});

// 启动（仅在直接运行时）
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[website-brain] L4 网站总大脑启动 · 端口 ${PORT} · Phase 1 骨架`);
  });
}

module.exports = app;
