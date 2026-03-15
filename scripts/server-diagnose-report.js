// scripts/server-diagnose-report.js
// 铸渊 · PM2 服务诊断报告 → Notion 工单
//
// 将 PM2 诊断和系统健康检查结果写入 Notion 工单队列。
// 由 pm2-server-diagnose.yml 工作流调用。
//
// 环境变量：
//   NOTION_TOKEN         Notion API token
//   NOTION_TICKET_DB_ID  工单队列数据库 ID
//   PM2_REPORT           PM2 诊断输出
//   CLEANUP_REPORT       清理操作输出（可选）
//   HEALTH_REPORT        健康检查输出

'use strict';

const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN || '';
const NOTION_TICKET_DB_ID = process.env.NOTION_TICKET_DB_ID || '';
const PM2_REPORT = process.env.PM2_REPORT || '';
const CLEANUP_REPORT = process.env.CLEANUP_REPORT || '';
const HEALTH_REPORT = process.env.HEALTH_REPORT || '';

const NOTION_VERSION = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;
const MAX_PM2_REPORT_LENGTH = 3000;
const MAX_CLEANUP_REPORT_LENGTH = 2000;
const MAX_HEALTH_REPORT_LENGTH = 3000;

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
// 构建报告内容
// ══════════════════════════════════════════════════════════

function buildReportContent() {
  var now = new Date().toISOString();
  var dateStr = now.slice(0, 10);

  var sections = [];

  sections.push('## 📋 PM2 服务排查报告 · ' + dateStr);
  sections.push('');
  sections.push('| 字段 | 值 |');
  sections.push('|------|-----|');
  sections.push('| 执行者 | 铸渊Agent |');
  sections.push('| 执行时间 | ' + now + ' |');
  sections.push('| 来源 | GitHub Actions · pm2-server-diagnose |');
  sections.push('');

  if (PM2_REPORT) {
    sections.push('## 阶段一 · PM2 诊断结果');
    sections.push('');
    sections.push(PM2_REPORT.slice(0, MAX_PM2_REPORT_LENGTH));
    sections.push('');
  }

  if (CLEANUP_REPORT) {
    sections.push('## 清理操作结果');
    sections.push('');
    sections.push(CLEANUP_REPORT.slice(0, MAX_CLEANUP_REPORT_LENGTH));
    sections.push('');
  }

  if (HEALTH_REPORT) {
    sections.push('## 阶段二 · 全系统健康检查');
    sections.push('');
    sections.push(HEALTH_REPORT.slice(0, MAX_HEALTH_REPORT_LENGTH));
    sections.push('');
  }

  return sections.join('\n');
}

// ══════════════════════════════════════════════════════════
// 主函数 — 创建 Notion 诊断工单
// ══════════════════════════════════════════════════════════

async function createDiagnoseTicket() {
  if (!NOTION_TOKEN || !NOTION_TICKET_DB_ID) {
    console.log('⚠️ Notion credentials not configured, skipping ticket creation');
    console.log('  NOTION_TOKEN: ' + (NOTION_TOKEN ? '✅' : '❌'));
    console.log('  NOTION_TICKET_DB_ID: ' + (NOTION_TICKET_DB_ID ? '✅' : '❌'));
    process.exit(0);
  }

  var now = new Date();
  var dateStr = now.toISOString().slice(0, 10);
  var title = 'PM2服务排查报告 · ' + dateStr;
  var contentText = buildReportContent();

  // 将内容拆分成多个段落块（Notion 单个 rich_text 限制 2000 字符）
  var contentBlocks = [];
  var remaining = contentText;

  while (remaining.length > 0) {
    var chunk = remaining.slice(0, NOTION_RICH_TEXT_MAX);
    remaining = remaining.slice(NOTION_RICH_TEXT_MAX);
    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: chunk } }],
      },
    });
  }

  // 确保至少有一个内容块
  if (contentBlocks.length === 0) {
    contentBlocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [{ type: 'text', text: { content: '诊断报告（无详细输出）' } }],
      },
    });
  }

  var body = {
    parent: { database_id: NOTION_TICKET_DB_ID },
    properties: {
      '标题': { title: [{ type: 'text', text: { content: title } }] },
      '操作类型': { select: { name: '其他' } },
      '提交者': { rich_text: [{ type: 'text', text: { content: '铸渊Agent' } }] },
      '状态': { select: { name: '已完成' } },
      '优先级': { select: { name: 'P1' } },
    },
    children: contentBlocks,
  };

  console.log('📋 创建 PM2 诊断工单...');
  console.log('  标题: ' + title);
  console.log('  数据库: ' + NOTION_TICKET_DB_ID);
  console.log('  内容长度: ' + contentText.length + ' 字符');
  console.log('  内容块数: ' + contentBlocks.length);

  try {
    var result = await notionPost('/v1/pages', body);
    console.log('✅ Notion 诊断工单已创建: ' + result.id);
    console.log('  URL: ' + (result.url || 'N/A'));
  } catch (err) {
    console.error('❌ 工单创建失败: ' + err.message);
    // 不以失败退出，诊断本身已成功
    console.log('⚠️ 诊断结果已输出到 Actions 日志，Notion 写入失败不影响诊断');
    process.exit(0);
  }
}

createDiagnoseTicket();
