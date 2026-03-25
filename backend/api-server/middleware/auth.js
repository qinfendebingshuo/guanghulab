/**
 * 身份验证 + 权限检查中间件
 *
 * 人格体缓冲层铁律：人类不直接操作系统，人格体是唯一中间翻译层。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var permissions = require('../config/permissions');
var PERMISSION_LEVELS = permissions.PERMISSION_LEVELS;
var DEV_PERMISSIONS = permissions.DEV_PERMISSIONS;
var DEV_MODULES = permissions.DEV_MODULES;

/**
 * 开发者身份验证中间件
 * 要求请求头携带 x-dev-id 和 authorization
 */
function requireAuth(req, res, next) {
  var devId = req.headers['x-dev-id'];
  var token = req.headers['authorization'];

  if (!devId || !token) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_REQUIRED',
      message: '请先登录。需要携带 x-dev-id 和 authorization 请求头。',
      reply: '🔒 请先登录。你需要使用你的开发者编号登录系统。'
    });
  }

  var devConfig = DEV_PERMISSIONS[devId];
  if (!devConfig) {
    return res.status(401).json({
      error: true,
      code: 'UNKNOWN_DEV',
      message: '未知的开发者编号: ' + devId,
      reply: '🔒 未知的开发者编号：' + devId + '。请联系冰朔注册。'
    });
  }

  var level = PERMISSION_LEVELS[devConfig.level];

  req.user = {
    devId: devId,
    permissionLevel: devConfig.level,
    permissionLabel: level.label,
    permissions: level.permissions,
    environment: devConfig.environment,
    modules: DEV_MODULES[devId] || []
  };

  next();
}

/**
 * 权限检查中间件工厂
 * @param {string} requiredPermission - 需要的权限标识
 */
function checkPermission(requiredPermission) {
  return function(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        error: true,
        code: 'AUTH_REQUIRED',
        message: '身份验证缺失'
      });
    }

    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({
        error: true,
        code: 'PERMISSION_DENIED',
        message: '权限不足，需要: ' + requiredPermission,
        reply: '🔒 权限不足。你的等级是 ' + req.user.permissionLabel +
               '，需要「' + requiredPermission + '」权限。\n\n' +
               '💡 在预览站多练习，熟悉系统后冰朔会给你升级权限。'
      });
    }

    next();
  };
}

module.exports = {
  requireAuth: requireAuth,
  checkPermission: checkPermission
};
