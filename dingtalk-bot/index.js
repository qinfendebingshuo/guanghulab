// HoloLake 钉钉开发者工作台 · 主服务
// Phase 1 + Phase 2 + Phase 3 完整版
// DEV-004 之之 × 秋秋

const express = require('express');
const fs = require('fs');
const path = require('path');

// === Phase 1 模块 ===
const syslogReceiver = require('./syslog-receiver');
const broadcastGenerator = require('./broadcast-generator');
const gitHelper = require('./git-helper');

// === Phase 2 模块 ===
const multiSheet = require('./data/multi-sheet');
const sheetUpdater = require('./data/sheet-updater');
const dingtalkBot = require('./dingtalk/bot');

// === Phase 3 新增模块 ===
const kb = require('./knowledge-base/kb-manager');
const githubWebhook = require('./webhook/github-webhook');
const hotReload = require('./webhook/hot-reload');
const syncEngine = require('./sync/sync-engine');
const cronJobs = require('./scheduler/cron-jobs');

const app = express();
const port = 3000;

// 中间件
app.use(express.json());

// ====== Phase 1 API路由 ======
app.post('/api/syslog', (req, res) => {
  const result = syslogReceiver.receive(req.body);
  res.json(result);
});

app.get('/api/broadcast/latest', (req, res) => {
  const latest = broadcastGenerator.getLatest();
  res.json(latest);
});

app.post('/api/git/commit', (req, res) => {
  const result = gitHelper.commit(req.body);
  res.json(result);
});

// ====== Phase 2 API路由 ======
app.get('/api/developers', (req, res) => {
  const data = multiSheet.getAll();
  res.json(data);
});

app.get('/api/developer/:devId', (req, res) => {
  const dev = multiSheet.getByDevId(req.params.devId);
  if (dev) {
    res.json(dev);
  } else {
    res.status(404).json({ error: '开发者不存在' });
  }
});

app.post('/api/sheet/update', (req, res) => {
  const result = sheetUpdater.updateFromSyslog(req.body);
  res.json(result);
});

app.post('/api/dingtalk/send', (req, res) => {
  const result = dingtalkBot.sendMessage(req.body);
  res.json(result);
});

// ====== Phase 3 API路由 ======

// --- 知识库API ---
app.get('/api/kb/search', (req, res) => {
  const query = req.query.q;
  if (!query) {
    return res.status(400).json({ error: '请提供搜索关键词 ?q=xxx' });
  }
  const results = kb.search(query);
  res.json({ query, resultCount: results.length, results });
});

app.get('/api/kb/stats', (req, res) => {
  res.json(kb.getStats());
});

app.post('/api/kb/reload', (req, res) => {
  kb.reload();
  res.json({ status: 'ok', message: '知识库已重新加载', stats: kb.getStats() });
});

// --- GitHub Webhook接收 ---
app.post('/api/webhook/github', (req, res) => {
  githubWebhook.handleWebhook(req, res);
});

// --- 热更新状态 ---
app.get('/api/hotreload/status', (req, res) => {
  res.json(hotReload.getStatus());
});

// --- 同步API ---
app.post('/api/sync/all', async (req, res) => {
  const result = await syncEngine.syncAll();
  res.json(result);
});

app.get('/api/sync/status', (req, res) => {
  res.json(syncEngine.getStatus());
});

// --- 提醒系统API ---
app.get('/api/reminder/status', (req, res) => {
  const reminder = require('./scheduler/reminder');
  res.json(reminder.getStatus());
});

app.get('/api/reminder/scan', (req, res) => {
  const reminder = require('./scheduler/reminder');
  const overdue = reminder.scanOverdue();
  res.json({ overdueCount: overdue.length, overdue });
});

// --- 定时任务API ---
app.get('/api/cron/status', (req, res) => {
  res.json(cronJobs.getStatus());
});

// --- Phase 3 系统总览 ---
app.get('/api/system/overview', (req, res) => {
  res.json({
    system: 'HoloLake M-DINGTALK',
    version: 'Phase 3',
    modules: {
      phase1: { status: 'active', features: ['SYSLOG接收', 'SYSLOG解析', '广播生成', '格式校验', 'Git提交'] },
      phase2: { status: 'active', features: ['多维表格', '自动更新引擎', '查询API', '钉钉消息集成', '数据看板'] },
      phase3: { status: 'active', features: ['知识库', 'GitHub Webhook', '规则热更新', '三节点同步', '超时提醒'] }
    },
    knowledgeBase: kb.getStats(),
    hotReload: hotReload.getStatus(),
    sync: syncEngine.getStatus(),
    cron: cronJobs.getStatus()
  });
});

// 启动服务
app.listen(port, () => {
  console.log(`🚀 服务已启动在 http://localhost:${port}`);
  console.log('\n=== Phase 3 初始化中... ===');
  
  // 1. 建立知识库索引
  kb.buildIndex();
  
  // 2. 加载规则配置
  hotReload.loadRules();
  
  // 3. 注册Webhook事件处理器
  githubWebhook.on('push', hotReload.handleRulesUpdate);
  githubWebhook.on('*', (data, log) => {
    console.log(`[System] GitHub事件已记录: ${log.event}`);
  });
  
  // 4. 启动定时任务
  cronJobs.startAll();
  
  console.log('=== Phase 3 初始化完成 ===\n');
});
