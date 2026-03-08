// scripts/notion-connectivity-test.js
// 铸渊 → Notion 连通性测试（YM-TEST-20260307-001）
//
// 用法：
//   node scripts/notion-connectivity-test.js
//
// 必需环境变量：
//   NOTION_TOKEN       Notion Integration Token（GitHub Secret）
//
// 可选环境变量（有内置默认值）：
//   SIGNAL_LOG_DB_ID   「📡 跨平台信号日志」database_id
//   CHANGES_DB_ID      「📋 GitHub 变更日志」database_id（默认已内置）
//   SYSLOG_DB_ID       「📥 GitHub SYSLOG 收件箱」database_id（默认已内置）

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION       = '2022-06-28';
const NOTION_API_HOSTNAME  = 'api.notion.com';

// Notion 数据库 ID（默认值与 notion-bridge.js / notion-signal-bridge.js 一致）
const DEFAULT_SYSLOG_DB_ID  = '330ab17507d542c9bbb96d0749b41197';
const DEFAULT_CHANGES_DB_ID = 'e740b77aa6bd4ac0a2e8a75f678fba98';

const SIGNAL_LOG_DIR   = path.join(__dirname, '../signal-log');
const SIGNAL_INDEX_PATH = path.join(SIGNAL_LOG_DIR, 'index.json');

// ══════════════════════════════════════════════════════════
// Notion API 基础调用（复用 notion-bridge.js 模式）
// ══════════════════════════════════════════════════════════

function notionPost(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length':  Buffer.byteLength(payload),
      },
    };

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ statusCode: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: null, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Notion API 请求超时')); });
    req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 本地信号日志（复用 notion-signal-bridge.js 模式）
// ══════════════════════════════════════════════════════════

function loadSignalIndex() {
  if (!fs.existsSync(SIGNAL_INDEX_PATH)) {
    return {
      description: '铸渊信号日志目录索引 · AGE OS 信号协议（Notion API 直连）',
      last_updated: new Date().toISOString(),
      total_count: 0,
      signals: []
    };
  }
  return JSON.parse(fs.readFileSync(SIGNAL_INDEX_PATH, 'utf8'));
}

function writeLocalSignalLog(signal) {
  const dateStr  = signal.timestamp.slice(0, 7);
  const monthDir = path.join(SIGNAL_LOG_DIR, dateStr);
  fs.mkdirSync(monthDir, { recursive: true });

  const filePath = path.join(monthDir, `${signal.signal_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(signal, null, 2));

  const index = loadSignalIndex();
  index.total_count += 1;
  index.signals.unshift({
    signal_id:   signal.signal_id,
    trace_id:    signal.trace_id,
    type:        signal.signal_type,
    timestamp:   signal.timestamp,
    summary:     signal.summary,
    related_dev: null,
    file:        `${dateStr}/${signal.signal_id}.json`
  });
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(SIGNAL_INDEX_PATH, JSON.stringify(index, null, 2));
}

// ══════════════════════════════════════════════════════════
// 三项连通性测试
// ══════════════════════════════════════════════════════════

async function testSignalLog(token, dbId) {
  return notionPost('/v1/pages', {
    parent: { database_id: dbId },
    properties: {
      '信号编号':  { title: [{ text: { content: 'SIG-TEST-20260307-001' } }] },
      '信号类型':  { select: { name: 'GL-ACK' } },
      '发送方':    { select: { name: '铸渊' } },
      '接收方':    { select: { name: '霜砚' } },
      '方向':      { select: { name: 'GitHub→Notion' } },
      '关联DEV':   { select: { name: '系统' } },
      '关联模块':  { select: { name: '全局' } },
      '执行结果':  { status: { name: '成功' } },
      '摘要':      { rich_text: [{ text: { content: '🧪 铸渊→Notion API 连通性测试 · NOTION_TOKEN 验证 · 数据桥首次握手' } }] },
      '备注':      { rich_text: [{ text: { content: '这是一条自动化测试信号。如果你在 Notion 信号日志里看到这条记录，说明 GitHub→Notion 数据桥已打通。' } }] }
    }
  }, token);
}

async function testChangeLog(token, dbId) {
  return notionPost('/v1/pages', {
    parent: { database_id: dbId },
    properties: {
      '标题':       { title: [{ text: { content: '🧪 连通性测试 · 铸渊首次握手 · 2026-03-07' } }] },
      '变更类型':   { select: { name: 'Commit' } },
      '提交者':     { select: { name: '铸渊' } },
      '分支':       { rich_text: [{ text: { content: 'main' } }] },
      'commit_sha': { rich_text: [{ text: { content: 'test-00000000' } }] },
      '变更文件':   { rich_text: [{ text: { content: '.github/test/bridge-connectivity-test.md' } }] },
      '霜砚已读':   { checkbox: false }
    }
  }, token);
}

async function testSyslogInbox(token, dbId) {
  return notionPost('/v1/pages', {
    parent: { database_id: dbId },
    properties: {
      '标题':       { title: [{ text: { content: '🧪 SYSLOG连通性测试 · 2026-03-07' } }] },
      'DEV编号':    { select: { name: 'DEV-001' } },
      '处理状态':   { status: { name: '待处理' } },
      '推送方':     { rich_text: [{ text: { content: '铸渊' } }] },
      '来源路径':   { rich_text: [{ text: { content: 'syslog-inbox/test/bridge-test-20260307.md' } }] },
      '文件内容':   { rich_text: [{ text: { content: '这是一条连通性测试SYSLOG。如果霜砚能在收件箱看到这条，说明铸渊→Notion SYSLOG推送管线已打通。' } }] },
      'commit_sha': { rich_text: [{ text: { content: 'test-00000000' } }] }
    }
  }, token);
}

// ══════════════════════════════════════════════════════════
// 主执行
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🧪 YM-TEST-20260307-001 · 铸渊→Notion 连通性测试');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.error('❌ NOTION_TOKEN 未设置，无法执行连通性测试');
    console.error('   请在 GitHub Secrets 中配置 NOTION_TOKEN');
    process.exit(1);
  }
  console.log('✅ NOTION_TOKEN 已检测到');

  const signalLogDbId = process.env.SIGNAL_LOG_DB_ID || '';
  const changesDbId   = process.env.CHANGES_DB_ID   || DEFAULT_CHANGES_DB_ID;
  const syslogDbId    = process.env.SYSLOG_DB_ID     || DEFAULT_SYSLOG_DB_ID;

  const results = {
    signalLog: { ok: false, pageId: null, error: null },
    changeLog: { ok: false, pageId: null, error: null },
    syslogInbox: { ok: false, pageId: null, error: null },
  };

  // ── 测试一：信号日志 ──────────────────────────────────
  console.log('\n── 测试一：写入「📡 跨平台信号日志」──');
  if (!signalLogDbId) {
    console.log('⚠️  SIGNAL_LOG_DB_ID 未配置，跳过此测试');
    results.signalLog.error = 'SIGNAL_LOG_DB_ID 未配置';
  } else {
    console.log(`   Database ID: ${signalLogDbId}`);
    try {
      const res = await testSignalLog(token, signalLogDbId);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        results.signalLog.ok = true;
        results.signalLog.pageId = res.body.id;
        console.log(`   ✅ 写入成功 · page_id: ${res.body.id}`);
      } else {
        results.signalLog.error = `HTTP ${res.statusCode}: ${res.body?.message || JSON.stringify(res.body)}`;
        console.log(`   ❌ 写入失败 · ${results.signalLog.error}`);
      }
    } catch (err) {
      results.signalLog.error = err.message;
      console.log(`   ❌ 请求异常 · ${err.message}`);
    }
  }

  // ── 测试二：变更日志 ──────────────────────────────────
  console.log('\n── 测试二：写入「📋 GitHub 变更日志」──');
  console.log(`   Database ID: ${changesDbId}`);
  try {
    const res = await testChangeLog(token, changesDbId);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      results.changeLog.ok = true;
      results.changeLog.pageId = res.body.id;
      console.log(`   ✅ 写入成功 · page_id: ${res.body.id}`);
    } else {
      results.changeLog.error = `HTTP ${res.statusCode}: ${res.body?.message || JSON.stringify(res.body)}`;
      console.log(`   ❌ 写入失败 · ${results.changeLog.error}`);
    }
  } catch (err) {
    results.changeLog.error = err.message;
    console.log(`   ❌ 请求异常 · ${err.message}`);
  }

  // ── 测试三：SYSLOG 收件箱 ─────────────────────────────
  console.log('\n── 测试三：写入「📥 GitHub SYSLOG 收件箱」──');
  console.log(`   Database ID: ${syslogDbId}`);
  try {
    const res = await testSyslogInbox(token, syslogDbId);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      results.syslogInbox.ok = true;
      results.syslogInbox.pageId = res.body.id;
      console.log(`   ✅ 写入成功 · page_id: ${res.body.id}`);
    } else {
      results.syslogInbox.error = `HTTP ${res.statusCode}: ${res.body?.message || JSON.stringify(res.body)}`;
      console.log(`   ❌ 写入失败 · ${results.syslogInbox.error}`);
    }
  } catch (err) {
    results.syslogInbox.error = err.message;
    console.log(`   ❌ 请求异常 · ${err.message}`);
  }

  // ── 写入本地信号日志 ──────────────────────────────────
  const now = new Date();
  const allPassed = results.signalLog.ok && results.changeLog.ok && results.syslogInbox.ok;
  const signalLogSkipped = !signalLogDbId;
  const partialPassed = results.changeLog.ok || results.syslogInbox.ok || results.signalLog.ok;

  let bridgeStatus;
  if (allPassed) {
    bridgeStatus = '全通';
  } else if (signalLogSkipped && results.changeLog.ok && results.syslogInbox.ok) {
    bridgeStatus = '全通（信号日志DB未配置，其余全通）';
  } else if (partialPassed) {
    bridgeStatus = '部分通';
  } else {
    bridgeStatus = '不通';
  }

  const signal = {
    signal_id:   'SIG-TEST-20260307-001',
    trace_id:    'TRC-TEST-20260307-YM001',
    timestamp:   now.toISOString(),
    signal_type: 'GL-ACK',
    direction:   'GitHub→Notion',
    sender:      '铸渊',
    receiver:    '霜砚',
    summary:     `🧪 连通性测试完成 · 数据桥状态 = ${bridgeStatus}`,
    result:      allPassed || (signalLogSkipped && results.changeLog.ok && results.syslogInbox.ok) ? '成功' : '失败',
    payload: {
      test_id:      'YM-TEST-20260307-001',
      signal_log:   results.signalLog,
      change_log:   results.changeLog,
      syslog_inbox: results.syslogInbox,
      bridge_status: bridgeStatus
    }
  };

  try {
    writeLocalSignalLog(signal);
    console.log(`\n📝 本地信号日志已写入: ${signal.signal_id}`);
  } catch (err) {
    console.error(`\n⚠️  本地信号日志写入失败: ${err.message}`);
  }

  // ── 输出汇总 ──────────────────────────────────────────
  const formatResult = (r) => r.ok ? `✅（page_id: ${r.pageId}）` : `❌（${r.error}）`;

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ YM-TEST-20260307-001 连通性测试完成');
  console.log(`· 信号日志写入：${signalLogSkipped ? '⚠️ 跳过（SIGNAL_LOG_DB_ID 未配置）' : formatResult(results.signalLog)}`);
  console.log(`· 变更日志写入：${formatResult(results.changeLog)}`);
  console.log(`· SYSLOG收件箱写入：${formatResult(results.syslogInbox)}`);
  console.log(`· 总结：数据桥状态 = ${bridgeStatus}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // GitHub Actions: 输出到 GITHUB_OUTPUT（如有）
  if (process.env.GITHUB_OUTPUT) {
    const outputLines = [
      `signal_log_ok=${results.signalLog.ok}`,
      `change_log_ok=${results.changeLog.ok}`,
      `syslog_inbox_ok=${results.syslogInbox.ok}`,
      `bridge_status=${bridgeStatus}`,
    ];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputLines.join('\n') + '\n');
  }

  // 如果没有全通（且不是因为跳过信号日志），以非零退出码结束
  if (!allPassed && !(signalLogSkipped && results.changeLog.ok && results.syslogInbox.ok)) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('❌ 连通性测试异常退出:', err.message);
  process.exit(1);
});
