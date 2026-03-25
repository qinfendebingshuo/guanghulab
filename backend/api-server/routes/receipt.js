/**
 * /api/receipt — 写入指令回执到 Notion 路由
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var notionService = require('../services/notion');
var dbConfig = require('../config/databases');

router.post('/receipt', async function(req, res) {
  var body = req.body;

  if (!body.instruction_id) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_INSTRUCTION_ID',
      message: '需要 instruction_id 参数'
    });
  }

  if (!dbConfig.receiptTracker) {
    return res.status(503).json({
      error: true,
      code: 'DB_NOT_CONFIGURED',
      message: '指令回执追踪表未配置'
    });
  }

  try {
    var properties = {
      '指令编号': {
        rich_text: [{ text: { content: body.instruction_id } }]
      },
      '执行状态': {
        select: { name: body.status || '已完成' }
      },
      '铸渊回执': {
        rich_text: [{ text: { content: body.receipt || '' } }]
      },
      '回执时间': {
        date: { start: new Date().toISOString() }
      }
    };

    if (body.summary) {
      properties['指令摘要'] = {
        rich_text: [{ text: { content: body.summary } }]
      };
    }

    await notionService.writeToDB(dbConfig.receiptTracker, properties);

    res.json({
      success: true,
      instruction_id: body.instruction_id,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('[/api/receipt] Error:', err.message);
    res.status(500).json({
      error: true,
      code: 'WRITE_FAILED',
      message: '回执写入失败: ' + err.message
    });
  }
});

module.exports = router;
