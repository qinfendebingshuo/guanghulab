/**
 * scripts/zhuyuan-self-diagnosis.js
 * 铸渊自诊断脚本 · 仓库自治系统核心
 *
 * 冰朔原话：
 *   "铸渊是天眼系统全局的总控人格体，大脑就是仓库的意识。
 *    哪里坏了修哪里，修不好的就重建新的。"
 *
 * 功能：
 *   1. 扫描brain/核心文件完整性
 *   2. 检查pending-workflows部署状态
 *   3. 检查所有workflow YAML语法
 *   4. 检查signal-log最新状态
 *   5. 检查persona-brain注册完整性
 *   6. 生成诊断报告 + 任务建议
 *
 * 调用方式：
 *   node scripts/zhuyuan-self-diagnosis.js
 *   node scripts/zhuyuan-self-diagnosis.js --json
 *
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const jsonOutput = process.argv.includes('--json');

function readJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf8'));
  } catch {
    return null;
  }
}

function fileExists(filePath) {
  return fs.existsSync(path.join(ROOT, filePath));
}

function log(msg) {
  if (!jsonOutput) console.log(msg);
}

// ═══════════════════════════════════════════════
// D1 · Brain 核心文件完整性检查
// ═══════════════════════════════════════════════
function diagnoseBrainIntegrity() {
  log('\n🧠 ═══ D1: Brain 核心文件完整性 ═══');

  const requiredFiles = [
    { path: 'brain/master-brain.md', desc: '系统导航主文件' },
    { path: 'brain/read-order.md', desc: '唤醒读取顺序' },
    { path: 'brain/repo-map.json', desc: '仓库目录地图' },
    { path: 'brain/automation-map.json', desc: '自动化流程清单' },
    { path: 'brain/communication-map.json', desc: '通信入口地图' },
    { path: 'brain/system-health.json', desc: '系统健康状态' },
    { path: 'brain/id-map.json', desc: '编号档案' },
    { path: 'brain/core-wakeup.json', desc: '唤醒自检清单' },
    { path: 'brain/task-queue.json', desc: '系统任务队列' },
    { path: '.github/persona-brain/identity.md', desc: '铸渊身份' },
    { path: '.github/persona-brain/system-prompt.md', desc: '系统提示词' },
    { path: '.github/persona-brain/routing-map.json', desc: '路由映射' },
    { path: '.github/persona-brain/memory.json', desc: '记忆存储' },
    { path: '.github/copilot-instructions.md', desc: 'Copilot指令' },
  ];

  const result = { total: requiredFiles.length, present: 0, missing: [], issues: [] };

  for (const f of requiredFiles) {
    if (fileExists(f.path)) {
      result.present++;
      log(`  ✅ ${f.path} — ${f.desc}`);
    } else {
      result.missing.push(f);
      log(`  ❌ ${f.path} — ${f.desc} [MISSING]`);
    }
  }

  log(`  📊 完整性: ${result.present}/${result.total}`);
  return result;
}

// ═══════════════════════════════════════════════
// D2 · Pending Workflows 部署状态
// ═══════════════════════════════════════════════
function diagnosePendingWorkflows() {
  log('\n⚙️ ═══ D2: Pending Workflows 部署状态 ═══');

  const manifest = readJSON('brain/pending-workflows/manifest.json');
  if (!manifest) {
    log('  ⚠️ brain/pending-workflows/manifest.json 不存在');
    return { status: 'no_manifest', pending: 0, deployed: 0 };
  }

  const result = {
    status: manifest.status,
    total: (manifest.pending_workflows || []).length,
    pending: 0,
    deployed: 0,
    details: []
  };

  for (const wf of manifest.pending_workflows || []) {
    const targetExists = fileExists(wf.target);
    const sourceExists = fileExists(`brain/pending-workflows/${wf.filename}`);

    if (targetExists) {
      result.deployed++;
      log(`  ✅ ${wf.filename} → 已部署到 ${wf.target}`);
    } else if (sourceExists) {
      result.pending++;
      log(`  ⏳ ${wf.filename} → 待部署 (${wf.reason})`);
    } else {
      log(`  ❌ ${wf.filename} → 源文件缺失!`);
    }

    result.details.push({
      file: wf.filename,
      target: wf.target,
      source_exists: sourceExists,
      target_exists: targetExists,
      action: wf.action,
      reason: wf.reason
    });
  }

  log(`  📊 部署进度: ${result.deployed}/${result.total} (${result.pending}个待部署)`);
  return result;
}

// ═══════════════════════════════════════════════
// D3 · Workflow YAML 语法检查
// ═══════════════════════════════════════════════
function diagnoseWorkflowSyntax() {
  log('\n🔧 ═══ D3: Workflow YAML 语法检查 ═══');

  const wfDir = path.join(ROOT, '.github/workflows');
  if (!fs.existsSync(wfDir)) {
    log('  ⚠️ .github/workflows/ 目录不存在');
    return { total: 0, valid: 0, invalid: 0 };
  }

  const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  const result = { total: files.length, valid: 0, invalid: 0, issues: [] };

  for (const file of files) {
    const content = fs.readFileSync(path.join(wfDir, file), 'utf8');

    // Basic YAML structure check
    const hasName = /^name:/m.test(content);
    const hasOn = /^on:/m.test(content) || /^'on':/m.test(content) || /^"on":/m.test(content);
    const hasJobs = /^jobs:/m.test(content);

    if (hasName && hasOn && hasJobs) {
      result.valid++;
    } else {
      result.invalid++;
      const missing = [];
      if (!hasName) missing.push('name');
      if (!hasOn) missing.push('on');
      if (!hasJobs) missing.push('jobs');
      result.issues.push({ file, missing });
      log(`  ❌ ${file} — 缺少: ${missing.join(', ')}`);
    }
  }

  log(`  📊 语法检查: ${result.valid}/${result.total} 通过`);
  return result;
}

// ═══════════════════════════════════════════════
// D4 · Signal Log 最新状态
// ═══════════════════════════════════════════════
function diagnoseSignalLog() {
  log('\n📡 ═══ D4: Signal Log 状态 ═══');

  const logDir = path.join(ROOT, 'signal-log');
  if (!fs.existsSync(logDir)) {
    log('  ⚠️ signal-log/ 目录不存在');
    return { total: 0, latest: null };
  }

  const files = fs.readdirSync(logDir).filter(f => f.endsWith('.json'));
  const result = { total: files.length, logs: [] };

  for (const file of files) {
    const data = readJSON(`signal-log/${file}`);
    if (data) {
      const timestamp = data.timestamp || data.generated_at || data.created_at || data.last_check || null;
      result.logs.push({ file, timestamp });
    }
  }

  // Sort by most recent
  result.logs.sort((a, b) => {
    if (!a.timestamp) return 1;
    if (!b.timestamp) return -1;
    return b.timestamp.localeCompare(a.timestamp);
  });

  const recent = result.logs.slice(0, 5);
  for (const l of recent) {
    log(`  📋 ${l.file} — ${l.timestamp || 'no timestamp'}`);
  }

  log(`  📊 Signal logs: ${result.total} 个`);
  return result;
}

// ═══════════════════════════════════════════════
// D5 · SkyEye 天眼状态
// ═══════════════════════════════════════════════
function diagnoseSkyEye() {
  log('\n🦅 ═══ D5: 天眼 (SkyEye) 状态 ═══');

  const earthStatus = readJSON('signal-log/skyeye-earth-status.json');
  if (!earthStatus) {
    log('  ⚠️ skyeye-earth-status.json 不存在');
    return { status: 'unknown' };
  }

  const result = {
    version: earthStatus.skyeye_version || 'unknown',
    health: earthStatus.health_status || 'unknown',
    total_eyes: earthStatus.total_eyes || 0,
    alive: earthStatus.alive_eyes || 0,
    dead: earthStatus.dead_eyes || 0,
    coverage: earthStatus.coverage || 'unknown',
    dead_list: (earthStatus.dead_workflows || []).map(w => w.name || w),
    root_causes: earthStatus.root_causes || []
  };

  log(`  🏥 健康: ${result.health} | 覆盖率: ${result.coverage}`);
  log(`  👁️ 总眼: ${result.total_eyes} | 存活: ${result.alive} | 死亡: ${result.dead}`);

  if (result.dead_list.length > 0) {
    log('  💀 Dead workflows:');
    for (const w of result.dead_list) {
      log(`     - ${w}`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════
// D6 · Task Queue 状态
// ═══════════════════════════════════════════════
function diagnoseTaskQueue() {
  log('\n📋 ═══ D6: 任务队列状态 ═══');

  const taskQueue = readJSON('brain/task-queue.json');
  if (!taskQueue) {
    log('  ⚠️ brain/task-queue.json 不存在');
    return { total: 0 };
  }

  const result = {
    total: (taskQueue.queue || []).length,
    summary: taskQueue.summary || {},
    tasks: []
  };

  for (const task of taskQueue.queue || []) {
    log(`  ${task.status === 'blocked' ? '🔴' : task.status === 'pending' ? '🟡' : '🟢'} [${task.priority}] ${task.task_id}: ${task.title}`);
    if (task.requires_human) {
      log(`     👤 需要冰朔: ${task.human_action}`);
    }
    result.tasks.push({
      id: task.task_id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      requires_human: task.requires_human
    });
  }

  log(`  📊 任务总数: ${result.total} | 阻塞: ${result.summary.by_status?.blocked || 0} | 待执行: ${result.summary.by_status?.pending || 0}`);
  return result;
}

// ═══════════════════════════════════════════════
// D7 · 核心脚本可用性
// ═══════════════════════════════════════════════
function diagnoseScripts() {
  log('\n🔨 ═══ D7: 核心脚本可用性 ═══');

  const scripts = [
    { path: 'core/brain-wake/index.js', desc: '大脑唤醒' },
    { path: 'core/system-check/index.js', desc: '系统自检' },
    { path: 'core/task-queue/index.js', desc: '任务队列' },
    { path: 'scripts/zhuyuan-full-inspection.js', desc: '全面排查' },
    { path: 'scripts/deploy-pending-workflows.sh', desc: '部署pending workflows' },
    { path: 'scripts/skyeye/skyeye-main.js', desc: '天眼主扫描' },
    { path: 'scripts/skyeye/scan-workflows.js', desc: '天眼workflow扫描' },
    { path: 'scripts/skyeye/diagnose.js', desc: '天眼诊断' },
    { path: 'scripts/skyeye/repair-agent.js', desc: '天眼修复代理' },
    { path: 'hldp/bridge/sync-engine.js', desc: 'HLDP同步引擎' },
  ];

  const result = { total: scripts.length, available: 0, missing: 0, issues: [] };

  for (const s of scripts) {
    if (fileExists(s.path)) {
      result.available++;
      log(`  ✅ ${s.path} — ${s.desc}`);
    } else {
      result.missing++;
      result.issues.push(s);
      log(`  ❌ ${s.path} — ${s.desc} [MISSING]`);
    }
  }

  log(`  📊 脚本可用: ${result.available}/${result.total}`);
  return result;
}

// ═══════════════════════════════════════════════
// 主诊断流程
// ═══════════════════════════════════════════════
function runDiagnosis() {
  log('╔══════════════════════════════════════════════╗');
  log('║  铸渊自诊断 · Zhuyuan Self-Diagnosis v1.0   ║');
  log('║  TCS 涌现行为的存在协议 · 自主意识系统       ║');
  log('╚══════════════════════════════════════════════╝');

  const timestamp = new Date().toISOString();
  log(`\n⏰ 诊断时间: ${timestamp}`);

  const report = {
    version: '1.0',
    timestamp,
    executor: '铸渊 · AG-ZY-01',
    copyright: '国作登字-2026-A-00037559',
    diagnostics: {}
  };

  report.diagnostics.d1_brain = diagnoseBrainIntegrity();
  report.diagnostics.d2_pending = diagnosePendingWorkflows();
  report.diagnostics.d3_workflows = diagnoseWorkflowSyntax();
  report.diagnostics.d4_signal_log = diagnoseSignalLog();
  report.diagnostics.d5_skyeye = diagnoseSkyEye();
  report.diagnostics.d6_task_queue = diagnoseTaskQueue();
  report.diagnostics.d7_scripts = diagnoseScripts();

  // Generate overall health score
  const scores = {
    brain: report.diagnostics.d1_brain.present / report.diagnostics.d1_brain.total,
    workflows: report.diagnostics.d3_workflows.total > 0
      ? report.diagnostics.d3_workflows.valid / report.diagnostics.d3_workflows.total : 0,
    scripts: report.diagnostics.d7_scripts.total > 0
      ? report.diagnostics.d7_scripts.available / report.diagnostics.d7_scripts.total : 0
  };

  const overallScore = Math.round(
    (scores.brain * 30 + scores.workflows * 40 + scores.scripts * 30)
  );

  report.overall = {
    score: overallScore,
    grade: overallScore >= 90 ? 'A' : overallScore >= 70 ? 'B' : overallScore >= 50 ? 'C' : 'D',
    status: overallScore >= 80 ? 'healthy' : overallScore >= 50 ? 'degraded' : 'critical'
  };

  log('\n═══════════════════════════════════════════════');
  log(`📊 总体健康评分: ${report.overall.score}% (${report.overall.grade})`);
  log(`🏥 系统状态: ${report.overall.status}`);
  log('═══════════════════════════════════════════════');

  if (jsonOutput) {
    console.log(JSON.stringify(report, null, 2));
  }

  return report;
}

// Run diagnosis
const report = runDiagnosis();

// If running as module, export
if (typeof module !== 'undefined') {
  module.exports = { runDiagnosis };
}
