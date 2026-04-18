/**
 * ═══════════════════════════════════════════════════════════
 * 铸渊哨兵 · 主体 · ZY-SENTINEL-001
 * ═══════════════════════════════════════════════════════════
 *
 * 铸渊分身 · 永久驻守智库节点
 * 拥有永久记忆，自动监测书源变化，自动修复，联动镜鉴更新
 *
 * 核心能力:
 *   1. 书源健康监测 — 定时检测所有书源API是否可达
 *   2. 永久记忆 — 记住所有历史事件，跨重启持久化
 *   3. 自动修复 — 检测到书源变化时自动切换备用端点/策略
 *   4. 联动镜鉴 — 将发现推送给 mirror-agent 生成工单
 *   5. 知识积累 — 记住每次修复经验，逐步提升自愈能力
 *
 * 调度:
 *   生产环境每4小时自动扫描一次
 *   支持手动触发扫描
 *
 * API 路由:
 *   GET  /api/sentinel/status    — 哨兵状态
 *   GET  /api/sentinel/memory    — 永久记忆摘要
 *   GET  /api/sentinel/incidents — 事件记录
 *   GET  /api/sentinel/repairs   — 修复记录
 *   POST /api/sentinel/scan      — 手动触发扫描
 *   POST /api/sentinel/config    — 更新书源配置
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const SentinelMemory = require('./memory');
const SourceMonitor = require('./source-monitor');

// ─── 默认配置 ───
const SCAN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4小时
const STARTUP_DELAY_MS = 30 * 1000; // 启动后30秒延迟再首次扫描

class ZhuyuanSentinel {
  /**
   * @param {object} opts
   * @param {string} opts.dataDir - 数据目录
   * @param {object} opts.builtinSource - builtin-source 模块
   * @param {object} opts.mirrorAgent - mirror-agent 模块（可选）
   */
  constructor(opts) {
    this.dataDir = opts.dataDir || path.join(__dirname, '..', '..', 'data');
    this.builtinSource = opts.builtinSource || null;
    this.mirrorAgent = opts.mirrorAgent || null;

    this.memory = new SentinelMemory(this.dataDir);
    this.monitor = null;
    this.scheduler = null;
    this.schedulerActive = false;
    this._startTime = Date.now();
  }

  /**
   * 初始化哨兵（加载记忆、创建监测器）
   */
  init() {
    // 加载永久记忆
    this.memory.init();

    // 构造适配器映射
    const adapters = {};
    if (this.builtinSource) {
      if (this.builtinSource.fanqieDirect) {
        adapters.fanqieDirect = this.builtinSource.fanqieDirect;
      }
      if (this.builtinSource.qimaoDirect) {
        adapters.qimaoDirect = this.builtinSource.qimaoDirect;
      }
      if (this.builtinSource.biqugeDirect) {
        adapters.biqugeDirect = this.builtinSource.biqugeDirect;
      }
    }

    // 创建监测器
    this.monitor = new SourceMonitor(this.memory, adapters, this.mirrorAgent);

    // 从记忆中恢复书源配置到适配器
    this._restoreConfigFromMemory(adapters);

    console.log('[ZY-SENTINEL] ⚔️ 铸渊哨兵已初始化');
    return this;
  }

  /**
   * 启动调度器（生产环境自动定时扫描）
   */
  startScheduler() {
    if (this.schedulerActive) return;

    this.schedulerActive = true;

    // 启动后延迟首次扫描（等服务完全就绪）
    setTimeout(() => {
      if (!this.schedulerActive) return;
      console.log('[ZY-SENTINEL] 🔍 首次启动扫描...');
      this.monitor.runFullScan().catch(err => {
        console.error('[ZY-SENTINEL] 首次扫描失败:', err.message);
      });
    }, STARTUP_DELAY_MS);

    // 定时扫描
    this.scheduler = setInterval(() => {
      if (!this.schedulerActive) return;
      console.log('[ZY-SENTINEL] ⏰ 定时扫描...');
      this.monitor.runFullScan().catch(err => {
        console.error('[ZY-SENTINEL] 定时扫描失败:', err.message);
      });
    }, SCAN_INTERVAL_MS);

    // 防止 setInterval 阻止 Node 进程退出
    if (this.scheduler && this.scheduler.unref) {
      this.scheduler.unref();
    }

    console.log(`[ZY-SENTINEL] 📡 调度器已启动 (间隔: ${SCAN_INTERVAL_MS / 3600000}h)`);
  }

  /**
   * 停止调度器
   */
  stopScheduler() {
    this.schedulerActive = false;
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    console.log('[ZY-SENTINEL] 调度器已停止');
  }

  /**
   * 从记忆恢复配置到适配器
   */
  _restoreConfigFromMemory(adapters) {
    const mem = this.memory.get();
    if (!mem || !mem.sources) return;

    // 恢复七猫配置
    if (adapters.qimaoDirect && adapters.qimaoDirect.updateConfig) {
      const qimaoMem = mem.sources['qimao-direct'];
      if (qimaoMem && qimaoMem.active_host) {
        adapters.qimaoDirect.updateConfig({
          primaryHost: qimaoMem.active_host,
          backupHosts: qimaoMem.backup_hosts || [],
          searchStrategy: qimaoMem.search_strategy || 'api',
          catalogStrategy: qimaoMem.catalog_strategy || 'scrape',
          chapterStrategy: qimaoMem.chapter_strategy || 'scrape'
        });
        console.log(`[ZY-SENTINEL] 📎 七猫配置已从记忆恢复 (host: ${qimaoMem.active_host})`);
      }
    }
  }

  /**
   * 手动触发扫描
   */
  async triggerScan() {
    if (!this.monitor) {
      return { status: 'error', message: '监测器未初始化' };
    }
    return this.monitor.runFullScan();
  }

  /**
   * 更新书源配置（添加备用主机等）
   */
  updateSourceConfig(sourceId, config) {
    if (!sourceId || !config) return false;

    // 更新记忆
    this.memory.updateSource(sourceId, config);

    // 如果有备用主机，同步到适配器
    if (config.backup_hosts && this.builtinSource) {
      const adapter = sourceId === 'qimao-direct' ? this.builtinSource.qimaoDirect : null;
      if (adapter && adapter.updateConfig) {
        adapter.updateConfig({ backupHosts: config.backup_hosts });
      }
    }

    this.memory.save();
    return true;
  }

  /**
   * 获取哨兵状态
   */
  getStatus() {
    const mem = this.memory.get();
    return {
      agent_id: 'ZY-SENTINEL-001',
      agent_name: '铸渊哨兵',
      status: 'active',
      scheduler_active: this.schedulerActive,
      scanning: this.monitor ? this.monitor.isScanning() : false,
      uptime_ms: Date.now() - this._startTime,
      sources: Object.entries(mem.sources).map(([id, src]) => ({
        id,
        status: src.status,
        active_host: src.active_host,
        last_check: src.last_check,
        consecutive_failures: src.consecutive_failures
      })),
      stats: mem.stats,
      last_save: mem.last_save
    };
  }

  /**
   * 注册 API 路由
   * @param {Express} app - Express 实例
   * @param {function} verifyToken - 认证中间件
   */
  registerRoutes(app, verifyToken) {
    // GET /api/sentinel/status — 哨兵状态
    app.get('/api/sentinel/status', verifyToken, (req, res) => {
      res.json(this.getStatus());
    });

    // GET /api/sentinel/memory — 永久记忆摘要
    app.get('/api/sentinel/memory', verifyToken, (req, res) => {
      res.json(this.memory.getSummary());
    });

    // GET /api/sentinel/incidents — 事件记录
    app.get('/api/sentinel/incidents', verifyToken, (req, res) => {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const mem = this.memory.get();
      res.json({
        total: mem.incidents.length,
        incidents: mem.incidents.slice(0, limit)
      });
    });

    // GET /api/sentinel/repairs — 修复记录
    app.get('/api/sentinel/repairs', verifyToken, (req, res) => {
      const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
      const mem = this.memory.get();
      res.json({
        total: mem.repairs.length,
        repairs: mem.repairs.slice(0, limit)
      });
    });

    // POST /api/sentinel/scan — 手动触发扫描
    app.post('/api/sentinel/scan', verifyToken, async (req, res) => {
      try {
        const report = await this.triggerScan();
        res.json({ status: 'ok', report });
      } catch (err) {
        res.status(500).json({ error: true, code: 'SCAN_ERROR', message: err.message });
      }
    });

    // POST /api/sentinel/config — 更新书源配置
    app.post('/api/sentinel/config', verifyToken, (req, res) => {
      const { source_id, config } = req.body || {};
      if (!source_id || !config) {
        return res.status(400).json({ error: true, code: 'MISSING_PARAMS', message: '需要 source_id 和 config' });
      }
      const ok = this.updateSourceConfig(source_id, config);
      res.json({ status: ok ? 'ok' : 'error', source_id });
    });

    console.log('[ZY-SENTINEL] 📡 API 路由已注册 (/api/sentinel/*)');
  }
}

module.exports = ZhuyuanSentinel;
