// HLI-FTCHAT-002: 校验验证码 → 占位 → 签发 token

'use strict';

const express = require('express');
const router = express.Router();

const auth = require('../../../../server/ftchat/services/email-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');

// 速率限制 (双层):
//   - 路由层: makeLimiter 按 IP+path 限流 (10 次/分钟)
//   - auth 层: email-auth.verifyCode 内置 attempts 计数 (单邮箱最多 3 次错码)
const limiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 10,
  code: 'RATE_LIMIT_VERIFY',
  message: '校验请求过于频繁，请稍后再试'
});

// lgtm[js/missing-rate-limiting] -- 已通过 makeLimiter (custom rate limiter) + 内置 attempts 计数实现双层限流
router.post('/', limiter, (req, res) => {
  try {
    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({
        hli_id: 'HLI-FTCHAT-002',
        success: false,
        error: true,
        code: 'PARAMS_REQUIRED',
        message: '请输入邮箱和验证码'
      });
    }
    const result = auth.verifyCode(email, code);
    const status = result.success ? 200 : 400;
    res.status(status).json(Object.assign({ hli_id: 'HLI-FTCHAT-002' }, result));
  } catch (err) {
    console.error('[HLI-FTCHAT-002]', err);
    res.status(500).json({
      hli_id: 'HLI-FTCHAT-002',
      success: false,
      error: true,
      code: 'INTERNAL',
      message: '服务异常，请稍后再试'
    });
  }
});

module.exports = router;
