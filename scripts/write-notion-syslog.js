// scripts/write-notion-syslog.js
// 铸渊 · 飞书 SYSLOG → Notion 收件箱写入
//
// 读取 syslog-inbox/ 下的 JSON 文件，写入 Notion SYSLOG 收件箱数据库。
// 用法: node scripts/write-notion-syslog.js <syslog-file-path>
//
// 环境变量：
//   NOTION_TOKEN       Notion API token（必须）
//   NOTION_DB_SYSLOG   SYSLOG 收件箱数据库 ID（必须）

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION       = '2022-06-28';
const NOTION_API_HOSTNAME  = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

// ══════════════════════════════════════════════════════════
// HTTP 请求工具（复用 receive-syslog.js 模式）
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
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// Notion 属性构建辅助
// ══════════════════════════════════════════════════════════

function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function titleProp(text) {
  return { title: [{ type: 'text', text: { content: String(text || '').slice(0, 120) } }] };
}

function richTextProp(text) {
  return { rich_text: richText(text) };
}

function selectProp(name) {
  return { select: { name: String(name) } };
}

function dateProp(dateStr) {
  return { date: { start: dateStr } };
}

function statusProp(name) {
  return { status: { name: String(name) } };
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const filePath    = process.argv[2];
  const notionToken = process.env.NOTION_TOKEN;
  const syslogDbId  = process.env.NOTION_DB_SYSLOG;

  if (!filePath) {
    console.error('❌ 用法: node write-notion-syslog.js <syslog-file-path>');
    process.exit(1);
  }

  if (!notionToken || !syslogDbId) {
    console.log('⚠️  缺少 NOTION_TOKEN 或 NOTION_DB_SYSLOG，跳过 Notion 写入');
    process.exit(0);
  }

  // 读取 SYSLOG 文件
  let entry;
  try {
    entry = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error('❌ 读取/解析文件失败: ' + e.message);
    process.exit(1);
  }

  const filename    = path.basename(filePath);
  const syslogText  = entry.syslog_raw || entry.syslog || entry.content || '';
  const source      = entry.source || 'unknown';
  const senderName  = entry.sender_name || '';
  const senderOpenId = entry.sender_open_id || entry.sender_id || '';
  const chatId      = entry.chat_id || '';
  const timestamp   = entry.timestamp || new Date().toISOString();
  const dateStr     = timestamp.split('T')[0] || new Date().toISOString().split('T')[0];

  console.log('📋 写入 Notion SYSLOG 收件箱...');
  console.log('  文件: ' + filename);
  console.log('  来源: ' + source);
  console.log('  发送者: ' + (senderName || senderOpenId || '未知'));

  // 构建 Notion 页面属性
  const properties = {
    '标题':       titleProp('飞书SYSLOG · ' + (senderName || source) + ' · ' + dateStr),
    '接收时间':   dateProp(dateStr),
    '处理状态':   statusProp('待处理'),
  };

  // 可选字段（如果 Notion 数据库有这些列）
  if (source)       properties['推送方']   = richTextProp(source);
  if (senderOpenId) properties['DEV编号']   = selectProp(senderOpenId);

  // 构建页面内容
  const contentBlocks = [];

  // SYSLOG 正文
  if (syslogText) {
    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: richText(syslogText),
      },
    });
  }

  // 原始 JSON（调试用）
  contentBlocks.push({
    object: 'block',
    type: 'code',
    code: {
      rich_text: richText(JSON.stringify(entry, null, 2)),
      language: 'json',
    },
  });

  const body = {
    parent: { database_id: syslogDbId },
    properties,
    children: contentBlocks,
  };

  try {
    const result = await notionPost('/v1/pages', body, notionToken);
    console.log('  ✅ Notion SYSLOG 收件箱条目已创建: ' + result.id);
  } catch (err) {
    console.error('  ❌ Notion 写入失败: ' + err.message);
    // 不退出，允许后续步骤继续
  }
}

main().catch(err => {
  console.error('❌ write-notion-syslog 失败: ' + err.message);
  process.exit(1);
});
