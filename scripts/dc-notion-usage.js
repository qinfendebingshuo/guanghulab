/**
 * scripts/dc-notion-usage.js
 * DC-01 · Notion 读写分析器
 *
 * 采集时机：每日自检结束时附带写入
 * 存储位置：data/dc-reports/notion-usage-YYYY-MM-DD.json
 *
 * 采集方式：
 *   读取天眼报告中的 Notion 相关诊断数据，
 *   统计当日 API 调用次数并写入标准格式。
 *   当 Notion API 可用时，额外查询数据库元信息。
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT       = path.resolve(__dirname, '..');
const DC_DIR     = path.join(ROOT, 'data/dc-reports');
const SKYEYE_DIR = path.join(ROOT, 'data/skyeye-reports');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now   = new Date();
const today = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().split('T')[0];

// ━━━ 工具函数 ━━━

function loadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function notionGet(apiPath, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path: apiPath,
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'User-Agent': 'dc-notion-usage'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

// ━━━ 从天眼报告中提取 Notion 相关数据 ━━━

function extractFromSkyeye() {
  const info = {
    skyeye_available: false,
    bridges_status: null,
    notion_connected: false,
    api_hint_calls: 0
  };

  // 查找最近的天眼报告
  try {
    const files = fs.readdirSync(SKYEYE_DIR)
      .filter(f => f.startsWith('skyeye-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length === 0) return info;

    const report = loadJson(path.join(SKYEYE_DIR, files[0]));
    if (!report) return info;

    info.skyeye_available = true;

    // 提取 bridge 扫描中的 Notion 连接信息
    if (report.bridges) {
      const bridges = typeof report.bridges === 'string'
        ? loadJson(path.join(SKYEYE_DIR, 'bridge-health.json'))
        : report.bridges;

      if (bridges && bridges.notion_api) {
        info.notion_connected = bridges.notion_api.connected === true;
        info.bridges_status = bridges.notion_api.status || null;
      }
    }
  } catch {
    // 天眼报告不可用，跳过
  }

  return info;
}

// ━━━ 查询 Notion 数据库元信息 ━━━

async function queryNotionDatabases(token) {
  const databases = [];

  try {
    // search 需要 POST，此处使用已知数据库 ID 直接查询
  } catch {
    // Notion API 不可达
  }

  // 尝试查询环境变量中的已知数据库
  const knownDbs = [];

  if (process.env.NOTION_DB_SYSLOG) {
    knownDbs.push({ id: process.env.NOTION_DB_SYSLOG, name: 'SYSLOG收件箱' });
  }
  if (process.env.NOTION_TICKET_DB_ID) {
    knownDbs.push({ id: process.env.NOTION_TICKET_DB_ID, name: '人格协作工单簿' });
  }
  if (process.env.BRIDGE_QUEUE_DB_ID) {
    knownDbs.push({ id: process.env.BRIDGE_QUEUE_DB_ID, name: '调度队列' });
  }

  for (const db of knownDbs) {
    try {
      const resp = await notionGet('/v1/databases/' + db.id, token);
      if (resp.statusCode === 200 && resp.body && resp.body.properties) {
        const props = Object.keys(resp.body.properties);
        databases.push({
          name: resp.body.title?.[0]?.plain_text || db.name,
          daily_reads: 0,
          daily_writes: 0,
          active_fields: props.slice(0, 20),
          unused_fields: []
        });
      }
    } catch {
      // 该数据库不可访问
    }
  }

  return databases;
}

// ━━━ 读取 writeback log 统计当日调用次数 ━━━

function countTodayApiCalls() {
  let totalCalls = 0;
  let peakHourMap = {};

  // 检查 notion-writeback-log.json
  const wbLog = loadJson(path.join(ROOT, 'data/notion-writeback-log.json'));
  if (wbLog && Array.isArray(wbLog)) {
    for (const entry of wbLog) {
      if (entry.timestamp && entry.timestamp.startsWith(today)) {
        totalCalls++;
        const hour = entry.timestamp.substring(11, 13);
        peakHourMap[hour] = (peakHourMap[hour] || 0) + 1;
      }
    }
  }

  // 检查 bridge-logs
  const bridgeLogDir = path.join(ROOT, 'data/bridge-logs');
  if (fs.existsSync(bridgeLogDir)) {
    try {
      const logFiles = fs.readdirSync(bridgeLogDir)
        .filter(f => f.includes(today) && f.endsWith('.json'));
      for (const lf of logFiles) {
        const log = loadJson(path.join(bridgeLogDir, lf));
        if (log && log.notion_calls) {
          totalCalls += log.notion_calls;
        }
      }
    } catch {
      // bridge-logs 不可读
    }
  }

  // 找出峰值小时
  let peakHour = null;
  let peakCount = 0;
  for (const [hour, count] of Object.entries(peakHourMap)) {
    if (count > peakCount) {
      peakCount = count;
      const h = parseInt(hour, 10);
      peakHour = `${String(h).padStart(2, '0')}:00-${String((h + 1) % 24).padStart(2, '0')}:00`;
    }
  }

  return { totalCalls, peakHour: peakHour || 'N/A' };
}

// ━━━ 主流程 ━━━

async function main() {
  console.log(`📦 DC-01 · Notion 读写分析器 · ${today}`);

  fs.mkdirSync(DC_DIR, { recursive: true });

  const skyeyeInfo = extractFromSkyeye();
  const { totalCalls, peakHour } = countTodayApiCalls();

  const notionToken = process.env.NOTION_TOKEN;
  let databases = [];

  if (notionToken) {
    console.log('  → Notion Token 可用，查询数据库元信息...');
    databases = await queryNotionDatabases(notionToken);
    console.log(`  → 查询到 ${databases.length} 个数据库`);
  } else {
    console.log('  ⚠️ 缺少 NOTION_TOKEN，跳过 Notion API 查询');
  }

  const report = {
    date: today,
    databases: databases,
    total_api_calls: totalCalls,
    peak_hour: peakHour,
    _meta: {
      generated_by: 'dc-notion-usage.js',
      generated_at: now.toISOString(),
      skyeye_available: skyeyeInfo.skyeye_available,
      notion_connected: skyeyeInfo.notion_connected
    }
  };

  const outputFile = path.join(DC_DIR, `notion-usage-${today}.json`);
  fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
  console.log(`  ✅ DC-01 报告已写入: ${path.relative(ROOT, outputFile)}`);
}

main().catch(err => {
  console.error('❌ DC-01 采集失败:', err.message);
  process.exit(1);
});
