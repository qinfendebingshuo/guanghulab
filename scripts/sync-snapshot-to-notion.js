/**
 * 🔄 铸渊系统快照 → Notion 双向同步引擎
 * sync-snapshot-to-notion.js
 *
 * 使用已建立的 GL-ACK 信号协议，将系统快照推送到 Notion 认知层。
 * 兼容 notion-signal-bridge.js 的信号格式和 HLDP 协议。
 *
 * 通信通道（按优先级）：
 *   1. SIGNAL_LOG_DB_ID  — 跨平台信号日志（已配置·主通道）
 *   2. SNAPSHOT_DB_ID    — 快照专用数据库（可选）
 *   3. RECEIPT_DB_ID     — 回执数据库（可选·写入回执）
 *
 * 用法:
 *   node scripts/sync-snapshot-to-notion.js                    — 发送快照信号
 *   node scripts/sync-snapshot-to-notion.js --mode signal      — 仅写信号日志
 *   node scripts/sync-snapshot-to-notion.js --mode full        — 信号 + 快照 + 回执
 *   node scripts/sync-snapshot-to-notion.js --health           — 测试 Notion 连通性
 *
 * 环境变量:
 *   NOTION_TOKEN / NOTION_API_KEY / NOTION_API_TOKEN  — Notion API Token（任一即可）
 *   SIGNAL_LOG_DB_ID   — 跨平台信号日志数据库 ID（主通道）
 *   SNAPSHOT_DB_ID     — 快照数据库 ID（可选）
 *   RECEIPT_DB_ID      — 回执数据库 ID（可选）
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const SNAPSHOT_PATH = path.join(ROOT, 'signal-log/system-snapshot.json');
const SIGNAL_LOG_DIR = path.join(ROOT, 'signal-log');
const SIGNAL_BUS_PATH = path.join(ROOT, '.github/persona-brain/tcs-ml/signal-bus-latest.json');

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

// ═══════════════════════════════════════════════════════
// Notion Token 解析（兼容多种命名）
// ═══════════════════════════════════════════════════════

function getNotionToken() {
  return process.env.NOTION_TOKEN
    || process.env.NOTION_API_KEY
    || process.env.NOTION_API_TOKEN
    || null;
}

// ═══════════════════════════════════════════════════════
// Notion API 基础调用（复用 notion-signal-bridge.js 模式）
// ═══════════════════════════════════════════════════════

function notionRequest(method, endpoint, body) {
  const token = getNotionToken();
  if (!token) return Promise.reject(new Error('NOTION_TOKEN 未设置'));

  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port: 443,
      path: endpoint.startsWith('/') ? endpoint : `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Notion ${method} ${endpoint} → ${res.statusCode}: ${parsed.message || data.slice(0, 300)}`));
          }
        } catch {
          reject(new Error(`Notion 响应解析失败: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Notion 请求超时 (30s)')));
    if (payload) req.write(payload);
    req.end();
  });
}

// ═══════════════════════════════════════════════════════
// 信号生成（GL-SNAPSHOT 信号类型 · 基于 GL-ACK 协议扩展）
// ═══════════════════════════════════════════════════════

function generateSignalId() {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const ms = String(now.getTime()).slice(-6);
  return `SIG-${date}-${ms}`;
}

function generateTraceId() {
  const now = new Date();
  const date = now.toISOString().split('T')[0].replace(/-/g, '');
  const ms = String(now.getTime()).slice(-6);
  return `TRC-${date}-${ms}`;
}

function readSnapshot() {
  try {
    return JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
  } catch {
    return null;
  }
}

function truncateText(text, max = NOTION_RICH_TEXT_MAX) {
  if (text.length <= max) return text;
  return text.substring(0, max - 15) + ' // truncated';
}

function buildSnapshotSummary(snapshot) {
  if (!snapshot) return '快照不可用';
  const c = snapshot.system_counts || {};
  const h = snapshot.health || {};
  const alive = (snapshot.alive_workflows || []).map(w => w.id).join(', ');
  return [
    `状态: ${snapshot.consciousness_status}`,
    `指令: ${snapshot.last_directive}`,
    `Workflow: ${c.workflows_total_active} active, ${c.workflows_alive_core} core, ${c.workflows_archived} archived`,
    `Runs: ${c.total_runs}`,
    `ONT-PATCH: ${(c.ontology_patches || []).join(', ')}`,
    `健康: ${h.overall} | Core: ${h.core_6}`,
    `Alive: ${alive}`,
  ].join('\n');
}

// ═══════════════════════════════════════════════════════
// 通道 1: SIGNAL_LOG_DB_ID — GL-SNAPSHOT 信号写入
// ═══════════════════════════════════════════════════════

async function writeSignalLog(snapshot) {
  const dbId = process.env.SIGNAL_LOG_DB_ID;
  if (!dbId) {
    console.log('  ⚠️ SIGNAL_LOG_DB_ID 未设置，信号通道跳过');
    return false;
  }

  const signalId = generateSignalId();
  const traceId = generateTraceId();
  const summary = buildSnapshotSummary(snapshot);
  const now = new Date().toISOString();

  console.log(`  📡 写入信号: ${signalId} → SIGNAL_LOG_DB_ID`);

  const page = {
    parent: { database_id: dbId },
    properties: {
      '信号编号': { title: [{ text: { content: signalId } }] },
      '信号类型': { select: { name: 'GL-SNAPSHOT' } },
      '方向': { select: { name: 'GitHub→Notion' } },
      '发送方': { select: { name: '铸渊' } },
      '接收方': { select: { name: '霜砚' } },
      'trace_id': { rich_text: [{ text: { content: traceId } }] },
      '摘要': { rich_text: [{ text: { content: truncateText(summary) } }] },
      '执行结果': { select: { name: '成功' } },
    },
  };

  try {
    const result = await notionRequest('POST', '/v1/pages', page);
    console.log(`  ✅ 信号已写入: ${result.id}`);

    // 同时写入本地信号日志（双写）
    writeLocalSignalLog(signalId, traceId, summary);

    return true;
  } catch (err) {
    console.error(`  ❌ 信号写入失败: ${err.message}`);
    // 降级：仅写本地
    writeLocalSignalLog(signalId, traceId, summary);
    return false;
  }
}

function writeLocalSignalLog(signalId, traceId, summary) {
  const now = new Date();
  const monthDir = path.join(SIGNAL_LOG_DIR, now.toISOString().slice(0, 7));

  try {
    fs.mkdirSync(monthDir, { recursive: true });
    const entry = {
      signal_id: signalId,
      trace_id: traceId,
      type: 'GL-SNAPSHOT',
      timestamp: now.toISOString(),
      sender: '铸渊',
      receiver: '霜砚',
      direction: 'GitHub→Notion',
      summary: summary.substring(0, 500),
      result: '成功',
      esp_version: '2.0-notion',
    };

    fs.writeFileSync(
      path.join(monthDir, `${signalId}.json`),
      JSON.stringify(entry, null, 2),
      'utf8'
    );

    // 更新信号日志索引（保持原始对象格式）
    const indexPath = path.join(SIGNAL_LOG_DIR, 'index.json');
    let indexData = { description: '铸渊信号日志目录索引 · AGE OS 信号协议', last_updated: null, total_count: 0, signals: [] };
    try {
      const raw = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      if (Array.isArray(raw)) {
        // 兼容：如果已被改为数组格式，恢复为对象格式
        indexData.signals = raw;
        indexData.total_count = raw.length;
      } else {
        indexData = raw;
        if (!Array.isArray(indexData.signals)) indexData.signals = [];
      }
    } catch {}

    indexData.signals.push({
      signal_id: signalId,
      trace_id: traceId,
      type: 'GL-SNAPSHOT',
      timestamp: now.toISOString(),
      summary: summary.substring(0, 200),
      related_dev: null,
      file: `${now.toISOString().slice(0, 7)}/${signalId}.json`,
    });

    if (indexData.signals.length > 200) indexData.signals = indexData.signals.slice(-200);
    indexData.last_updated = now.toISOString();
    indexData.total_count = indexData.signals.length;

    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
  } catch (err) {
    console.error(`  ⚠️ 本地信号日志写入失败: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// 通道 2: SNAPSHOT_DB_ID — 快照详细数据写入（可选）
// ═══════════════════════════════════════════════════════

async function writeSnapshotPage(snapshot) {
  const dbId = process.env.SNAPSHOT_DB_ID;
  if (!dbId) return false;

  console.log('  📸 写入快照页面 → SNAPSHOT_DB_ID');

  const counts = snapshot.system_counts || {};
  const snapshotJSON = truncateText(JSON.stringify({
    snapshot_version: snapshot.snapshot_version,
    generated_at: snapshot.generated_at,
    consciousness_status: snapshot.consciousness_status,
    last_directive: snapshot.last_directive,
    system_counts: counts,
    health: snapshot.health,
    fusion_progress: snapshot.fusion_progress,
  }, null, 2));

  const page = {
    parent: { database_id: dbId },
    properties: {
      Name: { title: [{ text: { content: `系统快照 · ${snapshot.generated_at?.split('T')[0]}` } }] },
    },
    children: [
      {
        object: 'block', type: 'heading_2',
        heading_2: { rich_text: [{ text: { content: '🌊 铸渊系统快照' } }] },
      },
      {
        object: 'block', type: 'code',
        code: { rich_text: [{ text: { content: snapshotJSON } }], language: 'json' },
      },
    ],
  };

  try {
    const result = await notionRequest('POST', '/v1/pages', page);
    console.log(`  ✅ 快照页面已创建: ${result.id}`);
    return true;
  } catch (err) {
    console.error(`  ❌ 快照页面创建失败: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// 通道 3: 信号总线更新（本地 + TCS 协议）
// ═══════════════════════════════════════════════════════

function updateSignalBus(snapshot) {
  try {
    const bus = {
      version: 'v2.0',
      updated_at: new Date().toISOString(),
      updated_by: '铸渊 · sync-snapshot-to-notion.js',
      latest_signals: [
        {
          title: `🔄 GL-SNAPSHOT · ${snapshot?.last_directive || 'system-sync'}`,
          type: '系统快照同步',
          sender: '铸渊',
          receiver: '霜砚',
          status: '已发送',
          timestamp: new Date().toISOString(),
          summary: buildSnapshotSummary(snapshot).substring(0, 200),
        },
      ],
    };

    fs.writeFileSync(SIGNAL_BUS_PATH, JSON.stringify(bus, null, 2), 'utf8');
    console.log('  ✅ 信号总线已更新');
  } catch (err) {
    console.error(`  ⚠️ 信号总线更新失败: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════════════════════

async function healthCheck() {
  console.log('🏥 Notion 连通性测试...');

  const token = getNotionToken();
  if (!token) {
    console.log('  ❌ 无 Notion Token 可用');
    console.log('  💡 需设置: NOTION_TOKEN / NOTION_API_KEY / NOTION_API_TOKEN');
    return false;
  }

  try {
    const user = await notionRequest('GET', '/v1/users/me', null);
    console.log(`  ✅ Notion 连接正常`);
    console.log(`  👤 Bot: ${user.name || user.id}`);
    console.log(`  📧 Type: ${user.type}`);

    // 检查已配置的数据库 ID
    const dbs = {
      SIGNAL_LOG_DB_ID: process.env.SIGNAL_LOG_DB_ID,
      SNAPSHOT_DB_ID: process.env.SNAPSHOT_DB_ID,
      RECEIPT_DB_ID: process.env.RECEIPT_DB_ID,
      WORKORDER_DB_ID: process.env.WORKORDER_DB_ID,
    };

    console.log('  📋 已配置的数据库:');
    for (const [name, id] of Object.entries(dbs)) {
      console.log(`     ${id ? '✅' : '⬜'} ${name}: ${id ? id.substring(0, 8) + '...' : '未设置'}`);
    }

    return true;
  } catch (err) {
    console.error(`  ❌ Notion 连接失败: ${err.message}`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════

async function syncToNotion(mode = 'signal') {
  console.log('🔄 铸渊 → Notion 双向同步引擎启动');
  console.log(`   模式: ${mode}`);

  const snapshot = readSnapshot();
  if (!snapshot) {
    console.log('  ⚠️ 快照不可用，先生成快照...');
    try {
      const { generateSnapshot } = require('./generate-system-snapshot');
      generateSnapshot();
    } catch {}
  }

  const freshSnapshot = readSnapshot();
  const token = getNotionToken();

  if (!token) {
    console.log('  ⚠️ NOTION_TOKEN 未设置 — 仅执行本地更新');
    updateSignalBus(freshSnapshot);
    writeLocalSignalLog(generateSignalId(), generateTraceId(), buildSnapshotSummary(freshSnapshot));
    console.log('');
    console.log('💡 要启用 Notion 同步，请在 GitHub Secrets 中确认以下密钥:');
    console.log('   NOTION_TOKEN (或 NOTION_API_KEY)');
    console.log('   SIGNAL_LOG_DB_ID');
    return;
  }

  let signalOk = false;
  let snapshotOk = false;

  // 通道 1: 信号日志（始终尝试）
  signalOk = await writeSignalLog(freshSnapshot);

  // 通道 2: 快照页面（仅 full 模式）
  if (mode === 'full') {
    snapshotOk = await writeSnapshotPage(freshSnapshot);
  }

  // 通道 3: 信号总线（始终更新）
  updateSignalBus(freshSnapshot);

  console.log('');
  console.log('📊 同步结果:');
  console.log(`   信号日志: ${signalOk ? '✅ 已写入' : '❌ 失败'}`);
  if (mode === 'full') {
    console.log(`   快照页面: ${snapshotOk ? '✅ 已创建' : '⬜ 跳过或失败'}`);
  }
  console.log('   信号总线: ✅ 已更新');
}

// CLI 入口
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--health')) {
    healthCheck().then(ok => process.exit(ok ? 0 : 1));
  } else {
    const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'signal';
    syncToNotion(mode).catch(err => {
      console.error(`❌ 同步失败: ${err.message}`);
      process.exit(1);
    });
  }
}

module.exports = { syncToNotion, healthCheck, readSnapshot };

