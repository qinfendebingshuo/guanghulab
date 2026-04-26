/**
 * GMP-Agent 健康监控模块
 * 工单编号: GH-GMP-004
 * 开发者: 译典A05 (5TH-LE-HK-A05)
 * 职责: 定期巡检所有已安装 GMP 模块 · 自动修复 · 状态上报
 *
 * 对齐 GMP-AGENT-SPEC v1.0 第7章:
 *   - 60秒巡检间隔 (可通过 GMP_HEALTH_INTERVAL 配置)
 *   - 自动修复策略: restart → delete+start → reinstall → 标记dead
 *   - 修复上限3次 (与铸渊 Agent 集群一致)
 *   - 状态变更通知 (预留 HLDP report 接口)
 */

'use strict';

const http = require('http');
const { execSync } = require('child_process');
const { createLogger } = require('./lib/logger');

const logger = createLogger('health');

// ─── 常量 ───────────────────────────────────────────────

/** 默认巡检间隔 (毫秒) */
const DEFAULT_INTERVAL = parseInt(process.env.GMP_HEALTH_INTERVAL || '60000', 10);

/** 单次健康检查超时 (毫秒) */
const CHECK_TIMEOUT = parseInt(process.env.GMP_HEALTH_TIMEOUT || '10000', 10);

/** 最大自动修复尝试次数 */
const MAX_RESTART_ATTEMPTS = 3;

/** 修复策略 (对齐 GMP-AGENT-SPEC 第7章) */
const RECOVERY_STRATEGIES = [
  { attempt: 1, action: 'pm2_restart', waitMs: 10000, description: 'PM2 restart' },
  { attempt: 2, action: 'pm2_delete_start', waitMs: 20000, description: 'PM2 delete + start' },
  { attempt: 3, action: 'reinstall', waitMs: 30000, description: '重新运行 install 脚本' }
];

// ─── HealthMonitor 类 ───────────────────────────────────

class HealthMonitor {
  /**
   * @param {object} agent - GMPAgent 实例
   */
  constructor(agent) {
    this.agent = agent;
    this.intervalId = null;
    this.restartCounters = new Map(); // moduleName -> { count, lastAttempt }
    this.isRunning = false;
  }

  /**
   * 启动定期巡检
   */
  start() {
    if (this.intervalId) {
      logger.warn('健康监控已在运行, 跳过重复启动');
      return;
    }

    const interval = DEFAULT_INTERVAL;
    logger.info('健康监控启动, 巡检间隔=' + interval + 'ms, 最大修复=' + MAX_RESTART_ATTEMPTS + '次');

    // 首次启动延迟 10 秒后执行第一次巡检 (等模块启动完成)
    setTimeout(() => {
      this._patrol();
    }, 10000);

    this.intervalId = setInterval(() => {
      this._patrol();
    }, interval);

    this.isRunning = true;
  }

  /**
   * 停止定期巡检
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      this.isRunning = false;
      logger.info('健康监控已停止');
    }
  }

  /**
   * 获取监控状态摘要
   * @returns {object}
   */
  getSummary() {
    const counters = {};
    for (const [name, data] of this.restartCounters) {
      counters[name] = {
        restartCount: data.count,
        lastAttempt: data.lastAttempt
      };
    }

    return {
      isRunning: this.isRunning,
      interval: DEFAULT_INTERVAL,
      maxRestartAttempts: MAX_RESTART_ATTEMPTS,
      restartCounters: counters
    };
  }

  /**
   * 手动触发一次全量巡检
   * @returns {Promise<Array<object>>} 巡检结果
   */
  async runOnce() {
    return this._patrol();
  }

  // ─── 内部方法 ────────────────────────────────────────

  /**
   * 执行一轮巡检
   */
  async _patrol() {
    const modulesMap = this.agent.installedModules;
    if (modulesMap.size === 0) {
      return [];
    }

    logger.debug('开始巡检, 共 ' + modulesMap.size + ' 个模块');
    const results = [];

    for (const [name, info] of modulesMap) {
      const health = await this._checkModule(name, info);
      results.push(health);

      const prevHealth = info.health || 'unknown';

      // 更新模块信息中的健康状态
      info.health = health.status;
      info.lastHealthCheck = health.checkedAt;

      // 状态变更检测
      if (prevHealth !== health.status) {
        logger.info('模块健康状态变更: ' + name + ' ' + prevHealth + ' → ' + health.status);
        this._onHealthChanged(name, prevHealth, health.status, info);
      }

      // 失败处理
      if (health.status === 'fail') {
        await this._handleFailure(name, info);
      } else if (health.status === 'ok') {
        // 恢复成功，重置计数器
        this._resetCounter(name);
      }
    }

    return results;
  }

  /**
   * 检查单个模块健康
   * @param {string} name - 模块名
   * @param {object} info - 模块信息
   * @returns {Promise<object>}
   */
  async _checkModule(name, info) {
    const result = {
      name: name,
      status: 'unknown',
      checkedAt: new Date().toISOString(),
      checks: {}
    };

    try {
      // Check 1: 目录存在
      const fs = require('fs');
      const dirExists = fs.existsSync(info.path);
      result.checks.directoryExists = dirExists;
      if (!dirExists) {
        result.status = 'fail';
        result.checks.error = '模块目录不存在';
        return result;
      }

      // Check 2: PM2 进程检测 (如果模块有 pm2 名称)
      const pm2Status = this._checkPM2Process(name);
      result.checks.pm2 = pm2Status;

      // Check 3: HTTP 健康端点检测 (如果模块有端口配置)
      if (info.port) {
        const httpOk = await this._httpHealthCheck(info.port);
        result.checks.httpHealth = httpOk;
      }

      // 综合判定
      if (pm2Status === 'online' || !info.port) {
        result.status = info.port
          ? (result.checks.httpHealth ? 'ok' : 'degraded')
          : 'ok';
      } else if (pm2Status === 'stopped' || pm2Status === 'errored') {
        result.status = 'fail';
      } else {
        // PM2 进程未找到但目录存在 → 可能未用 PM2 管理
        result.status = info.port
          ? (result.checks.httpHealth ? 'ok' : 'unknown')
          : 'ok';
      }

    } catch (err) {
      result.status = 'fail';
      result.checks.error = err.message;
    }

    return result;
  }

  /**
   * 检查 PM2 进程状态
   * @param {string} name - 进程名
   * @returns {string} 'online' | 'stopped' | 'errored' | 'not_found' | 'unknown'
   */
  _checkPM2Process(name) {
    try {
      const output = execSync('pm2 jlist', {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000
      });

      const processes = JSON.parse(output);
      const proc = processes.find(
        p => p.name === name || p.name === 'gmp-' + name
      );

      if (!proc) return 'not_found';
      return proc.pm2_env ? (proc.pm2_env.status || 'unknown') : 'unknown';

    } catch (err) {
      // PM2 不可用或命令失败
      logger.debug('PM2 检测失败 (' + name + '): ' + err.message);
      return 'unknown';
    }
  }

  /**
   * HTTP 健康端点检查
   * @param {number} port
   * @returns {Promise<boolean>}
   */
  _httpHealthCheck(port) {
    return new Promise((resolve) => {
      const req = http.get(
        'http://127.0.0.1:' + port + '/health',
        { timeout: CHECK_TIMEOUT },
        (res) => {
          // 消费响应体避免内存泄漏
          res.resume();
          resolve(res.statusCode >= 200 && res.statusCode < 400);
        }
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    });
  }

  /**
   * 处理模块健康检查失败
   * @param {string} name
   * @param {object} info
   */
  async _handleFailure(name, info) {
    const counter = this.restartCounters.get(name) || { count: 0, lastAttempt: null };

    if (counter.count >= MAX_RESTART_ATTEMPTS) {
      // 超过修复上限 → 标记为 dead
      if (info.status !== 'dead') {
        info.status = 'dead';
        logger.error('模块 ' + name + ' 自动修复已达上限 (' + MAX_RESTART_ATTEMPTS + '次), 标记为 dead');
        this._sendHLDPAlert(name, 'dead', '自动修复 ' + MAX_RESTART_ATTEMPTS + ' 次均失败');
      }
      return;
    }

    // 执行修复策略
    const strategy = RECOVERY_STRATEGIES[counter.count];
    counter.count++;
    counter.lastAttempt = new Date().toISOString();
    this.restartCounters.set(name, counter);

    logger.warn('尝试修复模块 ' + name + ' (第' + counter.count + '次/' + MAX_RESTART_ATTEMPTS + '): ' + strategy.description);

    try {
      await this._executeRecovery(name, info, strategy);

      // 等待后重新检查
      await this._sleep(strategy.waitMs);
      const recheck = await this._checkModule(name, info);

      if (recheck.status === 'ok' || recheck.status === 'degraded') {
        logger.info('模块 ' + name + ' 修复成功 (第' + counter.count + '次): ' + strategy.description);
        info.health = recheck.status;
        this._resetCounter(name);
      } else {
        logger.warn('模块 ' + name + ' 修复后仍未恢复, 将在下一轮继续尝试');
      }

    } catch (err) {
      logger.error('模块 ' + name + ' 修复执行异常: ' + err.message);
    }
  }

  /**
   * 执行修复操作
   * @param {string} name
   * @param {object} info
   * @param {object} strategy
   */
  async _executeRecovery(name, info, strategy) {
    const pm2Name = info.pm2Name || name;

    switch (strategy.action) {
      case 'pm2_restart':
        try {
          execSync('pm2 restart ' + pm2Name, {
            stdio: 'pipe',
            timeout: 15000
          });
          logger.info('PM2 restart ' + pm2Name + ' 已执行');
        } catch (err) {
          logger.warn('PM2 restart 失败: ' + err.message);
        }
        break;

      case 'pm2_delete_start':
        try {
          execSync('pm2 delete ' + pm2Name, { stdio: 'pipe', timeout: 10000 });
        } catch {
          // delete 失败不阻塞
        }
        try {
          const entryPoint = info.entryPoint || 'index.js';
          const startCmd = 'pm2 start ' + entryPoint + ' --name ' + pm2Name;
          execSync(startCmd, {
            cwd: info.path,
            stdio: 'pipe',
            timeout: 15000
          });
          logger.info('PM2 delete+start ' + pm2Name + ' 已执行');
        } catch (err) {
          logger.warn('PM2 start 失败: ' + err.message);
        }
        break;

      case 'reinstall':
        // 重新运行安装脚本 (如果有)
        const path = require('path');
        const fs = require('fs');
        const installScript = path.join(info.path, 'install.sh');
        if (fs.existsSync(installScript)) {
          try {
            execSync('bash install.sh', {
              cwd: info.path,
              stdio: 'pipe',
              timeout: 120000
            });
            logger.info('install.sh 重新执行完成: ' + name);
          } catch (err) {
            logger.error('install.sh 执行失败: ' + err.message);
          }
        } else {
          // 没有 install.sh, 尝试 npm install + pm2 restart
          try {
            const packageJson = path.join(info.path, 'package.json');
            if (fs.existsSync(packageJson)) {
              execSync('npm install --production', {
                cwd: info.path,
                stdio: 'pipe',
                timeout: 60000
              });
            }
            execSync('pm2 restart ' + pm2Name, { stdio: 'pipe', timeout: 15000 });
            logger.info('npm install + pm2 restart 已执行: ' + name);
          } catch (err) {
            logger.error('reinstall fallback 失败: ' + err.message);
          }
        }
        break;

      default:
        logger.warn('未知修复策略: ' + strategy.action);
    }
  }

  /**
   * 健康状态变更回调
   */
  _onHealthChanged(name, from, to, info) {
    // 预留: EventBus 通知
    // EventBus.emit('gmp:module:health_changed', { module: name, from, to });

    // 预留: HLDP report
    if (to === 'fail' || to === 'dead') {
      this._sendHLDPAlert(name, to, from + ' → ' + to);
    }
  }

  /**
   * 发送 HLDP 警报 (预留接口)
   */
  _sendHLDPAlert(moduleName, level, message) {
    // 预留: 对接铸渊 Agent 集群的 HLDP 消息通道
    logger.warn('HLDP Alert [' + level + '] 模块=' + moduleName + ': ' + message);
    // TODO: 接入 HLDP reporter (hldp-reporter.js)
  }

  /**
   * 重置修复计数器
   */
  _resetCounter(name) {
    if (this.restartCounters.has(name)) {
      this.restartCounters.delete(name);
    }
  }

  /**
   * 异步等待
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ─── 导出 ──────────────────────────────────────────────

module.exports = {
  HealthMonitor,
  DEFAULT_INTERVAL,
  CHECK_TIMEOUT,
  MAX_RESTART_ATTEMPTS,
  RECOVERY_STRATEGIES
};
