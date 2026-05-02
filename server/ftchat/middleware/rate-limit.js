/**
 * 简单 IP+key 维度内存速率限制器
 * 不依赖 express-rate-limit, 避免新增依赖
 */
'use strict';

function makeLimiter(opts) {
  const windowMs = (opts && opts.windowMs) || 60 * 1000;
  const max = (opts && opts.max) || 30;
  const code = (opts && opts.code) || 'RATE_LIMIT';
  const message = (opts && opts.message) || '请求过于频繁，请稍后再试';
  const buckets = new Map(); // key → { count, resetAt }

  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of buckets.entries()) {
      if (now > v.resetAt) buckets.delete(k);
    }
  }, windowMs).unref();

  return function rateLimit(req, res, next) {
    const key = (req.ip || req.connection.remoteAddress || 'unknown') + '|' + (req.path || '');
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      const retry = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(retry));
      return res.status(429).json({
        error: true,
        code,
        message,
        retry_after: retry
      });
    }
    next();
  };
}

module.exports = { makeLimiter };
