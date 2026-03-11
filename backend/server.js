require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 路由引入
const notionRoutes = require('./routes/notion');
const feishuRoutes = require('./routes/feishu');
const routerRoutes = require('./routes/router');
const coldstartRoutes = require('./routes/coldstart');
const hliRoutes = require('../src/routes/hli');

app.use('/notion', notionRoutes);
app.use('/feishu', feishuRoutes);
app.use('/router', routerRoutes);
app.use('/api/coldstart', coldstartRoutes);
app.use('/hli', hliRoutes);

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'HoloLake 后端服务运行中',
    version: '0.2.0',
    routes: ['/notion/test', '/feishu/test', '/router/test', '/router/chat', '/api/coldstart', '/hli/test']
  });
});

const PORT = process.env.PORT || 3000;
// 飞书 Webhook 处理
app.post('/webhook/feishu', (req, res) => {
  console.log('收到飞书请求:', req.body);
  if (req.body.challenge) {
    return res.json({ challenge: req.body.challenge });
  }
  res.json({ message: 'received' });
});
app.listen(PORT, () => {
  console.log(`🚀 服务启动成功，端口：${PORT}`);
});

// 挂载看板 API
const dashboardApi = require('./routes/dashboard-api');
app.use('/api/dashboard', dashboardApi);

// 挂载 SYSLOG API
const syslogApi = require('./routes/syslog-api');
app.use('/api/syslog', syslogApi);
