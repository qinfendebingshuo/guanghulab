/**
 * 🗼 光湖短视频工作台 · API Server
 * Express + Socket.IO + 光湖灯塔系统层
 *
 * 架构：
 * 用户消息 → 灯塔加载 → 人格体注入 → 工具清单 → 对话记忆 → LLM → 工具执行(灯塔监管) → 双向展示
 *
 * 霜砚出品 · AG-SY-WEB-001
 */
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const config = require('./config');
const { initializeTools } = require('./services/tool-init');

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

// ── 🗼 灯塔系统初始化 ───────────────────────────────
console.log('[🗼 灯塔] 正在初始化光湖灯塔系统层...');
initializeTools();
console.log('[🗼 灯塔] 光湖灯塔系统层就绪');

// ── API 路由 ────────────────────────────────────────
app.use('/api/video', require('./routes/video'));
app.use('/api/chat', require('./routes/chat'));

// 健康检查
app.get('/api/health', (_req, res) => {
  const llmClient = require('./services/llm-client');
  res.json({
    status: 'ok',
    service: 'guanghuclip-api',
    version: '2.0.0-lighthouse',
    lighthouse: '🗼 active',
    timestamp: new Date().toISOString(),
    jimengConfigured: !!config.jimeng.apiKey,
    llm: llmClient.getStatus(),
  });
});

// ── SPA 回退 (生产环境) ─────────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

// ── Socket.IO 事件 ──────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[Socket] 连接: ${socket.id}`);
  
  // 客户端可以通过Socket发消息
  socket.on('chat:send', async (data) => {
    const { message, userId = socket.id, personaId = 'default' } = data;
    if (!message) return;
    
    try {
      const sessionOrchestrator = require('./services/session-orchestrator');
      const result = await sessionOrchestrator.handleMessage(userId, message, personaId, io);
      
      socket.emit('chat:reply', {
        userId,
        persona: result.persona,
        reply: result.reply,
        toolCalls: result.toolCalls,
        duration: result.duration,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      socket.emit('chat:error', { error: err.message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log(`[Socket] 断开: ${socket.id}`);
  });
});

// ── 启动 ────────────────────────────────────────────
server.listen(config.port, () => {
  const llmClient = require('./services/llm-client');
  const toolExecutor = require('./services/tool-executor');
  
  console.log('');
  console.log('  🗼 光湖灯塔 · 短视频工作台 API v2.0');
  console.log(`  ── 端口: ${config.port}`);
  console.log(`  ── 时间: ${new Date().toISOString()}`);
  console.log(`  ── 即梦: ${config.jimeng.apiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  ── LLM:  ${llmClient.getActiveModel()?.name || '❌ 未配置'}`);
  console.log(`  ── 工具: ${toolExecutor.getToolList().length} 个已注册`);
  console.log(`  ── 灯塔: 🗼 已激活`);
  console.log('');
});
