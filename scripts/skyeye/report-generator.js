// scripts/skyeye/report-generator.js
// 天眼·全局健康报告生成器
//
// 汇总所有扫描结果 + 诊断 + 修复结果 → 生成统一报告
// 报告写入：/tmp/skyeye/full-report.json + memory.json skyeye 段

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const SKYEYE_DIR = '/tmp/skyeye';
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');
const MEMORY_PATH = path.join(BRAIN_DIR, 'memory.json');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const startTime = Date.now();

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 生成报告 ━━━
function generateReport() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
    .replace('T', ' ').slice(0, 19) + '+08:00';

  // 读取所有扫描结果
  const wfHealth     = readJSON(path.join(SKYEYE_DIR, 'workflow-health.json'));
  const structHealth = readJSON(path.join(SKYEYE_DIR, 'structure-health.json'));
  const brainHealth  = readJSON(path.join(SKYEYE_DIR, 'brain-health.json'));
  const bridgeHealth = readJSON(path.join(SKYEYE_DIR, 'bridge-health.json'));
  const diagnosis    = readJSON(path.join(SKYEYE_DIR, 'diagnosis.json'));
  const repairResult = readJSON(path.join(SKYEYE_DIR, 'repair-result.json'));

  // 计算时长
  const durationSeconds = Math.round((Date.now() - startTime) / 1000);

  // 确定整体健康度
  let overallHealth = '🟢';
  if (diagnosis && diagnosis.needs_human > 0) {
    overallHealth = '🔴';
  } else if (diagnosis && diagnosis.total_issues > 0) {
    overallHealth = '🟡';
  }

  // 构建报告
  const report = {
    report_id: `SKYEYE-${dateStr.replace(/-/g, '')}`,
    timestamp: bjTime,
    duration_seconds: durationSeconds,
    overall_health: overallHealth,

    brain_status: {
      integrity: brainHealth ? brainHealth.integrity : 'unknown',
      memory_fresh: brainHealth ? brainHealth.memory_fresh : false,
      routing_map_aligned: brainHealth ? brainHealth.routing_map_aligned : false,
      dev_status_last_sync: brainHealth && brainHealth.dev_status
        ? brainHealth.dev_status.last_sync : null,
      knowledge_base_entries: brainHealth && brainHealth.knowledge_base
        ? brainHealth.knowledge_base.entries : 0
    },

    workflow_health: {
      total: wfHealth ? wfHealth.total_workflows : 0,
      healthy: wfHealth ? wfHealth.healthy : 0,
      failed: wfHealth ? (wfHealth.total_workflows - wfHealth.healthy) : 0,
      never_triggered: 0, // Determined from recent runs
      conflicts: wfHealth ? (wfHealth.cron_conflicts || []).length : 0,
      details: wfHealth ? (wfHealth.workflow_map || []).map(w => ({
        name: w.name,
        file: w.file,
        status: w.status,
        last_run: w.last_run || 'unknown'
      })) : []
    },

    structure_health: {
      core_dirs_ok: structHealth ? structHealth.core_dirs_ok : false,
      orphan_files: structHealth ? structHealth.orphan_files : 0,
      missing_dirs: structHealth ? structHealth.missing_dirs : [],
      readme_ok: structHealth ? structHealth.readme_ok : false
    },

    bridge_health: {
      notion_api: bridgeHealth ? bridgeHealth.notion_api.status : '❓',
      server_ssh: bridgeHealth ? bridgeHealth.server_ssh.status : '❓',
      github_api: bridgeHealth ? bridgeHealth.github_api.status : '❓',
      secrets_complete: bridgeHealth && bridgeHealth.secrets
        ? bridgeHealth.secrets.complete : false
    },

    diagnosis: {
      total_issues: diagnosis ? diagnosis.total_issues : 0,
      auto_fixed: repairResult ? repairResult.total_repaired : 0,
      needs_human: diagnosis ? diagnosis.needs_human : 0,
      watching: diagnosis ? diagnosis.watch_list : 0,
      issues: diagnosis ? (diagnosis.issues || []).map(i => {
        const repairEntry = repairResult
          ? (repairResult.repairs || []).find(r => r.issue_id === i.id)
          : null;
        return {
          id: i.id,
          symptom: i.symptom,
          root_cause: i.root_cause,
          impact: i.impact,
          fix_applied: i.fixable ? i.fix_plan : null,
          verified: repairEntry ? repairEntry.verified : false
        };
      }) : []
    },

    repairs_applied: repairResult
      ? (repairResult.repairs || []).filter(r => r.success).map(r => r.symptom)
      : [],
    tickets_created: repairResult
      ? (repairResult.tickets || [])
      : [],
    next_actions: []
  };

  // 生成下一步建议
  if (diagnosis && diagnosis.watch_list > 0) {
    report.next_actions.push('持续观察 watch_list 中的问题');
  }
  if (report.brain_status.integrity !== 'ok') {
    report.next_actions.push('核心大脑需要修复');
  }
  if (!report.brain_status.memory_fresh) {
    report.next_actions.push('memory.json 数据需要刷新');
  }

  // 保存完整报告
  fs.mkdirSync(SKYEYE_DIR, { recursive: true });
  fs.writeFileSync(path.join(SKYEYE_DIR, 'full-report.json'), JSON.stringify(report, null, 2));

  // 更新 memory.json 的 skyeye 段
  updateMemory(report);

  console.log(JSON.stringify(report, null, 2));
  console.log(`\n🦅 天眼报告生成完毕 · ${report.report_id} · 整体健康: ${overallHealth}`);
}

// ━━━ 更新 memory.json ━━━
function updateMemory(report) {
  try {
    const mem = readJSON(MEMORY_PATH);
    if (!mem) return;

    // 添加 skyeye 段
    mem.skyeye = {
      last_run: report.timestamp,
      report_id: report.report_id,
      overall_health: report.overall_health,
      issues_found: report.diagnosis.total_issues,
      auto_fixed: report.diagnosis.auto_fixed,
      needs_human: report.diagnosis.needs_human
    };

    mem.last_updated = new Date().toISOString();

    // 添加天眼事件到 recent_events（检查重复）
    const eventDate = new Date().toISOString().slice(0, 10);
    const existingEvent = (mem.recent_events || []).find(
      e => e.date === eventDate && e.type === 'skyeye_scan'
    );

    if (!existingEvent) {
      if (!mem.recent_events) mem.recent_events = [];
      mem.recent_events.unshift({
        date: eventDate,
        type: 'skyeye_scan',
        description: `天眼扫描 · ${report.overall_health} · 问题:${report.diagnosis.total_issues} 自动修复:${report.diagnosis.auto_fixed} 需人工:${report.diagnosis.needs_human}`,
        by: '天眼系统'
      });

      // 保持最近 20 条事件
      if (mem.recent_events.length > 20) {
        mem.recent_events = mem.recent_events.slice(0, 20);
      }
    }

    fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2));
    console.log('✅ memory.json 已更新天眼段');
  } catch (e) {
    console.error('⚠️ 更新 memory.json 失败:', e.message);
  }
}

generateReport();
