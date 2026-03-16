// scripts/skyeye/sync-to-notion.js
// 天眼·报告同步到 Notion
//
// 将天眼全局健康报告同步到 Notion 数据库
// 如果 NOTION_TOKEN 未设置则优雅跳过

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const SKYEYE_DIR = '/tmp/skyeye';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const SYSLOG_DB_ID = process.env.NOTION_SYSLOG_DB_ID;

const NOTION_TITLE_MAX = 100;
const NOTION_CONTENT_MAX = 2000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ Notion API 调用 ━━━
function notionRequest(apiPath, body) {
  return new Promise((resolve, reject) => {
    if (!NOTION_TOKEN) {
      return reject(new Error('NOTION_TOKEN 未设置'));
    }

    const postData = JSON.stringify(body);
    const options = {
      hostname: 'api.notion.com',
      path: apiPath,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`Notion API ${res.statusCode}: ${data.length > 200 ? data.substring(0, 200) + '...' : data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Notion API timeout')); });
    req.write(postData);
    req.end();
  });
}

// ━━━ 格式化报告为文本 ━━━
function formatReportText(report) {
  if (!report) return '天眼报告数据缺失';

  const lines = [
    `🦅 天眼报告 ${report.report_id}`,
    `整体健康: ${report.overall_health}`,
    `时间: ${report.timestamp}`,
    '',
    `🧠 核心大脑: ${report.brain_status.integrity}`,
    `📋 Workflow: ${report.workflow_health.healthy}/${report.workflow_health.total} 健康`,
    `📂 仓库结构: ${report.structure_health.core_dirs_ok ? '✅' : '❌'}`,
    `🌉 外部桥接: Notion=${report.bridge_health.notion_api} GitHub=${report.bridge_health.github_api}`,
    '',
    `🔬 诊断: ${report.diagnosis.total_issues} 个问题`,
    `   自动修复: ${report.diagnosis.auto_fixed}`,
    `   需人工: ${report.diagnosis.needs_human}`,
    `   观察中: ${report.diagnosis.watching}`
  ];

  if (report.repairs_applied.length > 0) {
    lines.push('', '🔧 已执行修复:');
    for (const r of report.repairs_applied) {
      lines.push(`   • ${r}`);
    }
  }

  if (report.tickets_created.length > 0) {
    lines.push('', '📨 生成工单:');
    for (const t of report.tickets_created) {
      lines.push(`   • ${t}`);
    }
  }

  return lines.join('\n').substring(0, NOTION_CONTENT_MAX);
}

// ━━━ 主同步流程 ━━━
async function syncToNotion() {
  console.log('📡 天眼·Notion 同步启动');

  if (!NOTION_TOKEN) {
    console.log('⚠️ NOTION_TOKEN 未设置，跳过 Notion 同步');
    return;
  }

  if (!SYSLOG_DB_ID) {
    console.log('⚠️ NOTION_SYSLOG_DB_ID 未设置，跳过 Notion 同步');
    return;
  }

  const report = readJSON(path.join(SKYEYE_DIR, 'full-report.json'));
  if (!report) {
    console.log('⚠️ 天眼报告不存在，跳过 Notion 同步');
    return;
  }

  const title = `🦅 天眼报告 ${report.report_id} · ${report.overall_health}`;
  const content = formatReportText(report);

  try {
    await notionRequest('/v1/pages', {
      parent: { database_id: SYSLOG_DB_ID },
      properties: {
        '标题': {
          title: [{ type: 'text', text: { content: title.substring(0, NOTION_TITLE_MAX) } }]
        },
        '接收时间': { date: { start: new Date().toISOString() } },
        '推送方': {
          rich_text: [{ type: 'text', text: { content: '天眼系统' } }]
        },
        '文件内容': {
          rich_text: [{ type: 'text', text: { content } }]
        }
      }
    });

    console.log('✅ 天眼报告已同步到 Notion');
  } catch (e) {
    console.error('⚠️ Notion 同步失败:', e.message);
    // 不阻断流程
  }
}

syncToNotion();
