#!/usr/bin/env node
/**
 * sync-patrol-to-notion.js — 同步巡检结果到 Notion
 * 铸渊 · 光湖服务器巡检自动化
 *
 * 环境变量:
 *   NOTION_TOKEN         — Notion API Token
 *   NOTION_TICKET_DB_ID  — 霜砚工单队列 Database ID（异常时自动开工单）
 *
 * 读取 patrol-report.json，写入 Notion 工单队列（仅有异常时）
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const TICKET_DB_ID = process.env.NOTION_TICKET_DB_ID;

if (!NOTION_TOKEN) {
  console.error('⚠️ 缺少环境变量: NOTION_TOKEN');
  process.exit(1);
}

const REPORT_FILE = path.join(process.cwd(), 'patrol-report.json');

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

async function createTicket(alert, report) {
  if (!TICKET_DB_ID) {
    console.log(`  ⚠️ 未配置 NOTION_TICKET_DB_ID，跳过工单创建: ${alert}`);
    return;
  }

  const res = await notionRequest('POST', 'pages', {
    parent: { database_id: TICKET_DB_ID },
    properties: {
      title: { title: [{ text: { content: `🔍 服务器巡检异常: ${alert}` } }] },
      '来源': { select: { name: '铸渊巡检' } },
      '状态': { select: { name: '待处理' } },
      '优先级': { select: { name: '高' } },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            text: {
              content: `巡检时间: ${report.timestamp}\nNginx状态: ${report.nginx_status}\n磁盘使用率: ${report.disk_usage_percent}%\n\n异常详情: ${alert}`,
            },
          }],
        },
      },
    ],
  });

  if (res.status === 200) {
    console.log(`  ✅ 工单已创建: ${alert}`);
  } else {
    console.log(`  ⚠️ 工单创建失败: ${alert} (HTTP ${res.status})`);
  }
}

async function main() {
  console.log('📝 sync-patrol-to-notion · 开始同步巡检结果');

  if (!fs.existsSync(REPORT_FILE)) {
    console.log('⚠️ patrol-report.json 不存在，跳过同步');
    return;
  }

  let report;
  try {
    report = JSON.parse(fs.readFileSync(REPORT_FILE, 'utf-8'));
  } catch (err) {
    console.error('❌ 解析 patrol-report.json 失败:', err.message);
    process.exit(1);
  }

  console.log(`📊 巡检状态: ${report.overall}`);
  console.log(`   异常数: ${report.alert_count} | 自动修复: ${report.fixed_count}`);

  if (report.overall === 'healthy') {
    console.log('✅ 服务器健康，无需创建工单');
    return;
  }

  // 找出未能自动修复的异常 → 开工单
  const autoFixed = report.auto_fixed || [];
  const unresolvedAlerts = (report.alerts || []).filter(alert => {
    // 检查是否有对应的自动修复记录（修复消息中包含完整的异常描述关键词）
    return !autoFixed.some(fix => {
      const alertKey = alert.replace(/[：:].*/g, '').trim();
      return fix.includes(alertKey);
    });
  });

  if (unresolvedAlerts.length === 0) {
    console.log('✅ 所有异常已自动修复，无需创建工单');
    return;
  }

  console.log(`📋 ${unresolvedAlerts.length} 个未修复异常，创建工单...`);

  for (const alert of unresolvedAlerts) {
    try {
      await createTicket(alert, report);
    } catch (err) {
      console.log(`  ⚠️ 工单创建异常: ${alert} (${err.message})`);
    }
  }

  console.log('✅ 同步完成');
}

main().catch((err) => {
  console.error('❌ sync-patrol-to-notion 异常:', err.message);
  process.exit(1);
});
