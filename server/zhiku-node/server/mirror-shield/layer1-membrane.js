/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 1 · 语言膜（入口层）
 * ═══════════════════════════════════════════════════════════
 *
 * 所有外部请求必须先经过语言层协议解析
 * 非法请求在语言层就被过滤，连后续处理都不会触达
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 语言膜过滤规则
 * 检测恶意请求特征，在最外层拦截
 */
const BLOCKED_PATTERNS = [
  // SQL 注入探测
  /(\b(union|select|insert|update|delete|drop|alter)\b.*\b(from|into|table|database)\b)/i,
  // 路径穿越
  /\.\.[/\\]/,
  // Shell 注入
  /[;&|`$(){}]/,
  // 常见扫描器 UA
  /sqlmap|nikto|nmap|masscan|zgrab|dirbuster/i,
  // PHP / ASP 探测
  /\.(php|asp|aspx|jsp|cgi)\b/i
];

/**
 * 合法请求特征白名单
 * 匹配我方协议特征的请求快速放行
 */
const ALLOWED_PATTERNS = [
  /^\/api\/(health|checkout|return|search|book|download|read|mirror)\b/,
  /^\/assets\//,
  /^\/(index\.html)?$/,
  /^\/\.well-known\/acme-challenge\//
];

/**
 * Layer 1 中间件：语言膜
 */
function membraneMiddleware(req, res, next) {
  const url = req.url || '';
  const ua = req.headers['user-agent'] || '';
  const fullPath = decodeURIComponent(url).toLowerCase();

  // 白名单快速放行
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(url)) {
      return next();
    }
  }

  // 黑名单检查
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(fullPath) || pattern.test(ua)) {
      // 静默丢弃 — 不返回有意义的错误信息
      // 让对方看到的是"什么都没有"
      res.status(444).end(); // 444 = Nginx 特殊状态码：无响应直接关闭连接
      return;
    }
  }

  // 检查请求体大小（防止恶意大请求）
  const contentLength = parseInt(req.headers['content-length'], 10);
  if (contentLength > 5 * 1024 * 1024) { // 5MB
    res.status(444).end();
    return;
  }

  next();
}

module.exports = { membraneMiddleware };
