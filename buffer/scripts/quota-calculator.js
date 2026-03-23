/**
 * buffer/scripts/quota-calculator.js
 *
 * 配额预算计算器
 * 计算当前月度 GitHub Actions 使用量预估
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 版权: 国作登字-2026-A-00037559
 */

const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config', 'buffer-config.json');

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('[quota] buffer-config.json not found');
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
}

function calculateQuota() {
  const config = loadConfig();
  const budget = config.quota_budget;

  const daysInMonth = 30;
  const dailyRuns = budget.max_workflow_runs_per_day;
  const minutesPerRun = budget.estimated_minutes_per_run;
  const freeLimit = budget.github_free_limit_minutes;

  const dailyMinutes = dailyRuns * minutesPerRun;
  const monthlyMinutes = dailyMinutes * daysInMonth;
  const utilization = ((monthlyMinutes / freeLimit) * 100).toFixed(1);
  const remaining = freeLimit - monthlyMinutes;
  const emergencyFlushBudget = Math.floor(remaining / minutesPerRun);

  const report = {
    generated_at: new Date().toISOString(),
    summary: {
      github_free_limit: `${freeLimit} minutes/month`,
      daily_scheduled_runs: dailyRuns,
      minutes_per_run: minutesPerRun,
      daily_consumption: `${dailyMinutes} minutes`,
      monthly_consumption: `${monthlyMinutes} minutes`,
      utilization_rate: `${utilization}%`,
      remaining_budget: `${remaining} minutes`,
      emergency_flush_capacity: `${emergencyFlushBudget} extra runs available`
    },
    breakdown: {
      collect_runs_per_day: 3,
      flush_runs_per_day: 1,
      total_scheduled: `${dailyRuns} runs/day × ${daysInMonth} days = ${dailyRuns * daysInMonth} runs/month`,
      total_minutes: `${dailyRuns * daysInMonth} runs × ${minutesPerRun} min = ${monthlyMinutes} min/month`
    },
    health: utilization <= 50 ? '🟢 HEALTHY' : utilization <= 80 ? '🟡 WARNING' : '🔴 CRITICAL'
  };

  return report;
}

function main() {
  const report = calculateQuota();

  console.log('═══════════════════════════════════════');
  console.log('📊 GitHub Actions 配额预算报告');
  console.log('═══════════════════════════════════════');
  console.log(`📅 生成时间: ${report.generated_at}`);
  console.log(`📈 健康状态: ${report.health}`);
  console.log('');
  console.log('─── 概要 ───');
  for (const [key, value] of Object.entries(report.summary)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('');
  console.log('─── 明细 ───');
  for (const [key, value] of Object.entries(report.breakdown)) {
    console.log(`  ${key}: ${value}`);
  }
  console.log('═══════════════════════════════════════');

  // 输出 JSON 到标准输出（方便其他脚本读取）
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  }
}

module.exports = { calculateQuota };

if (require.main === module) {
  main();
}
