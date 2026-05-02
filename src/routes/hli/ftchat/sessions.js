// HLI-FTCHAT-004: 历史会话列表

'use strict';

const express = require('express');
const router = express.Router();

const ftAuth = require('../../../../server/ftchat/middleware/ft-auth');
const sessionStore = require('../../../../server/ftchat/services/session-store');

router.get('/', ftAuth, (req, res) => {
  try {
    const sessions = sessionStore.listSessions(req.ftUser.user_hash);
    res.json({
      hli_id: 'HLI-FTCHAT-004',
      sessions
    });
  } catch (err) {
    console.error('[HLI-FTCHAT-004]', err);
    res.status(500).json({
      hli_id: 'HLI-FTCHAT-004',
      error: true,
      code: 'INTERNAL',
      message: '获取会话列表失败'
    });
  }
});

module.exports = router;
