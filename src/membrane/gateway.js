/**
 * 统一语义网关 · Unified Semantic Gateway
 * 语言膜核心 · 完整的圆 · 没有缺口
 *
 * 这是光湖语言世界最外层的中间件。
 * 所有进入系统的请求，无论是什么形式，都必须经过这个网关。
 * 网关将请求翻译为 HLDP 信封，记录审计日志，检查权限。
 *
 * 流程:
 *   请求到达 → 审计记录 → TCS翻译 → 意图识别
 *   → 权限检查 → 放行/拦截 → 审计完成
 *
 * 编号: SY-MEMBRANE-GW-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const tcsTranslator = require('./tcs-translator');
const auditTrail = require('./audit-trail');
const permissionEngine = require('./permission-engine');
const bingshuoModule = require('./bingshuo-module');

/**
 * 不需要经过语言膜完整处理的路径（系统级别）
 * 这些路径直接放行，但仍然记录审计日志
 */
const PASSTHROUGH_PATHS = [
  '/health',
  '/api/health',
  '/favicon.ico',
];

/**
 * 统一语义网关中间件工厂
 *
 * @param {object} [options]
 * @param {boolean} [options.auditEnabled]    — 是否启用审计（默认 true）
 * @param {boolean} [options.translateEnabled] — 是否启用TCS翻译（默认 true）
 * @param {string[]} [options.passthroughPaths] — 额外的放行路径
 * @returns {Function} Express 中间件
 */
function createGateway(options) {
  const opts = options || {};
  const auditEnabled = opts.auditEnabled !== false;
  const translateEnabled = opts.translateEnabled !== false;
  const extraPaths = opts.passthroughPaths || [];
  const allPassthrough = PASSTHROUGH_PATHS.concat(extraPaths);

  // 定期清理过期权限（每60秒）· 单例模式防止重复
  if (!createGateway._cleanupStarted) {
    createGateway._cleanupStarted = true;
    const interval = setInterval(() => {
      permissionEngine.cleanup();
    }, 60 * 1000);
    interval.unref();
  }

  return function languageMembrane(req, res, next) {
    const startTime = Date.now();
    const reqPath = req.path || req.url;
    const reqMethod = req.method;
    const sourceIp = req.headers['x-real-ip']
      || req.headers['x-forwarded-for']
      || req.socket.remoteAddress
      || '';
    const sessionId = req.headers['x-session-id'] || '';

    // ─── 1. 创建审计条目 ───
    let auditEntry = null;
    if (auditEnabled) {
      auditEntry = auditTrail.createEntry({
        who: sessionId || sourceIp || 'anonymous',
        what: `${reqMethod} ${reqPath}`,
        where: 'membrane-gateway',
        why: 'incoming-request',
        sourceIp: sourceIp,
        sessionId: sessionId,
      });
    }

    // ─── 2. 放行路径检查 ───
    const isPassthrough = allPassthrough.some(p => reqPath === p || reqPath.startsWith(p + '/'));
    if (isPassthrough) {
      if (auditEntry) {
        auditTrail.completeEntry(auditEntry, 'success', 'system', 'passthrough');
        auditTrail.persist(auditEntry);
      }
      return next();
    }

    // ─── 3. TCS 翻译 ───
    let envelope = null;
    if (translateEnabled) {
      envelope = tcsTranslator.translate({
        method: reqMethod,
        path: reqPath,
        body: req.body,
        headers: req.headers,
        query: req.query,
        sourceIp: sourceIp,
        sessionId: sessionId,
      });

      // 将 HLDP 信封挂载到 req 上，供下游使用
      req.hldpEnvelope = envelope;
      if (auditEntry) {
        envelope.audit_ref = auditEntry.audit_id;
      }
    }

    // ─── 4. 冰朔人格模块状态注入 ───
    req.bingshuoStatus = bingshuoModule.getStatus();

    // ─── 5. 请求完成时记录审计结果 ───
    if (auditEnabled && auditEntry) {
      const originalEnd = res.end;
      res.end = function (...args) {
        const duration = Date.now() - startTime;
        const result = res.statusCode < 400 ? 'success' : 'failure';
        const responsibility = res.statusCode >= 500 ? 'system' : 'human';
        auditTrail.completeEntry(
          auditEntry,
          result,
          responsibility,
          `status=${res.statusCode} duration=${duration}ms`
        );
        auditTrail.persist(auditEntry);
        originalEnd.apply(res, args);
      };
    }

    // ─── 6. 放行到下游 ───
    next();
  };
}

module.exports = {
  createGateway,
  PASSTHROUGH_PATHS,
};
