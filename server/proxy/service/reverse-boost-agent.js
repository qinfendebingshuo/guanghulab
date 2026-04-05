#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/reverse-boost-agent.js
// 🚀 反向加速Agent · 服务端网络优化活模块
//
// 核心理念 (冰朔定根):
//   服务器只是桥梁，用户的光纤才是主引擎。
//   通过减少服务器瓶颈，让用户100M/300M/500M
//   的光纤能力尽可能穿透到外网。
//
// 优化策略:
//   1. BBR拥塞控制检测与优化
//   2. MTU自动探测
//   3. TCP连接参数优化
//   4. 系统级网络栈调优
//   5. Xray连接池配置优化
//
// 运行方式: PM2 managed (zy-reverse-boost)
// 检查间隔: 每15分钟
// ═══════════════════════════════════════════════

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const BOOST_STATUS_FILE = path.join(DATA_DIR, 'reverse-boost-status.json');
const CHECK_INTERVAL = 15 * 60 * 1000; // 15分钟

// ── 安全执行命令 ──────────────────────────────
function runCmd(cmd, timeout = 10000) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout }).trim() };
  } catch (err) {
    return { ok: false, output: err.message };
  }
}

// ── 检查BBR状态 ───────────────────────────────
function checkBBR() {
  const result = runCmd('sysctl net.ipv4.tcp_congestion_control');
  if (result.ok) {
    const algo = result.output.split('=').pop().trim();
    return {
      ok: true,
      algorithm: algo,
      is_bbr: algo === 'bbr',
      detail: `当前拥塞控制: ${algo}`
    };
  }
  return { ok: false, algorithm: 'unknown', is_bbr: false, detail: '无法检查BBR' };
}

// ── 检查可用拥塞控制算法 ──────────────────────
function getAvailableAlgorithms() {
  const result = runCmd('sysctl net.ipv4.tcp_available_congestion_control');
  if (result.ok) {
    return result.output.split('=').pop().trim().split(/\s+/);
  }
  return [];
}

// ── 检查当前MTU ───────────────────────────────
function checkMTU() {
  const result = runCmd("ip link show | grep 'mtu' | head -5");
  if (result.ok) {
    const mtuMatch = result.output.match(/mtu\s+(\d+)/);
    return {
      ok: true,
      mtu: mtuMatch ? parseInt(mtuMatch[1], 10) : 1500,
      detail: result.output.split('\n')[0]
    };
  }
  return { ok: false, mtu: 1500, detail: '无法检查MTU' };
}

// ── 检查TCP参数 ───────────────────────────────
function checkTcpParams() {
  const params = {};

  // TCP缓冲区大小
  const rmem = runCmd('sysctl net.ipv4.tcp_rmem');
  if (rmem.ok) params.tcp_rmem = rmem.output.split('=').pop().trim();

  const wmem = runCmd('sysctl net.ipv4.tcp_wmem');
  if (wmem.ok) params.tcp_wmem = wmem.output.split('=').pop().trim();

  // TCP快速打开
  const tfo = runCmd('sysctl net.ipv4.tcp_fastopen');
  if (tfo.ok) params.tcp_fastopen = tfo.output.split('=').pop().trim();

  // TCP keep-alive
  const keepalive = runCmd('sysctl net.ipv4.tcp_keepalive_time');
  if (keepalive.ok) params.tcp_keepalive_time = keepalive.output.split('=').pop().trim();

  // 连接跟踪
  const conntrack = runCmd('sysctl net.netfilter.nf_conntrack_max 2>/dev/null');
  if (conntrack.ok) params.conntrack_max = conntrack.output.split('=').pop().trim();

  return params;
}

// ── 检查网络负载 ──────────────────────────────
function checkNetworkLoad() {
  // 获取主网卡的流量统计
  const result = runCmd("cat /proc/net/dev | grep -E 'eth0|ens' | head -1");
  if (result.ok) {
    const parts = result.output.trim().split(/\s+/);
    if (parts.length >= 10) {
      return {
        ok: true,
        interface: parts[0].replace(':', ''),
        rx_bytes: parseInt(parts[1], 10),
        tx_bytes: parseInt(parts[9], 10),
        rx_packets: parseInt(parts[2], 10),
        tx_packets: parseInt(parts[10], 10)
      };
    }
  }
  return { ok: false };
}

// ── 优化建议生成 ──────────────────────────────
function generateOptimizations() {
  const optimizations = [];
  const applied = [];

  // 1. 检查BBR
  const bbr = checkBBR();
  if (!bbr.is_bbr) {
    const available = getAvailableAlgorithms();
    if (available.includes('bbr')) {
      optimizations.push({
        type: 'bbr',
        priority: 'high',
        current: bbr.algorithm,
        recommended: 'bbr',
        description: '启用BBR拥塞控制可显著提升吞吐量',
        command: 'sysctl -w net.ipv4.tcp_congestion_control=bbr'
      });
    }
  } else {
    applied.push('BBR拥塞控制已启用');
  }

  // 2. 检查TCP快速打开
  const tcpParams = checkTcpParams();
  if (tcpParams.tcp_fastopen !== '3') {
    optimizations.push({
      type: 'tcp_fastopen',
      priority: 'medium',
      current: tcpParams.tcp_fastopen || 'unknown',
      recommended: '3',
      description: 'TCP Fast Open可减少握手延迟',
      command: 'sysctl -w net.ipv4.tcp_fastopen=3'
    });
  } else {
    applied.push('TCP Fast Open已启用');
  }

  // 3. 检查TCP缓冲区
  // 推荐: rmem = 4096 131072 67108864, wmem = 4096 16384 67108864
  if (tcpParams.tcp_rmem) {
    const maxRmem = parseInt(tcpParams.tcp_rmem.split(/\s+/).pop(), 10);
    if (maxRmem < 67108864) {
      optimizations.push({
        type: 'tcp_rmem',
        priority: 'medium',
        current: tcpParams.tcp_rmem,
        recommended: '4096 131072 67108864',
        description: '增大TCP接收缓冲区可提升大文件传输速度',
        command: 'sysctl -w net.ipv4.tcp_rmem="4096 131072 67108864"'
      });
    } else {
      applied.push('TCP接收缓冲区已优化');
    }
  }

  return { optimizations, applied, tcp_params: tcpParams };
}

// ── 应用安全优化（仅无风险的参数）──────────────
function applySafeOptimizations(optimizations) {
  const results = [];

  for (const opt of optimizations) {
    // 只自动应用低风险优化
    if (opt.type === 'tcp_fastopen' || opt.type === 'bbr') {
      const result = runCmd(opt.command, 5000);
      results.push({
        type: opt.type,
        applied: result.ok,
        detail: result.ok ? `✅ 已应用: ${opt.description}` : `❌ 失败: ${result.output}`
      });
      if (result.ok) {
        console.log(`[反向加速] ✅ ${opt.description}`);
      }
    } else {
      results.push({
        type: opt.type,
        applied: false,
        detail: `⏭️ 跳过(需手动): ${opt.description}`
      });
    }
  }

  return results;
}

// ── 读取/保存状态 ─────────────────────────────
function readBoostStatus() {
  try {
    return JSON.parse(fs.readFileSync(BOOST_STATUS_FILE, 'utf8'));
  } catch {
    return {
      checks: 0,
      optimizations_applied: 0,
      last_check: null,
      status: 'initializing'
    };
  }
}

function saveBoostStatus(status) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(BOOST_STATUS_FILE, JSON.stringify(status, null, 2));
}

// ── 主巡检 ────────────────────────────────────
function boost() {
  console.log('[反向加速] 🚀 开始网络优化巡检...');

  const status = readBoostStatus();
  status.checks++;
  status.last_check = new Date().toISOString();

  // 检查系统网络状态
  const bbr = checkBBR();
  const mtu = checkMTU();
  const networkLoad = checkNetworkLoad();
  const { optimizations, applied, tcp_params } = generateOptimizations();

  console.log(`[反向加速] BBR: ${bbr.is_bbr ? '✅ 已启用' : '❌ 未启用'} (${bbr.algorithm})`);
  console.log(`[反向加速] MTU: ${mtu.mtu}`);
  console.log(`[反向加速] 已优化项: ${applied.length}个`);

  // 应用安全优化
  if (optimizations.length > 0) {
    console.log(`[反向加速] 发现${optimizations.length}个可优化项`);
    const results = applySafeOptimizations(optimizations);
    const appliedCount = results.filter(r => r.applied).length;
    status.optimizations_applied += appliedCount;
    status.last_optimizations = results;
  }

  // 更新状态
  status.status = 'active';
  status.current = {
    bbr: bbr,
    mtu: mtu,
    tcp_params: tcp_params,
    network_load: networkLoad.ok ? {
      interface: networkLoad.interface,
      rx_bytes: networkLoad.rx_bytes,
      tx_bytes: networkLoad.tx_bytes
    } : null,
    already_optimized: applied
  };

  saveBoostStatus(status);

  console.log(`[反向加速] 巡检完成 (第${status.checks}次)`);
}

// ── 启动巡检循环 ──────────────────────────────
console.log('🚀 光湖语言世界 · 反向加速Agent启动');
console.log(`  巡检间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log(`  优化策略: BBR拥塞控制 + TCP Fast Open + 缓冲区调优`);
console.log(`  核心理念: 服务器只是桥梁，用户光纤才是主引擎`);

// 立即执行一次
try { boost(); } catch (err) { console.error('首次巡检失败:', err.message); }

// 定期执行
setInterval(() => {
  try { boost(); } catch (err) { console.error('巡检异常:', err.message); }
}, CHECK_INTERVAL);
