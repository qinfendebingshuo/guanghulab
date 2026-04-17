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
 * URL 路径黑名单 — 仅检查请求路径
 * 检测恶意请求特征，在最外层拦截
 */
const BLOCKED_PATH_PATTERNS = [
  // SQL 注入探测
  /(\b(union|select|insert|update|delete|drop|alter)\b.*\b(from|into|table|database)\b)/i,
  // 路径穿越
  /\.\.[/\\]/,
  // Shell 注入（仅检查 URL 路径，不检查 UA — 浏览器 UA 天然包含 () 等字符）
  /[;&|`${}]/,
  // PHP / ASP 探测
  /\.(php|asp|aspx|jsp|cgi)\b/i
];

/**
 * User-Agent 黑名单 — 仅检查 UA 字符串
 * 与路径黑名单分离，避免标准浏览器 UA 中的 () 被误杀
 */
const BLOCKED_UA_PATTERNS = [
  // 常见扫描器 / 攻击工具 UA
  /sqlmap|nikto|nmap|masscan|zgrab|dirbuster|havij|acunetix|nessus/i
];

/**
 * 合法请求特征白名单
 * 匹配我方协议特征的请求快速放行
 * 覆盖 server.js 中注册的所有 API 路由（v1 + v2）
 */
const ALLOWED_PATTERNS = [
  // v2 认证 + Agent + 下载管理
  /^\/api\/auth\//,
  /^\/api\/agent\//,
  /^\/api\/download\//,
  // v1 + 公共
  /^\/api\/(health|checkout|return|search|book|read|mirror)\b/,
  // 静态资源 + 页面
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

  // 黑名单检查 — URL 路径和 UA 分离检测
  // URL 路径只查路径黑名单
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(fullPath)) {
      req.socket.destroy();
      return;
    }
  }
  // UA 只查扫描器特征（不查 shell 字符 — 浏览器 UA 天然包含 () 等）
  for (const pattern of BLOCKED_UA_PATTERNS) {
    if (pattern.test(ua)) {
      req.socket.destroy();
      return;
    }
  }

  // 检查请求体大小（防止恶意大请求）
  const contentLength = parseInt(req.headers['content-length'], 10);
  if (contentLength > 5 * 1024 * 1024) { // 5MB
    req.socket.destroy();
    return;
  }

  next();
}

module.exports = { membraneMiddleware };
