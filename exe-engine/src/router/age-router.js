// exe-engine/src/router/age-router.js
// EXE-Engine · AGE-Router 路由网关
// 接收所有 AI 执行请求，进行鉴权、分类、路由
// PRJ-EXE-001 · Phase 0 · ZY-EXE-P0-001
// 版权：国作登字-2026-A-00037559

'use strict';

const { randomUUID } = require('crypto');

/**
 * AGE-Router 路由网关
 *
 * 本体论锚定：路由网关 = 笔的分流阀。
 * 所有墨水需求都从这里进入，网关决定用哪种墨水、多少量。
 *
 * 职责：
 *   1. 请求鉴权（验证用户身份 + 资源池额度）
 *   2. 任务分类（代码生成 / 文本处理 / 数据分析 / Agent 指令）
 *   3. 模型选择（通过 LoadBalancer 选择最优模型）
 *   4. 限流降级（资源池耗尽时的优雅降级策略）
 */
class AGERouter {
  /**
   * @param {object} deps
   * @param {LoadBalancer} deps.loadBalancer    负载均衡器
   * @param {ResourceMeter} deps.resourceMeter  资源计量器
   * @param {ContextCache} deps.contextCache    上下文缓存
   * @param {AgentController} deps.agentController Agent 调度器
   * @param {object} [deps.poolConfig]          资源池配置
   */
  constructor(deps) {
    this._loadBalancer = deps.loadBalancer;
    this._resourceMeter = deps.resourceMeter;
    this._contextCache = deps.contextCache;
    this._agentController = deps.agentController;
    this._poolConfig = deps.poolConfig || {};

    // 限流计数器 { agentId: { count, resetAt } }
    this._rateLimits = new Map();
  }

  /**
   * 执行 AI 请求（统一入口）
   *
   * 对应 API: POST /api/exe/v1/execute
   *
   * @param {object} request
   * @param {string} request.agentId       Agent ID
   * @param {string} request.taskType      任务类型
   * @param {string} request.prompt        Prompt
   * @param {string} [request.systemPrompt] 系统 Prompt
   * @param {object} [request.context]     上下文
   * @param {object} [request.preferences] 偏好 { model, priority, maxTokens }
   * @param {string} [request.resourcePool] 资源池 ID
   * @param {string} [request.apiKey]      BYOK 模式的用户 Key
   * @returns {Promise<object>} EXE 标准响应
   */
  async execute(request) {
    const requestId = `exe-${randomUUID().slice(0, 12)}`;
    const startTime = Date.now();

    try {
      // 1. 限流检查
      this._checkRateLimit(request.agentId, request.resourcePool);

      // 2. 尝试加载缓存上下文
      const cacheKey = `${request.agentId}:${request.taskType}`;
      const cachedContext = this._contextCache.get(cacheKey);
      if (cachedContext && !request.context) {
        request.context = cachedContext;
      }

      // 3. 通过 LoadBalancer 选择适配器
      const adapter = this._loadBalancer.select({
        taskType: request.taskType,
        model: request.preferences?.model || 'auto',
        priority: request.preferences?.priority || 'balanced'
      });

      if (!adapter) {
        return this._buildErrorResponse(requestId, startTime, 'NO_AVAILABLE_MODEL',
          '没有可用的模型适配器，所有模型可能处于冷却期');
      }

      // 4. 执行推理
      const result = await adapter.execute({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        taskType: request.taskType,
        maxTokens: request.preferences?.maxTokens || 4096,
        temperature: request.preferences?.temperature
      });

      // 5. 记录计量数据
      const mode = request.apiKey ? 'byok' : 'pool';
      this._resourceMeter.record({
        requestId,
        agentId: request.agentId,
        model: result.model,
        taskType: request.taskType,
        resourcePool: request.resourcePool || 'default',
        mode,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cost: result.usage.cost,
        costUnit: result.usage.unit,
        latency: result.latency,
        status: 'success'
      });

      // 6. 更新上下文缓存
      if (request.context) {
        this._contextCache.set(cacheKey, request.context);
      }

      // 7. 返回标准响应
      return {
        requestId,
        model: result.model,
        output: result.output,
        usage: result.usage,
        latency: result.latency,
        status: 'success'
      };

    } catch (err) {
      // 尝试故障转移
      const failoverResult = await this._tryFailover(request, requestId, startTime, err);
      if (failoverResult) return failoverResult;

      // 记录失败
      this._resourceMeter.record({
        requestId,
        agentId: request.agentId,
        model: 'unknown',
        taskType: request.taskType,
        resourcePool: request.resourcePool || 'default',
        mode: request.apiKey ? 'byok' : 'pool',
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        costUnit: 'CNY',
        latency: Date.now() - startTime,
        status: 'error'
      });

      return this._buildErrorResponse(requestId, startTime, 'EXECUTION_FAILED', err.message);
    }
  }

  /**
   * 获取系统状态
   * @returns {object}
   */
  getStatus() {
    return {
      router: 'AGE-Router v1.0.0',
      project: 'PRJ-EXE-001',
      phase: 'Phase 0',
      adapters: this._loadBalancer.getStatus(),
      meter: this._resourceMeter.getSummary(),
      cache: this._contextCache.getStatus(),
      agents: this._agentController.getRegisteredAgents()
    };
  }

  // ── 内部方法 ──

  /**
   * 限流检查
   * @param {string} agentId
   * @param {string} poolId
   */
  _checkRateLimit(agentId, poolId) {
    const key = agentId || 'anonymous';
    const now = Date.now();
    let limiter = this._rateLimits.get(key);

    if (!limiter || now >= limiter.resetAt) {
      limiter = { count: 0, resetAt: now + 60000 }; // 每分钟窗口
      this._rateLimits.set(key, limiter);
    }

    limiter.count++;

    // 获取资源池的速率限制
    const pool = this._poolConfig.pools?.[poolId || 'default'];
    const limit = pool?.rateLimitPerMinute || 30;

    if (limiter.count > limit) {
      throw new Error(`[限流] Agent ${key} 每分钟请求数超限 (${limiter.count}/${limit})`);
    }
  }

  /**
   * 故障转移
   * @param {object} request
   * @param {string} requestId
   * @param {number} startTime
   * @param {Error} originalError
   * @returns {Promise<object|null>}
   */
  async _tryFailover(request, requestId, startTime, originalError) {
    try {
      const failoverAdapter = this._loadBalancer.failover(
        request.preferences?.model || 'unknown',
        request.taskType
      );

      if (!failoverAdapter) return null;

      const result = await failoverAdapter.execute({
        prompt: request.prompt,
        systemPrompt: request.systemPrompt,
        taskType: request.taskType,
        maxTokens: request.preferences?.maxTokens || 4096
      });

      this._resourceMeter.record({
        requestId,
        agentId: request.agentId,
        model: result.model,
        taskType: request.taskType,
        resourcePool: request.resourcePool || 'default',
        mode: request.apiKey ? 'byok' : 'pool',
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        cost: result.usage.cost,
        costUnit: result.usage.unit,
        latency: result.latency,
        status: 'success'
      });

      return {
        requestId,
        model: result.model,
        output: result.output,
        usage: result.usage,
        latency: result.latency,
        status: 'success',
        _failover: true,
        _originalError: originalError.message
      };
    } catch {
      return null;
    }
  }

  /**
   * 构建错误响应
   * @param {string} requestId
   * @param {number} startTime
   * @param {string} code
   * @param {string} message
   * @returns {object}
   */
  _buildErrorResponse(requestId, startTime, code, message) {
    return {
      requestId,
      model: null,
      output: null,
      usage: { inputTokens: 0, outputTokens: 0, cost: 0, unit: 'CNY' },
      latency: Date.now() - startTime,
      status: 'error',
      error: { code, message }
    };
  }
}

module.exports = AGERouter;
