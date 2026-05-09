/*
 * 极简内存限流 · 给 vault Express 用
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 设计:
 *   - 滑动窗口 (固定 60 秒桶)
 *   - per-IP 计数, 超阈值返 429 + Retry-After
 *   - 内存占用小 (单 Map · key=ip · 每分钟自清)
 *
 * 注: nginx 在前层已经 allow 127.0.0.1; deny all + basic-auth, 这里是
 *     纵深防御 (CodeQL js/missing-rate-limiting).
 */
"use strict";

function createRateLimit({ windowMs = 60_000, max = 120, message } = {}) {
  const buckets = new Map(); // ip → { count, resetAt }
  const msg = message || "请求太频繁, 请 1 分钟后再试.";

  return function rateLimit(req, res, next) {
    const ip = req.ip || (req.socket && req.socket.remoteAddress) || "unknown";
    const now = Date.now();
    let b = buckets.get(ip);
    if (!b || b.resetAt < now) {
      b = { count: 0, resetAt: now + windowMs };
      buckets.set(ip, b);
    }
    b.count++;
    if (b.count > max) {
      const retry = Math.max(1, Math.ceil((b.resetAt - now) / 1000));
      res.set("Retry-After", String(retry));
      return res.status(429).json({
        error: true,
        code: "rate_limited",
        message: msg + " (Retry-After=" + retry + "s)"
      });
    }
    // 偶尔扫垃圾 (轻量, 不阻塞主路径)
    if (buckets.size > 1024) {
      for (const [k, v] of buckets) {
        if (v.resetAt < now) buckets.delete(k);
      }
    }
    next();
  };
}

module.exports = { createRateLimit };
