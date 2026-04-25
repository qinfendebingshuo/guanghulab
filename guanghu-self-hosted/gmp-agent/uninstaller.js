/**
 * GMP 模块卸载器
 * 工单编号: GH-GMP-004
 * 开发者: 培园A04 (5TH-LE-HK-A04)
 * 职责: 安全停止模块 · 备份数据 · 移除模块文件 · 注销注册
 *
 * 卸载流程:
 *   1. 检查模块是否存在
 *   2. 停止模块进程 (如果有)
 *   3. 备份模块数据到归档目录
 *   4. 移除模块文件
 *   5. 从installedModules注销
 *   6. 清理残留
 */

const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
const { createLogger } = require('./lib/logger');

const logger = createLogger('uninstaller');

class ModuleUninstaller {
  constructor(config, installedModules) {
    this.config = config;
    this.installedModules = installedModules;
  }

  /**
   * 卸载模块
   * @param {Object} opts
   * @param {string} opts.moduleName - 模块名称
   * @param {boolean} opts.keepBackup - 是否保留备份 (默认true)
   * @param {boolean} opts.force - 是否强制卸载 (跳过停止步骤)
   * @returns {Object} 卸载结果
   */
  async uninstall({ moduleName, keepBackup, force }) {
    const startTime = Date.now();
    const shouldBackup = keepBackup !== false; // 默认保留备份

    logger.info('[Uninstaller] 开始卸载模块: ' + moduleName + ' backup=' + shouldBackup + ' force=' + !!force);

    // Step 1: 检查模块是否存在
    const moduleInfo = this.installedModules.get(moduleName);
    if (!moduleInfo) {
      throw new Error('模块未注册: ' + moduleName);
    }

    const moduleDir = moduleInfo.path;
    if (!fs.existsSync(moduleDir)) {
      // 文件不存在但注册表有记录 → 清理注册
      this.installedModules.delete(moduleName);
      logger.warn('[Uninstaller] 模块目录不存在, 已清理注册: ' + moduleName);
      return { status: 'cleaned', module: moduleName, note: '目录不存在·仅清理注册' };
    }

    try {
      // Step 2: 停止模块进程
      if (!force) {
        logger.info('[Uninstaller] Step 1: 停止模块进程...');
        await this._stopModule(moduleName, moduleDir);
      }

      // Step 3: 备份
      let backupPath = null;
      if (shouldBackup) {
        logger.info('[Uninstaller] Step 2: 备份模块...');
        backupPath = this._backupModule(moduleName, moduleDir);
      }

      // Step 4: 移除模块文件
      logger.info('[Uninstaller] Step 3: 移除模块文件...');
      this._removeModule(moduleDir);

      // Step 5: 注销
      this.installedModules.delete(moduleName);
      logger.info('[Uninstaller] Step 4: 模块已注销');

      const duration = Date.now() - startTime;
      logger.info('[Uninstaller] 模块卸载成功: ' + moduleName + ' 耗时=' + duration + 'ms');

      return {
        status: 'uninstalled',
        module: moduleName,
        duration: duration,
        backupPath: backupPath,
        backupKept: shouldBackup
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error('[Uninstaller] 卸载失败: ' + moduleName + ' -> ' + err.message + ' 耗时=' + duration + 'ms');
      throw err;
    }
  }

  /**
   * 停止模块进程
   * 约定: 模块如果有运行中的进程, 通过pidfile或pm2管理
   */
  async _stopModule(moduleName, moduleDir) {
    // 方式1: 检查pidfile
    const pidFile = path.join(moduleDir, '.pid');
    if (fs.existsSync(pidFile)) {
      try {
        const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
        if (pid && !isNaN(pid)) {
          process.kill(pid, 'SIGTERM');
          logger.info('[Uninstaller] 已发送SIGTERM到PID: ' + pid);
          // 等待进程退出
          await this._waitForExit(pid, 5000);
        }
      } catch (err) {
        if (err.code === 'ESRCH') {
          logger.info('[Uninstaller] 进程已不存在 (PID文件过期)');
        } else {
          logger.warn('[Uninstaller] 停止进程警告: ' + err.message);
        }
      }
    }

    // 方式2: 尝试pm2 stop (如果使用PM2管理)
    try {
      execSync('pm2 stop ' + moduleName + ' 2>/dev/null || true', {
        stdio: 'pipe',
        timeout: 10000
      });
    } catch (err) {
      // PM2不可用或模块不在PM2中, 忽略
    }

    // 方式3: 检查模块自带的stop脚本
    const stopScript = path.join(moduleDir, 'stop.sh');
    if (fs.existsSync(stopScript)) {
      try {
        execSync('bash stop.sh', {
          cwd: moduleDir,
          stdio: 'pipe',
          timeout: 15000
        });
        logger.info('[Uninstaller] 已执行模块stop脚本');
      } catch (err) {
        logger.warn('[Uninstaller] stop脚本执行警告: ' + err.message);
      }
    }
  }

  /**
   * 等待进程退出
   */
  _waitForExit(pid, timeout) {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        try {
          process.kill(pid, 0); // 检查进程是否存在
          if (Date.now() - start > timeout) {
            logger.warn('[Uninstaller] 进程未在超时内退出, PID=' + pid);
            resolve();
          } else {
            setTimeout(check, 500);
          }
        } catch (err) {
          // 进程已退出
          logger.info('[Uninstaller] 进程已退出, PID=' + pid);
          resolve();
        }
      };
      check();
    });
  }

  /**
   * 备份模块到归档目录
   */
  _backupModule(moduleName, moduleDir) {
    const archiveDir = path.join(this.config.modulesDir, '.archive');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(archiveDir, moduleName + '_' + timestamp);

    this._copyDir(moduleDir, backupDir);
    logger.info('[Uninstaller] 模块已备份: ' + backupDir);
    return backupDir;
  }

  /**
   * 移除模块目录
   */
  _removeModule(moduleDir) {
    try {
      fs.rmSync(moduleDir, { recursive: true, force: true });
      logger.info('[Uninstaller] 模块目录已移除: ' + moduleDir);
    } catch (err) {
      throw new Error('移除模块目录失败: ' + err.message);
    }
  }

  /**
   * 递归复制目录 (用于备份)
   */
  _copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        this._copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }
}

module.exports = { ModuleUninstaller };
