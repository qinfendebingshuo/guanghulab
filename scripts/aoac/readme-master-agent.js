#!/usr/bin/env node
'use strict';

/**
 * AOAC-05 · 首页主控Agent (README Master Agent)
 * ═══════════════════════════════════════════════
 * AGE OS Agent Chain · 全Agent（事件+时间双触发）
 * 
 * 唤醒条件1：事件触发 — AOAC-04写入readme-update-payload.json
 * 唤醒条件2：时间触发 — 每天23:00 CST
 * 职责：回看仓库首页→分析进度→更新README.md AOAC区域
 * 输出：更新README.md + data/aoac/master-report.json
 * 
 * 版权：国作登字-2026-A-00037559 · TCS-0002∞
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const README_PATH = path.join(ROOT, 'README.md');
const PAYLOAD_PATH = path.join(ROOT, 'data', 'aoac', 'readme-update-payload.json');
const CHAIN_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'chain-report.json');
const CHAIN_STATUS_PATH = path.join(ROOT, 'data', 'aoac', 'chain-status.json');
const MASTER_REPORT_PATH = path.join(ROOT, 'data', 'aoac', 'master-report.json');
const DASHBOARD_PATH = path.join(ROOT, 'data', 'bulletin-board', 'dashboard.json');
const MEMORY_PATH = path.join(ROOT, '.github', 'persona-brain', 'memory.json');
const HISTORY_DIR = path.join(ROOT, 'data', 'aoac', 'history');
const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const AOAC_START_MARKER = '<!-- AOAC_STATUS_START -->';
const AOAC_END_MARKER = '<!-- AOAC_STATUS_END -->';

function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 19) + '+08:00';
}

function getDateStr() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().slice(0, 10);
}

function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function generateAOACSection(chainStatus, chainReport, payload) {
  const lines = [];
  lines.push('');
  lines.push('### 🔗 AOAC · Agent链路闭环系统');
  lines.push('');
  lines.push('| Agent | 名称 | 状态 | 最后运行 |');
  lines.push('|-------|------|------|----------|');

  if (chainStatus && chainStatus.agents) {
    const agentOrder = ['AOAC-01', 'AOAC-02', 'AOAC-03', 'AOAC-04', 'AOAC-05', 'AOAC-06', 'AOAC-07', 'AOAC-08'];
    for (const id of agentOrder) {
      const agent = chainStatus.agents[id];
      if (!agent) continue;
      const statusIcon = agent.status === 'completed' ? '✅' :
        agent.status === 'half_ready' ? '🔶' :
        agent.status === 'running' ? '🔄' :
        agent.status === 'error' ? '❌' : '⬜';
      const lastRun = agent.last_run ? 
        new Date(new Date(agent.last_run).getTime() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 16) : 
        'N/A';
      lines.push(`| ${id} | ${agent.name_cn} | ${statusIcon} ${agent.status} | ${lastRun} |`);
    }
  }

  lines.push('');

  // Latest chain report
  if (chainReport && chainReport.development) {
    const dev = chainReport.development;
    const ci = chainReport.ci_result || {};
    const ciBadge = ci.overall === 'success' ? '✅' : ci.overall === 'failure' ? '❌' : '⚠️';
    lines.push(`**最新链路报告**: ${chainReport.report_id || 'N/A'}`);
    lines.push(`- PR #${dev.pr_number || '?'}: ${(dev.pr_title || '').slice(0, 80)}`);
    lines.push(`- 变更: ${dev.files_changed || 0}文件 (+${dev.additions || 0}/-${dev.deletions || 0})`);
    lines.push(`- CI: ${ciBadge} ${ci.overall || 'unknown'}`);
    lines.push(`- 时间: ${chainReport.timestamp || 'N/A'}`);
    lines.push('');
  }

  // Chain health
  if (chainStatus) {
    const health = chainStatus.chain_health || 'unknown';
    const healthIcon = health === 'healthy' ? '🟢' : health === 'warning' ? '🟡' : '⚪';
    lines.push(`**链路健康**: ${healthIcon} ${health} · 完成周期: ${chainStatus.total_cycles || 0} · 修复次数: ${chainStatus.total_repairs || 0}`);
  }

  lines.push('');
  return lines.join('\n');
}

function updateReadmeAOACSection(aoacContent) {
  if (!fs.existsSync(README_PATH)) {
    console.log('⚠️ README.md不存在，跳过更新');
    return false;
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');
  const startIdx = readme.indexOf(AOAC_START_MARKER);
  const endIdx = readme.indexOf(AOAC_END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    // Markers don't exist yet - add them before the footer if possible
    const footerMarker = '<!-- FOOTER_START -->';
    const footerIdx = readme.indexOf(footerMarker);
    if (footerIdx !== -1) {
      const insertion = `\n${AOAC_START_MARKER}\n${aoacContent}\n${AOAC_END_MARKER}\n\n`;
      readme = readme.slice(0, footerIdx) + insertion + readme.slice(footerIdx);
    } else {
      // Append to end
      readme += `\n${AOAC_START_MARKER}\n${aoacContent}\n${AOAC_END_MARKER}\n`;
    }
  } else {
    // Replace existing content
    readme = readme.slice(0, startIdx + AOAC_START_MARKER.length) +
      '\n' + aoacContent + '\n' +
      readme.slice(endIdx);
  }

  fs.writeFileSync(README_PATH, readme, 'utf8');
  return true;
}

function collectRepoStatus() {
  // Collect basic repo statistics
  const status = {
    total_workflows: 0,
    total_scripts: 0,
    aoac_agents: 0
  };

  try {
    const wfDir = path.join(ROOT, '.github', 'workflows');
    if (fs.existsSync(wfDir)) {
      status.total_workflows = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml')).length;
    }
  } catch { /* ignore */ }

  try {
    const scriptDir = path.join(ROOT, 'scripts');
    if (fs.existsSync(scriptDir)) {
      status.total_scripts = fs.readdirSync(scriptDir).filter(f => f.endsWith('.js')).length;
    }
  } catch { /* ignore */ }

  try {
    const aoacDir = path.join(ROOT, 'scripts', 'aoac');
    if (fs.existsSync(aoacDir)) {
      status.aoac_agents = fs.readdirSync(aoacDir).filter(f => f.endsWith('.js')).length;
    }
  } catch { /* ignore */ }

  return status;
}

function main() {
  const mode = process.argv[2] || 'auto';
  console.log(`🏠 AOAC-05 · 首页主控Agent · 唤醒中 (模式: ${mode})`);
  console.log(`📅 ${getBeijingTime()}`);

  const now = new Date();
  const dateStr = getDateStr();

  // Read all data sources
  const chainStatus = readJSON(CHAIN_STATUS_PATH);
  const chainReport = readJSON(CHAIN_REPORT_PATH);
  const payload = readJSON(PAYLOAD_PATH);
  const dashboard = readJSON(DASHBOARD_PATH);
  const memory = readJSON(MEMORY_PATH);
  const repoStatus = collectRepoStatus();

  // Generate AOAC section for README
  const aoacContent = generateAOACSection(chainStatus, chainReport, payload);

  // Update README
  const updated = updateReadmeAOACSection(aoacContent);
  if (updated) {
    console.log('✅ README.md AOAC区域已更新');
  }

  // Also call generate-readme-dashboard.js if it exists (event-triggered mode)
  const dashGen = path.join(ROOT, 'scripts', 'generate-readme-dashboard.js');
  if (fs.existsSync(dashGen) && mode === 'event') {
    try {
      execFileSync('node', [dashGen], { cwd: ROOT, timeout: 60000, stdio: 'inherit' });
      console.log('✅ README仪表盘同步更新');
    } catch (err) {
      console.error('⚠️ 仪表盘更新失败:', err.message);
    }
  }

  // In scheduled/auto mode, also generate dashboard for full daily review
  if (fs.existsSync(dashGen) && mode !== 'event') {
    try {
      execFileSync('node', [dashGen], { cwd: ROOT, timeout: 60000, stdio: 'inherit' });
      console.log('✅ 定时仪表盘同步更新');
    } catch (err) {
      console.error('⚠️ 定时仪表盘更新失败:', err.message);
    }
  }

  // Generate master report
  const seq = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  const masterReport = {
    aoac_agent: 'AOAC-05',
    aoac_agent_name: 'readme-master-agent',
    report_id: `AOAC-MASTER-${dateStr.replace(/-/g, '')}-${seq}`,
    timestamp: getBeijingTime(),
    timestamp_utc: now.toISOString(),
    mode,
    readme_updated: updated,
    chain_health: chainStatus ? chainStatus.chain_health : 'unknown',
    latest_chain_report: chainReport ? chainReport.report_id : null,
    repo_status: repoStatus,
    changes_summary: chainReport ? chainReport.changes_summary : '定时巡检·无新合并',
    triggers_next: 'AOAC-06 (notion-sync-signal)'
  };

  writeJSON(MASTER_REPORT_PATH, masterReport);
  console.log(`✅ 主控报告: ${masterReport.report_id}`);

  // Update chain status
  if (chainStatus && chainStatus.agents && chainStatus.agents['AOAC-05']) {
    chainStatus.agents['AOAC-05'].status = 'completed';
    chainStatus.agents['AOAC-05'].last_run = now.toISOString();
    chainStatus.agents['AOAC-05'].last_success = now.toISOString();
    chainStatus.total_cycles = (chainStatus.total_cycles || 0) + 1;
    chainStatus.last_full_cycle = now.toISOString();
    writeJSON(CHAIN_STATUS_PATH, chainStatus);
  }

  // Archive
  const historyDir = path.join(HISTORY_DIR, dateStr);
  fs.mkdirSync(historyDir, { recursive: true });
  writeJSON(path.join(historyDir, `${masterReport.report_id}.json`), masterReport);

  // Output for workflow
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `master_report_id=${masterReport.report_id}\n`);
    fs.appendFileSync(outputFile, `readme_updated=${updated}\n`);
    fs.appendFileSync(outputFile, `changes_summary=${(masterReport.changes_summary || '').slice(0, 200)}\n`);
  }

  console.log('🏠 AOAC-05 · 主控Agent完成 · 触发AOAC-06 Notion同步');
}

main();
