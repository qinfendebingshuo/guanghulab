/**
 * 操作审计日志中间件
 *
 * 记录每次 API 操作到日志文件（谁、什么时间、做了什么）
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var fs = require('fs');
var path = require('path');

// 优先使用配置的目录，本地开发时回退到项目内目录
var AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR ||
  path.join(__dirname, '../../logs/audit');

/**
 * 审计日志中间件
 * 拦截请求和响应，记录操作信息
 */
function auditLog(req, res, next) {
  var startTime = Date.now();

  var logEntry = {
    timestamp: new Date().toISOString(),
    devId: (req.user && req.user.devId) || req.headers['x-dev-id'] || 'anonymous',
    method: req.method,
    path: req.path,
    ip: req.ip
  };

  // 对 POST/PATCH 请求记录请求体（排除敏感字段）
  if ((req.method === 'POST' || req.method === 'PATCH') && req.body) {
    var sanitizedBody = Object.assign({}, req.body);
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    delete sanitizedBody.confirmToken;
    logEntry.body = sanitizedBody;
  }

  // 拦截响应完成
  var originalSend = res.send;
  res.send = function(body) {
    logEntry.responseTime = Date.now() - startTime;
    logEntry.statusCode = res.statusCode;

    // 异步写入日志，不阻塞响应
    try {
      fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true });
      var today = new Date().toISOString().split('T')[0];
      var logFile = path.join(AUDIT_LOG_DIR, 'audit-' + today + '.jsonl');
      fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
    } catch (e) {
      console.error('审计日志写入失败:', e.message);
    }

    return originalSend.call(this, body);
  };

  next();
}

module.exports = { auditLog: auditLog };
