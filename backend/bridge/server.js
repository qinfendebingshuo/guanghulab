const express = require('express');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');
const config = require('./config.json');

// 初始化Express应用
const app = express();
// 记录服务启动时间
const startTime = moment();
// 统计已处理事件数和最后一次事件时间
let eventsProcessed = 0;
let lastEventTime = null;

// 确保事件日志文件存在，不存在则创建空数组
if (!fs.existsSync(config.eventLogFile)) {
  fs.writeJSONSync(config.eventLogFile, [], { spaces: 2 });
}

// 👉 验收项0-4：请求日志中间件 - 记录所有请求的时间/方法/路径/状态码
app.use((req, res, next) => {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const { method, originalUrl } = req;
  // 响应完成后在终端输出格式化日志
  res.on('finish', () => {
    const statusCode = res.statusCode;
    console.log(`[${now}] ${method} ${originalUrl} - ${statusCode}`);
  });
  next();
});

// 解析JSON请求体，支持最大1MB的请求数据
app.use(express.json({ limit: '1mb' }));

// 👉 验收项0-2：根路径GET / - 返回模块身份信息JSON
app.get('/', (req, res) => {
  // 计算服务运行时长
  const uptime = moment.duration(moment().diff(startTime)).humanize();
  res.json({
    module: config.module,
    version: config.version,
    uptime: uptime,
    status: "running",
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
  });
});

// 👉 验收项0-1：启动服务，监听配置文件中的3020端口
const server = app.listen(config.port, () => {
  console.log(`✅ M-BRIDGE中继桥接服务启动成功`);
  console.log(`📡 监听端口：${config.port} | 访问地址：http://localhost:${config.port}`);
});

// 暴露全局变量，供后续环节1/2的接口使用
global.MBRIDGE = {
  app,
  config,
  startTime,
  eventsProcessed,
  lastEventTime,
  fs,
  moment,
  path
};

// 导出应用和服务，支持后续扩展
module.exports = { app, server };
