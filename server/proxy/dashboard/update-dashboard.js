#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/dashboard/update-dashboard.js
// 📊 铸渊专线 · README仪表盘更新
//
// 读取服务器上的流量数据，更新README.md中的仪表盘区域
// 仅显示用量数字和状态，不暴露任何敏感信息
//
// 用法:
//   node update-dashboard.js             — 从本地文件读取
//   node update-dashboard.js --remote    — 从服务器API读取
//   node update-dashboard.js --json <f>  — 从指定JSON文件读取
//
// 环境变量:
//   ZY_SERVER_HOST — 服务器地址 (--remote模式)
// ═══════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const README_PATH = path.join(ROOT, 'README.md');

// ── 默认配额数据 ─────────────────────────────
function getDefaultQuota() {
  const now = new Date();
  return {
    total_gb: 500,
    used_gb: 0,
    remaining_gb: 500,
    percentage_used: 0,
    period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
    reset_day: 1,
    updated_at: now.toISOString()
  };
}

// ── 从本地文件读取配额 ──────────────────────
function readLocalQuota() {
  const quotaFile = '/opt/zhuyuan/proxy/data/quota-status.json';
  try {
    const data = JSON.parse(fs.readFileSync(quotaFile, 'utf8'));
    const totalGB = (data.total_bytes / (1024 ** 3)).toFixed(1);
    const usedGB = ((data.upload_bytes + data.download_bytes) / (1024 ** 3)).toFixed(1);
    return {
      total_gb: parseFloat(totalGB),
      used_gb: parseFloat(usedGB),
      remaining_gb: parseFloat((totalGB - usedGB).toFixed(1)),
      percentage_used: parseFloat(((usedGB / totalGB) * 100).toFixed(1)),
      period: data.period,
      reset_day: data.reset_day || 1,
      updated_at: data.updated_at
    };
  } catch {
    return null;
  }
}

// ── 从服务器API读取配额 ─────────────────────
function readRemoteQuota() {
  const host = process.env.ZY_SERVER_HOST || '';
  // 验证host格式: 仅允许IP地址或域名
  if (!host || !/^[\w.-]+$/.test(host)) {
    console.error('⚠️ ZY_SERVER_HOST 未设置或格式无效');
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    http.get(`http://${host}:3802/quota`, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve(null);
        }
      });
    }).on('error', () => {
      resolve(null);
    });
  });
}

// ── 从JSON文件读取配额 ──────────────────────
function readJsonQuota(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ── 获取守护状态 ────────────────────────────
function getGuardianStatus() {
  try {
    const data = JSON.parse(fs.readFileSync('/opt/zhuyuan/proxy/data/guardian-status.json', 'utf8'));
    return data.status === 'healthy' ? '✅ 在线' : '⚠️ 异常';
  } catch {
    return '⏳ 待部署';
  }
}

// ── 生成进度条 ──────────────────────────────
function generateProgressBar(percentage) {
  const total = 20;
  const filled = Math.round((percentage / 100) * total);
  const empty = total - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);

  let emoji = '🟢';
  if (percentage >= 90) emoji = '🔴';
  else if (percentage >= 80) emoji = '🟡';

  return `${emoji} \`${bar}\` ${percentage}%`;
}

// ── 生成仪表盘Markdown ──────────────────────
function generateDashboard(quota, nodeStatus) {
  const now = new Date();
  const updatedStr = now.toISOString().slice(0, 10);

  // 计算下次重置日期
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, quota.reset_day || 1);
  const daysLeft = Math.ceil((nextReset - now) / (1000 * 60 * 60 * 24));
  const nextResetStr = nextReset.toISOString().slice(0, 10);

  const progressBar = generateProgressBar(quota.percentage_used);

  return `## 🌐 铸渊专线 · ZY-Proxy Dashboard

> 🔒 **安全说明**: 订阅链接通过邮件发送 · 仓库不存储敏感信息

| 指标 | 状态 |
|------|------|
| 📡 **节点状态** | ${nodeStatus} |
| 📊 **本月配额** | ${quota.total_gb} GB |
| 📈 **已使用** | ${quota.used_gb} GB |
| 📉 **剩余** | ${quota.remaining_gb} GB |
| 📅 **下次重置** | ${nextResetStr} (${daysLeft}天后) |
| 🔄 **数据更新** | ${updatedStr} |

${progressBar}

> 📱 支持: Shadowrocket (iOS) · Clash Verge (Mac/Win) · ClashMi (Android)
> 🛡️ 协议: VLESS + Reality · 最高级别反检测`;
}

// ── 更新README.md ────────────────────────────
function updateReadme(dashboard) {
  let readme = fs.readFileSync(README_PATH, 'utf8');

  const startMarker = '## 🌐 铸渊专线 · ZY-Proxy Dashboard';
  const endMarker = '> 🛡️ 协议: VLESS + Reality · 最高级别反检测';

  const startIdx = readme.indexOf(startMarker);

  if (startIdx !== -1) {
    // 替换现有仪表盘
    const endIdx = readme.indexOf(endMarker, startIdx);
    if (endIdx !== -1) {
      const endOfLine = readme.indexOf('\n', endIdx);
      readme = readme.slice(0, startIdx) + dashboard + readme.slice(endOfLine !== -1 ? endOfLine : readme.length);
    }
  } else {
    // 在部署状态后插入仪表盘
    const insertAfter = '铸渊100%主控恢复';
    const insertIdx = readme.indexOf(insertAfter);
    if (insertIdx !== -1) {
      const nextNewline = readme.indexOf('\n', insertIdx);
      readme = readme.slice(0, nextNewline + 1) + '\n---\n\n' + dashboard + '\n' + readme.slice(nextNewline + 1);
    } else {
      // 在部署状态部分后插入
      const deploySection = '## 🚀 部署状态';
      const deployIdx = readme.indexOf(deploySection);
      if (deployIdx !== -1) {
        const nextSection = readme.indexOf('\n---\n', deployIdx + deploySection.length);
        if (nextSection !== -1) {
          readme = readme.slice(0, nextSection) + '\n\n' + dashboard + '\n\n---' + readme.slice(nextSection + 4);
        }
      }
    }
  }

  fs.writeFileSync(README_PATH, readme);
  console.log('✅ README.md仪表盘已更新');
}

// ── 主入口 ───────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  let quota = null;

  if (args.includes('--remote')) {
    console.log('从服务器API读取配额...');
    quota = await readRemoteQuota();
  } else if (args.includes('--json')) {
    const jsonIdx = args.indexOf('--json');
    const jsonPath = args[jsonIdx + 1];
    if (jsonPath) {
      console.log(`从文件读取: ${jsonPath}`);
      quota = readJsonQuota(jsonPath);
    }
  } else {
    console.log('从本地文件读取配额...');
    quota = readLocalQuota();
  }

  if (!quota) {
    console.log('无法读取配额数据，使用默认值');
    quota = getDefaultQuota();
  }

  const nodeStatus = args.includes('--remote') ? '✅ 在线' : getGuardianStatus();
  const dashboard = generateDashboard(quota, nodeStatus);

  updateReadme(dashboard);
}

main().catch(console.error);
