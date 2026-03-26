// exe-engine/src/index.js
// EXE-Engine · 自研执行引擎 · 主入口
// PRJ-EXE-001 · Phase 0
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');

const AGERouter = require('./router/age-router');
const LoadBalancer = require('./balancer/load-balancer');
const ResourceMeter = require('./meter/resource-meter');
const ContextCache = require('./cache/context-cache');
const AgentController = require('./controller/agent-controller');
const BaseAdapter = require('./adapters/base-adapter');
const DeepSeekAdapter = require('./adapters/deepseek-adapter');
const QwenAdapter = require('./adapters/qwen-adapter');

const CONFIG_DIR = path.resolve(__dirname, '../config');

/**
 * EXE-Engine 初始化器
 *
 * 本体论锚定：
 *   AGE OS = 笔
 *   算力 = 墨水
 *   用户 = 写字的人
 *
 * 初始化流程：
 *   1. 加载模型配置
 *   2. 创建适配器实例
 *   3. 组装负载均衡器
 *   4. 启动计量器
 *   5. 启动上下文缓存
 *   6. 注册默认 Agent
 *   7. 返回 AGE-Router 实例
 */

/**
 * 创建并初始化 EXE-Engine 实例
 *
 * @param {object} [overrides]  覆写配置
 * @param {object} [overrides.keys]  API Keys { deepseek: 'sk-...', dashscope: 'sk-...' }
 * @returns {object} { router, meter, cache, controller, balancer }
 */
function createEngine(overrides = {}) {
  // 1. 加载配置
  const modelConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'models.json'), 'utf-8')
  );
  const poolConfig = JSON.parse(
    fs.readFileSync(path.join(CONFIG_DIR, 'resource-pools.json'), 'utf-8')
  );

  // 2. 解析 API Keys（环境变量 > overrides）
  const keys = {
    deepseek: process.env.DEEPSEEK_API_KEY || overrides.keys?.deepseek || '',
    dashscope: process.env.DASHSCOPE_API_KEY || overrides.keys?.dashscope || ''
  };

  // 3. 创建适配器
  const adapters = new Map();

  // DeepSeek-V3
  const dsV3Config = modelConfig.models['deepseek-v3'];
  if (dsV3Config) {
    adapters.set('deepseek-v3', new DeepSeekAdapter({
      name: 'deepseek-v3',
      endpoint: dsV3Config.endpoint,
      apiKey: keys.deepseek,
      capabilities: dsV3Config.capabilities,
      costPerToken: dsV3Config.costPerToken,
      maxContext: dsV3Config.maxContext,
      defaultTemperature: dsV3Config.defaultTemperature,
      defaultMaxTokens: dsV3Config.defaultMaxTokens
    }));
  }

  // DeepSeek-R1
  const dsR1Config = modelConfig.models['deepseek-r1'];
  if (dsR1Config) {
    adapters.set('deepseek-r1', new DeepSeekAdapter({
      name: 'deepseek-r1',
      endpoint: dsR1Config.endpoint,
      apiKey: keys.deepseek,
      capabilities: dsR1Config.capabilities,
      costPerToken: dsR1Config.costPerToken,
      maxContext: dsR1Config.maxContext,
      defaultTemperature: dsR1Config.defaultTemperature,
      defaultMaxTokens: dsR1Config.defaultMaxTokens
    }));
  }

  // Qwen-Max
  const qwMaxConfig = modelConfig.models['qwen-max'];
  if (qwMaxConfig) {
    adapters.set('qwen-max', new QwenAdapter({
      name: 'qwen-max',
      endpoint: qwMaxConfig.endpoint,
      apiKey: keys.dashscope,
      capabilities: qwMaxConfig.capabilities,
      costPerToken: qwMaxConfig.costPerToken,
      maxContext: qwMaxConfig.maxContext,
      defaultTemperature: qwMaxConfig.defaultTemperature,
      defaultMaxTokens: qwMaxConfig.defaultMaxTokens
    }));
  }

  // Qwen-Coder
  const qwCoderConfig = modelConfig.models['qwen-coder'];
  if (qwCoderConfig) {
    adapters.set('qwen-coder', new QwenAdapter({
      name: 'qwen-coder',
      endpoint: qwCoderConfig.endpoint,
      apiKey: keys.dashscope,
      capabilities: qwCoderConfig.capabilities,
      costPerToken: qwCoderConfig.costPerToken,
      maxContext: qwCoderConfig.maxContext,
      defaultTemperature: qwCoderConfig.defaultTemperature,
      defaultMaxTokens: qwCoderConfig.defaultMaxTokens
    }));
  }

  // 4. 组装组件
  const meter = new ResourceMeter();
  const cache = new ContextCache({ maxEntries: 100, ttlMs: 30 * 60 * 1000 });
  const controller = new AgentController();
  const balancer = new LoadBalancer(adapters, modelConfig);

  // 5. 注册默认 Agent 偏好
  controller.registerAgent('AG-ZY-01', {
    model: 'auto',
    priority: 'balanced',
    maxTokens: 4096,
    mode: 'pool'
  });
  controller.registerAgent('AG-SY-01', {
    model: 'auto',
    priority: 'quality',
    maxTokens: 4096,
    mode: 'pool'
  });
  controller.registerAgent('AG-QQ-01', {
    model: 'auto',
    priority: 'cost',
    maxTokens: 2048,
    mode: 'pool'
  });

  // 6. 组装路由器
  const router = new AGERouter({
    loadBalancer: balancer,
    resourceMeter: meter,
    contextCache: cache,
    agentController: controller,
    poolConfig
  });

  return {
    router,
    meter,
    cache,
    controller,
    balancer,
    adapters,
    config: { modelConfig, poolConfig }
  };
}

// ── CLI 入口 ──

if (require.main === module) {
  const cmd = process.argv[2];

  if (cmd === 'status') {
    const engine = createEngine();
    const status = engine.router.getStatus();
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(status, null, 2));
  } else {
    // eslint-disable-next-line no-console
    console.log([
      '🔧 EXE-Engine v1.0.0 · PRJ-EXE-001 · Phase 0',
      '',
      '本体论锚定：AGE OS = 笔 · 算力 = 墨水 · 用户 = 写字的人',
      '',
      '用法:',
      '  node exe-engine/src/index.js status   查看引擎状态',
      '',
      '组件:',
      '  AGE-Router      路由网关',
      '  LoadBalancer     负载均衡器',
      '  ResourceMeter    资源计量器',
      '  ContextCache     上下文缓存',
      '  AgentController  Agent 调度器',
      '  DeepSeekAdapter  DeepSeek 适配器',
      '  QwenAdapter      Qwen 适配器',
    ].join('\n'));
  }
}

module.exports = {
  createEngine,
  AGERouter,
  LoadBalancer,
  ResourceMeter,
  ContextCache,
  AgentController,
  BaseAdapter,
  DeepSeekAdapter,
  QwenAdapter
};
