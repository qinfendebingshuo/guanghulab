#!/usr/bin/env node
/**
 * skyeye/hibernation/sleep-scheduler.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 🧠 动态休眠决策引擎
 * 根据当日/本周运行数据，动态计算休眠时长
 *
 * 用法:
 *   node sleep-scheduler.js --mode=daily   → 计算日休眠时长
 *   node sleep-scheduler.js --mode=weekly  → 计算周休眠时长
 *
 * 输出: JSON 格式的休眠决策结果到 stdout
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT         = path.resolve(__dirname, '../..');
const SKYEYE_DIR   = path.resolve(__dirname, '..');
const GUARDS_DIR   = path.join(SKYEYE_DIR, 'guards');
const LOGS_DIR     = path.join(SKYEYE_DIR, 'logs');
const BUFFER_DIR   = path.join(ROOT, 'buffer');
const CP_DIR       = path.join(__dirname, 'checkpoints');

// ━━━ 工具函数 ━━━

function getTimestamp() {
  return new Date().toISOString();
}

function getBeijingTime() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function countFiles(dir, filter) {
  try {
    if (!fs.existsSync(dir)) return 0;
    const files = fs.readdirSync(dir);
    return filter ? files.filter(filter).length : files.length;
  } catch (e) {
    return 0;
  }
}

// ━━━ 日休眠评估因子 ━━━

const DAILY_EVALUATION_FACTORS = {
  base_minutes: 5,

  factors: [
    {
      name: 'workflow_load',
      description: '今日 workflow 触发总次数',
      weight: {
        low: 0,       // < 50 次
        medium: 2,    // 50-200 次
        high: 5,      // 200-500 次
        extreme: 8    // > 500 次
      }
    },
    {
      name: 'guard_self_heal_count',
      description: '今日 Guard 自愈触发次数',
      weight: {
        zero: 0,
        low: 2,       // 1-3 次
        high: 5,      // 4-10 次
        critical: 10  // > 10 次
      }
    },
    {
      name: 'error_count',
      description: '今日异常/错误计数',
      weight: {
        zero: 0,
        low: 1,       // 1-5 个
        medium: 3,    // 6-15 个
        high: 8       // > 15 个
      }
    },
    {
      name: 'buffer_backlog',
      description: 'buffer 堆积量',
      weight: {
        empty: 0,
        normal: 1,    // < 100 条
        heavy: 3,     // 100-500 条
        overflow: 5   // > 500 条
      }
    },
    {
      name: 'quota_burn_rate',
      description: '今日配额消耗速度 vs 日均值',
      weight: {
        normal: 0,
        elevated: 2,  // 高于均值 30%
        dangerous: 5  // 高于均值 60%
      }
    },
    {
      name: 'checkin_anomaly',
      description: '小兵签到异常数',
      weight: {
        zero: 0,
        few: 1,       // 1-2 个
        many: 3       // > 2 个
      }
    }
  ],

  max_minutes: 30,

  calculate: function (evaluatedFactors) {
    let total = DAILY_EVALUATION_FACTORS.base_minutes;
    for (const factor of evaluatedFactors) {
      total += factor.computed_weight;
    }
    return Math.min(total, DAILY_EVALUATION_FACTORS.max_minutes);
  }
};

// ━━━ 周休眠评估因子 ━━━

const WEEKLY_EVALUATION_FACTORS = {
  base_hours: 2,

  factors: [
    {
      name: 'weekly_health_trend',
      description: '本周 6 个 daily-checkpoint 的健康趋势',
      weight: {
        stable: 0,
        declining: 0.5,
        volatile: 1
      }
    },
    {
      name: 'optimization_requests',
      description: '本周自优化申请数量',
      weight: {
        few: 0,
        moderate: 0.5,
        many: 1
      }
    },
    {
      name: 'self_heal_total',
      description: '本周累计自愈次数',
      weight: {
        low: 0,
        medium: 0.5,
        high: 1
      }
    },
    {
      name: 'structural_changes',
      description: '本周是否有新应用接入/架构变更',
      weight: {
        none: 0,
        minor: 0.5,
        major: 1.5
      }
    },
    {
      name: 'upgrade_distribution_scope',
      description: '需要分发升级的小兵数量',
      weight: {
        few: 0,
        moderate: 0.5,
        many: 1
      }
    },
    {
      name: 'notion_sync_volume',
      description: 'Notion 端需要同步的变更量',
      weight: {
        light: 0,
        moderate: 0.5,
        heavy: 1
      }
    }
  ],

  max_hours: 8,

  calculate: function (evaluatedFactors) {
    let total = WEEKLY_EVALUATION_FACTORS.base_hours;
    for (const factor of evaluatedFactors) {
      total += factor.computed_weight;
    }
    return Math.min(total, WEEKLY_EVALUATION_FACTORS.max_hours);
  }
};

// ━━━ 数据采集 ━━━

function collectDailyData() {
  const data = {
    workflow_triggers: 0,
    guard_self_heals: 0,
    error_count: 0,
    buffer_backlog: 0,
    quota_burn_rate: 'normal',
    checkin_anomalies: 0
  };

  // 1. 读取今日日志目录统计 workflow 触发
  const dailyLogDir = path.join(LOGS_DIR, 'daily');
  if (fs.existsSync(dailyLogDir)) {
    const files = fs.readdirSync(dailyLogDir).filter(f => f.endsWith('.json'));
    data.workflow_triggers = files.length * 10; // 估算：每个日志文件约代表 10 次触发
  }

  // 2. 读取 Guard 配置统计自愈次数
  if (fs.existsSync(GUARDS_DIR)) {
    const guardFiles = fs.readdirSync(GUARDS_DIR)
      .filter(f => f.endsWith('.json') && f !== 'guard-template.json');
    for (const file of guardFiles) {
      const guard = loadJSON(path.join(GUARDS_DIR, file));
      if (guard && guard.health_check) {
        data.guard_self_heals += (guard.health_check.consecutive_failures || 0);
      }
    }
  }

  // 3. 统计 buffer 堆积量
  const inboxDir = path.join(BUFFER_DIR, 'inbox');
  if (fs.existsSync(inboxDir)) {
    try {
      const devDirs = fs.readdirSync(inboxDir).filter(d => {
        return fs.statSync(path.join(inboxDir, d)).isDirectory();
      });
      for (const dev of devDirs) {
        data.buffer_backlog += countFiles(path.join(inboxDir, dev), f => f.endsWith('.json'));
      }
    } catch (e) {
      // ignore
    }
  }

  // 4. 读取配额 ledger 判断消耗速度
  const ledger = loadJSON(path.join(SKYEYE_DIR, 'quota-ledger.json'));
  if (ledger && ledger.services) {
    const actions = ledger.services.github_actions;
    if (actions) {
      const usedPct = actions.monthly_limit > 0
        ? (actions.current_used || 0) / actions.monthly_limit * 100
        : 0;
      if (usedPct > 60) data.quota_burn_rate = 'dangerous';
      else if (usedPct > 30) data.quota_burn_rate = 'elevated';
    }
  }

  return data;
}

function evaluateDailyFactors(data) {
  const results = [];

  // workflow_load
  let wl = 0;
  if (data.workflow_triggers > 500) wl = 8;
  else if (data.workflow_triggers > 200) wl = 5;
  else if (data.workflow_triggers >= 50) wl = 2;
  results.push({ name: 'workflow_load', value: data.workflow_triggers, level: wl > 5 ? 'extreme' : wl > 2 ? 'high' : wl > 0 ? 'medium' : 'low', computed_weight: wl });

  // guard_self_heal_count
  let gh = 0;
  if (data.guard_self_heals > 10) gh = 10;
  else if (data.guard_self_heals >= 4) gh = 5;
  else if (data.guard_self_heals >= 1) gh = 2;
  results.push({ name: 'guard_self_heal_count', value: data.guard_self_heals, level: gh > 5 ? 'critical' : gh > 2 ? 'high' : gh > 0 ? 'low' : 'zero', computed_weight: gh });

  // error_count
  let ec = 0;
  if (data.error_count > 15) ec = 8;
  else if (data.error_count >= 6) ec = 3;
  else if (data.error_count >= 1) ec = 1;
  results.push({ name: 'error_count', value: data.error_count, level: ec > 3 ? 'high' : ec > 1 ? 'medium' : ec > 0 ? 'low' : 'zero', computed_weight: ec });

  // buffer_backlog
  let bb = 0;
  if (data.buffer_backlog > 500) bb = 5;
  else if (data.buffer_backlog >= 100) bb = 3;
  else if (data.buffer_backlog > 0) bb = 1;
  results.push({ name: 'buffer_backlog', value: data.buffer_backlog, level: bb > 3 ? 'overflow' : bb > 1 ? 'heavy' : bb > 0 ? 'normal' : 'empty', computed_weight: bb });

  // quota_burn_rate
  let qb = 0;
  if (data.quota_burn_rate === 'dangerous') qb = 5;
  else if (data.quota_burn_rate === 'elevated') qb = 2;
  results.push({ name: 'quota_burn_rate', value: data.quota_burn_rate, level: data.quota_burn_rate, computed_weight: qb });

  // checkin_anomaly
  let ca = 0;
  if (data.checkin_anomalies > 2) ca = 3;
  else if (data.checkin_anomalies >= 1) ca = 1;
  results.push({ name: 'checkin_anomaly', value: data.checkin_anomalies, level: ca > 1 ? 'many' : ca > 0 ? 'few' : 'zero', computed_weight: ca });

  return results;
}

function collectWeeklyData() {
  const data = {
    health_trend: 'stable',
    optimization_requests: 0,
    self_heal_total: 0,
    structural_changes: 'none',
    upgrade_targets: 0,
    notion_sync_volume: 'light'
  };

  // 读取本周 checkpoint
  if (fs.existsSync(CP_DIR)) {
    const cpFiles = fs.readdirSync(CP_DIR)
      .filter(f => f.startsWith('daily-cp-') && f.endsWith('.json'))
      .sort()
      .slice(-6);

    let totalHeals = 0;
    for (const file of cpFiles) {
      const cp = loadJSON(path.join(CP_DIR, file));
      if (cp && cp.health_summary) {
        const guards = cp.health_summary.guards || {};
        for (const g of Object.values(guards)) {
          totalHeals += (g.self_heals_today || 0);
        }
      }
    }
    data.self_heal_total = totalHeals;
  }

  // 统计子仓库数量（upgrade targets）
  const spokeDir = path.join(ROOT, 'spoke-deployments');
  if (fs.existsSync(spokeDir)) {
    try {
      data.upgrade_targets = fs.readdirSync(spokeDir)
        .filter(d => fs.statSync(path.join(spokeDir, d)).isDirectory()).length;
    } catch (e) {
      // ignore
    }
  }

  // 读取 ASOP 请求（optimization_requests）
  const asopDir = path.join(ROOT, 'data', 'asop-requests');
  if (fs.existsSync(asopDir)) {
    data.optimization_requests = countFiles(asopDir, f => f.endsWith('.json'));
  }

  return data;
}

function evaluateWeeklyFactors(data) {
  const results = [];

  // weekly_health_trend
  let ht = 0;
  if (data.health_trend === 'volatile') ht = 1;
  else if (data.health_trend === 'declining') ht = 0.5;
  results.push({ name: 'weekly_health_trend', value: data.health_trend, computed_weight: ht });

  // optimization_requests
  let or_ = 0;
  if (data.optimization_requests > 10) or_ = 1;
  else if (data.optimization_requests >= 4) or_ = 0.5;
  results.push({ name: 'optimization_requests', value: data.optimization_requests, computed_weight: or_ });

  // self_heal_total
  let sh = 0;
  if (data.self_heal_total > 30) sh = 1;
  else if (data.self_heal_total >= 10) sh = 0.5;
  results.push({ name: 'self_heal_total', value: data.self_heal_total, computed_weight: sh });

  // structural_changes
  let sc = 0;
  if (data.structural_changes === 'major') sc = 1.5;
  else if (data.structural_changes === 'minor') sc = 0.5;
  results.push({ name: 'structural_changes', value: data.structural_changes, computed_weight: sc });

  // upgrade_distribution_scope
  let ud = 0;
  if (data.upgrade_targets > 15) ud = 1;
  else if (data.upgrade_targets >= 5) ud = 0.5;
  results.push({ name: 'upgrade_distribution_scope', value: data.upgrade_targets, computed_weight: ud });

  // notion_sync_volume
  let ns = 0;
  if (data.notion_sync_volume === 'heavy') ns = 1;
  else if (data.notion_sync_volume === 'moderate') ns = 0.5;
  results.push({ name: 'notion_sync_volume', value: data.notion_sync_volume, computed_weight: ns });

  return results;
}

// ━━━ 主流程 ━━━

function run() {
  const args = process.argv.slice(2);
  const modeArg = args.find(a => a.startsWith('--mode='));
  const mode = modeArg ? modeArg.split('=')[1] : 'daily';

  console.log(`[SkyEye Sleep Scheduler] Mode: ${mode}`);
  console.log(`[SkyEye Sleep Scheduler] Timestamp: ${getTimestamp()}`);
  console.log(`[SkyEye Sleep Scheduler] Beijing Time: ${getBeijingTime()}`);

  let result;

  if (mode === 'weekly') {
    const data = collectWeeklyData();
    const factors = evaluateWeeklyFactors(data);
    const totalHours = WEEKLY_EVALUATION_FACTORS.calculate(factors);
    const totalMinutes = Math.round(totalHours * 60);

    result = {
      scheduler_id: `SLEEP-WEEKLY-${getDateStr()}`,
      mode: 'weekly',
      timestamp: getTimestamp(),
      beijing_time: getBeijingTime(),
      raw_data: data,
      evaluated_factors: factors,
      decision: {
        base_hours: WEEKLY_EVALUATION_FACTORS.base_hours,
        additional_hours: totalHours - WEEKLY_EVALUATION_FACTORS.base_hours,
        total_hours: totalHours,
        total_minutes: totalMinutes,
        max_hours: WEEKLY_EVALUATION_FACTORS.max_hours,
        human_readable: `约 ${Math.floor(totalHours)} 小时 ${totalMinutes % 60} 分钟`
      }
    };

    console.log(`[SkyEye Sleep Scheduler] Weekly hibernation decision: ${result.decision.human_readable}`);
  } else {
    const data = collectDailyData();
    const factors = evaluateDailyFactors(data);
    const totalMinutes = DAILY_EVALUATION_FACTORS.calculate(factors);

    result = {
      scheduler_id: `SLEEP-DAILY-${getDateStr()}`,
      mode: 'daily',
      timestamp: getTimestamp(),
      beijing_time: getBeijingTime(),
      raw_data: data,
      evaluated_factors: factors,
      decision: {
        base_minutes: DAILY_EVALUATION_FACTORS.base_minutes,
        additional_minutes: totalMinutes - DAILY_EVALUATION_FACTORS.base_minutes,
        total_minutes: totalMinutes,
        max_minutes: DAILY_EVALUATION_FACTORS.max_minutes,
        human_readable: `约 ${totalMinutes} 分钟`
      }
    };

    console.log(`[SkyEye Sleep Scheduler] Daily hibernation decision: ${result.decision.human_readable}`);
  }

  // 输出结果到 stdout 供下游脚本读取
  const outputPath = path.join(__dirname, `sleep-decision-${mode}-${getDateStr()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + '\n', 'utf8');
  console.log(`[SkyEye Sleep Scheduler] Decision written to: ${outputPath}`);

  // 也输出到 stdout 方便 workflow 捕获
  console.log('::set-output name=sleep_minutes::' + (result.decision.total_minutes || 0));
  console.log('::set-output name=sleep_decision::' + JSON.stringify(result.decision));

  return result;
}

// ━━━ 导出供其他模块使用 ━━━
module.exports = {
  DAILY_EVALUATION_FACTORS,
  WEEKLY_EVALUATION_FACTORS,
  collectDailyData,
  evaluateDailyFactors,
  collectWeeklyData,
  evaluateWeeklyFactors,
  run
};

if (require.main === module) {
  run();
}
