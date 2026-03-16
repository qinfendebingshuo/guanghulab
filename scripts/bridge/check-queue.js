// scripts/bridge/check-queue.js
// 🌉 桥接·调度队列检查
//
// 查询 Notion 调度队列数据库中指定类型+状态的任务
// 用法: node scripts/bridge/check-queue.js [BROADCAST_READY|SYSLOG_RECEIVED|HEARTBEAT]
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

// ══════════════════════════════════════════════════════════
// Notion API 基础调用
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
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Notion API parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function checkQueue(taskType) {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.BRIDGE_QUEUE_DB_ID;

  if (!token) {
    console.log('⚠️  缺少 NOTION_TOKEN，跳过调度队列检查');
    process.exit(0);
  }
  if (!dbId) {
    console.log('⚠️  缺少 BRIDGE_QUEUE_DB_ID，跳过调度队列检查');
    process.exit(0);
  }

  console.log(`🌉 检查调度队列 · 类型=${taskType} · 状态=待处理`);

  const filter = {
    and: [
      { property: '类型',     select: { equals: taskType } },
      { property: '处理状态', status: { equals: '待处理' } },
    ],
  };

  const body = {
    filter,
    sorts: [{ property: '创建时间', direction: 'ascending' }],
    page_size: 50,
  };

  try {
    const result = await notionPost(`/v1/databases/${dbId}/query`, body, token);
    const tasks = result.results || [];

    console.log(`📋 发现 ${tasks.length} 条待处理任务`);

    // 将任务列表写入临时文件供后续步骤使用
    const outputDir = path.join('data', 'bridge-logs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputFile = path.join(outputDir, `queue-${taskType.toLowerCase()}-${Date.now()}.json`);
    const taskSummaries = tasks.map(t => ({
      id:           t.id,
      task_name:    extractTitle(t),
      task_type:    taskType,
      dev_id:       extractSelect(t, 'DEV编号'),
      broadcast_id: extractRichText(t, '广播编号'),
      source:       extractRichText(t, '来源渠道'),
      payload:      extractRichText(t, 'Payload'),
      created_time: t.created_time,
    }));

    fs.writeFileSync(outputFile, JSON.stringify(taskSummaries, null, 2));
    console.log(`📁 任务列表已写入: ${outputFile}`);

    // 输出到 GITHUB_OUTPUT（供 workflow 使用）
    if (process.env.GITHUB_OUTPUT) {
      fs.appendFileSync(process.env.GITHUB_OUTPUT,
        `task_count=${tasks.length}\n` +
        `queue_file=${outputFile}\n`
      );
    }

    return taskSummaries;
  } catch (e) {
    console.error(`❌ 查询调度队列失败: ${e.message}`);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════
// Notion 属性提取辅助
// ══════════════════════════════════════════════════════════

function extractTitle(page) {
  const prop = page.properties && page.properties['任务名称'];
  if (prop && prop.title && prop.title.length > 0) {
    return prop.title.map(t => t.plain_text).join('');
  }
  return '';
}

function extractSelect(page, name) {
  const prop = page.properties && page.properties[name];
  if (prop && prop.select) {
    return prop.select.name || '';
  }
  return '';
}

function extractRichText(page, name) {
  const prop = page.properties && page.properties[name];
  if (prop && prop.rich_text && prop.rich_text.length > 0) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  return '';
}

// ══════════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════════

const taskType = process.argv[2] || 'BROADCAST_READY';
checkQueue(taskType).catch(e => { console.error(e); process.exit(1); });
