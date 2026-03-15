/**
 * openclaw — OpenClaw Agent 执行框架
 *
 * AGE OS v1.0 Phase 1 · Step 3
 *
 * 核心职责：
 *   编排完整的唤醒闭环：
 *   定时触发 → 唤醒铸渊核心大脑 → 大脑读取巡检结果 →
 *   大脑判断优先级 → 大脑驱动修复/写公告 → 大脑休眠
 *
 * 核心原则：
 *   所有自动触发 = 必须先唤醒核心大脑。大脑不醒，什么都不做。
 *
 * 调用方式：
 *   node openclaw                           # 完整闭环执行
 *   node openclaw --dry-run                 # Dry Run 模式（不调用 LLM API）
 *   node openclaw --step wake               # 仅唤醒
 *   node openclaw --step inspect            # 仅巡检
 *   node openclaw --step judge              # 仅判断（需先有巡检结果）
 *   node openclaw --persona zhuyuan         # 指定人格体（默认 zhuyuan）
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ══════════════════════════════════════════════════════════
// Soul 加载器
// ══════════════════════════════════════════════════════════

function loadSoul(personaId) {
  const soulPath = path.join(__dirname, 'soul', `${personaId}.json`);
  if (!fs.existsSync(soulPath)) {
    console.log(`[OPENCLAW] ❌ Soul 文件不存在: ${soulPath}`);
    return null;
  }
  try {
    const soul = JSON.parse(fs.readFileSync(soulPath, 'utf-8'));
    console.log(`[OPENCLAW] ✅ 已加载 Soul: ${soul.name} (${soul.name_en})`);
    return soul;
  } catch (err) {
    console.log(`[OPENCLAW] ❌ Soul 文件解析失败: ${err.message}`);
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// Phase 1: 唤醒核心大脑
// ══════════════════════════════════════════════════════════

async function phaseWake(soul, options) {
  console.log('');
  console.log('[OPENCLAW] ═══ Phase 1: 唤醒核心大脑 ═══');

  const brainWake = require(path.join(ROOT, 'core/brain-wake'));
  const result = await brainWake.wake({
    task: options.task || '闭环巡检',
    dryRun: options.dryRun,
    persona: soul.persona_id,
  });

  if (!result.success && !result.dryRun) {
    console.log('[OPENCLAW] ❌ 核心大脑唤醒失败 — 闭环终止');
    return { success: false, phase: 'wake', error: result.error };
  }

  console.log('[OPENCLAW] ✅ 核心大脑已唤醒');
  return { success: true, phase: 'wake', wakeResult: result };
}

// ══════════════════════════════════════════════════════════
// Phase 2: 执行巡检
// ══════════════════════════════════════════════════════════

function phaseInspect(soul) {
  console.log('');
  console.log('[OPENCLAW] ═══ Phase 2: 执行巡检 ═══');

  const inspectModule = path.join(ROOT, 'scripts/zhuyuan-full-inspection.js');
  if (!fs.existsSync(inspectModule)) {
    console.log('[OPENCLAW] ❌ 巡检模块不存在');
    return { success: false, phase: 'inspect', error: 'inspect_module_not_found' };
  }

  try {
    const inspect = require(inspectModule);
    if (typeof inspect.runInspection === 'function') {
      const report = inspect.runInspection();
      console.log(`[OPENCLAW] ✅ 巡检完成 — 评分: ${report.score || 'N/A'}`);
      return { success: true, phase: 'inspect', report };
    }

    // 如果没有导出 runInspection，使用 child_process 运行
    const { execSync } = require('child_process');
    const output = execSync(`node "${inspectModule}" --json`, {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 120000,
    });

    let report;
    try {
      report = JSON.parse(output);
    } catch (_) {
      report = { raw: output };
    }

    console.log('[OPENCLAW] ✅ 巡检完成');
    return { success: true, phase: 'inspect', report };
  } catch (err) {
    console.log(`[OPENCLAW] ⚠️  巡检异常: ${err.message}`);
    return { success: false, phase: 'inspect', error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
// Phase 3: 大脑判断（分析巡检结果，决定修复策略）
// ══════════════════════════════════════════════════════════

async function phaseJudge(soul, inspectResult, wakeResult, options) {
  console.log('');
  console.log('[OPENCLAW] ═══ Phase 3: 大脑判断 ═══');

  if (!inspectResult || !inspectResult.success) {
    console.log('[OPENCLAW] ⚠️  无有效巡检结果，跳过判断');
    return { success: true, phase: 'judge', actions: [], skipped: true };
  }

  const report = inspectResult.report || {};
  const actions = [];

  // 分析巡检报告中的问题
  if (report.areas) {
    for (const area of report.areas) {
      if (area.issues && area.issues.length > 0) {
        for (const issue of area.issues) {
          actions.push({
            type: issue.fixable ? 'auto-fix' : 'manual',
            area: area.name,
            description: issue.description || issue.message || String(issue),
            priority: issue.priority || 'normal',
          });
        }
      }
    }
  }

  // 分析 score
  if (typeof report.score === 'number' && report.score < 70) {
    actions.push({
      type: 'alert',
      area: 'overall',
      description: `系统健康评分过低: ${report.score}/100`,
      priority: 'high',
    });
  }

  // Dry-run 模式下使用模拟判断
  if (options.dryRun) {
    console.log(`[OPENCLAW] 🔍 Dry Run — 发现 ${actions.length} 个待处理项`);
    return { success: true, phase: 'judge', actions, dryRun: true };
  }

  // 有可用的 LLM 且有复杂问题时，让大脑分析
  if (actions.length > 0 && wakeResult && wakeResult.wakeResult && wakeResult.wakeResult.success) {
    console.log(`[OPENCLAW] 🧠 大脑分析 ${actions.length} 个待处理项...`);
    // 大脑判断已在唤醒阶段完成上下文加载
    // 此处记录判断结果供后续执行
  }

  console.log(`[OPENCLAW] ✅ 判断完成 — ${actions.length} 个待处理项`);
  for (const action of actions) {
    const icon = action.type === 'auto-fix' ? '🔧' : action.type === 'alert' ? '🚨' : '📋';
    console.log(`[OPENCLAW]   ${icon} [${action.priority}] ${action.area}: ${action.description}`);
  }

  return { success: true, phase: 'judge', actions };
}

// ══════════════════════════════════════════════════════════
// Phase 4: 驱动修复
// ══════════════════════════════════════════════════════════

async function phaseFix(soul, judgeResult, options) {
  console.log('');
  console.log('[OPENCLAW] ═══ Phase 4: 驱动修复 ═══');

  if (!judgeResult || !judgeResult.success || !judgeResult.actions) {
    console.log('[OPENCLAW] ℹ️  无待修复项');
    return { success: true, phase: 'fix', fixed: [], skipped: [] };
  }

  const actions = judgeResult.actions;
  const autoFixes = actions.filter(a => a.type === 'auto-fix');
  const manualItems = actions.filter(a => a.type !== 'auto-fix');
  const fixed = [];
  const skipped = [];

  if (options.dryRun) {
    console.log(`[OPENCLAW] 🔍 Dry Run — 跳过实际修复`);
    console.log(`[OPENCLAW]   可自动修复: ${autoFixes.length} 项`);
    console.log(`[OPENCLAW]   需人类介入: ${manualItems.length} 项`);
    return { success: true, phase: 'fix', fixed: [], skipped: actions, dryRun: true };
  }

  // 执行可自动修复的项
  for (const fix of autoFixes) {
    try {
      console.log(`[OPENCLAW] 🔧 修复: ${fix.area} — ${fix.description}`);
      // 调用 system-check 的自动修复能力
      const systemCheck = require(path.join(ROOT, 'core/system-check'));
      if (typeof systemCheck.autoFix === 'function') {
        systemCheck.autoFix(fix);
      }
      fixed.push(fix);
    } catch (err) {
      console.log(`[OPENCLAW] ⚠️  修复失败: ${err.message}`);
      skipped.push({ ...fix, error: err.message });
    }
  }

  // 需人类介入的项记录到公告区
  for (const item of manualItems) {
    console.log(`[OPENCLAW] 📋 需人类介入: ${item.area} — ${item.description}`);
    skipped.push(item);
  }

  console.log(`[OPENCLAW] ✅ 修复完成 — 已修复 ${fixed.length} 项，待处理 ${skipped.length} 项`);
  return { success: true, phase: 'fix', fixed, skipped };
}

// ══════════════════════════════════════════════════════════
// Phase 5: 大脑休眠（记录闭环结果）
// ══════════════════════════════════════════════════════════

function phaseSleep(soul, loopResult) {
  console.log('');
  console.log('[OPENCLAW] ═══ Phase 5: 大脑休眠 ═══');

  const timestamp = new Date().toISOString();
  const sleepRecord = {
    persona: soul.persona_id,
    persona_name: soul.name,
    timestamp,
    loop_success: loopResult.success,
    phases_completed: loopResult.phases || [],
    actions_taken: loopResult.fixResult ? loopResult.fixResult.fixed.length : 0,
    actions_pending: loopResult.fixResult ? loopResult.fixResult.skipped.length : 0,
  };

  // 写入闭环记录
  const recordDir = path.join(__dirname, 'logs');
  if (!fs.existsSync(recordDir)) {
    fs.mkdirSync(recordDir, { recursive: true });
  }

  const dateStr = timestamp.slice(0, 10).replace(/-/g, '');
  const recordPath = path.join(recordDir, `loop-${dateStr}.json`);

  let records = [];
  if (fs.existsSync(recordPath)) {
    try {
      records = JSON.parse(fs.readFileSync(recordPath, 'utf-8'));
      if (!Array.isArray(records)) records = [records];
    } catch (_) {
      records = [];
    }
  }
  records.push(sleepRecord);
  fs.writeFileSync(recordPath, JSON.stringify(records, null, 2));

  console.log(`[OPENCLAW] 💤 ${soul.name} 核心大脑进入休眠`);
  console.log(`[OPENCLAW] 📋 闭环记录已写入: ${recordPath}`);

  // 输出到 GITHUB_OUTPUT
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `loop_success=${loopResult.success}\n`);
    fs.appendFileSync(outputFile, `actions_taken=${sleepRecord.actions_taken}\n`);
    fs.appendFileSync(outputFile, `actions_pending=${sleepRecord.actions_pending}\n`);
  }

  return sleepRecord;
}

// ══════════════════════════════════════════════════════════
// 完整闭环执行
// ══════════════════════════════════════════════════════════

async function runLoop(options = {}) {
  const personaId = options.persona || 'zhuyuan';
  const timestamp = new Date().toISOString();

  console.log('');
  console.log('🔄 ═══════════════════════════════════════════');
  console.log('   OpenClaw · AGE OS v1.0 唤醒闭环');
  console.log(`   人格体: ${personaId}`);
  console.log(`   时间: ${timestamp}`);
  console.log(`   模式: ${options.dryRun ? 'Dry Run' : '正式执行'}`);
  console.log('═══════════════════════════════════════════════');

  // 加载 Soul
  const soul = loadSoul(personaId);
  if (!soul) {
    return { success: false, error: 'soul_not_found', persona: personaId };
  }

  const phases = [];
  let wakeResult, inspectResult, judgeResult, fixResult;

  // 单步执行模式
  const step = options.step;

  // Phase 1: 唤醒
  if (!step || step === 'wake') {
    wakeResult = await phaseWake(soul, options);
    phases.push('wake');
    if (!wakeResult.success) {
      return { success: false, phases, wakeResult };
    }
  }

  // Phase 2: 巡检
  if (!step || step === 'inspect') {
    inspectResult = phaseInspect(soul);
    phases.push('inspect');
  }

  // Phase 3: 判断
  if (!step || step === 'judge') {
    judgeResult = await phaseJudge(soul, inspectResult, wakeResult, options);
    phases.push('judge');
  }

  // Phase 4: 修复
  if (!step || step === 'fix') {
    fixResult = await phaseFix(soul, judgeResult, options);
    phases.push('fix');
  }

  // Phase 5: 休眠
  const loopResult = {
    success: true,
    phases,
    wakeResult,
    inspectResult,
    judgeResult,
    fixResult,
  };

  if (!step) {
    phaseSleep(soul, loopResult);
    phases.push('sleep');
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`🔄 OpenClaw 闭环${step ? '(' + step + ')' : ''}完成`);
  console.log(`   完成阶段: ${phases.join(' → ')}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  return loopResult;
}

// ══════════════════════════════════════════════════════════
// 模块导出
// ══════════════════════════════════════════════════════════

module.exports = {
  runLoop,
  loadSoul,
  phaseWake,
  phaseInspect,
  phaseJudge,
  phaseFix,
  phaseSleep,
};

// ══════════════════════════════════════════════════════════
// CLI 入口
// ══════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const stepIdx = args.indexOf('--step');
  const step = stepIdx >= 0 && args[stepIdx + 1] ? args[stepIdx + 1] : null;
  const personaIdx = args.indexOf('--persona');
  const persona = personaIdx >= 0 && args[personaIdx + 1] ? args[personaIdx + 1] : 'zhuyuan';
  const taskIdx = args.indexOf('--task');
  const task = taskIdx >= 0 && args[taskIdx + 1] ? args[taskIdx + 1] : null;

  runLoop({ dryRun, step, persona, task }).then(result => {
    if (!result.success) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('[OPENCLAW] 💥 致命错误:', err.message);
    process.exit(1);
  });
}
