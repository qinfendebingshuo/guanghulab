// HLI-FTCHAT-001: 发送 QQ 邮箱验证码

'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../../../../server/ftchat/services/email-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');

const limiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 6,
  code: 'RATE_LIMIT_LOGIN',
  message: '验证码请求过于频繁，请稍后再试'
});

router.post('/', limiter, async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({
        hli_id: 'HLI-FTCHAT-001',
        success: false,
        error: true,
        code: 'EMAIL_REQUIRED',
        message: '请输入 QQ 邮箱'
      });
    }
    const result = await auth.sendCode(email);
    const status = result.success ? 200 : 400;
    res.status(status).json(Object.assign({ hli_id: 'HLI-FTCHAT-001' }, result));
  } catch (err) {
    console.error('[HLI-FTCHAT-001]', err);
    res.status(500).json({
      hli_id: 'HLI-FTCHAT-001',
      success: false,
      error: true,
      code: 'INTERNAL',
      message: '服务异常，请稍后再试'
    });
  }
});

module.exports = router;
