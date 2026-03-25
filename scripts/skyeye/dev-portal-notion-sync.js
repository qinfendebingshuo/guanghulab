#!/usr/bin/env node
// scripts/skyeye/dev-portal-notion-sync.js
// 开发者门户 · Notion 动态同步
//
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
//
// 目的：将开发者频道部署动态同步到 Notion 画像数据库
// 铁律（与 write-receipt-to-notion.js 一致）：
//   1. 写入失败不阻塞主流程
//   2. 同一事件幂等
//   3. 失败时写入本地 SYSLOG
//
// 环境变量：
//   NOTION_API_KEY    — Notion API 密钥（必须）
//   DEV_PROFILE_DB_ID — 开发者画像数据库 ID（必须）
//
// 参数：
//   --dev-ids "DEV-001,DEV-002"  — 涉及的开发者编号
//   --action "channel_deploy"    — 操作类型
//   --timestamp "ISO-8601"       — 时间戳

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOTION_API_KEY = process.env.NOTION_API_KEY || '';
const DEV_PROFILE_DB_ID = process.env.DEV_PROFILE_DB_ID || '';
const ROOT = path.resolve(__dirname, '../..');
const SYSLOG_DIR = path.join(ROOT, 'data/neural-reports/syslog');

// ━━━ 参数解析 ━━━
function parseArgs() {
  const args = process.argv.slice(2);
  const result = { devIds: [], action: 'unknown', timestamp: new Date().toISOString() };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dev-ids' && args[i + 1]) {
      result.devIds = args[++i].split(',').filter(Boolean);
    } else if (args[i] === '--action' && args[i + 1]) {
      result.action = args[++i];
    } else if (args[i] === '--timestamp' && args[i + 1]) {
      result.timestamp = args[++i];
    }
  }

  return result;
}

// ━━━ 加载门禁配置获取开发者信息 ━━━
function loadDevInfo(devId) {
  try {
    const configPath = path.join(ROOT, '.github/persona-brain/gate-guard-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const dev = config.developer_permissions && config.developer_permissions[devId];
    return dev || null;
  } catch (e) {
    return null;
  }
}

// ━━━ Notion API 请求 ━━━
function notionRequest(endpoint, body) {
  return new Promise(function(resolve, reject) {
    if (!NOTION_API_KEY) {
      reject(new Error('NOTION_API_KEY 未配置'));
      return;
    }

    const data = JSON.stringify(body);
    const options = {
      hostname: 'api.notion.com',
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_API_KEY,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, function(res) {
      let body = '';
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error('Notion API ' + res.statusCode + ': ' + body.slice(0, 200)));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, function() { req.destroy(new Error('Notion API timeout')); });
    req.write(data);
    req.end();
  });
}

// ━━━ 写入 SYSLOG ━━━
function writeSyslog(entry) {
  try {
    if (!fs.existsSync(SYSLOG_DIR)) fs.mkdirSync(SYSLOG_DIR, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    const logPath = path.join(SYSLOG_DIR, 'dev-portal-sync-' + date + '.jsonl');
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n');
  } catch (e) {
    console.error('SYSLOG写入失败:', e.message);
  }
}

// ━━━ 同步单个开发者动态到 Notion ━━━
async function syncDevActivity(devId, action, timestamp) {
  const devInfo = loadDevInfo(devId);

  const properties = {
    '开发者编号': { title: [{ text: { content: devId } }] },
    '开发者姓名': { rich_text: [{ text: { content: devInfo ? devInfo.name : devId } }] },
    '人格体编号': { rich_text: [{ text: { content: devInfo ? devInfo.persona_id : '—' } }] },
    '操作类型': { select: { name: action } },
    '操作时间': { date: { start: timestamp } },
    '门户频道': { rich_text: [{ text: { content: 'channels/' + devId + '/' } }] }
  };

  try {
    await notionRequest('/v1/pages', {
      parent: { database_id: DEV_PROFILE_DB_ID },
      properties: properties
    });
    console.log('  ✅ ' + devId + ' 同步成功');
    return true;
  } catch (e) {
    console.error('  ⚠️ ' + devId + ' 同步失败: ' + e.message);
    writeSyslog({
      time: new Date().toISOString(),
      type: 'notion_sync_error',
      dev_id: devId,
      error: e.message
    });
    return false;
  }
}

// ━━━ 主逻辑 ━━━
async function main() {
  const args = parseArgs();

  console.log('📡 开发者门户 · Notion 动态同步');
  console.log('   开发者: ' + (args.devIds.join(', ') || '无'));
  console.log('   操作: ' + args.action);
  console.log('   时间: ' + args.timestamp);
  console.log('');

  if (args.devIds.length === 0) {
    console.log('⚠️ 无开发者编号，跳过同步');
    process.exit(0);
  }

  if (!NOTION_API_KEY || !DEV_PROFILE_DB_ID) {
    console.log('⚠️ Notion 配置缺失 (NOTION_API_KEY / DEV_PROFILE_DB_ID)');
    console.log('   动态将写入本地 SYSLOG');
    writeSyslog({
      time: args.timestamp,
      type: 'channel_deploy',
      dev_ids: args.devIds,
      action: args.action,
      note: 'Notion未配置，写入本地'
    });
    process.exit(0);
  }

  let success = 0;
  for (const devId of args.devIds) {
    const ok = await syncDevActivity(devId, args.action, args.timestamp);
    if (ok) success++;
  }

  console.log('');
  console.log('同步结果: ' + success + '/' + args.devIds.length + ' 成功');
}

main().catch(function(e) {
  console.error('❌ 同步异常: ' + e.message);
  writeSyslog({ time: new Date().toISOString(), type: 'sync_crash', error: e.message });
  // Non-fatal — don't block the deploy
  process.exit(0);
});
