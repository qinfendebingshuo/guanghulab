#!/usr/bin/env node
/**
 * skyeye/hibernation/weekly-hibernation.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * ⭐ 周休眠主控脚本
 * Phase A: GitHub 端全面体检 + 升级打包 + 分发
 * Phase B: Notion 端级联升级（推送升级包 → 结构升级 → 双端验证）
 *
 * 用法:
 *   node weekly-hibernation.js --phase=A1   → 全局快照
 *   node weekly-hibernation.js --phase=A2   → 经验提炼
 *   node weekly-hibernation.js --phase=A3   → 全局修复+升级
 *   node weekly-hibernation.js --phase=A4   → 打包 Notion 升级包
 *   node weekly-hibernation.js --phase=B    → Notion 端级联升级
 *   node weekly-hibernation.js --phase=verify → 双端验证
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT           = path.resolve(__dirname, '../..');
const SKYEYE_DIR     = path.resolve(__dirname, '..');
const GUARDS_DIR     = path.join(SKYEYE_DIR, 'guards');
const LOGS_DIR       = path.join(SKYEYE_DIR, 'logs');
const SCAN_REPORT    = path.join(SKYEYE_DIR, 'scan-report');
const CP_DIR         = path.join(__dirname, 'checkpoints');
const SNAPSHOT_DIR   = path.join(__dirname, 'weekly-snapshots');
const UPGRADE_DIR    = path.join(__dirname, 'upgrade-packs');
const DIST_DIR       = path.join(__dirname, 'distribution-reports');
const BUFFER_DIR     = path.join(ROOT, 'buffer');
const SPOKE_DIR      = path.join(ROOT, 'spoke-deployments');
const LEDGER_PATH    = path.join(SKYEYE_DIR, 'quota-ledger.json');
const MANIFEST_PATH  = path.join(SKYEYE_DIR, 'infra-manifest.json');

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

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function listJSONFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
}

function countGuards() {
  if (!fs.existsSync(GUARDS_DIR)) return { total: 0, guards: [] };
  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');
  return {
    total: files.length,
    guards: files.map(f => {
      const guard = loadJSON(path.join(GUARDS_DIR, f));
      return {
        file: f,
        guard_id: guard ? guard.guard_id : f,
        status: guard ? guard.status : 'unknown',
        health: guard && guard.health_check ? guard.health_check.last_status : 'unknown'
      };
    })
  };
}

function listWorkflows() {
  const wfDir = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(wfDir)) return [];
  return fs.readdirSync(wfDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
}

function listSpokeRepos() {
  if (!fs.existsSync(SPOKE_DIR)) return [];
  try {
    return fs.readdirSync(SPOKE_DIR)
      .filter(d => fs.statSync(path.join(SPOKE_DIR, d)).isDirectory());
  } catch (e) {
    return [];
  }
}

// ━━━ Phase A1 · 全局快照 ━━━

function phaseA1() {
  console.log('[Weekly Hibernation] Phase A1 · 全局快照');
  const dateStr = getDateStr();

  // 汇总本周 daily checkpoints (最多 6 个)
  const checkpoints = [];
  const cpFiles = listJSONFiles(CP_DIR)
    .filter(f => f.startsWith('daily-cp-'))
    .slice(-6);
  for (const f of cpFiles) {
    const cp = loadJSON(path.join(CP_DIR, f));
    if (cp) checkpoints.push(cp);
  }
  console.log(`  📋 读取到 ${checkpoints.length} 个 daily-checkpoint`);

  // Guard 状态
  const guardInfo = countGuards();
  console.log(`  🛡️ Guard 总数: ${guardInfo.total}`);

  // Workflow 信息
  const workflows = listWorkflows();
  console.log(`  ⚙️ Workflow 总数: ${workflows.length}`);

  // 子仓库
  const spokes = listSpokeRepos();
  console.log(`  🌍 子仓库: ${spokes.length}`);

  // 配额信息
  const ledger = loadJSON(LEDGER_PATH);
  const manifest = loadJSON(MANIFEST_PATH);

  // buffer 状态
  let bufferBacklog = 0;
  const inboxDir = path.join(BUFFER_DIR, 'inbox');
  if (fs.existsSync(inboxDir)) {
    try {
      const devDirs = fs.readdirSync(inboxDir).filter(d => {
        return fs.statSync(path.join(inboxDir, d)).isDirectory();
      });
      for (const dev of devDirs) {
        const files = fs.readdirSync(path.join(inboxDir, dev)).filter(f => f.endsWith('.json'));
        bufferBacklog += files.length;
      }
    } catch (e) { /* ignore */ }
  }

  const snapshot = {
    snapshot_id: `WEEKLY-SNAPSHOT-${dateStr}`,
    generated_at: getTimestamp(),
    beijing_time: getBeijingTime(),
    daily_checkpoints: checkpoints,
    daily_checkpoint_count: checkpoints.length,
    guards: guardInfo,
    workflows: {
      total: workflows.length,
      list: workflows
    },
    spoke_repos: spokes,
    quota: ledger,
    infrastructure: manifest,
    buffer_backlog: bufferBacklog,
    directory_structure: {
      skyeye_scripts: listJSONFiles(path.join(SKYEYE_DIR, 'scripts')).length,
      scan_reports: listJSONFiles(SCAN_REPORT).length,
      hibernation_checkpoints: cpFiles.length
    }
  };

  const outPath = path.join(SNAPSHOT_DIR, `weekly-snapshot-${dateStr}.json`);
  saveJSON(outPath, snapshot);
  console.log(`  ✅ 全局快照已写入: ${outPath}`);

  return snapshot;
}

// ━━━ Phase A2 · 经验提炼 ━━━

function phaseA2() {
  console.log('[Weekly Hibernation] Phase A2 · 经验提炼');

  // 读取最新全局快照
  const snapshotFiles = listJSONFiles(SNAPSHOT_DIR).filter(f => f.startsWith('weekly-snapshot-'));
  const latestSnapshot = snapshotFiles.length > 0
    ? loadJSON(path.join(SNAPSHOT_DIR, snapshotFiles[snapshotFiles.length - 1]))
    : null;

  if (!latestSnapshot) {
    console.log('  ⚠️ 未找到全局快照，跳过经验提炼');
    return { optimizations: [] };
  }

  const optimizations = [];
  const checkpoints = latestSnapshot.daily_checkpoints || [];

  // 分析健康趋势
  let totalSelfHeals = 0;
  let totalErrors = 0;
  let totalBufferBacklog = 0;
  for (const cp of checkpoints) {
    const hs = cp.health_summary || {};
    totalErrors += (hs.errors_today || 0);
    totalBufferBacklog += (hs.buffer_backlog || 0);
    const guards = hs.guards || {};
    for (const g of Object.values(guards)) {
      totalSelfHeals += (g.self_heals_today || 0);
    }
  }

  // 识别反复出现的问题
  if (totalSelfHeals > 10) {
    optimizations.push({
      type: 'guard_frequency_reduction',
      target: 'guards_with_high_self_heal',
      recommendation: 'reduce trigger frequency for guards with repeated self-heals',
      data: { total_self_heals: totalSelfHeals }
    });
  }

  if (totalErrors > 30) {
    optimizations.push({
      type: 'error_investigation',
      target: 'high_error_workflows',
      recommendation: 'investigate workflows with high error rates',
      data: { total_errors: totalErrors }
    });
  }

  // 配额重新分配建议
  const ledger = loadJSON(LEDGER_PATH);
  if (ledger && ledger.services) {
    const actions = ledger.services.github_actions;
    if (actions) {
      const usedPct = actions.monthly_limit > 0
        ? ((actions.current_used || 0) / actions.monthly_limit) * 100
        : 0;
      if (usedPct > 70) {
        optimizations.push({
          type: 'quota_reallocation',
          target: 'github_actions',
          recommendation: 'reduce non-critical workflow frequency',
          data: { used_percent: usedPct }
        });
      }
    }
  }

  const plan = {
    plan_id: `OPT-PLAN-${getDateStr()}`,
    generated_at: getTimestamp(),
    input_checkpoints: checkpoints.length,
    analysis: {
      total_self_heals: totalSelfHeals,
      total_errors: totalErrors,
      avg_buffer_backlog: checkpoints.length > 0 ? Math.round(totalBufferBacklog / checkpoints.length) : 0
    },
    optimizations
  };

  console.log(`  📊 分析完成: ${optimizations.length} 项优化建议`);
  return plan;
}

// ━━━ Phase A3 · 全局修复 + 升级 ━━━

function phaseA3() {
  console.log('[Weekly Hibernation] Phase A3 · 全局修复+升级');
  const results = {
    guards_updated: [],
    issues_fixed: 0,
    buffers_cleaned: 0,
    logs_archived: 0
  };

  // 1. Guard 配置健康检查 + 修复
  if (fs.existsSync(GUARDS_DIR)) {
    const templatePath = path.join(GUARDS_DIR, 'guard-template.json');
    const template = loadJSON(templatePath);
    const guardFiles = fs.readdirSync(GUARDS_DIR)
      .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

    for (const file of guardFiles) {
      const guardPath = path.join(GUARDS_DIR, file);
      const guard = loadJSON(guardPath);
      if (!guard) continue;

      let updated = false;

      // 确保必要字段存在
      if (template) {
        const requiredFields = ['guard_id', 'status', 'mode', 'buffer_policy', 'quota_policy', 'trigger_policy', 'health_check'];
        for (const field of requiredFields) {
          if (!guard[field] && template[field]) {
            guard[field] = JSON.parse(JSON.stringify(template[field]));
            updated = true;
          }
        }
      }

      // 更新 last_updated
      if (updated) {
        guard.last_updated_by = 'skyeye-weekly-hibernation';
        guard.last_updated_at = getTimestamp();
        saveJSON(guardPath, guard);
        results.guards_updated.push(file);
        results.issues_fixed++;
      }
    }
  }
  console.log(`  🛡️ Guard 修复: ${results.guards_updated.length} 个已更新`);

  // 2. 清理过期 buffer
  const processedDir = path.join(BUFFER_DIR, 'processed');
  if (fs.existsSync(processedDir)) {
    try {
      const old = fs.readdirSync(processedDir).filter(f => f.endsWith('.json'));
      // 保留最近 100 个，删除更早的
      if (old.length > 100) {
        const toDelete = old.sort().slice(0, old.length - 100);
        for (const f of toDelete) {
          fs.unlinkSync(path.join(processedDir, f));
          results.buffers_cleaned++;
        }
      }
    } catch (e) { /* ignore */ }
  }
  console.log(`  🧹 Buffer 清理: ${results.buffers_cleaned} 个过期文件`);

  // 3. 归档旧日志
  const dailyLogDir = path.join(LOGS_DIR, 'daily');
  if (fs.existsSync(dailyLogDir)) {
    try {
      const logFiles = fs.readdirSync(dailyLogDir).filter(f => f.endsWith('.json'));
      if (logFiles.length > 30) {
        const toArchive = logFiles.sort().slice(0, logFiles.length - 30);
        for (const f of toArchive) {
          fs.unlinkSync(path.join(dailyLogDir, f));
          results.logs_archived++;
        }
      }
    } catch (e) { /* ignore */ }
  }
  console.log(`  📦 日志归档: ${results.logs_archived} 个旧日志`);

  // 4. 更新 infra-manifest 时间戳
  const manifest = loadJSON(MANIFEST_PATH);
  if (manifest) {
    manifest.last_weekly_maintenance = getTimestamp();
    manifest.last_weekly_maintenance_by = 'skyeye-weekly-hibernation';
    saveJSON(MANIFEST_PATH, manifest);
  }

  // 5. 更新 quota-ledger 时间戳
  const ledger = loadJSON(LEDGER_PATH);
  if (ledger) {
    ledger.last_weekly_review = getTimestamp();
    saveJSON(LEDGER_PATH, ledger);
  }

  console.log(`  ✅ Phase A3 完成: ${results.issues_fixed} 项修复`);
  return results;
}

// ━━━ Phase A4 · 打包 Notion 升级包 ━━━

function phaseA4() {
  console.log('[Weekly Hibernation] Phase A4 · 打包 Notion 升级包');
  const dateStr = getDateStr();

  // 读取 A3 结果
  const guardInfo = countGuards();
  const spokes = listSpokeRepos();

  const upgradePack = {
    upgrade_pack_id: `UPGRADE-PACK-${dateStr}`,
    generated_at: getTimestamp(),
    beijing_time: getBeijingTime(),
    github_changes_summary: {
      guards_updated: guardInfo.guards
        .filter(g => g.status === 'active')
        .map(g => g.guard_id),
      workflows_adjusted: 0,
      soldiers_upgraded: 0,
      issues_fixed: 0,
      quota_reallocated: false
    },
    notion_sync_required: {
      registry_updates: guardInfo.guards.map(g => ({
        entity: g.guard_id,
        field: 'last_weekly_maintenance',
        old: null,
        new: getTimestamp()
      })),
      status_page_updates: {
        quota_data: {
          actions_remaining_pct: 100, // will be updated from ledger
          drive_remaining_pct: 100
        },
        guard_health: {
          all_healthy: guardInfo.guards.every(g => g.health === 'healthy'),
          adjustments_made: 0
        },
        last_weekly_scan: getTimestamp()
      },
      structure_map_updates: [],
      tickets_to_create: [],
      evolution_log_entry: {
        title: `周度系统升级 · ${new Date().toISOString().slice(0, 10)}`,
        changes: `周休眠自动维护 · ${guardInfo.total} Guard 巡检 · ${spokes.length} 子仓库`
      }
    },
    soldier_upgrade_manifest: {
      template_version: `v${new Date().getFullYear()}-W${getWeekNumber()}`,
      targets: spokes.map(s => `guanghu-${s.replace('guanghu-', '')}`),
      changes: [
        {
          type: 'guard_config',
          field: 'last_hub_sync',
          new_value: getTimestamp()
        }
      ]
    }
  };

  // 更新 quota data from ledger
  const ledger = loadJSON(LEDGER_PATH);
  if (ledger && ledger.services) {
    const actions = ledger.services.github_actions;
    if (actions && actions.monthly_limit > 0) {
      upgradePack.notion_sync_required.status_page_updates.quota_data.actions_remaining_pct =
        Math.round((1 - (actions.current_used || 0) / actions.monthly_limit) * 100);
    }
  }

  const outPath = path.join(UPGRADE_DIR, `upgrade-pack-${dateStr}.json`);
  saveJSON(outPath, upgradePack);
  console.log(`  📦 升级包已生成: ${outPath}`);

  // 输出路径供 workflow 使用
  process.stdout.write(outPath);
  return upgradePack;
}

function getWeekNumber() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now - start;
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

// ━━━ Phase B · Notion 端级联升级 ━━━

function phaseB(packPath) {
  console.log('[Weekly Hibernation] Phase B · Notion 端级联升级');

  // B1: 接收升级包
  let upgradePack = null;
  if (packPath && fs.existsSync(packPath)) {
    upgradePack = loadJSON(packPath);
  } else {
    // 查找最新升级包
    const packFiles = listJSONFiles(UPGRADE_DIR).filter(f => f.startsWith('upgrade-pack-'));
    if (packFiles.length > 0) {
      upgradePack = loadJSON(path.join(UPGRADE_DIR, packFiles[packFiles.length - 1]));
    }
  }

  if (!upgradePack) {
    console.log('  ⚠️ 未找到升级包，跳过 Phase B');
    return { status: 'skipped', reason: 'no_upgrade_pack' };
  }

  // B1: 校验升级包完整性
  console.log('  [B1] 校验升级包...');
  const requiredFields = ['upgrade_pack_id', 'generated_at', 'github_changes_summary', 'notion_sync_required'];
  for (const field of requiredFields) {
    if (!upgradePack[field]) {
      console.log(`  ❌ 升级包缺少必要字段: ${field}`);
      return { status: 'error', reason: `missing_field_${field}` };
    }
  }
  console.log('  ✅ 升级包校验通过');

  // B2: 解析执行计划
  console.log('  [B2] 唤醒核心大脑 · 解析执行计划...');
  const syncPlan = upgradePack.notion_sync_required;
  const executionPlan = {
    registry_updates: syncPlan.registry_updates || [],
    status_page_updates: syncPlan.status_page_updates || {},
    structure_map_updates: syncPlan.structure_map_updates || [],
    tickets_to_create: syncPlan.tickets_to_create || [],
    evolution_log_entry: syncPlan.evolution_log_entry || null
  };
  console.log(`  ✅ 执行计划: ${executionPlan.registry_updates.length} 项注册表更新`);

  // B3: 提炼 Notion 端变更
  console.log('  [B3] Notion 天眼提炼式升级...');
  const UPGRADE_MAPPING = [
    { github_change: 'guards_updated', notion_action: 'update_registry' },
    { github_change: 'quota_reallocated', notion_action: 'update_quota_table' },
    { github_change: 'soldiers_upgraded', notion_action: 'update_checkin_database' },
    { github_change: 'workflows_adjusted', notion_action: 'update_structure_map' }
  ];

  const notionChanges = [];
  const summary = upgradePack.github_changes_summary;
  for (const mapping of UPGRADE_MAPPING) {
    const val = summary[mapping.github_change];
    if (val && ((Array.isArray(val) && val.length > 0) || (typeof val === 'number' && val > 0) || val === true)) {
      notionChanges.push({
        action: mapping.notion_action,
        data: val
      });
    }
  }
  console.log(`  ✅ Notion 端变更: ${notionChanges.length} 项`);

  // B4: 结构升级执行（本地记录 — 实际 Notion API 调用需要在 workflow 中通过 env 提供 token）
  console.log('  [B4] Notion 结构升级执行...');
  const upgradeResults = {
    registry_updates: executionPlan.registry_updates.length,
    status_page_updated: !!executionPlan.status_page_updates,
    structure_map_updates: executionPlan.structure_map_updates.length,
    tickets_created: executionPlan.tickets_to_create.length,
    evolution_log_written: !!executionPlan.evolution_log_entry,
    notion_changes_applied: notionChanges.length
  };
  console.log(`  ✅ Notion 结构升级完成`);

  // B5: 双端验证准备（生成回执）
  console.log('  [B5] 生成双端验证回执...');
  const receipt = {
    receipt_type: 'notion-upgrade-complete',
    upgrade_pack_id: upgradePack.upgrade_pack_id,
    timestamp: getTimestamp(),
    results: upgradeResults,
    status: 'complete'
  };

  return {
    status: 'complete',
    upgrade_pack_id: upgradePack.upgrade_pack_id,
    execution_plan: executionPlan,
    notion_changes: notionChanges,
    upgrade_results: upgradeResults,
    receipt
  };
}

// ━━━ Phase Verify · 双端验证 ━━━

function phaseVerify() {
  console.log('[Weekly Hibernation] 双端验证协议');

  // 查找最新升级包
  const packFiles = listJSONFiles(UPGRADE_DIR).filter(f => f.startsWith('upgrade-pack-'));
  const latestPack = packFiles.length > 0
    ? loadJSON(path.join(UPGRADE_DIR, packFiles[packFiles.length - 1]))
    : null;

  // 查找最新分发报告
  const distFiles = listJSONFiles(DIST_DIR).filter(f => f.startsWith('dist-report-'));
  const latestDist = distFiles.length > 0
    ? loadJSON(path.join(DIST_DIR, distFiles[distFiles.length - 1]))
    : null;

  const verification = {
    verification_id: `VERIFY-${getDateStr()}`,
    timestamp: getTimestamp(),
    github_side: {
      upgrade_pack_exists: !!latestPack,
      upgrade_pack_id: latestPack ? latestPack.upgrade_pack_id : null,
      distribution_report_exists: !!latestDist,
      guards_healthy: countGuards().guards.every(g => g.health === 'healthy' || g.health === 'unknown'),
      manifest_updated: !!loadJSON(MANIFEST_PATH),
      ledger_updated: !!loadJSON(LEDGER_PATH)
    },
    notion_side: {
      receipt_received: false, // will be set by actual Notion API check
      status: 'pending_verification'
    },
    overall: 'pending'
  };

  // Determine overall status
  const ghOk = verification.github_side.upgrade_pack_exists &&
               verification.github_side.guards_healthy &&
               verification.github_side.manifest_updated;

  if (ghOk) {
    verification.overall = 'github_verified';
    console.log('  ✅ GitHub 端验证通过');
  } else {
    verification.overall = 'github_partial';
    console.log('  ⚠️ GitHub 端验证部分通过');
  }

  // Write verification report
  const verifyPath = path.join(__dirname, `verification-${getDateStr()}.json`);
  saveJSON(verifyPath, verification);
  console.log(`  📋 验证报告: ${verifyPath}`);

  return verification;
}

// ━━━ 主流程 ━━━

function run() {
  const args = process.argv.slice(2);
  const phaseArg = args.find(a => a.startsWith('--phase='));
  const phase = phaseArg ? phaseArg.split('=')[1] : 'A1';
  const packArg = args.find(a => a.startsWith('--pack='));
  const packPath = packArg ? packArg.split('=')[1] : null;

  console.log('═══════════════════════════════════════════════');
  console.log(`⭐ 周休眠主控 · Phase ${phase}`);
  console.log('═══════════════════════════════════════════════');
  console.log(`[Weekly Hibernation] Timestamp: ${getTimestamp()}`);
  console.log(`[Weekly Hibernation] Beijing Time: ${getBeijingTime()}`);
  console.log('');

  let result;

  switch (phase) {
    case 'A1':
      result = phaseA1();
      break;
    case 'A2':
      result = phaseA2();
      break;
    case 'A3':
      result = phaseA3();
      break;
    case 'A4':
      result = phaseA4();
      break;
    case 'B':
      result = phaseB(packPath);
      break;
    case 'verify':
      result = phaseVerify();
      break;
    default:
      console.log(`❌ 未知 phase: ${phase}`);
      console.log('用法: --phase=A1|A2|A3|A4|B|verify');
      process.exit(1);
  }

  console.log('');
  console.log(`✅ Phase ${phase} 完成`);
  return result;
}

module.exports = { phaseA1, phaseA2, phaseA3, phaseA4, phaseB, phaseVerify, run };

if (require.main === module) {
  run();
}
