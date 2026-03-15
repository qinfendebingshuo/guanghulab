// scripts/psp-inspection.js
// 铸渊 PSP 分身巡检 · 每日自动检查清单
// CHK-G01 信号完整性 / CHK-G02 dev-nodes 一致性 / CHK-G03 notion-push 清理
// CHK-G04 broadcasts 投递 / CHK-G05 CI 健康

'use strict';

const fs      = require('fs');
const path    = require('path');
const https   = require('https');
const nodemailer = require('nodemailer');

// ── 目录配置 ───────────────────────────────────────────────────────────────
const ROOT            = path.join(__dirname, '..');
const SIGNAL_LOG_DIR  = path.join(ROOT, 'signal-log');
const SIGNAL_INDEX    = path.join(SIGNAL_LOG_DIR, 'index.json');
const DEV_NODES_DIR   = path.join(ROOT, 'dev-nodes');
const NOTION_PENDING  = path.join(ROOT, 'notion-push/pending');
const BROADCASTS_DIR  = path.join(ROOT, 'broadcasts-outbox');
const MEMORY_PATH     = path.join(ROOT, '.github/brain/memory.json');

const EMAIL_ADDRESS  = process.env.EMAIL_ADDRESS;
const EMAIL_PASSWORD = process.env.EMAIL_APP_PASSWORD;
const GITHUB_TOKEN   = process.env.GITHUB_TOKEN;
const REPO           = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

const now           = new Date();
const today         = now.toISOString().split('T')[0];
const results       = {};
const issues        = [];
const autoFixed     = [];
const MS_PER_HOUR   = 3600000;
const PSP_TRACE_ID  = `TRC-${today.replace(/-/g, '')}-PSP`;

// ── 工具函数 ───────────────────────────────────────────────────────────────
function hoursAgo(isoStr) {
  if (!isoStr) return Infinity;
  return (Date.now() - new Date(isoStr).getTime()) / MS_PER_HOUR;
}

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { return null; }
}

function saveJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ── 信号 ID 生成 ───────────────────────────────────────────────────────────
function generateSignalId() {
  const ymd   = today.replace(/-/g, '');
  const index = loadJson(SIGNAL_INDEX) || { total_count: 0 };
  const seq   = String(index.total_count + 1).padStart(3, '0');
  return `SIG-${ymd}-${seq}`;
}

// ── 写信号日志 ─────────────────────────────────────────────────────────────
function writeSignalLog(signal) {
  const dateStr = signal.timestamp.slice(0, 7);
  const dir     = path.join(SIGNAL_LOG_DIR, dateStr);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${signal.signal_id}.json`), JSON.stringify(signal, null, 2));

  const index = loadJson(SIGNAL_INDEX) || { last_updated: '', total_count: 0, signals: [] };
  index.total_count += 1;
  index.last_updated = now.toISOString();
  index.signals.unshift({
    signal_id:   signal.signal_id,
    trace_id:    signal.trace_id,
    type:        signal.signal_type,
    timestamp:   signal.timestamp,
    summary:     signal.summary,
    related_dev: signal.related_dev || null,
    file:        `${dateStr}/${signal.signal_id}.json`
  });
  saveJson(SIGNAL_INDEX, index);
}

// ── 发送 GL-DATA 通知邮件 ──────────────────────────────────────────────────
async function sendDataEmail(subject, payload) {
  if (!EMAIL_ADDRESS || !EMAIL_PASSWORD) {
    console.log('⚠️  EMAIL 未配置，跳过邮件发送');
    return;
  }
  const transport = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   587,
    secure: false,
    auth:   { user: EMAIL_ADDRESS, pass: EMAIL_PASSWORD }
  });
  await transport.sendMail({
    from:    EMAIL_ADDRESS,
    to:      EMAIL_ADDRESS,
    subject: `[GL-DATA] ${subject}`,
    text:    JSON.stringify(payload, null, 2)
  });
  console.log(`📧 [GL-DATA] 已发送: ${subject}`);
}

// ── CHK-G01 信号收发完整性 ─────────────────────────────────────────────────
function checkG01() {
  console.log('\n─── CHK-G01 信号收发完整性 ───');
  const index = loadJson(SIGNAL_INDEX);
  if (!index) {
    results.G01 = '⚠️';
    issues.push('CHK-G01: signal-log/index.json 不存在');
    return;
  }

  const cutoff    = Date.now() - 24 * MS_PER_HOUR;
  const recent    = index.signals.filter(s => new Date(s.timestamp).getTime() > cutoff);
  const cmds      = recent.filter(s => s.type === 'GL-CMD');
  const acks      = new Set(recent.filter(s => s.type === 'GL-ACK').map(s => s.trace_id));
  const unacked   = cmds.filter(s => !acks.has(s.trace_id));

  if (unacked.length > 0) {
    results.G01 = '❌';
    unacked.forEach(s => issues.push(`CHK-G01: 未收到 ACK · trace_id=${s.trace_id} · ${s.summary}`));
  } else {
    results.G01 = '✅';
    console.log(`  ✅ 最近24h CMD: ${cmds.length} · ACK 全部到位`);
  }
}

// ── CHK-G02 dev-nodes 状态一致性 ──────────────────────────────────────────
function checkG02() {
  console.log('\n─── CHK-G02 dev-nodes 状态一致性 ───');
  if (!fs.existsSync(DEV_NODES_DIR)) {
    results.G02 = '❌';
    issues.push('CHK-G02: dev-nodes/ 目录不存在');
    return;
  }

  const devDirs = fs.readdirSync(DEV_NODES_DIR).filter(d => d.startsWith('DEV-'));
  let allOk = true;

  for (const devId of devDirs) {
    const statusPath = path.join(DEV_NODES_DIR, devId, 'status.json');
    const configPath = path.join(DEV_NODES_DIR, devId, 'config.json');
    if (!fs.existsSync(statusPath) || !fs.existsSync(configPath)) {
      issues.push(`CHK-G02: ${devId} 缺少 status.json 或 config.json`);
      allOk = false;
      continue;
    }
    const status = loadJson(statusPath);
    if (!status) {
      issues.push(`CHK-G02: ${devId} status.json 解析失败`);
      allOk = false;
    }
  }

  results.G02 = allOk ? '✅' : '⚠️';
  if (allOk) console.log(`  ✅ ${devDirs.length} 个开发者节点状态文件完整`);
}

// ── CHK-G03 notion-push 清理 ───────────────────────────────────────────────
async function checkG03() {
  console.log('\n─── CHK-G03 notion-push/pending 清理 ───');
  if (!fs.existsSync(NOTION_PENDING)) {
    results.G03 = '✅';
    console.log('  ✅ notion-push/pending 目录为空或不存在');
    return;
  }

  const files   = fs.readdirSync(NOTION_PENDING).filter(f => f.endsWith('.json'));
  const stale   = files.filter(f => {
    const stat = fs.statSync(path.join(NOTION_PENDING, f));
    return (Date.now() - stat.mtimeMs) > 24 * MS_PER_HOUR;
  });

  if (stale.length > 0) {
    results.G03 = '⚠️';
    issues.push(`CHK-G03: ${stale.length} 个 notion-push/pending 文件超过24h未处理: ${stale.join(', ')}`);
    // 发通知
    try {
      await sendDataEmail('notion-push/pending 文件积压提醒', {
        type:   'GL-CMD',
        sender: '铸渊',
        command: 'alert_pending_files',
        payload: { stale_files: stale, count: stale.length }
      });
    } catch (err) {
      console.error(`  ⚠️  发送通知失败: ${err.message}`);
    }
  } else {
    results.G03 = '✅';
    console.log(`  ✅ pending: ${files.length} 个文件，无超期`);
  }
}

// ── CHK-G04 broadcasts 投递确认 ───────────────────────────────────────────
function checkG04() {
  console.log('\n─── CHK-G04 broadcasts-outbox 投递确认 ───');
  if (!fs.existsSync(BROADCASTS_DIR)) {
    results.G04 = '⚠️';
    issues.push('CHK-G04: broadcasts-outbox/ 不存在');
    return;
  }

  const devDirs = fs.readdirSync(BROADCASTS_DIR).filter(d => d.startsWith('DEV-'));
  let allSynced = true;

  for (const devId of devDirs) {
    const srcDir  = path.join(BROADCASTS_DIR, devId);
    const destDir = path.join(DEV_NODES_DIR, devId);
    if (!fs.existsSync(destDir)) continue;

    const broadcasts = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
    for (const file of broadcasts) {
      const dest = path.join(destDir, file);
      if (!fs.existsSync(dest)) {
        // 自动复制
        fs.copyFileSync(path.join(srcDir, file), dest);
        autoFixed.push(`CHK-G04: 自动投递广播 ${devId}/${file}`);
        console.log(`  🔧 自动投递: ${devId}/${file}`);
        allSynced = false;
      }
    }
  }

  results.G04 = '✅';
  if (allSynced) {
    console.log('  ✅ 所有广播已同步至 dev-nodes/');
  } else {
    console.log(`  ✅ 已自动修复 ${autoFixed.length} 个广播投递`);
  }
}

// ── CHK-G05 CI 健康检查 ───────────────────────────────────────────────────
async function checkG05() {
  console.log('\n─── CHK-G05 CI 健康检查 ───');
  if (!GITHUB_TOKEN) {
    results.G05 = '⚠️';
    console.log('  ⚠️  GITHUB_TOKEN 未配置，跳过 CI 检查');
    return;
  }

  return new Promise((resolve) => {
    const [owner, repoName] = REPO.split('/');
    const options = {
      hostname: 'api.github.com',
      path:     `/repos/${owner}/${repoName}/actions/runs?per_page=20`,
      method:   'GET',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept':        'application/vnd.github.v3+json',
        'User-Agent':    'zhuyuan-psp-inspector'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const body     = JSON.parse(data);
          const runs     = body.workflow_runs || [];
          const cutoff   = Date.now() - 24 * MS_PER_HOUR;
          const recent   = runs.filter(r => new Date(r.created_at).getTime() > cutoff);
          const failed   = recent.filter(r => r.conclusion === 'failure');

          if (failed.length > 0) {
            results.G05 = '❌';
            failed.forEach(r => {
              issues.push(`CHK-G05: CI 失败 · ${r.name} · ${r.html_url}`);
            });
            // 写入 signal-log
            const signalId = generateSignalId();
            writeSignalLog({
              signal_id:      signalId,
              trace_id:       PSP_TRACE_ID,
              timestamp:      now.toISOString(),
              signal_type:    'GL-DATA',
              direction:      'GitHub→Notion',
              sender:         '铸渊',
              receiver:       '霜砚',
              related_dev:    null,
              related_module: null,
              summary:        `CHK-G05: ${failed.length} 个 CI 失败`,
              payload:        { failed_runs: failed.map(r => ({ name: r.name, url: r.html_url })) },
              result:         '待处理',
              ack_signal_id:  null
            });
          } else {
            results.G05 = '✅';
            console.log(`  ✅ 最近24h CI: ${recent.length} 次运行，全部通过`);
          }
        } catch (err) {
          results.G05 = '⚠️';
          console.log(`  ⚠️  CI 数据解析失败: ${err.message}`);
        }
        resolve();
      });
    });

    req.on('error', (err) => {
      results.G05 = '⚠️';
      console.log(`  ⚠️  GitHub API 请求失败: ${err.message}`);
      resolve();
    });

    req.end();
  });
}

// ── 更新 memory.json ───────────────────────────────────────────────────────
function updateMemory(summary) {
  const memory = loadJson(MEMORY_PATH);
  if (!memory) return;

  if (!memory.events) memory.events = [];
  memory.events.unshift({
    date:        today,
    type:        'psp_inspection',
    description: summary,
    by:          '铸渊PSP巡检'
  });
  if (memory.events.length > 50) memory.events = memory.events.slice(0, 50);
  memory.last_updated = now.toISOString();

  saveJson(MEMORY_PATH, memory);
}

// ── 写入巡检结果到 signal-log ──────────────────────────────────────────────
function writeInspectionSignal(allPassed) {
  const signalId = generateSignalId();
  const summary  = allPassed
    ? '铸渊 PSP 巡检通过 · 全部检查项 ✅'
    : `铸渊 PSP 巡检完成 · 发现 ${issues.length} 个问题 · 自动修复 ${autoFixed.length} 项`;

  writeSignalLog({
    signal_id:      signalId,
    trace_id:       PSP_TRACE_ID,
    timestamp:      now.toISOString(),
    signal_type:    'GL-DATA',
    direction:      'GitHub→Notion',
    sender:         '铸渊',
    receiver:       '霜砚',
    related_dev:    null,
    related_module: null,
    summary,
    payload: {
      check_results: results,
      issues,
      auto_fixed: autoFixed
    },
    result:        allPassed ? '全通过' : '有问题',
    ack_signal_id: null
  });

  return summary;
}

// ── 主流程 ────────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('🔍 铸渊 PSP 分身巡检启动');
  console.log(`   日期: ${today}`);
  console.log('═══════════════════════════════════════════════════');

  checkG01();
  checkG02();
  await checkG03();
  checkG04();
  await checkG05();

  const allPassed = Object.values(results).every(v => v === '✅');
  const summary   = writeInspectionSignal(allPassed);
  updateMemory(summary);

  console.log('\n═══════════════════════════════════════════════════');
  console.log('📊 PSP 巡检报告:');
  Object.entries(results).forEach(([k, v]) => console.log(`  ${v} CHK-${k}`));

  if (autoFixed.length > 0) {
    console.log('\n🔧 自动修复:');
    autoFixed.forEach(f => console.log(`  · ${f}`));
  }

  if (issues.length > 0) {
    console.log('\n⚠️  待处理问题:');
    issues.forEach(i => console.log(`  · ${i}`));
  }

  console.log(`\n${allPassed ? '✅ 铸渊 PSP 巡检全部通过' : '⚠️  铸渊 PSP 巡检发现问题，已记录'}`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('❌ PSP 巡检致命错误:', err.message);
  process.exit(1);
});
