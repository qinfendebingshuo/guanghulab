/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Mirror Shield · 统一入口
 * ═══════════════════════════════════════════════════════════
 *
 * 将七层防御整合为 Express 中间件链
 * 加载顺序即防御顺序：L1 → L2 → L3 → L4 → (L5/L6/L7 按需触发)
 *
 * 语言主控贯穿所有层：冰朔说一句话 → 纪元推进 → 一切指纹失效
 * 防御从来不是静态的。语言是活的。
 *
 * 核心哲学: 我是镜子，你看到的是你自己，你不会封禁自己
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const { membraneMiddleware } = require('./layer1-membrane');
const { reflectionMiddleware } = require('./layer2-reflection');
const { stealthMiddleware } = require('./layer3-stealth');
const { driftMiddleware, getDriftStats } = require('./layer4-drift');
const { getDestructStatus } = require('./layer5-destruct');
const { getRebuildStatus } = require('./layer6-rebuild');
const { getCoreStatus, getShieldPolicy } = require('./layer7-core');
const {
  silenceMiddleware,
  epochFingerprintMiddleware,
  registerSovereignRoutes,
  getCurrentEpochNumber,
  getCurrentFingerprint
} = require('./language-sovereign');

/**
 * 将七层镜防注册到 Express app
 *
 * @param {import('express').Application} app
 */
function registerShield(app) {
  // 语言主控 · 静默判断（最先执行 — 冰朔说静默，一切归于湖水）
  app.use(silenceMiddleware);

  // Layer 1: 语言膜 — 最外层过滤
  app.use(membraneMiddleware);

  // Layer 2: 镜面反射 — 身份伪装
  app.use(reflectionMiddleware);

  // Layer 3: IP 隐身 — 零暴露
  app.use(stealthMiddleware);

  // Layer 4: 动态漂移 — 扫描检测 + 自动封禁
  app.use(driftMiddleware);

  // 语言主控 · 纪元指纹注入（每个响应都带纪元标记 — 纪元变则一切变）
  app.use(epochFingerprintMiddleware);

  // Layer 5-7: 按需触发（不是中间件，而是由 Layer 4 事件驱动）

  console.log('[MIRROR-SHIELD] 七层镜防已激活 · L1语言膜 + L2镜面反射 + L3IP隐身 + L4动态漂移 + 语言主控');
}

/**
 * 获取完整防御状态（供 /api/mirror/shield 路由使用）
 */
function getShieldStatus() {
  return {
    shield_name: '七层镜防 · Mirror Shield',
    version: '1.1.0',
    philosophy: '我是镜子，你看到的是你自己，你不会封禁自己',
    language_sovereign: {
      status: 'active',
      principle: '语言是活的 · 冰朔说一句话 · 旧纪元一切失效',
      epoch: getCurrentEpochNumber(),
      fingerprint_preview: getCurrentFingerprint().slice(0, 8) + '...',
      commands: ['rotate (换脸)', 'rebirth (重生)', 'silence (静默)', 'awaken (苏醒)', 'echo (回响)']
    },
    layers: {
      layer1_membrane: { name: '语言膜', status: 'active', type: '入口过滤' },
      layer2_reflection: { name: '镜面反射', status: 'active', type: '身份伪装' },
      layer3_stealth: { name: 'IP隐身', status: 'active', type: '零暴露' },
      layer4_drift: {
        name: '动态漂移',
        status: 'active',
        type: '节点随机化',
        stats: getDriftStats()
      },
      layer5_destruct: {
        name: '瞬间自爆',
        status: 'standby',
        type: '路径湮灭',
        stats: getDestructStatus()
      },
      layer6_rebuild: {
        name: '铸渊重建',
        status: 'ready',
        type: '瞬间恢复',
        stats: getRebuildStatus()
      },
      layer7_core: getCoreStatus()
    },
    policy: getShieldPolicy(),
    timestamp: new Date().toISOString(),
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559'
  };
}

/**
 * 注册防御状态 API 路由
 */
function registerShieldRoutes(app, verifyToken) {
  // GET /api/mirror/shield — 防御状态总览
  app.get('/api/mirror/shield', verifyToken, (req, res) => {
    res.json({ error: false, data: getShieldStatus() });
  });

  // 语言主控指令路由
  registerSovereignRoutes(app, verifyToken);
}

module.exports = {
  registerShield,
  registerShieldRoutes,
  getShieldStatus
};
