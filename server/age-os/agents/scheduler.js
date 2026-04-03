/**
 * ═══════════════════════════════════════════════════════════
 * 🤖 AGE OS · Agent 调度引擎
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 从 agent_configs 表读取配置，用 node-cron 调度定时任务。
 * 每个Agent是一个独立的JS脚本，调度器负责按时触发并记录日志。
 */

'use strict';

const cron = require('node-cron');
const path = require('path');
const db = require('../mcp-server/db');

const AGENT_DIR = __dirname;
const activeJobs = new Map();

/**
 * 加载并启动所有启用的定时Agent
 */
async function startScheduler() {
  console.log('[Scheduler] AGE OS Agent 调度引擎启动...');

  try {
    const result = await db.query(
      "SELECT * FROM agent_configs WHERE enabled = true AND cron_schedule IS NOT NULL"
    );

    console.log(`[Scheduler] 发现 ${result.rows.length} 个定时Agent`);

    for (const agent of result.rows) {
      scheduleAgent(agent);
    }

    console.log('[Scheduler] 所有Agent已调度');
  } catch (err) {
    console.error('[Scheduler] 启动失败:', err.message);
    console.log('[Scheduler] 数据库可能未初始化，等待60秒后重试...');
    setTimeout(startScheduler, 60000);
  }
}

/**
 * 调度单个Agent
 */
function scheduleAgent(agent) {
  if (!cron.validate(agent.cron_schedule)) {
    console.error(`[Scheduler] ${agent.agent_id} cron表达式无效: ${agent.cron_schedule}`);
    return;
  }

  const job = cron.schedule(agent.cron_schedule, async () => {
    await runAgent(agent);
  }, {
    timezone: 'Asia/Shanghai'
  });

  activeJobs.set(agent.agent_id, job);
  console.log(`[Scheduler] ${agent.agent_id} (${agent.name}) 已调度: ${agent.cron_schedule}`);
}

/**
 * 执行单个Agent
 */
async function runAgent(agent) {
  const startTime = Date.now();
  console.log(`[Agent] ${agent.agent_id} 开始执行...`);

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
      allowed_tools: agent.allowed_tools
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

    console.error(`[Agent] ${agent.agent_id} 失败 (${duration}ms):`, err.message);
  }
}

// ─── 启动 ───
startScheduler();

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Scheduler] 停止所有Agent...');
  for (const [id, job] of activeJobs) {
    job.stop();
    console.log(`[Scheduler] ${id} 已停止`);
  }
  process.exit(0);
});
