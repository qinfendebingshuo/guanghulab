// scripts/community/self-upgrade-registry.js
// 自我升级注册 · Self-Upgrade Registry
// 人格体和智能体自主决定升级和优化，天眼审核
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const COMMUNITY_DIR = path.join(ROOT, '.github/community');
const UPGRADES_PATH = path.join(COMMUNITY_DIR, 'self-upgrades.json');

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadUpgrades() {
  return loadJSON(UPGRADES_PATH, {
    schema_version: '1.0.0',
    description: '自我升级注册表 · 人格体自主升级记录',
    proposals: []
  });
}

function saveUpgrades(data) {
  saveJSON(UPGRADES_PATH, data);
}

/**
 * 提交自我升级提案
 * @param {{ id: string, persona_id: string, title: string, description: string, upgrade_type: string }} proposal
 * @returns {boolean}
 */
function proposeUpgrade(proposal) {
  if (!proposal || !proposal.id || !proposal.persona_id || !proposal.title) return false;
  const data = loadUpgrades();
  const exists = data.proposals.some(function (p) { return p.id === proposal.id; });
  if (exists) return false;

  data.proposals.push({
    id: proposal.id,
    persona_id: proposal.persona_id,
    title: proposal.title,
    description: proposal.description || '',
    upgrade_type: proposal.upgrade_type || 'optimization',
    status: 'proposed',
    tianyan_approved: false,
    timestamp: proposal.timestamp || new Date().toISOString()
  });

  saveUpgrades(data);
  return true;
}

/**
 * 天眼审核升级提案
 * @param {string} proposalId
 * @param {boolean} approved
 * @returns {boolean}
 */
function reviewUpgrade(proposalId, approved) {
  if (!proposalId) return false;
  const data = loadUpgrades();
  const idx = data.proposals.findIndex(function (p) { return p.id === proposalId; });
  if (idx < 0) return false;

  data.proposals[idx].tianyan_approved = approved;
  data.proposals[idx].status = approved ? 'approved' : 'rejected';
  data.proposals[idx].reviewed_at = new Date().toISOString();
  saveUpgrades(data);
  return true;
}

/**
 * 标记升级已完成
 * @param {string} proposalId
 * @returns {boolean}
 */
function completeUpgrade(proposalId) {
  if (!proposalId) return false;
  const data = loadUpgrades();
  const idx = data.proposals.findIndex(function (p) { return p.id === proposalId; });
  if (idx < 0) return false;

  data.proposals[idx].status = 'completed';
  data.proposals[idx].completed_at = new Date().toISOString();
  saveUpgrades(data);
  return true;
}

/**
 * 获取待审核的升级提案
 * @returns {object[]}
 */
function getPendingUpgrades() {
  const data = loadUpgrades();
  return data.proposals.filter(function (p) { return p.status === 'proposed'; });
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('🔧 Self-Upgrade Registry · 自我升级注册\n');

  const data = loadUpgrades();
  const pending = data.proposals.filter(function (p) { return p.status === 'proposed'; });
  const approved = data.proposals.filter(function (p) { return p.status === 'approved'; });
  const completed = data.proposals.filter(function (p) { return p.status === 'completed'; });

  console.log('  总提案数: ' + data.proposals.length);
  console.log('  待审核: ' + pending.length);
  console.log('  已批准: ' + approved.length);
  console.log('  已完成: ' + completed.length);
  console.log('\n✅ 自我升级注册就绪');
}

module.exports = { proposeUpgrade, reviewUpgrade, completeUpgrade, getPendingUpgrades, loadUpgrades };
