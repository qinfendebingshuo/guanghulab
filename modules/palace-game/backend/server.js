/**
 * M-PALACE · Express 主服务
 * 动态人格宫廷生成系统 · 后端核心
 *
 * API 路由：
 *   POST /api/palace/start     → 快速启动（生成世界）
 *   POST /api/palace/interact  → 玩家互动（剧情推进）
 *   POST /api/palace/save      → 存档
 *   POST /api/palace/load      → 读档
 *   GET  /api/palace/saves     → 存档列表
 *   GET  /api/palace/health    → 健康检查
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const startRoutes = require('./routes/start');
const interactRoutes = require('./routes/interact');
const saveRoutes = require('./routes/save');

const app = express();
const PORT = process.env.PALACE_PORT || 3003;

// 中间件
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 静态文件：前端
app.use('/palace-game', express.static(path.join(__dirname, '..', 'frontend')));

// API 路由
app.use('/api/palace/start', startRoutes);
app.use('/api/palace/interact', interactRoutes);
app.use('/api/palace/save', saveRoutes);

// 健康检查
app.get('/api/palace/health', function (_req, res) {
  res.json({
    status: 'ok',
    service: 'palace-game',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 根路由 → 前端入口
app.get('/', function (_req, res) {
  res.redirect('/palace-game/index.html');
});

// 启动服务
if (require.main === module) {
  app.listen(PORT, function () {
    console.log('🏯 M-PALACE · 宫廷纪服务启动 · 端口 ' + PORT);
  });
}

module.exports = app;
