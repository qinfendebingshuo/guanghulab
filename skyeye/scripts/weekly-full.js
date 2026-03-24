#!/usr/bin/env node
/**
 * skyeye/scripts/weekly-full.js
 * 天眼周六大巡检脚本 — 完整五感闭环编排器
 * Orchestrates: ① Sense → ② Guard → ③ Audit → ④ Optimize → ⑤ Heal
 * Then generates the weekly report via weekly-scan.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SKYEYE_DIR = path.resolve(__dirname, '..');
const SCRIPTS_DIR = __dirname;
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getBeijingTime() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function runPhase(name, scriptPath) {
  const result = { phase: name, status: 'success', output: '', error: null };

  if (!fs.existsSync(scriptPath)) {
    result.status = 'skipped';
    result.error = `Script not found: ${scriptPath}`;
    return result;
  }

  // Validate scriptPath is within expected directory
  const resolvedScript = path.resolve(scriptPath);
  const resolvedScriptsDir = path.resolve(SCRIPTS_DIR);
  if (!resolvedScript.startsWith(resolvedScriptsDir)) {
    result.status = 'error';
    result.error = `Script path outside expected directory: ${scriptPath}`;
    return result;
  }

  try {
    result.output = execSync(`node "${resolvedScript}"`, {
      cwd: path.resolve(SKYEYE_DIR, '..'),
      encoding: 'utf8',
      timeout: 60000,
      env: { ...process.env }
    });
  } catch (e) {
    result.status = 'error';
    result.error = e.message;
    result.output = e.stdout || '';
  }

  return result;
}

function run() {
  const args = process.argv.slice(2);
  const skipHeal = args.includes('--skip-heal');

  console.log(`[SkyEye Weekly Full] ====================================`);
  console.log(`[SkyEye Weekly Full] 天眼周六大巡检 · 五感闭环启动`);
  console.log(`[SkyEye Weekly Full] Beijing Time: ${getBeijingTime()}`);
  console.log(`[SkyEye Weekly Full] Timestamp: ${getTimestamp()}`);
  console.log(`[SkyEye Weekly Full] ====================================`);

  const orchestrationResult = {
    run_id: `WEEKLY-FULL-${getDateStr()}`,
    timestamp: getTimestamp(),
    beijing_time: getBeijingTime(),
    phases: [],
    summary: {}
  };

  // Phase 1: Sense — Infrastructure Scan
  console.log(`\n[Phase 1] ① 感知（Sense）— 基础设施扫描`);
  const phase1 = runPhase('scan-engine', path.join(SCRIPTS_DIR, 'scan-engine.js'));
  orchestrationResult.phases.push(phase1);
  console.log(`  → ${phase1.status}`);

  // Phase 2: Guard — Guard Health Check
  console.log(`\n[Phase 2] ② 护卫（Guard）— 守卫健康检查`);
  const phase2 = runPhase('guard-health', path.join(SCRIPTS_DIR, 'guard-health.js'));
  orchestrationResult.phases.push(phase2);
  console.log(`  → ${phase2.status}`);

  // Phase 3: Audit — Quota Audit
  console.log(`\n[Phase 3] ③ 精算（Audit）— 配额审计`);
  const phase3 = runPhase('quota-audit', path.join(SCRIPTS_DIR, 'quota-audit.js'));
  orchestrationResult.phases.push(phase3);
  console.log(`  → ${phase3.status}`);

  // Phase 4: Optimize — Guard Optimization
  console.log(`\n[Phase 4] ④ 调优（Optimize）— 守卫调优`);
  const phase4 = runPhase('optimizer', path.join(SCRIPTS_DIR, 'optimizer.js'));
  orchestrationResult.phases.push(phase4);
  console.log(`  → ${phase4.status}`);

  // Phase 5: Heal — Self-Heal (skippable)
  if (!skipHeal) {
    console.log(`\n[Phase 5] ⑤ 自愈（Heal）— 自动修复`);
    const phase5 = runPhase('self-healer', path.join(SCRIPTS_DIR, 'self-healer.js'));
    orchestrationResult.phases.push(phase5);
    console.log(`  → ${phase5.status}`);
  } else {
    console.log(`\n[Phase 5] ⑤ 自愈（Heal）— 已跳过 (--skip-heal)`);
    orchestrationResult.phases.push({ phase: 'self-healer', status: 'skipped', error: '--skip-heal flag' });
  }

  // Final: Generate weekly report
  console.log(`\n[Report] 汇总报告生成`);
  const reportPhase = runPhase('weekly-scan', path.join(SCRIPTS_DIR, 'weekly-scan.js'));
  orchestrationResult.phases.push(reportPhase);
  console.log(`  → ${reportPhase.status}`);

  // Summary
  const succeeded = orchestrationResult.phases.filter(p => p.status === 'success').length;
  const failed = orchestrationResult.phases.filter(p => p.status === 'error').length;
  const skipped = orchestrationResult.phases.filter(p => p.status === 'skipped').length;

  orchestrationResult.summary = {
    total_phases: orchestrationResult.phases.length,
    succeeded,
    failed,
    skipped,
    overall: failed === 0 ? 'success' : 'partial_failure'
  };

  // Write orchestration log
  const logDir = path.join(LOGS_DIR, 'weekly');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `weekly-full-${getDateStr()}.json`);
  saveJSON(logPath, orchestrationResult);

  console.log(`\n[SkyEye Weekly Full] ====================================`);
  console.log(`[SkyEye Weekly Full] 巡检完成`);
  console.log(`[SkyEye Weekly Full] Phases: ${succeeded} success / ${failed} error / ${skipped} skipped`);
  console.log(`[SkyEye Weekly Full] Overall: ${orchestrationResult.summary.overall}`);
  console.log(`[SkyEye Weekly Full] Log: ${logPath}`);
  console.log(`[SkyEye Weekly Full] ====================================`);

  console.log('---WEEKLY_FULL_JSON---');
  console.log(JSON.stringify(orchestrationResult, null, 2));

  return orchestrationResult;
}

run();
