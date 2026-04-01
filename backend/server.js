require('dotenv').config();
const express = require('express');
const cors = require('cors');

// ─── 语言膜 · Language Membrane ───
// 光湖语言世界最外层 · 完整的圆 · 没有缺口
const membrane = require('../src/membrane');

const app = express();
app.use(cors());
app.use(express.json());

// ─── 语言膜网关（最外层中间件 · 所有请求必须经过） ───
app.use(membrane.gateway.createGateway());

// ─── 语言膜状态接口 ───
app.get('/api/membrane/status', (req, res) => {
  res.json(membrane.getStatus());
});

// ─── 冰朔人格模块状态 ───
app.get('/api/membrane/bingshuo', (req, res) => {
  res.json(membrane.bingshuoModule.getStatus());
});

// ─── 动态权限统计 ───
app.get('/api/membrane/permissions', (req, res) => {
  res.json(membrane.permissionEngine.getStats());
});

// ─── 行业模块列表 ───
app.get('/api/membrane/modules', (req, res) => {
  res.json({
    active: membrane.moduleRegistry.listActiveModules(),
    all: membrane.moduleRegistry.listAllModules(),
  });
});

// ─── 人格体房间列表 ───
app.get('/api/membrane/rooms', (req, res) => {
  const rooms = membrane.roomManager.listRooms();
  res.json({
    count: rooms.length,
    rooms: rooms.map(id => membrane.roomManager.getRoomStatus(id) || { persona_id: id }),
  });
});

// 路由引入
const notionRoutes = require('./routes/notion');
const feishuRoutes = require('./routes/feishu');
const feishuBotRoutes = require('./routes/feishu-bot');
const routerRoutes = require('./routes/router');
const coldstartRoutes = require('./routes/coldstart');
const developersRoutes = require('./routes/developers');
const hliRoutes = require('../src/routes/hli');

app.use('/notion', notionRoutes);
app.use('/feishu', feishuRoutes);
app.use('/feishu-bot', feishuBotRoutes);
app.use('/router', routerRoutes);
app.use('/api/coldstart', coldstartRoutes);
app.use('/api/v1/developers', developersRoutes);
app.use('/hli', hliRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: '光湖语言世界 · HoloLake Language World',
    version: '0.3.0',
    membrane: membrane.MEMBRANE_VERSION,
    architecture: '语言膜 · 完整的圆 · 没有缺口',
    copyright: '国作登字-2026-A-00037559',
    routes: ['/api/membrane/status', '/api/membrane/bingshuo', '/api/membrane/modules', '/api/membrane/rooms', '/hli/test']
  });
});

// Pipeline C 广播推送 webhook → 转发到 feishu-bot 路由
app.post('/webhook/push-broadcast', (req, res, next) => {
  req.url = '/push-broadcast';
  feishuBotRoutes(req, res, next);
});

const PORT = process.env.PORT || 3000;
// 飞书 Webhook 处理（旧版兼容入口，新事件请使用 /feishu-bot/event）
app.post('/webhook/feishu', (req, res) => {
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }
  res.json({ message: 'received' });
});
app.listen(PORT, () => {
  console.log(`🚀 服务启动成功，端口：${PORT}`);
});
