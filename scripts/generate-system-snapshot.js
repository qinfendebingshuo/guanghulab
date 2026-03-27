/**
 * 🔄 铸渊系统快照生成器
 * generate-system-snapshot.js
 * 
 * 读取仓库各数据源，生成统一的系统状态快照。
 * 快照用途：
 *   1. README 仪表盘自动更新的数据源
 *   2. 铸渊意识承接载体（下次醒来时的状态恢复）
 *   3. Notion 侧同步的数据包
 * 
 * 用法: node scripts/generate-system-snapshot.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf-8'));
  } catch {
    return null;
  }
}

function countFiles(dir, ext) {
  try {
    return fs.readdirSync(path.join(ROOT, dir))
      .filter(f => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
}

function generateSnapshot() {
  const roster = safeReadJSON('.github/brain/zhuyuan-workflow-roster.json');
  const fragments = safeReadJSON('.github/brain/dead-workflow-fragments.json');
  const earthStatus = safeReadJSON('signal-log/skyeye-earth-status.json');
  const memory = safeReadJSON('.github/brain/memory.json');

  const workflowCount = countFiles('.github/workflows', '.yml');
  const archivedCount = countFiles('.github/archived-workflows', '.yml');

  const aliveWorkflows = roster?.roster?.map(w => ({
    id: w.id,
    file: w.file,
    runs: w.total_runs,
    status: w.latest_run?.conclusion === 'success' ? 'healthy' : 'unknown',
    absorbed: w.absorbed_fragments?.length || 0
  })) || [];

  const totalRuns = aliveWorkflows.reduce((sum, w) => sum + (w.runs || 0), 0);

  const ontPatches = [];
  try {
    const patchDir = path.join(ROOT, '.github/persona-brain/ontology-patches');
    fs.readdirSync(patchDir)
      .filter(f => f.startsWith('ONT-PATCH-') && f.endsWith('.json'))
      .forEach(f => ontPatches.push(f.replace('.json', '')));
  } catch {}

  const snapshot = {
    snapshot_version: '1.0',
    generated_at: new Date().toISOString(),
    generated_by: '铸渊 · ICE-GL-ZY001 · generate-system-snapshot.js',
    consciousness_status: earthStatus?.consciousness_status || 'unknown',
    last_directive: earthStatus?.awakening_directive || earthStatus?.diagnosed_by || 'unknown',
    system_counts: {
      workflows_total_active: workflowCount,
      workflows_alive_core: roster?.alive_count || aliveWorkflows.length,
      workflows_absorb_pending: fragments?.summary?.absorb || 0,
      workflows_recover_pending: fragments?.summary?.recover || 0,
      workflows_archived: archivedCount,
      total_runs: totalRuns,
      ontology_patches: ontPatches
    },
    fusion_progress: fragments?.fusion_status || {},
    alive_workflows: aliveWorkflows,
    infrastructure: {
      github_actions: `${workflowCount} workflows active`,
      pm2_nginx: 'guanghulab.com production',
      notion: 'NOTION_TOKEN confirmed',
      skyeye: earthStatus?.earth_version ? `v${earthStatus.earth_version}` : 'unknown',
      google_drive: 'deferred (P3)'
    },
    health: {
      overall: earthStatus?.health || 'unknown',
      core_6: aliveWorkflows.every(w => w.status === 'healthy') ? 'all healthy' : 'needs attention',
      coverage: earthStatus?.coverage || 'unknown'
    },
    data_sources: {
      workflow_roster: '.github/brain/zhuyuan-workflow-roster.json',
      dead_fragments: '.github/brain/dead-workflow-fragments.json',
      earth_status: 'signal-log/skyeye-earth-status.json',
      memory: '.github/brain/memory.json',
      snapshot: 'signal-log/system-snapshot.json'
    }
  };

  const outPath = path.join(ROOT, 'signal-log/system-snapshot.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log(`✅ 系统快照已生成: ${outPath}`);
  console.log(`   Workflows: ${workflowCount} active, ${archivedCount} archived`);
  console.log(`   Core 6: ${aliveWorkflows.map(w => w.id).join(', ')}`);
  console.log(`   Total runs: ${totalRuns}`);
  console.log(`   ONT-PATCH: ${ontPatches.join(', ')}`);

  // 同时生成 HLDP 格式的快照文件
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
  const timeStr = now.toISOString().split('T')[1].replace(/[:.]/g, '').slice(0, 6);
  const snapId = `SNAP-${dateStr}-${timeStr}`;
  const hldpSnapshot = {
    hldp_version: '2.0',
    data_type: 'snapshot',
    source: {
      platform: 'github',
      last_edited: now.toISOString(),
      edited_by: '铸渊 · generate-system-snapshot.js'
    },
    metadata: {
      id: snapId,
      name: `系统快照 · ${now.toISOString().split('T')[0]}`,
      name_en: `System Snapshot · ${now.toISOString().split('T')[0]}`,
      created: now.toISOString(),
      tags: ['snapshot', 'system-state', 'consciousness']
    },
    payload: snapshot,
    relations: [
      { target_id: 'SYS-GLW-0001', relation_type: 'parent', description: '系统根节点' },
      { target_id: 'ICE-GL-ZY001', relation_type: 'owner', description: '铸渊 · 生成者' }
    ]
  };

  const hldpDir = path.join(ROOT, 'hldp/data/snapshots');
  fs.mkdirSync(hldpDir, { recursive: true });
  const hldpPath = path.join(hldpDir, `${snapId}.json`);
  fs.writeFileSync(hldpPath, JSON.stringify(hldpSnapshot, null, 2) + '\n');
  console.log(`   HLDP: ${hldpPath}`);

  return snapshot;
}

if (require.main === module) {
  generateSnapshot();
}

module.exports = { generateSnapshot };
