// scripts/notion-signal-bridge.js
// 铸渊 ↔ Notion 信号桥（替代 ESP 邮件协议）
//
// 功能：
//   1. 轮询 Notion 工单簿，读取状态为「已发送」的新工单
//   2. 解析工单中的 OP 类型，执行对应操作
//   3. 回写工单状态 + 写入 Notion 信号日志
//   4. 同时写入本地 signal-log/ 文件（双写）
//   5. 读取广播归档，推送到聊天室子频道数据
//
// 用法：
//   node scripts/notion-signal-bridge.js poll      — 轮询工单簿
//   node scripts/notion-signal-bridge.js health     — 健康检查
//
// 必需环境变量：
//   NOTION_API_TOKEN   铸渊信号桥 Integration Token（GitHub Secret: NOTION_API_TOKEN）
//
// 可选环境变量：
//   WORKORDER_DB_ID    人格协作工单簿 database_id
//   SIGNAL_LOG_DB_ID   跨平台信号日志 database_id

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ═══════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════

const NOTION_VERSION       = '2022-06-28';
const NOTION_API_HOSTNAME  = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;

const SIGNAL_LOG_DIR       = path.join(__dirname, '../signal-log');
const SIGNAL_INDEX_PATH    = path.join(SIGNAL_LOG_DIR, 'index.json');

// Notion 数据库 ID（从环境变量或默认值）
// 注意：铸渊需从 Notion URL 中提取实际 ID，这里用占位符
const WORKORDER_DB_ID  = process.env.WORKORDER_DB_ID  || '';
const SIGNAL_LOG_DB_ID = process.env.SIGNAL_LOG_DB_ID || '';

// ═══════════════════════════════════════════════════════
// Notion API 基础调用
// ═══════════════════════════════════════════════════════

function notionRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   method,
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
      },
    };
    if (payload) opts.headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Notion API ${method} ${endpoint} → ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Notion API parse error: ${data.slice(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(new Error('Notion API 请求超时')); });
    if (payload) req.write(payload);
    req.end();
  });
}

function notionPost(endpoint, body, token) {
  return notionRequest('POST', endpoint, body, token);
}

function notionPatch(endpoint, body, token) {
  return notionRequest('PATCH', endpoint, body, token);
}

// ═══════════════════════════════════════════════════════
// Notion 属性构建辅助
// ═══════════════════════════════════════════════════════

function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function titleProp(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, 120) } }];
}

// ═══════════════════════════════════════════════════════
// 本地信号日志读写（与 esp-email-processor.js 相同逻辑）
// ═══════════════════════════════════════════════════════

function generateSignalId() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const index = loadSignalIndex();
  const seq   = String(index.total_count + 1).padStart(3, '0');
  return `SIG-${ymd}-${seq}`;
}

function loadSignalIndex() {
  if (!fs.existsSync(SIGNAL_INDEX_PATH)) {
    return {
      description: '铸渊信号日志目录索引 · AGE OS 信号协议（Notion API 直连）',
      last_updated: new Date().toISOString(),
      total_count: 0,
      signals: []
    };
  }
  return JSON.parse(fs.readFileSync(SIGNAL_INDEX_PATH, 'utf8'));
}

function saveSignalIndex(index) {
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(SIGNAL_INDEX_PATH, JSON.stringify(index, null, 2));
}

function writeLocalSignalLog(signal) {
  const dateStr  = signal.timestamp.slice(0, 7);
  const monthDir = path.join(SIGNAL_LOG_DIR, dateStr);
  fs.mkdirSync(monthDir, { recursive: true });

  const filePath = path.join(monthDir, `${signal.signal_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(signal, null, 2));

  const index = loadSignalIndex();
  index.total_count += 1;
  index.signals.unshift({
    signal_id:   signal.signal_id,
    trace_id:    signal.trace_id,
    type:        signal.signal_type,
    timestamp:   signal.timestamp,
    summary:     signal.summary,
    related_dev: signal.related_dev || null,
    file:        `${dateStr}/${signal.signal_id}.json`
  });
  saveSignalIndex(index);
  console.log(`📝 本地信号日志已写入: ${signal.signal_id}`);
}

// ═══════════════════════════════════════════════════════
// Notion 信号日志写入（双写：Notion + 本地）
// ═══════════════════════════════════════════════════════

async function writeNotionSignalLog(signal, token) {
  // 写入本地文件
  writeLocalSignalLog(signal);

  // 写入 Notion 信号日志数据库（如果配置了 ID）
  if (!SIGNAL_LOG_DB_ID) {
    console.log('⚠️  SIGNAL_LOG_DB_ID 未配置，跳过 Notion 信号日志写入');
    return;
  }

  try {
    await notionPost('/v1/pages', {
      parent: { database_id: SIGNAL_LOG_DB_ID },
      properties: {
        '信号编号':  { title: titleProp(signal.signal_id) },
        '信号类型':  { select: { name: signal.signal_type } },
        '方向':      { select: { name: signal.direction || 'GitHub→Notion' } },
        '发送方':    { select: { name: signal.sender || '铸渊' } },
        '接收方':    { select: { name: signal.receiver || '霜砚' } },
        'trace_id':  { rich_text: richText(signal.trace_id) },
        '摘要':      { rich_text: richText(signal.summary) },
        '执行结果':  { status: { name: signal.result || '成功' } }
      }
    }, token);
    console.log(`📡 Notion 信号日志已写入: ${signal.signal_id}`);
  } catch (err) {
    console.error(`⚠️  Notion 信号日志写入失败: ${err.message}`);
    // 本地已写入，Notion 写入失败不影响流程
  }
}

// ═══════════════════════════════════════════════════════
// 工单簿轮询
// ═══════════════════════════════════════════════════════

/**
 * 从工单簿中获取「已发送」状态的工单
 */
async function queryPendingWorkOrders(token) {
  if (!WORKORDER_DB_ID) {
    console.log('⚠️  WORKORDER_DB_ID 未配置，跳过工单轮询');
    console.log('   请设置环境变量 WORKORDER_DB_ID（从 Notion 工单簿 URL 提取）');
    return [];
  }

  const result = await notionPost(`/v1/databases/${WORKORDER_DB_ID}/query`, {
    filter: {
      property: '执行结果',
      status: { equals: '已发送' }
    },
    sorts: [{ timestamp: 'created_time', direction: 'ascending' }]
  }, token);

  return result.results || [];
}

/**
 * 解析工单页面属性
 */
function parseWorkOrder(page) {
  const props = page.properties || {};

  // 安全提取各类属性值
  const getTitle = (p) => p?.title?.[0]?.text?.content || '';
  const getRichText = (p) => p?.rich_text?.map(r => r.text?.content || '').join('') || '';
  const getSelect = (p) => p?.select?.name || '';
  const getStatus = (p) => p?.status?.name || '';

  return {
    page_id:    page.id,
    title:      getTitle(props['工单名称'] || props['Name'] || props['名称']),
    op_type:    getSelect(props['OP类型'] || props['操作类型']),
    priority:   getSelect(props['优先级']),
    status:     getStatus(props['执行结果']),
    payload:    getRichText(props['payload'] || props['指令内容']),
    trace_id:   getRichText(props['trace_id']),
    sender:     getSelect(props['发送方']),
    receiver:   getSelect(props['接收方']),
    created:    page.created_time,
  };
}

/**
 * 更新工单状态
 */
async function updateWorkOrderStatus(pageId, status, message, token) {
  const props = {
    '执行结果': { status: { name: status } }
  };
  // 如果有回执信息字段，也更新
  if (message) {
    props['回执信息'] = { rich_text: richText(message) };
  }

  await notionPatch(`/v1/pages/${pageId}`, { properties: props }, token);
  console.log(`✅ 工单 ${pageId.slice(0, 8)}... 状态更新为: ${status}`);
}

// ═══════════════════════════════════════════════════════
// 工单执行引擎
// ═══════════════════════════════════════════════════════

/**
 * 根据工单 OP 类型执行对应操作
 */
async function executeWorkOrder(wo, token) {
  const signalId = generateSignalId();
  const traceId  = wo.trace_id || `TRC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${signalId.slice(-3)}`;

  console.log(`\n🔧 处理工单: ${wo.title}`);
  console.log(`   OP: ${wo.op_type} | 优先级: ${wo.priority} | trace: ${traceId}`);

  let result  = '成功';
  let message = '';

  try {
    switch (wo.op_type) {
      case 'BROADCAST':
      case '广播推送':
        message = await handleBroadcast(wo);
        break;

      case 'STATUS_QUERY':
      case '状态查询':
        message = await handleStatusQuery(wo);
        break;

      case 'DEPLOY_CHECK':
      case '部署检查':
        message = await handleDeployCheck(wo);
        break;

      case 'DATA_SYNC':
      case '数据同步':
        message = await handleDataSync(wo);
        break;

      default:
        message = `未知操作类型: ${wo.op_type}，已记录，等待人工处理`;
        console.log(`⚠️  ${message}`);
        break;
    }
  } catch (err) {
    result  = '失败';
    message = `执行失败: ${err.message}`;
    console.error(`❌ ${message}`);
  }

  // 写回执到工单簿
  await updateWorkOrderStatus(wo.page_id, result, message, token);

  // 双写信号日志（本地 + Notion）
  const ackSignal = {
    signal_id:    signalId,
    signal_type:  'GL-ACK',
    trace_id:     traceId,
    timestamp:    new Date().toISOString(),
    sender:       '铸渊',
    receiver:     '霜砚',
    direction:    'GitHub→Notion',
    summary:      `${wo.op_type}: ${message.slice(0, 100)}`,
    result:       result,
    related_dev:  null,
    original_wo:  wo.title,
    esp_version:  '2.0-notion'
  };

  await writeNotionSignalLog(ackSignal, token);

  return { result, message };
}

// ═══════════════════════════════════════════════════════
// OP 处理器
// ═══════════════════════════════════════════════════════

async function handleBroadcast(wo) {
  // 读取广播内容，写入聊天室可读的文件
  const broadcastDir = path.join(__dirname, '../broadcasts-outbox');
  if (!fs.existsSync(broadcastDir)) {
    return '广播目录不存在，跳过';
  }

  console.log('📢 处理广播推送工单');
  // 将广播内容标记为待推送
  const pendingFile = path.join(broadcastDir, 'pending-push.json');
  const pending = fs.existsSync(pendingFile)
    ? JSON.parse(fs.readFileSync(pendingFile, 'utf8'))
    : { broadcasts: [] };

  pending.broadcasts.push({
    title:     wo.title,
    content:   wo.payload,
    timestamp: new Date().toISOString(),
    trace_id:  wo.trace_id
  });

  fs.writeFileSync(pendingFile, JSON.stringify(pending, null, 2));
  return `广播已加入推送队列 (${pending.broadcasts.length} 条待推)`;
}

async function handleStatusQuery(wo) {
  // 收集系统状态信息
  console.log('📊 处理状态查询工单');
  const devStatusPath = path.join(__dirname, '../.github/persona-brain/dev-status.json');
  if (fs.existsSync(devStatusPath)) {
    const status = JSON.parse(fs.readFileSync(devStatusPath, 'utf8'));
    const teamCount = status.team_status?.length || 0;
    const active = status.team_status?.filter(d => d.status?.includes('🟢')).length || 0;
    return `团队状态: ${teamCount} 名开发者, ${active} 人推进中`;
  }
  return '状态文件不存在';
}

async function handleDeployCheck(wo) {
  console.log('🚀 处理部署检查工单');
  // 检查关键文件是否存在
  const checks = [
    { name: 'docs/index.html', label: '铸渊聊天室' },
    { name: 'backend-integration/api-proxy.js', label: 'API 代理' },
    { name: '.github/workflows/deploy-pages.yml', label: '部署工作流' },
  ];
  const results = checks.map(c => {
    const exists = fs.existsSync(path.join(__dirname, '..', c.name));
    return `${exists ? '✅' : '❌'} ${c.label}`;
  });
  return results.join(' | ');
}

async function handleDataSync(wo) {
  console.log('🔄 处理数据同步工单');
  return '数据同步指令已接收，等待下次 CI 流程执行';
}

// ═══════════════════════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════════════════════

async function healthCheck(token) {
  console.log('🏥 Notion 信号桥健康检查\n');
  console.log(`   Notion API Token: ${token ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`   工单簿 DB ID:     ${WORKORDER_DB_ID ? '✅ ' + WORKORDER_DB_ID.slice(0, 8) + '...' : '⚠️  未配置'}`);
  console.log(`   信号日志 DB ID:   ${SIGNAL_LOG_DB_ID ? '✅ ' + SIGNAL_LOG_DB_ID.slice(0, 8) + '...' : '⚠️  未配置'}`);
  console.log(`   本地信号日志:     ${fs.existsSync(SIGNAL_INDEX_PATH) ? '✅ 存在' : '⚠️  不存在'}`);

  if (token) {
    try {
      // 测试 API 连通性 — 获取 bot user
      const me = await notionRequest('GET', '/v1/users/me', null, token);
      console.log(`   API 连通性:      ✅ Bot: ${me.name || me.id}`);
    } catch (err) {
      console.log(`   API 连通性:      ❌ ${err.message}`);
    }
  }

  // 本地信号统计
  const index = loadSignalIndex();
  console.log(`\n   📊 本地信号总数: ${index.total_count}`);
  if (index.signals.length > 0) {
    console.log(`   📝 最近信号: ${index.signals[0].signal_id} (${index.signals[0].type})`);
  }

  console.log('\n✅ 健康检查完成');
}

// ═══════════════════════════════════════════════════════
// 主入口
// ═══════════════════════════════════════════════════════

async function main() {
  const cmd   = process.argv[2] || 'poll';
  const token = process.env.NOTION_API_TOKEN;

  if (!token) {
    console.error('❌ 缺少环境变量 NOTION_API_TOKEN');
    console.error('   请在 GitHub Secrets 中配置 NOTION_API_TOKEN');
    process.exit(1);
  }

  console.log(`🔌 铸渊 Notion 信号桥 v1.0`);
  console.log(`   时间: ${new Date().toISOString()}`);
  console.log(`   命令: ${cmd}\n`);

  switch (cmd) {
    case 'poll': {
      console.log('📡 开始轮询 Notion 工单簿...\n');

      const workOrders = await queryPendingWorkOrders(token);

      if (workOrders.length === 0) {
        console.log('✅ 无待处理工单');
        return;
      }

      console.log(`📋 发现 ${workOrders.length} 条待处理工单\n`);

      let success = 0, failed = 0;

      for (const page of workOrders) {
        const wo = parseWorkOrder(page);
        try {
          const { result } = await executeWorkOrder(wo, token);
          if (result === '成功') success++;
          else failed++;
        } catch (err) {
          console.error(`❌ 工单处理异常: ${err.message}`);
          failed++;
        }
      }

      console.log(`\n📊 处理结果: ${success} 成功, ${failed} 失败 (共 ${workOrders.length} 条)`);
      break;
    }

    case 'health':
      await healthCheck(token);
      break;

    default:
      console.error(`❌ 未知命令: ${cmd}`);
      console.error('   可用命令: poll, health');
      process.exit(1);
  }
}

main().catch(err => {
  console.error(`\n💥 致命错误: ${err.message}`);
  process.exit(1);
});
