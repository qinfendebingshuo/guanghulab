// scripts/bridge/process-syslog-batch.js
// 🌉 桥接·SYSLOG 批量处理
//
// 读取 syslog-inbox/ 中的所有新 SYSLOG 文件，
// 通过 Notion API 写入回执+画像+主控台，
// 并在调度队列创建 SYSLOG_RECEIVED 任务，
// 然后移动已处理文件到 syslog-processed/
//
// 环境变量：
//   NOTION_TOKEN          Notion API token
//   BRIDGE_QUEUE_DB_ID    桥接调度队列数据库 ID
//   SYSLOG_DB_ID          SYSLOG 收件箱数据库 ID（可选，有默认值）
//   COMMIT_SHA            当前 Git commit SHA

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const NOTION_VERSION        = '2022-06-28';
const NOTION_API_HOSTNAME   = 'api.notion.com';
const NOTION_RICH_TEXT_MAX  = 2000;
const NOTION_TITLE_MAX      = 120;
const DEFAULT_SYSLOG_DB_ID  = '330ab17507d542c9bbb96d0749b41197';

const INBOX_DIR     = 'syslog-inbox';
const PROCESSED_DIR = 'syslog-processed';

// ══════════════════════════════════════════════════════════
// Notion API
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
// 属性构建辅助
// ══════════════════════════════════════════════════════════

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
// 文件扫描
// ══════════════════════════════════════════════════════════

function scanDir(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep' || entry.name === 'README.md') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════
// 核心逻辑
// ══════════════════════════════════════════════════════════

/**
 * 将 SYSLOG 写入 Notion SYSLOG 收件箱数据库
 */
async function writeSyslogToNotion(dbId, fileContent, filePath, entry, commitSha, token) {
  const filename = path.basename(filePath);
  const title    = entry.title || filename;
  const devId    = entry.from  || entry.dev_id || entry.header?.dev_id || '';
  const ts       = entry.timestamp || new Date().toISOString();

  const properties = {
    '标题':      { title: titleProp(title) },
    '文件内容':  { rich_text: richText(fileContent) },
    '来源路径':  { rich_text: richText(filePath) },
    '接收时间':  { date: { start: ts } },
    '处理状态':  { status: { name: '待处理' } },
    'commit_sha': { rich_text: richText(commitSha || '') },
    '推送方':    { rich_text: richText('铸渊') },
  };

  if (devId) {
    properties['DEV编号'] = { select: { name: devId } };
  }

  return notionPost('/v1/pages', { parent: { database_id: dbId }, properties }, token);
}

/**
 * 在调度队列创建 SYSLOG_RECEIVED 任务
 */
async function createQueueTask(queueDbId, entry, filePath, source, token) {
  const devId       = entry.from || entry.dev_id || entry.header?.dev_id || '';
  const broadcastId = entry.broadcast_id || entry.header?.broadcast_id || '';
  const taskName    = `SYSLOG-${devId}-${broadcastId || path.basename(filePath, '.json')}`;

  const properties = {
    '任务名称':   { title: titleProp(taskName) },
    '类型':       { select: { name: 'SYSLOG_RECEIVED' } },
    '处理状态':   { status: { name: '待处理' } },
    '来源渠道':   { rich_text: richText(source || '飞书') },
    'Payload':    { rich_text: richText(JSON.stringify(entry).slice(0, NOTION_RICH_TEXT_MAX)) },
  };

  if (devId)       properties['DEV编号']  = { select: { name: devId } };
  if (broadcastId) properties['广播编号'] = { rich_text: richText(broadcastId) };

  return notionPost('/v1/pages', { parent: { database_id: queueDbId }, properties }, token);
}

/**
 * 移动已处理文件到 syslog-processed/
 */
function moveToProcessed(filePath) {
  const dateDir = new Date().toISOString().slice(0, 7); // YYYY-MM
  const destDir = path.join(PROCESSED_DIR, dateDir);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  const destPath = path.join(destDir, path.basename(filePath));
  fs.renameSync(filePath, destPath);
  return destPath;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const token     = process.env.NOTION_TOKEN;
  const syslogDb  = process.env.SYSLOG_DB_ID || DEFAULT_SYSLOG_DB_ID;
  const queueDb   = process.env.BRIDGE_QUEUE_DB_ID;
  const commitSha = process.env.COMMIT_SHA || '';

  if (!token) {
    console.log('⚠️  缺少 NOTION_TOKEN，跳过 SYSLOG 批处理');
    process.exit(0);
  }

  const files = scanDir(INBOX_DIR, ['.json', '.md', '.txt']);

  if (files.length === 0) {
    console.log('📭 syslog-inbox/ 无待处理条目，跳过');
    process.exit(0);
  }

  console.log(`📥 发现 ${files.length} 条 SYSLOG，开始批量处理…`);

  let ok = 0, failed = 0;

  for (const fullPath of files) {
    const relPath = fullPath.replace(/\\/g, '/');
    let raw, entry;

    try {
      raw   = fs.readFileSync(fullPath, 'utf8');
      entry = fullPath.endsWith('.json') ? JSON.parse(raw) : {};
    } catch (e) {
      console.error(`❌ 读取 ${relPath} 失败: ${e.message}`);
      failed++;
      continue;
    }

    try {
      // 写入 SYSLOG 收件箱
      const page = await writeSyslogToNotion(syslogDb, raw, relPath, entry, commitSha, token);
      console.log(`  ✅ ${relPath} → Notion SYSLOG: ${page.id}`);

      // 在调度队列创建任务（如配置了队列数据库）
      if (queueDb) {
        const source = entry.source || entry.header?.source || '飞书';
        const task = await createQueueTask(queueDb, entry, relPath, source, token);
        console.log(`  📋 调度队列任务已创建: ${task.id}`);
      }

      // 移动到已处理目录
      const destPath = moveToProcessed(fullPath);
      console.log(`  📦 已归档: ${destPath}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${relPath} 处理失败: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ SYSLOG 批处理完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);

  // 输出到 GITHUB_OUTPUT
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `processed_count=${ok}\nfailed_count=${failed}\n`
    );
  }

  if (failed > 0) process.exit(1);
}

main().catch(e => { console.error(e); process.exit(1); });
