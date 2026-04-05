#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/vpn-worker.js
// 🔌 VPN节点Worker · 像路由器一样插入ZY-CLOUD
//
// 在任意服务器上运行此脚本:
//   1. 自动检测本机Xray状态
//   2. 通过HLDP heartbeat向ZY-CLOUD注册
//   3. 定期心跳保持在线
//   4. 断开 = 自动从ZY-CLOUD节点列表移除
//
// 用法:
//   node vpn-worker.js --brain-host=10.0.0.5 \
//     --node-id=zy-feimao-gz --name="肥猫广州" \
//     --host=43.138.243.30 --pbk=xxx --sid=xxx \
//     --region=cn-gz --specs="2核4G"
//
// 或通过环境变量:
//   ZY_CLOUD_BRAIN=10.0.0.5:3804
//   VPN_NODE_ID=zy-feimao-gz
//   VPN_NODE_NAME=肥猫广州
//   VPN_NODE_HOST=43.138.243.30
//   VPN_NODE_PORT=443
//   VPN_NODE_PBK=xxx
//   VPN_NODE_SID=xxx
//   VPN_NODE_REGION=cn-gz
//   VPN_NODE_SPECS=2核4G
//   VPN_PERSONA_ID=PER-SS001
//
// 最小启动 (自动检测本机IP和Xray):
//   node vpn-worker.js --brain-host=10.0.0.5 --pbk=xxx
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const { execSync } = require('child_process');
const os = require('os');

// ── 配置解析 ────────────────────────────────
function parseConfig() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, ...val] = arg.slice(2).split('=');
      args[key] = val.join('=') || true;
    }
  }

  return {
    brainHost: args['brain-host'] || process.env.ZY_CLOUD_BRAIN || '',
    brainPort: parseInt(args['brain-port'] || process.env.ZY_CLOUD_BRAIN_PORT || '3804', 10),
    nodeId: args['node-id'] || process.env.VPN_NODE_ID || `vpn-${os.hostname()}`,
    nodeName: args['name'] || process.env.VPN_NODE_NAME || `VPN-${os.hostname()}`,
    nodeHost: args['host'] || process.env.VPN_NODE_HOST || getPublicIp(),
    nodePort: parseInt(args['port'] || process.env.VPN_NODE_PORT || '443', 10),
    nodePbk: args['pbk'] || process.env.VPN_NODE_PBK || '',
    nodeSid: args['sid'] || process.env.VPN_NODE_SID || '',
    nodeRegion: args['region'] || process.env.VPN_NODE_REGION || 'unknown',
    nodeSpecs: args['specs'] || process.env.VPN_NODE_SPECS || detectSpecs(),
    personaId: args['persona-id'] || process.env.VPN_PERSONA_ID || null,
    heartbeatInterval: parseInt(args['interval'] || process.env.VPN_HB_INTERVAL || '60', 10) * 1000,
  };
}

// ── 自动检测本机IP ──────────────────────────
function getPublicIp() {
  // 优先使用Node.js原生API（安全）
  const nets = os.networkInterfaces();
  for (const ifaces of Object.values(nets)) {
    for (const iface of ifaces) {
      if (!iface.internal && iface.family === 'IPv4') return iface.address;
    }
  }
  return '0.0.0.0';
}

// ── 自动检测本机配置 ────────────────────────
function detectSpecs() {
  const cpus = os.cpus().length;
  const memGB = Math.round(os.totalmem() / (1024 ** 3));
  return `${cpus}核${memGB}G`;
}

// ── 检查本机Xray状态 ────────────────────────
function checkLocalXray() {
  try {
    const result = execSync('pgrep -x xray', { encoding: 'utf8', timeout: 3000 });
    return result.trim().length > 0;
  } catch {
    return false;
  }
}

// ── 获取本机CPU和内存使用率 ──────────────────
function getResourceUsage() {
  const loadAvg = os.loadavg();
  const cpus = os.cpus().length;
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  return {
    cpu_cores: cpus,
    cpu_load_1m: parseFloat(loadAvg[0].toFixed(2)),
    cpu_usage_pct: parseFloat(((loadAvg[0] / cpus) * 100).toFixed(1)),
    memory_total_gb: parseFloat((totalMem / (1024 ** 3)).toFixed(1)),
    memory_free_gb: parseFloat((freeMem / (1024 ** 3)).toFixed(1)),
    memory_usage_pct: parseFloat((((totalMem - freeMem) / totalMem) * 100).toFixed(1))
  };
}

// ── 构建HLDP heartbeat消息 ──────────────────
function buildHldpHeartbeat(config) {
  const seq = String(Date.now()).slice(-6);
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const resources = getResourceUsage();
  const xrayRunning = checkLocalXray();

  return {
    hldp_v: '3.0',
    msg_id: `HLDP-VPN-${dateStr}-HB${seq}`,
    msg_type: 'heartbeat',
    sender: {
      id: config.personaId || config.nodeId,
      name: config.nodeName,
      role: 'vpn-worker'
    },
    receiver: {
      id: 'ICE-GL-ZY001',
      name: '铸渊'
    },
    timestamp: new Date().toISOString(),
    priority: 'routine',
    payload: {
      intent: 'VPN节点心跳 · 自动注册',
      data: {
        status: xrayRunning ? 'online' : 'xray_offline',
        uptime_seconds: Math.floor(os.uptime()),
        xray_running: xrayRunning,
        ...resources,
        vpn_node: {
          node_id: config.nodeId,
          name: config.nodeName,
          host: config.nodeHost,
          port: config.nodePort,
          pbk: config.nodePbk,
          sid: config.nodeSid,
          region: config.nodeRegion,
          server_code: config.nodeId,
          specs: config.nodeSpecs
        }
      }
    }
  };
}

// ── 发送心跳到ZY-CLOUD ─────────────────────
function sendHeartbeat(config) {
  return new Promise((resolve, reject) => {
    const hldpMsg = buildHldpHeartbeat(config);
    const postData = JSON.stringify(hldpMsg);

    const req = http.request({
      hostname: config.brainHost,
      port: config.brainPort,
      path: '/hldp/v3/heartbeat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: 10000
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          const ack = JSON.parse(body);
          resolve(ack);
        } catch {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end(postData);
  });
}

// ── 主循环 ───────────────────────────────────
async function main() {
  const config = parseConfig();

  // 验证必填参数
  if (!config.brainHost) {
    console.error('❌ 缺少 --brain-host (ZY-CLOUD大脑服务器内网IP)');
    console.error('   用法: node vpn-worker.js --brain-host=10.0.0.5 --pbk=xxx');
    process.exit(1);
  }
  if (!config.nodePbk) {
    console.error('❌ 缺少 --pbk (Reality公钥)');
    console.error('   在大脑服务器上运行 xray x25519 获取公钥');
    process.exit(1);
  }

  console.log('════════════════════════════════════════');
  console.log('🔌 VPN Worker · 节点接入ZY-CLOUD');
  console.log('════════════════════════════════════════');
  console.log(`  节点ID:     ${config.nodeId}`);
  console.log(`  节点名称:   ${config.nodeName}`);
  console.log(`  节点地址:   ${config.nodeHost}:${config.nodePort}`);
  console.log(`  节点区域:   ${config.nodeRegion}`);
  console.log(`  节点配置:   ${config.nodeSpecs}`);
  console.log(`  大脑地址:   ${config.brainHost}:${config.brainPort}`);
  console.log(`  心跳间隔:   ${config.heartbeatInterval / 1000}秒`);
  console.log(`  Xray状态:   ${checkLocalXray() ? '✅ 运行中' : '❌ 未运行'}`);
  console.log('════════════════════════════════════════');

  // 立即发送第一次心跳
  let consecutiveFailures = 0;

  async function heartbeatLoop() {
    try {
      const ack = await sendHeartbeat(config);
      consecutiveFailures = 0;

      const status = ack.payload?.data?.status || ack.status || 'unknown';
      const xrayOk = checkLocalXray();
      console.log(`[${new Date().toISOString().slice(11, 19)}] ❤️ 心跳发送成功 → ZY-CLOUD (status: ${status}, xray: ${xrayOk ? '✅' : '❌'})`);
    } catch (err) {
      consecutiveFailures++;
      console.error(`[${new Date().toISOString().slice(11, 19)}] ❌ 心跳失败 (${consecutiveFailures}次): ${err.message}`);

      if (consecutiveFailures >= 5) {
        console.error('  ⚠️ 连续5次心跳失败，ZY-CLOUD可能不可达');
        console.error(`  检查: curl http://${config.brainHost}:${config.brainPort}/health`);
      }
    }
  }

  // 首次心跳
  await heartbeatLoop();

  // 定期心跳
  setInterval(heartbeatLoop, config.heartbeatInterval);

  console.log('');
  console.log('🟢 VPN Worker已启动，持续向ZY-CLOUD发送心跳...');
  console.log('   Ctrl+C 停止 → 节点10分钟后自动从ZY-CLOUD移除');
}

main().catch(err => {
  console.error('❌ VPN Worker启动失败:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => { console.log('SIGTERM. Worker停止.'); process.exit(0); });
process.on('SIGINT', () => { console.log('\nWorker停止. 节点将在10分钟后从ZY-CLOUD自动移除.'); process.exit(0); });
