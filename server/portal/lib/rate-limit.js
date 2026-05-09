/*
 * 限流 (cc-004 系统自主防御)
 *
 * 2C2G 是公网唯一入口, 不限流 = 被扫一波就死. express-rate-limit 内存窗口够用,
 * 不需要 Redis. 走 IP-based, 信任 nginx X-Forwarded-For (server.js 不主动设
 * trust proxy, 但 express-rate-limit 走 req.ip — 我们这里在 nginx 后面所以
 * 在 server.js 里 trust 第一跳, 只信我们自己的 nginx).
 *
 * 中文 429 回执 (cc-004 给团队看的级别).
 *
 * 配额:
 *   readLimiter   60 req/min/IP — /api/health /api/manifest /api/persona-db
 *   writeLimiter  15 req/min/IP — /api/conversations* /api/active-model
 *   chatLimiter   10 req/min/IP — /api/chat (SSE 推理转发, 保护 AutoDL quota)
 */
"use strict";

const rateLimit = require("express-rate-limit");

const handler = (label, perMin) => (_req, res, _next, _options) => {
  res.status(429).json({
    error: true,
    code: "rate_limited",
    message: `请求太频繁啦, 每分钟最多 ${perMin} 次 · ${label}. 稍等再试.`
  });
};

const readLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("读类接口", 60)
});

const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("写类接口", 15)
});

const chatLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: handler("推理接口", 10)
});

module.exports = { readLimiter, writeLimiter, chatLimiter };
