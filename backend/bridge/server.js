const express = require('express');
const fs = require('fs-extra');
const moment = require('moment');
const path = require('path');
const config = require('./config.json');
const http = require('http');

// 初始化Express应用
const app = express();
const startTime = moment();
let eventsProcessed = 0;
let lastEventTime = null;

// 确保事件日志文件存在
if (!fs.existsSync(config.eventLogFile)) {
  fs.writeJSONSync(config.eventLogFile, [], { spaces: 2 });
}

// 👉 事件日志自动清理（验收项1-6）
const cleanOldEvents = () => {
  const events = fs.readJSONSync(config.eventLogFile);
  const thirtyDaysAgo = moment().subtract(config.eventRetainDays, 'days').valueOf();
  const filteredEvents = events.filter(event => moment(event.timestamp).valueOf() >= thirtyDaysAgo);
  fs.writeJSONSync(config.eventLogFile, filteredEvents, { spaces: 2 });
  console.log(`📝 自动清理完成：保留近${config.eventRetainDays}天事件，共${filteredEvents.length}条`);
  eventsProcessed = filteredEvents.length;
  lastEventTime = filteredEvents.length > 0 ? filteredEvents[filteredEvents.length - 1].timestamp : null;
};
cleanOldEvents();

// 👉 验收项0-4：请求日志中间件
app.use((req, res, next) => {
  const now = moment().format('YYYY-MM-DD HH:mm:ss');
  const { method, originalUrl } = req;
  res.on('finish', () => {
    const statusCode = res.statusCode;
    console.log(`[${now}] ${method} ${originalUrl} - ${statusCode}`);
  });
  next();
});

// 解析JSON请求体
app.use(express.json({ limit: '1mb' }));

// 👉 验收项0-2：根路径GET / 模块身份接口
app.get('/', (req, res) => {
  const uptime = moment.duration(moment().diff(startTime)).humanize();
  res.json({
    module: config.module,
    version: config.version,
    uptime: uptime,
    status: "running",
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
  });
});

// ────────────────────────────────────────────────────
// 👉 环节1：Webhook接收端点
// ────────────────────────────────────────────────────
app.post('/bridge/webhook/github', (req, res) => {
  try {
    const eventType = req.headers['x-github-event'];
    const validEventTypes = ['push', 'pull_request', 'workflow_run'];
    if (!validEventTypes.includes(eventType)) {
      return res.status(400).json({
        received: false,
        error: '无效的事件类型',
        valid_types: validEventTypes,
        timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
      });
    }
    const payload = req.body;
    const eventId = `GH-${moment().format('YYYYMMDDHHmmssSSS')}`;
    const eventSummary = eventType === 'push' ? `推送至${payload.ref || '未知分支'}` : eventType === 'pull_request' ? `PR #${payload.number || '未知编号'}: ${payload.action || '未知动作'}` : `流水线${payload.workflow_run?.id || '未知ID'}: ${payload.action || '未知动作'}`;
    const events = fs.readJSONSync(config.eventLogFile);
    const newEvent = { event_id: eventId, event_type: 'github', sub_type: eventType, source: 'github_webhook', summary: eventSummary, timestamp: moment().format('YYYY-MM-DD HH:mm:ss'), raw_payload: payload };
    events.push(newEvent);
    fs.writeJSONSync(config.eventLogFile, events, { spaces: 2 });
    eventsProcessed++;
    lastEventTime = newEvent.timestamp;
    res.json({ received: true, event_type: eventType, event_id: eventId, timestamp: newEvent.timestamp, summary: eventSummary });
  } catch (error) {
    console.error(`❌ GitHub Webhook处理失败：${error.message}`);
    res.status(500).json({ received: false, error: '服务器内部错误', timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
  }
});

app.post('/bridge/webhook/syslog', (req, res) => {
  try {
    const payload = req.body;
    const requiredFields = ['dev_id', 'broadcast_id', 'status'];
    const missingFields = requiredFields.filter(field => !payload[field]);
    if (missingFields.length > 0) {
      return res.status(400).json({ received: false, error: '缺少必传字段', missing_fields: missingFields, required_fields: requiredFields, timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
    }
    const validStatus = ['completed', 'partial', 'blocked'];
    if (!validStatus.includes(payload.status)) {
      return res.status(400).json({ received: false, error: '无效的状态值', valid_status: validStatus, timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
    }
    const syslogId = `SL-${moment().format('YYYYMMDDHHmmssSSS')}`;
    const events = fs.readJSONSync(config.eventLogFile);
    const newEvent = { event_id: syslogId, event_type: 'syslog', source: 'syslog_webhook', dev_id: payload.dev_id, broadcast_id: payload.broadcast_id, status: payload.status, summary: payload.summary || '无摘要', timestamp: moment().format('YYYY-MM-DD HH:mm:ss'), raw_payload: payload };
    events.push(newEvent);
    fs.writeJSONSync(config.eventLogFile, events, { spaces: 2 });
    eventsProcessed++;
    lastEventTime = newEvent.timestamp;
    res.json({ received: true, syslog_id: syslogId, dev_id: payload.dev_id, broadcast_id: payload.broadcast_id, status: payload.status, timestamp: newEvent.timestamp });
  } catch (error) {
    console.error(`❌ SYSLOG Webhook处理失败：${error.message}`);
    res.status(500).json({ received: false, error: '服务器内部错误', timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
  }
});

// ────────────────────────────────────────────────────
// 👉 环节2：状态聚合+健康检查接口（100%确保存在）
// ────────────────────────────────────────────────────
app.get('/bridge/status', (req, res) => {
  const uptimeSeconds = moment().diff(startTime, 'seconds');
  res.json({
    module: config.module,
    version: config.version,
    uptime_seconds: uptimeSeconds,
    events_processed: eventsProcessed,
    last_event: lastEventTime || '无',
    status: "running",
    timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
  });
});

const checkNodeHealth = (node) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const timeout = config.nodeTimeout || 3000;
    const req = http.get(node.url, (res) => {
      const responseMs = Date.now() - start;
      resolve({ name: node.name, url: node.url, type: node.type, status: "online", response_ms: responseMs });
    });
    req.on('error', () => {
      const responseMs = Date.now() - start;
      resolve({ name: node.name, url: node.url, type: node.type, status: "offline", response_ms: responseMs });
    });
    req.setTimeout(timeout, () => {
      const responseMs = Date.now() - start;
      req.abort();
      resolve({ name: node.name, url: node.url, type: node.type, status: "timeout", response_ms: responseMs });
    });
  });
};

app.get('/bridge/nodes', async (req, res) => {
  try {
    const nodes = config.nodes || [];
    const nodeStatuses = await Promise.all(nodes.map(checkNodeHealth));
    res.json({
      nodes: nodeStatuses,
      checked_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      total_nodes: nodes.length,
      online_count: nodeStatuses.filter(n => n.status === "online").length,
      timeout_count: nodeStatuses.filter(n => n.status === "timeout").length,
      offline_count: nodeStatuses.filter(n => n.status === "offline").length
    });
  } catch (error) {
    console.error(`❌ 节点健康探测失败：${error.message}`);
    res.status(500).json({ error: '节点健康探测失败', timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
  }
});

app.get('/bridge/events', (req, res) => {
  try {
    const events = fs.readJSONSync(config.eventLogFile);
    const filterType = req.query.type;
    const filteredEvents = filterType ? events.filter(event => event.event_type === filterType) : [...events];
    const limit = parseInt(req.query.limit) || 50;
    const resultEvents = filteredEvents.sort((a, b) => moment(b.timestamp).diff(moment(a.timestamp))).slice(0, limit);
    res.json({
      events: resultEvents,
      total: events.length,
      filtered: filteredEvents.length,
      returned: resultEvents.length,
      filter_type: filterType || 'all',
      limit: limit,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    });
  } catch (error) {
    console.error(`❌ 事件日志查询失败：${error.message}`);
    res.status(500).json({ error: '事件日志查询失败', timestamp: moment().format('YYYY-MM-DD HH:mm:ss') });
  }
});

// 启动服务
const server = app.listen(config.port, () => {
  console.log(`✅ M-BRIDGE中继桥接服务启动成功`);
  console.log(`📡 监听端口：${config.port} | 访问地址：http://localhost:${config.port}`);
  console.log(`🔗 核心接口列表：`);
  console.log(`  - 模块身份：GET http://localhost:${config.port}/`);
  console.log(`  - 服务状态：GET http://localhost:${config.port}/bridge/status`);
  console.log(`  - 节点状态：GET http://localhost:${config.port}/bridge/nodes`);
  console.log(`  - 事件查询：GET http://localhost:${config.port}/bridge/events`);
  console.log(`  - GitHub Webhook：POST http://localhost:${config.port}/bridge/webhook/github`);
  console.log(`  - SYSLOG Webhook：POST http://localhost:${config.port}/bridge/webhook/syslog`);
});

global.MBRIDGE = { app, config, startTime, eventsProcessed, lastEventTime, fs, moment, path };
module.exports = { app, server };
