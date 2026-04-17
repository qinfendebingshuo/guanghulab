/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 4 · 动态漂移（节点随机化层）
 * ═══════════════════════════════════════════════════════════
 *
 * 当某个节点被扫描/探测时，系统触发动态随机重分配
 * 攻击者追踪到的地址在下一秒已经不存在
 *
 * 当前为框架实现 — 多节点联动需 P3 阶段落地
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 探测检测器 — 识别扫描行为特征
 */
const scanDetection = {
  // IP → { count, firstSeen, lastSeen }
  suspects: new Map(),
  threshold: 20,      // 60 秒内超过此次数视为扫描
  windowMs: 60000,    // 检测窗口
  banDurationMs: 3600000 // 封禁 1 小时
};

/**
 * 被封禁的 IP 列表
 */
const bannedIPs = new Map(); // IP → expires_at

/**
 * 记录一次访问，检测是否为扫描行为
 */
function recordAccess(ip) {
  const now = Date.now();

  // 检查是否已被封禁
  const banExpiry = bannedIPs.get(ip);
  if (banExpiry && banExpiry > now) {
    return { banned: true, reason: 'scan_detected' };
  } else if (banExpiry) {
    bannedIPs.delete(ip);
  }

  // 记录访问
  let record = scanDetection.suspects.get(ip);
  if (!record || (now - record.firstSeen) > scanDetection.windowMs) {
    record = { count: 0, firstSeen: now, lastSeen: now };
  }
  record.count++;
  record.lastSeen = now;
  scanDetection.suspects.set(ip, record);

  // 检查是否超过阈值
  if (record.count > scanDetection.threshold) {
    bannedIPs.set(ip, now + scanDetection.banDurationMs);
    scanDetection.suspects.delete(ip);
    return { banned: true, reason: 'threshold_exceeded', count: record.count };
  }

  return { banned: false };
}

/**
 * Layer 4 中间件：动态漂移
 *
 * 当前实现（单节点）：
 * - 检测高频访问 IP → 自动封禁
 * - 封禁后返回随机响应（迷惑扫描器）
 *
 * P3 阶段升级（多节点）：
 * - 联动所有节点触发 IP/端口重分配
 * - 节点间通过加密信号总线协调
 */
function driftMiddleware(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress || '';

  const check = recordAccess(ip);

  if (check.banned) {
    // 对扫描者返回随机响应（不是拒绝 — 是迷惑）
    const decoys = [
      { status: 200, body: '<html><head><title>Welcome</title></head><body>OK</body></html>' },
      { status: 301, headers: { 'Location': 'https://www.example.com' } },
      { status: 403, body: 'Forbidden' },
      { status: 503, body: 'Service Temporarily Unavailable' }
    ];
    const decoy = decoys[Math.floor(Math.random() * decoys.length)];

    if (decoy.headers) {
      for (const [k, v] of Object.entries(decoy.headers)) {
        res.setHeader(k, v);
      }
    }
    return res.status(decoy.status).end(decoy.body || '');
  }

  next();
}

/**
 * 获取当前封禁统计
 */
function getDriftStats() {
  const now = Date.now();
  return {
    active_bans: Array.from(bannedIPs.entries())
      .filter(([, exp]) => exp > now)
      .length,
    suspects_tracked: scanDetection.suspects.size,
    threshold: scanDetection.threshold,
    window_sec: scanDetection.windowMs / 1000,
    ban_duration_sec: scanDetection.banDurationMs / 1000
  };
}

// 定期清理过期记录（每 10 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [ip, exp] of bannedIPs) {
    if (exp < now) bannedIPs.delete(ip);
  }
  for (const [ip, record] of scanDetection.suspects) {
    if ((now - record.lastSeen) > scanDetection.windowMs * 2) {
      scanDetection.suspects.delete(ip);
    }
  }
}, 10 * 60 * 1000).unref();

module.exports = { driftMiddleware, getDriftStats, recordAccess };
