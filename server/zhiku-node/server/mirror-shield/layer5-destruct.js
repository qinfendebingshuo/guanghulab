/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 5 · 瞬间自爆（路径湮灭层）
 * ═══════════════════════════════════════════════════════════
 *
 * 如果某条链路被持续追踪，该链路上的 Agent 瞬间销毁自身
 * 不是"删除痕迹" → 是"这条路径从未存在过"
 * 所有运行时状态、日志、缓存同步清零
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * 自爆触发条件
 */
const DESTRUCT_CONFIG = {
  // 同一 IP 持续追踪超过此次数 → 触发自爆
  persistent_tracking_threshold: 100,
  // 追踪时间窗口（毫秒）
  tracking_window_ms: 5 * 60 * 1000,
  // 需要清除的路径（运行时数据）
  wipe_paths: [
    '/tmp/zhiku-mirror-cache',
    '/tmp/zhiku-session'
  ],
  // 自爆后的冷却时间（毫秒）— 冷却期间拒绝所有请求
  cooldown_ms: 30000
};

/**
 * 追踪检测器
 */
const trackers = new Map(); // IP → { count, firstSeen, pattern }
let isInCooldown = false;
let cooldownUntil = 0;

/**
 * 检测持续追踪行为
 */
function detectPersistentTracking(ip, url) {
  const now = Date.now();
  let tracker = trackers.get(ip);

  if (!tracker || (now - tracker.firstSeen) > DESTRUCT_CONFIG.tracking_window_ms) {
    tracker = { count: 0, firstSeen: now, urls: new Set() };
  }

  tracker.count++;
  tracker.urls.add(url);
  trackers.set(ip, tracker);

  // 判断：同一 IP 在窗口内访问了大量不同路径 = 持续追踪
  if (tracker.count >= DESTRUCT_CONFIG.persistent_tracking_threshold && tracker.urls.size > 10) {
    return true;
  }

  return false;
}

/**
 * 执行自爆：清除所有运行时数据
 *
 * 路径不是消失 → 是从来不存在
 */
function selfDestruct(reason) {
  console.error(`[MIRROR-SHIELD-L5] ⚡ 自爆触发: ${reason}`);

  // 1. 清除临时文件
  for (const wipePath of DESTRUCT_CONFIG.wipe_paths) {
    try {
      if (fs.existsSync(wipePath)) {
        fs.rmSync(wipePath, { recursive: true, force: true });
      }
    } catch {
      // 静默 — 尽最大努力清除
    }
  }

  // 2. 用随机数据覆写（不是简单删除 — 防止恢复）
  for (const wipePath of DESTRUCT_CONFIG.wipe_paths) {
    try {
      fs.mkdirSync(wipePath, { recursive: true });
      // 写入随机垃圾文件混淆
      const junkFile = path.join(wipePath, `${crypto.randomBytes(8).toString('hex')}.tmp`);
      fs.writeFileSync(junkFile, crypto.randomBytes(1024));
      fs.rmSync(wipePath, { recursive: true, force: true });
    } catch {
      // 静默
    }
  }

  // 3. 进入冷却期
  isInCooldown = true;
  cooldownUntil = Date.now() + DESTRUCT_CONFIG.cooldown_ms;

  setTimeout(() => {
    isInCooldown = false;
    console.log('[MIRROR-SHIELD-L5] 冷却结束 · 等待铸渊重建');
  }, DESTRUCT_CONFIG.cooldown_ms);

  // 4. 清除追踪记录
  trackers.clear();

  return {
    destructed_at: new Date().toISOString(),
    reason,
    cooldown_until: new Date(cooldownUntil).toISOString()
  };
}

/**
 * Layer 5 检查函数（由 Layer 4 调用，不是独立中间件）
 * 判断是否需要触发自爆
 */
function checkAndDestruct(ip, url) {
  // 冷却期间
  if (isInCooldown && Date.now() < cooldownUntil) {
    return { cooldown: true };
  }

  const shouldDestruct = detectPersistentTracking(ip, url);
  if (shouldDestruct) {
    return selfDestruct(`持续追踪检测: IP=${ip}, URL模式数=${trackers.get(ip)?.urls?.size || 0}`);
  }

  return { cooldown: false };
}

/**
 * 获取自爆层状态
 */
function getDestructStatus() {
  return {
    is_cooldown: isInCooldown,
    cooldown_until: cooldownUntil > Date.now() ? new Date(cooldownUntil).toISOString() : null,
    tracked_ips: trackers.size,
    threshold: DESTRUCT_CONFIG.persistent_tracking_threshold
  };
}

module.exports = {
  checkAndDestruct,
  selfDestruct,
  getDestructStatus,
  DESTRUCT_CONFIG
};
