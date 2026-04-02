/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 智能模型分流Agent · Smart Model Router
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-MODEL-ROUTER-002
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 根据用户说什么来决定调用便宜的模型还是深度推理模型
 * 同时追踪API调用成本和次数
 */

'use strict';

// ─── 模型定价表（元/百万token） ───
const MODEL_PRICING = {
  'deepseek-chat': { input: 1.0, output: 2.0, tier: 'economy', name: 'DeepSeek-V3' },
  'deepseek-reasoner': { input: 4.0, output: 16.0, tier: 'premium', name: 'DeepSeek-R1' },
  'qwen-turbo': { input: 0.3, output: 0.6, tier: 'economy', name: '通义千问-Turbo' },
  'qwen-plus': { input: 0.8, output: 2.0, tier: 'economy', name: '通义千问-Plus' },
  'qwen-max': { input: 2.0, output: 6.0, tier: 'standard', name: '通义千问-Max' },
  'gpt-4o-mini': { input: 0.15, output: 0.6, tier: 'economy', name: 'GPT-4o-mini' },
  'gpt-4o': { input: 2.5, output: 10.0, tier: 'premium', name: 'GPT-4o' },
  'claude-3-5-sonnet': { input: 3.0, output: 15.0, tier: 'premium', name: 'Claude-3.5-Sonnet' },
  'claude-3-haiku': { input: 0.25, output: 1.25, tier: 'economy', name: 'Claude-3-Haiku' }
};

// ─── 深度推理触发关键词 ───
const DEEP_REASONING_PATTERNS = [
  /分析|推理|评估|审查|review|analyze/i,
  /架构|设计|重构|方案|strategy/i,
  /为什么|原因|解释.*原理|how.*work/i,
  /复杂|困难|棘手|tricky|complex/i,
  /比较|对比|权衡|trade.?off/i,
  /安全|漏洞|vulnerability|security/i,
  /调试|debug|排查|诊断|diagnose/i,
  /优化|性能|performance|bottleneck/i
];

// ─── 简单对话关键词 ───
const SIMPLE_CHAT_PATTERNS = [
  /你好|hi|hello|嗨|在吗/i,
  /谢谢|感谢|thank/i,
  /是的|好的|对|ok|确认|没问题/i,
  /帮我.*写|生成|创建|create|generate/i,
  /查询|查看|获取|get|fetch|list/i,
  /翻译|translate/i
];

// ─── 代码生成关键词 ───
const CODE_PATTERNS = [
  /写代码|编写|实现|implement|code/i,
  /函数|function|方法|method|class/i,
  /接口|api|路由|route|endpoint/i,
  /部署|deploy|发布|build|构建/i,
  /修复|fix|bug|报错|error/i
];

// ─── API调用统计 ───
const usageStats = {
  totalCalls: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCostCNY: 0,
  byModel: {},
  byTier: { economy: 0, standard: 0, premium: 0 },
  hourlyRate: [],
  startTime: Date.now()
};

/**
 * 分析用户输入，决定使用哪个模型
 * @param {string} userMessage - 用户说的话
 * @param {object} context - 上下文信息
 * @returns {object} 模型选择结果
 */
function routeModel(userMessage, context = {}) {
  const { messageCount = 0, isFirstMessage = false, userId = null } = context;
  const msgLen = userMessage.length;

  let selectedModel = 'deepseek-chat'; // 默认便宜模型
  let reason = '默认对话';
  let tier = 'economy';
  let temperature = 0.7;
  let maxTokens = 2000;

  // 1. 检查是否需要深度推理
  const needsDeepReasoning = DEEP_REASONING_PATTERNS.some(p => p.test(userMessage));
  if (needsDeepReasoning && msgLen > 50) {
    selectedModel = 'deepseek-reasoner';
    reason = '检测到深度推理需求';
    tier = 'premium';
    temperature = 0.3;
    maxTokens = 4000;
  }

  // 2. 检查是否是代码相关
  else if (CODE_PATTERNS.some(p => p.test(userMessage))) {
    selectedModel = 'deepseek-chat';
    reason = '代码生成任务';
    tier = 'economy';
    temperature = 0.3;
    maxTokens = 4000;
  }

  // 3. 简单对话用最便宜的
  else if (SIMPLE_CHAT_PATTERNS.some(p => p.test(userMessage)) || msgLen < 20) {
    selectedModel = 'qwen-turbo';
    reason = '简单对话';
    tier = 'economy';
    temperature = 0.8;
    maxTokens = 1000;
  }

  // 4. 中等长度的普通对话
  else if (msgLen < 200) {
    selectedModel = 'deepseek-chat';
    reason = '普通对话';
    tier = 'economy';
    temperature = 0.7;
    maxTokens = 2000;
  }

  // 5. 长消息，可能需要更好的理解
  else {
    selectedModel = 'deepseek-chat';
    reason = '长文本理解';
    tier = 'economy';
    temperature = 0.5;
    maxTokens = 3000;
  }

  const pricing = MODEL_PRICING[selectedModel] || MODEL_PRICING['deepseek-chat'];

  return {
    model: selectedModel,
    modelName: pricing.name,
    reason,
    tier,
    temperature,
    maxTokens,
    estimatedCost: {
      inputPer1k: (pricing.input / 1000).toFixed(6),
      outputPer1k: (pricing.output / 1000).toFixed(6),
      currency: 'CNY'
    }
  };
}

/**
 * 记录API调用
 */
function recordUsage(model, inputTokens, outputTokens) {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['deepseek-chat'];

  // 价格单位: 元/百万token → cost = tokens * (元/百万token) / 1000000
  const cost = (inputTokens * pricing.input + outputTokens * pricing.output) / 1000000;

  usageStats.totalCalls++;
  usageStats.totalInputTokens += inputTokens;
  usageStats.totalOutputTokens += outputTokens;
  usageStats.totalCostCNY += cost;

  if (!usageStats.byModel[model]) {
    usageStats.byModel[model] = { calls: 0, tokens: 0, cost: 0 };
  }
  usageStats.byModel[model].calls++;
  usageStats.byModel[model].tokens += inputTokens + outputTokens;
  usageStats.byModel[model].cost += cost;

  usageStats.byTier[pricing.tier] = (usageStats.byTier[pricing.tier] || 0) + 1;

  // 记录小时速率
  const hour = new Date().getHours();
  if (!usageStats.hourlyRate[hour]) usageStats.hourlyRate[hour] = 0;
  usageStats.hourlyRate[hour]++;

  return { cost, model, inputTokens, outputTokens };
}

/**
 * 获取使用统计
 */
function getUsageStats() {
  const uptimeHours = (Date.now() - usageStats.startTime) / 3600000;
  return {
    ...usageStats,
    uptimeHours: Math.round(uptimeHours * 10) / 10,
    avgCallsPerHour: uptimeHours > 0 ? Math.round(usageStats.totalCalls / uptimeHours * 10) / 10 : 0,
    totalCostCNY: Math.round(usageStats.totalCostCNY * 10000) / 10000
  };
}

/**
 * 获取模型定价表
 */
function getPricingTable() {
  return MODEL_PRICING;
}

module.exports = {
  routeModel,
  recordUsage,
  getUsageStats,
  getPricingTable,
  MODEL_PRICING
};
