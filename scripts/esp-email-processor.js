// scripts/esp-email-processor.js
// ESP 邮件信号协议 · GitHub 端处理器
// 功能：读取 Gmail IMAP → 解析 [GL-CMD] 信号 → 执行指令 → 写 signal-log → 发 [GL-ACK]

'use strict';

const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');

// ── 配置 ────────────────────────────────────────────────────────────────────
const EMAIL_ADDRESS  = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_APP_PASSWORD;

if (!EMAIL_ADDRESS || !EMAIL_PASSWORD) {
  console.error('❌ 缺少环境变量 EMAIL_ADDRESS 或 EMAIL_APP_PASSWORD');
  process.exit(1);
}

const SIGNAL_LOG_DIR    = path.join(__dirname, '../signal-log');
const SIGNAL_INDEX_PATH = path.join(SIGNAL_LOG_DIR, 'index.json');
const NOTION_PUSH_DIR   = path.join(__dirname, '../notion-push/pending');
const DEV_NODES_DIR     = path.join(__dirname, '../dev-nodes');

// ── 信号 ID 生成 ──────────────────────────────────────────────────────────
function generateSignalId() {
  const now = new Date();
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, '');
  const index = loadSignalIndex();
  const seq   = String(index.total_count + 1).padStart(3, '0');
  return `SIG-${ymd}-${seq}`;
}

// ── 信号索引读写 ──────────────────────────────────────────────────────────
function loadSignalIndex() {
  if (!fs.existsSync(SIGNAL_INDEX_PATH)) {
    return { last_updated: new Date().toISOString(), total_count: 0, signals: [] };
  }
  return JSON.parse(fs.readFileSync(SIGNAL_INDEX_PATH, 'utf8'));
}

function saveSignalIndex(index) {
  index.last_updated = new Date().toISOString();
  fs.writeFileSync(SIGNAL_INDEX_PATH, JSON.stringify(index, null, 2));
}

// ── 写入信号日志文件 ──────────────────────────────────────────────────────
function writeSignalLog(signal) {
  const dateStr   = signal.timestamp.slice(0, 7); // "YYYY-MM"
  const monthDir  = path.join(SIGNAL_LOG_DIR, dateStr);
  fs.mkdirSync(monthDir, { recursive: true });

  const filePath  = path.join(monthDir, `${signal.signal_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(signal, null, 2));

  const index     = loadSignalIndex();
  index.total_count += 1;
  index.signals.unshift({
    signal_id:  signal.signal_id,
    trace_id:   signal.trace_id,
    type:       signal.signal_type,
    timestamp:  signal.timestamp,
    summary:    signal.summary,
    related_dev: signal.related_dev || null,
    file:       `${dateStr}/${signal.signal_id}.json`
  });
  saveSignalIndex(index);

  console.log(`📝 信号已写入: ${signal.signal_id}`);
}

// ── 写入 notion-push/pending ──────────────────────────────────────────────
function pushToNotion(signal) {
  fs.mkdirSync(NOTION_PUSH_DIR, { recursive: true });
  const filePath = path.join(NOTION_PUSH_DIR, `${signal.signal_id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(signal, null, 2));
  console.log(`📤 已写入 notion-push/pending: ${signal.signal_id}`);
}

// ── SMTP 发送 ACK 邮件 ────────────────────────────────────────────────────
async function sendAckEmail(originalSignal, ackSignalId, result) {
  const transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth:   { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD }
  });

  const ackPayload = {
    signal_type:      'GL-ACK',
    trace_id:         originalSignal.trace_id,
    ack_signal_id:    ackSignalId,
    original_cmd_id:  originalSignal.signal_id,
    timestamp:        new Date().toISOString(),
    sender:           '铸渊',
    receiver:         '霜砚',
    original_command: originalSignal.command,
    result,
    message:          `指令 ${originalSignal.command} 执行${result === '成功' ? '完成' : '失败'}`
  };

  await transporter.sendMail({
    from:    EMAIL_ADDRESS,
    to:      EMAIL_ADDRESS,
    subject: `[GL-ACK] ${originalSignal.trace_id} | ${originalSignal.command} ${result}`,
    text:    JSON.stringify(ackPayload, null, 2)
  });

  console.log(`📧 [GL-ACK] 已发送: ${ackSignalId}`);
  return ackPayload;
}

// ── 指令执行器 ────────────────────────────────────────────────────────────
async function executeCommand(signal) {
  const { command, payload } = signal;
  console.log(`⚙️  执行指令: ${command}`);

  switch (command) {
    case 'sync_broadcast': {
      // 将 broadcasts-outbox/ 中的广播同步到对应 dev-nodes/
      const outboxDir = path.join(__dirname, '../broadcasts-outbox');
      if (!fs.existsSync(outboxDir)) {
        return { result: '失败', detail: 'broadcasts-outbox 目录不存在' };
      }
      const devDirs = fs.readdirSync(outboxDir).filter(f => f.startsWith('DEV-'));
      let synced = 0;
      for (const devId of devDirs) {
        const srcDir  = path.join(outboxDir, devId);
        const destDir = path.join(DEV_NODES_DIR, devId);
        if (!fs.existsSync(destDir)) continue;
        const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
        for (const file of files) {
          const src  = path.join(srcDir, file);
          const dest = path.join(destDir, file);
          if (!fs.existsSync(dest)) {
            fs.copyFileSync(src, dest);
            synced++;
          }
        }
        // 更新 status.json 中的 pending_broadcasts
        const statusPath = path.join(destDir, 'status.json');
        if (fs.existsSync(statusPath)) {
          const status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
          status.pending_broadcasts = files.length;
          status.updated_at = new Date().toISOString();
          fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
        }
      }
      return { result: '成功', detail: `已同步 ${synced} 个广播文件` };
    }

    case 'check_syslog': {
      const syslogInbox = path.join(__dirname, '../syslog-inbox');
      const files = fs.existsSync(syslogInbox)
        ? fs.readdirSync(syslogInbox).filter(f => f.endsWith('.json'))
        : [];
      const summary = `syslog-inbox 待处理: ${files.length} 条`;
      pushToNotion({
        signal_id:   generateSignalId(),
        trace_id:    signal.trace_id,
        timestamp:   new Date().toISOString(),
        signal_type: 'GL-DATA',
        direction:   'GitHub→Notion',
        sender:      '铸渊',
        receiver:    '霜砚',
        related_dev: null,
        related_module: null,
        summary,
        payload:     { syslog_pending: files.length, files }
      });
      return { result: '成功', detail: summary };
    }

    case 'update_status': {
      const { dev_id, updates } = payload || {};
      if (!dev_id) return { result: '失败', detail: '缺少 dev_id' };
      const statusPath = path.join(DEV_NODES_DIR, dev_id, 'status.json');
      if (!fs.existsSync(statusPath)) {
        return { result: '失败', detail: `${dev_id} status.json 不存在` };
      }
      let status;
      try {
        status = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      } catch (err) {
        return { result: '失败', detail: `${dev_id} status.json 解析失败: ${err.message}` };
      }
      Object.assign(status, updates, { updated_at: new Date().toISOString() });
      fs.writeFileSync(statusPath, JSON.stringify(status, null, 2));
      return { result: '成功', detail: `${dev_id} 状态已更新` };
    }

    default:
      return { result: '失败', detail: `未知指令: ${command}` };
  }
}

// ── 解析邮件正文中的 JSON 信号 ────────────────────────────────────────────
function parseSignalFromEmail(subject, body) {
  if (!subject.includes('[GL-CMD]')) return null;
  try {
    // 提取第一个完整 JSON 对象（跳过邮件头中的任何前缀内容）
    const jsonMatch = body.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.signal_type || !parsed.trace_id || !parsed.command) return null;
    return parsed;
  } catch (err) {
    console.log(`⚠️  邮件 JSON 解析失败: ${err.message}`);
    return null;
  }
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════');
  console.log('📡 ESP 邮件信号处理器启动');
  console.log(`   时间: ${new Date().toISOString()}`);
  console.log('═══════════════════════════════════════════════\n');

  const client = new ImapFlow({
    host:   'imap.gmail.com',
    port:   993,
    secure: true,
    auth:   { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD },
    logger: false
  });

  await client.connect();

  let processed = 0;
  let errors    = 0;

  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      // 搜索未读的 [GL-CMD] 邮件
      const messages = await client.search({ seen: false, subject: '[GL-CMD]' });

      if (!messages || messages.length === 0) {
        console.log('📭 无待处理 [GL-CMD] 邮件');
      } else {
        console.log(`📬 发现 ${messages.length} 封 [GL-CMD] 邮件`);

        for await (const msg of client.fetch(messages, { envelope: true, source: true })) {
          const subject  = msg.envelope?.subject || '';
          const rawBody  = msg.source?.toString('utf8') || '';

          // 提取 JSON 正文（跳过邮件头）
          const bodyStart = rawBody.indexOf('{');
          const body = bodyStart >= 0 ? rawBody.slice(bodyStart) : '';

          const signal = parseSignalFromEmail(subject, body);
          if (!signal) {
            console.log(`⚠️  跳过无效邮件: ${subject}`);
            continue;
          }

          console.log(`\n📩 处理信号: ${signal.trace_id} · ${signal.command}`);

          // 生成信号 ID（如邮件中未提供）
          if (!signal.signal_id) signal.signal_id = generateSignalId();

          // 写入 signal-log
          const cmdSignal = {
            signal_id:      signal.signal_id,
            trace_id:       signal.trace_id,
            timestamp:      signal.timestamp || new Date().toISOString(),
            signal_type:    'GL-CMD',
            direction:      'Notion→GitHub',
            sender:         signal.sender || '霜砚',
            receiver:       '铸渊',
            related_dev:    signal.payload?.dev_id || null,
            related_module: signal.payload?.module || null,
            summary:        `执行指令 ${signal.command}`,
            payload:        signal.payload || {},
            result:         null,
            ack_signal_id:  null
          };
          writeSignalLog(cmdSignal);

          // 执行指令
          let execResult;
          try {
            execResult = await executeCommand(signal);
          } catch (err) {
            execResult = { result: '失败', detail: err.message };
          }

          cmdSignal.result = execResult.result;

          // 发送 ACK 邮件并写入 ACK 信号日志
          const ackSignalId = generateSignalId();
          cmdSignal.ack_signal_id = ackSignalId;

          try {
            const ackPayload = await sendAckEmail(
              { ...signal, signal_id: cmdSignal.signal_id },
              ackSignalId,
              execResult.result
            );
            writeSignalLog({
              signal_id:      ackSignalId,
              trace_id:       signal.trace_id,
              timestamp:      new Date().toISOString(),
              signal_type:    'GL-ACK',
              direction:      'GitHub→Notion',
              sender:         '铸渊',
              receiver:       '霜砚',
              related_dev:    cmdSignal.related_dev,
              related_module: cmdSignal.related_module,
              summary:        `ACK: ${signal.command} ${execResult.result}`,
              payload:        ackPayload,
              result:         execResult.result,
              ack_signal_id:  null
            });
            pushToNotion({
              signal_id:      ackSignalId,
              trace_id:       signal.trace_id,
              timestamp:      new Date().toISOString(),
              signal_type:    'GL-ACK',
              direction:      'GitHub→Notion',
              sender:         '铸渊',
              receiver:       '霜砚',
              related_dev:    cmdSignal.related_dev,
              related_module: cmdSignal.related_module,
              summary:        `ACK: ${signal.command} ${execResult.result}`,
              payload:        ackPayload
            });
          } catch (err) {
            console.error(`❌ 发送 ACK 邮件失败: ${err.message}`);
            errors++;
          }

          // 标记邮件为已读
          await client.messageFlagsAdd(msg.seq, ['\\Seen']);

          processed++;
          console.log(`✅ 信号处理完成: ${signal.trace_id} → ${execResult.result}`);
          if (execResult.detail) console.log(`   详情: ${execResult.detail}`);
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }

  console.log(`\n═══════════════════════════════════════════════`);
  console.log(`📡 ESP 处理完毕 · 处理: ${processed} · 错误: ${errors}`);
  console.log(`═══════════════════════════════════════════════`);

  if (errors > 0) process.exit(1);
}

main().catch(err => {
  console.error('❌ ESP 处理器致命错误:', err.message);
  process.exit(1);
});
