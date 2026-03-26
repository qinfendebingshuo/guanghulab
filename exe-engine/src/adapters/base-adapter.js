// exe-engine/src/adapters/base-adapter.js
// EXE-Engine · 模型适配器基类
// 统一抽象 EXEModelAdapter 接口
// PRJ-EXE-001 · Phase 0
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * EXEModelAdapter 基类
 *
 * 所有模型适配器（DeepSeek、Qwen 等）均继承此基类，
 * 统一暴露 execute() 和 healthCheck() 接口。
 *
 * 本体论锚定：适配器 = 墨水瓶的接口。
 * 不同品牌的墨水瓶，瓶口规格不同，但笔尖只认一种接口。
 */
class BaseAdapter {
  /**
   * @param {object} config
   * @param {string} config.name         模型标识
   * @param {string} config.provider     供应商标识
   * @param {string} config.endpoint     API 端点
   * @param {string} config.apiKey       API 密钥
   * @param {string[]} config.capabilities 能力标签
   * @param {object} config.costPerToken  成本 { input, output, currency, unit }
   * @param {number} config.maxContext    最大上下文窗口
   * @param {number} config.defaultTemperature 默认温度
   * @param {number} config.defaultMaxTokens   默认最大 token
   */
  constructor(config) {
    if (new.target === BaseAdapter) {
      throw new Error('BaseAdapter 不可直接实例化，请使用具体子类');
    }
    this.name = config.name;
    this.provider = config.provider;
    this.endpoint = config.endpoint;
    this.apiKey = config.apiKey;
    this.capabilities = config.capabilities || [];
    this.costPerToken = config.costPerToken || { input: 0, output: 0 };
    this.maxContext = config.maxContext || 32000;
    this.defaultTemperature = config.defaultTemperature || 0.7;
    this.defaultMaxTokens = config.defaultMaxTokens || 4096;

    // 运行时状态
    this._healthy = true;
    this._lastHealthCheck = null;
    this._failureCount = 0;
    this._cooldownUntil = null;
  }

  /**
   * 执行推理请求（子类必须实现）
   * @param {object} request  EXE 标准请求
   * @returns {Promise<object>} EXE 标准响应
   */
  async execute(request) {
    throw new Error('子类必须实现 execute() 方法');
  }

  /**
   * 健康检查（子类可覆写）
   * @returns {Promise<boolean>}
   */
  async healthCheck() {
    this._lastHealthCheck = new Date().toISOString();
    return this._healthy;
  }

  /**
   * 检测该适配器是否支持指定能力
   * @param {string} capability
   * @returns {boolean}
   */
  supports(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * 记录失败并判断是否进入冷却期
   * @param {string} reason
   */
  recordFailure(reason) {
    this._failureCount++;
    if (this._failureCount >= 3) {
      // 连续 3 次失败，冷却 5 分钟
      this._cooldownUntil = Date.now() + 5 * 60 * 1000;
      this._healthy = false;
    }
  }

  /**
   * 重置失败计数
   */
  resetFailures() {
    this._failureCount = 0;
    this._cooldownUntil = null;
    this._healthy = true;
  }

  /**
   * 是否处于冷却期
   * @returns {boolean}
   */
  isInCooldown() {
    if (!this._cooldownUntil) return false;
    if (Date.now() >= this._cooldownUntil) {
      this.resetFailures();
      return false;
    }
    return true;
  }

  /**
   * 获取适配器状态摘要
   * @returns {object}
   */
  getStatus() {
    return {
      name: this.name,
      provider: this.provider,
      healthy: this._healthy,
      inCooldown: this.isInCooldown(),
      failureCount: this._failureCount,
      lastHealthCheck: this._lastHealthCheck,
      capabilities: this.capabilities,
      costPerToken: this.costPerToken,
      maxContext: this.maxContext
    };
  }
}

module.exports = BaseAdapter;
