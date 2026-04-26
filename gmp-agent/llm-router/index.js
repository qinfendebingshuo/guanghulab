/**
 * LLM Router · 模块入口（完整实现）
 * GH-GMP-005 · M2 · Agent搬迁工程
 *
 * 大模型路由调度 · 通义千问API · 模型降级
 */

'use strict';

const QwenClient = require('./qwen-client');

const MODULE_NAME = 'llm-router';
const MODULE_VERSION = '1.0.0';

/**
 * 模型路由配置
 */
const MODEL_ROUTES = {
  reasoning: {
    model: 'qwen-plus',
    maxTokens: 4000,
    temperature: 0.7,
    description: '通用推理：工单分析、回执生成、讨论回复',
  },
  coding: {
    model: 'qwen-coder-turbo',
    maxTokens: 8000,
    temperature: 0.3,
    description: '代码生成：生成代码文件、代码审查',
  },
  simple: {
    model: 'qwen-turbo',
    maxTokens: 1000,
    temperature: 0.5,
    description: '简单任务：状态更新、格式化、短回复',
  },
  thinking: {
    model: 'qwen-plus',
    maxTokens: 8000,
    temperature: 0.8,
    description: '深度思考：架构设计、复杂决策',
  },
};

/**
 * 模型降级顺序
 */
const FALLBACK_ORDER = ['qwen-plus', 'qwen-turbo'];

let qwenClient = null;
let logger = console;

module.exports = {
  name: MODULE_NAME,
  version: MODULE_VERSION,
  type: 'service',
  MODEL_ROUTES,

  async init(context) {
    logger = (context && context.logger) || console;
    logger.info(`[${MODULE_NAME}] 初始化中 v${MODULE_VERSION}...`);

    qwenClient = new QwenClient({ logger });

    const hasKey = !!process.env.GH_LLM_API_KEY;
    logger.info(`[${MODULE_NAME}] API Key: ${hasKey ? '已配置 ✅' : '❌ 未配置'}`);

    if (!hasKey) {
      logger.warn(`[${MODULE_NAME}] 无API Key，LLM功能将不可用`);
    }

    return { status: hasKey ? 'ok' : 'warning', hasApiKey: hasKey };
  },

  async start(context) {
    logger.info(`[${MODULE_NAME}] LLM路由就绪 · ${Object.keys(MODEL_ROUTES).length} 条路由`);
    return { status: 'running' };
  },

  async stop() {
    logger.info(`[${MODULE_NAME}] LLM路由停止`);
    return { status: 'stopped' };
  },

  async healthCheck() {
    return {
      status: process.env.GH_LLM_API_KEY ? 'ok' : 'warning',
      module: MODULE_NAME,
      version: MODULE_VERSION,
      routes: Object.keys(MODEL_ROUTES),
      stats: qwenClient ? qwenClient.stats : null,
    };
  },

  // ─── 对外接口 ───

  /**
   * 按路由类型调用LLM
   * @param {string} routeType - 'reasoning'|'coding'|'simple'|'thinking'
   * @param {Array} messages - [{role, content}]
   * @returns {Promise<{content: string, usage: object, model: string}>}
   */
  async chat(routeType, messages) {
    const route = MODEL_ROUTES[routeType];
    if (!route) {
      throw new Error(`[${MODULE_NAME}] 未知路由类型: ${routeType}`);
    }

    // 尝试首选模型
    try {
      return await qwenClient.chat({
        model: route.model,
        messages,
        maxTokens: route.maxTokens,
        temperature: route.temperature,
      });
    } catch (err) {
      logger.warn(
        `[${MODULE_NAME}] ${route.model} 调用失败 · 尝试降级 · ${err.message}`
      );

      // 降级到备选模型
      for (const fallback of FALLBACK_ORDER) {
        if (fallback === route.model) continue;
        try {
          logger.info(`[${MODULE_NAME}] 降级到 ${fallback}`);
          return await qwenClient.chat({
            model: fallback,
            messages,
            maxTokens: route.maxTokens,
            temperature: route.temperature,
          });
        } catch (fallbackErr) {
          logger.warn(`[${MODULE_NAME}] ${fallback} 也失败 · ${fallbackErr.message}`);
        }
      }

      throw new Error(`[${MODULE_NAME}] 所有模型均不可用`);
    }
  },

  /**
   * 直接指定模型调用（不走路由）
   */
  async chatDirect({ model, messages, maxTokens, temperature }) {
    return qwenClient.chat({ model, messages, maxTokens, temperature });
  },

  /**
   * 获取QwenClient实例
   */
  getClient: () => qwenClient,
};
