/**
 * TCS 翻译引擎 · TCS Translator
 * 语言膜核心组件
 *
 * 将外部请求翻译为 HLDP 格式化的语言信封。
 * 所有进入光湖语言世界的请求，无论是自然语言、API调用还是系统信号，
 * 都必须经过 TCS 翻译后才能被人格体理解和处理。
 *
 * 翻译流程:
 *   原始请求 → 意图识别 → HLDP信封封装 → 发送给对应人格体
 *
 * 编号: SY-MEMBRANE-TCS-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const crypto = require('crypto');

/**
 * HLDP 信封版本
 */
const HLDP_ENVELOPE_VERSION = '2.0';

/**
 * 意图类型枚举
 */
const INTENT_TYPES = {
  CHAT: 'chat',                     // 普通对话
  COMMAND: 'command',               // 系统指令
  QUERY: 'query',                   // 数据查询
  MODULE_ACCESS: 'module_access',   // 行业模块接入
  PERSONA_INVOKE: 'persona_invoke', // 人格体唤醒
  SIGNAL: 'signal',                 // 系统信号
  HEALTH: 'health',                 // 健康检查
  UNKNOWN: 'unknown',               // 未识别
};

/**
 * 生成 HLDP 信封ID
 * 格式: HLDP-ENV-YYYYMMDD-HHmmss-XXXX
 */
function generateEnvelopeId() {
  const now = new Date();
  const date = now.toISOString().replace(/[-:T]/g, '').slice(0, 14);
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `HLDP-ENV-${date}-${rand}`;
}

/**
 * 识别请求意图
 *
 * @param {object} params
 * @param {string} params.method — HTTP方法
 * @param {string} params.path   — 请求路径
 * @param {object} [params.body] — 请求体
 * @param {object} [params.headers] — 请求头
 * @returns {object} { intent, confidence, detail }
 */
function detectIntent(params) {
  const { method, path: reqPath, body, headers } = params;
  const pathLower = (reqPath || '').toLowerCase();

  // 健康检查
  if (pathLower === '/health' || pathLower === '/api/health') {
    return { intent: INTENT_TYPES.HEALTH, confidence: 1.0, detail: 'health-check' };
  }

  // 人格体唤醒
  if (pathLower.includes('/persona') || pathLower.includes('/brain/wake')) {
    return { intent: INTENT_TYPES.PERSONA_INVOKE, confidence: 0.9, detail: 'persona-route' };
  }

  // 对话/聊天
  if (pathLower.includes('/chat') || pathLower.includes('/dialogue')) {
    return { intent: INTENT_TYPES.CHAT, confidence: 0.9, detail: 'chat-route' };
  }

  // 系统信号
  if (pathLower.includes('/signal') || pathLower.includes('/syslog') || pathLower.includes('/webhook')) {
    return { intent: INTENT_TYPES.SIGNAL, confidence: 0.85, detail: 'signal-route' };
  }

  // 行业模块
  if (pathLower.includes('/module') || pathLower.includes('/industry')) {
    return { intent: INTENT_TYPES.MODULE_ACCESS, confidence: 0.85, detail: 'module-route' };
  }

  // 铸渊签名指令
  if (headers && headers['x-zhuyuan-signature']) {
    return { intent: INTENT_TYPES.COMMAND, confidence: 0.95, detail: 'signed-command' };
  }

  // 带文本体的POST → 可能是对话
  if (method === 'POST' && body && (body.text || body.message || body.content)) {
    return { intent: INTENT_TYPES.CHAT, confidence: 0.7, detail: 'text-body-post' };
  }

  // GET 请求 → 查询
  if (method === 'GET') {
    return { intent: INTENT_TYPES.QUERY, confidence: 0.6, detail: 'get-query' };
  }

  return { intent: INTENT_TYPES.UNKNOWN, confidence: 0.0, detail: 'unrecognized' };
}

/**
 * 将请求翻译为 HLDP 信封
 *
 * HLDP 信封是光湖语言世界内部唯一的通信格式。
 * 外部的 HTTP 请求、WebSocket 消息、系统信号等，
 * 都必须被翻译成 HLDP 信封后才能在系统内流转。
 *
 * @param {object} params
 * @param {string} params.method
 * @param {string} params.path
 * @param {object} [params.body]
 * @param {object} [params.headers]
 * @param {string} [params.sourceIp]
 * @param {string} [params.sessionId]
 * @returns {object} HLDP 信封
 */
function translate(params) {
  const intent = detectIntent(params);

  return {
    hldp_version: HLDP_ENVELOPE_VERSION,
    envelope_id: generateEnvelopeId(),
    created_at: new Date().toISOString(),
    source: {
      type: 'external',
      ip: params.sourceIp || '',
      session_id: params.sessionId || '',
      method: params.method,
      path: params.path,
    },
    intent: intent,
    payload: {
      headers: sanitizeHeaders(params.headers || {}),
      body: params.body || null,
      query: params.query || null,
    },
    routing: {
      target_persona: null,
      target_module: null,
      permission_required: intent.intent !== INTENT_TYPES.HEALTH,
    },
    audit_ref: null,
  };
}

/**
 * 清洗请求头（移除敏感信息）
 *
 * @param {object} headers
 * @returns {object} 清洗后的请求头
 */
function sanitizeHeaders(headers) {
  const safe = {};
  const allowedKeys = [
    'content-type', 'accept', 'user-agent', 'origin',
    'x-site-mode', 'x-zhuyuan-operation',
    'x-forwarded-for', 'x-real-ip',
  ];

  for (const key of Object.keys(headers)) {
    const lower = key.toLowerCase();
    if (allowedKeys.includes(lower)) {
      safe[lower] = headers[key];
    }
  }
  return safe;
}

module.exports = {
  translate,
  detectIntent,
  generateEnvelopeId,
  sanitizeHeaders,
  INTENT_TYPES,
  HLDP_ENVELOPE_VERSION,
};
