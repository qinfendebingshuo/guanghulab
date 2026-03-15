// scripts/generate-system-health.js
// 系统健康状态生成器 · System Health Generator
//
// 功能：巡检 brain/ 目录完整性和系统状态，更新 brain/system-health.json
// 触发方式：
//   - GitHub Actions: daily-maintenance.yml
//   - 本地：node scripts/generate-system-health.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.join(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, 'brain');
const OUT_PATH  = path.join(BRAIN_DIR, 'system-health.json');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

const now    = new Date();
const nowISO = now.toISOString();
const nowBJ  = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
                 .replace('T', ' ').slice(0, 19) + '+08:00';

// ── 巡检 brain/ 目录完整性 ──

function checkBrainIntegrity() {
  const required = [
    'master-brain.md',
    'read-order.md',
    'repo-map.json',
    'automation-map.json',
    'communication-map.json',
    'id-map.json',
    'system-health.json'
  ];

  const missing = [];
  const present = [];

  for (const file of required) {
    const filePath = path.join(BRAIN_DIR, file);
    if (fs.existsSync(filePath)) {
      present.push(file);
    } else {
      missing.push(file);
    }
  }

  return {
    complete: missing.length === 0,
    total: required.length,
    present: present.length,
    missing
  };
}

// ── 检查 workflow 目录 ──

function checkWorkflows() {
  const wfDir = path.join(ROOT, '.github/workflows');
  try {
    const files = fs.readdirSync(wfDir).filter(f => f.endsWith('.yml'));
    return { count: files.length, status: files.length > 0 ? 'stable' : 'warning' };
  } catch {
    return { count: 0, status: 'error' };
  }
}

// ── 主生成 ──

function generate() {
  if (!fs.existsSync(BRAIN_DIR)) fs.mkdirSync(BRAIN_DIR, { recursive: true });

  const brainCheck = checkBrainIntegrity();
  const wfCheck = checkWorkflows();

  const health = {
    version: '4.0',
    last_check: nowBJ,
    communication: 'synced',
    automation: wfCheck.status,
    maintenance_agent: 'active',
    system_health: brainCheck.complete ? 'normal' : 'warning',
    brain_integrity: brainCheck,
    workflow_count: wfCheck.count,
    checked_by: 'scripts/generate-system-health.js'
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(health, null, 2));
  console.log(`✅ system-health.json 已更新 · brain完整性: ${brainCheck.present}/${brainCheck.total} · 工作流: ${wfCheck.count}`);

  if (brainCheck.missing.length > 0) {
    console.log(`⚠️  缺失文件: ${brainCheck.missing.join(', ')}`);
  }
}

generate();
