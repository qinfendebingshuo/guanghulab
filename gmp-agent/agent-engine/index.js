/**
 * Agent Engine · 模块入口（M3完整版）
 * GH-GMP-005 · M3 · Agent搬迁工程
 *
 * 工单调度 · 回执生成 · 半体人格加载 · 任务执行
 * 依赖：notion-sync · llm-router
 *
 * 架构：
 * ┌─────────────────────────────────────┐
 * │          Agent Engine               │
 * │  ┌───────────┐  ┌───────────────┐  │
 * │  │ TaskRunner │  │ Dispatcher    │  │
 * │  │ (队列管理) │→ │ (工单→Agent)  │  │
 * │  └───────────┘  └───────┬───────┘  │
 * │                         │          │
 * │  ┌─────────────┐  ┌─────┴───────┐  │
 * │  │PersonaLoader│  │ ReceiptGen  │  │
 * │  │ (灯塔构建)  │  │ (回执生成)  │  │
 * │  └─────────────┘  └─────────────┘  │
 * └─────────────────────────────────────┘
 */

'use strict';

const fs = require('fs');
const path = require('path');
const Dispatcher = require('./dispatcher');
const ReceiptGenerator = require('./receipt-gen');
const PersonaLoader = require('./persona-loader');
const TaskRunner = require('./task-runner');

const MODULE_NAME = 'agent-engine';
const MODULE_VERSION = '2.0.0';

let notionSync = null;
let llmRouter = null;
let agentRegistry = null;
let logger = console;

// M3核心模块实例
let personaLoader = null;
let receiptGen = null;
let dispatcher = null;
let taskRunner = null;

module.exports = {
  name: MODULE_NAME,
  version: MODULE_VERSION,
  type: 'service',
  depends: ['notion-sync', 'llm-router'],

  async init(context) {
    logger = (context && context.logger) || console;
    logger.info('[' + MODULE_NAME + '] 初始化中 v' + MODULE_VERSION + '...');

    // 获取依赖模块引用
    notionSync = context && context.modules && context.modules['notion-sync'];
    llmRouter = context && context.modules && context.modules['llm-router'];

    // 加载Agent注册表
    try {
      const configPath = path.join(__dirname, '..', 'config', 'agents.json');
      agentRegistry = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const agentCount = Object.keys(agentRegistry.agents || {}).length;
      logger.info('[' + MODULE_NAME + '] Agent注册表加载完成 · ' + agentCount + ' 个半体');
    } catch (err) {
      logger.warn('[' + MODULE_NAME + '] Agent注册表加载失败: ' + err.message);
      agentRegistry = { agents: {} };
    }

    // 初始化PersonaLoader（M5灯塔构建器）
    if (notionSync && notionSync.getClient) {
      personaLoader = new PersonaLoader({
        notionClient: notionSync.getClient(),
        agentRegistry,
        logger,
      });
      logger.info('[' + MODULE_NAME + '] PersonaLoader初始化完成 · 灯塔构建器就绪');
    } else {
      logger.warn('[' + MODULE_NAME + '] notion-sync未就绪 · PersonaLoader不可用');
    }

    // 初始化ReceiptGenerator（回执生成器）
    if (llmRouter) {
      receiptGen = new ReceiptGenerator({ llmRouter, logger });
      logger.info('[' + MODULE_NAME + '] ReceiptGenerator初始化完成');
    } else {
      logger.warn('[' + MODULE_NAME + '] llm-router未就绪 · ReceiptGenerator不可用');
    }

    // 初始化Dispatcher（工单调度器）
    if (notionSync && personaLoader && receiptGen) {
      dispatcher = new Dispatcher({
        agentRegistry,
        pageRW: notionSync.getPageRW ? notionSync.getPageRW() : null,
        dbReader: notionSync.getDBReader ? notionSync.getDBReader() : null,
        personaLoader,
        receiptGen,
        llmRouter,
        logger,
      });
      logger.info('[' + MODULE_NAME + '] Dispatcher初始化完成 · 工单调度器就绪');
    } else {
      logger.warn('[' + MODULE_NAME + '] 依赖不完整 · Dispatcher不可用');
    }

    // 初始化TaskRunner（任务执行器）
    if (dispatcher) {
      taskRunner = new TaskRunner({
        dispatcher,
        logger,
        config: {
          maxConcurrency: 1,
          maxRetries: 1,
          retryDelayMs: 5000,
          processTimeoutMs: 300000,
        },
      });
      logger.info('[' + MODULE_NAME + '] TaskRunner初始化完成 · 任务执行器就绪');
    }

    logger.info('[' + MODULE_NAME + '] 初始化完成 v' + MODULE_VERSION);
    return {
      status: dispatcher ? 'ok' : 'partial',
      agentCount: Object.keys(agentRegistry.agents || {}).length,
      hasNotionSync: !!notionSync,
      hasLlmRouter: !!llmRouter,
      hasDispatcher: !!dispatcher,
      hasTaskRunner: !!taskRunner,
    };
  },

  async start(context) {
    logger.info('[' + MODULE_NAME + '] 启动Agent引擎...');

    // 启动TaskRunner
    if (taskRunner) {
      taskRunner.start();
    }

    // 连接notion-sync的轮询器，注入工单处理回调
    if (notionSync && notionSync.getPoller && taskRunner) {
      const poller = notionSync.getPoller();
      if (poller) {
        // 注入回调：新工单 → TaskRunner入队
        poller.onNewTicket = async (ticket) => {
          taskRunner.enqueue(ticket);
        };
        // 注入回调：工单更新 → TaskRunner处理
        poller.onUpdatedTicket = async (ticket) => {
          await taskRunner.handleUpdate(ticket);
        };
        logger.info('[' + MODULE_NAME + '] 已连接Poller · 工单自动处理已启用');
      }
    } else if (!taskRunner) {
      logger.warn('[' + MODULE_NAME + '] TaskRunner不可用 · 工单处理未启用');
    } else {
      logger.warn('[' + MODULE_NAME + '] notion-sync轮询器未就绪 · 工单处理暂不可用');
    }

    return { status: 'running' };
  },

  async stop() {
    logger.info('[' + MODULE_NAME + '] 停止Agent引擎');

    if (taskRunner) {
      await taskRunner.stop();
    }

    return { status: 'stopped' };
  },

  async healthCheck() {
    return {
      status: dispatcher ? 'ok' : 'partial',
      module: MODULE_NAME,
      version: MODULE_VERSION,
      agentCount: Object.keys((agentRegistry && agentRegistry.agents) || {}).length,
      dependencies: {
        'notion-sync': !!notionSync,
        'llm-router': !!llmRouter,
      },
      components: {
        personaLoader: !!personaLoader,
        receiptGen: receiptGen ? receiptGen.stats : null,
        dispatcher: dispatcher ? dispatcher.stats : null,
        taskRunner: taskRunner ? taskRunner.stats : null,
      },
    };
  },

  // ─── 对外接口 ───
  getAgentRegistry: () => agentRegistry,
  getDispatcher: () => dispatcher,
  getTaskRunner: () => taskRunner,
  getPersonaLoader: () => personaLoader,
  getReceiptGen: () => receiptGen,

  /**
   * 手动触发处理一张工单（用于测试或手动调度）
   * @param {object} ticket
   */
  async processTicketManual(ticket) {
    if (!dispatcher) {
      throw new Error('Dispatcher未初始化 · 依赖不完整');
    }
    return dispatcher.processTicket(ticket);
  },
};
