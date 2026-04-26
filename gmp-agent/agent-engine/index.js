/**
 * Agent Engine · 模块入口（更新版）
 * GH-GMP-005 · M3 · Agent搬迁工程
 *
 * 工单调度 · 回执生成 · 半体人格加载
 * 依赖：notion-sync · llm-router
 */

'use strict';

const fs = require('fs');
const path = require('path');

const MODULE_NAME = 'agent-engine';
const MODULE_VERSION = '1.0.0';

// TODO M3: 实现以下模块
// const Dispatcher = require('./dispatcher');
// const ReceiptGenerator = require('./receipt-gen');
// const PersonaLoader = require('./persona-loader');
// const TaskRunner = require('./task-runner');

let notionSync = null;
let llmRouter = null;
let agentRegistry = null;
let logger = console;

module.exports = {
  name: MODULE_NAME,
  version: MODULE_VERSION,
  type: 'service',
  depends: ['notion-sync', 'llm-router'],

  async init(context) {
    logger = (context && context.logger) || console;
    logger.info(`[${MODULE_NAME}] 初始化中 v${MODULE_VERSION}...`);

    // 获取依赖模块引用
    notionSync = context && context.modules && context.modules['notion-sync'];
    llmRouter = context && context.modules && context.modules['llm-router'];

    // 加载Agent注册表
    try {
      const configPath = path.join(__dirname, '..', 'config', 'agents.json');
      agentRegistry = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const agentCount = Object.keys(agentRegistry.agents || {}).length;
      logger.info(`[${MODULE_NAME}] Agent注册表加载完成 · ${agentCount} 个半体`);
    } catch (err) {
      logger.warn(`[${MODULE_NAME}] Agent注册表加载失败: ${err.message}`);
      agentRegistry = { agents: {} };
    }

    logger.info(`[${MODULE_NAME}] 初始化完成 v${MODULE_VERSION}`);
    return {
      status: 'ok',
      agentCount: Object.keys(agentRegistry.agents || {}).length,
      hasNotionSync: !!notionSync,
      hasLlmRouter: !!llmRouter,
    };
  },

  async start(context) {
    logger.info(`[${MODULE_NAME}] 启动Agent引擎...`);

    // 连接notion-sync的轮询器，注入工单处理回调
    if (notionSync && notionSync.getPoller) {
      // TODO M3: 注入dispatcher回调
      logger.info(`[${MODULE_NAME}] 已连接notion-sync轮询器`);
    } else {
      logger.warn(`[${MODULE_NAME}] notion-sync未就绪，工单处理暂不可用`);
    }

    return { status: 'running' };
  },

  async stop() {
    logger.info(`[${MODULE_NAME}] 停止Agent引擎`);
    return { status: 'stopped' };
  },

  async healthCheck() {
    return {
      status: 'ok',
      module: MODULE_NAME,
      version: MODULE_VERSION,
      agentCount: Object.keys((agentRegistry && agentRegistry.agents) || {}).length,
      dependencies: {
        'notion-sync': !!notionSync,
        'llm-router': !!llmRouter,
      },
    };
  },

  // ─── 对外接口 ───
  getAgentRegistry: () => agentRegistry,
};
