// src/index.js
// HoloLake (光湖) 后端服务入口

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

app.use(express.json());

// 健康检查（CI smoke test 依赖此端点）
app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: NODE_ENV, timestamp: new Date().toISOString() });
});

// HLI 路由挂载
const hliRouter = require('./routes/hli');
app.use('/hli', hliRouter);

app.listen(PORT, () => {
  console.log(`[HoloLake] Server running on port ${PORT} (${NODE_ENV})`);
});

module.exports = app;
