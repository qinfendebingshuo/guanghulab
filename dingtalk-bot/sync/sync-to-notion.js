process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// ============================================
// Notion 同步模块 · sync-to-notion.js · v2.0
// HoloLake · M-DINGTALK Phase 5
// DEV-004 之之 × 秋秋
//
// Phase 3 = 模拟模式
// Phase 5 = 真实 Notion API 连通！
// ============================================
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ====== Notion API 配置 ======
const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = process.env.NOTION_API_VERSION || '2022-06-28';
const NOTION_TOKEN = process.env.NOTION_TOKEN || '';

// 数据库 ID
const DB_IDS = {
  syslog: process.env.NOTION_SYSLOG_DB_ID || '',
  signalLog: process.env.NOTION_SIGNAL_LOG_DB_ID || '',
  changeLog: process.env.NOTION_CHANGE_LOG_DB_ID || '',
  ticket: process.env.NOTION_TICKET_DB_ID || ''
};

// 本地降级日志目录
const FALLBACK_DIR = path.join(__dirname, '..', 'data', 'notion-pending');
const WRITEBACK_LOG = path.join(__dirname, '..', 'data', 'notion-writeback-log.json');

// ====== 通用请求头 ======
function getHeaders() {
  return {
    'Authorization': 'Bearer ' + NOTION_TOKEN,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json'
  };
}

// ====== 检查配置是否就绪 ======
function isConfigured() {
  return NOTION_TOKEN && NOTION_TOKEN !== '' && NOTION_TOKEN !== 'mock-notion-token';
}

// ====== 辅助：创建 rich_text 属性 ======
function richText(str) {
  if (!str) return { rich_text: [] };
  const text = String(str);
  if (text.length <= 2000) {
    return { rich_text: [{ text: { content: text } }] };
  }
  var blocks = [];
  for (var i = 0; i < text.length; i += 2000) {
    blocks.push({ text: { content: text.substring(i, i + 2000) } });
  }
  return { rich_text: blocks };
}

// ====== 辅助：创建 title 属性 ======
function titleProp(str) {
  return { title: [{ text: { content: String(str || '未命名') } }] };
}

// ====== 辅助：创建 select 属性 ======
function selectProp(name) {
  if (!name) return undefined;
  return { select: { name: String(name) } };
}

// ====== 辅助：创建 status 属性 ======
function statusProp(name) {
  if (!name) return undefined;
  return { status: { name: String(name) } };
}

// ====== 辅助：创建 date 属性 ======
function dateProp(isoString) {
  if (!isoString) return undefined;
  return { date: { start: isoString } };
}

// ====== 核心：写入 SYSLOG 收件箱 ======
async function writeSyslog(data) {
  console.log('[Notion] 准备写入 SYSLOG 收件箱...');

  if (!isConfigured()) {
    console.log('[Notion] △ Token 未配置，降级到本地存储');
    return saveFallback('syslog', data);
  }

  if (!DB_IDS.syslog) {
    console.log('[Notion] △ SYSLOG 数据库 ID 未配置');
    return saveFallback('syslog', data);
  }

  var properties = {
    '标题': titleProp(data.title || data.session_id || 'SYSLOG-' + Date.now())
  };

  if (data.dev_id) {
    properties['DEV编号'] = selectProp(data.dev_id);
  }

  if (data.broadcast_id || data.session_id) {
    properties['广播编号'] = richText(data.broadcast_id || data.session_id);
  }

  if (data.module) {
    properties['模块'] = richText(data.module);
  }

  if (data.phase_status || data.status) {
    var statusVal = data.phase_status || data.status;
    if (['completed', 'partial', 'blocked'].includes(statusVal)) {
      properties['环节状态'] = selectProp(statusVal);
    }
  }

  if (data.content || data.raw_text) {
    properties['文件内容'] = richText(data.content || data.raw_text);
  }

  properties['协议版本'] = selectProp(data.protocol_version || 'SYSLOG-v4.0');
  properties['处理状态'] = statusProp('待处理');
  properties['接收时间'] = dateProp(data.timestamp || new Date().toISOString());
  properties['推送方'] = richText(data.source || 'M-DINGTALK-钉钉工作台');

  if (data.commit_sha) {
    properties['commit_sha'] = richText(data.commit_sha);
  }

  if (data.source_path) {
    properties['来源路径'] = richText(data.source_path);
  }

  try {
    var response = await axios.post(NOTION_API + '/pages', {
      parent: { database_id: DB_IDS.syslog },
      properties: properties
    }, {
      headers: getHeaders(),
      timeout: 15000
    });

    console.log('[Notion] ✅ SYSLOG 写入成功! 页面ID:', response.data.id);
    saveWritebackLog({
      timestamp: new Date().toISOString(),
      target: 'syslog',
      page_id: response.data.id,
      title: data.title || data.session_id,
      status: 'success'
    });

    return {
      success: true,
      written_to: 'notion',
      page_id: response.data.id,
      url: response.data.url
    };
  } catch (err) {
    var errMsg = err.response ? JSON.stringify(err.response.data) : err.message;
    console.error('[Notion] ❌ SYSLOG 写入失败:', errMsg);
    saveWritebackLog({
      timestamp: new Date().toISOString(),
      target: 'syslog',
      title: data.title || data.session_id,
      status: 'failed',
      error: errMsg
    });
    return saveFallback('syslog', data);
  }
}

// ====== 写入信号日志 ======
async function writeSignalLog(data) {
  console.log('[Notion] 准备写入信号日志...');
  if (!isConfigured() || !DB_IDS.signalLog) {
    return saveFallback('signal-log', data);
  }

  var properties = {
    '信号编号': titleProp(data.signal_id || 'SIG-' + Date.now()),
    '信号类型': selectProp(data.signal_type || 'GL-DATA'),
    '关联DEV': selectProp(data.dev_id),
    '发送方': selectProp(data.sender || '霜砚'),
    '接收方': selectProp(data.receiver),
    '摘要': richText(data.summary),
    '方向': selectProp(data.direction),
    '执行结果': statusProp(data.result || '已发送'),
    '时间戳': dateProp(data.timestamp || new Date().toISOString())
  };

  Object.keys(properties).forEach(function(k) {
    if (properties[k] === undefined) delete properties[k];
  });

  try {
    var response = await axios.post(NOTION_API + '/pages', {
      parent: { database_id: DB_IDS.signalLog },
      properties: properties
    }, {
      headers: getHeaders(),
      timeout: 15000
    });

    console.log('[Notion] ✅ 信号日志写入成功!');
    return { success: true, written_to: 'notion', page_id: response.data.id };
  } catch (err) {
    console.error('[Notion] ❌ 信号日志写入失败:', err.message);
    return saveFallback('signal-log', data);
  }
}

// ====== 健康检查：测试 Token 是否有效 ======
async function healthCheck() {
  if (!isConfigured()) {
    return { online: false, reason: 'token_not_configured' };
  }

  try {
    var response = await axios.get(NOTION_API + '/users/me', {
      headers: getHeaders(),
      timeout: 5000
    });

    return {
      online: true,
      bot_name: response.data.name,
      bot_id: response.data.id
    };
  } catch (err) {
    return {
      online: false,
      reason: err.response ? err.response.status + ': ' + (err.response.data.message || '') : err.message
    };
  }
}

// ====== 数据库连通测试 ======
async function testDatabase(dbName) {
  var dbId = DB_IDS[dbName];
  if (!dbId) {
    return { accessible: false, reason: 'db_id_not_configured', db: dbName };
  }

  try {
    var response = await axios.post(NOTION_API + '/databases/' + dbId + '/query', {
      page_size: 1
    }, {
      headers: getHeaders(),
      timeout: 10000
    });

    return {
      accessible: true,
      db: dbName,
      db_id: dbId,
      total_results: response.data.results.length,
      has_more: response.data.has_more
    };
  } catch (err) {
    return {
      accessible: false,
      db: dbName,
      reason: err.response ? err.response.status + ': ' + (err.response.data.message || '') : err.message
    };
  }
}

// ====== 降级：保存到本地 ======
function saveFallback(type, data) {
  if (!fs.existsSync(FALLBACK_DIR)) {
    fs.mkdirSync(FALLBACK_DIR, { recursive: true });
  }

  var filename = type + '_' + Date.now() + '.json';
  var filePath = path.join(FALLBACK_DIR, filename);

  var record = {
    type: type,
    data: data,
    saved_at: new Date().toISOString(),
    reason: 'notion_unavailable'
  };

  fs.writeFileSync(filePath, JSON.stringify(record, null, 2), 'utf-8');
  console.log('[Notion] 已降级存储到本地:', filename);

  return {
    success: true,
    written_to: 'local',
    file: filename,
    message: 'Notion不可用，已存到本地。Token配置后可重新推送。'
  };
}

// ====== 重推本地暂存数据到 Notion ======
async function flushPending() {
  if (!fs.existsSync(FALLBACK_DIR)) {
    console.log('[Notion] 无暂存数据');
    return { flushed: 0 };
  }

  var files = fs.readdirSync(FALLBACK_DIR).filter(function(f) { return f.endsWith('.json'); });
  console.log('[Notion] 发现 ' + files.length + ' 条暂存数据，开始重推...');

  var success = 0;
  var failed = 0;

  for (var file of files) {
    try {
      var content = JSON.parse(fs.readFileSync(path.join(FALLBACK_DIR, file), 'utf-8'));
      var result;

      if (content.type === 'syslog') {
        result = await writeSyslog(content.data);
      } else if (content.type === 'signal-log') {
        result = await writeSignalLog(content.data);
      }

      if (result && result.written_to === 'notion') {
        fs.unlinkSync(path.join(FALLBACK_DIR, file));
        success++;
      } else {
        failed++;
      }
    } catch (err) {
      console.error('[Notion] 重推失败:', file, err.message);
      failed++;
    }
  }

  console.log('[Notion] 重推完成: 成功 ' + success + ' / 失败 ' + failed);
  return { flushed: success, failed: failed, remaining: files.length - success };
}

// ====== 回写进度（兼容 Phase 3 sync-engine 调用） ======
async function updateProgress(syslogData) {
  console.log('[Notion Sync] 回写进度到 Notion...');

  var result = await writeSyslog({
    title: (syslogData.session_id || '') + ' ' + (syslogData.dev_name || syslogData.dev_id || '') + ' ' + (syslogData.status || ''),
    session_id: syslogData.session_id,
    dev_id: syslogData.dev_id,
    module: syslogData.module,
    phase_status: syslogData.status || syslogData.completion_status,
    content: JSON.stringify(syslogData, null, 2),
    timestamp: syslogData.timestamp || new Date().toISOString(),
    source: 'M-DINGTALK-钉钉工作台'
  });

  return result;
}

// ====== 全量同步（兼容 Phase 3 sync-engine 调用） ======
async function sync() {
  console.log('[Notion Sync] 执行 Notion 同步...');
  var health = await healthCheck();

  if (health.online) {
    var flushResult = await flushPending();
    return {
      status: 'online',
      bot: health.bot_name,
      flushed: flushResult.flushed,
      remaining: flushResult.remaining || 0
    };
  } else {
    return {
      status: 'offline',
      reason: health.reason,
      message: '等待 Token 配置或网络恢复'
    };
  }
}

// ====== 保存回写日志 ======
function saveWritebackLog(record) {
  var logDir = path.dirname(WRITEBACK_LOG);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  var log = [];
  if (fs.existsSync(WRITEBACK_LOG)) {
    try { log = JSON.parse(fs.readFileSync(WRITEBACK_LOG, 'utf-8')); } catch (e) {}
  }

  log.unshift(record);
  if (log.length > 200) log = log.slice(0, 200);
  fs.writeFileSync(WRITEBACK_LOG, JSON.stringify(log, null, 2), 'utf-8');
}

module.exports = {
  writeSyslog,
  writeSignalLog,
  healthCheck,
  testDatabase,
  updateProgress,
  sync,
  flushPending,
  isConfigured
};
