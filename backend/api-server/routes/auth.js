/**
 * /api/auth — 开发者编号免配置登录路由
 *
 * 开发者输入编号（如 DEV-002）即可直接进入对话界面。
 * 系统自动匹配团队配置的 API，人不需要设置任何东西。
 * API Key 只在服务器端使用，前端永远看不到。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var crypto = require('crypto');
var router = express.Router();

// 团队共享密钥（存在服务器环境变量，前端不可见）
var TEAM_API_KEY = process.env.TEAM_API_KEY || '';

// 会话 token 签名密钥
var SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

// 开发者数据库（后续对接 Notion）
var DEV_DATABASE = {
  'DEV-000': { name: '冰朔', level: 3, channel: 'system' },
  'DEV-001': { name: '页页', level: 1, channel: '小坍缩核线' },
  'DEV-002': { name: '肥猫', level: 2, channel: '男频' },
  'DEV-003': { name: 'Awen', level: 1, channel: '知秋线' },
  'DEV-004': { name: '之之', level: 2, channel: '秋秋线' },
  'DEV-005': { name: '时雨', level: 1, channel: '知秋线' },
  'DEV-006': { name: '匆匆那年', level: 1, channel: '霜砚线' },
  'DEV-007': { name: '小兴', level: 1, channel: '霜砚线' },
  'DEV-008': { name: '花尔', level: 1, channel: '糖星云线' },
  'DEV-009': { name: '小草莓', level: 1, channel: '欧诺弥亚线' },
  'DEV-010': { name: '桔子', level: 2, channel: '女频' },
  'DEV-011': { name: '燕樊', level: 1, channel: '寂曜线' }
};

// 活跃会话存储（内存级，重启清空）
var activeSessions = new Map();

/**
 * 生成会话 token（有效期 24h）
 * @param {string} devId
 * @returns {string}
 */
function generateSessionToken(devId) {
  var payload = devId + ':' + Date.now();
  var hmac = crypto.createHmac('sha256', SESSION_SECRET);
  hmac.update(payload);
  var token = payload + ':' + hmac.digest('hex');
  var tokenBase64 = Buffer.from(token).toString('base64');

  activeSessions.set(tokenBase64, {
    devId: devId,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000
  });

  return tokenBase64;
}

/**
 * 验证会话 token
 * @param {string} token
 * @returns {{ valid: boolean, devId?: string }}
 */
function verifySessionToken(token) {
  var session = activeSessions.get(token);
  if (!session) {
    return { valid: false };
  }
  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return { valid: false };
  }
  return { valid: true, devId: session.devId };
}

/**
 * 会话验证中间件
 */
function requireSession(req, res, next) {
  var authHeader = req.headers['authorization'] || '';
  var token = authHeader.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({
      error: true,
      code: 'SESSION_REQUIRED',
      message: '请先登录。需要携带有效的会话 token。'
    });
  }

  var result = verifySessionToken(token);
  if (!result.valid) {
    return res.status(401).json({
      error: true,
      code: 'SESSION_EXPIRED',
      message: '会话已过期，请重新登录。'
    });
  }

  req.sessionDevId = result.devId;
  req.sessionDev = DEV_DATABASE[result.devId] || null;
  next();
}

/**
 * POST /api/auth/team-login
 * 开发者编号免配置登录
 */
router.post('/auth/team-login', function(req, res) {
  var devId = (req.body.devId || '').trim().toUpperCase();

  if (!devId || !/^DEV-\d{3}$/.test(devId)) {
    return res.json({
      success: false,
      message: '❌ 无效的开发者编号格式。请使用 DEV-XXX 格式。'
    });
  }

  var dev = DEV_DATABASE[devId];

  if (!dev) {
    return res.json({
      success: false,
      message: '❌ 开发者编号 ' + devId + ' 不存在。请确认你的编号。'
    });
  }

  // 生成会话 token（有效期 24h）
  var sessionToken = generateSessionToken(devId);

  res.json({
    success: true,
    devName: dev.name,
    level: dev.level,
    channel: dev.channel,
    sessionToken: sessionToken
  });

  // 审计日志
  console.log('[AUTH] ' + devId + ' (' + dev.name + ') logged in at ' + new Date().toISOString());
});

/**
 * GET /api/auth/verify
 * 验证当前会话是否有效
 */
router.get('/auth/verify', function(req, res) {
  var authHeader = req.headers['authorization'] || '';
  var token = authHeader.replace(/^Bearer\s+/i, '');
  var result = verifySessionToken(token);

  if (result.valid) {
    var dev = DEV_DATABASE[result.devId] || {};
    res.json({
      valid: true,
      devId: result.devId,
      devName: dev.name || '',
      level: dev.level || 0,
      channel: dev.channel || ''
    });
  } else {
    res.json({ valid: false });
  }
});

/**
 * POST /api/auth/logout
 * 注销会话
 */
router.post('/auth/logout', function(req, res) {
  var authHeader = req.headers['authorization'] || '';
  var token = authHeader.replace(/^Bearer\s+/i, '');

  if (token && activeSessions.has(token)) {
    var session = activeSessions.get(token);
    activeSessions.delete(token);
    console.log('[AUTH] ' + session.devId + ' logged out at ' + new Date().toISOString());
  }

  res.json({ success: true, message: '已注销' });
});

module.exports = router;
module.exports.requireSession = requireSession;
module.exports.verifySessionToken = verifySessionToken;
module.exports.DEV_DATABASE = DEV_DATABASE;
