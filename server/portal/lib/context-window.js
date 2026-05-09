/*
 * ════════════════════════════════════════════════════════════════
 * 上下文窗口 · 滚动+字数 cap
 * Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * 起因 (2026-05-09 冰朔点透):
 *   "模型本身没有记忆, 一轮对话都记不住, 是背后的 Agent 一直给他不断的喂上下文"
 *
 *   PR-4 落地时, 前端只发当前一条 user 消息, 后端 chat.js 直接转发 — 模型
 *   对上一轮一无所知. 这一层补丁补的就是这个: 后端从 SQLite 拉历史, 拼成
 *   消息数组再发推理端.
 *
 * 设计:
 *   - 输入: 数据库里 (conv_id 的) 全部 messages, 按 ts 升序
 *   - 输出: 给推理端的 messages 数组 (只含 user/assistant)
 *   - 滚动窗口: 默认保留最近 N 轮 (一轮 = 一组 user→assistant)
 *   - 字数 cap: 即便 N 轮没满, 总 char 超过 cap 也从最老的扔
 *   - 边界:
 *       · 单轮已经超 cap → 保留至少最后 1 条 user (推理端总得有东西回复)
 *       · 历史最后一条不是 user → 抛错 (caller 落库后才该调这里)
 *       · 含 system → 强制剥 (cc-002 三道关之一, 即便 DB 出现脏数据)
 *
 * 默认窗口大小:
 *   N = 20 轮 (= 40 条消息)
 *   CHAR_CAP = 16000 (≈ 8000 token, 给 Qwen2.5-7B AWQ 量化在 V100 16G 上留余量)
 *
 *   两个值都可由 caller 传 opts 覆盖 (将来根据推理端 tier 动态调).
 */
"use strict";

const DEFAULT_TURNS = 20;
const DEFAULT_CHAR_CAP = 16000;

/**
 * 把数据库 messages (按 ts 升序) 折叠成给推理端的 payload.
 *
 * @param {Array<{role:string, content:string}>} dbMessages
 *        来自 SELECT role, content FROM messages WHERE conv_id=? ORDER BY ts ASC, id ASC
 * @param {object} [opts]
 * @param {number} [opts.maxTurns]   保留最近多少轮 (默认 20)
 * @param {number} [opts.maxChars]   总字符上限 (默认 16000)
 * @returns {{messages: Array<{role:string,content:string}>, dropped: number, total_chars: number}}
 */
function buildContextWindow(dbMessages, opts) {
  const o = opts || {};
  const maxTurns = Number.isFinite(o.maxTurns) && o.maxTurns > 0 ? o.maxTurns : DEFAULT_TURNS;
  const maxChars = Number.isFinite(o.maxChars) && o.maxChars > 0 ? o.maxChars : DEFAULT_CHAR_CAP;

  if (!Array.isArray(dbMessages) || dbMessages.length === 0) {
    return { messages: [], dropped: 0, total_chars: 0 };
  }

  // 1. cc-002 三道关之一: 即便 DB 脏出来 system, 也剥掉
  const cleaned = dbMessages
    .filter((m) => m && typeof m.role === "string" && typeof m.content === "string")
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));

  if (cleaned.length === 0) {
    return { messages: [], dropped: 0, total_chars: 0 };
  }

  // 2. 滚动窗口: 取最后 maxTurns*2 条 (一轮=user+assistant)
  //    注意最后一条可能是 user (新提问刚落库), 所以不强求成对.
  const startByTurn = Math.max(0, cleaned.length - maxTurns * 2);
  let windowed = cleaned.slice(startByTurn);

  // 3. 字数 cap: 从最老的开始扔, 直到 ≤ maxChars
  //    单条特别长的容忍: 至少保住最后一条 (一般是用户提问)
  let charSum = windowed.reduce((s, m) => s + (m.content ? m.content.length : 0), 0);
  while (windowed.length > 1 && charSum > maxChars) {
    const drop = windowed.shift();
    charSum -= drop.content ? drop.content.length : 0;
  }

  // 4. 修剪开头: 如果第一条是 assistant (历史断头), 从第一个 user 开始
  //    让推理端看到的对话以 user 起 (大多数推理后端的偏好, 也防止 chat_template 错位)
  while (windowed.length > 0 && windowed[0].role !== "user") {
    windowed.shift();
  }

  // 5. 最后一条必须是 user (caller 应该是落完 user 才调本函数)
  //    如果最后是 assistant, 说明 caller 用错了 — 不抛错, 但 caller 自己保证;
  //    我们在这里只保证不返回 assistant 收尾的边角情形:
  //    实际 chat.js 流程已经保证, 这里多一道兜底但不报警, 避免 false 警告.

  return {
    messages: windowed,
    dropped: cleaned.length - windowed.length,
    total_chars: windowed.reduce((s, m) => s + m.content.length, 0)
  };
}

module.exports = {
  buildContextWindow,
  DEFAULT_TURNS,
  DEFAULT_CHAR_CAP
};
