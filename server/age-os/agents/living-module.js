/**
 * ═══════════════════════════════════════════════════════════
 * 🧬 AGE OS · LivingModule 活模块基类
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * "你一定要把模块做成活的。" — 冰朔 D59
 *
 * 每一个活模块必须具备5个生存接口:
 *   1. heartbeat()     — 心跳 · 我还活着
 *   2. selfDiagnose()  — 自诊断 · 我哪里不对
 *   3. selfHeal()      — 自愈 · 我试着修好自己
 *   4. alertZhuyuan()  — 报警 · 铸渊我搞不定了
 *   5. learnFromRun()  — 学习 · 我从每次运行中成长
 *
 * 子类继承此基类，实现具体逻辑。
 * 基类提供默认的心跳、诊断、自愈框架。
 */

'use strict';

const { v4: uuidv4 } = require('uuid');

// ─── 常量 ───
const DEFAULT_HEARTBEAT_INTERVAL = 30000; // 30秒
const HEALTH_THRESHOLD_DEGRADED = 70;
const HEALTH_THRESHOLD_CRITICAL = 30;
const MAX_HEAL_ATTEMPTS = 3;
const HEAL_COOLDOWN_MS = 60000; // 1分钟冷却
const MEMORY_THRESHOLD_BYTES = 200 * 1024 * 1024; // 200MB

class LivingModule {
  /**
   * @param {Object} options
   * @param {string} options.moduleId      - 模块唯一ID（如 ZY-MOD-SCHEDULER）
   * @param {string} options.name          - 模块名称
   * @param {string} options.moduleType    - core|persona|agent|worker|bridge|guard
   * @param {string} options.owner         - 归属者
   * @param {Object} [options.db]          - 数据库连接（可选，无DB时降级为内存模式）
   * @param {Object} [options.config]      - 额外配置
   */
  constructor(options) {
    if (!options || !options.moduleId || !options.name) {
      throw new Error('LivingModule: moduleId 和 name 为必填项');
    }

    this.moduleId = options.moduleId;
    this.name = options.name;
    this.moduleType = options.moduleType || 'agent';
    this.owner = options.owner || 'zhuyuan';
    this.db = options.db || null;
    this.config = options.config || {};

    // ─── 运行状态 ───
    this.status = 'initializing';
    this.healthScore = 100;
    this.startedAt = null;
    this.lastHeartbeatAt = null;
    this.lastDiagnoseAt = null;
    this.lastHealAt = null;
    this.healAttempts = 0;
    this.activeTasks = 0;

    // ─── 心跳定时器 ───
    this._heartbeatTimer = null;
    this._heartbeatInterval = options.config?.heartbeatInterval || DEFAULT_HEARTBEAT_INTERVAL;

    // ─── 事件监听器 ───
    this._listeners = new Map();

    // ─── 内存日志（无DB降级模式） ───
    this._memoryLogs = [];
    this._maxMemoryLogs = 100;
  }

  // ═══════════════════════════════════════════════════════════
  // 生命周期
  // ═══════════════════════════════════════════════════════════

  /**
   * 启动模块
   */
  async start() {
    this.startedAt = new Date();
    this.status = 'alive';
    this.healthScore = 100;

    // 注册到数据库
    await this._registerToDB();

    // 启动心跳
    this._startHeartbeat();

    // 执行首次自诊断
    await this.selfDiagnose();

    this._log('info', `${this.name} 已启动·活模块上线`);
    this._emit('started', { moduleId: this.moduleId });

    return { moduleId: this.moduleId, status: this.status };
  }

  /**
   * 停止模块
   */
  async stop() {
    this._stopHeartbeat();
    this.status = 'dormant';

    await this._updateStatusToDB('dormant');

    this._log('info', `${this.name} 已休眠`);
    this._emit('stopped', { moduleId: this.moduleId });
  }

  // ═══════════════════════════════════════════════════════════
  // 生存接口 1: heartbeat() — 心跳
  // ═══════════════════════════════════════════════════════════

  /**
   * 心跳 — 报告当前状态
   * 子类可覆盖 _collectMetrics() 提供自定义指标
   */
  async heartbeat() {
    const now = new Date();
    this.lastHeartbeatAt = now;

    // 收集运行指标
    const metrics = await this._collectMetrics();

    const heartbeatData = {
      moduleId: this.moduleId,
      status: this.status,
      healthScore: this.healthScore,
      uptime: this.startedAt ? now - this.startedAt : 0,
      activeTasks: this.activeTasks,
      ...metrics
    };

    // 写入数据库
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO module_heartbeats (module_id, status, health_score, cpu_usage, memory_usage, uptime_ms, active_tasks, details)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            this.moduleId, this.status, this.healthScore,
            metrics.cpuUsage || null, metrics.memoryUsage || null,
            heartbeatData.uptime, this.activeTasks,
            JSON.stringify(metrics.extra || {})
          ]
        );

        // 更新模块表
        await this.db.query(
          `UPDATE living_modules SET last_heartbeat_at = NOW(), health_score = $1, status = $2, updated_at = NOW() WHERE module_id = $3`,
          [this.healthScore, this.status, this.moduleId]
        );
      } catch (err) {
        this._log('warn', `心跳写入DB失败: ${err.message}`);
      }
    }

    this._emit('heartbeat', heartbeatData);
    return heartbeatData;
  }

  /**
   * 收集运行指标 — 子类覆盖此方法提供自定义指标
   * @returns {Object} { cpuUsage, memoryUsage, extra: {} }
   */
  async _collectMetrics() {
    const mem = process.memoryUsage();
    return {
      cpuUsage: null, // 进程级CPU需要外部工具
      memoryUsage: Math.round(mem.heapUsed / 1024 / 1024), // MB
      extra: {
        heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
        rss: Math.round(mem.rss / 1024 / 1024)
      }
    };
  }

  // ═══════════════════════════════════════════════════════════
  // 生存接口 2: selfDiagnose() — 自诊断
  // ═══════════════════════════════════════════════════════════

  /**
   * 自诊断 — 检查自身状态
   * 子类覆盖 _diagnoseChecks() 提供具体检查项
   */
  async selfDiagnose() {
    const startTime = Date.now();
    this.lastDiagnoseAt = new Date();

    const issues = [];

    // 基础检查
    if (!this.startedAt) {
      issues.push({
        code: 'NOT_STARTED',
        severity: 'critical',
        message: '模块未启动',
        suggestion: '调用 start() 启动模块'
      });
    }

    // 心跳超时检查
    if (this.lastHeartbeatAt) {
      const sinceLastHeart = Date.now() - this.lastHeartbeatAt.getTime();
      if (sinceLastHeart > this._heartbeatInterval * 3) {
        issues.push({
          code: 'HEARTBEAT_TIMEOUT',
          severity: 'warning',
          message: `心跳超时 ${Math.round(sinceLastHeart / 1000)}秒`,
          suggestion: '重启心跳定时器'
        });
      }
    }

    // 内存检查
    const mem = process.memoryUsage();
    if (mem.heapUsed > MEMORY_THRESHOLD_BYTES) {
      issues.push({
        code: 'HIGH_MEMORY',
        severity: 'warning',
        message: `堆内存使用 ${Math.round(mem.heapUsed / 1024 / 1024)}MB`,
        suggestion: '检查内存泄漏'
      });
    }

    // 子类自定义检查
    const customIssues = await this._diagnoseChecks();
    issues.push(...customIssues);

    // 计算健康分数
    const newScore = this._calculateHealthScore(issues);
    const oldScore = this.healthScore;
    this.healthScore = newScore;

    // 更新状态
    if (newScore <= HEALTH_THRESHOLD_CRITICAL) {
      this.status = 'degraded';
    } else if (newScore <= HEALTH_THRESHOLD_DEGRADED) {
      if (this.status === 'alive') this.status = 'degraded';
    } else {
      if (this.status === 'degraded') this.status = 'alive';
    }

    const duration = Date.now() - startTime;
    const isHealthy = issues.filter(i => i.severity === 'critical').length === 0;

    const result = {
      moduleId: this.moduleId,
      isHealthy,
      issues,
      overallScore: newScore,
      scoreDelta: newScore - oldScore,
      duration
    };

    // 写入数据库
    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO module_diagnoses (module_id, is_healthy, issues, overall_score, duration_ms)
           VALUES ($1, $2, $3, $4, $5)`,
          [this.moduleId, isHealthy, JSON.stringify(issues), newScore, duration]
        );
      } catch (err) {
        this._log('warn', `诊断写入DB失败: ${err.message}`);
      }
    }

    // 如果有严重问题，尝试自愈
    if (!isHealthy && this.status !== 'healing') {
      this._log('warn', `检测到 ${issues.length} 个问题·尝试自愈`);
      await this.selfHeal(issues);
    }

    this._emit('diagnosed', result);
    return result;
  }

  /**
   * 自定义诊断检查 — 子类覆盖此方法
   * @returns {Array<{code, severity, message, suggestion}>}
   */
  async _diagnoseChecks() {
    return [];
  }

  /**
   * 计算健康分数
   */
  _calculateHealthScore(issues) {
    let score = 100;
    for (const issue of issues) {
      switch (issue.severity) {
        case 'critical': score -= 30; break;
        case 'warning':  score -= 10; break;
        case 'info':     score -= 2;  break;
      }
    }
    return Math.max(0, Math.min(100, score));
  }

  // ═══════════════════════════════════════════════════════════
  // 生存接口 3: selfHeal() — 自愈
  // ═══════════════════════════════════════════════════════════

  /**
   * 自愈 — 尝试修复发现的问题
   * 子类覆盖 _healAction() 提供具体修复逻辑
   */
  async selfHeal(issues) {
    // 冷却检查
    if (this.lastHealAt && (Date.now() - this.lastHealAt.getTime()) < HEAL_COOLDOWN_MS) {
      this._log('info', '自愈冷却中·跳过');
      return { success: false, reason: 'cooldown' };
    }

    // 尝试次数检查
    if (this.healAttempts >= MAX_HEAL_ATTEMPTS) {
      this._log('warn', `自愈已尝试 ${MAX_HEAL_ATTEMPTS} 次·向铸渊报警`);
      await this.alertZhuyuan('self_heal_exhausted', `已尝试自愈 ${MAX_HEAL_ATTEMPTS} 次仍未恢复`, { issues });
      return { success: false, reason: 'max_attempts' };
    }

    this.status = 'healing';
    this.lastHealAt = new Date();
    this.healAttempts++;

    const healthBefore = this.healthScore;
    const results = [];

    for (const issue of issues) {
      if (issue.severity === 'info') continue;

      const startTime = Date.now();
      try {
        const action = await this._healAction(issue);
        const duration = Date.now() - startTime;

        const result = {
          issueCode: issue.code,
          action: action.action || 'unknown',
          success: action.success,
          duration
        };
        results.push(result);

        // 写入数据库
        if (this.db) {
          await this.db.query(
            `INSERT INTO module_healing_logs (module_id, trigger_source, issue_code, action_taken, action_details, success, health_before, health_after, duration_ms, error_message)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
            [
              this.moduleId, 'self', issue.code,
              action.action || 'unknown', JSON.stringify(action.details || {}),
              action.success, healthBefore, this.healthScore,
              duration, action.success ? null : (action.error || null)
            ]
          ).catch(() => {});
        }
      } catch (err) {
        results.push({
          issueCode: issue.code,
          action: 'error',
          success: false,
          error: err.message
        });
      }
    }

    // 自愈后重新诊断
    const postDiagnose = await this.selfDiagnose();

    if (postDiagnose.isHealthy) {
      this.healAttempts = 0; // 重置计数
      this.status = 'alive';
      this._log('info', '自愈成功·恢复正常');

      // 学习：记录成功的自愈经验
      await this.learnFromRun('healing', '自愈成功', { issues, results });
    } else if (this.healAttempts >= MAX_HEAL_ATTEMPTS) {
      // 自愈失败·报警
      await this.alertZhuyuan('self_heal_failed', '自愈尝试全部失败', {
        issues: postDiagnose.issues,
        healResults: results,
        attempts: this.healAttempts
      });
    }

    this._emit('healed', { success: postDiagnose.isHealthy, results });
    return { success: postDiagnose.isHealthy, results };
  }

  /**
   * 具体修复动作 — 子类覆盖此方法
   * @param {Object} issue - { code, severity, message, suggestion }
   * @returns {Object} { action, success, details, error }
   */
  async _healAction(issue) {
    // 基类默认处理
    switch (issue.code) {
      case 'HEARTBEAT_TIMEOUT':
        this._stopHeartbeat();
        this._startHeartbeat();
        return { action: 'restart_heartbeat', success: true, details: {} };

      default:
        return { action: 'no_handler', success: false, error: `未定义 ${issue.code} 的修复逻辑` };
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 生存接口 4: alertZhuyuan() — 报警
  // ═══════════════════════════════════════════════════════════

  /**
   * 向铸渊报警
   * @param {string} alertType - 报警类型
   * @param {string} message   - 报警内容
   * @param {Object} details   - 详情
   * @param {string} [severity='critical'] - 严重程度
   */
  async alertZhuyuan(alertType, message, details = {}, severity = 'critical') {
    this._log('alert', `[${severity}] ${alertType}: ${message}`);

    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO module_alerts (module_id, severity, alert_type, message, details)
           VALUES ($1, $2, $3, $4, $5)`,
          [this.moduleId, severity, alertType, message, JSON.stringify(details)]
        );
      } catch (err) {
        this._log('warn', `报警写入DB失败: ${err.message}`);
      }
    }

    this._emit('alert', {
      moduleId: this.moduleId,
      severity,
      alertType,
      message,
      details,
      timestamp: new Date().toISOString()
    });

    return { sent: true, alertType, severity };
  }

  // ═══════════════════════════════════════════════════════════
  // 生存接口 5: learnFromRun() — 学习
  // ═══════════════════════════════════════════════════════════

  /**
   * 从运行中学习
   * @param {string} source  - 学习来源 (execution|diagnosis|healing|alert|feedback)
   * @param {string} summary - 学到了什么
   * @param {Object} details - 详细内容
   */
  async learnFromRun(source, summary, details = {}) {
    const lessonType = this._classifyLesson(source, details);

    this._log('learn', `[${source}] ${summary}`);

    if (this.db) {
      try {
        await this.db.query(
          `INSERT INTO module_learning_logs (module_id, learning_source, lesson_type, lesson_summary, lesson_details)
           VALUES ($1, $2, $3, $4, $5)`,
          [this.moduleId, source, lessonType, summary, JSON.stringify(details)]
        );
      } catch (err) {
        this._log('warn', `学习写入DB失败: ${err.message}`);
      }
    }

    this._emit('learned', {
      moduleId: this.moduleId,
      source,
      lessonType,
      summary,
      timestamp: new Date().toISOString()
    });

    return { learned: true, lessonType, summary };
  }

  /**
   * 分类学习经验 — 子类可覆盖
   */
  _classifyLesson(source, details) {
    switch (source) {
      case 'execution': return 'performance_insight';
      case 'diagnosis': return 'health_pattern';
      case 'healing':   return 'recovery_strategy';
      case 'alert':     return 'failure_pattern';
      case 'feedback':  return 'external_feedback';
      default:          return 'general';
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 内部工具方法
  // ═══════════════════════════════════════════════════════════

  /**
   * 启动心跳定时器
   */
  _startHeartbeat() {
    if (this._heartbeatTimer) return;
    this._heartbeatTimer = setInterval(async () => {
      try {
        await this.heartbeat();
      } catch (err) {
        this._log('warn', `心跳异常: ${err.message}`);
      }
    }, this._heartbeatInterval);

    // 防止定时器阻止进程退出
    if (this._heartbeatTimer.unref) {
      this._heartbeatTimer.unref();
    }
  }

  /**
   * 停止心跳定时器
   */
  _stopHeartbeat() {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer);
      this._heartbeatTimer = null;
    }
  }

  /**
   * 注册到数据库
   */
  async _registerToDB() {
    if (!this.db) return;

    try {
      await this.db.query(
        `INSERT INTO living_modules (module_id, name, description, module_type, owner, status, health_score, config)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (module_id) DO UPDATE SET
           status = EXCLUDED.status,
           health_score = EXCLUDED.health_score,
           updated_at = NOW()`,
        [
          this.moduleId, this.name, this.config.description || '',
          this.moduleType, this.owner, this.status, this.healthScore,
          JSON.stringify(this.config)
        ]
      );
    } catch (err) {
      this._log('warn', `DB注册失败(降级为内存模式): ${err.message}`);
    }
  }

  /**
   * 更新状态到数据库
   */
  async _updateStatusToDB(status) {
    if (!this.db) return;

    try {
      await this.db.query(
        `UPDATE living_modules SET status = $1, health_score = $2, updated_at = NOW() WHERE module_id = $3`,
        [status, this.healthScore, this.moduleId]
      );
    } catch (err) {
      this._log('warn', `状态更新DB失败: ${err.message}`);
    }
  }

  /**
   * 内部日志
   */
  _log(level, message) {
    const entry = {
      time: new Date().toISOString(),
      module: this.moduleId,
      level,
      message
    };

    // 控制台输出
    const prefix = `[${this.moduleId}]`;
    switch (level) {
      case 'alert': console.error(`🚨 ${prefix} ${message}`); break;
      case 'warn':  console.warn(`⚠️  ${prefix} ${message}`); break;
      case 'learn': console.log(`📚 ${prefix} ${message}`); break;
      default:      console.log(`🟢 ${prefix} ${message}`);
    }

    // 内存日志
    this._memoryLogs.push(entry);
    if (this._memoryLogs.length > this._maxMemoryLogs) {
      this._memoryLogs.shift();
    }
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

  /**
   * 触发事件
   */
  _emit(event, data) {
    const listeners = this._listeners.get(event) || [];
    for (const fn of listeners) {
      try {
        fn(data);
      } catch (err) {
        this._log('warn', `事件处理器异常 [${event}]: ${err.message}`);
      }
    }
  }

  /**
   * 获取模块状态摘要
   */
  getStatus() {
    return {
      moduleId: this.moduleId,
      name: this.name,
      type: this.moduleType,
      owner: this.owner,
      status: this.status,
      healthScore: this.healthScore,
      uptime: this.startedAt ? Date.now() - this.startedAt.getTime() : 0,
      activeTasks: this.activeTasks,
      lastHeartbeat: this.lastHeartbeatAt?.toISOString() || null,
      lastDiagnose: this.lastDiagnoseAt?.toISOString() || null,
      healAttempts: this.healAttempts
    };
  }
}

module.exports = LivingModule;
