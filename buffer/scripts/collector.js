/**
 * buffer/scripts/collector.js
 *
 * 定时收集脚本：inbox → staging
 * 扫描 buffer/inbox/ 中各 DEV 目录的消息，合并后写入 buffer/staging/
 *
 * 运行时机：每天 09:00 / 14:00 / 21:00 CST（由 buffer-collect.yml 触发）
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 版权: 国作登字-2026-A-00037559
 */

const fs = require('fs');
const path = require('path');

const BUFFER_ROOT = path.join(__dirname, '..');
const INBOX = path.join(BUFFER_ROOT, 'inbox');
const STAGING = path.join(BUFFER_ROOT, 'staging');

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function getTimestamp() {
  return new Date().toISOString();
}

/**
 * 获取目录中下一个 batch 序号
 */
function getNextBatchSeq(stagingDir, dateStr) {
  if (!fs.existsSync(stagingDir)) {
    return 1;
  }
  const existing = fs.readdirSync(stagingDir)
    .filter(f => f.startsWith(`batch-${dateStr}-`) && f.endsWith('.json'));
  return existing.length + 1;
}

/**
 * 扫描单个 DEV 目录的 inbox 消息
 */
function collectDevMessages(devDir) {
  if (!fs.existsSync(devDir)) {
    return [];
  }

  const files = fs.readdirSync(devDir)
    .filter(f => f.endsWith('.json'));

  const messages = [];
  for (const file of files) {
    const filePath = path.join(devDir, file);
    try {
      const msg = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      messages.push({ msg, filePath, filename: file });
    } catch (err) {
      console.error(`[collector] Failed to parse ${filePath}: ${err.message}`);
    }
  }

  return messages;
}

/**
 * 将消息合并为 batch 文件写入 staging
 */
function createBatch(devId, messages, dateStr) {
  const stagingDir = path.join(STAGING, devId);
  if (!fs.existsSync(stagingDir)) {
    fs.mkdirSync(stagingDir, { recursive: true });
  }

  const seq = getNextBatchSeq(stagingDir, dateStr);
  const batchId = `batch-${dateStr}-${String(seq).padStart(3, '0')}`;
  const batchPath = path.join(stagingDir, `${batchId}.json`);

  const batch = {
    batch_id: batchId,
    dev_id: devId,
    collected_at: getTimestamp(),
    message_count: messages.length,
    has_urgent: messages.some(m => m.msg._urgent_flag || m.msg.priority === 'urgent'),
    messages: messages.map(m => {
      m.msg.status = 'staged';
      return m.msg;
    })
  };

  fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2) + '\n');
  console.log(`[collector] Created ${batchId} for ${devId} (${messages.length} messages)`);

  return batchPath;
}

/**
 * 清理已收集的 inbox 消息
 */
function cleanupInbox(messages) {
  for (const { filePath } of messages) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }
}

function main() {
  console.log(`[collector] === Buffer Collector Started === ${getTimestamp()}`);

  const dateStr = getDateStr();
  let totalCollected = 0;
  let devDirsProcessed = 0;

  // 扫描 inbox 中的所有子目录（DEV-XXX 和 system）
  if (!fs.existsSync(INBOX)) {
    console.log('[collector] inbox/ does not exist, nothing to collect');
    return;
  }

  const subdirs = fs.readdirSync(INBOX)
    .filter(d => fs.statSync(path.join(INBOX, d)).isDirectory());

  for (const subdir of subdirs) {
    const devDir = path.join(INBOX, subdir);
    const messages = collectDevMessages(devDir);

    if (messages.length === 0) {
      continue;
    }

    // 创建 batch 并写入 staging
    createBatch(subdir, messages, dateStr);

    // 清理已收集的 inbox 文件
    cleanupInbox(messages);

    totalCollected += messages.length;
    devDirsProcessed++;
  }

  console.log(`[collector] === Complete: ${totalCollected} messages from ${devDirsProcessed} dev(s) collected ===`);
}

module.exports = { collectDevMessages, createBatch, getNextBatchSeq };

if (require.main === module) {
  main();
}
