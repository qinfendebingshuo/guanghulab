// src/brain/context-trimmer.js
// 上下文裁剪器 — 从前端迁出的核心脑逻辑
// 职责：基于滑动窗口策略，在 token 预算内裁剪消息历史

'use strict';

const CONTEXT_CONFIG = {
  maxTokens: 200000,       // 编号登录用户 200k
  maxTokensGuest: 32000,   // 访客 32k
  systemPromptReserve: 8000, // 系统提示词预留
  overflowStrategy: 'sliding-window',
};

/**
 * 估算文本 token 数
 * CJK 字符约 1.5 字/token，拉丁字符约 4 字/token
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
  if (!text) return 0;
  const s = String(text);
  let cjk = 0, lat = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 0x4E00 && c <= 0x9FFF) || (c >= 0x3000 && c <= 0x30FF) || (c >= 0xAC00 && c <= 0xD7AF)) {
      cjk++;
    } else {
      lat++;
    }
  }
  return Math.ceil(cjk / 1.5 + lat / 4);
}

/**
 * 滑动窗口裁剪消息
 * @param {Array} systemMessages - 系统消息数组 [{role:'system', content:'...'}]
 * @param {Array} messages       - 用户/助手消息历史
 * @param {Object} opts
 * @param {boolean} opts.isGuest       - 是否为访客
 * @param {number}  opts.contextBudget - 模型路由建议的上下文窗口（可覆盖默认值）
 * @returns {{ messages: Array, trimmed: number, totalTokens: number }}
 */
function trimMessages(systemMessages, messages, opts = {}) {
  const { isGuest = false, contextBudget = 0 } = opts;

  // 确定 token 上限
  let limit;
  if (contextBudget > 0) {
    limit = contextBudget;
  } else {
    limit = isGuest ? CONTEXT_CONFIG.maxTokensGuest : CONTEXT_CONFIG.maxTokens;
  }

  const sysTokens = systemMessages.reduce((n, m) => n + estimateTokens(m.content), 0);
  const reserve = Math.max(sysTokens, CONTEXT_CONFIG.systemPromptReserve);
  const budget = limit - reserve;

  // 从最新消息向前累加，保留预算内的消息
  const kept = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const t = estimateTokens(messages[i].content);
    if (used + t > budget && kept.length > 0) break;
    kept.unshift(messages[i]);
    used += t;
  }

  const trimmed = messages.length - kept.length;

  return {
    messages: [...systemMessages, ...kept],
    trimmed,
    totalTokens: reserve + used,
  };
}

module.exports = { trimMessages, estimateTokens, CONTEXT_CONFIG };
