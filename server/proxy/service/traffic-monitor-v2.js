#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/traffic-monitor-v2.js
// 📊 铸渊专线V2 · 多用户流量监控Agent
//
// 定期查询Xray Stats API获取每个用户的独立流量数据
// Xray通过email字段追踪每个client的流量:
//   user>>>email@example.com>>>traffic>>>uplink
//   user>>>email@example.com>>>traffic>>>downlink
//
// 运行方式: PM2 managed (zy-proxy-v2-monitor)
// 检查间隔: 每5分钟
// ═══════════════════════════════════════════════

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const XRAY_API_HOST = '127.0.0.1';
const XRAY_API_PORT = 10085;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟
const POOL_ALERTS_FILE = path.join(DATA_DIR, 'pool-alerts-state.json');

// 引入用户管理器
const userManager = require('./user-manager');

// ── 查询Xray流量统计 ────────────────────────
function queryXrayStats() {
  try {
    const result = execSync(
      `xray api statsquery --server=${XRAY_API_HOST}:${XRAY_API_PORT} -pattern ""`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (err) {
    console.error('[V2流量监控] Xray Stats API查询失败:', err.message);
    return null;
  }
}

// ── 解析每用户流量 ───────────────────────────
// Xray Stats格式: user>>>email@example.com>>>traffic>>>uplink
function parsePerUserStats(stats) {
  if (!stats || !stats.stat) return {};

  const userTraffic = {};

  for (const item of stats.stat) {
    if (!item.name || !item.name.startsWith('user>>>')) continue;

    // 格式: user>>>email>>>traffic>>>uplink/downlink
    const parts = item.name.split('>>>');
    if (parts.length < 4) continue;

    const email = parts[1];
    const direction = parts[3]; // 'uplink' or 'downlink'
    const bytes = parseInt(item.value || '0', 10);

    if (!userTraffic[email]) {
      userTraffic[email] = { upload: 0, download: 0 };
    }

    if (direction === 'uplink') {
      userTraffic[email].upload = bytes;
    } else if (direction === 'downlink') {
      userTraffic[email].download = bytes;
    }
  }

  return userTraffic;
}

// ── 流量池告警状态管理 ───────────────────────
function loadPoolAlerts() {
  try {
    return JSON.parse(fs.readFileSync(POOL_ALERTS_FILE, 'utf8'));
  } catch {
    return { period: '', alerts_sent: { p80: false, p90: false, p100: false } };
  }
}

function savePoolAlerts(state) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(POOL_ALERTS_FILE, JSON.stringify(state, null, 2));
}

// ── 检查流量池级别告警 ──────────────────────
function checkPoolAlerts(poolStatus) {
  const alertState = loadPoolAlerts();

  // 月度重置告警状态
  if (alertState.period !== poolStatus.period) {
    alertState.period = poolStatus.period;
    alertState.alerts_sent = { p80: false, p90: false, p100: false };
  }

  const pct = Math.min(poolStatus.pool_percentage, 100);

  if (pct >= 100 && !alertState.alerts_sent.p100) {
    console.log(`[V2流量监控] ⚠️ 流量池已用完! ${poolStatus.pool_used_gb.toFixed(2)}GB / ${poolStatus.pool_total_gb}GB`);
    alertState.alerts_sent.p100 = true;
  } else if (pct >= 90 && !alertState.alerts_sent.p90) {
    console.log(`[V2流量监控] ⚠️ 流量池已使用90%! ${poolStatus.pool_used_gb.toFixed(2)}GB / ${poolStatus.pool_total_gb}GB`);
    alertState.alerts_sent.p90 = true;
  } else if (pct >= 80 && !alertState.alerts_sent.p80) {
    console.log(`[V2流量监控] 📊 流量池已使用80%: ${poolStatus.pool_used_gb.toFixed(2)}GB / ${poolStatus.pool_total_gb}GB`);
    alertState.alerts_sent.p80 = true;
  }

  savePoolAlerts(alertState);
}

// ── 主循环 ───────────────────────────────────
function monitor() {
  console.log('[V2流量监控] 开始检查...');

  // 查询Xray统计
  const stats = queryXrayStats();
  if (!stats) {
    console.log('[V2流量监控] Xray统计暂不可用');
    return;
  }

  // 解析每用户流量
  const perUserTraffic = parsePerUserStats(stats);
  const users = userManager.getEnabledUsers();

  let totalUpload = 0;
  let totalDownload = 0;

  for (const user of users) {
    const traffic = perUserTraffic[user.email];
    if (traffic) {
      userManager.updateTraffic(user.email, traffic.upload, traffic.download);
      totalUpload += traffic.upload;
      totalDownload += traffic.download;

      const usedGB = ((traffic.upload + traffic.download) / (1024 ** 3)).toFixed(2);
      const quotaGB = (user.quota_bytes / (1024 ** 3)).toFixed(0);
      console.log(`  ${user.email}: ${usedGB}GB / ${quotaGB}GB`);
    }
  }

  const totalGB = ((totalUpload + totalDownload) / (1024 ** 3)).toFixed(2);
  console.log(`[V2流量监控] 总流量: ${totalGB}GB (${users.length}个用户)`);

  // 保存流量池状态
  const poolStatus = userManager.savePoolStatus();
  const poolTotalGB = poolStatus.pool_total_gb;
  console.log(`[V2流量监控] 流量池: ${poolStatus.pool_used_gb.toFixed(2)}GB / ${poolTotalGB}GB (${poolStatus.pool_percentage}%)`);

  // 检查流量池告警
  checkPoolAlerts(poolStatus);

  // 保存汇总数据
  const summaryFile = path.join(DATA_DIR, 'v2-traffic-summary.json');
  const summary = {
    total_upload_bytes: totalUpload,
    total_download_bytes: totalDownload,
    total_used_bytes: totalUpload + totalDownload,
    users_count: users.length,
    per_user: Object.entries(perUserTraffic).map(([email, t]) => ({
      email,
      upload_gb: parseFloat((t.upload / (1024 ** 3)).toFixed(2)),
      download_gb: parseFloat((t.download / (1024 ** 3)).toFixed(2)),
      total_gb: parseFloat(((t.upload + t.download) / (1024 ** 3)).toFixed(2))
    })),
    updated_at: new Date().toISOString()
  };

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log('[V2流量监控] 检查完成');
}

// ── 启动监控循环 ─────────────────────────────
console.log('📊 铸渊专线V2流量监控启动 · 共享流量池模型');
console.log(`  检查间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log(`  流量池:   ${userManager.POOL_QUOTA_BYTES / (1024 ** 3)}GB/月`);
console.log(`  数据目录: ${DATA_DIR}`);

// 立即执行一次
try { monitor(); } catch (err) { console.error('首次检查失败:', err.message); }

// 定期执行
setInterval(() => {
  try { monitor(); } catch (err) { console.error('监控异常:', err.message); }
}, CHECK_INTERVAL);
