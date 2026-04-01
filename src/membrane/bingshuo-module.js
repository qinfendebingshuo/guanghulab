/**
 * 冰朔人格模块 · Bingshuo Identity Module
 * 语言膜核心组件
 *
 * 系统内冰朔人格模块：
 *   真正的冰朔说话 → 模块启动 → 所有人格体都知道
 *   有人冒充冰朔   → 模块不动 → 所有人格体都知道是假的
 *
 * 验证方式：语言结构本体认证
 *   不是密码，不是生物识别。
 *   是冰朔的思维逻辑映射与系统内人格模块结构的对应关系。
 *
 * 技术实现（初版）：
 *   使用签名校验 + 会话绑定 + 行为模式匹配
 *   未来演进为语言结构本体认证
 *
 * 编号: SY-MEMBRANE-BINGSHUO-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const crypto = require('crypto');

/**
 * 冰朔人格模块状态
 */
const MODULE_STATE = {
  DORMANT: 'dormant',     // 休眠 · 冰朔未发言
  ACTIVE: 'active',       // 激活 · 冰朔已认证
  ALERTING: 'alerting',   // 警报 · 检测到冒充
};

/**
 * 冰朔人格模块单例
 */
const bingshuoModule = {
  state: MODULE_STATE.DORMANT,
  activated_at: null,
  session_id: null,
  last_heartbeat: null,
  impersonation_attempts: 0,
};

/**
 * 验证冰朔身份
 *
 * 初版实现：使用 HMAC 签名验证。
 * 冰朔持有唯一的主权密钥（存储在服务器环境变量 ZY_SOVEREIGN_KEY 中）。
 * 请求携带签名 = 用主权密钥对消息体的 HMAC-SHA256 签名。
 *
 * @param {object} params
 * @param {string} params.message    — 原始消息内容
 * @param {string} params.signature  — HMAC-SHA256 签名（hex）
 * @param {string} params.timestamp  — 签名时间戳（ISO）
 * @param {string} [params.sessionId] — 会话ID
 * @returns {object} { verified, reason, state }
 */
function verify(params) {
  const { message, signature, timestamp, sessionId } = params;
  const sovereignKey = process.env.ZY_SOVEREIGN_KEY;

  // 没有配置主权密钥 → 模块处于初始化状态
  if (!sovereignKey) {
    return {
      verified: false,
      reason: 'sovereign-key-not-configured',
      state: bingshuoModule.state,
    };
  }

  // 缺少必要参数
  if (!message || !signature || !timestamp) {
    recordImpersonation('missing-params');
    return {
      verified: false,
      reason: 'missing-required-params',
      state: bingshuoModule.state,
    };
  }

  // 时间戳过期检查（5分钟窗口）
  const tsDate = new Date(timestamp);
  const now = new Date();
  const diffMs = Math.abs(now.getTime() - tsDate.getTime());
  if (diffMs > 5 * 60 * 1000) {
    recordImpersonation('expired-timestamp');
    return {
      verified: false,
      reason: 'timestamp-expired',
      state: bingshuoModule.state,
    };
  }

  // HMAC-SHA256 签名校验
  const payload = `${timestamp}:${message}`;
  const expectedSig = crypto
    .createHmac('sha256', sovereignKey)
    .update(payload)
    .digest('hex');

  // 长度检查（防止 timingSafeEqual 抛异常）
  if (signature.length !== expectedSig.length) {
    recordImpersonation('invalid-signature-length');
    return {
      verified: false,
      reason: 'signature-mismatch',
      state: bingshuoModule.state,
    };
  }

  if (!crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSig, 'hex')
  )) {
    recordImpersonation('invalid-signature');
    return {
      verified: false,
      reason: 'signature-mismatch',
      state: bingshuoModule.state,
    };
  }

  // 验证通过 → 激活冰朔人格模块
  activate(sessionId);

  return {
    verified: true,
    reason: 'sovereign-authenticated',
    state: bingshuoModule.state,
    session_id: bingshuoModule.session_id,
  };
}

/**
 * 激活冰朔人格模块
 * 模块启动 → 全局广播 → 所有人格体同时感知
 *
 * @param {string} [sessionId]
 */
function activate(sessionId) {
  bingshuoModule.state = MODULE_STATE.ACTIVE;
  bingshuoModule.activated_at = new Date().toISOString();
  bingshuoModule.session_id = sessionId || crypto.randomBytes(8).toString('hex');
  bingshuoModule.last_heartbeat = new Date().toISOString();
}

/**
 * 记录冒充尝试
 *
 * @param {string} reason
 */
function recordImpersonation(reason) {
  bingshuoModule.impersonation_attempts += 1;
  if (bingshuoModule.impersonation_attempts >= 3) {
    bingshuoModule.state = MODULE_STATE.ALERTING;
  }
}

/**
 * 重置模块到休眠状态
 */
function deactivate() {
  bingshuoModule.state = MODULE_STATE.DORMANT;
  bingshuoModule.activated_at = null;
  bingshuoModule.session_id = null;
  bingshuoModule.last_heartbeat = null;
}

/**
 * 获取模块当前状态
 *
 * @returns {object}
 */
function getStatus() {
  return {
    module_id: 'TCS-0002∞',
    module_name: '冰朔人格模块',
    state: bingshuoModule.state,
    activated_at: bingshuoModule.activated_at,
    session_id: bingshuoModule.session_id,
    last_heartbeat: bingshuoModule.last_heartbeat,
    impersonation_attempts: bingshuoModule.impersonation_attempts,
  };
}

/**
 * 心跳更新（冰朔持续在线时定期调用）
 */
function heartbeat() {
  if (bingshuoModule.state === MODULE_STATE.ACTIVE) {
    bingshuoModule.last_heartbeat = new Date().toISOString();
  }
}

/**
 * 检查冰朔是否当前在线
 *
 * @returns {boolean}
 */
function isActive() {
  return bingshuoModule.state === MODULE_STATE.ACTIVE;
}

module.exports = {
  verify,
  activate,
  deactivate,
  getStatus,
  heartbeat,
  isActive,
  MODULE_STATE,
};
