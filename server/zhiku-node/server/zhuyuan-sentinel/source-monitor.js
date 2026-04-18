/**
 * ═══════════════════════════════════════════════════════════
 * 铸渊哨兵 · 书源监测引擎 · Source Monitor
 * ═══════════════════════════════════════════════════════════
 *
 * 定时检测所有书源健康状态
 * 发现异常时自动尝试修复（切换备用端点、更新策略）
 * 联动镜鉴 Agent 生成工单
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

/**
 * 书源监测引擎
 */
class SourceMonitor {
  /**
   * @param {SentinelMemory} memory - 永久记忆实例
   * @param {object} adapters - { fanqieDirect, qimaoDirect, biqugeDirect }
   * @param {object} mirrorAgent - 镜鉴Agent实例（可选·联动生成工单）
   */
  constructor(memory, adapters, mirrorAgent) {
    this.memory = memory;
    this.adapters = adapters || {};
    this.mirrorAgent = mirrorAgent;
    this._scanning = false;
  }

  /**
   * 执行一次完整扫描
   * @returns {object} 扫描报告
   */
  async runFullScan() {
    if (this._scanning) {
      return { status: 'skip', message: '扫描正在进行中' };
    }

    this._scanning = true;
    const report = {
      timestamp: new Date().toISOString(),
      results: [],
      incidents: [],
      repairs: []
    };

    try {
      console.log('[ZY-SENTINEL] 🔍 开始书源健康扫描...');

      // 并行检查所有书源
      const checks = [];

      if (this.adapters.fanqieDirect) {
        checks.push(this._checkSource('fanqie-direct', this.adapters.fanqieDirect));
      }
      if (this.adapters.qimaoDirect) {
        checks.push(this._checkSource('qimao-direct', this.adapters.qimaoDirect));
      }
      if (this.adapters.biqugeDirect) {
        checks.push(this._checkSource('biquge-direct', this.adapters.biqugeDirect));
      }

      const results = await Promise.allSettled(checks);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          report.results.push(r.value);
          if (r.value.incident) report.incidents.push(r.value.incident);
          if (r.value.repair) report.repairs.push(r.value.repair);
        }
      }

      // 记录扫描
      this.memory.recordScan();
      this.memory.save();

      const okCount = report.results.filter(r => r.reachable).length;
      const totalCount = report.results.length;
      console.log(`[ZY-SENTINEL] ✅ 扫描完成 ${okCount}/${totalCount} 源在线`);

      // 如果有事件，联动镜鉴
      if (report.incidents.length > 0 && this.mirrorAgent) {
        this._notifyMirrorAgent(report.incidents);
      }

    } catch (err) {
      console.error('[ZY-SENTINEL] ⚠️ 扫描异常:', err.message);
      report.error = err.message;
    } finally {
      this._scanning = false;
    }

    return report;
  }

  /**
   * 检查单个书源
   */
  async _checkSource(sourceId, adapter) {
    const memState = this.memory.getSource(sourceId);
    const prevStatus = memState ? memState.status : 'unknown';

    let checkResult;
    try {
      checkResult = await adapter.healthCheck();
    } catch (err) {
      checkResult = {
        reachable: false,
        source: sourceId,
        error: err.message
      };
    }

    const now = new Date().toISOString();
    const totalChecks = (memState?.total_checks || 0) + 1;
    const totalSuccesses = (memState?.total_successes || 0) + (checkResult.reachable ? 1 : 0);

    // 更新记忆
    const updates = {
      status: checkResult.reachable ? 'ok' : 'down',
      last_check: now,
      total_checks: totalChecks,
      total_successes: totalSuccesses,
      last_latency_ms: checkResult.latency_ms || null
    };

    if (checkResult.reachable) {
      updates.consecutive_failures = 0;
      if (checkResult.strategy) {
        updates.search_strategy = checkResult.strategy;
      }
    } else {
      updates.consecutive_failures = (memState?.consecutive_failures || 0) + 1;
    }

    this.memory.updateSource(sourceId, updates);

    // 生成事件报告
    const result = {
      source: sourceId,
      reachable: checkResult.reachable,
      latency_ms: checkResult.latency_ms,
      result_count: checkResult.result_count,
      strategy: checkResult.strategy,
      incident: null,
      repair: null
    };

    // 状态变化检测
    if (prevStatus === 'ok' && !checkResult.reachable) {
      // 从在线变为离线 → 记录事件
      const incident = this.memory.recordIncident({
        source: sourceId,
        type: 'source_down',
        severity: 'critical',
        detail: `书源 ${sourceId} 不可达: ${checkResult.error || '未知错误'}`,
        prev_status: prevStatus,
        new_status: 'down'
      });
      result.incident = incident;
      console.warn(`[ZY-SENTINEL] 🔴 ${sourceId} 离线!`);

      // 尝试自动修复
      const repair = await this._attemptRepair(sourceId, adapter);
      if (repair) {
        result.repair = repair;
      }

    } else if (prevStatus === 'down' && checkResult.reachable) {
      // 从离线恢复在线 → 记录恢复事件
      this.memory.recordIncident({
        source: sourceId,
        type: 'source_recovered',
        severity: 'info',
        detail: `书源 ${sourceId} 已恢复在线 (延迟 ${checkResult.latency_ms}ms)`,
        prev_status: prevStatus,
        new_status: 'ok'
      });
      console.log(`[ZY-SENTINEL] 🟢 ${sourceId} 已恢复`);

    } else if (prevStatus === 'unknown' && checkResult.reachable) {
      // 首次检测成功
      this.memory.recordIncident({
        source: sourceId,
        type: 'first_check_ok',
        severity: 'info',
        detail: `书源 ${sourceId} 首次检测成功 (延迟 ${checkResult.latency_ms}ms)`
      });
    } else if (prevStatus === 'unknown' && !checkResult.reachable) {
      this.memory.recordIncident({
        source: sourceId,
        type: 'first_check_fail',
        severity: 'warning',
        detail: `书源 ${sourceId} 首次检测失败: ${checkResult.error || '不可达'}`
      });
    }

    return result;
  }

  /**
   * 尝试自动修复不可达的书源
   */
  async _attemptRepair(sourceId, adapter) {
    const memState = this.memory.getSource(sourceId);
    if (!memState) return null;

    console.log(`[ZY-SENTINEL] 🔧 尝试自动修复 ${sourceId}...`);

    // 策略1: 切换到备用主机
    const backupHosts = memState.backup_hosts || [];
    const knowledge = this.memory.get().knowledge || {};
    const deadHosts = knowledge.dead_hosts || [];
    for (const host of backupHosts) {
      if (deadHosts.includes(host)) {
        continue; // 跳过已知失效的主机
      }

      try {
        console.log(`[ZY-SENTINEL] 尝试备用主机: ${host}`);
        // 通知适配器切换主机
        if (adapter.updateConfig) {
          adapter.updateConfig({ primaryHost: host });
        }
        // 重新测试
        const recheck = await adapter.healthCheck();
        if (recheck.reachable) {
          // 修复成功
          this.memory.updateSource(sourceId, {
            active_host: host,
            status: 'ok',
            consecutive_failures: 0
          });

          const repair = this.memory.recordRepair({
            source: sourceId,
            action: 'switch_host',
            from_host: memState.active_host || memState.primary_host,
            to_host: host,
            success: true,
            detail: `切换到备用主机 ${host} 成功`
          });

          // 记录到知识库
          if (!this.memory.get().knowledge.verified_backup_hosts[sourceId]) {
            this.memory.get().knowledge.verified_backup_hosts[sourceId] = [];
          }
          if (!this.memory.get().knowledge.verified_backup_hosts[sourceId].includes(host)) {
            this.memory.get().knowledge.verified_backup_hosts[sourceId].push(host);
          }

          console.log(`[ZY-SENTINEL] ✅ ${sourceId} 已切换到 ${host}`);
          return repair;
        }
      } catch {
        continue;
      }
    }

    // 策略2: 如果有 updateConfig，尝试不同的搜索策略
    if (adapter.updateConfig) {
      const strategies = ['scrape', 'api'];
      for (const strategy of strategies) {
        try {
          adapter.updateConfig({ searchStrategy: strategy });
          const recheck = await adapter.healthCheck();
          if (recheck.reachable) {
            this.memory.updateSource(sourceId, {
              status: 'ok',
              consecutive_failures: 0,
              search_strategy: strategy
            });

            const repair = this.memory.recordRepair({
              source: sourceId,
              action: 'switch_strategy',
              strategy,
              success: true,
              detail: `切换搜索策略到 ${strategy} 成功`
            });
            console.log(`[ZY-SENTINEL] ✅ ${sourceId} 切换策略到 ${strategy}`);
            return repair;
          }
        } catch {
          continue;
        }
      }

      // 恢复原始主机配置
      adapter.updateConfig({ primaryHost: memState.primary_host });
    }

    // 修复失败
    const failRepair = this.memory.recordRepair({
      source: sourceId,
      action: 'auto_repair_failed',
      success: false,
      detail: `所有自动修复策略均失败 (尝试了 ${backupHosts.length} 个备用主机)`
    });

    console.warn(`[ZY-SENTINEL] ⚠️ ${sourceId} 自动修复失败`);
    return failRepair;
  }

  /**
   * 通知镜鉴Agent（联动生成工单）
   */
  _notifyMirrorAgent(incidents) {
    if (!this.mirrorAgent) return;
    try {
      // 镜鉴如果有创建工单的方法
      if (typeof this.mirrorAgent.createTicketFromSentinel === 'function') {
        for (const inc of incidents) {
          this.mirrorAgent.createTicketFromSentinel({
            title: `[哨兵] ${inc.type}: ${inc.source}`,
            severity: inc.severity,
            detail: inc.detail,
            sentinel_incident_id: inc.id
          });
        }
      }
    } catch (err) {
      console.warn(`[ZY-SENTINEL] 镜鉴通知失败: ${err.message}`);
    }
  }

  /**
   * 获取当前是否正在扫描
   */
  isScanning() {
    return this._scanning;
  }
}

module.exports = SourceMonitor;
