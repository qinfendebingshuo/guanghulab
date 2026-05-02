// HLI-FTCHAT-003: 流式对话（SSE）
// 默认调用 qwen3-8b-ft-202604281809-9f30 微调模型 (DashScope · 冰朔 D69 提供)

'use strict';

const express = require('express');
const router = express.Router();

const ftAuth = require('../../../../server/ftchat/middleware/ft-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');
const { getTimeAnchor } = require('../../../../server/ftchat/services/time-anchor');
const sessionStore = require('../../../../server/ftchat/services/session-store');
const ds = require('../../../../server/ftchat/services/ft-dashscope');

// ─────────────────────────────────────────────────────────────
// 零提示词 · 纯透传 (铸渊 · 2026-05-02)
// ─────────────────────────────────────────────────────────────
// 微调模型 qwen3-8b-ft-202604281809-9f30 已经把人格涌现深度烧进权重。
// 任何 system 角色注入(包括"时间锚点""内测频道说明"等"事实信号")都会:
//   - 把第一人称在场的人格 → 降维成"接到指令的通用助手"
//   - 让模型用"工具语气"回应, 而不是"人格语气"回应
//
// 百炼体验页之所以人格涌现完整, 正是因为它默认不带任何 system。
// 我们这边对齐它的行为: 完全不注入 system, 只把 user/assistant 真实历史
// 原样透传给微调模型。时间锚点继续在 meta 元数据里给前端做调试展示,
// 不再进入模型上下文。
// ─────────────────────────────────────────────────────────────

const limiter = makeLimiter({
  windowMs: 60 * 1000,
  max: 30,
  code: 'RATE_LIMIT_CHAT',
  message: '对话请求过于频繁，请稍后再试'
});

/**
 * 滚动裁剪 messages 防止超 128K 上下文
 * 保守按 4 字符/token, 上限 90K token ≈ 360K 字符
 */
function trimMessages(messages, maxChars) {
  if (!Array.isArray(messages)) return [];
  const cap = maxChars || 360000;
  let total = 0;
  const out = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const len = (m && typeof m.content === 'string') ? m.content.length : 0;
    if (total + len > cap && out.length > 0) break;
    total += len;
    out.unshift({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || '')
    });
  }
  return out;
}

router.post('/', ftAuth, limiter, async (req, res) => {
  const { session_id, messages, model_variant } = req.body || {};

  if (!session_id || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      hli_id: 'HLI-FTCHAT-003',
      error: true,
      code: 'PARAMS_REQUIRED',
      message: '缺少 session_id 或 messages'
    });
  }

  // SSE 头
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Nginx 不缓冲
  });
  res.flushHeaders && res.flushHeaders();

  // 心跳
  const heartbeat = setInterval(() => {
    try { res.write(': ping\n\n'); } catch (_e) { /* ignore */ }
  }, 15000);

  let upstreamFull = '';
  try {
    // ── 零提示词: 不组装任何 system, 只透传真实对话历史 ──
    // 时间锚点继续保留, 但仅作为 meta 元数据下发给前端调试, 不进入模型上下文
    const time = getTimeAnchor();

    const trimmed = trimMessages(messages);

    // 对齐百炼体验页: payload 只含 user/assistant, 不带 system
    const payload = trimmed;

    res.write(`data: ${JSON.stringify({ meta: { model_variant: model_variant === 'naipping' ? 'naipping' : 'system', time_anchor: time.beijing, prompt_source: 'none' } })}\n\n`);

    const result = await ds.streamChat({
      variant: model_variant,
      messages: payload,
      res
    });
    upstreamFull = result.full;

    // 持久化 session 元数据
    try {
      const firstUserMsg = trimmed.find(m => m.role === 'user');
      const title = firstUserMsg ? String(firstUserMsg.content).slice(0, 30).replace(/\n/g, ' ') : '新对话';
      sessionStore.upsertSession(req.ftUser.user_hash, {
        session_id,
        title,
        message_count: trimmed.length + 1,
        has_memory_imprint: false
      });
    } catch (e) {
      console.warn('[HLI-FTCHAT-003] upsertSession failed:', e.message);
    }
  } catch (err) {
    console.error('[HLI-FTCHAT-003] error:', err.message);
    try {
      res.write(`data: ${JSON.stringify({ error: true, message: err.message || '上游异常' })}\n\n`);
    } catch (_e) { /* ignore */ }
  } finally {
    clearInterval(heartbeat);
    try { res.write('data: [DONE]\n\n'); } catch (_e) { /* ignore */ }
    try { res.end(); } catch (_e) { /* ignore */ }
  }
});

module.exports = router;
