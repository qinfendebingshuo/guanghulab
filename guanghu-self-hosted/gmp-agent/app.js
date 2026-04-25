/**
 * GMP-Agent 守护进程 · 核心框架骨架
 * 工单编号: GH-GMP-004
 * 开发者: 培园A04 (5TH-LE-HK-A04)
 * 职责: Express服务启动 · 路由注册 · 模块生命周期管理 · 健康监控 · 优雅停机
 *
 * 架构定位: HLDP-ARCH-001 分发层[D-1] 执行体
 * GMP三层: L1(GMP协议·manifest) → L2(GMP-Agent·本文件) → L3(MCP接口)
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('./lib/logger');
const { loadConfig } = require('./lib/config');
const webhookRouter = require('./webhook');
const { ModuleInstaller } = require('./installer');
const { ModuleUninstaller } = require('./uninstaller');

const logger = createLogger('gmp-agent');

class GMPAgent {
  constructor() {
    this.app = express();
    this.server = null;
    this.config = null;
    this.installer = null;
    this.uninstaller = null;
    this.installedModules = new Map(); // moduleName -> moduleInfo
    this.startTime = Date.now();
    this.status = 'initializing';
  }

  /**
   * 初始化Agent
   */
  async init() {
    logger.info('[GMP-Agent] 初始化开始...');

    // 1. 加载配置
    this.config = loadConfig();
    logger.info('[GMP-Agent] 配置加载完成', { port: this.config.port, modulesDir: this.config.modulesDir });

    // 2. 确保模块目录存在
    this._ensureDirectories();

    // 3. 初始化安装器和卸载器
    this.installer = new ModuleInstaller(this.config, this.installedModules);
    this.uninstaller = new ModuleUninstaller(this.config, this.installedModules);

    // 4. 扫描已安装模块
    await this._scanInstalledModules();

    // 5. 配置Express中间件
    this._setupMiddleware();

    // 6. 注册路由
    this._setupRoutes();

    // 7. 注册优雅停机
    this._setupGracefulShutdown();

    this.status = 'ready';
    logger.info('[GMP-Agent] 初始化完成, 已发现 ' + this.installedModules.size + ' 个已安装模块');
  }

  /**
   * 确保必要目录存在
   */
  _ensureDirectories() {
    const dirs = [
      this.config.modulesDir,
      this.config.logsDir,
      this.config.tempDir
    ];
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info('[GMP-Agent] 创建目录: ' + dir);
      }
    }
  }

  /**
   * 扫描已安装模块目录, 加载manifest
   */
  async _scanInstalledModules() {
    const modulesDir = this.config.modulesDir;
    if (!fs.existsSync(modulesDir)) return;

    const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const manifestPath = path.join(modulesDir, entry.name, 'manifest.yaml');
      if (fs.existsSync(manifestPath)) {
        try {
          // 简单解析manifest (生产环境用js-yaml)
          const manifestRaw = fs.readFileSync(manifestPath, 'utf-8');
          const moduleInfo = {
            name: entry.name,
            path: path.join(modulesDir, entry.name),
            manifestPath: manifestPath,
            installedAt: fs.statSync(manifestPath).mtime.toISOString(),
            status: 'installed'
          };
          this.installedModules.set(entry.name, moduleInfo);
          logger.info('[GMP-Agent] 发现已安装模块: ' + entry.name);
        } catch (err) {
          logger.warn('[GMP-Agent] 模块manifest读取失败: ' + entry.name + ' -> ' + err.message);
        }
      }
    }
  }

  /**
   * 配置Express中间件
   */
  _setupMiddleware() {
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // 请求日志
    this.app.use((req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(req.method + ' ' + req.originalUrl + ' ' + res.statusCode + ' ' + duration + 'ms');
      });
      next();
    });
  }

  /**
   * 注册路由
   */
  _setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: this.status,
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
        modulesCount: this.installedModules.size,
        version: this.config.version,
        timestamp: new Date().toISOString()
      });
    });

    // 模块列表
    this.app.get('/api/modules', (req, res) => {
      const modules = [];
      for (const [name, info] of this.installedModules) {
        modules.push({
          name: name,
          status: info.status,
          path: info.path,
          installedAt: info.installedAt
        });
      }
      res.json({ modules: modules, total: modules.length });
    });

    // 模块详情
    this.app.get('/api/modules/:name', (req, res) => {
      const info = this.installedModules.get(req.params.name);
      if (!info) {
        return res.status(404).json({ error: '模块不存在: ' + req.params.name });
      }
      res.json(info);
    });

    // 安装模块
    this.app.post('/api/modules/install', async (req, res) => {
      try {
        const { repoUrl, moduleName, branch } = req.body;
        if (!moduleName) {
          return res.status(400).json({ error: '缺少moduleName参数' });
        }
        const result = await this.installer.install({ repoUrl, moduleName, branch });
        res.json(result);
      } catch (err) {
        logger.error('[GMP-Agent] 安装失败: ' + err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // 卸载模块
    this.app.post('/api/modules/uninstall', async (req, res) => {
      try {
        const { moduleName } = req.body;
        if (!moduleName) {
          return res.status(400).json({ error: '缺少moduleName参数' });
        }
        const result = await this.uninstaller.uninstall({ moduleName });
        res.json(result);
      } catch (err) {
        logger.error('[GMP-Agent] 卸载失败: ' + err.message);
        res.status(500).json({ error: err.message });
      }
    });

    // GitHub Webhook路由
    this.app.use('/webhook', webhookRouter(this));

    // 系统信息
    this.app.get('/api/system', (req, res) => {
      res.json({
        agent: 'GMP-Agent',
        version: this.config.version,
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        pid: process.pid
      });
    });

    // 404
    this.app.use((req, res) => {
      res.status(404).json({ error: 'Not Found', path: req.originalUrl });
    });

    // 错误处理
    this.app.use((err, req, res, next) => {
      logger.error('[GMP-Agent] 未捕获错误: ' + err.message);
      res.status(500).json({ error: 'Internal Server Error' });
    });
  }

  /**
   * 优雅停机
   */
  _setupGracefulShutdown() {
    const shutdown = (signal) => {
      logger.info('[GMP-Agent] 收到 ' + signal + ' 信号, 开始优雅停机...');
      this.status = 'shutting_down';

      if (this.server) {
        this.server.close(() => {
          logger.info('[GMP-Agent] HTTP服务已关闭');
          process.exit(0);
        });

        // 10秒超时强制退出
        setTimeout(() => {
          logger.warn('[GMP-Agent] 优雅停机超时, 强制退出');
          process.exit(1);
        }, 10000);
      } else {
        process.exit(0);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    process.on('uncaughtException', (err) => {
      logger.error('[GMP-Agent] 未捕获异常: ' + err.message + '\n' + err.stack);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('[GMP-Agent] 未处理Promise拒绝: ' + String(reason));
    });
  }

  /**
   * 启动服务
   */
  async start() {
    await this.init();

    const port = this.config.port;
    this.server = this.app.listen(port, () => {
      this.status = 'running';
      logger.info('========================================');
      logger.info('  GMP-Agent 守护进程已启动');
      logger.info('  端口: ' + port);
      logger.info('  版本: ' + this.config.version);
      logger.info('  模块目录: ' + this.config.modulesDir);
      logger.info('  已安装模块: ' + this.installedModules.size + ' 个');
      logger.info('  健康检查: http://localhost:' + port + '/health');
      logger.info('  Webhook: http://localhost:' + port + '/webhook/github');
      logger.info('========================================');
    });
  }
}

// 启动
const agent = new GMPAgent();
agent.start().catch((err) => {
  console.error('[GMP-Agent] 启动失败:', err);
  process.exit(1);
});

module.exports = { GMPAgent };
