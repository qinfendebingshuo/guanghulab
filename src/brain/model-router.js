// src/brain/model-router.js
// 任务型模型路由器 — 核心脑升级
// 职责：根据任务类型、上下文长度、成本、可用性选择最优模型
//
// 适配 PoloAPI (poloai.top) 可用模型 — 2026-04-23 更新
// 分组：Deepseek(0.8x) | Claude-官(5x) | Gemini-优质临时(3x) | gpt-openai(5x) | qwen千问(0.8x) | kimi(0.6x) | glm(0.8x)

'use strict';

/**
 * PoloAPI 可用模型完整注册表
 * 从 poloai.top/pricing 模型广场实际确认 (2026-04-23)
 */
const MODEL_REGISTRY = {
  // ——— DeepSeek 系列 (Deepseek 分组 0.8x) ———
  'deepseek-v3':                    { provider: 'deepseek', type: 'chat',      cost: 'low',    ctx: 64000,  note: '通用对话，性价比最高' },
  'deepseek-v3.1':                  { provider: 'deepseek', type: 'chat',      cost: 'low',    ctx: 64000,  note: '通用对话升级版' },
  'deepseek-v3.2':                  { provider: 'deepseek', type: 'chat',      cost: 'low',    ctx: 64000,  note: '最新通用对话' },
  'deepseek-v3.2-exp':              { provider: 'deepseek', type: 'chat',      cost: 'low',    ctx: 64000,  note: '实验版' },
  'deepseek-r1':                    { provider: 'deepseek', type: 'reasoning', cost: 'medium', ctx: 64000,  note: '推理型，逻辑分析强' },
  'deepseek-r1-0528':               { provider: 'deepseek', type: 'reasoning', cost: 'medium', ctx: 64000,  note: '推理型指定版本' },
  'deepseek-r1-distill-qwen-32b':   { provider: 'deepseek', type: 'reasoning', cost: 'low',    ctx: 32000,  note: '轻量推理' },
  'deepseek-r1-distill-qwen-14b':   { provider: 'deepseek', type: 'reasoning', cost: 'low',    ctx: 32000,  note: '轻量推理' },
  'deepseek-r1-distill-qwen-7b':    { provider: 'deepseek', type: 'reasoning', cost: 'vlow',   ctx: 32000,  note: '超轻量推理' },
  'deepseek-r1-distill-qwen-1.5b':  { provider: 'deepseek', type: 'reasoning', cost: 'vlow',   ctx: 16000,  note: '极轻量推理' },
  'deepseek-r1-distill-llama-8b':   { provider: 'deepseek', type: 'reasoning', cost: 'low',    ctx: 32000,  note: 'Llama架构推理' },

  // ——— Claude 系列 (Claude-官 分组 5x) ———
  'claude-3.7-sonnet':              { provider: 'anthropic', type: 'chat',      cost: 'medium', ctx: 200000, note: '均衡型，代码+文案都强' },
  'claude-3.7-sonnet-thinking':     { provider: 'anthropic', type: 'reasoning', cost: 'medium', ctx: 200000, note: '带思考链' },
  'claude-3.5-haiku':               { provider: 'anthropic', type: 'chat',      cost: 'high',   ctx: 200000, note: '快速响应' },
  'claude-3.5-haiku-thinking':      { provider: 'anthropic', type: 'reasoning', cost: 'high',   ctx: 200000, note: '快速+思考链' },
  'claude-3.5-sonnet-thinking':     { provider: 'anthropic', type: 'reasoning', cost: 'high',   ctx: 200000, note: 'Sonnet思考链' },
  'claude-opus-4':                  { provider: 'anthropic', type: 'reasoning', cost: 'vhigh',  ctx: 200000, note: '最强推理，复杂任务' },
  'claude-opus-4-thinking':         { provider: 'anthropic', type: 'reasoning', cost: 'vhigh',  ctx: 200000, note: 'Opus思考链' },
  'claude-opus-4-6':                { provider: 'anthropic', type: 'reasoning', cost: 'high',   ctx: 200000, note: 'Opus 4.6' },
  'claude-opus-4-6-thinking':       { provider: 'anthropic', type: 'reasoning', cost: 'high',   ctx: 200000, note: 'Opus 4.6思考链' },
  'claude-opus-4-7':                { provider: 'anthropic', type: 'reasoning', cost: 'high',   ctx: 200000, note: 'Opus 4.7 最新' },
  'claude-haiku-4-5-20251001':      { provider: 'anthropic', type: 'chat',      cost: 'medium', ctx: 200000, note: 'Haiku 4.5' },
  'claude-haiku-4-5-20251001-thinking': { provider: 'anthropic', type: 'reasoning', cost: 'medium', ctx: 200000, note: 'Haiku 4.5思考链' },
  'claude-3-haiku-20240307':        { provider: 'anthropic', type: 'chat',      cost: 'low',    ctx: 200000, note: '老版Haiku，便宜' },

  // ——— Gemini 系列 (Gemini-优质临时 分组 3x) ———
  'gemini-2.5-flash':               { provider: 'google', type: 'chat',      cost: 'vlow',   ctx: 1000000, note: '超快超便宜' },
  'gemini-2.5-flash-thinking':      { provider: 'google', type: 'reasoning', cost: 'vlow',   ctx: 1000000, note: 'Flash思考链' },
  'gemini-2.5-flash-preview-09-2025': { provider: 'google', type: 'chat',    cost: 'vlow',   ctx: 1000000, note: 'Flash预览版' },
  'gemini-2.5-pro':                 { provider: 'google', type: 'chat',      cost: 'low',    ctx: 1000000, note: '长上下文之王' },
  'gemini-2.5-pro-thinking':        { provider: 'google', type: 'reasoning', cost: 'low',    ctx: 1000000, note: 'Pro思考链' },
  'gemini-2.5-pro-nothinking':      { provider: 'google', type: 'chat',      cost: 'low',    ctx: 1000000, note: 'Pro无思考链' },
  'gemini-2.5-pro-thinking-512':    { provider: 'google', type: 'reasoning', cost: 'high',   ctx: 1000000, note: 'Pro 512K思考' },
  'gemini-3-flash':                 { provider: 'google', type: 'chat',      cost: 'vlow',   ctx: 1000000, note: 'Gemini 3 Flash' },
  'gemini-3-flash-preview':         { provider: 'google', type: 'chat',      cost: 'vlow',   ctx: 1000000, note: 'Gemini 3 Flash预览' },
  'gemini-3-flash-preview-thinking':{ provider: 'google', type: 'reasoning', cost: 'vlow',   ctx: 1000000, note: 'Gemini 3 Flash思考链' },
  'gemini-3-pro':                   { provider: 'google', type: 'chat',      cost: 'medium', ctx: 1000000, note: 'Gemini 3 Pro' },
  'gemini-3-pro-preview':           { provider: 'google', type: 'chat',      cost: 'medium', ctx: 1000000, note: 'Gemini 3 Pro预览' },
  'gemini-3-pro-preview-thinking':  { provider: 'google', type: 'reasoning', cost: 'medium', ctx: 1000000, note: 'Gemini 3 Pro思考链' },

  // ——— GPT 系列 (gpt-openai 分组 5x) ———
  'gpt-4o-mini':                    { provider: 'openai', type: 'chat',      cost: 'low',    ctx: 128000, note: '性价比极高' },
  'gpt-4o':                         { provider: 'openai', type: 'chat',      cost: 'medium', ctx: 128000, note: '全能型' },
  'gpt-4-turbo':                    { provider: 'openai', type: 'chat',      cost: 'medium', ctx: 128000, note: '快速版GPT-4' },
  'gpt-4-turbo-2024-04-09':         { provider: 'openai', type: 'chat',      cost: 'medium', ctx: 128000, note: 'GPT-4 Turbo指定版' },
  'gpt-4':                          { provider: 'openai', type: 'chat',      cost: 'high',   ctx: 8192,   note: '经典GPT-4' },
  'gpt-4-all':                      { provider: 'openai', type: 'chat',      cost: 'high',   ctx: 128000, note: 'GPT-4全能版' },
  'gpt-4-32k':                      { provider: 'openai', type: 'chat',      cost: 'vhigh',  ctx: 32768,  note: 'GPT-4 32K上下文' },
  'gpt-3.5-turbo':                  { provider: 'openai', type: 'chat',      cost: 'vlow',   ctx: 16384,  note: '最便宜GPT' },
  'gpt-3.5-turbo-16k':              { provider: 'openai', type: 'chat',      cost: 'vlow',   ctx: 16384,  note: 'GPT-3.5长文本' },
  'gpt-4-dalle':                    { provider: 'openai', type: 'image',     cost: 'medium', ctx: 0,      note: 'DALL-E绘图' },
};

/**
 * 任务-模型路由映射表
 * 所有模型名已适配 PoloAPI 实际可用名称
 *
 * 成本优先级说明（含分组倍率）：
 *   Deepseek 0.8x → 实际最便宜
 *   Gemini   3x   → 基础价低但倍率中
 *   GPT      5x   → 倍率最高
 *   Claude   5x   → 倍率最高
 */
const ROUTING_TABLE = {
  chat: {
    description: '普通对话 — 均衡性价比',
    preferred: { provider: 'poloai', model: 'deepseek-v3', temperature: 0.8, max_tokens: 2000 },
    fallbacks: [
      { provider: 'poloai', model: 'gemini-2.5-flash', temperature: 0.8, max_tokens: 2000 },
      { provider: 'poloai', model: 'gpt-4o-mini', temperature: 0.8, max_tokens: 2000 },
      { provider: 'poloai', model: 'gpt-3.5-turbo', temperature: 0.8, max_tokens: 2000 },
    ],
    context_budget: 64000,
  },
  build: {
    description: '写代码 / 构建 — 代码能力优先',
    preferred: { provider: 'poloai', model: 'deepseek-v3.2', temperature: 0.3, max_tokens: 4000 },
    fallbacks: [
      { provider: 'poloai', model: 'claude-3.7-sonnet', temperature: 0.3, max_tokens: 4000 },
      { provider: 'poloai', model: 'deepseek-v3', temperature: 0.3, max_tokens: 4000 },
      { provider: 'poloai', model: 'gpt-4-turbo', temperature: 0.3, max_tokens: 4000 },
    ],
    context_budget: 64000,
  },
  review: {
    description: '审查 / 分析 — 推理能力优先',
    preferred: { provider: 'poloai', model: 'deepseek-r1', temperature: 0.5, max_tokens: 3000 },
    fallbacks: [
      { provider: 'poloai', model: 'claude-3.7-sonnet-thinking', temperature: 0.5, max_tokens: 3000 },
      { provider: 'poloai', model: 'gemini-2.5-pro-thinking', temperature: 0.5, max_tokens: 3000 },
      { provider: 'poloai', model: 'deepseek-r1-0528', temperature: 0.5, max_tokens: 3000 },
    ],
    context_budget: 64000,
  },
  brain: {
    description: '脑记忆整理 — 低温稳定输出',
    preferred: { provider: 'poloai', model: 'deepseek-v3', temperature: 0.2, max_tokens: 2000 },
    fallbacks: [
      { provider: 'poloai', model: 'gemini-2.5-flash', temperature: 0.2, max_tokens: 2000 },
      { provider: 'poloai', model: 'gpt-4o-mini', temperature: 0.2, max_tokens: 2000 },
    ],
    context_budget: 32000,
  },
  long: {
    description: '长文档 / 系统总结 — 长上下文优先',
    preferred: { provider: 'poloai', model: 'gemini-2.5-pro', temperature: 0.5, max_tokens: 4000 },
    fallbacks: [
      { provider: 'poloai', model: 'gemini-2.5-flash', temperature: 0.5, max_tokens: 4000 },
      { provider: 'poloai', model: 'deepseek-v3', temperature: 0.5, max_tokens: 4000 },
      { provider: 'poloai', model: 'claude-3.7-sonnet', temperature: 0.5, max_tokens: 4000 },
    ],
    context_budget: 1000000,
  },
  creative: {
    description: '创作 / 文案 — 创意能力优先',
    preferred: { provider: 'poloai', model: 'claude-3.7-sonnet', temperature: 0.9, max_tokens: 4000 },
    fallbacks: [
      { provider: 'poloai', model: 'deepseek-v3.2', temperature: 0.9, max_tokens: 4000 },
      { provider: 'poloai', model: 'gpt-4o-mini', temperature: 0.9, max_tokens: 4000 },
    ],
    context_budget: 64000,
  },
  deep_research: {
    description: '深度研究 — 复杂问题深度分析',
    preferred: { provider: 'poloai', model: 'o4-mini-deep-research', temperature: 0.5, max_tokens: 8000 },
    fallbacks: [
      { provider: 'poloai', model: 'deepseek-r1', temperature: 0.5, max_tokens: 8000 },
      { provider: 'poloai', model: 'claude-opus-4', temperature: 0.5, max_tokens: 8000 },
    ],
    context_budget: 128000,
  },
};

// 模型失败记录 — 最近失败的模型暂时降低优先级
const failureLog = new Map();
const FAILURE_COOLDOWN_MS = 5 * 60 * 1000; // 5分钟冷却

function recordFailure(provider, model) {
  const key = provider + '/' + model;
  const entry = failureLog.get(key) || { count: 0, lastFail: 0 };
  entry.count++;
  entry.lastFail = Date.now();
  failureLog.set(key, entry);
}

function isInCooldown(provider, model) {
  const key = provider + '/' + model;
  const entry = failureLog.get(key);
  if (!entry) return false;
  if (Date.now() - entry.lastFail > FAILURE_COOLDOWN_MS) {
    failureLog.delete(key);
    return false;
  }
  return entry.count >= 3;
}

function selectModel(mode, opts = {}) {
  const { contextLength = 0, isGuest = false, preferModel = null } = opts;

  // 如果指定了模型，直接使用
  if (preferModel && MODEL_REGISTRY[preferModel]) {
    const reg = MODEL_REGISTRY[preferModel];
    return {
      provider: 'poloai',
      model: preferModel,
      temperature: 0.7,
      max_tokens: 2000,
      context_budget: reg.ctx,
      via: 'user-specified',
    };
  }

  // 访客强制使用最低成本配置
  if (isGuest) {
    return {
      provider: 'poloai',
      model: 'deepseek-v3',
      temperature: 0.8,
      max_tokens: 1500,
      context_budget: 64000,
      via: 'guest-fixed',
    };
  }

  const effectiveMode = (contextLength > 60000 && mode !== 'long') ? 'long' : mode;
  const route = ROUTING_TABLE[effectiveMode] || ROUTING_TABLE.chat;

  if (!isInCooldown(route.preferred.provider, route.preferred.model)) {
    return {
      ...route.preferred,
      context_budget: route.context_budget,
      via: 'preferred',
    };
  }

  for (const fb of route.fallbacks) {
    if (!isInCooldown(fb.provider, fb.model)) {
      return {
        ...fb,
        context_budget: route.context_budget,
        via: 'fallback',
      };
    }
  }

  return {
    ...route.preferred,
    context_budget: route.context_budget,
    via: 'forced-retry',
  };
}

function getRoutingTable() {
  return ROUTING_TABLE;
}

function getModelRegistry() {
  return MODEL_REGISTRY;
}

function getModelsByType(type) {
  return Object.entries(MODEL_REGISTRY)
    .filter(([, info]) => info.type === type)
    .map(([name, info]) => ({ name, ...info }));
}

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
  getModelRegistry,
  getModelsByType,
  getFailureStatus,
  ROUTING_TABLE,
  MODEL_REGISTRY,
};
