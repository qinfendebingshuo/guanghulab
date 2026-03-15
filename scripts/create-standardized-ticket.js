// scripts/create-standardized-ticket.js
// 铸渊 · Phase B1 · 标准化工单创建脚本
//
// 将 SYSLOG 写入 Notion 工单队列时使用标准化格式，
// 让 Notion Agent 能够识别和触发后续处理。
//
// 环境变量：
//   NOTION_TOKEN           Notion API token
//   NOTION_TICKET_DB_ID    工单队列数据库 ID
//   BROADCAST_ID           广播编号（如 BC-M23-001-AW）
//   DEVELOPER              开发者信息（如 "DEV-012 Awen"）
//   SYSLOG_RAW             完整 SYSLOG 原文（JSON 字符串或纯文本）
//   SUBMIT_TYPE            提交类型（syslog / question）
//   PERSONA_RESULT         人格体处理结果（可选，首次可为空）
//   MODULE_VERIFY           模块验证结果 JSON（可选）
//   MODULES_UPLOADED        模块是否全部上传（true/false）

'use strict';

const https = require('https');
const fs = require('fs');

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_TICKET_DB_ID = process.env.NOTION_TICKET_DB_ID || '';
const BROADCAST_ID = process.env.BROADCAST_ID || 'UNKNOWN';
const DEVELOPER = process.env.DEVELOPER || process.env.AUTHOR || 'unknown';
const SYSLOG_RAW = process.env.SYSLOG_RAW || process.env.SUBMIT_CONTENT || '';
const SUBMIT_TYPE = process.env.SUBMIT_TYPE || 'syslog';
const PERSONA_RESULT = process.env.PERSONA_RESULT || '';
const MODULE_VERIFY = process.env.MODULE_VERIFY || '';
const MODULES_UPLOADED = process.env.MODULES_UPLOADED || 'false';

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

// ══════════════════════════════════════════════════════════
// Notion API 工具
// ══════════════════════════════════════════════════════════

function notionPost(endpoint, body) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(body);
    var opts = {
      hostname: NOTION_API_HOSTNAME,
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    var req = https.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(data);
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

function richTextChunks(content) {
  var str = String(content || '');
  var chunks = [];
  for (var i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  if (chunks.length === 0) {
    chunks.push({ type: 'text', text: { content: '' } });
  }
  return chunks;
}

// ══════════════════════════════════════════════════════════
// 标准化工单创建
// ══════════════════════════════════════════════════════════

async function createStandardizedTicket() {
  if (!NOTION_TOKEN || !NOTION_TICKET_DB_ID) {
    console.log('⚠️ Notion credentials not configured, skipping ticket creation');
    process.exit(0);
  }

  var now = new Date().toISOString();
  var typeLabel = SUBMIT_TYPE === 'syslog' ? 'SYSLOG处理' : '提问解答';
  var ticketStatus = SUBMIT_TYPE === 'syslog' ? '待处理' : '已完成';
  var verifyStatus = MODULES_UPLOADED === 'true' ? '模块已验证✅' : '模块待验证⚠️';
  var title = '[自动] ' + BROADCAST_ID + ' · ' + typeLabel + ' · ' + verifyStatus;

  // Phase B1 标准化字段 — 工单内容
  var ticketContent = [
    '## 📡 标准化工单 · Phase B1',
    '',
    '| 字段 | 值 |',
    '|------|-----|',
    '| 工单类型 | ' + typeLabel + ' |',
    '| 状态 | ' + ticketStatus + ' |',
    '| 来源 | GitHub Actions |',
    '| taskId | ' + BROADCAST_ID + ' |',
    '| developer | ' + DEVELOPER + ' |',
    '| created_at | ' + now + ' |',
    '| retry_count | 0 |',
    '| receipt_status | pending |',
    '',
  ];

  if (PERSONA_RESULT) {
    ticketContent.push('## 铸渊核心大脑处理结果');
    ticketContent.push('');
    ticketContent.push(PERSONA_RESULT.slice(0, 1500));
    ticketContent.push('');
  }

  ticketContent.push('## 模块上传验证');
  ticketContent.push('');
  ticketContent.push('模块全部上传: ' + (MODULES_UPLOADED === 'true' ? '✅ 是' : '❌ 否'));
  ticketContent.push('');

  if (MODULE_VERIFY) {
    ticketContent.push('验证详情: ' + MODULE_VERIFY.slice(0, 400));
    ticketContent.push('');
  }

  var contentText = ticketContent.join('\n');

  // 构建 Notion 页面
  var body = {
    parent: { database_id: NOTION_TICKET_DB_ID },
    properties: {
      '标题': { title: [{ type: 'text', text: { content: title.slice(0, 120) } }] },
      '操作类型': { select: { name: '其他' } },
      '提交者': { rich_text: [{ type: 'text', text: { content: '铸渊Agent·自动管道' } }] },
      '状态': { select: { name: ticketStatus } },
      '优先级': { select: { name: 'P1' } },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: richTextChunks(contentText),
        },
      },
    ],
  };

  // 将 SYSLOG 原文作为代码块附加（如果有）
  if (SYSLOG_RAW) {
    body.children.push({
      object: 'block',
      type: 'code',
      code: {
        rich_text: richTextChunks(SYSLOG_RAW.slice(0, 8000)),
        language: 'json',
      },
    });
  }

  console.log('📋 创建标准化工单...');
  console.log('  taskId: ' + BROADCAST_ID);
  console.log('  developer: ' + DEVELOPER);
  console.log('  type: ' + typeLabel);
  console.log('  receipt_status: pending');

  try {
    var result = await notionPost('/v1/pages', body);
    console.log('✅ Notion 标准化工单已创建: ' + result.id);

    // 输出工单 ID 到 GITHUB_OUTPUT
    var outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, 'ticket_page_id=' + result.id + '\n');
      fs.appendFileSync(outputFile, 'ticket_url=' + (result.url || '') + '\n');
    }
  } catch (err) {
    console.error('❌ 工单创建失败: ' + err.message);
    process.exit(1);
  }
}

createStandardizedTicket();
