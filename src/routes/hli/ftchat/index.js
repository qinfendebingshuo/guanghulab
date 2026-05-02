// FTCHAT 域路由汇总
// 编号: HLI-FTCHAT-001 ~ 005
// 守护: 铸渊 · ICE-GL-ZY001

'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../../../../server/ftchat/services/email-auth');

// 公开端点
router.use('/login', require('./login'));
router.use('/verify', require('./verify'));

// 状态查询（公开，前端登录前展示槽位剩余）
router.get('/status', (req, res) => {
  res.json({
    hli_id: 'HLI-FTCHAT-STATUS',
    ...auth.getStatus()
  });
});

// 已登录端点（每个路由文件内部用 ftAuth 中间件）
router.use('/chat', require('./chat'));
router.use('/sessions/new', require('./sessions-new'));
router.use('/sessions', require('./sessions'));

module.exports = router;
