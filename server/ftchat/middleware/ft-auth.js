/**
 * FTCHAT 鉴权中间件
 * 验证 Authorization Bearer token → req.ftUser
 */

'use strict';

const auth = require('../services/email-auth');

module.exports = function ftAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_TOKEN_MISSING',
      message: '请先登录'
    });
  }
  const token = header.slice(7);
  const result = auth.validateSession(token);
  if (!result.valid) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_TOKEN_INVALID',
      message: '登录已失效，请重新登录'
    });
  }
  req.ftUser = {
    email: result.email,
    user_hash: result.user_hash,
    slot_index: result.slot_index,
    token
  };
  next();
};
