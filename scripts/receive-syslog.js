// scripts/receive-syslog.js
// 铸渊 · SYSLOG 接收处理脚本
//
// 接收 repository_dispatch 传来的 SYSLOG JSON，执行三步操作：
//   ① 存入 syslog/YYYY-MM-DD_BC-XXX-YYY-ZZ.json
//   ② Notion API 创建 SYSLOG 收件箱条目
//   ③ Notion API 创建霜砚工单（触发巡检引擎）
//
// 环境变量：
//   SYSLOG_JSON            SYSLOG 完整 JSON 字符串
//   NOTION_TOKEN           Notion API token
//   NOTION_SYSLOG_DB_ID    SYSLOG 收件箱数据库 ID
//   NOTION_TICKET_DB_ID    霜砚工单数据库 ID

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;
const SYSLOG_DIR          = path.resolve(__dirname, '..', 'syslog');

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
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
// Notion 属性构建辅助
// ══════════════════════════════════════════════════════════

function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks;
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

function checkboxProp(val) {
  return { checkbox: !!val };
}

// ══════════════════════════════════════════════════════════
// SYSLOG 验证
// ══════════════════════════════════════════════════════════

const VALID_PROTOCOL_VERSIONS = ['4.0', 'v4.0', '4.0.0'];

function validateSyslog(syslog) {
  const errors = [];
  if (!syslog.protocol_version) {
    errors.push('缺少 protocol_version 字段');
  } else if (!VALID_PROTOCOL_VERSIONS.includes(String(syslog.protocol_version))) {
    errors.push('protocol_version 不合法: ' + syslog.protocol_version);
  }
  if (!syslog.dev_id && !syslog.developer_id) {
    errors.push('缺少 dev_id 或 developer_id 字段');
  }
  return errors;
}

// ══════════════════════════════════════════════════════════
// 步骤 ①：存入仓库
// ══════════════════════════════════════════════════════════

function saveSyslogToFile(syslog) {
  if (!fs.existsSync(SYSLOG_DIR)) {
    fs.mkdirSync(SYSLOG_DIR, { recursive: true });
  }

  const dateStr = new Date().toISOString().split('T')[0];
  const broadcastId = syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN';
  const devId = syslog.dev_id || syslog.developer_id || 'UNKNOWN';
  const filename = dateStr + '_' + broadcastId + '_' + devId + '.json';
  const filepath = path.join(SYSLOG_DIR, filename);

  fs.writeFileSync(filepath, JSON.stringify(syslog, null, 2), 'utf8');
  console.log('  → 已保存: syslog/' + filename);
  return filepath;
}

// ══════════════════════════════════════════════════════════
// 步骤 ②：创建 Notion SYSLOG 收件箱条目
// ══════════════════════════════════════════════════════════

async function createSyslogEntry(syslog, token, dbId) {
  const broadcastId = syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN';
  const devId = syslog.dev_id || syslog.developer_id || 'UNKNOWN';
  const dateStr = new Date().toISOString().split('T')[0];

  const properties = {
    '标题':           titleProp('SYSLOG · ' + broadcastId + ' · ' + devId),
    '广播编号':       richTextProp(broadcastId),
    '开发者编号':     richTextProp(devId),
    '协议版本':       richTextProp(String(syslog.protocol_version || '')),
    '提交日期':       dateProp(dateStr),
    '霜砚已读':       checkboxProp(false),
  };

  // 可选字段
  if (syslog.status) properties['状态'] = selectProp(syslog.status);
  if (syslog.summary) properties['摘要'] = richTextProp(syslog.summary);

  const body = {
    parent: { database_id: dbId },
    properties,
    children: [
      {
        object: 'block',
        type: 'code',
        code: {
          rich_text: richText(JSON.stringify(syslog, null, 2)),
          language: 'json',
        },
      },
    ],
  };

  const result = await notionPost('/v1/pages', body, token);
  console.log('  → Notion SYSLOG 收件箱条目已创建: ' + result.id);
  return result;
}

// ══════════════════════════════════════════════════════════
// 步骤 ③：创建霜砚工单
// ══════════════════════════════════════════════════════════

async function createTicket(syslog, token, dbId) {
  const broadcastId = syslog.broadcast_id || syslog.broadcastId || 'UNKNOWN';
  const devId = syslog.dev_id || syslog.developer_id || 'UNKNOWN';
  const dateStr = new Date().toISOString().split('T')[0];

  const properties = {
    '标题':       titleProp('SYSLOG 回传｜' + broadcastId + ' · ' + devId),
    '操作类型':   selectProp('其他'),
    '提交者':     richTextProp('巡检引擎'),
    '提交日期':   dateProp(dateStr),
    '状态':       selectProp('待处理'),
    '优先级':     selectProp('P1'),
  };

  // 添加关联信息
  if (broadcastId !== 'UNKNOWN') properties['广播编号'] = richTextProp(broadcastId);
  if (devId !== 'UNKNOWN') properties['开发者编号'] = richTextProp(devId);

  const body = {
    parent: { database_id: dbId },
    properties,
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{
            type: 'text',
            text: { content: '📥 SYSLOG 回传，来自 ' + devId + '，关联广播 ' + broadcastId },
          }],
        },
      },
      {
        object: 'block',
        type: 'code',
        code: {
          rich_text: richText(JSON.stringify(syslog, null, 2)),
          language: 'json',
        },
      },
    ],
  };

  const result = await notionPost('/v1/pages', body, token);
  console.log('  → 霜砚工单已创建: ' + result.id);
  return result;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const syslogJson   = process.env.SYSLOG_JSON;
  const notionToken  = process.env.NOTION_TOKEN;
  const syslogDbId   = process.env.NOTION_SYSLOG_DB_ID;
  const ticketDbId   = process.env.NOTION_TICKET_DB_ID;

  if (!syslogJson) {
    console.error('❌ 缺少 SYSLOG_JSON 环境变量');
    process.exit(1);
  }

  // 解析 SYSLOG JSON
  let syslog;
  try {
    syslog = JSON.parse(syslogJson);
  } catch (e) {
    console.error('❌ SYSLOG JSON 解析失败: ' + e.message);
    process.exit(1);
  }

  // 验证 SYSLOG
  console.log('🔍 验证 SYSLOG...');
  const errors = validateSyslog(syslog);
  if (errors.length > 0) {
    console.error('❌ SYSLOG 验证失败:');
    errors.forEach(e => console.error('  - ' + e));
    process.exit(1);
  }
  console.log('  → 验证通过 (protocol_version: ' + syslog.protocol_version + ')');

  // 步骤①：存入仓库
  console.log('💾 步骤①: 存入仓库 syslog/ 目录...');
  saveSyslogToFile(syslog);

  // 步骤②：创建 Notion SYSLOG 收件箱条目
  if (notionToken && syslogDbId) {
    console.log('📝 步骤②: 创建 Notion SYSLOG 收件箱条目...');
    await createSyslogEntry(syslog, notionToken, syslogDbId);
  } else {
    console.log('⚠️  步骤②: 缺少 NOTION_TOKEN 或 NOTION_SYSLOG_DB_ID，跳过 Notion 收件箱');
  }

  // 步骤③：创建霜砚工单
  if (notionToken && ticketDbId) {
    console.log('📋 步骤③: 创建霜砚工单...');
    await createTicket(syslog, notionToken, ticketDbId);
  } else {
    console.log('⚠️  步骤③: 缺少 NOTION_TOKEN 或 NOTION_TICKET_DB_ID，跳过工单创建');
  }

  console.log('✅ SYSLOG 接收处理完成');
}

main().catch(err => {
  console.error('❌ 处理失败: ' + err.message);
  process.exit(1);
});
