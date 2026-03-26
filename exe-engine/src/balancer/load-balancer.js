// exe-engine/src/balancer/load-balancer.js
// EXE-Engine · 负载均衡器
// 根据策略选择最优模型适配器
// PRJ-EXE-001 · Phase 0
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 负载均衡器
 *
 * 本体论锚定：均衡器 = 选墨水的智慧。
 * 不同的字需要不同的墨水，均衡器知道哪瓶墨水最合适。
 *
 * 策略：
 *   cost     — 成本优先：满足质量阈值前提下选最便宜的
 *   quality  — 质量优先：选能力最强的模型
 *   balanced — 均衡：成本权重 0.6 + 质量权重 0.4
 */
class LoadBalancer {
  /**
   * @param {Map<string, BaseAdapter>} adapters  已注册的适配器 Map
   * @param {object} modelConfig                  模型配置（含 taskModelMapping）
   */
  constructor(adapters, modelConfig) {
    this._adapters = adapters;
    this._modelConfig = modelConfig;
  }

  /**
   * 根据请求选择最优适配器
   *
   * @param {object} request
   * @param {string} request.taskType    任务类型
   * @param {string} [request.model]     指定模型 ('auto' 则自动选择)
   * @param {string} [request.priority]  优先策略 (cost | balanced | quality)
   * @returns {BaseAdapter|null}
   */
  select(request) {
    const { taskType, model, priority = 'balanced' } = request;

    // 用户指定了具体模型
    if (model && model !== 'auto') {
      const adapter = this._adapters.get(model);
      if (adapter && !adapter.isInCooldown()) {
        return adapter;
      }
      // 指定模型不可用，尝试 fallback
    }

    // 根据任务类型获取候选模型列表
    const candidates = this._getCandidates(taskType);

    if (candidates.length === 0) {
      return null;
    }

    // 按优先策略排序
    return this._selectByPriority(candidates, priority);
  }

  /**
   * 故障转移：获取指定模型的下一个备选
   *
   * @param {string} failedModel  失败的模型名
   * @param {string} taskType     任务类型
   * @returns {BaseAdapter|null}
   */
  failover(failedModel, taskType) {
    const candidates = this._getCandidates(taskType)
      .filter(a => a.name !== failedModel);

    if (candidates.length === 0) return null;
    return candidates[0];
  }

  /**
   * 获取所有适配器状态
   * @returns {object[]}
   */
  getStatus() {
    const status = [];
    for (const [, adapter] of this._adapters) {
      status.push(adapter.getStatus());
    }
    return status;
  }

  // ── 内部方法 ──

  /**
   * 获取可用候选适配器
   * @param {string} taskType
   * @returns {BaseAdapter[]}
   */
  _getCandidates(taskType) {
    const mapping = this._modelConfig.taskModelMapping || {};
    const modelNames = mapping[taskType] || Object.keys(this._modelConfig.models || {});

    return modelNames
      .map(name => this._adapters.get(name))
      .filter(a => a && !a.isInCooldown());
  }

  /**
   * 按优先策略选择
   * @param {BaseAdapter[]} candidates
   * @param {string} priority
   * @returns {BaseAdapter}
   */
  _selectByPriority(candidates, priority) {
    if (priority === 'cost') {
      return this._selectLowestCost(candidates);
    }
    if (priority === 'quality') {
      // 质量优先 = 列表中第一个（配置中按质量排序）
      return candidates[0];
    }
    // balanced: 加权评分
    return this._selectBalanced(candidates);
  }

  /**
   * 选择成本最低的适配器
   * @param {BaseAdapter[]} candidates
   * @returns {BaseAdapter}
   */
  _selectLowestCost(candidates) {
    let best = candidates[0];
    let bestCost = this._avgCost(best);

    for (let i = 1; i < candidates.length; i++) {
      const cost = this._avgCost(candidates[i]);
      if (cost < bestCost) {
        best = candidates[i];
        bestCost = cost;
      }
    }
    return best;
  }

  /**
   * 均衡选择（成本 0.6 + 位置 0.4）
   * @param {BaseAdapter[]} candidates
   * @returns {BaseAdapter}
   */
  _selectBalanced(candidates) {
    let best = null;
    let bestScore = Infinity;

    for (let i = 0; i < candidates.length; i++) {
      const costScore = this._avgCost(candidates[i]);
      const positionScore = i; // 位置越前，质量越高
      const score = costScore * 0.6 + positionScore * 0.4;

      if (score < bestScore) {
        best = candidates[i];
        bestScore = score;
      }
    }
    return best;
  }

  /**
   * 计算平均每百万 token 成本
   * @param {BaseAdapter} adapter
   * @returns {number}
   */
  _avgCost(adapter) {
    const c = adapter.costPerToken;
    return ((c.input || 0) + (c.output || 0)) / 2;
  }
}

module.exports = LoadBalancer;
