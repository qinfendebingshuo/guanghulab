/**
 * persona-brain-db · API服务入口
 * 端口：3001（与后端3000不冲突）
 * 启动：node server.js
 */

const express = require('express');
const path = require('path');
const sqlite3 = require('better-sqlite3');

const identityRoutes = require('./routes/identity');
const cognitionRoutes = require('./routes/cognition');
const memoryRoutes = require('./routes/memory');
const profilesRoutes = require('./routes/profiles');
const agentsRoutes = require('./routes/agents');
const authMiddleware = require('./middleware/auth');

const DB_PATH = path.join(__dirname, '..', 'brain.db');
const PORT = process.env.BRAIN_API_PORT || 3001;

const app = express();
app.use(express.json());

// 注入数据库连接
let db;
try {
  db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  console.error(`❌ 无法打开数据库: ${DB_PATH}`);
  console.error('   请先执行建表和导入种子数据');
  process.exit(1);
}

app.use((req, _res, next) => {
  req.db = db;
  next();
});

// 健康检查（无鉴权）
app.get('/brain/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'persona-brain-db',
    timestamp: new Date().toISOString()
  });
});

// 需要鉴权的路由
app.use('/brain/identity', authMiddleware, identityRoutes);
app.use('/brain/cognition', authMiddleware, cognitionRoutes);
app.use('/brain/memory', authMiddleware, memoryRoutes);
app.use('/brain/profiles', authMiddleware, profilesRoutes);
app.use('/brain/agents', authMiddleware, agentsRoutes);

// 全局错误处理
app.use((err, _req, res, _next) => {
  console.error('Server error:', err.message);
  res.status(500).json({ error: true, message: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🧠 persona-brain-db API 启动成功，端口：${PORT}`);
});

module.exports = app;
