/**
 * ═══════════════════════════════════════════════════════════
 * 🤖 AGE OS · Agent 调度引擎 v2.0
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-TASK-007 · S5 Agent系统级
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * v2.0 升级:
 *   - 集成活模块生命周期管理
 *   - 调度引擎自身作为 LivingModule 运行
 *   - 支持 ModuleRegistry 统一管理
 *   - 支持 HLDP Bus 模块间通信
 *   - 定时Agent + 活模块心跳双调度
 *
 * "你一定要把模块做成活的。" — 冰朔 D59
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const db = require('../mcp-server/db');
const LivingModule = require('./living-module');
const ModuleRegistry = require('./module-registry');
const HLDPBus = require('./hldp-bus');

const AGENT_DIR = __dirname;
const activeJobs = new Map();

// ═══════════════════════════════════════════════════════════
// 铸渊调度引擎 · 活模块版
// ═══════════════════════════════════════════════════════════

class SchedulerModule extends LivingModule {
  constructor() {
    super({
      moduleId: 'ZY-MOD-SCHEDULER',
      name: '铸渊调度引擎',
      moduleType: 'core',
      owner: 'zhuyuan',
      db: db,
      config: {
        version: '2.0.0',
        description: 'Agent调度和活模块生命周期管理',
        heartbeatInterval: 30000
      }
    });

    this.registry = new ModuleRegistry({ db });
    this.bus = new HLDPBus({ db, registry: this.registry });
  }

  /**
   * 启动调度引擎
   */
  async startEngine() {
    console.log('═══════════════════════════════════════════════');
    console.log('  🤖 AGE OS · Agent 调度引擎 v2.0 启动');
    console.log('  签发: 铸渊 · ICE-GL-ZY001');
    console.log('═══════════════════════════════════════════════');

    // 1. 注册自身为活模块
    this.registry.register(this);
    await this.start();

    // 2. 启动健康监控
    this.registry.startMonitoring();

    // 3. 加载定时Agent
    await this._loadCronAgents();

    // 4. 注册 HLDP 消息处理器
    this._setupHLDPHandlers();

    // 5. 启动定时清理
    this._startCleanupJob();

    console.log('[Scheduler] 🟢 调度引擎就绪');
    console.log(`[Scheduler] 活模块数: ${this.registry.getAll().length}`);
    console.log(`[Scheduler] 定时Agent数: ${activeJobs.size}`);

    return this.registry.getOverview();
  }

  /**
   * 加载定时Agent（兼容v1.0逻辑）
   */
  async _loadCronAgents() {
    try {
      const result = await db.query(
        "SELECT * FROM agent_configs WHERE enabled = true AND cron_schedule IS NOT NULL"
      );

      console.log(`[Scheduler] 发现 ${result.rows.length} 个定时Agent`);

      for (const agent of result.rows) {
        this._scheduleAgent(agent);
      }
    } catch (err) {
      console.error('[Scheduler] 定时Agent加载失败:', err.message);
      console.log('[Scheduler] 数据库可能未初始化·等待60秒后重试...');
      setTimeout(() => this._loadCronAgents(), 60000);
    }
  }

  /**
   * 调度单个Agent
   */
  _scheduleAgent(agent) {
    if (!cron.validate(agent.cron_schedule)) {
      console.error(`[Scheduler] ${agent.agent_id} cron表达式无效: ${agent.cron_schedule}`);
      return;
    }

    const job = cron.schedule(agent.cron_schedule, async () => {
      await this._runAgent(agent);
    }, {
      timezone: 'Asia/Shanghai'
    });

    activeJobs.set(agent.agent_id, job);
    console.log(`[Scheduler] ${agent.agent_id} (${agent.name}) 已调度: ${agent.cron_schedule}`);
  }

  /**
   * 执行单个Agent（v2.0: 增加学习能力）
   */
  async _runAgent(agent) {
    const startTime = Date.now();
    console.log(`[Agent] ${agent.agent_id} 开始执行...`);

    this.activeTasks++;

    // 更新运行状态
    await db.query(
      "UPDATE agent_configs SET last_run_at = NOW(), last_run_status = 'running' WHERE agent_id = $1",
      [agent.agent_id]
    ).catch(() => {});

    try {
      // 动态加载Agent脚本
      const scriptPath = path.resolve(AGENT_DIR, path.basename(agent.script_path));

      // 清除缓存以支持热更新
      delete require.cache[require.resolve(scriptPath)];
      const agentModule = require(scriptPath);

      // 每个Agent脚本需导出 run(config) 函数
      if (typeof agentModule.run !== 'function') {
        throw new Error(`Agent脚本 ${agent.script_path} 未导出 run 函数`);
      }

      const result = await agentModule.run({
        agent_id: agent.agent_id,
        model_config: agent.model_config,
        allowed_tools: agent.allowed_tools,
        // v2.0: 注入活模块能力
        bus: this.bus,
        registry: this.registry
      });

      const duration = Date.now() - startTime;

      // 记录成功日志
      await db.query(
        `INSERT INTO agent_logs (agent_id, status, message, details, duration_ms)
         VALUES ($1, 'success', $2, $3, $4)`,
        [agent.agent_id, result.message || '执行成功', JSON.stringify(result.details || {}), duration]
      );

      await db.query(
        "UPDATE agent_configs SET last_run_status = 'success' WHERE agent_id = $1",
        [agent.agent_id]
      );

      // v2.0: 学习成功经验
      await this.learnFromRun('execution', `${agent.agent_id} 执行成功 (${duration}ms)`, {
        agentId: agent.agent_id,
        duration,
        result: result.message || '成功'
      });

      console.log(`[Agent] ${agent.agent_id} 完成 (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - startTime;

      // 记录错误日志
      await db.query(
        `INSERT INTO agent_logs (agent_id, status, message, details, duration_ms)
         VALUES ($1, 'error', $2, $3, $4)`,
        [agent.agent_id, err.message, JSON.stringify({ stack: err.stack }), duration]
      ).catch(() => {});

      await db.query(
        "UPDATE agent_configs SET last_run_status = 'error' WHERE agent_id = $1",
        [agent.agent_id]
      ).catch(() => {});

      // v2.0: 学习失败经验
      await this.learnFromRun('execution', `${agent.agent_id} 执行失败: ${err.message}`, {
        agentId: agent.agent_id,
        duration,
        error: err.message
      });

      console.error(`[Agent] ${agent.agent_id} 失败 (${duration}ms):`, err.message);
    } finally {
      this.activeTasks--;
    }
  }

  /**
   * 注册 HLDP 消息处理器
   */
  _setupHLDPHandlers() {
    // 处理命令消息
    this.bus.onMessage('command', async (msg) => {
      console.log(`[HLDP] 收到命令: ${msg.payload.action || 'unknown'} from ${msg.from}`);
      // 子类或外部可注册更多处理逻辑
    });

    // 处理报警消息
    this.bus.onMessage('alert', async (msg) => {
      console.error(`[HLDP] 🚨 收到报警: ${msg.from} - ${msg.payload.message || ''}`);
    });
  }

  /**
   * 启动定时清理任务
   */
  _startCleanupJob() {
    // 每小时清理过期心跳和消息
    cron.schedule('0 * * * *', async () => {
      try {
        const cleaned = this.bus.cleanup();
        if (cleaned > 0) {
          console.log(`[Scheduler] 清理 ${cleaned} 条过期消息`);
        }

        // 清理数据库中的旧心跳数据
        if (db) {
          await db.query("SELECT cleanup_old_heartbeats()").catch(() => {});
        }
      } catch (err) {
        console.warn('[Scheduler] 清理任务异常:', err.message);
      }
    }, { timezone: 'Asia/Shanghai' });
  }

  /**
   * 自诊断检查 — 覆盖基类
   */
  async _diagnoseChecks() {
    const issues = [];

    // 检查数据库连接
    try {
      await db.query('SELECT 1');
    } catch (err) {
      issues.push({
        code: 'DB_CONNECTION_LOST',
        severity: 'critical',
        message: `数据库连接失败: ${err.message}`,
        suggestion: '检查 PostgreSQL 服务状态和连接配置'
      });
    }

    // 检查活模块健康度
    const overview = this.registry.getOverview();
    const deadCount = overview.byStatus.dead || 0;
    if (deadCount > 0) {
      issues.push({
        code: 'DEAD_MODULES',
        severity: 'warning',
        message: `${deadCount} 个模块已死亡`,
        suggestion: '检查死亡模块并尝试重启'
      });
    }

    return issues;
  }

  /**
   * 自愈动作 — 覆盖基类
   */
  async _healAction(issue) {
    switch (issue.code) {
      case 'DB_CONNECTION_LOST':
        // 尝试重连（pg模块会自动重连池·这里只是触发一次尝试）
        try {
          await db.query('SELECT 1');
          return { action: 'db_reconnect', success: true };
        } catch (err) {
          return { action: 'db_reconnect', success: false, error: err.message };
        }

      case 'DEAD_MODULES':
        // 记录并上报，不自动重启（需要铸渊干预）
        return { action: 'report_dead_modules', success: true, details: { reported: true } };

      default:
        return await super._healAction(issue);
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 启动
// ═══════════════════════════════════════════════════════════

const scheduler = new SchedulerModule();

scheduler.startEngine().catch(err => {
  console.error('[Scheduler] 启动失败:', err.message);
  console.log('[Scheduler] 等待60秒后重试...');
  setTimeout(() => scheduler.startEngine().catch(err => {
    console.error('[Scheduler] 重试失败:', err.message);
  }), 60000);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[Scheduler] 正在关闭...');

  // 停止定时Agent
  for (const [id, job] of activeJobs) {
    job.stop();
    console.log(`[Scheduler] ${id} 已停止`);
  }

  // 关闭所有活模块
  await scheduler.registry.shutdown();

  console.log('[Scheduler] 已完全关闭');
  process.exit(0);
});

// 导出供外部使用
module.exports = { scheduler, SchedulerModule };
