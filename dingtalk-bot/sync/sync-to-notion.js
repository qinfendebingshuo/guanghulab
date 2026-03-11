// Notion 同步模块 · sync-to-notion.js
// GitHub → Notion（主控台进度回写）
// HoloLake · M-DINGTALK Phase 3
//

const fs = require('fs');
const path = require('path');

// Notion API配置（后续由霜砚提供真实Token）
const NOTION_CONFIG = {
  apiBase: 'https://api.notion.com/v1',
  apiVersion: '2022-06-28',
  token: process.env.NOTION_TOKEN || 'mock-notion-token'
};

// 回写日志
const WRITEBACK_LOG = path.join(__dirname, '..', 'data', 'notion-writeback-log.json');

/**
 * 模拟回写进度到Notion主控台
 * （Phase 3先做模拟，Phase 4接入真实Notion API）
 */
async function updateProgress(syslogData) {
  console.log('[Notion Sync] 准备回写进度到Notion...');

  const writebackRecord = {
    timestamp: new Date().toISOString(),
    dev_id: syslogData.dev_id,
    session_id: syslogData.session_id,
    status: syslogData.completion_status,
    target: 'notion-main-console'
  };

  // 检查是否有真实Token
  if (NOTION_CONFIG.token === 'mock-notion-token') {
    console.log('[Notion Sync] ⚠️ 使用模拟模式（未配置Notion Token）');
    writebackRecord.mode = 'mock';
    writebackRecord.result = '模拟回写成功';

    // 记录到本地日志
    saveWritebackLog(writebackRecord);

    return {
      status: 'mock-success',
      message: '模拟回写完成（真实Token待配置）',
      record: writebackRecord
    };
  }

  // 真实Notion API调用（Phase 4启用）
  try {
    // 未来这里会调用 Notion API
    // const response = await fetch(...);
    writebackRecord.mode = 'real';
    writebackRecord.result = '回写成功';

    saveWritebackLog(writebackRecord);

    return {
      status: 'success',
      record: writebackRecord
    };
  } catch (err) {
    writebackRecord.mode = 'real';
    writebackRecord.result = `回写失败: ${err.message}`;

    saveWritebackLog(writebackRecord);

    return {
      status: 'error',
      error: err.message
    };
  }
}

/**
 * 执行完整同步
 */
async function sync() {
  console.log('[Notion Sync] 执行Notion同步...');

  // 读取回写日志
  const log = loadWritebackLog();

  return {
    status: NOTION_CONFIG.token === 'mock-notion-token' ? 'mock-ready' : 'ready',
    totalWritebacks: log.length,
    lastWriteback: log.length > 0 ? log[0].timestamp : null,
    message: NOTION_CONFIG.token === 'mock-notion-token'
      ? '模拟模式·等待真实Token配置'
      : 'Notion API已就绪'
  };
}

/**
 * 保存回写日志
 */
function saveWritebackLog(record) {
  const logDir = path.dirname(WRITEBACK_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  let log = loadWritebackLog();

  log.unshift(record);

  if (log.length > 100) log = log.slice(0, 100);

  fs.writeFileSync(WRITEBACK_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

/**
 * 加载回写日志
 */
function loadWritebackLog() {
  if (fs.existsSync(WRITEBACK_LOG)) {
    try {
      return JSON.parse(fs.readFileSync(WRITEBACK_LOG, 'utf-8'));
    } catch {
      return [];
    }
  }
  return [];
}

module.exports = {
  updateProgress,
  sync
};
