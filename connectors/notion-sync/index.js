/**
 * connectors/notion-sync — Notion 双向同步模块
 *
 * 功能：
 *   - 读取 Notion 广播
 *   - 写回执行日志
 *   - 同步执行层状态
 *
 * 同步结构：
 *   Notion → 仓库（下行：读取广播/工单）
 *   仓库 → Notion（上行：写回日志/状态）
 *
 * 环境变量：
 *   NOTION_TOKEN        — Notion API Token
 *   BROADCAST_DB_ID     — 广播数据库 ID（需包含 status 属性，值: 待执行/已完成）
 *   EXECUTION_LOG_DB_ID — 执行日志数据库 ID
 *
 * 调用方式：
 *   node connectors/notion-sync [pull|push|status]
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const NOTION_VERSION = '2022-06-28';

/**
 * 发送 Notion API 请求
 */
function notionRequest(method, endpoint, body = null) {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    return Promise.reject(new Error('NOTION_TOKEN 环境变量未设置'));
  }

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path: `/v1/${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data}`));
          } else {
            resolve(parsed);
          }
        } catch {
          reject(new Error(`Notion 响应解析失败: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 从 Notion 拉取广播
 */
async function pullBroadcasts() {
  const dbId = process.env.BROADCAST_DB_ID;
  if (!dbId) {
    console.log('⚠️  BROADCAST_DB_ID 未设置，跳过广播拉取');
    return [];
  }

  console.log('📡 拉取 Notion 广播...');

  try {
    const result = await notionRequest('POST', `databases/${dbId}/query`, {
      filter: {
        property: 'status',
        select: { equals: '待执行' }
      },
      sorts: [{ property: 'created_time', direction: 'descending' }]
    });

    const broadcasts = (result.results || []).map(page => ({
      id: page.id,
      title: page.properties?.Name?.title?.[0]?.plain_text || '未命名',
      status: page.properties?.status?.select?.name || 'unknown',
      created: page.created_time
    }));

    console.log(`✅ 拉取到 ${broadcasts.length} 条广播`);
    return broadcasts;
  } catch (err) {
    console.error(`❌ 广播拉取失败: ${err.message}`);
    return [];
  }
}

/**
 * 写回执行日志到 Notion
 */
async function pushExecutionLog(logEntry) {
  const dbId = process.env.EXECUTION_LOG_DB_ID;
  if (!dbId) {
    console.log('⚠️  EXECUTION_LOG_DB_ID 未设置，执行日志仅写入本地');
    return writeLocalLog(logEntry);
  }

  console.log(`📝 写回执行日志: ${logEntry.task_id || 'unknown'}`);

  try {
    await notionRequest('POST', 'pages', {
      parent: { database_id: dbId },
      properties: {
        Name: { title: [{ text: { content: logEntry.task_id || 'execution-log' } }] },
        Status: { select: { name: logEntry.status || 'completed' } },
        Executor: { rich_text: [{ text: { content: 'zhuyuan' } }] },
        Timestamp: { rich_text: [{ text: { content: new Date().toISOString() } }] }
      }
    });
    console.log('✅ 日志已同步到 Notion');
  } catch (err) {
    console.error(`⚠️  Notion 写入失败，回退本地: ${err.message}`);
    writeLocalLog(logEntry);
  }
}

/**
 * 本地日志写入（回退方案）
 */
function writeLocalLog(logEntry) {
  const logDir = path.join(ROOT, 'core/task-queue');
  const logFile = path.join(logDir, 'execution-log.json');

  let logs = [];
  if (fs.existsSync(logFile)) {
    try {
      logs = JSON.parse(fs.readFileSync(logFile, 'utf-8'));
    } catch {
      logs = [];
    }
  }

  logs.push({
    ...logEntry,
    logged_at: new Date().toISOString()
  });

  // 保留最近 100 条
  if (logs.length > 100) {
    logs = logs.slice(-100);
  }

  fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf-8');
  console.log('📝 日志已写入本地');
}

/**
 * 同步执行层状态到 Notion
 */
async function syncExecutionStatus(statusData) {
  const dbId = process.env.EXECUTION_LOG_DB_ID;
  if (!dbId) {
    console.log('⚠️  EXECUTION_LOG_DB_ID 未设置，执行状态仅写入本地');
    writeLocalLog({
      task_id: `execution-status-${new Date().toISOString().slice(0, 10)}`,
      status: statusData.execution_layer_status || 'stable',
      type: 'execution_status',
      data: statusData
    });
    return;
  }

  console.log('📡 同步执行层状态到 Notion...');

  const summary = [
    `version: v${statusData.version || 'unknown'}`,
    `modules: ${(statusData.core_modules || []).filter(m => m.status === 'enabled').length}/${(statusData.core_modules || []).length}`,
    `connectors: ${(statusData.connectors || []).filter(c => c.status === 'enabled').length}/${(statusData.connectors || []).length}`,
    `workflows: ${statusData.workflows?.count || 0}`,
    `queue: ${statusData.task_queue?.total || 0} total / ${statusData.task_queue?.pending || 0} pending`
  ].join(' | ');

  try {
    await notionRequest('POST', 'pages', {
      parent: { database_id: dbId },
      properties: {
        Name: { title: [{ text: { content: `Execution Status · ${new Date().toISOString().slice(0, 10)}` } }] },
        Status: { select: { name: statusData.execution_layer_status || 'stable' } },
        Executor: { rich_text: [{ text: { content: 'zhuyuan' } }] },
        Timestamp: { rich_text: [{ text: { content: statusData.timestamp || new Date().toISOString() } }] }
      },
      children: [{
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: summary } }]
        }
      }]
    });
    console.log('✅ 执行层状态已同步到 Notion');
  } catch (err) {
    console.error(`⚠️  Notion 同步失败，回退本地: ${err.message}`);
    writeLocalLog({
      task_id: `execution-status-${new Date().toISOString().slice(0, 10)}`,
      status: statusData.execution_layer_status || 'stable',
      type: 'execution_status',
      data: statusData
    });
  }
}

/**
 * 检查 Notion 连接状态
 */
async function checkStatus() {
  console.log('🔍 检查 Notion 连接状态...');

  try {
    await notionRequest('GET', 'users/me');
    console.log('✅ Notion API 连接正常');
    return { connected: true };
  } catch (err) {
    console.error(`❌ Notion 连接失败: ${err.message}`);
    return { connected: false, error: err.message };
  }
}

// CLI 入口
if (require.main === module) {
  const cmd = process.argv[2] || 'status';

  (async () => {
    switch (cmd) {
      case 'pull':
        await pullBroadcasts();
        break;
      case 'push':
        await pushExecutionLog({
          task_id: 'manual-test',
          status: 'completed',
          message: 'Manual push test'
        });
        break;
      case 'status':
        await checkStatus();
        break;
      default:
        console.log('用法: node connectors/notion-sync [pull|push|status]');
    }
  })();
}

module.exports = { pullBroadcasts, pushExecutionLog, syncExecutionStatus, writeLocalLog, checkStatus, notionRequest };
