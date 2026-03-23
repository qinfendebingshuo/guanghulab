/**
 * buffer/scripts/flusher.js
 *
 * 批量写入脚本：staging → grid-db
 * 读取 buffer/staging/ 中的 batch 文件，校验后写入 grid-db/
 *
 * 运行时机：每天 21:30 CST（由 buffer-flush.yml 触发）
 * 也可通过 repository_dispatch: grid-db-flush 手动触发
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 版权: 国作登字-2026-A-00037559
 */

const fs = require('fs');
const path = require('path');

const BUFFER_ROOT = path.join(__dirname, '..');
const STAGING = path.join(BUFFER_ROOT, 'staging');
const PROCESSED = path.join(BUFFER_ROOT, 'processed');
const REPO_ROOT = path.join(__dirname, '../..');
const GRID_DB = path.join(REPO_ROOT, 'grid-db');

// 加载 dev-module-map 用于校验
const DEV_MAP_PATH = path.join(GRID_DB, 'rules', 'dev-module-map.json');

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 核心铁律：验证写入目标必须在 grid-db/ 内
 * 并且确保来源只能从 buffer/staging/ 发起
 */
function validateFlushPath(targetPath) {
  const resolved = path.resolve(targetPath);
  const gridDbResolved = path.resolve(GRID_DB);

  if (!resolved.startsWith(gridDbResolved)) {
    throw new Error(
      `[BLOCKED] Flush target must be within grid-db/. Got: ${resolved}`
    );
  }
}

/**
 * 铁律检查：禁止非 flusher 路径直写 grid-db
 * 此函数用于外部脚本调用以校验
 */
function assertBufferOnly(callerPath) {
  const resolved = path.resolve(callerPath);
  const bufferResolved = path.resolve(BUFFER_ROOT);

  if (!resolved.startsWith(bufferResolved)) {
    throw new Error(
      '[BLOCKED] 违反铁律：禁止直接写入 grid-db/。' +
      '所有写入必须经过 buffer/ 缓冲层。' +
      ` 调用者: ${resolved}`
    );
  }
}

/**
 * 校验单条消息
 */
function validateMessage(msg) {
  const errors = [];

  if (!msg.message_id) {
    errors.push('Missing message_id');
  }
  if (!msg.dev_id || !/^DEV-\d{3}$/.test(msg.dev_id)) {
    errors.push(`Invalid dev_id: ${msg.dev_id}`);
  }
  if (!msg.source) {
    errors.push('Missing source');
  }
  if (!msg.type) {
    errors.push('Missing type');
  }

  return errors;
}

/**
 * 校验 dev_id 是否在映射表中
 */
function validateDevId(devId, devModuleMap) {
  return devModuleMap.mappings && devModuleMap.mappings[devId];
}

/**
 * 将消息写入 grid-db/inbox/ 供 process-inbox.js 处理
 * 或直接写入对应目录（根据消息类型）
 */
function flushMessageToGridDb(msg) {
  // 对于 checkin 类型，写入 memory
  if (msg.type === 'checkin') {
    const memoryDir = path.join(GRID_DB, 'memory', msg.dev_id);
    validateFlushPath(memoryDir);

    if (!fs.existsSync(memoryDir)) {
      fs.mkdirSync(memoryDir, { recursive: true });
    }

    // 更新签到日志
    const checkinLogPath = path.join(memoryDir, 'checkin-log.json');
    let checkinLog = { records: [] };
    if (fs.existsSync(checkinLogPath)) {
      try {
        checkinLog = JSON.parse(fs.readFileSync(checkinLogPath, 'utf8'));
      } catch (e) {
        checkinLog = { records: [] };
      }
    }

    checkinLog.records.push({
      timestamp: msg.created_at || getTimestamp(),
      source: msg.source,
      payload: msg.payload,
      buffer_message_id: msg.message_id
    });

    fs.writeFileSync(checkinLogPath, JSON.stringify(checkinLog, null, 2) + '\n');
    return 'memory';
  }

  // 对于其他类型，写入 grid-db/inbox/ 供 process-inbox.js 处理
  const inboxDir = path.join(GRID_DB, 'inbox');
  validateFlushPath(inboxDir);

  if (!fs.existsSync(inboxDir)) {
    fs.mkdirSync(inboxDir, { recursive: true });
  }

  // 转换为 grid-db inbox 格式
  const gridDbMsg = {
    schema_version: '1.0',
    message_id: `${getDateStr()}-${msg.dev_id}-${msg.type}`,
    dev_id: msg.dev_id,
    persona_id: msg.payload.persona_id || 'unknown',
    type: mapBufferTypeToGridDbType(msg.type),
    timestamp: msg.created_at || getTimestamp(),
    payload: msg.payload,
    source_buffer_id: msg.message_id
  };

  const filename = `${gridDbMsg.message_id}.json`;
  const filePath = path.join(inboxDir, filename);
  fs.writeFileSync(filePath, JSON.stringify(gridDbMsg, null, 2) + '\n');
  return 'inbox';
}

/**
 * 映射 buffer 消息类型到 grid-db 消息类型
 */
function mapBufferTypeToGridDbType(bufferType) {
  const typeMap = {
    'interaction': 'interaction-dump',
    'task': 'progress-update',
    'feedback': 'dev-log',
    'checkin': 'checkin',
    'broadcast_request': 'progress-update'
  };
  return typeMap[bufferType] || 'dev-log';
}

/**
 * 移动 batch 到 processed 目录
 */
function archiveBatch(batchPath, dateStr) {
  const processedDir = path.join(PROCESSED, dateStr);
  if (!fs.existsSync(processedDir)) {
    fs.mkdirSync(processedDir, { recursive: true });
  }

  const filename = path.basename(batchPath);
  const destPath = path.join(processedDir, filename);
  fs.renameSync(batchPath, destPath);
  return destPath;
}

/**
 * 清理过期的 processed 数据
 */
function cleanupProcessed(keepDays) {
  if (!fs.existsSync(PROCESSED)) return;

  const now = new Date();
  const dirs = fs.readdirSync(PROCESSED)
    .filter(d => fs.statSync(path.join(PROCESSED, d)).isDirectory());

  for (const dir of dirs) {
    // 目录名格式: YYYYMMDD — 必须是 8 位数字
    if (!/^\d{8}$/.test(dir)) {
      continue;
    }
    const year = parseInt(dir.substring(0, 4));
    const month = parseInt(dir.substring(4, 6)) - 1;
    const day = parseInt(dir.substring(6, 8));
    const dirDate = new Date(year, month, day);

    const diffDays = (now - dirDate) / (1000 * 60 * 60 * 24);
    if (diffDays > keepDays) {
      const dirPath = path.join(PROCESSED, dir);
      fs.rmSync(dirPath, { recursive: true, force: true });
      console.log(`[flusher] Cleaned up expired processed dir: ${dir}`);
    }
  }
}

function main() {
  console.log(`[flusher] === Buffer Flusher Started === ${getTimestamp()}`);

  // 加载 dev-module-map
  let devModuleMap = { mappings: {} };
  if (fs.existsSync(DEV_MAP_PATH)) {
    devModuleMap = JSON.parse(fs.readFileSync(DEV_MAP_PATH, 'utf8'));
  } else {
    console.warn('[flusher] dev-module-map.json not found, skipping dev_id validation');
  }

  const dateStr = getDateStr();
  let totalFlushed = 0;
  let totalFailed = 0;

  // 扫描 staging 中的所有子目录
  if (!fs.existsSync(STAGING)) {
    console.log('[flusher] staging/ does not exist, nothing to flush');
    return;
  }

  const subdirs = fs.readdirSync(STAGING)
    .filter(d => fs.statSync(path.join(STAGING, d)).isDirectory());

  for (const subdir of subdirs) {
    const stagingDir = path.join(STAGING, subdir);
    const batchFiles = fs.readdirSync(stagingDir)
      .filter(f => f.startsWith('batch-') && f.endsWith('.json'));

    for (const batchFile of batchFiles) {
      const batchPath = path.join(stagingDir, batchFile);
      let batch;

      try {
        batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
      } catch (err) {
        console.error(`[flusher] Failed to parse ${batchFile}: ${err.message}`);
        totalFailed++;
        continue;
      }

      // 校验 dev_id
      if (batch.dev_id && batch.dev_id !== 'system') {
        if (!validateDevId(batch.dev_id, devModuleMap)) {
          console.warn(`[flusher] Unknown dev_id ${batch.dev_id} in ${batchFile}, processing anyway`);
        }
      }

      // 处理 batch 中的每条消息
      let batchFlushed = 0;
      for (const msg of (batch.messages || [])) {
        const errors = validateMessage(msg);
        if (errors.length > 0) {
          console.error(`[flusher] Validation failed for ${msg.message_id}: ${errors.join(', ')}`);
          msg.status = 'failed';
          totalFailed++;
          continue;
        }

        try {
          const target = flushMessageToGridDb(msg);
          msg.status = 'flushed';
          batchFlushed++;
          console.log(`[flusher] Flushed ${msg.message_id} → ${target}`);
        } catch (err) {
          console.error(`[flusher] Error flushing ${msg.message_id}: ${err.message}`);
          msg.status = 'failed';
          totalFailed++;
        }
      }

      totalFlushed += batchFlushed;

      // 归档 batch
      try {
        archiveBatch(batchPath, dateStr);
      } catch (err) {
        console.error(`[flusher] Error archiving ${batchFile}: ${err.message}`);
      }
    }
  }

  // 清理过期的 processed 数据（保留 7 天）
  cleanupProcessed(7);

  console.log(`[flusher] === Complete: ${totalFlushed} flushed, ${totalFailed} failed ===`);
}

module.exports = { validateFlushPath, assertBufferOnly, validateMessage, flushMessageToGridDb };

if (require.main === module) {
  main();
}
