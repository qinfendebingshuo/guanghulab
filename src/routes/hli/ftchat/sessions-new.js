// HLI-FTCHAT-005: 开新对话 → 触发 memory-agent 压缩上一对话为母语印记

'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();

const ftAuth = require('../../../../server/ftchat/middleware/ft-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');
const memoryAgent = require('../../../../server/ftchat/services/memory-agent');
const sessionStore = require('../../../../server/ftchat/services/session-store');

const limiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 12,
  code: 'RATE_LIMIT_NEW',
  message: '开新对话请求过于频繁'
});

router.post('/', ftAuth, limiter, async (req, res) => {
  try {
    const { previous_messages, previous_session_id } = req.body || {};

    let imprint = '';
    let compressed = false;
    if (Array.isArray(previous_messages) && previous_messages.length > 0) {
      const result = await memoryAgent.compressToImprint(previous_messages);
      imprint = result.imprint || '';
      compressed = !!result.compressed;
      if (imprint) {
        sessionStore.setLatestImprint(req.ftUser.user_hash, imprint);
        if (previous_session_id) {
          // 标记上个 session 有 imprint
          sessionStore.upsertSession(req.ftUser.user_hash, {
            session_id: previous_session_id,
            title: '',
            message_count: previous_messages.length,
            has_memory_imprint: true
          });
        }
      }
    }

    const newId = Date.now().toString(36) + crypto.randomBytes(6).toString('hex');

    res.json({
      hli_id: 'HLI-FTCHAT-005',
      session_id: newId,
      memory_imprint: imprint,
      compressed
    });
  } catch (err) {
    console.error('[HLI-FTCHAT-005]', err);
    res.status(500).json({
      hli_id: 'HLI-FTCHAT-005',
      error: true,
      code: 'INTERNAL',
      message: '开新对话失败'
    });
  }
});

module.exports = router;
