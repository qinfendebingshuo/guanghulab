/**
 * /api/health — 健康检查路由
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();

router.get('/health', function(_req, res) {
  res.json({
    status: 'ok',
    service: 'guanghu-api-server',
    channel: 'B',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    notion_configured: !!process.env.NOTION_TOKEN,
    github_configured: !!process.env.GITHUB_TOKEN
  });
});

module.exports = router;
