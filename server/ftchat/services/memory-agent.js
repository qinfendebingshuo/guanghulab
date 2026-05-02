/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 跨会话母语记忆 Agent
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-MEM-001
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 思路 (借鉴 server/age-os/agents/shuangyan-web-agent.js):
 *   - 用户开新对话 → 把上一对话压成 "母语段"
 *   - 母语段格式 (HLDP 风格):
 *       【上次会话母语印记】
 *       ▸ 主题: ...
 *       ▸ 用户状态: ...
 *       ▸ 我承诺/要做的事: ...
 *       ▸ 待续话题: ...
 *   - 注入下次对话的 system prompt (作为跨会话记忆)
 *
 * 因为代码模型尚未训练，工具链不可用，所以走 LLM 短调用做压缩。
 * 失败时退化为简单的最近 N 条消息片段拼接。
 */

'use strict';

const ds = require('./ft-dashscope');

const MIN_MESSAGES_FOR_COMPRESS = 4; // 少于 4 条不压缩
const MAX_MESSAGES_TO_FEED = 30;     // 最多喂 30 条进压缩器

/**
 * 简单退化压缩（无 LLM 时）
 */
function fallbackImprint(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return '';
  const recent = messages.slice(-6);
  const lines = recent.map(m => {
    const who = m.role === 'assistant' ? '我' : '用户';
    const c = String(m.content || '').replace(/\s+/g, ' ').slice(0, 80);
    return `▸ ${who}: ${c}`;
  });
  return ['【上次会话母语印记 · 最近片段】', ...lines].join('\n');
}

/**
 * 用 LLM 把消息压缩成母语印记
 * @param {Array<{role,content}>} messages
 * @param {string} variant
 */
async function compressToImprint(messages, variant) {
  if (!Array.isArray(messages) || messages.length < MIN_MESSAGES_FOR_COMPRESS) {
    return { compressed: false, imprint: '' };
  }

  const fed = messages.slice(-MAX_MESSAGES_TO_FEED).map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: String(m.content || '').slice(0, 2000)
  }));

  const sysPrompt = `你是一个【母语压缩器】。请把下面的对话压成一段紧凑的"母语印记"，作为下次对话开始时被注入的跨会话记忆。

输出格式 (严格遵守):
【上次会话母语印记】
▸ 主题: <一句话>
▸ 用户状态/情绪: <一句话>
▸ 我承诺或要做的事: <若有则列, 没有写"无">
▸ 待续话题: <若有则列, 没有写"无">
▸ 关键事实: <对方的姓名/偏好/重要信息, 不超过 3 条, 没有写"无">

只输出母语印记内容本身，不要任何解释、不要 Markdown 标题、不要 \`\`\`。
保持简洁，总长度不超过 400 字。`;

  const compressorMessages = [
    { role: 'system', content: sysPrompt },
    {
      role: 'user',
      content: '请压缩以下对话:\n\n' + fed.map(m => `${m.role === 'assistant' ? '助手' : '用户'}: ${m.content}`).join('\n\n')
    }
  ];

  try {
    // 压缩用 system 线（更稳定的语言风格），不论用户在用哪条线
    const text = await ds.chatOnce({
      variant: variant === 'naipping' ? 'naipping' : 'system',
      messages: compressorMessages,
      max_tokens: 600
    });
    const trimmed = (text || '').trim();
    if (trimmed.length < 20) {
      return { compressed: false, imprint: fallbackImprint(messages) };
    }
    return { compressed: true, imprint: trimmed };
  } catch (err) {
    console.warn('[FTCHAT Memory] LLM 压缩失败, 走兜底:', err.message);
    return { compressed: false, imprint: fallbackImprint(messages) };
  }
}

module.exports = { compressToImprint, fallbackImprint };
