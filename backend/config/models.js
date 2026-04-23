// backend/config/models.js
// 模型路由配置 — 适配 PoloAPI (poloai.top)
// 更新时间: 2026-04-23
// 分组: Deepseek(0.8x) | Claude-官(5x) | Gemini-优质临时(3x) | gpt-openai(5x) | qwen千问(0.8x) | kimi(0.6x) | glm(0.8x)

const API_KEY = process.env.ZY_LLM_API_KEY || process.env.PRIMARY_API_KEY;
const BASE_URL = process.env.ZY_LLM_BASE_URL || 'https://poloai.top/v1';
const API_URL = BASE_URL + '/chat/completions';

// ━━━ 完整模型配置 ━━━
const MODELS = {

  // ── DeepSeek 系列 (Deepseek 分组 0.8x · 性价比最高) ──
  'deepseek-v3': {
    name: 'DeepSeek V3',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-v3',
    maxTokens: 4096,
    group: 'deepseek',
    costTier: 'low',
    note: '通用对话，默认首选'
  },
  'deepseek-v3.1': {
    name: 'DeepSeek V3.1',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-v3.1',
    maxTokens: 4096,
    group: 'deepseek',
    costTier: 'low',
    note: '通用对话升级版'
  },
  'deepseek-v3.2': {
    name: 'DeepSeek V3.2',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-v3.2',
    maxTokens: 4096,
    group: 'deepseek',
    costTier: 'low',
    note: '最新通用对话'
  },
  'deepseek-v3.2-exp': {
    name: 'DeepSeek V3.2 实验版',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-v3.2-exp',
    maxTokens: 4096,
    group: 'deepseek',
    costTier: 'low',
    note: '实验版'
  },
  'deepseek-r1': {
    name: 'DeepSeek R1 推理',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-r1',
    maxTokens: 8192,
    group: 'deepseek',
    costTier: 'medium',
    note: '推理型，逻辑分析强'
  },
  'deepseek-r1-0528': {
    name: 'DeepSeek R1-0528',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-r1-0528',
    maxTokens: 8192,
    group: 'deepseek',
    costTier: 'medium',
    note: '推理型指定版本'
  },
  'deepseek-r1-distill-qwen-32b': {
    name: 'DeepSeek R1-Distill-32B',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'deepseek-r1-distill-qwen-32b',
    maxTokens: 4096,
    group: 'deepseek',
    costTier: 'low',
    note: '轻量推理'
  },

  // ── Claude 系列 (Claude-官 分组 5x) ──
  'claude-3.7-sonnet': {
    name: 'Claude 3.7 Sonnet',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'claude-3.7-sonnet',
    maxTokens: 4096,
    group: 'claude',
    costTier: 'medium',
    note: '均衡型，代码+文案都强'
  },
  'claude-3.7-sonnet-thinking': {
    name: 'Claude 3.7 Sonnet Thinking',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'claude-3.7-sonnet-thinking',
    maxTokens: 4096,
    group: 'claude',
    costTier: 'medium',
    note: '带思考链'
  },
  'claude-opus-4': {
    name: 'Claude Opus 4',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'claude-opus-4',
    maxTokens: 4096,
    group: 'claude',
    costTier: 'vhigh',
    note: '最强推理，复杂任务'
  },
  'claude-opus-4-7': {
    name: 'Claude Opus 4.7',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'claude-opus-4-7',
    maxTokens: 4096,
    group: 'claude',
    costTier: 'high',
    note: 'Opus最新版'
  },
  'claude-3.5-haiku': {
    name: 'Claude 3.5 Haiku',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'claude-3.5-haiku',
    maxTokens: 4096,
    group: 'claude',
    costTier: 'high',
    note: '快速响应'
  },

  // ── Gemini 系列 (Gemini-优质临时 分组 3x) ──
  'gemini-2.5-flash': {
    name: 'Gemini 2.5 Flash',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gemini-2.5-flash',
    maxTokens: 4096,
    group: 'gemini',
    costTier: 'vlow',
    note: '超快超便宜'
  },
  'gemini-2.5-pro': {
    name: 'Gemini 2.5 Pro',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gemini-2.5-pro',
    maxTokens: 4096,
    group: 'gemini',
    costTier: 'low',
    note: '长上下文之王 (1M tokens)'
  },
  'gemini-3-flash': {
    name: 'Gemini 3 Flash',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gemini-3-flash',
    maxTokens: 4096,
    group: 'gemini',
    costTier: 'vlow',
    note: 'Gemini 3代Flash'
  },
  'gemini-3-pro': {
    name: 'Gemini 3 Pro',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gemini-3-pro',
    maxTokens: 4096,
    group: 'gemini',
    costTier: 'medium',
    note: 'Gemini 3代Pro'
  },

  // ── GPT 系列 (gpt-openai 分组 5x) ──
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 4096,
    group: 'gpt',
    costTier: 'low',
    note: '性价比极高'
  },
  'gpt-4o': {
    name: 'GPT-4o',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gpt-4o',
    maxTokens: 4096,
    group: 'gpt',
    costTier: 'medium',
    note: '全能型'
  },
  'gpt-4-turbo': {
    name: 'GPT-4 Turbo',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gpt-4-turbo',
    maxTokens: 4096,
    group: 'gpt',
    costTier: 'medium',
    note: '快速版GPT-4'
  },
  'gpt-3.5-turbo': {
    name: 'GPT-3.5 Turbo',
    apiUrl: API_URL,
    apiKey: API_KEY,
    model: 'gpt-3.5-turbo',
    maxTokens: 4096,
    group: 'gpt',
    costTier: 'vlow',
    note: '最便宜GPT'
  },
};

// 默认模型 — deepseek-v3 性价比最高
const DEFAULT_MODEL = 'deepseek-v3';

// 按任务推荐
const RECOMMENDED = {
  chat: 'deepseek-v3',        // 日常对话
  code: 'deepseek-v3.2',      // 写代码
  reasoning: 'deepseek-r1',   // 推理分析
  creative: 'claude-3.7-sonnet', // 创作文案
  longContext: 'gemini-2.5-pro', // 长文档
  fast: 'gemini-2.5-flash',   // 极速响应
  cheap: 'gpt-3.5-turbo',     // 极低成本
};

module.exports = {
  MODELS,
  DEFAULT_MODEL,
  RECOMMENDED,
  API_KEY,
  BASE_URL,
  API_URL,
};
