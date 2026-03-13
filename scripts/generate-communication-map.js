// scripts/generate-communication-map.js
// 铸渊通信结构地图生成器 · Communication Map Generator
//
// 功能：
//   1. 扫描 Notion → Repository 通信入口
//   2. 扫描 Repository 内部通信结构
//   3. 生成 brain/communication-map.json
//
// 触发方式：
//   - GitHub Actions: daily-maintenance-agent.yml
//   - 本地：node scripts/generate-communication-map.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const WF_DIR      = path.join(ROOT, '.github/workflows');
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const BRAIN_DIR   = path.join(ROOT, 'brain');
const OUTPUT_PATH = path.join(BRAIN_DIR, 'communication-map.json');

const now    = new Date();
const nowISO = now.toISOString();

// ── 工具函数 ────────────────────────────────────────────────────────────────

function listFiles(dir, ext) {
  try {
    return fs.readdirSync(dir)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.'));
  } catch { return []; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function readContent(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

// ── 扫描 Notion 通信入口 ───────────────────────────────────────────────────

function scanNotionChannels() {
  const channels = [];

  // Scan workflows for Notion-related triggers
  const wfFiles = listFiles(WF_DIR, '.yml');
  for (const wf of wfFiles) {
    const content = readContent(path.join(WF_DIR, wf));
    if (content.includes('notion') || content.includes('NOTION')) {
      const nameMatch = content.match(/^name:\s*(.+)/m);
      channels.push({
        type:      'workflow',
        file:      `.github/workflows/${wf}`,
        name:      nameMatch ? nameMatch[1].trim() : wf,
        direction: content.includes('repository_dispatch') ? 'notion→repo' : 'repo→notion'
      });
    }
  }

  // Scan scripts for Notion integration
  const scripts = listFiles(SCRIPTS_DIR, '.js');
  for (const s of scripts) {
    const content = readContent(path.join(SCRIPTS_DIR, s));
    if (content.includes('notion') || content.includes('NOTION')) {
      channels.push({
        type:      'script',
        file:      `scripts/${s}`,
        direction: content.includes('create') || content.includes('push') ? 'repo→notion' : 'notion→repo'
      });
    }
  }

  return channels;
}

// ── 扫描 API 通信桥 ────────────────────────────────────────────────────────

function scanAPIBridge() {
  const bridges = [];

  // Check backend service entries
  const apiEntries = [
    { file: 'backend/server.js',            name: 'Express 后端 API',  port: 3000 },
    { file: 'src/index.js',                 name: 'HLI 中间件',       port: 3001 },
    { file: 'persona-studio/backend/server.js', name: 'Persona Studio', port: 3002 },
    { file: 'backend-integration/api-proxy.js', name: 'AI Chat Proxy',  port: 3721 }
  ];

  for (const entry of apiEntries) {
    if (fileExists(path.join(ROOT, entry.file))) {
      bridges.push({
        type:   'api-service',
        file:   entry.file,
        name:   entry.name,
        port:   entry.port,
        status: 'active'
      });
    }
  }

  return bridges;
}

// ── 扫描数据同步通道 ───────────────────────────────────────────────────────

function scanSyncChannels() {
  const channels = [];

  // Brain sync
  if (fileExists(path.join(WF_DIR, 'brain-sync.yml'))) {
    channels.push({
      name:      '大脑同步',
      workflow:  'brain-sync.yml',
      direction: 'bidirectional',
      data:      ['.github/brain/', '.github/persona-brain/']
    });
  }

  // Signal processing
  if (fileExists(path.join(WF_DIR, 'esp-signal-processor.yml'))) {
    channels.push({
      name:      '信号处理',
      workflow:  'esp-signal-processor.yml',
      direction: 'inbound',
      data:      ['signal-log/']
    });
  }

  // Broadcast distribution
  if (fileExists(path.join(WF_DIR, 'distribute-broadcasts.yml'))) {
    channels.push({
      name:      '广播分发',
      workflow:  'distribute-broadcasts.yml',
      direction: 'outbound',
      data:      ['broadcasts-outbox/', 'dev-nodes/']
    });
  }

  // SYSLOG pipeline
  if (fileExists(path.join(WF_DIR, 'syslog-pipeline.yml'))) {
    channels.push({
      name:      'SYSLOG 管线',
      workflow:  'syslog-pipeline.yml',
      direction: 'inbound',
      data:      ['syslog-inbox/', 'syslog-processed/']
    });
  }

  // Deploy pipeline
  if (fileExists(path.join(WF_DIR, 'deploy-to-server.yml'))) {
    channels.push({
      name:      '部署管线',
      workflow:  'deploy-to-server.yml',
      direction: 'outbound',
      data:      ['服务器部署']
    });
  }

  return channels;
}

// ── 主生成逻辑 ──────────────────────────────────────────────────────────────

function generate() {
  if (!fs.existsSync(BRAIN_DIR)) {
    fs.mkdirSync(BRAIN_DIR, { recursive: true });
  }

  const notionChannels = scanNotionChannels();
  const apiBridges     = scanAPIBridge();
  const syncChannels   = scanSyncChannels();

  const communicationMap = {
    description:  '数字地球系统通信结构地图 · Communication Map',
    version:      '4.0',
    generated_at: nowISO,
    generated_by: 'scripts/generate-communication-map.js',
    architecture: {
      layers: [
        { id: 'observation',  name: '观察层', system: '零点原核频道' },
        { id: 'core_brain',   name: '核心大脑', system: 'Notion 系统' },
        { id: 'execution',    name: '执行层', system: 'Repository 系统' }
      ],
      communication_path: [
        '零点原核（观察层）',
        'Notion 核心大脑（调度中心）',
        'API 通信桥',
        'Repository 执行层',
        '自动化执行',
        '系统日志',
        '回报 Notion 大脑'
      ],
      principle: '观察层不直接控制执行层。所有任务必须通过核心大脑调度。'
    },
    stats: {
      notion_channels:  notionChannels.length,
      api_bridges:      apiBridges.length,
      sync_channels:    syncChannels.length,
      total_channels:   notionChannels.length + apiBridges.length + syncChannels.length
    },
    notion_channels: notionChannels,
    api_bridges:     apiBridges,
    sync_channels:   syncChannels,
    task_format: {
      description: '统一任务通信格式',
      fields: {
        task_type:  'broadcast | instruction | maintenance',
        source:     'notion | zero-point | system',
        target:     'zhuyuan | shuangyan | system',
        task_name:  '任务名称',
        id:         'TASK-YYYYMMDD-NNN',
        timestamp:  'ISO 8601'
      }
    }
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(communicationMap, null, 2));
  console.log(`✅ communication-map.json 已生成 · ${communicationMap.stats.total_channels} 个通信通道`);
  return communicationMap;
}

generate();
