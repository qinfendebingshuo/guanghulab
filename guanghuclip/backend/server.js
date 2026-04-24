/**
 * 光湖短视频工作台 · API Server
 * Express + Socket.IO
 *
 * 霜砚出品 · AG-SY-WEB-001
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
const server = http.createServer(app);

// ── CORS ────────────────────────────────────────────
app.use(cors({ origin: config.corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));

// ── Socket.IO ───────────────────────────────────────
const io = new Server(server, {
  cors: { origin: config.corsOrigins, credentials: true },
  pingTimeout: 60000,
});
app.set('io', io);

// ── 静态文件 (生产环境) ──────────────────────────────
const distPath = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(distPath));

// ── API 路由 ────────────────────────────────────────
app.use('/api/video', require('./routes/video'));

// 健康检查
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'guanghuclip-api',
    version: '1.0.0-p0',
    timestamp: new Date().toISOString(),
    jimengConfigured: !!config.jimeng.apiKey,
  });
});

// ── SPA 回退 (生产环境) ─────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Socket.IO 事件 ──────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] 连接: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[Socket] 断开: ${socket.id}`);
  });
});

// ── 启动 ────────────────────────────────────────────
server.listen(config.port, () => {
  console.log('');
  console.log('  🎬 光湖短视频工作台 API');
  console.log(`  ── 端口: ${config.port}`);
  console.log(`  ── 时间: ${new Date().toISOString()}`);
  console.log(`  ── 即梦: ${config.jimeng.apiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  ── 模型: ${config.jimeng.model}`);
  console.log('');
});
