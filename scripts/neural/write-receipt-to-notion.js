// scripts/neural/write-receipt-to-notion.js
// 📡 指令回执自动写入 Notion
// 铸渊每次执行完指令后，自动将回执写入 Notion「指令回执追踪表」
// 实现 指令→执行→回执 全链路自动闭环
//
// 用法：
//   node scripts/neural/write-receipt-to-notion.js \
//     --instruction-id "ZY-XXX" \
//     --status "success" \
//     --workflow "workflow-name" \
//     [--summary "执行摘要"] \
//     [--receipt "回执详情"] \
//     [--new-files 0] \
//     [--modified-files 0] \
//     [--related-agent "AG-TY-01"]
//
// 环境变量：
//   NOTION_API_KEY — Notion API 密钥（必须）
//   RECEIPT_DB_ID  — 指令回执追踪表的 Notion Database ID（必须）
//
// 铁律：
//   1. 写入失败不阻塞主流程
//   2. 同一指令编号幂等（重复写入 = 更新）
//   3. 失败时写入本地 SYSLOG 报错

'use strict';

var fs = require('fs');
var path = require('path');
var https = require('https');

// ━━━ 配置 ━━━

var RECEIPT_TRACKER_CONFIG = {
  // 字段映射 — Notion 数据库字段名
  fieldMap: {
    instructionId: '指令编号',
    summary: '指令摘要',
    status: '执行状态',
    receipt: '铸渊回执',
    receiptTime: '回执时间',
    newFiles: '新增文件数',
    modifiedFiles: '修改文件数',
    relatedAgent: '关联Agent',
    timeoutStatus: '回执超时'
  },

  // 超时阈值（小时）
  timeoutThresholds: {
    warning: 24,
    critical: 72
  },

  // 状态映射
  statusMap: {
    'success': '✅ 已完成',
    'failure': '❌ 执行失败',
    'cancelled': '⏸️ 已挂起',
    'skipped': '⏸️ 已挂起'
  }
};

var LOCAL_RECEIPT_DIR = 'data/neural-reports/receipts';
var SYSLOG_DIR = 'data/neural-reports/syslog';

// ━━━ 参数解析 ━━━

function parseArgs() {
  var args = process.argv.slice(2);
  var parsed = {};

  for (var i = 0; i < args.length; i++) {
    if (args[i] === '--instruction-id' && args[i + 1]) {
      parsed.instructionId = args[++i];
    } else if (args[i] === '--status' && args[i + 1]) {
      parsed.status = args[++i];
    } else if (args[i] === '--workflow' && args[i + 1]) {
      parsed.workflow = args[++i];
    } else if (args[i] === '--summary' && args[i + 1]) {
      parsed.summary = args[++i];
    } else if (args[i] === '--receipt' && args[i + 1]) {
      parsed.receipt = args[++i];
    } else if (args[i] === '--new-files' && args[i + 1]) {
      parsed.newFiles = parseInt(args[++i], 10) || 0;
    } else if (args[i] === '--modified-files' && args[i + 1]) {
      parsed.modifiedFiles = parseInt(args[++i], 10) || 0;
    } else if (args[i] === '--related-agent' && args[i + 1]) {
      parsed.relatedAgent = args[++i];
    }
  }

  return parsed;
}

// ━━━ Notion API 封装（纯 https，无外部依赖）━━━

function notionRequest(method, endpoint, body, token) {
  return new Promise(function(resolve, reject) {
    var bodyStr = body ? JSON.stringify(body) : '';

    var options = {
      hostname: 'api.notion.com',
      port: 443,
      path: '/v1' + endpoint,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };

    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          var parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API response parse error: ' + data.substring(0, 200)));
        }
      });
    });

    req.on('error', function(e) {
      reject(new Error('Notion API request error: ' + e.message));
    });

    req.setTimeout(30000, function() {
      req.destroy();
      reject(new Error('Notion API request timeout (30s)'));
    });

    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ━━━ Notion 属性构建 ━━━

function buildNotionProperties(receipt) {
  var fm = RECEIPT_TRACKER_CONFIG.fieldMap;
  var statusText = RECEIPT_TRACKER_CONFIG.statusMap[receipt.status] || '⏸️ 已挂起';

  var properties = {};

  // 指令编号 (title)
  properties[fm.instructionId] = {
    title: [{ text: { content: receipt.instructionId || 'AUTO' } }]
  };

  // 指令摘要 (rich_text)
  properties[fm.summary] = {
    rich_text: [{ text: { content: receipt.summary || receipt.workflow || '' } }]
  };

  // 执行状态 (status)
  properties[fm.status] = {
    status: { name: statusText }
  };

  // 铸渊回执 (rich_text)
  var receiptText = receipt.receipt || (statusText + ' · ' + (receipt.workflow || ''));
  properties[fm.receipt] = {
    rich_text: [{ text: { content: receiptText.substring(0, 2000) } }]
  };

  // 回执时间 (date)
  properties[fm.receiptTime] = {
    date: { start: new Date().toISOString().split('T')[0] }
  };

  // 新增文件数 (number)
  if (typeof receipt.newFiles === 'number') {
    properties[fm.newFiles] = { number: receipt.newFiles };
  }

  // 修改文件数 (number)
  if (typeof receipt.modifiedFiles === 'number') {
    properties[fm.modifiedFiles] = { number: receipt.modifiedFiles };
  }

  // 关联Agent (rich_text)
  if (receipt.relatedAgent) {
    properties[fm.relatedAgent] = {
      rich_text: [{ text: { content: receipt.relatedAgent } }]
    };
  }

  // 回执超时 (select)
  properties[fm.timeoutStatus] = {
    select: { name: '🟢 正常' }
  };

  return properties;
}

// ━━━ 写入 Notion ━━━

async function writeReceiptToNotion(receipt, token, databaseId) {
  console.log('📡 写入回执到 Notion · 指令: ' + receipt.instructionId);

  // 先查询是否已有该指令编号的记录（幂等）
  var queryBody = {
    database_id: databaseId,
    filter: {
      property: RECEIPT_TRACKER_CONFIG.fieldMap.instructionId,
      title: { equals: receipt.instructionId }
    }
  };

  var existing = await notionRequest('POST', '/databases/' + databaseId + '/query', queryBody, token);

  var properties = buildNotionProperties(receipt);

  if (existing.results && existing.results.length > 0) {
    // 更新已有记录
    var pageId = existing.results[0].id;
    await notionRequest('PATCH', '/pages/' + pageId, { properties: properties }, token);
    console.log('✅ 已更新现有记录: ' + pageId);
  } else {
    // 创建新记录
    await notionRequest('POST', '/pages', {
      parent: { database_id: databaseId },
      properties: properties
    }, token);
    console.log('✅ 已创建新记录');
  }
}

// ━━━ 本地兜底写入 ━━━

function writeLocalReceipt(receipt) {
  try {
    fs.mkdirSync(LOCAL_RECEIPT_DIR, { recursive: true });

    var now = new Date();
    var cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    var dateStr = cstTime.toISOString().split('T')[0];
    var timeStr = cstTime.toISOString().replace(/[-:]/g, '').split('.')[0];

    var filename = 'receipt-' + timeStr + '.json';
    var fullPath = path.join(LOCAL_RECEIPT_DIR, filename);

    var localReceipt = {
      instruction_id: receipt.instructionId,
      workflow: receipt.workflow,
      status: receipt.status,
      summary: receipt.summary || '',
      receipt_text: receipt.receipt || '',
      new_files: receipt.newFiles || 0,
      modified_files: receipt.modifiedFiles || 0,
      related_agent: receipt.relatedAgent || '',
      timestamp: now.toISOString(),
      notion_synced: false
    };

    fs.writeFileSync(fullPath, JSON.stringify(localReceipt, null, 2));
    console.log('💾 本地回执已保存: ' + fullPath);
    return fullPath;
  } catch (e) {
    console.error('❌ 本地回执保存失败: ' + e.message);
    return null;
  }
}

// ━━━ SYSLOG 报错 ━━━

function writeSyslogError(message, receipt) {
  try {
    fs.mkdirSync(SYSLOG_DIR, { recursive: true });

    var now = new Date();
    var cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    var timeStr = cstTime.toISOString().replace(/[-:]/g, '').split('.')[0];

    var logEntry = {
      level: 'ERROR',
      source: 'write-receipt-to-notion',
      message: message,
      instruction_id: receipt ? receipt.instructionId : 'unknown',
      timestamp: now.toISOString()
    };

    var filename = 'receipt-error-' + timeStr + '.json';
    fs.writeFileSync(
      path.join(SYSLOG_DIR, filename),
      JSON.stringify(logEntry, null, 2)
    );
    console.error('📝 错误已记录到 SYSLOG: ' + filename);
  } catch (e) {
    console.error('⚠️ SYSLOG 写入也失败: ' + e.message);
  }
}

// ━━━ 主函数 ━━━

async function main() {
  console.log('\n━━━ 📡 指令回执写入 ━━━\n');

  var receipt = parseArgs();

  if (!receipt.instructionId && !receipt.workflow) {
    console.log('⚠️ 未提供 instruction-id 或 workflow，跳过回执写入');
    process.exit(0);
  }

  // 如果没有指令ID，用 workflow + 日期 自动生成
  if (!receipt.instructionId || receipt.instructionId === 'AUTO') {
    var now = new Date();
    var cstTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    var dateStr = cstTime.toISOString().split('T')[0].replace(/-/g, '');
    receipt.instructionId = 'AUTO-' + (receipt.workflow || 'unknown') + '-' + dateStr;
  }

  // 始终写入本地兜底
  writeLocalReceipt(receipt);

  // 尝试写入 Notion
  var token = process.env.NOTION_API_KEY;
  var databaseId = process.env.RECEIPT_DB_ID;

  if (!token) {
    var msg = '⚠️ NOTION_API_KEY 未设置，仅保存本地回执';
    console.log(msg);
    writeSyslogError(msg, receipt);
    process.exit(0);
  }

  if (!databaseId) {
    var msg = '⚠️ RECEIPT_DB_ID 未设置，仅保存本地回执';
    console.log(msg);
    writeSyslogError(msg, receipt);
    process.exit(0);
  }

  try {
    await writeReceiptToNotion(receipt, token, databaseId);
    console.log('\n✅ 回执写入完成\n');
  } catch (e) {
    console.error('❌ Notion 写入失败: ' + e.message);
    writeSyslogError('Notion 写入失败: ' + e.message, receipt);
    // 不阻塞主流程，退出码 0
    console.log('💾 已有本地兜底，不影响主流程');
  }

  process.exit(0);
}

main().catch(function(err) {
  console.error('❌ 回执脚本异常: ' + err.message);
  process.exit(0); // 不阻塞
});
