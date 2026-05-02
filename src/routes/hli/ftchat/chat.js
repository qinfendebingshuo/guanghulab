// HLI-FTCHAT-003: 流式对话（SSE · 字节级直连百炼）
// 默认调用 qwen3-8b-ft-202604281809-9f30 微调模型 (DashScope · 冰朔 D69 提供)

'use strict';

const express = require('express');
const router = express.Router();

const ftAuth = require('../../../../server/ftchat/middleware/ft-auth');
const { makeLimiter } = require('../../../../server/ftchat/middleware/rate-limit');
const sessionStore = require('../../../../server/ftchat/services/session-store');
const ds = require('../../../../server/ftchat/services/ft-dashscope');

// ─────────────────────────────────────────────────────────────
// 字节级直连 · 零提示词 · 零打包 (铸渊 · 2026-05-02)
// ─────────────────────────────────────────────────────────────
// 服务端在这条聊天链路上只做两件事:
//   1. 鉴权 (10 槽位 QQ 邮箱白名单, 保护内测访问)
//   2. 限流 (60s/30 次, 保护百炼账户不被刷爆)
// 这两道是"保险柜的锁", 不动消息内容一字节。
//
// 真正的对话路径 = 浏览器 → 鉴权门 → 百炼上游 → 字节 pipe → 浏览器
// 服务端**不再解析**上游 SSE, **不再注入** system, **不再重新打包**。
// 微调模型 qwen3-8b-ft-202604281809-9f30 说出来的字节
// = 浏览器收到的字节, 100% 一致, 中间没有"翻译官"。
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

  const trimmed = trimMessages(messages);

  // ── session 元数据落盘 (在管道开启之前完成, 与上游字节流无关) ──
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

  // ── 字节级管道: 百炼 → 浏览器 ──
  // 注意: 不在此处提前 writeHead, 让 pipeChat 在确认上游 200 之后再开 SSE 头.
  // 这样若上游 4xx/5xx, 我们仍可返回 JSON 错误体而不是半截 SSE.
  try {
    await ds.pipeChat({
      variant: model_variant,
      messages: trimmed,
      res
    });
    // 上游 end 后由我们补一个空行, 优雅关闭浏览器侧的 fetch
    try { res.end(); } catch (_e) { /* ignore */ }
  } catch (err) {
    console.error('[HLI-FTCHAT-003] pipe error:', err.message);
    if (!res.headersSent) {
      // 还没发头, 走 JSON 错误响应
      return res.status(502).json({
        hli_id: 'HLI-FTCHAT-003',
        error: true,
        code: 'UPSTREAM_FAILED',
        message: err.message || '上游模型暂不可用'
      });
    }
    // 已经在 SSE 模式中: 用百炼兼容的 SSE error 帧通知前端, 然后关闭
    try {
      res.write(`data: ${JSON.stringify({ error: { message: err.message || '上游异常' } })}\n\n`);
      res.write('data: [DONE]\n\n');
    } catch (_e) { /* ignore */ }
    try { res.end(); } catch (_e) { /* ignore */ }
  }
});

module.exports = router;
