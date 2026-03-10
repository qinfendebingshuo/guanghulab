require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const buildRoutes = require('./routes/build');
const notifyRoutes = require('./routes/notify');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// ── 静态文件：persona-studio 前端 ──
app.use('/persona-studio', express.static(path.join(__dirname, '..', 'frontend')));

// ── API 路由（统一前缀 /api/ps）──
app.use('/api/ps/auth', authRoutes);
app.use('/api/ps/chat', chatRoutes);
app.use('/api/ps/build', buildRoutes);
app.use('/api/ps/notify', notifyRoutes);

// ── 健康检查 ──
app.get('/api/ps/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'persona-studio',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ── 根路由 ──
app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'Persona Studio 后端服务运行中',
    version: '1.0.0',
    routes: [
      '/api/ps/auth/login',
      '/api/ps/chat/message',
      '/api/ps/chat/history',
      '/api/ps/build/start',
      '/api/ps/notify/send',
      '/api/ps/health'
    ]
  });
});

const PORT = process.env.PS_PORT || 3002;

app.listen(PORT, () => {
  console.log(`🌊 Persona Studio 后端服务启动 · 端口 ${PORT}`);
});

module.exports = app;
