/**
 * 光湖短视频工作台 · 后端入口
 * Express + Socket.IO
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: config.corsOrigins, methods: ['GET', 'POST'] },
});

// 中间件
app.use(cors({ origin: config.corsOrigins }));
app.use(express.json({ limit: '10mb' }));

// 将 io 实例挂到 app 上，供路由使用
app.set('io', io);

// ── 路由 ────────────────────────────────────────────
const videoRoutes = require('./routes/video');
const chatRoutes = require('./routes/chat');

app.use('/api/video', videoRoutes);
app.use('/api/chat', chatRoutes);

// ── 静态文件 ────────────────────────────────────────
const frontendDist = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// SPA 回退
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(frontendDist, 'index.html'));
  }
});

// ── Socket.IO 连接 ──────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[WS] 客户端连接: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`[WS] 客户端断开: ${socket.id}`);
  });
});

// ── 启动 ────────────────────────────────────────────
server.listen(config.port, '0.0.0.0', () => {
  console.log(``);
  console.log(`  🌊 光湖短视频工作台 已启动`);
  console.log(`  📡 端口: ${config.port}`);
  console.log(`  🎬 视频API: /api/video/*`);
  console.log(`  🤖 聊天API: /api/chat/*`);
  console.log(`  🔗 CORS: ${config.corsOrigins.join(', ')}`);
  console.log(``);

  // 检查大模型配置
  const llmClient = require('./services/llm-client');
  const models = llmClient.getAvailableModels().filter(m => m.available);
  console.log(`  🧠 可用大模型: ${models.map(m => m.name).join(' / ') || '❌ 无 (请配置API Key)'}`);

  // 检查 Notion 配置
  if (config.notion.token) {
    console.log(`  📝 Notion桥接: ✅ 已配置`);
  } else {
    console.log(`  📝 Notion桥接: ⬜ 未配置 (ZY_NOTION_TOKEN)`);
  }
  console.log(``);
});
