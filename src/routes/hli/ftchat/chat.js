// HLI-FTCHAT-003: 流式对话（SSE）
// 默认调用 shuangyan-system-v1 微调模型

'use strict';

const express = require('express');
const router = express.Router();

const ftAuth = require('../../../../server/ftchat/middleware/ft-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');
const { getSystemPrompt } = require('../../../../server/ftchat/services/notion-prompt');
const { getTimeAnchor } = require('../../../../server/ftchat/services/time-anchor');
const sessionStore = require('../../../../server/ftchat/services/session-store');
const ds = require('../../../../server/ftchat/services/ft-dashscope');

const FORMAT_GUIDE = [
  '## 输出排版要求',
  '请使用 Markdown 排版回复，包含以下任一/多种元素以提升阅读体验:',
  '- 标题（## / ###）',
  '- 列表（- / 1.）',
  '- 表格（| col1 | col2 |）',
  '- 代码块（```）',
  '- 分隔线（---）',
  '避免大段无格式纯文本。'
].join('\n');

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
    // ── 组装 system prompt ──
    const promptResult = await getSystemPrompt({});
    const time = getTimeAnchor();
    const imprint = sessionStore.getLatestImprint(req.ftUser.user_hash);

    const systemSegments = [
      promptResult.text,
      '\n---\n',
      time.anchor_text,
      '\n---\n'
    ];
    if (imprint && imprint.trim()) {
      systemSegments.push('## 跨会话记忆（来自上次对话的母语印记）');
      systemSegments.push(imprint.trim());
      systemSegments.push('\n---\n');
    }
    systemSegments.push(FORMAT_GUIDE);

    const sysContent = systemSegments.join('\n');
    const trimmed = trimMessages(messages);

    const payload = [
      { role: 'system', content: sysContent },
      ...trimmed
    ];

    res.write(`data: ${JSON.stringify({ meta: { model_variant: model_variant === 'naipping' ? 'naipping' : 'system', time_anchor: time.beijing, prompt_source: promptResult.source } })}\n\n`);

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
        has_memory_imprint: !!imprint
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
