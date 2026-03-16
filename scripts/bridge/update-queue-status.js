// scripts/bridge/update-queue-status.js
// 🌉 桥接·更新调度队列状态
//
// 将已处理的调度队列任务状态更新为「已完成」
//
// 环境变量：
//   NOTION_TOKEN          Notion API token
//   BRIDGE_QUEUE_DB_ID    桥接调度队列数据库 ID
//   QUEUE_FILE            check-queue.js 输出的任务列表文件路径

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';

// ══════════════════════════════════════════════════════════
// Notion API
// ══════════════════════════════════════════════════════════

function notionPatch(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   'PATCH',
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

async function main() {
  const token    = process.env.NOTION_TOKEN;
  const queueFile = process.env.QUEUE_FILE;

  if (!token) {
    console.log('⚠️  缺少 NOTION_TOKEN，跳过状态更新');
    process.exit(0);
  }

  if (!queueFile || !fs.existsSync(queueFile)) {
    console.log('📭 无待更新的任务，跳过');
    process.exit(0);
  }

  const tasks = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  if (tasks.length === 0) {
    console.log('📭 任务列表为空，跳过');
    process.exit(0);
  }

  console.log(`✏️  更新 ${tasks.length} 条任务状态为「已完成」…`);

  let ok = 0, failed = 0;

  for (const task of tasks) {
    try {
      await notionPatch(`/v1/pages/${task.id}`, {
        properties: {
          '处理状态': { status: { name: '已完成' } },
        },
      }, token);
      console.log(`  ✅ ${task.task_name} → 已完成`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${task.task_name} 更新失败: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ 状态更新完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `updated_count=${ok}\n`
    );
  }

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
