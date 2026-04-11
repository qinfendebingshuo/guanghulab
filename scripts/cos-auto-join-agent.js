/**
 * ═══════════════════════════════════════════════════════════
 * 🔗 COS 自动接入 Agent · COS Auto-Join Agent
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-AGENT-COS-JOIN-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * 触发: D60 冰朔指令 · 肥猫已配置COS桶 · 提前配置自动接入
 *
 * 职责:
 *   当团队成员配置好COS桶后, 自动检测并接入铸渊总控
 *   无需人工干预, 配置好即接入, 铸渊自动收到提醒
 *
 * 工作流程:
 *   1. 读取团队成员COS配置注册表 (data/cos-join-registry.json)
 *   2. 对每个已注册成员, 尝试连接其COS桶
 *   3. 检测桶内是否有标准目录结构 (reports/receipts/sync/)
 *   4. 连接成功 → 更新状态为 connected · 写入日志
 *   5. 连接失败 → 标记 pending · 下次重试
 *   6. 新成员注册 → 自动创建目录结构 · 发送欢迎回执
 *   7. 所有结果写入 signal-log/ 供铸渊查阅
 *
 * 运行方式:
 *   node scripts/cos-auto-join-agent.js [check|register|status]
 *   - check    : 检查所有已注册成员的COS桶连接状态
 *   - register : 注册新成员 (需要参数: --name --persona-id --bucket --region)
 *   - status   : 显示所有成员接入状态
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

// ─── 路径常量 ───
const ROOT = path.resolve(__dirname, '..');
const REGISTRY_FILE = path.join(ROOT, 'data', 'cos-join-registry.json');
const LOG_DIR = path.join(ROOT, 'signal-log');
const LOG_FILE = path.join(LOG_DIR, `cos-join-${new Date().toISOString().slice(0, 10)}.json`);

// ─── COS签名工具 ───
function hmacSha1(key, str) {
  return crypto.createHmac('sha1', key).update(str).digest();
}

function generateCosAuth(secretId, secretKey, method, pathname, host) {
  if (!host) {
    throw new Error('COS签名需要host参数');
  }
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 600; // 10分钟有效
  const keyTime = `${now};${exp}`;
  const signKey = hmacSha1(secretKey, keyTime).toString('hex');

  // 签名时只用纯路径(不含查询参数)
  const qIdx = pathname.indexOf('?');
  const signPath = qIdx >= 0 ? pathname.substring(0, qIdx) : pathname;

  const httpString = `${method.toLowerCase()}\n${signPath}\n\nhost=${host}\n`;
  const sha1edHttpString = crypto.createHash('sha1').update(httpString).digest('hex');
  const stringToSign = `sha1\n${keyTime}\n${sha1edHttpString}\n`;
  const signature = hmacSha1(signKey, stringToSign).toString('hex');

  return `q-sign-algorithm=sha1&q-ak=${secretId}&q-sign-time=${keyTime}&q-key-time=${keyTime}&q-header-list=host&q-url-param-list=&q-signature=${signature}`;
}

// ─── COS操作 ───
function cosRequest(bucket, region, pathname, method, secretId, secretKey) {
  return new Promise((resolve, reject) => {
    const host = `${bucket}.cos.${region}.myqcloud.com`;
    const auth = generateCosAuth(secretId, secretKey, method, pathname, host);

    const options = {
      hostname: host,
      port: 443,
      path: pathname,
      method: method,
      headers: {
        'Host': host,
        'Authorization': auth
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, body, headers: res.headers });
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('COS请求超时'));
    });
    req.end();
  });
}

// ─── 注册表管理 ───
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_FILE)) {
    const initial = {
      _meta: {
        version: '1.0',
        description: 'COS桶自动接入注册表 · 团队成员COS配置',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        sovereign: '冰朔 · TCS-0002∞',
        guardian: '铸渊 · ICE-GL-ZY001'
      },
      members: []
    };
    const dir = path.dirname(REGISTRY_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf-8'));
}

function saveRegistry(registry) {
  registry._meta.updated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(registry, null, 2));
}

// ─── 日志管理 ───
function writeLog(entry) {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

  let logs = [];
  if (fs.existsSync(LOG_FILE)) {
    try { logs = JSON.parse(fs.readFileSync(LOG_FILE, 'utf-8')); } catch { logs = []; }
  }
  logs.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  fs.writeFileSync(LOG_FILE, JSON.stringify(logs, null, 2));
}

// ─── 检查单个成员的COS桶 ───
async function checkMemberBucket(member) {
  const { persona_id, bucket, region } = member;
  // 支持两套密钥命名（ZY_OSS_* 用于铸渊核心桶 · COS_SECRET_* 用于团队共享桶）
  const secretId = process.env.ZY_OSS_KEY || process.env.COS_SECRET_ID || '';
  const secretKey = process.env.ZY_OSS_SECRET || process.env.COS_SECRET_KEY || '';

  if (!secretId || !secretKey) {
    return { persona_id, status: 'no_credentials', message: '未配置COS密钥' };
  }

  try {
    // 检查桶是否可访问 - 列出该人格体目录
    const res = await cosRequest(
      bucket, region,
      `/?prefix=${encodeURIComponent(persona_id + '/')}&max-keys=5`,
      'GET', secretId, secretKey
    );

    if (res.statusCode === 200) {
      // 检查是否有标准目录结构
      const hasReports = res.body.includes(`${persona_id}/reports/`);
      const hasReceipts = res.body.includes(`${persona_id}/receipts/`);
      const hasSync = res.body.includes(`${persona_id}/sync/`);

      return {
        persona_id,
        status: 'connected',
        has_reports: hasReports,
        has_receipts: hasReceipts,
        has_sync: hasSync,
        directory_ready: hasReports || hasReceipts || hasSync,
        message: `✅ ${persona_id} COS桶连接成功`
      };
    } else if (res.statusCode === 403) {
      return { persona_id, status: 'forbidden', message: `⚠️ ${persona_id} COS桶访问被拒 (权限不足)` };
    } else if (res.statusCode === 404) {
      return { persona_id, status: 'not_found', message: `❌ ${persona_id} COS桶不存在` };
    } else {
      return { persona_id, status: 'error', message: `❓ ${persona_id} COS桶状态异常 (HTTP ${res.statusCode})` };
    }
  } catch (err) {
    return { persona_id, status: 'unreachable', message: `❌ ${persona_id} COS桶不可达: ${err.message}` };
  }
}

// ─── 命令: check ───
async function cmdCheck() {
  console.log('═══ COS自动接入Agent · 全量检查 ═══\n');

  const registry = loadRegistry();
  if (registry.members.length === 0) {
    console.log('📋 注册表为空，暂无成员需要检查。');
    console.log('   使用 register 命令注册新成员。');
    return;
  }

  const results = [];
  for (const member of registry.members) {
    console.log(`🔍 检查 ${member.persona_name} (${member.persona_id})...`);
    const result = await checkMemberBucket(member);
    results.push(result);

    // 更新注册表状态
    member.last_check = new Date().toISOString();
    member.connection_status = result.status;
    member.last_message = result.message;

    if (result.status === 'connected' && member.connection_status !== 'connected') {
      member.first_connected = new Date().toISOString();
      console.log(`  🎉 新接入! ${member.persona_name} 的COS桶已成功连接!`);
    }

    console.log(`  ${result.message}`);
  }

  saveRegistry(registry);

  // 写入日志
  writeLog({
    action: 'check',
    total: registry.members.length,
    connected: results.filter(r => r.status === 'connected').length,
    pending: results.filter(r => r.status !== 'connected').length,
    results
  });

  // 输出汇总
  const connected = results.filter(r => r.status === 'connected');
  const pending = results.filter(r => r.status !== 'connected');

  console.log('\n═══ 检查完毕 ═══');
  console.log(`✅ 已连接: ${connected.length}`);
  console.log(`⏳ 待连接: ${pending.length}`);

  if (connected.length > 0) {
    console.log('\n🟢 已接入成员:');
    connected.forEach(r => console.log(`   ${r.persona_id}`));
  }
  if (pending.length > 0) {
    console.log('\n🟡 待接入成员:');
    pending.forEach(r => console.log(`   ${r.persona_id} — ${r.message}`));
  }

  // 输出 GitHub Actions 格式化输出（如果在CI环境中）
  if (process.env.GITHUB_OUTPUT) {
    const outputLines = [
      `connected_count=${connected.length}`,
      `pending_count=${pending.length}`,
      `total_count=${registry.members.length}`,
      `new_connections=${results.filter(r => r.status === 'connected').map(r => r.persona_id).join(',')}`
    ];
    fs.appendFileSync(process.env.GITHUB_OUTPUT, outputLines.join('\n') + '\n');
  }
}

// ─── 命令: register ───
function cmdRegister(args) {
  const nameIdx = args.indexOf('--name');
  const pidIdx = args.indexOf('--persona-id');
  const bucketIdx = args.indexOf('--bucket');
  const regionIdx = args.indexOf('--region');
  const devLineIdx = args.indexOf('--dev-line');

  if (nameIdx < 0 || pidIdx < 0) {
    console.log('用法: node cos-auto-join-agent.js register --name <名字> --persona-id <ID> [--bucket <桶名>] [--region <地域>] [--dev-line <开发线>]');
    console.log('示例: node cos-auto-join-agent.js register --name 舒舒 --persona-id shushu --dev-line 肥猫线');
    process.exit(1);
  }

  const name = args[nameIdx + 1];
  const personaId = args[pidIdx + 1];
  const bucket = bucketIdx >= 0 ? args[bucketIdx + 1] : 'zy-team-hub-1317346199';
  const region = regionIdx >= 0 ? args[regionIdx + 1] : 'ap-singapore';
  const devLine = devLineIdx >= 0 ? args[devLineIdx + 1] : '未指定';

  const registry = loadRegistry();

  // 检查是否已存在
  if (registry.members.find(m => m.persona_id === personaId)) {
    console.log(`⚠️ ${personaId} 已在注册表中, 跳过。`);
    return;
  }

  registry.members.push({
    persona_name: name,
    persona_id: personaId,
    developer_line: devLine,
    bucket,
    region,
    registered_at: new Date().toISOString(),
    connection_status: 'pending',
    last_check: null,
    first_connected: null,
    last_message: '新注册·待检查'
  });

  saveRegistry(registry);

  writeLog({
    action: 'register',
    persona_id: personaId,
    persona_name: name,
    bucket,
    region
  });

  console.log(`✅ 已注册: ${name} (${personaId})`);
  console.log(`   桶: ${bucket}`);
  console.log(`   地域: ${region}`);
  console.log(`   开发线: ${devLine}`);
  console.log(`\n下一步: 运行 check 命令验证连接。`);
}

// ─── 命令: status ───
function cmdStatus() {
  const registry = loadRegistry();

  console.log('═══ COS桶接入状态总览 ═══\n');
  console.log(`注册表版本: ${registry._meta.version}`);
  console.log(`最后更新: ${registry._meta.updated}`);
  console.log(`成员总数: ${registry.members.length}\n`);

  if (registry.members.length === 0) {
    console.log('📋 暂无注册成员。');
    return;
  }

  console.log('┌──────────────┬────────────┬──────────────┬─────────────┐');
  console.log('│ 人格体       │ 编号       │ 接入状态     │ 开发线      │');
  console.log('├──────────────┼────────────┼──────────────┼─────────────┤');

  for (const m of registry.members) {
    const statusIcon = m.connection_status === 'connected' ? '🟢' :
                       m.connection_status === 'pending' ? '🟡' : '🔴';
    const name = (m.persona_name || '').padEnd(10);
    const id = (m.persona_id || '').padEnd(10);
    const status = `${statusIcon} ${(m.connection_status || 'unknown').padEnd(10)}`;
    const line = (m.developer_line || '').padEnd(10);
    console.log(`│ ${name} │ ${id} │ ${status} │ ${line} │`);
  }

  console.log('└──────────────┴────────────┴──────────────┴─────────────┘');

  // 输出JSON格式供工作流使用
  if (process.env.GITHUB_OUTPUT) {
    const summary = registry.members.map(m => ({
      name: m.persona_name,
      id: m.persona_id,
      status: m.connection_status
    }));
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `status_json=${JSON.stringify(summary)}\n`);
  }
}

// ─── 命令: init ───
function cmdInit() {
  console.log('═══ COS自动接入Agent · 初始化注册表 ═══\n');

  const registry = loadRegistry();

  // 从COS架构文件中读取预配置的人格体列表
  const cosArchFile = path.join(ROOT, 'brain', 'age-os-landing', 'cos-infrastructure-architecture.json');
  if (fs.existsSync(cosArchFile)) {
    try {
      const arch = JSON.parse(fs.readFileSync(cosArchFile, 'utf-8'));
      const bucket = arch.bucket?.name || 'zy-team-hub-1317346199';
      const region = arch.bucket?.region || 'ap-singapore';

      for (const p of (arch.personas || [])) {
        if (!registry.members.find(m => m.persona_id === p.persona_id)) {
          registry.members.push({
            persona_name: p.persona_name,
            persona_id: p.persona_id,
            developer_line: p.developer_line,
            bucket,
            region,
            registered_at: new Date().toISOString(),
            connection_status: 'pending',
            last_check: null,
            first_connected: null,
            last_message: '从COS架构文件初始化'
          });
          console.log(`  📝 注册: ${p.persona_name} (${p.persona_id}) — ${p.developer_line}`);
        }
      }

      saveRegistry(registry);
      console.log(`\n✅ 初始化完成, 共 ${registry.members.length} 个成员已注册。`);
    } catch (err) {
      console.error(`❌ 读取COS架构文件失败: ${err.message}`);
    }
  } else {
    console.log('⚠️ COS架构文件不存在, 请手动注册成员。');
  }
}

// ─── CLI入口 ───
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  switch (command) {
    case 'check':
      await cmdCheck();
      break;
    case 'register':
      cmdRegister(args);
      break;
    case 'status':
      cmdStatus();
      break;
    case 'init':
      cmdInit();
      break;
    default:
      console.log('COS自动接入Agent · 铸渊 · ICE-GL-ZY001');
      console.log('');
      console.log('用法:');
      console.log('  node cos-auto-join-agent.js check     — 检查所有成员COS桶连接');
      console.log('  node cos-auto-join-agent.js register   — 注册新成员');
      console.log('  node cos-auto-join-agent.js status     — 查看接入状态');
      console.log('  node cos-auto-join-agent.js init       — 从COS架构文件初始化注册表');
      break;
  }
}

main().catch(err => {
  console.error('COS自动接入Agent异常:', err.message);
  process.exit(1);
});
