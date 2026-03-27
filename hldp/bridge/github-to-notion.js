/**
 * ━━━ HLDP GitHub → Notion 转换器 ━━━
 * TCS 通感语言核系统编程语言 · 第一个落地协议层
 * HLDP = TCS 在 Notion ↔ GitHub 通道上的落地实现
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 * 指令来源：SY-CMD-BRG-005 → SY-CMD-FUS-009
 *
 * 功能：
 *   将 hldp/data/ 中的 HLDP JSON 文件转换为 Notion 页面属性，
 *   通过 Notion API 写入对应数据库，实现 GitHub → Notion 反向同步。
 *
 * 这是 HLDP 协议的反向通道 —— notion-to-hldp.js 的镜像。
 * 两个文件共同构成 HLDP 的完整双向通信能力。
 *
 * 用法：
 *   node github-to-notion.js --scope all
 *   node github-to-notion.js --scope snapshots
 *   node github-to-notion.js --file hldp/data/snapshots/SNAP-20260327.json
 *
 * 环境变量：
 *   NOTION_TOKEN / NOTION_API_KEY  — Notion Integration Token
 *   SIGNAL_LOG_DB_ID              — 信号日志数据库（snapshot/signal 写入通道）
 *   WORKORDER_DB_ID               — 工单簿（回执通道）
 *   RECEIPT_DB_ID                 — 回执数据库
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'hldp', 'data');
const SYNC_LOG = path.join(ROOT, 'signal-log', 'hldp-sync-log.json');

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

// ═══════════════════════════════════════════════════════
// Notion API 调用（与 notion-signal-bridge.js 同一模式）
// ═══════════════════════════════════════════════════════

function getToken() {
  return process.env.NOTION_TOKEN
    || process.env.NOTION_API_KEY
    || process.env.NOTION_API_TOKEN
    || null;
}

function notionRequest(method, endpoint, body) {
  const token = getToken();
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
            reject(new Error(`Notion ${res.statusCode}: ${parsed.message || data.slice(0, 300)}`));
          }
        } catch {
          reject(new Error(`Notion 响应解析失败: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('Notion 请求超时')));
    if (payload) req.write(payload);
    req.end();
  });
}

function truncate(text, max = NOTION_RICH_TEXT_MAX) {
  if (!text) return '';
  const s = String(text);
  return s.length <= max ? s : s.substring(0, max - 10) + ' …(截断)';
}

// ═══════════════════════════════════════════════════════
// HLDP → Notion 属性转换
// ═══════════════════════════════════════════════════════

/**
 * 根据 HLDP data_type 确定目标 Notion 数据库 ID
 */
function resolveTargetDb(entry) {
  const type = entry.data_type;

  // snapshot 类型 → SIGNAL_LOG_DB_ID（信号日志通道）
  if (type === 'snapshot') {
    return process.env.SIGNAL_LOG_DB_ID || null;
  }

  // 其他类型的默认映射
  const mapping = {
    persona: process.env.SKYEYE_PERSONA_DB_ID || process.env.PORTRAIT_DB_ID,
    registry: process.env.SIGNAL_LOG_DB_ID,
    instruction: process.env.WORKORDER_DB_ID,
    broadcast: process.env.BROADCAST_DB_ID || process.env.SIGNAL_LOG_DB_ID,
    id_system: process.env.SIGNAL_LOG_DB_ID,
  };

  return mapping[type] || process.env.SIGNAL_LOG_DB_ID || null;
}

/**
 * 将 HLDP snapshot 转换为 Notion 信号日志页面
 */
function snapshotToNotionPage(entry, dbId) {
  const payload = entry.payload || {};
  const meta = entry.metadata || {};
  const counts = payload.system_counts || {};
  const health = payload.health || {};
  const fusion = payload.fusion_progress || {};

  // 构建摘要文本
  const summary = [
    `状态: ${payload.consciousness_status || 'unknown'}`,
    `指令: ${payload.last_directive || 'unknown'}`,
    `Workflow: ${counts.workflows_total_active || 0} active, ${counts.workflows_alive_core || 0} core, ${counts.workflows_archived || 0} archived`,
    `Runs: ${counts.total_runs || 0}`,
    `ONT-PATCH: ${(counts.ontology_patches || []).join(', ')}`,
    `健康: ${health.overall || 'unknown'} | Core: ${health.core_6 || 'unknown'}`,
    `融合: Phase1=${fusion.phase_1_absorb?.status || '?'}, Phase2=${fusion.phase_2_recover?.status || '?'}, Phase3=${fusion.phase_3_archive?.status || '?'}`,
  ].join('\n');

  return {
    parent: { database_id: dbId },
    properties: {
      '信号编号': { title: [{ text: { content: meta.id || `SNAP-${Date.now()}` } }] },
      '信号类型': { select: { name: 'GL-SNAPSHOT' } },
      '方向': { select: { name: 'GitHub→Notion' } },
      '发送方': { select: { name: '铸渊' } },
      '接收方': { select: { name: '霜砚' } },
      'trace_id': { rich_text: [{ text: { content: meta.id || '' } }] },
      '摘要': { rich_text: [{ text: { content: truncate(summary) } }] },
      '执行结果': { select: { name: '成功' } },
    },
  };
}

/**
 * 将通用 HLDP entry 转换为 Notion 信号日志页面
 */
function genericToNotionPage(entry, dbId) {
  const meta = entry.metadata || {};
  const payloadStr = truncate(JSON.stringify(entry.payload || {}, null, 2));

  return {
    parent: { database_id: dbId },
    properties: {
      '信号编号': { title: [{ text: { content: meta.id || `HLDP-${Date.now()}` } }] },
      '信号类型': { select: { name: `HLDP-${(entry.data_type || 'unknown').toUpperCase()}` } },
      '方向': { select: { name: 'GitHub→Notion' } },
      '发送方': { select: { name: '铸渊' } },
      '接收方': { select: { name: '霜砚' } },
      'trace_id': { rich_text: [{ text: { content: `HLDP-SYNC-${Date.now()}` } }] },
      '摘要': { rich_text: [{ text: { content: truncate(`[${entry.data_type}] ${meta.name || meta.id}\n${payloadStr}`) } }] },
      '执行结果': { select: { name: '成功' } },
    },
  };
}

/**
 * HLDP entry → Notion page（路由器）
 */
function hldpToNotionPage(entry, dbId) {
  if (entry.data_type === 'snapshot') {
    return snapshotToNotionPage(entry, dbId);
  }
  return genericToNotionPage(entry, dbId);
}

// ═══════════════════════════════════════════════════════
// 同步执行
// ═══════════════════════════════════════════════════════

/**
 * 推送单个 HLDP entry 到 Notion
 */
async function pushEntry(entry, filePath) {
  const dbId = resolveTargetDb(entry);
  if (!dbId) {
    console.log(`  ⚠️ 无目标数据库: ${entry.data_type} → 跳过 (${filePath || 'inline'})`);
    return { success: false, reason: 'no_target_db' };
  }

  const page = hldpToNotionPage(entry, dbId);

  try {
    const result = await notionRequest('POST', '/v1/pages', page);
    console.log(`  ✅ ${entry.metadata?.id || 'unknown'} → Notion (${result.id})`);
    return { success: true, notionPageId: result.id };
  } catch (err) {
    console.error(`  ❌ ${entry.metadata?.id || 'unknown'}: ${err.message}`);
    return { success: false, reason: err.message };
  }
}

/**
 * 扫描 hldp/data/ 并推送所有符合 scope 的 entry
 */
async function pushAll(scope) {
  const stats = { total: 0, pushed: 0, skipped: 0, errors: 0 };

  const scopeDirs = {
    all: ['personas', 'registries', 'instructions', 'broadcasts', 'id-system', 'snapshots'],
    snapshots: ['snapshots'],
    personas: ['personas'],
    registries: ['registries'],
  };

  const dirs = scopeDirs[scope] || scopeDirs.all;

  for (const dir of dirs) {
    const fullDir = path.join(DATA_DIR, dir);
    if (!fs.existsSync(fullDir)) continue;

    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      stats.total++;
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(fullDir, file), 'utf8'));
        if (!entry.hldp_version) { stats.skipped++; continue; }

        const result = await pushEntry(entry, path.join(dir, file));
        if (result.success) stats.pushed++;
        else stats.errors++;
      } catch (err) {
        console.error(`  ❌ ${file}: ${err.message}`);
        stats.errors++;
      }
    }
  }

  return stats;
}

/**
 * 推送单个文件到 Notion
 */
async function pushFile(filePath) {
  const absPath = path.resolve(ROOT, filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`❌ 文件不存在: ${absPath}`);
    return { success: false, reason: 'file_not_found' };
  }

  const entry = JSON.parse(fs.readFileSync(absPath, 'utf8'));
  return pushEntry(entry, filePath);
}

// ═══════════════════════════════════════════════════════
// 同步日志
// ═══════════════════════════════════════════════════════

function writeSyncLog(direction, scope, stats) {
  const log = {
    timestamp: new Date().toISOString(),
    direction,
    scope,
    stats,
    engine_version: '2.0',
  };

  fs.mkdirSync(path.dirname(SYNC_LOG), { recursive: true });

  let logs = [];
  try {
    const raw = fs.readFileSync(SYNC_LOG, 'utf8');
    logs = JSON.parse(raw);
    if (!Array.isArray(logs)) logs = [logs];
  } catch {}

  logs.push(log);
  if (logs.length > 100) logs = logs.slice(-100);

  fs.writeFileSync(SYNC_LOG, JSON.stringify(logs, null, 2), 'utf8');
}

// ═══════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════

async function run(scope, singleFile) {
  console.log('🔗 HLDP GitHub → Notion 同步引擎 v2.0');
  console.log(`   版权: 国作登字-2026-A-00037559`);

  const token = getToken();
  if (!token) {
    console.log('  ⚠️ NOTION_TOKEN 未设置 — 仅验证本地 HLDP 数据');
    const { validateDirectory } = require('./validator');
    const results = validateDirectory(DATA_DIR);
    console.log(`  📊 本地数据: ${results.total} entries, ${results.valid} valid, ${results.invalid} invalid`);
    writeSyncLog('github-to-notion', scope, { total: results.total, pushed: 0, validated: results.valid });
    return;
  }

  let stats;
  if (singleFile) {
    console.log(`   文件: ${singleFile}`);
    const result = await pushFile(singleFile);
    stats = { total: 1, pushed: result.success ? 1 : 0, errors: result.success ? 0 : 1 };
  } else {
    console.log(`   范围: ${scope}`);
    stats = await pushAll(scope);
  }

  writeSyncLog('github-to-notion', scope, stats);

  console.log('');
  console.log(`📊 同步结果: pushed=${stats.pushed} / total=${stats.total}, errors=${stats.errors}`);
}

// CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  let scope = 'all';
  let file = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--scope' && args[i + 1]) { scope = args[i + 1]; i++; }
    if (args[i] === '--file' && args[i + 1]) { file = args[i + 1]; i++; }
  }

  run(scope, file).catch(err => {
    console.error(`❌ 同步失败: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { pushEntry, pushAll, pushFile, hldpToNotionPage, resolveTargetDb };
