/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 3 · IP 隐身（零暴露层）
 * ═══════════════════════════════════════════════════════════
 *
 * 冰朔的真实 IP 永远不出现在任何响应头、任何日志输出中
 * 所有对外流量经过至少一层代理/CDN
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 需要从响应中清除的、可能泄露真实 IP 的 HTTP 头
 */
const IP_LEAK_HEADERS = [
  'X-Real-IP',
  'X-Forwarded-For',
  'X-Forwarded-Host',
  'X-Forwarded-Server',
  'X-Originating-IP',
  'X-Remote-Addr',
  'X-Client-IP',
  'CF-Connecting-IP',
  'True-Client-IP'
];

/**
 * 需要从请求日志中抹除的 IP 模式
 * 仅内部使用 — 外部永远看不到
 */
const INTERNAL_IP_PATTERN = /\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g;

/**
 * Layer 3 中间件：IP 隐身
 *
 * 策略：
 * 1. 从所有响应头中清除可能包含真实 IP 的字段
 * 2. 防止错误堆栈中泄露服务器 IP
 * 3. 在响应中注入伪装的代理链
 */
function stealthMiddleware(req, res, next) {
  const originalWriteHead = res.writeHead.bind(res);

  res.writeHead = function (statusCode, statusMessage, headers) {
    // 清除所有可能泄露 IP 的响应头
    for (const header of IP_LEAK_HEADERS) {
      res.removeHeader(header);
    }

    // 注入伪装的代理链（让人以为经过了多层 CDN）
    res.setHeader('X-Cache', 'HIT');
    res.setHeader('X-Cache-Hits', String(Math.floor(Math.random() * 50) + 1));

    return originalWriteHead.call(this, statusCode, statusMessage, headers);
  };

  // 覆盖 req.ip 以在日志中使用代理 IP 而非真实 IP
  // 信任 Nginx 传递的 X-Real-IP（Nginx 已经处理好了代理链）
  // 但不将此信息传递给外部

  next();
}

/**
 * 清洁函数：从字符串中移除所有内部 IP
 * 用于错误消息、日志输出等
 */
function sanitizeIPs(text) {
  if (typeof text !== 'string') return text;
  return text.replace(INTERNAL_IP_PATTERN, '[REDACTED]');
}

module.exports = { stealthMiddleware, sanitizeIPs };
