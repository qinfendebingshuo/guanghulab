// scripts/bridge/heartbeat.js
// 🌉 桥接·心跳检测
//
// 定时检测桥接通道畅通性：
// 1. 测试 Notion API 连通性
// 2. 在调度队列创建 HEARTBEAT 任务
// 3. 记录心跳日志
//
// 环境变量：
//   NOTION_TOKEN          Notion API token
//   BRIDGE_QUEUE_DB_ID    桥接调度队列数据库 ID

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_TITLE_MAX    = 120;
const NOTION_RICH_TEXT_MAX = 2000;

// ══════════════════════════════════════════════════════════
// Notion API
// ══════════════════════════════════════════════════════════

function notionRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   method,
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
      },
    };
    if (payload) {
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function titleProp(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, NOTION_TITLE_MAX) } }];
}

// ══════════════════════════════════════════════════════════
// 心跳检测
// ══════════════════════════════════════════════════════════

async function checkNotionHealth(token) {
  const start = Date.now();
  try {
    const result = await notionRequest('GET', '/v1/users/me', null, token);
    const elapsed = Date.now() - start;
    return {
      healthy:  result.status >= 200 && result.status < 300,
      status:   result.status,
      latency:  elapsed,
      user:     result.data?.name || 'unknown',
    };
  } catch (e) {
    return {
      healthy: false,
      status:  0,
      latency: Date.now() - start,
      error:   e.message,
    };
  }
}

async function createHeartbeatTask(queueDbId, healthResult, token) {
  const now = new Date().toISOString();
  const taskName = `HEARTBEAT-${now.slice(0, 10)}-${now.slice(11, 19).replace(/:/g, '')}`;

  const status = healthResult.healthy ? '✅ 通道畅通' : '❌ 通道异常';
  const payload = JSON.stringify({
    notion_healthy: healthResult.healthy,
    notion_status:  healthResult.status,
    notion_latency: healthResult.latency,
    notion_user:    healthResult.user || '',
    error:          healthResult.error || '',
    timestamp:      now,
  });

  const properties = {
    '任务名称':   { title: titleProp(taskName) },
    '类型':       { select: { name: 'HEARTBEAT' } },
    '处理状态':   { status: { name: healthResult.healthy ? '已完成' : '待处理' } },
    '来源渠道':   { rich_text: richText('铸渊心跳') },
    'Payload':    { rich_text: richText(payload) },
  };

  const body = { parent: { database_id: queueDbId }, properties };

  try {
    const result = await notionRequest('POST', '/v1/pages', body, token);
    if (result.status >= 200 && result.status < 300) {
      return { success: true, page_id: result.data.id };
    }
    return { success: false, error: `${result.status}: ${JSON.stringify(result.data)}` };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function main() {
  const token   = process.env.NOTION_TOKEN;
  const queueDb = process.env.BRIDGE_QUEUE_DB_ID;

  console.log('💓 桥接心跳检测开始…');
  console.log(`⏰ ${new Date().toISOString()}`);

  const heartbeat = {
    timestamp: new Date().toISOString(),
    notion:    { healthy: false },
    queue:     { created: false },
  };

  // ① 测试 Notion API 连通性
  if (token) {
    console.log('\n📡 检测 Notion API 连通性…');
    heartbeat.notion = await checkNotionHealth(token);

    if (heartbeat.notion.healthy) {
      console.log(`  ✅ Notion API 正常 · 延迟 ${heartbeat.notion.latency}ms · 用户: ${heartbeat.notion.user}`);
    } else {
      console.error(`  ❌ Notion API 异常 · 状态 ${heartbeat.notion.status} · ${heartbeat.notion.error || ''}`);
    }
  } else {
    console.log('  ⚠️  NOTION_TOKEN 未配置，跳过 Notion 检测');
  }

  // ② 在调度队列创建心跳记录
  if (token && queueDb) {
    console.log('\n📋 写入心跳记录到调度队列…');
    const queueResult = await createHeartbeatTask(queueDb, heartbeat.notion, token);
    heartbeat.queue = queueResult;

    if (queueResult.success) {
      console.log(`  ✅ 心跳记录已创建: ${queueResult.page_id}`);
    } else {
      console.error(`  ❌ 心跳记录创建失败: ${queueResult.error}`);
    }
  } else {
    console.log('  ⚠️  调度队列未配置，跳过心跳记录');
  }

  // ③ 写入本地心跳日志
  const logDir  = path.join('data', 'bridge-logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFile = path.join(logDir, `heartbeat-${new Date().toISOString().slice(0, 10)}.json`);

  let logs = [];
  if (fs.existsSync(logFile)) {
    try { logs = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (_) { logs = []; }
  }
  logs.push(heartbeat);
  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2));

  console.log(`\n📁 心跳日志: ${logFile}`);

  // ④ 总结
  const allHealthy = heartbeat.notion.healthy;
  console.log(`\n${allHealthy ? '✅' : '❌'} 心跳检测完成 · Notion: ${heartbeat.notion.healthy ? '正常' : '异常'}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `notion_healthy=${heartbeat.notion.healthy}\nheartbeat_status=${allHealthy ? 'ok' : 'error'}\n`
    );
  }

  // 心跳异常不退出失败（避免 workflow 频繁报错）
}

main().catch(e => { console.error(e); process.exit(1); });
