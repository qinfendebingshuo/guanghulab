// src/brain/model-router.js
// 任务型模型路由器 — 核心脑升级
// 职责：根据任务类型、上下文长度、成本、可用性选择最优模型
//
// 路由表：
//   chat   → 对话模型（deepseek-chat, 均衡性价比）
//   build  → 代码模型（deepseek-chat, 代码能力强）
//   review → 推理模型（deepseek-reasoner, 逻辑分析强）
//   brain  → 低温稳定模型（deepseek-chat + low temp, 输出可控）
//   long   → 长上下文模型（moonshot-v1-128k / gemini-1.5-pro）

'use strict';

/**
 * 任务-模型路由映射表
 * 每个任务类型定义：
 *   preferred: 首选 { provider, model, temperature, max_tokens }
 *   fallbacks: 降级列表（按优先级排序）
 *   context_budget: 建议上下文窗口大小
 */
const ROUTING_TABLE = {
  chat: {
    description: '普通对话 — 均衡性价比',
    preferred: { provider: 'yunwu', model: 'deepseek-chat', temperature: 0.8, max_tokens: 2000 },
    fallbacks: [
      { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.8, max_tokens: 2000 },
      { provider: 'zhipu', model: 'glm-4-flash', temperature: 0.8, max_tokens: 2000 },
      { provider: 'moonshot', model: 'moonshot-v1-8k', temperature: 0.8, max_tokens: 2000 },
    ],
    context_budget: 32000,
  },
  build: {
    description: '写代码 / 构建 — 代码能力优先',
    preferred: { provider: 'yunwu', model: 'deepseek-chat', temperature: 0.3, max_tokens: 4000 },
    fallbacks: [
      { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.3, max_tokens: 4000 },
      { provider: 'yunwu', model: 'gpt-4o', temperature: 0.3, max_tokens: 4000 },
      { provider: 'zhipu', model: 'glm-4', temperature: 0.3, max_tokens: 4000 },
    ],
    context_budget: 64000,
  },
  review: {
    description: '审查 / 分析 — 推理能力优先',
    preferred: { provider: 'yunwu', model: 'deepseek-chat', temperature: 0.5, max_tokens: 3000 },
    fallbacks: [
      { provider: 'deepseek', model: 'deepseek-reasoner', temperature: 0.5, max_tokens: 3000 },
      { provider: 'yunwu', model: 'gpt-4o', temperature: 0.5, max_tokens: 3000 },
      { provider: 'zhipu', model: 'glm-4', temperature: 0.5, max_tokens: 3000 },
    ],
    context_budget: 32000,
  },
  brain: {
    description: '脑记忆整理 — 低温稳定输出',
    preferred: { provider: 'yunwu', model: 'deepseek-chat', temperature: 0.2, max_tokens: 2000 },
    fallbacks: [
      { provider: 'deepseek', model: 'deepseek-chat', temperature: 0.2, max_tokens: 2000 },
      { provider: 'zhipu', model: 'glm-4-flash', temperature: 0.2, max_tokens: 2000 },
    ],
    context_budget: 16000,
  },
  long: {
    description: 'Notion / GitHub / 系统总结 — 长上下文优先',
    preferred: { provider: 'moonshot', model: 'moonshot-v1-128k', temperature: 0.5, max_tokens: 4000 },
    fallbacks: [
      { provider: 'yunwu', model: 'gemini-1.5-pro', temperature: 0.5, max_tokens: 4000 },
      { provider: 'yunwu', model: 'deepseek-chat', temperature: 0.5, max_tokens: 4000 },
    ],
    context_budget: 128000,
  },
};

// 模型失败记录 — 最近失败的模型暂时降低优先级
const failureLog = new Map();
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5分钟冷却

/**
 * 记录模型失败
 * @param {string} provider
 * @param {string} model
 */
function recordFailure(provider, model) {
  const key = provider + '/' + model;
  const entry = failureLog.get(key) || { count: 0, lastFail: 0 };
  entry.count++;
  entry.lastFail = Date.now();
  failureLog.set(key, entry);
}

/**
 * 检查模型是否在冷却期
 * @param {string} provider
 * @param {string} model
 * @returns {boolean}
 */
function isInCooldown(provider, model) {
  const key = provider + '/' + model;
  const entry = failureLog.get(key);
  if (!entry) return false;
  if (Date.now() - entry.lastFail > FAILURE_COOLDOWN_MS) {
    failureLog.delete(key);
    return false;
  }
  return entry.count >= 3; // 5分钟内失败3次及以上才冷却
}

/**
 * 根据任务模式选择最优模型
 * @param {string} mode - 任务模式 (chat/build/review/brain/long)
 * @param {Object} opts
 * @param {number} opts.contextLength  - 当前上下文 token 数
 * @param {boolean} opts.isGuest       - 是否为访客
 * @returns {{ provider: string, model: string, temperature: number, max_tokens: number, context_budget: number, via: string }}
 */
function selectModel(mode, opts = {}) {
  const { contextLength = 0, isGuest = false } = opts;

  // 访客强制使用低成本配置
  if (isGuest) {
    return {
      provider: 'yunwu',
      model: 'deepseek-chat',
      temperature: 0.8,
      max_tokens: 1500,
      context_budget: 32000,
      via: 'guest-fixed',
    };
  }

  // 如果上下文很长，自动升级到长上下文模式
  const effectiveMode = (contextLength > 60000 && mode !== 'long') ? 'long' : mode;
  const route = ROUTING_TABLE[effectiveMode] || ROUTING_TABLE.chat;

  // 尝试首选模型
  if (!isInCooldown(route.preferred.provider, route.preferred.model)) {
    return {
      ...route.preferred,
      context_budget: route.context_budget,
      via: 'preferred',
    };
  }

  // 首选模型在冷却期，尝试 fallback
  for (const fb of route.fallbacks) {
    if (!isInCooldown(fb.provider, fb.model)) {
      return {
        ...fb,
        context_budget: route.context_budget,
        via: 'fallback',
      };
    }
  }

  // 所有模型都在冷却期，强制使用首选（宁可重试也不能无响应）
  return {
    ...route.preferred,
    context_budget: route.context_budget,
    via: 'forced-retry',
  };
}

/**
 * 获取完整路由表（用于前端展示和调试）
 */
function getRoutingTable() {
  return ROUTING_TABLE;
}

/**
 * 获取当前失败状态
 */
function getFailureStatus() {
  const status = {};
  for (const [key, entry] of failureLog.entries()) {
    const inCooldown = Date.now() - entry.lastFail < FAILURE_COOLDOWN_MS && entry.count >= 3;
    status[key] = {
      failures: entry.count,
      lastFail: new Date(entry.lastFail).toISOString(),
      inCooldown,
    };
  }
  return status;
}

module.exports = {
  selectModel,
  recordFailure,
  isInCooldown,
  getRoutingTable,
  getFailureStatus,
  ROUTING_TABLE,
};
