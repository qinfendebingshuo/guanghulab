/**
 * /api/chat/context — 组装 system prompt 路由
 *
 * 聚合所有数据源，返回增强版 system prompt 片段。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var notionService = require('../services/notion');
var dbConfig = require('../config/databases');

router.post('/chat/context', async function(req, res) {
  var devId = req.body.dev_id;

  if (!devId || !/^DEV-\d{3}$/.test(devId)) {
    return res.status(400).json({
      error: true,
      code: 'INVALID_DEV_ID',
      message: '需要有效的 dev_id 参数'
    });
  }

  var context = {
    dev_id: devId,
    profile: null,
    agents_count: 0,
    syslogs_count: 0,
    tickets_count: 0,
    _source: 'realtime',
    timestamp: new Date().toISOString()
  };

  // 获取开发者画像
  try {
    if (dbConfig.controlPanel) {
      var controlPanel = await notionService.queryDB(dbConfig.controlPanel, {
        property: 'DEV编号',
        rich_text: { equals: devId }
      }, null, 1);
      if (controlPanel.results && controlPanel.results.length > 0) {
        var props = controlPanel.results[0].properties || {};
        context.profile = {
          broadcast_id: notionService.extractRichText(props['广播编号']) || '',
          broadcast_title: notionService.extractRichText(props['广播标题']) || notionService.extractTitle(props) || '',
          current_ring: notionService.extractNumber(props['当前环节']) || 0,
          status: notionService.extractRichText(props['状态']) || notionService.extractSelect(props['状态']) || ''
        };
      }
    }
  } catch (_) {}

  // 获取 Agent 注册表计数
  try {
    if (dbConfig.agentRegistry) {
      var agents = await notionService.queryDB(dbConfig.agentRegistry, null, null, 100);
      context.agents_count = agents.results ? agents.results.length : 0;
    }
  } catch (_) {}

  // 获取 SYSLOG 计数
  try {
    if (dbConfig.syslogInbox) {
      var syslogs = await notionService.queryDB(dbConfig.syslogInbox, {
        property: 'DEV编号',
        rich_text: { equals: devId }
      }, null, 100);
      context.syslogs_count = syslogs.results ? syslogs.results.length : 0;
    }
  } catch (_) {}

  // 获取活跃工单计数
  try {
    if (dbConfig.ticketBook) {
      var tickets = await notionService.queryDB(dbConfig.ticketBook,
        { property: '状态', select: { does_not_equal: '已完成' } }, null, 100);
      context.tickets_count = tickets.results ? tickets.results.length : 0;
    }
  } catch (_) {}

  res.json(context);
});

module.exports = router;
