/**
 * /api/databases/:name — 获取数据库数据路由
 * /api/syslogs           — 获取最近 SYSLOG
 * /api/agents            — 获取 Agent 注册表
 * /api/tickets           — 获取活跃工单
 * /api/repo/status       — 获取仓库状态
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var notionService = require('../services/notion');
var githubService = require('../services/github');
var dbConfig = require('../config/databases');

// 通用数据库查询
router.get('/databases/:name', async function(req, res) {
  var name = req.params.name;

  var dbMap = {
    'agent-registry': dbConfig.agentRegistry,
    'syslog-recent': dbConfig.syslogInbox,
    'tickets-active': dbConfig.ticketBook,
    'maintenance-log': dbConfig.maintenanceLog,
    'receipt-tracker': dbConfig.receiptTracker
  };

  var dbId = dbMap[name];
  if (!dbId) {
    return res.status(404).json({
      error: true,
      code: 'DB_NOT_FOUND',
      message: '数据库不存在或未配置: ' + name
    });
  }

  try {
    var sorts = null;
    var filter = null;
    var pageSize = 50;

    // 不同数据库有不同的默认排序和筛选
    if (name === 'syslog-recent') {
      sorts = [{ property: 'Created time', direction: 'descending' }];
    } else if (name === 'tickets-active') {
      filter = { property: '状态', select: { does_not_equal: '已完成' } };
      sorts = [{ property: 'Created time', direction: 'descending' }];
    } else if (name === 'maintenance-log') {
      sorts = [{ property: 'Created time', direction: 'descending' }];
      pageSize = 20;
    }

    var result = await notionService.queryDB(dbId, filter, sorts, pageSize);
    res.json({
      synced: new Date().toISOString(),
      count: result.results ? result.results.length : 0,
      data: result.results || [],
      _source: 'realtime'
    });
  } catch (err) {
    console.error('[/api/databases/' + name + '] Error:', err.message);
    res.status(500).json({
      error: true,
      code: 'QUERY_FAILED',
      message: '数据库查询失败: ' + err.message
    });
  }
});

// 快捷路由：最近 SYSLOG
router.get('/syslogs', async function(_req, res) {
  if (!dbConfig.syslogInbox) {
    return res.status(404).json({ error: true, code: 'DB_NOT_CONFIGURED', message: 'SYSLOG 数据库未配置' });
  }
  try {
    var result = await notionService.queryDB(dbConfig.syslogInbox, null,
      [{ property: 'Created time', direction: 'descending' }], 50);
    res.json({
      synced: new Date().toISOString(),
      count: result.results ? result.results.length : 0,
      data: result.results || [],
      _source: 'realtime'
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'QUERY_FAILED', message: err.message });
  }
});

// 快捷路由：Agent 注册表
router.get('/agents', async function(_req, res) {
  if (!dbConfig.agentRegistry) {
    return res.status(404).json({ error: true, code: 'DB_NOT_CONFIGURED', message: 'Agent 注册表未配置' });
  }
  try {
    var result = await notionService.queryDB(dbConfig.agentRegistry, null, null, 100);
    res.json({
      synced: new Date().toISOString(),
      count: result.results ? result.results.length : 0,
      data: result.results || [],
      _source: 'realtime'
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'QUERY_FAILED', message: err.message });
  }
});

// 快捷路由：活跃工单
router.get('/tickets', async function(_req, res) {
  if (!dbConfig.ticketBook) {
    return res.status(404).json({ error: true, code: 'DB_NOT_CONFIGURED', message: '工单簿未配置' });
  }
  try {
    var result = await notionService.queryDB(dbConfig.ticketBook,
      { property: '状态', select: { does_not_equal: '已完成' } },
      [{ property: 'Created time', direction: 'descending' }], 50);
    res.json({
      synced: new Date().toISOString(),
      count: result.results ? result.results.length : 0,
      data: result.results || [],
      _source: 'realtime'
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'QUERY_FAILED', message: err.message });
  }
});

// 仓库状态（GitHub API）
router.get('/repo/status', async function(_req, res) {
  try {
    var status = await githubService.getRepoStatus('guanghulab');
    var commits = await githubService.getRecentCommits('guanghulab', 5);
    var workflows = await githubService.getWorkflowRuns('guanghulab', 5);
    res.json({
      repo: status,
      recent_commits: commits,
      recent_workflows: workflows,
      _source: 'realtime',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'GITHUB_ERROR', message: err.message });
  }
});

module.exports = router;
