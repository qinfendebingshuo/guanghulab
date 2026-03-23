#!/usr/bin/env node
/**
 * scripts/skyeye/generate-arch-summary.js
 * 天眼 · 系统架构汇总生成器
 *
 * 扫描仓库当前状态，生成 Markdown 格式的系统架构汇总，
 * 写入 README.md 的 <!-- ARCH_SUMMARY_START/END --> 标记区域。
 *
 * 用法:
 *   node scripts/skyeye/generate-arch-summary.js
 *
 * 数据来源:
 *   - .github/workflows/                   → Workflow 总数
 *   - .github/persona-brain/agent-registry.json → Agent 总数
 *   - .github/persona-brain/persona-registry.json → 人格体总数
 *   - .github/brain/architecture/channel-map.json → 开发者频道
 *   - skyeye/infra-manifest.json            → 基础设施服务
 *   - skyeye/guards/                        → Guard 数量
 *   - spoke-deployments/                    → 子仓库（联邦）
 *   - skyeye/scan-report/                   → 最新扫描报告
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const README_PATH = path.join(ROOT, 'README.md');

const MARKER_START = '<!-- ARCH_SUMMARY_START -->';
const MARKER_END   = '<!-- ARCH_SUMMARY_END -->';

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 16);
}

function getBeijingDate() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().slice(0, 10);
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 数据采集 ━━━

function countWorkflows() {
  const dir = path.join(ROOT, '.github/workflows');
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).length;
  } catch (e) {
    return 0;
  }
}

function getAgentStats() {
  const registry = loadJSON(path.join(ROOT, '.github/persona-brain/agent-registry.json'));
  if (!registry) return { total: 0, checkinRequired: 0 };
  const agents = registry.agents || [];
  return {
    total: agents.length,
    checkinRequired: agents.filter(a => a.daily_checkin_required).length
  };
}

function getPersonaStats() {
  const registry = loadJSON(path.join(ROOT, '.github/persona-brain/persona-registry.json'));
  if (!registry) return { total: 0 };
  const personas = registry.personas || [];
  return {
    total: personas.length,
    active: personas.filter(p => p.status === 'active' || !p.status).length
  };
}

function getChannelStats() {
  const channelMap = loadJSON(path.join(ROOT, '.github/brain/architecture/channel-map.json'));
  if (!channelMap || !channelMap.channels) return { total: 0, active: 0 };
  const channels = channelMap.channels;
  const entries = Object.values(channels);
  return {
    total: entries.length,
    active: entries.filter(c => c.status === 'active').length
  };
}

function getInfraServices() {
  const manifest = loadJSON(path.join(ROOT, 'skyeye/infra-manifest.json'));
  if (!manifest || !manifest.infrastructure) return [];
  return Object.entries(manifest.infrastructure).map(([key, svc]) => ({
    key,
    name: svc.service || key,
    plan: svc.plan || '—'
  }));
}

function countGuards() {
  const dir = path.join(ROOT, 'skyeye/guards');
  try {
    return fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'guard-template.json').length;
  } catch (e) {
    return 0;
  }
}

function getSpokeDeployments() {
  const dir = path.join(ROOT, 'spoke-deployments');
  try {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter(d => d.isDirectory())
      .map(d => d.name);
  } catch (e) {
    return [];
  }
}

function getFederationStats() {
  const registry = loadJSON(path.join(ROOT, '.github/persona-brain/agent-registry.json'));
  if (!registry || !registry.federation) return { total: 0, members: [] };
  const fed = registry.federation;
  return {
    total: Object.keys(fed).length,
    members: Object.entries(fed).map(([devId, info]) => ({
      devId,
      persona: info.persona || '—',
      repo: info.repo || '—'
    }))
  };
}

function getLatestScanReport() {
  const dir = path.join(ROOT, 'skyeye/scan-report');
  try {
    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .sort()
      .reverse();
    if (files.length === 0) return null;
    return loadJSON(path.join(dir, files[0]));
  } catch (e) {
    return null;
  }
}

function countModuleDirs() {
  try {
    return fs.readdirSync(ROOT, { withFileTypes: true }).filter(d => {
      return /^m\d+/.test(d.name) && d.isDirectory();
    }).length;
  } catch (e) {
    return 0;
  }
}

function getOntologyVersion() {
  const onto = loadJSON(path.join(ROOT, '.github/persona-brain/ontology.json'));
  if (!onto) return '—';
  return `v${onto.version || '?'} · ${onto.document_id || ''}`;
}

function getBufferStatus() {
  const inboxDir = path.join(ROOT, 'buffer/inbox');
  try {
    let count = 0;
    const devDirs = fs.readdirSync(inboxDir);
    for (const d of devDirs) {
      const fullPath = path.join(inboxDir, d);
      if (fs.statSync(fullPath).isDirectory()) {
        count += fs.readdirSync(fullPath).length;
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

// ━━━ Markdown 生成 ━━━

function generateMarkdown() {
  const date = getBeijingDate();
  const time = getBeijingTime();
  const workflows = countWorkflows();
  const agentStats = getAgentStats();
  const personaStats = getPersonaStats();
  const channelStats = getChannelStats();
  const infraServices = getInfraServices();
  const guards = countGuards();
  const spokes = getSpokeDeployments();
  const federation = getFederationStats();
  const latestScan = getLatestScanReport();
  const modules = countModuleDirs();
  const ontology = getOntologyVersion();
  const bufferPending = getBufferStatus();

  // Health indicator from latest scan
  let healthIcon = '🟢';
  let healthText = '全部正常';
  if (latestScan) {
    const alerts = latestScan.alerts || [];
    if (alerts.length > 0) {
      healthIcon = '🟡';
      healthText = `${alerts.length} 条告警`;
    }
    const status = latestScan.infrastructure_status || {};
    if ((status.down || 0) > 0) {
      healthIcon = '🔴';
      healthText = `${status.down} 服务宕机`;
    }
  }

  const lines = [];
  lines.push(`> 🦅 **天眼自动汇总** · 每周六 20:00 CST 自动更新 · 最后更新: ${date}`);
  lines.push('');
  lines.push(`| 维度 | 当前状态 |`);
  lines.push(`|------|----------|`);
  lines.push(`| 🏥 系统健康 | ${healthIcon} ${healthText} |`);
  lines.push(`| ⚙️ Workflow 总数 | ${workflows} 个 |`);
  lines.push(`| 🤖 Agent 总数 | ${agentStats.total} 个（${agentStats.checkinRequired} 个需日签到） |`);
  lines.push(`| 🎭 人格体 | ${personaStats.total} 个 |`);
  lines.push(`| 📡 开发者频道 | ${channelStats.total} 个（活跃 ${channelStats.active}） |`);
  lines.push(`| 🛡️ Guard 守卫 | ${guards} 个 |`);
  lines.push(`| 📦 功能模块 | ${modules} 个 |`);
  lines.push(`| 🌍 子仓库联邦 | ${spokes.length} 个模板（签到 ${federation.total} 个） |`);
  lines.push(`| 📜 本体论 | ${ontology} |`);
  lines.push(`| 📮 Buffer 待处理 | ${bufferPending} 条 |`);
  lines.push('');

  // Infrastructure services table
  lines.push(`**基础设施服务：**`);
  lines.push('');
  lines.push(`| 服务 | 计划 | 状态 |`);
  lines.push(`|------|------|------|`);
  for (const svc of infraServices) {
    lines.push(`| ${svc.name} | ${svc.plan} | ✅ |`);
  }
  lines.push('');

  // Scan report highlight
  if (latestScan) {
    const guardStatus = latestScan.guard_status || {};
    const healActions = latestScan.self_heal_actions || {};
    lines.push(`**最近一次天眼扫描：** ${latestScan.report_id || '—'}`);
    lines.push(`- Guard: ${guardStatus.active || 0}/${guardStatus.total_guards || 0} 活跃`);
    lines.push(`- 自愈: 清理 ${healActions.files_cleaned || 0} 文件 · 修复 ${healActions.configs_repaired || 0} 配置 · 重启 ${healActions.guards_restarted || 0} Guard`);
    const nextScan = latestScan.next_scan ? latestScan.next_scan.slice(0, 10) : '—';
    lines.push(`- 下次扫描: ${nextScan}`);
  }

  return lines.join('\n');
}

// ━━━ README 更新 ━━━

function updateReadme(markdown) {
  if (!fs.existsSync(README_PATH)) {
    console.error('❌ README.md 不存在');
    return false;
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');

  const startIdx = readme.indexOf(MARKER_START);
  const endIdx   = readme.indexOf(MARKER_END);

  if (startIdx === -1 || endIdx === -1) {
    console.error('❌ README.md 中未找到 ARCH_SUMMARY 标记');
    return false;
  }

  const before = readme.slice(0, startIdx + MARKER_START.length);
  const after  = readme.slice(endIdx);

  readme = before + '\n' + markdown + '\n' + after;
  fs.writeFileSync(README_PATH, readme, 'utf8');
  console.log('✅ README.md 架构汇总已更新');
  return true;
}

// ━━━ JSON 报告输出 ━━━

function generateJsonReport() {
  return {
    generated_at: new Date().toISOString(),
    generated_at_beijing: getBeijingTime(),
    workflows: countWorkflows(),
    agents: getAgentStats(),
    personas: getPersonaStats(),
    channels: getChannelStats(),
    infrastructure: getInfraServices(),
    guards: countGuards(),
    spoke_deployments: getSpokeDeployments(),
    federation: getFederationStats(),
    modules: countModuleDirs(),
    ontology: getOntologyVersion(),
    buffer_pending: getBufferStatus()
  };
}

// ━━━ 入口 ━━━

function main() {
  console.log('[天眼 · 架构汇总] 开始生成系统架构汇总...');

  const markdown = generateMarkdown();
  const updated = updateReadme(markdown);

  // Also output JSON report for Notion bridge consumption
  const jsonReport = generateJsonReport();
  const reportDir = path.join(ROOT, 'skyeye/scan-report');
  if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${getBeijingDate().replace(/-/g, '')}-arch-summary.json`);
  fs.writeFileSync(reportPath, JSON.stringify(jsonReport, null, 2) + '\n', 'utf8');
  console.log(`📋 架构汇总 JSON: ${reportPath}`);

  if (updated) {
    console.log('[天眼 · 架构汇总] ✅ 完成');
  } else {
    console.log('[天眼 · 架构汇总] ⚠️ README 未更新（缺少标记）');
  }
}

main();
