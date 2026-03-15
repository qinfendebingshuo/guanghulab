#!/usr/bin/env node
/**
 * sync-deploy-to-notion.js — 同步部署状态到 Notion 模块指纹注册表
 * 铸渊 · 光湖沙盒部署自动化
 *
 * 环境变量:
 *   NOTION_TOKEN       — Notion API Token
 *   FINGERPRINT_DB_ID  — 模块指纹注册表 Database ID
 *
 * 读取 data/deploy-status.json，逐条写入/更新 Notion 数据库
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.FINGERPRINT_DB_ID;

if (!NOTION_TOKEN || !DATABASE_ID) {
  console.error('⚠️ 缺少环境变量: NOTION_TOKEN 或 FINGERPRINT_DB_ID');
  process.exit(1);
}

const STATUS_FILE = path.join(__dirname, '..', 'data', 'deploy-status.json');

function notionRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
    };
    if (data) {
      options.headers['Content-Length'] = Buffer.byteLength(data);
    }

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function findExistingPage(devId, module) {
  const res = await notionRequest('POST', 'databases/' + DATABASE_ID + '/query', {
    filter: {
      and: [
        { property: 'DEV编号', rich_text: { equals: devId } },
        { property: '模块名', rich_text: { equals: module } },
      ],
    },
  });

  if (res.status === 200 && res.data.results && res.data.results.length > 0) {
    return res.data.results[0].id;
  }
  return null;
}

function buildProperties(entry) {
  return {
    'DEV编号': { rich_text: [{ text: { content: entry.dev_id } }] },
    '模块名': { rich_text: [{ text: { content: entry.module } }] },
    '部署状态': {
      select: { name: entry.result === 'passed' ? '✅ 通过' : '❌ 失败' },
    },
    '最后部署时间': { rich_text: [{ text: { content: entry.timestamp || '' } }] },
    '提交SHA': { rich_text: [{ text: { content: (entry.commit || '').slice(0, 8) } }] },
  };
}

async function syncEntry(key, entry) {
  const existingPageId = await findExistingPage(entry.dev_id, entry.module);
  const properties = buildProperties(entry);

  if (existingPageId) {
    const res = await notionRequest('PATCH', 'pages/' + existingPageId, { properties });
    if (res.status === 200) {
      console.log(`  ✅ 更新: ${key}`);
    } else {
      console.log(`  ⚠️ 更新失败: ${key} (HTTP ${res.status})`);
    }
  } else {
    const res = await notionRequest('POST', 'pages', {
      parent: { database_id: DATABASE_ID },
      properties: {
        ...properties,
        title: { title: [{ text: { content: `${entry.dev_id}/${entry.module}` } }] },
      },
    });
    if (res.status === 200) {
      console.log(`  ✅ 新增: ${key}`);
    } else {
      console.log(`  ⚠️ 新增失败: ${key} (HTTP ${res.status})`);
    }
  }
}

async function main() {
  console.log('📝 sync-deploy-to-notion · 开始同步');

  if (!fs.existsSync(STATUS_FILE)) {
    console.log('⚠️ deploy-status.json 不存在，跳过同步');
    return;
  }

  let data;
  try {
    data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
  } catch (err) {
    console.error('❌ 解析 deploy-status.json 失败:', err.message);
    process.exit(1);
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    console.log('📭 deploy-status.json 为空，无需同步');
    return;
  }

  console.log(`📊 共 ${entries.length} 条部署记录`);

  for (const [key, entry] of entries) {
    try {
      await syncEntry(key, entry);
    } catch (err) {
      console.log(`  ⚠️ 同步失败: ${key} (${err.message})`);
    }
  }

  console.log('✅ 同步完成');
}

main().catch((err) => {
  console.error('❌ sync-deploy-to-notion 异常:', err.message);
  process.exit(1);
});
