// scripts/notion-heartbeat.js
// 铸渊 · Phase B3 · 工单心跳监控脚本
//
// 定时检测 Notion 工单队列中 receipt_status = "pending" 的工单，
// 如果超过 5 分钟未回执，重新触发人格体唤醒（最多 3 次）。
// 超过 3 次仍无回执，标记工单异常并发邮件通知冰朔。
//
// 环境变量：
//   NOTION_TOKEN           Notion API token
//   NOTION_TICKET_DB_ID    工单队列数据库 ID
//   GITHUB_TOKEN           GitHub API token（用于触发 workflow_dispatch）
//   SMTP_USER              邮件发送者
//   SMTP_PASS              邮件授权码
//   ALERT_EMAIL            告警邮箱（默认 565183519@qq.com）
//   LLM_API_KEY            LLM 密钥（传递给 persona-invoke）
//   LLM_BASE_URL           LLM 地址（传递给 persona-invoke）
//   CORE_BRAIN_PAGE_ID     核心大脑页面 ID
//   PORTRAIT_DB_ID         画像库 ID
//   FINGERPRINT_DB_ID      指纹表 ID

'use strict';

var https = require('https');

var NOTION_TOKEN = process.env.NOTION_TOKEN || '';
var NOTION_TICKET_DB_ID = process.env.NOTION_TICKET_DB_ID || '';
var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var ALERT_EMAIL = process.env.ALERT_EMAIL || '565183519@qq.com';
var SMTP_USER = process.env.SMTP_USER || '';
var SMTP_PASS = process.env.SMTP_PASS || '';

var NOTION_VERSION = '2022-06-28';
var HEARTBEAT_TIMEOUT_MS = (parseInt(process.env.HEARTBEAT_TIMEOUT_MINUTES, 10) || 5) * 60 * 1000;
var MAX_RETRIES = parseInt(process.env.MAX_RETRY_COUNT, 10) || 3;

var REPO_OWNER = 'qinfendebingshuo';
var REPO_NAME = 'guanghulab';

// ══════════════════════════════════════════════════════════
// HTTP 工具
// ══════════════════════════════════════════════════════════

function httpsPost(hostname, apiPath, body, headers) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(body);
    var opts = {
      hostname: hostname,
      port: 443,
      path: apiPath,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }, headers || {}),
    };
    var req = https.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function httpsPatch(hostname, apiPath, body, headers) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(body);
    var opts = {
      hostname: hostname,
      port: 443,
      path: apiPath,
      method: 'PATCH',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      }, headers || {}),
    };
    var req = https.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

var notionHeaders = {
  'Authorization': 'Bearer ' + NOTION_TOKEN,
  'Notion-Version': NOTION_VERSION,
};

// ══════════════════════════════════════════════════════════
// Step 1: 查询待处理工单
// ══════════════════════════════════════════════════════════

async function queryPendingTickets() {
  console.log('🔍 查询待处理工单...');

  if (!NOTION_TOKEN || !NOTION_TICKET_DB_ID) {
    console.log('⚠️  缺少 Notion 配置，跳过');
    return [];
  }

  // 查询 receipt_status = pending 的工单
  // 由于 Notion 数据库可能没有 receipt_status 字段，
  // 改为查询状态 = "待处理" 的工单
  var queryBody = {
    filter: {
      property: '状态',
      select: {
        equals: '待处理',
      },
    },
    page_size: 20,
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }],
  };

  try {
    var res = await httpsPost('api.notion.com', '/v1/databases/' + NOTION_TICKET_DB_ID + '/query', queryBody, notionHeaders);
    var parsed = JSON.parse(res.body);

    if (res.status >= 200 && res.status < 300) {
      var tickets = parsed.results || [];
      console.log('  → 找到 ' + tickets.length + ' 个待处理工单');
      return tickets;
    } else {
      console.log('⚠️  查询失败: ' + (parsed.message || res.body));
      return [];
    }
  } catch (err) {
    console.log('⚠️  查询异常: ' + err.message);
    return [];
  }
}

// ══════════════════════════════════════════════════════════
// Step 2: 检测超时工单
// ══════════════════════════════════════════════════════════

function filterTimedOutTickets(tickets) {
  var now = Date.now();
  var timedOut = [];

  tickets.forEach(function (ticket) {
    var createdTime = new Date(ticket.created_time).getTime();
    var age = now - createdTime;

    // 只处理来自 "铸渊Agent·自动管道" 的 SYSLOG 工单
    var props = ticket.properties || {};
    var submitter = '';
    if (props['提交者'] && props['提交者'].rich_text) {
      submitter = props['提交者'].rich_text.map(function (t) { return t.plain_text || ''; }).join('');
    }

    // 只对自动管道创建的工单做心跳检测
    if (!submitter.includes('铸渊Agent') && !submitter.includes('自动管道')) {
      return;
    }

    // 超过 5 分钟未完成
    if (age > HEARTBEAT_TIMEOUT_MS) {
      var title = '';
      if (props['标题'] && props['标题'].title) {
        title = props['标题'].title.map(function (t) { return t.plain_text || ''; }).join('');
      }

      timedOut.push({
        id: ticket.id,
        title: title,
        createdTime: ticket.created_time,
        ageMinutes: Math.round(age / 60000),
      });
    }
  });

  console.log('  → ' + timedOut.length + ' 个工单超时（> 5 分钟）');
  return timedOut;
}

// ══════════════════════════════════════════════════════════
// Step 3: 触发重试（通过 workflow_dispatch）
// ══════════════════════════════════════════════════════════

async function triggerRetry(ticket) {
  if (!GITHUB_TOKEN) {
    console.log('⚠️  缺少 GITHUB_TOKEN，无法触发重试');
    return false;
  }

  console.log('🔄 重试唤醒: ' + ticket.title + ' (超时 ' + ticket.ageMinutes + ' 分钟)');

  // 从工单标题提取 broadcast_id
  var bcMatch = (ticket.title || '').match(/BC-[A-Z0-9]+-\d+-[A-Z]+/i);
  var broadcastId = bcMatch ? bcMatch[0] : 'UNKNOWN';

  try {
    var res = await httpsPost('api.github.com',
      '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/actions/workflows/persona-invoke.yml/dispatches',
      {
        ref: 'main',
        inputs: {
          work_order_id: ticket.id,
          task_id: broadcastId,
          developer: 'heartbeat-retry',
          action: 'retry',
        },
      },
      {
        'Authorization': 'Bearer ' + GITHUB_TOKEN,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'ZhuyuanHeartbeat/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      }
    );

    if (res.status === 204 || res.status === 200) {
      console.log('  → ✅ workflow_dispatch 触发成功');
      return true;
    } else {
      console.log('  → ⚠️ 触发失败: HTTP ' + res.status + ' ' + res.body);
      return false;
    }
  } catch (err) {
    console.log('  → ⚠️ 触发异常: ' + err.message);
    return false;
  }
}

// ══════════════════════════════════════════════════════════
// Step 4: 标记工单异常
// ══════════════════════════════════════════════════════════

async function markTicketError(ticketId) {
  try {
    await httpsPatch('api.notion.com', '/v1/pages/' + ticketId, {
      properties: {
        '状态': { select: { name: '⚠️ 异常·等人工介入' } },
      },
    }, notionHeaders);
    console.log('  → 工单已标记为 ⚠️ 异常·等人工介入');
  } catch (err) {
    console.log('  → 标记失败: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════
// Step 5: 发送告警邮件
// ══════════════════════════════════════════════════════════

async function sendAlertEmail(timedOutTickets) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('⚠️  SMTP 未配置，跳过告警邮件');
    return;
  }

  try {
    var nodemailer = require('nodemailer');

    var ticketList = timedOutTickets.map(function (t) {
      return '- ' + t.title + ' (超时 ' + t.ageMinutes + ' 分钟, 重试已耗尽)';
    }).join('\n');

    var transporter = nodemailer.createTransport({
      host: 'smtp.qq.com',
      port: 465,
      secure: true,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });

    await transporter.sendMail({
      from: '"光湖系统·告警" <' + SMTP_USER + '>',
      to: ALERT_EMAIL,
      subject: '[光湖系统] ⚠️ SYSLOG 工单处理超时告警',
      html: [
        '<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e1b2e;color:#e2e8f0;border-radius:10px">',
        '<h2 style="color:#f59e0b">⚠️ 工单处理超时告警</h2>',
        '<p>以下工单超过 3 次重试仍未收到人格体回执：</p>',
        '<pre style="background:#0f0d1a;padding:12px;border-radius:6px;color:#94a3b8">' + ticketList + '</pre>',
        '<p>请登录 Notion 工单队列检查。</p>',
        '<p style="color:#64748b;font-size:12px;margin-top:16px">🌀 铸渊 · 心跳监控 · 自动告警</p>',
        '</div>',
      ].join('\n'),
    });

    console.log('📧 告警邮件已发送至 ' + ALERT_EMAIL);
  } catch (err) {
    console.log('⚠️  告警邮件发送失败: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('💓 铸渊 · 工单心跳监控（Phase B3）');
  console.log('═══════════════════════════════════════════');
  console.log('  时间: ' + new Date().toISOString());
  console.log('');

  // Step 1: 查询待处理工单
  var tickets = await queryPendingTickets();
  if (tickets.length === 0) {
    console.log('✅ 无待处理工单，心跳正常');
    return;
  }

  // Step 2: 筛选超时工单
  var timedOut = filterTimedOutTickets(tickets);
  if (timedOut.length === 0) {
    console.log('✅ 所有工单均在处理窗口内，心跳正常');
    return;
  }

  // Step 3 & 4: 对超时工单执行重试或标记异常
  var errorTickets = [];

  for (var i = 0; i < timedOut.length; i++) {
    var ticket = timedOut[i];
    // 基于超时时间估算重试次数（每 5 分钟一次）
    var estimatedRetries = Math.floor(ticket.ageMinutes / 5);

    if (estimatedRetries < MAX_RETRIES) {
      // 重试
      await triggerRetry(ticket);
    } else {
      // 超过最大重试次数，标记异常
      console.log('❌ 工单 ' + ticket.title + ' 重试 ' + MAX_RETRIES + ' 次仍无回执');
      await markTicketError(ticket.id);
      errorTickets.push(ticket);
    }
  }

  // Step 5: 发送告警邮件（如有异常工单）
  if (errorTickets.length > 0) {
    await sendAlertEmail(errorTickets);
  }

  console.log('');
  console.log('✅ 心跳检测完成');
}

main().catch(function (err) {
  console.error('❌ 心跳监控失败: ' + err.message);
  process.exit(1);
});
