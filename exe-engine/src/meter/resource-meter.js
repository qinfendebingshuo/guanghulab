// exe-engine/src/meter/resource-meter.js
// EXE-Engine · 资源计量器
// 实时记录每次调用的 token 消耗、模型选择、响应时间
// PRJ-EXE-001 · Phase 0 · ZY-EXE-P0-003
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const LOG_DIR = path.resolve(__dirname, '../../logs');
const METER_LOG = path.join(LOG_DIR, 'meter.json');

/**
 * 资源计量器
 *
 * 本体论锚定：计量器 = 量墨水的刻度。
 * 每一笔用了多少墨水，花了多少钱，都要记下来。
 * 数据回流至 DC v1.0 采集系统，为算力资源模型提供计费基础数据。
 */
class ResourceMeter {
  constructor() {
    this._records = [];
    this._summary = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
      byAgent: {},
      byPool: {}
    };
    this._ensureLogDir();
    this._loadExisting();
  }

  /**
   * 记录一次调用消耗
   *
   * @param {object} record
   * @param {string} record.requestId    请求 ID
   * @param {string} record.agentId      Agent ID
   * @param {string} record.model        使用的模型
   * @param {string} record.taskType     任务类型
   * @param {string} record.resourcePool 资源池 ID
   * @param {string} record.mode         接入模式 (byok | pool | hybrid)
   * @param {number} record.inputTokens  输入 token 数
   * @param {number} record.outputTokens 输出 token 数
   * @param {number} record.cost         成本
   * @param {string} record.costUnit     成本单位
   * @param {number} record.latency      延迟 (ms)
   * @param {string} record.status       状态 (success | error)
   */
  record(record) {
    const entry = {
      ...record,
      timestamp: new Date().toISOString()
    };

    this._records.push(entry);
    this._updateSummary(entry);
    this._persist();
  }

  /**
   * 获取计量摘要
   * @returns {object}
   */
  getSummary() {
    return {
      ...this._summary,
      recordCount: this._records.length,
      lastUpdated: this._records.length > 0
        ? this._records[this._records.length - 1].timestamp
        : null
    };
  }

  /**
   * 获取指定 Agent 的消耗统计
   * @param {string} agentId
   * @returns {object|null}
   */
  getAgentUsage(agentId) {
    return this._summary.byAgent[agentId] || null;
  }

  /**
   * 获取指定资源池的消耗统计
   * @param {string} poolId
   * @returns {object|null}
   */
  getPoolUsage(poolId) {
    return this._summary.byPool[poolId] || null;
  }

  /**
   * 获取最近 N 条记录
   * @param {number} n
   * @returns {object[]}
   */
  getRecentRecords(n = 20) {
    return this._records.slice(-n);
  }

  /**
   * 清理过期记录（保留最近 500 条）
   */
  cleanup() {
    if (this._records.length > 500) {
      this._records = this._records.slice(-500);
      this._rebuildSummary();
      this._persist();
    }
  }

  // ── 内部方法 ──

  _updateSummary(entry) {
    this._summary.totalRequests++;
    this._summary.totalInputTokens += entry.inputTokens || 0;
    this._summary.totalOutputTokens += entry.outputTokens || 0;
    this._summary.totalCost += entry.cost || 0;

    // 按模型统计
    if (entry.model) {
      if (!this._summary.byModel[entry.model]) {
        this._summary.byModel[entry.model] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      }
      const m = this._summary.byModel[entry.model];
      m.requests++;
      m.inputTokens += entry.inputTokens || 0;
      m.outputTokens += entry.outputTokens || 0;
      m.cost += entry.cost || 0;
    }

    // 按 Agent 统计
    if (entry.agentId) {
      if (!this._summary.byAgent[entry.agentId]) {
        this._summary.byAgent[entry.agentId] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      }
      const a = this._summary.byAgent[entry.agentId];
      a.requests++;
      a.inputTokens += entry.inputTokens || 0;
      a.outputTokens += entry.outputTokens || 0;
      a.cost += entry.cost || 0;
    }

    // 按资源池统计
    if (entry.resourcePool) {
      if (!this._summary.byPool[entry.resourcePool]) {
        this._summary.byPool[entry.resourcePool] = { requests: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      }
      const p = this._summary.byPool[entry.resourcePool];
      p.requests++;
      p.inputTokens += entry.inputTokens || 0;
      p.outputTokens += entry.outputTokens || 0;
      p.cost += entry.cost || 0;
    }
  }

  _rebuildSummary() {
    this._summary = {
      totalRequests: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      byModel: {},
      byAgent: {},
      byPool: {}
    };
    for (const entry of this._records) {
      this._updateSummary(entry);
    }
  }

  _ensureLogDir() {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
  }

  _persist() {
    try {
      fs.writeFileSync(METER_LOG, JSON.stringify({
        records: this._records.slice(-500),
        summary: this._summary
      }, null, 2));
    } catch (err) {
      this._lastPersistError = err.message;
    }
  }

  _loadExisting() {
    try {
      if (fs.existsSync(METER_LOG)) {
        const data = JSON.parse(fs.readFileSync(METER_LOG, 'utf-8'));
        this._records = data.records || [];
        if (data.summary) {
          this._summary = data.summary;
        } else {
          this._rebuildSummary();
        }
      }
    } catch (err) {
      this._lastLoadError = err.message;
    }
  }
}

module.exports = ResourceMeter;
