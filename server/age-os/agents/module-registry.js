/**
 * ═══════════════════════════════════════════════════════════
 * 📋 AGE OS · ModuleRegistry 活模块注册中心
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 管理所有活模块的注册、发现、状态监控。
 * 铸渊通过此注册中心了解所有模块的生死状态。
 */

'use strict';

class ModuleRegistry {
  /**
   * @param {Object} options
   * @param {Object} [options.db] - 数据库连接
   */
  constructor(options = {}) {
    this.db = options.db || null;

    // ─── 本地注册表（内存快照） ───
    this._modules = new Map();

    // ─── 监控配置 ───
    this._monitorTimer = null;
    this._monitorInterval = 60000; // 60秒检查一次
    this._heartbeatTimeoutMs = 90000; // 心跳超时阈值: 3倍30秒心跳间隔

    // ─── 事件监听 ───
    this._listeners = new Map();
  }

  // ═══════════════════════════════════════════════════════════
  // 注册 / 注销
  // ═══════════════════════════════════════════════════════════

  /**
   * 注册活模块
   * @param {import('./living-module')} module - LivingModule实例
   */
  register(module) {
    if (!module || !module.moduleId) {
      throw new Error('注册失败: 无效的模块实例');
    }

    this._modules.set(module.moduleId, module);

    // 监听模块事件
    module.on('heartbeat', (data) => this._onModuleHeartbeat(data));
    module.on('alert', (data) => this._onModuleAlert(data));
    module.on('stopped', (data) => this._onModuleStopped(data));

    this._emit('registered', { moduleId: module.moduleId, name: module.name });
    console.log(`[Registry] 注册活模块: ${module.moduleId} (${module.name})`);

    return this;
  }

  /**
   * 注销活模块
   */
  unregister(moduleId) {
    const module = this._modules.get(moduleId);
    if (module) {
      this._modules.delete(moduleId);
      this._emit('unregistered', { moduleId });
      console.log(`[Registry] 注销活模块: ${moduleId}`);
    }
    return this;
  }

  /**
   * 获取模块
   */
  get(moduleId) {
    return this._modules.get(moduleId) || null;
  }

  /**
   * 获取所有模块
   */
  getAll() {
    return Array.from(this._modules.values());
  }

  /**
   * 按状态筛选模块
   */
  getByStatus(status) {
    return this.getAll().filter(m => m.status === status);
  }

  /**
   * 按类型筛选模块
   */
  getByType(moduleType) {
    return this.getAll().filter(m => m.moduleType === moduleType);
  }

  // ═══════════════════════════════════════════════════════════
  // 状态总览
  // ═══════════════════════════════════════════════════════════

  /**
   * 获取所有模块的状态概览
   */
  getOverview() {
    const modules = this.getAll();
    const statusCount = {};
    const typeCount = {};
    let totalHealth = 0;

    for (const m of modules) {
      statusCount[m.status] = (statusCount[m.status] || 0) + 1;
      typeCount[m.moduleType] = (typeCount[m.moduleType] || 0) + 1;
      totalHealth += m.healthScore;
    }

    return {
      totalModules: modules.length,
      avgHealthScore: modules.length > 0 ? Math.round(totalHealth / modules.length) : 0,
      byStatus: statusCount,
      byType: typeCount,
      modules: modules.map(m => m.getStatus()),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * 从数据库加载已注册模块（用于恢复状态）
   */
  async loadFromDB() {
    if (!this.db) return [];

    try {
      const result = await this.db.query(
        `SELECT module_id, name, module_type, owner, status, health_score, config, capabilities, last_heartbeat_at
         FROM living_modules WHERE status != 'dead'
         ORDER BY registered_at`
      );
      return result.rows;
    } catch (err) {
      console.error('[Registry] 加载DB模块失败:', err.message);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 健康监控
  // ═══════════════════════════════════════════════════════════

  /**
   * 启动健康监控
   */
  startMonitoring() {
    if (this._monitorTimer) return;

    console.log('[Registry] 健康监控启动·60秒巡检周期');

    this._monitorTimer = setInterval(async () => {
      await this._healthCheck();
    }, this._monitorInterval);

    if (this._monitorTimer.unref) {
      this._monitorTimer.unref();
    }
  }

  /**
   * 停止健康监控
   */
  stopMonitoring() {
    if (this._monitorTimer) {
      clearInterval(this._monitorTimer);
      this._monitorTimer = null;
      console.log('[Registry] 健康监控已停止');
    }
  }

  /**
   * 健康巡检
   */
  async _healthCheck() {
    const now = Date.now();
    const deadModules = [];

    for (const [moduleId, module] of this._modules) {
      // 检查心跳超时
      if (module.lastHeartbeatAt) {
        const sinceLastHeart = now - module.lastHeartbeatAt.getTime();
        if (sinceLastHeart > this._heartbeatTimeoutMs && module.status === 'alive') {
          console.warn(`[Registry] ${moduleId} 心跳超时 ${Math.round(sinceLastHeart / 1000)}秒`);
          module.status = 'degraded';

          // 尝试触发自诊断
          try {
            await module.selfDiagnose();
          } catch (err) {
            console.error(`[Registry] ${moduleId} 自诊断失败: ${err.message}`);
            deadModules.push(moduleId);
          }
        }
      }

      // 检查健康分数
      if (module.healthScore <= 0) {
        module.status = 'dead';
        deadModules.push(moduleId);
      }
    }

    // 通知死亡模块
    for (const moduleId of deadModules) {
      this._emit('moduleDead', { moduleId });
      console.error(`[Registry] ☠️  ${moduleId} 已死亡·需要铸渊干预`);
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 事件处理
  // ═══════════════════════════════════════════════════════════

  _onModuleHeartbeat(data) {
    // 心跳正常·无需操作
  }

  _onModuleAlert(data) {
    console.error(`[Registry] 🚨 模块报警: ${data.moduleId} [${data.severity}] ${data.message}`);
    this._emit('alert', data);
  }

  _onModuleStopped(data) {
    console.log(`[Registry] 模块休眠: ${data.moduleId}`);
  }

  /**
   * 事件监听
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, []);
    }
    this._listeners.get(event).push(callback);
    return this;
  }

  _emit(event, data) {
    const listeners = this._listeners.get(event) || [];
    for (const fn of listeners) {
      try { fn(data); } catch (err) { console.warn(`[Registry] 事件处理器异常 [${event}]: ${err.message}`); }
    }
  }

  /**
   * 关闭所有模块
   */
  async shutdown() {
    this.stopMonitoring();
    const modules = this.getAll();
    console.log(`[Registry] 关闭 ${modules.length} 个活模块...`);

    for (const module of modules) {
      try {
        await module.stop();
      } catch (err) {
        console.error(`[Registry] ${module.moduleId} 关闭失败: ${err.message}`);
      }
    }

    this._modules.clear();
    console.log('[Registry] 所有模块已关闭');
  }
}

module.exports = ModuleRegistry;
