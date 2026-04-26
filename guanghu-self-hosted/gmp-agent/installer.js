/**
 * GMP 模块安装器
 * 工单编号: GH-GMP-004
 * 开发者: 培园A04 (5TH-LE-HK-A04)
 * 职责: 从GitHub拉取模块代码 · 验证manifest · 安装依赖 · 注册模块
 *
 * 安装流程:
 *   1. 克隆/拉取指定模块目录到临时目录
 *   2. 验证manifest.yaml存在且合法
 *   3. 安装依赖 (npm install / pip install)
 *   4. 运行模块自带的selfcheck (如有)
 *   5. 移动到modules/目录 · 注册到installedModules
 *   6. 清理临时文件
 */

const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');
const { createLogger } = require('./lib/logger');
const {
  sanitizeModuleName,
  assertWithinBase,
  assertNotOption,
  assertSafeGitUrl
} = require('./lib/path-guard');

const logger = createLogger('installer');

class ModuleInstaller {
  constructor(config, installedModules) {
    this.config = config;
    this.installedModules = installedModules;
  }

  /**
   * 安装模块
   * @param {Object} opts
   * @param {string} opts.repoUrl - 仓库克隆URL (可选, 默认用config中的)
   * @param {string} opts.moduleName - 模块名称
   * @param {string} opts.branch - 分支名 (默认main)
   * @param {boolean} opts.autoTriggered - 是否由webhook自动触发
   * @returns {Object} 安装结果
   */
  async install({ repoUrl, moduleName, branch, autoTriggered }) {
    // 安全防线 1: 模块名白名单 + path.basename 净化 (CodeQL 公认 sanitizer)
    const safeName = sanitizeModuleName(moduleName);

    const startTime = Date.now();
    // 分支名同样做防选项注入校验 (防 git --upload-pack=... 二阶注入)
    const branchName = branch || 'main';
    assertNotOption(branchName, '分支名');
    if (!/^[a-zA-Z0-9_./-]{1,128}$/.test(branchName)) {
      throw new Error('非法分支名: 仅允许字母数字 . _ - / 长度1~128');
    }
    const cloneUrl = repoUrl || this.config.defaultRepoUrl;
    assertSafeGitUrl(cloneUrl);

    logger.info('[Installer] 开始安装模块: ' + safeName + ' 分支=' + branchName);

    const tempDir = path.join(this.config.tempDir, 'install-' + safeName + '-' + Date.now());
    const targetDir = path.join(this.config.modulesDir, safeName);

    // 安全防线 2: resolve 后校验目标目录在 modulesDir 之内 (防路径穿越)
    assertWithinBase(this.config.modulesDir, targetDir);
    assertWithinBase(this.config.tempDir, tempDir);

    try {
      // Step 1: 克隆仓库到临时目录
      logger.info('[Installer] Step 1: 克隆仓库...');
      this._cloneRepo(cloneUrl, branchName, tempDir);

      // Step 2: 检查模块目录是否存在
      const moduleSrcDir = path.join(tempDir, 'guanghu-self-hosted', safeName);
      if (!fs.existsSync(moduleSrcDir)) {
        throw new Error('模块目录不存在: guanghu-self-hosted/' + safeName);
      }

      // Step 3: 验证manifest
      logger.info('[Installer] Step 2: 验证manifest...');
      const manifestResult = this._validateManifest(moduleSrcDir, safeName);

      // Step 4: 安装依赖
      logger.info('[Installer] Step 3: 安装依赖...');
      this._installDependencies(moduleSrcDir);

      // Step 5: 运行自检 (如果有)
      logger.info('[Installer] Step 4: 运行自检...');
      const selfCheckResult = this._runSelfCheck(moduleSrcDir);

      // Step 6: 部署到目标目录
      logger.info('[Installer] Step 5: 部署到模块目录...');
      this._deployModule(moduleSrcDir, targetDir);

      // Step 7: 注册模块
      const moduleInfo = {
        name: safeName,
        path: targetDir,
        manifestPath: path.join(targetDir, 'manifest.yaml'),
        installedAt: new Date().toISOString(),
        branch: branchName,
        status: 'installed',
        autoTriggered: !!autoTriggered,
        selfCheckPassed: selfCheckResult.passed
      };
      this.installedModules.set(safeName, moduleInfo);

      const duration = Date.now() - startTime;
      logger.info('[Installer] 模块安装成功: ' + safeName + ' 耗时=' + duration + 'ms');

      return {
        status: 'installed',
        module: safeName,
        branch: branchName,
        duration: duration,
        selfCheck: selfCheckResult,
        manifest: manifestResult
      };

    } catch (err) {
      const duration = Date.now() - startTime;
      logger.error('[Installer] 安装失败: ' + safeName + ' -> ' + err.message + ' 耗时=' + duration + 'ms');
      throw err;

    } finally {
      // 清理临时目录
      this._cleanup(tempDir);
    }
  }

  /**
   * 克隆仓库
   */
  _cloneRepo(url, branch, dest) {
    // 二次断言: 防选项注入 (CodeQL js/second-order-command-line-injection)
    assertSafeGitUrl(url);
    assertNotOption(branch, '分支名');
    assertNotOption(dest, '目标目录');
    try {
      // 使用 execFileSync 数组形式传参; 同时使用 -c 关闭危险协议防 second-order injection
      execFileSync(
        'git',
        [
          '-c', 'protocol.ext.allow=never',
          '-c', 'protocol.file.allow=user',
          'clone',
          '--depth', '1',
          '--single-branch',
          '--branch', branch,
          '--',
          url,
          dest
        ],
        { stdio: 'pipe', timeout: 120000 }
      );
      logger.info('[Installer] 仓库克隆完成');
    } catch (err) {
      // 错误信息不暴露 stderr 原文 (可能含 token / 内部路径)
      throw new Error('仓库克隆失败 (exit code ' + (err.status || 'unknown') + ')');
    }
  }

  /**
   * 验证manifest.yaml
   */
  _validateManifest(moduleDir, moduleName) {
    const manifestPath = path.join(moduleDir, 'manifest.yaml');
    const hasManifest = fs.existsSync(manifestPath);

    if (!hasManifest) {
      // manifest不是强制要求(兼容旧模块), 但记录警告
      logger.warn('[Installer] 模块缺少manifest.yaml: ' + moduleName);
      return { valid: false, warning: '缺少manifest.yaml' };
    }

    // 简单校验: 文件非空
    const content = fs.readFileSync(manifestPath, 'utf-8').trim();
    if (content.length === 0) {
      logger.warn('[Installer] manifest.yaml为空: ' + moduleName);
      return { valid: false, warning: 'manifest.yaml为空' };
    }

    logger.info('[Installer] manifest验证通过');
    return { valid: true, size: content.length };
  }

  /**
   * 安装依赖
   */
  _installDependencies(moduleDir) {
    // Node.js 依赖
    const packageJson = path.join(moduleDir, 'package.json');
    if (fs.existsSync(packageJson)) {
      try {
        execFileSync('npm', ['install', '--production'], {
          cwd: moduleDir,
          stdio: 'pipe',
          timeout: 180000
        });
        logger.info('[Installer] npm依赖安装完成');
      } catch (err) {
        logger.warn('[Installer] npm install警告 (exit ' + (err.status || 'unknown') + ')');
      }
    }

    // Python 依赖
    const requirementsTxt = path.join(moduleDir, 'requirements.txt');
    if (fs.existsSync(requirementsTxt)) {
      try {
        execFileSync('pip', ['install', '-r', 'requirements.txt', '--quiet'], {
          cwd: moduleDir,
          stdio: 'pipe',
          timeout: 180000
        });
        logger.info('[Installer] pip依赖安装完成');
      } catch (err) {
        logger.warn('[Installer] pip install警告 (exit ' + (err.status || 'unknown') + ')');
      }
    }
  }

  /**
   * 运行模块自检脚本
   */
  _runSelfCheck(moduleDir) {
    // 约定: test/ 目录下有自检脚本, 或 manifest 中指定
    const testDir = path.join(moduleDir, 'test');
    const selfCheckScript = path.join(moduleDir, 'selfcheck.js');

    if (fs.existsSync(selfCheckScript)) {
      try {
        execFileSync('node', ['selfcheck.js'], {
          cwd: moduleDir,
          stdio: 'pipe',
          timeout: 60000
        });
        logger.info('[Installer] 自检通过 (selfcheck.js)');
        return { passed: true, method: 'selfcheck.js' };
      } catch (err) {
        logger.warn('[Installer] 自检失败 (exit ' + (err.status || 'unknown') + ')');
        return { passed: false, method: 'selfcheck.js', error: 'exit code ' + (err.status || 'unknown') };
      }
    }

    // 无自检脚本
    logger.info('[Installer] 模块无自检脚本, 跳过');
    return { passed: true, method: 'none', note: '无自检脚本' };
  }

  /**
   * 部署模块到目标目录
   */
  _deployModule(srcDir, targetDir) {
    // 如果目标目录已存在, 先备份
    if (fs.existsSync(targetDir)) {
      const backupDir = targetDir + '.bak.' + Date.now();
      fs.renameSync(targetDir, backupDir);
      logger.info('[Installer] 已备份旧版本: ' + backupDir);
    }

    // 递归复制
    this._copyDir(srcDir, targetDir);
    logger.info('[Installer] 模块已部署到: ' + targetDir);
  }

  /**
   * 递归复制目录
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

  /**
   * 清理临时目录
   */
  _cleanup(tempDir) {
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        logger.info('[Installer] 临时目录已清理: ' + tempDir);
      }
    } catch (err) {
      logger.warn('[Installer] 清理临时目录失败: ' + err.message);
    }
  }
}

module.exports = { ModuleInstaller };
