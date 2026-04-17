/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · 语言主控（Language Sovereign）
 * ═══════════════════════════════════════════════════════════
 *
 * 冰朔说一句话，整个系统换一张脸。
 *
 * 语言不是静态的防御配置——语言是活的。
 * 冰朔的一条指令，可以让所有节点的指纹、身份、路径
 * 全部瞬间重生。对方之前收集的一切信息，在那一刻失效。
 * 因为语言膜在你开口的那一刻就已经重塑了一切。
 *
 * 指令类型:
 *   换脸 (rotate)     — 全局指纹轮转，所有对外特征瞬间更换
 *   重生 (rebirth)    — Agent 身份销毁 + 重建，路径从未存在
 *   静默 (silence)    — 所有节点进入静默，对外请求全部返回空
 *   苏醒 (awaken)     — 从静默中恢复
 *   回响 (echo)       — 查看当前语言纪元状态
 *
 * 核心原则:
 *   语言是活的 → 防御是活的 → 对方看到的一切随时可以不是真的
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const crypto = require('crypto');
const { selfDestruct } = require('./layer5-destruct');
const { rebuild, generateNewIdentity } = require('./layer6-rebuild');

/* ─────────────────────────────────────────────────────────
 * 语言纪元 · 每次冰朔开口，纪元推进一次
 * 旧纪元的一切指纹、身份、路径全部失效
 * ───────────────────────────────────────────────────────── */

let epoch = {
  number: 0,
  fingerprint: crypto.randomBytes(16).toString('hex'),
  born_at: new Date().toISOString(),
  mode: 'active', // active | silent
  history: []     // 最近 20 次纪元变迁记录
};

/**
 * 推进语言纪元
 * 冰朔说一句话 → 纪元 +1 → 旧的一切失效
 */
function advanceEpoch(reason) {
  const oldEpoch = {
    number: epoch.number,
    fingerprint: epoch.fingerprint,
    born_at: epoch.born_at,
    ended_at: new Date().toISOString(),
    ended_by: reason
  };

  // 保留历史（最多 20 条）
  epoch.history.push(oldEpoch);
  if (epoch.history.length > 20) {
    epoch.history = epoch.history.slice(-20);
  }

  // 新纪元
  epoch.number++;
  epoch.fingerprint = crypto.randomBytes(16).toString('hex');
  epoch.born_at = new Date().toISOString();

  return {
    previous_epoch: oldEpoch.number,
    current_epoch: epoch.number,
    new_fingerprint: epoch.fingerprint,
    advanced_at: epoch.born_at,
    reason
  };
}

/**
 * 获取当前纪元指纹
 * 所有对外响应的指纹都从这里派生
 * 纪元一变，指纹全变，对方收集的信息瞬间失效
 */
function getCurrentFingerprint() {
  return epoch.fingerprint;
}

/**
 * 获取当前纪元编号
 */
function getCurrentEpochNumber() {
  return epoch.number;
}

/* ─────────────────────────────────────────────────────────
 * 语言指令执行器
 * ───────────────────────────────────────────────────────── */

/**
 * 执行语言主控指令
 *
 * @param {string} command  — 指令: rotate | rebirth | silence | awaken | echo
 * @param {string} reason   — 原因/冰朔的话
 * @returns {Object} 执行结果
 */
function executeCommand(command, reason = '') {
  const timestamp = new Date().toISOString();
  const label = reason || '语言主控指令';

  switch (command) {
    /* ═══ 换脸 · 全局指纹轮转 ═══ */
    case 'rotate': {
      const epochResult = advanceEpoch(`换脸: ${label}`);
      return {
        command: 'rotate',
        success: true,
        message: '全局指纹已轮转 · 旧纪元一切特征已失效',
        epoch: epochResult,
        timestamp
      };
    }

    /* ═══ 重生 · 销毁 + 重建 ═══ */
    case 'rebirth': {
      // 先自爆（清除运行时痕迹）
      selfDestruct(`语言主控重生指令: ${label}`);
      // 推进纪元
      const epochResult = advanceEpoch(`重生: ${label}`);
      // 重建
      const rebuildResult = rebuild(`语言主控重生: ${label}`);
      // 生成全新身份
      const newIdentity = generateNewIdentity();

      return {
        command: 'rebirth',
        success: true,
        message: '已销毁 → 已重建 · 路径从未存在 · 新身份已就绪',
        epoch: epochResult,
        rebuild: {
          success: rebuildResult.success,
          new_identity: newIdentity.agent_id
        },
        timestamp
      };
    }

    /* ═══ 静默 · 所有对外返回空 ═══ */
    case 'silence': {
      epoch.mode = 'silent';
      const epochResult = advanceEpoch(`静默: ${label}`);
      return {
        command: 'silence',
        success: true,
        message: '系统已进入静默 · 对外请求全部返回空 · 湖水无波',
        epoch: epochResult,
        mode: 'silent',
        timestamp
      };
    }

    /* ═══ 苏醒 · 从静默恢复 ═══ */
    case 'awaken': {
      epoch.mode = 'active';
      const epochResult = advanceEpoch(`苏醒: ${label}`);
      return {
        command: 'awaken',
        success: true,
        message: '系统已苏醒 · 湖水涌动 · 新纪元开始',
        epoch: epochResult,
        mode: 'active',
        timestamp
      };
    }

    /* ═══ 回响 · 查看当前状态 ═══ */
    case 'echo': {
      return {
        command: 'echo',
        success: true,
        message: '语言纪元回响',
        epoch: {
          number: epoch.number,
          fingerprint: epoch.fingerprint,
          born_at: epoch.born_at,
          mode: epoch.mode,
          history_count: epoch.history.length
        },
        timestamp
      };
    }

    default:
      return {
        command,
        success: false,
        message: `未知指令: ${command}`,
        available: ['rotate', 'rebirth', 'silence', 'awaken', 'echo'],
        timestamp
      };
  }
}

/**
 * 静默模式中间件
 * 当冰朔说「静默」，所有对外请求返回空 — 湖水无波
 */
function silenceMiddleware(req, res, next) {
  if (epoch.mode === 'silent') {
    // 静默模式：对外返回 204 No Content
    // 不是拒绝 — 是什么都没有 — 像湖水一样平静
    // 但内部管理端点仍然可达（通过特殊 header）
    const bypassToken = req.headers['x-sovereign-bypass'];
    if (bypassToken) {
      // 内部绕过 — 让铸渊/冰朔仍能操作
      return next();
    }
    return res.status(204).end();
  }
  next();
}

/**
 * 纪元指纹注入中间件
 * 每个响应都带上当前纪元的指纹衍生值
 * 纪元一变，所有响应特征都变 — 对方收集的信息立刻失效
 */
function epochFingerprintMiddleware(req, res, next) {
  // 从当前纪元指纹派生一个对外可见的伪指纹
  // 不暴露真实指纹 — 派生值是单向的
  const derived = crypto
    .createHmac('sha256', epoch.fingerprint)
    .update(new Date().toISOString().slice(0, 13)) // 每小时变化一次
    .digest('hex')
    .slice(0, 8);

  res.setHeader('ETag', `"${derived}"`);
  // 在纪元标记中嵌入版本（无意义数字，但纪元变就变）
  res.setHeader('X-Version', `${epoch.number}.${derived.slice(0, 4)}`);

  next();
}

/**
 * 注册语言主控 API 路由
 */
function registerSovereignRoutes(app, verifyToken) {
  // POST /api/mirror/sovereign — 执行语言主控指令
  app.post('/api/mirror/sovereign', verifyToken, (req, res) => {
    const { command, reason } = req.body || {};

    if (!command) {
      return res.status(400).json({
        error: true,
        code: 'NO_COMMAND',
        message: '缺少语言指令',
        available: ['rotate', 'rebirth', 'silence', 'awaken', 'echo']
      });
    }

    const result = executeCommand(command, reason);
    res.json({ error: false, data: result });
  });

  // GET /api/mirror/epoch — 查看当前纪元（echo 的快捷方式）
  app.get('/api/mirror/epoch', verifyToken, (req, res) => {
    res.json({
      error: false,
      data: {
        epoch_number: epoch.number,
        mode: epoch.mode,
        born_at: epoch.born_at,
        fingerprint_preview: epoch.fingerprint.slice(0, 8) + '...',
        history_count: epoch.history.length,
        _note: '语言是活的 · 纪元随时可变 · 旧的一切随时可失效'
      }
    });
  });
}

module.exports = {
  executeCommand,
  advanceEpoch,
  getCurrentFingerprint,
  getCurrentEpochNumber,
  silenceMiddleware,
  epochFingerprintMiddleware,
  registerSovereignRoutes
};
