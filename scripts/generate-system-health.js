// scripts/generate-system-health.js
// 铸渊系统健康状态生成器 · System Health Generator
//
// 功能：
//   1. 检查仓库结构完整性
//   2. 检查大脑文件完整性
//   3. 检查自动化状态
//   4. 生成 brain/system-health.json
//
// 触发方式：
//   - GitHub Actions: daily-maintenance-agent.yml
//   - 本地：node scripts/generate-system-health.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '..');
const BRAIN_DIR  = path.join(ROOT, 'brain');
const GH_BRAIN   = path.join(ROOT, '.github/brain');
const WF_DIR     = path.join(ROOT, '.github/workflows');
const OUTPUT_PATH = path.join(BRAIN_DIR, 'system-health.json');

const now    = new Date();
const nowISO = now.toISOString();

// ── 工具函数 ────────────────────────────────────────────────────────────────

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function safeReadJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.'));
  } catch { return []; }
}

// ── 大脑文件完整性检查 ──────────────────────────────────────────────────────

function checkBrainIntegrity() {
  const requiredFiles = [
    { path: '.github/brain/memory.json',       name: '核心记忆' },
    { path: '.github/brain/routing-map.json',   name: 'HLI路由映射' },
    { path: '.github/brain/repo-map.json',      name: '仓库地图' },
    { path: '.github/brain/wake-protocol.md',   name: '唤醒协议' },
    { path: 'brain/master-brain.md',            name: '执行层主控大脑' },
    { path: 'brain/read-order.md',              name: '读取顺序' },
    { path: 'brain/id-map.json',                name: '统一编号体系' }
  ];

  const results = [];
  let healthy = 0;

  for (const file of requiredFiles) {
    const exists = fileExists(path.join(ROOT, file.path));
    let valid = false;

    if (exists && file.path.endsWith('.json')) {
      valid = safeReadJson(path.join(ROOT, file.path)) !== null;
    } else {
      valid = exists;
    }

    results.push({
      file:   file.path,
      name:   file.name,
      exists,
      valid,
      status: exists && valid ? '✅' : exists ? '⚠️' : '❌'
    });

    if (exists && valid) healthy++;
  }

  return {
    status:  healthy === requiredFiles.length ? 'green' : healthy > requiredFiles.length / 2 ? 'yellow' : 'red',
    total:   requiredFiles.length,
    healthy,
    files:   results
  };
}

// ── 仓库结构完整性检查 ──────────────────────────────────────────────────────

function checkStructureIntegrity() {
  const requiredDirs = [
    { path: 'brain',           name: '执行层核心入口' },
    { path: '.github/brain',   name: '铸渊大脑' },
    { path: '.github/workflows', name: '工作流' },
    { path: 'scripts',        name: '执行脚本' },
    { path: 'src',            name: 'HLI源码' },
    { path: 'backend',        name: 'Express后端' },
    { path: 'syslog',         name: '系统日志' },
    { path: 'dev-nodes',      name: '开发者节点' }
  ];

  const results = [];
  let healthy = 0;

  for (const dir of requiredDirs) {
    const exists = dirExists(path.join(ROOT, dir.path));
    results.push({
      path:   dir.path,
      name:   dir.name,
      exists,
      status: exists ? '✅' : '❌'
    });
    if (exists) healthy++;
  }

  return {
    status: healthy === requiredDirs.length ? 'green' : healthy > requiredDirs.length / 2 ? 'yellow' : 'red',
    total:  requiredDirs.length,
    healthy,
    directories: results
  };
}

// ── 自动化状态检查 ──────────────────────────────────────────────────────────

function checkAutomationStatus() {
  const workflows = listFiles(WF_DIR, '.yml');
  const scripts   = listFiles(path.join(ROOT, 'scripts'), '.js');

  return {
    status:          'green',
    total_workflows: workflows.length,
    total_scripts:   scripts.length,
    key_workflows: {
      daily_maintenance:  workflows.includes('daily-maintenance-agent.yml') ? 'active' : 'missing',
      repo_map_update:    workflows.includes('update-repo-map.yml') ? 'active' : 'missing',
      psp_inspection:     workflows.includes('psp-daily-inspection.yml') ? 'active' : 'missing',
      deploy:             workflows.includes('deploy-to-server.yml') ? 'active' : 'missing',
      brain_sync:         workflows.includes('brain-sync.yml') ? 'active' : 'missing'
    }
  };
}

// ── API 通信状态检查 ────────────────────────────────────────────────────────

function checkCommunicationStatus() {
  const services = [
    { file: 'src/index.js',                       name: 'HLI 中间件',    port: 3001 },
    { file: 'backend/server.js',                   name: 'Express 后端',  port: 3000 },
    { file: 'persona-studio/backend/server.js',    name: 'Persona Studio', port: 3002 },
    { file: 'backend-integration/api-proxy.js',    name: 'AI Chat Proxy', port: 3721 }
  ];

  const results = [];
  for (const svc of services) {
    const exists = fileExists(path.join(ROOT, svc.file));
    results.push({
      name:   svc.name,
      file:   svc.file,
      port:   svc.port,
      status: exists ? 'configured' : 'missing'
    });
  }

  return {
    status:   results.every(r => r.status === 'configured') ? 'green' : 'yellow',
    services: results
  };
}

// ── 主生成逻辑 ──────────────────────────────────────────────────────────────

function generate() {
  if (!fs.existsSync(BRAIN_DIR)) {
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
  }

  const brainIntegrity     = checkBrainIntegrity();
  const structureIntegrity = checkStructureIntegrity();
  const automationStatus   = checkAutomationStatus();
  const communicationStatus = checkCommunicationStatus();

  // Determine overall status
  const statuses = [
    brainIntegrity.status,
    structureIntegrity.status,
    automationStatus.status,
    communicationStatus.status
  ];
  let overallStatus = 'green';
  if (statuses.includes('red'))    overallStatus = 'red';
  else if (statuses.includes('yellow')) overallStatus = 'yellow';

  const systemHealth = {
    description:  '数字地球系统健康状态 · System Health',
    version:      '4.0',
    generated_at: nowISO,
    generated_by: 'scripts/generate-system-health.js',
    overall_status: overallStatus,
    overall_emoji:  overallStatus === 'green' ? '🟢' : overallStatus === 'yellow' ? '🟡' : '🔴',
    subsystems: {
      brain_integrity:      brainIntegrity,
      structure_integrity:  structureIntegrity,
      automation:           automationStatus,
      communication:        communicationStatus
    },
    system_state: {
      execution_layer:    'synced',
      communication:      'synced',
      automation:         'stable',
      maintenance_agent:  'active',
      system_version:     '4.0'
    },
    recent_checks: [],
    errors: []
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(systemHealth, null, 2));
  console.log(`✅ system-health.json 已生成 · 状态: ${systemHealth.overall_emoji} ${overallStatus}`);
  return systemHealth;
}

generate();
