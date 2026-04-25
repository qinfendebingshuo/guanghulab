/**
 * LLM Router · 模块入口
 * GH-GMP-005 · Agent搬迁工程
 * 
 * 职责：大模型路由调度，通义千问API调用
 * 依赖：GH_LLM_API_KEY
 */

'use strict';

const MODULE_NAME = 'llm-router';
const MODULE_VERSION = '0.1.0';

// TODO: 实现以下模块
// const QwenClient = require('./qwen-client');
// const ModelSelector = require('./model-selector');
// const PromptBuilder = require('./prompt-builder');

/**
 * 模型路由配置
 */
const MODEL_ROUTES = {
  reasoning: {
    model: 'qwen-plus',
    maxTokens: 4000,
    temperature: 0.7,
    description: '通用推理：工单分析、回执生成、讨论回复'
  },
  coding: {
    model: 'qwen-coder-turbo',
    maxTokens: 8000,
    temperature: 0.3,
    description: '代码生成：生成代码文件、代码审查'
  },
  simple: {
    model: 'qwen-turbo',
    maxTokens: 1000,
    temperature: 0.5,
    description: '简单任务：状态更新、格式化、短回复'
  },
  thinking: {
    model: 'qwen-plus',
    maxTokens: 8000,
    temperature: 0.8,
    description: '深度思考：架构设计、复杂决策'
  }
};

module.exports = {
  name: MODULE_NAME,
  version: MODULE_VERSION,
  type: 'service',
  MODEL_ROUTES,

  async init(context) {
    console.log(`[${MODULE_NAME}] 初始化中...`);
    const hasKey = !!process.env.GH_LLM_API_KEY;
    console.log(`[${MODULE_NAME}] API Key: ${hasKey ? '已配置' : '未配置'}`);
    console.log(`[${MODULE_NAME}] 初始化完成 v${MODULE_VERSION}`);
    return { status: hasKey ? 'ok' : 'warning', hasApiKey: hasKey };
  },

  async start(context) {
    console.log(`[${MODULE_NAME}] LLM路由就绪`);
    return { status: 'running' };
  },

  async stop() {
    console.log(`[${MODULE_NAME}] LLM路由停止`);
    return { status: 'stopped' };
  },

  async healthCheck() {
    return {
      status: 'ok',
      module: MODULE_NAME,
      version: MODULE_VERSION,
      routes: Object.keys(MODEL_ROUTES)
    };
  }
};
