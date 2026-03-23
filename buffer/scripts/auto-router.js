/**
 * buffer/scripts/auto-router.js
 *
 * 自动分流：根据消息来源和 dev_id 归档到对应目录
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 版权: 国作登字-2026-A-00037559
 */

const fs = require('fs');
const path = require('path');

const BUFFER_ROOT = path.join(__dirname, '..');
const INBOX = path.join(BUFFER_ROOT, 'inbox');
const CONFIG_PATH = path.join(BUFFER_ROOT, 'config', 'buffer-config.json');

// 来源 → 处理方式
const ROUTING_RULES = {
  'gemini':  { target: 'inbox/{dev_id}/', merge: true },
  'notion':  { target: 'inbox/{dev_id}/', merge: true },
  'github':  { target: 'inbox/{dev_id}/', merge: true },
  'skyeye':  { target: 'inbox/{dev_id}/', merge: false },
  'system':  { target: 'inbox/system/',    merge: false },
};

const PRIORITY_RULES = {
  'urgent': { flush_immediately: false, flag: true },
  'normal': { flush_immediately: false, flag: false },
};

/**
 * 核心铁律检查：禁止直接写入 grid-db/
 */
function validateNoDirectWrite(targetPath) {
  if (targetPath.includes('grid-db/') || targetPath.includes('grid-db\\')) {
    throw new Error(
      '[BLOCKED] 违反铁律：禁止直接写入 grid-db/。' +
      '所有写入必须经过 buffer/ 缓冲层。'
    );
  }
}

/**
 * 校验消息格式
 */
function validateMessage(msg) {
  const errors = [];

  if (!msg.message_id) {
    errors.push('Missing message_id');
  }
  if (!msg.dev_id || !/^DEV-\d{3}$/.test(msg.dev_id)) {
    errors.push(`Invalid dev_id: ${msg.dev_id}`);
  }
  if (!msg.source || !ROUTING_RULES[msg.source]) {
    errors.push(`Invalid source: ${msg.source}`);
  }
  if (!msg.type) {
    errors.push('Missing type');
  }
  if (!msg.created_at) {
    errors.push('Missing created_at');
  }

  return errors;
}

/**
 * 路由消息到正确的 inbox 子目录
 */
function routeMessage(msg) {
  const rule = ROUTING_RULES[msg.source] || ROUTING_RULES['system'];
  let targetDir;

  if (msg.source === 'system' || !msg.dev_id) {
    targetDir = path.join(INBOX, 'system');
  } else {
    targetDir = path.join(INBOX, msg.dev_id);
  }

  // 铁律检查
  validateNoDirectWrite(targetDir);

  // 确保目录存在
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // 生成文件名
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${timestamp}-${msg.type}.json`;
  const filePath = path.join(targetDir, filename);

  // 标记优先级
  const priority = PRIORITY_RULES[msg.priority] || PRIORITY_RULES['normal'];
  if (priority.flag) {
    msg._urgent_flag = true;
  }

  // 确保状态为 pending
  msg.status = 'pending';

  fs.writeFileSync(filePath, JSON.stringify(msg, null, 2) + '\n');
  console.log(`[auto-router] Routed ${msg.message_id} → ${path.relative(BUFFER_ROOT, filePath)}`);

  return { filePath, merge: rule.merge };
}

/**
 * 处理从标准输入或命令行参数传入的消息
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('[auto-router] Usage: node auto-router.js <message.json>');
    console.log('[auto-router] Or pipe JSON via stdin');
    process.exit(0);
  }

  const inputPath = args[0];
  if (!fs.existsSync(inputPath)) {
    console.error(`[auto-router] File not found: ${inputPath}`);
    process.exit(1);
  }

  let msg;
  try {
    msg = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
  } catch (err) {
    console.error(`[auto-router] Failed to parse ${inputPath}: ${err.message}`);
    process.exit(1);
  }

  const errors = validateMessage(msg);
  if (errors.length > 0) {
    console.error(`[auto-router] Validation failed: ${errors.join(', ')}`);
    process.exit(1);
  }

  routeMessage(msg);
}

// Export for use by other scripts
module.exports = { routeMessage, validateMessage, validateNoDirectWrite, ROUTING_RULES };

if (require.main === module) {
  main();
}
