#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/traffic-monitor.js
// 📊 铸渊专线 · 流量监控Agent
//
// 定期查询Xray Stats API获取流量数据
// 更新quota-status.json供订阅服务和仪表盘使用
//
// 运行方式: PM2 managed (zy-proxy-monitor)
// 检查间隔: 每5分钟
// ═══════════════════════════════════════════════

'use strict';

const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.ZY_PROXY_DATA_DIR || '/opt/zhuyuan/proxy/data';
const QUOTA_FILE = path.join(DATA_DIR, 'quota-status.json');
const HISTORY_FILE = path.join(DATA_DIR, 'traffic-history.json');
const XRAY_API_HOST = '127.0.0.1';
const XRAY_API_PORT = 10085;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟
const MONTHLY_QUOTA = 500 * 1024 * 1024 * 1024; // 500GB in bytes

// ── 确保数据目录存在 ────────────────────────
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── 查询Xray流量统计 ────────────────────────
function queryXrayStats() {
  try {
    const result = execSync(
      `xray api statsquery --server=${XRAY_API_HOST}:${XRAY_API_PORT} -pattern ""`,
      { encoding: 'utf8', timeout: 10000 }
    );
    return JSON.parse(result);
  } catch (err) {
    console.error('[流量监控] Xray Stats API查询失败:', err.message);
    return null;
  }
}

// ── 解析统计数据 ─────────────────────────────
function parseStats(stats) {
  if (!stats || !stats.stat) return { upload: 0, download: 0 };

  let upload = 0;
  let download = 0;

  for (const item of stats.stat) {
    if (item.name && item.name.includes('uplink')) {
      upload += parseInt(item.value || '0', 10);
    }
    if (item.name && item.name.includes('downlink')) {
      download += parseInt(item.value || '0', 10);
    }
  }

  return { upload, download };
}

// ── 读取当前配额状态 ────────────────────────
function readQuotaStatus() {
  try {
    return JSON.parse(fs.readFileSync(QUOTA_FILE, 'utf8'));
  } catch {
    const now = new Date();
    return {
      total_bytes: MONTHLY_QUOTA,
      upload_bytes: 0,
      download_bytes: 0,
      used_bytes: 0,
      reset_day: 1,
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      alerts_sent: { p80: false, p90: false, p100: false }
    };
  }
}

// ── 检查是否需要月度重置 ─────────────────────
function checkMonthlyReset(quota) {
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  if (quota.period !== currentPeriod) {
    console.log(`[流量监控] 月度重置: ${quota.period} → ${currentPeriod}`);

    // 保存上月记录到历史
    appendHistory(quota);

    // 重置Xray统计
    try {
      execSync(
        `xray api statsquery --server=${XRAY_API_HOST}:${XRAY_API_PORT} -pattern "" -reset`,
        { encoding: 'utf8', timeout: 10000 }
      );
    } catch {
      console.error('[流量监控] Xray统计重置失败');
    }

    return {
      ...quota,
      upload_bytes: 0,
      download_bytes: 0,
      used_bytes: 0,
      period: currentPeriod,
      updated_at: now.toISOString(),
      alerts_sent: { p80: false, p90: false, p100: false }
    };
  }

  return quota;
}

// ── 追加历史记录 ─────────────────────────────
function appendHistory(quota) {
  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch { /* ignore */ }

  history.push({
    period: quota.period,
    upload_bytes: quota.upload_bytes,
    download_bytes: quota.download_bytes,
    total_used: quota.upload_bytes + quota.download_bytes,
    total_quota: quota.total_bytes,
    recorded_at: new Date().toISOString()
  });

  // 只保留最近12个月
  if (history.length > 12) {
    history = history.slice(-12);
  }

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// ── 保存配额状态 ─────────────────────────────
function saveQuotaStatus(quota) {
  fs.writeFileSync(QUOTA_FILE, JSON.stringify(quota, null, 2));
}

// ── 检查配额告警 ─────────────────────────────
function checkAlerts(quota) {
  const usedPercent = ((quota.upload_bytes + quota.download_bytes) / quota.total_bytes) * 100;
  const alerts = [];

  if (usedPercent >= 100 && !quota.alerts_sent.p100) {
    alerts.push({ level: 'critical', percent: 100, message: '⚠️ 本月500GB配额已用完！等待下月重置。' });
    quota.alerts_sent.p100 = true;
  } else if (usedPercent >= 90 && !quota.alerts_sent.p90) {
    alerts.push({ level: 'warning', percent: 90, message: '⚠️ 本月配额已使用90%，请注意用量。' });
    quota.alerts_sent.p90 = true;
  } else if (usedPercent >= 80 && !quota.alerts_sent.p80) {
    alerts.push({ level: 'info', percent: 80, message: '📊 本月配额已使用80%。' });
    quota.alerts_sent.p80 = true;
  }

  return alerts;
}

// ── 发送告警邮件 ─────────────────────────────
async function sendAlert(alert, quota) {
  try {
    const sendScript = path.join(__dirname, 'send-subscription.js');
    const usedGB = ((quota.upload_bytes + quota.download_bytes) / (1024 ** 3)).toFixed(2);
    const totalGB = (quota.total_bytes / (1024 ** 3)).toFixed(0);

    // 使用execFileSync避免Shell命令注入 (不经过shell解释器)
    execFileSync('node', [sendScript, 'alert', `${alert.message} 已用 ${usedGB}GB / ${totalGB}GB`], {
      encoding: 'utf8',
      timeout: 30000
    });
    console.log(`[流量监控] 告警邮件已发送: ${alert.level}`);
  } catch (err) {
    console.error('[流量监控] 告警邮件发送失败:', err.message);
  }
}

// ── 主循环 ───────────────────────────────────
async function monitor() {
  console.log('[流量监控] 开始检查...');

  ensureDataDir();

  // 读取当前状态
  let quota = readQuotaStatus();

  // 检查月度重置
  quota = checkMonthlyReset(quota);

  // 查询Xray统计
  const stats = queryXrayStats();

  if (stats) {
    const { upload, download } = parseStats(stats);
    quota.upload_bytes = upload;
    quota.download_bytes = download;
    quota.used_bytes = upload + download;
    quota.updated_at = new Date().toISOString();

    const usedGB = ((upload + download) / (1024 ** 3)).toFixed(2);
    const totalGB = (quota.total_bytes / (1024 ** 3)).toFixed(0);
    const pct = ((quota.used_bytes / quota.total_bytes) * 100).toFixed(1);
    console.log(`[流量监控] 已用: ${usedGB}GB / ${totalGB}GB (${pct}%)`);
  } else {
    quota.updated_at = new Date().toISOString();
    console.log('[流量监控] Xray统计暂不可用，保持上次数据');
  }

  // 检查告警
  const alerts = checkAlerts(quota);
  for (const alert of alerts) {
    await sendAlert(alert, quota);
  }

  // 保存状态
  saveQuotaStatus(quota);
  console.log('[流量监控] 检查完成');
}

// ── 启动监控循环 ─────────────────────────────
console.log('📊 铸渊专线流量监控启动');
console.log(`  检查间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log(`  月配额: ${MONTHLY_QUOTA / (1024 ** 3)}GB`);
console.log(`  数据目录: ${DATA_DIR}`);

// 立即执行一次
monitor().catch(console.error);

// 定期执行
setInterval(() => {
  monitor().catch(console.error);
}, CHECK_INTERVAL);
