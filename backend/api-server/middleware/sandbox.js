/**
 * 预览站沙箱守卫中间件
 *
 * 预览环境中的写入操作在沙箱中执行，不影响真实系统。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

// 沙箱数据库 ID（通过环境变量配置，Notion 中的独立数据库）
var SANDBOX_DB_IDS = {
  ticketBook:     process.env.SANDBOX_TICKET_DB_ID || '',
  syslogInbox:    process.env.SANDBOX_SYSLOG_DB_ID || '',
  maintenanceLog: process.env.SANDBOX_MAINTENANCE_DB_ID || ''
};

/**
 * 沙箱守卫中间件
 *
 * 如果开发者在预览环境中执行写入操作：
 * - Notion 写入 → 重定向到沙箱数据库
 * - GitHub 操作 → 重定向到 preview 分支
 * - 所有操作标记 [SANDBOX]
 */
function sandboxGuard(req, res, next) {
  if (req.user && req.user.environment === 'preview') {
    req.sandbox = true;
    req.sandboxDbIds = SANDBOX_DB_IDS;

    // 预览环境中禁止正式站部署
    if (req.path.includes('/deploy/production')) {
      return res.status(403).json({
        error: true,
        code: 'SANDBOX_BLOCKED',
        message: '预览环境不允许正式站部署',
        reply: '🏖️ 你目前在预览环境。正式站部署需要升级到 Level 2（执行者）权限。\n\n继续在预览站练习吧，你做得很好！'
      });
    }
  }
  next();
}

module.exports = {
  sandboxGuard: sandboxGuard,
  SANDBOX_DB_IDS: SANDBOX_DB_IDS
};
