require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const buildRoutes = require('./routes/build');
const notifyRoutes = require('./routes/notify');
const apikeyRoutes = require('./routes/apikey');
const previewRoutes = require('./routes/preview');

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
app.use('/api/ps/apikey', apikeyRoutes);

// ── 健康检查 ──
// ── 健康检查 ──app.use('/api/ps/preview', previewRoutes);
app.use('/api/dashboard', require('./routes/dashboard-api'));

// ── 健康检查 ──
app.get('/api/ps/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'persona-studio',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 兼容 /api/health 路径
app.get('/api/health', (_req, res) => {
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
    version: '2.0.0',
    routes: [
      '/api/ps/auth/login',
      '/api/ps/chat/message',
      '/api/ps/chat/history',
      '/api/ps/build/start',
      '/api/ps/notify/send',
      '/api/ps/apikey/detect-models',
      '/api/ps/apikey/chat',
      '/api/ps/preview/:devId/:project',
      '/api/ps/health'
    ]
  });
});

const PORT = process.env.PS_PORT || 3002;

// ── WebSocket 服务（预览进度推送） ──
const server = http.createServer(app);

// WebSocket clients map: dev_id -> Set<ws>
const wsClients = new Map();

try {
  const WebSocket = require('ws');
  const wss = new WebSocket.Server({ server, path: '/ws/preview' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const devId = url.searchParams.get('dev_id') || 'unknown';

    if (!wsClients.has(devId)) {
      wsClients.set(devId, new Set());
    }
    wsClients.get(devId).add(ws);

    ws.on('close', () => {
      const clients = wsClients.get(devId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(devId);
      }
    });

    ws.on('error', () => {
      const clients = wsClients.get(devId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) wsClients.delete(devId);
      }
    });
  });

  // Export broadcast function for other modules
  app.locals.broadcastToClient = function (devId, data) {
    const clients = wsClients.get(devId);
    if (!clients) return;
    const msg = typeof data === 'string' ? data : JSON.stringify(data);
    clients.forEach(function (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  };
} catch (_e) {
  // ws module not installed, WebSocket disabled
  console.warn('[Persona Studio] ws module not available, WebSocket features disabled');
  app.locals.broadcastToClient = function () {};
}

server.listen(PORT, () => {
  console.log(`🌊 Persona Studio 后端服务启动 · 端口 ${PORT}`);
});

module.exports = app;
