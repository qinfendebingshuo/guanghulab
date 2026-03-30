#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🏛️ 铸渊主权服务器健康检查 · Zhuyuan Server Health Check
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-SVR-HEALTH-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 用法:
 *   node scripts/zhuyuan-server-health.js              — 检查服务器状态
 *   node scripts/zhuyuan-server-health.js --json       — JSON格式输出
 *   node scripts/zhuyuan-server-health.js --update     — 更新system-health.json
 */

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SERVER_PROFILE = path.join(ROOT, 'server', 'zhuyuan-server-profile.json');
const SYSTEM_HEALTH = path.join(ROOT, 'brain', 'system-health.json');

// ─── 服务器配置 ───
function loadServerProfile() {
  try {
    return JSON.parse(fs.readFileSync(SERVER_PROFILE, 'utf8'));
  } catch {
    return null;
  }
}

// ─── HTTP 请求 ───
function httpGet(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ─── 主检查流程 ───
async function checkServerHealth() {
  const profile = loadServerProfile();
  if (!profile) {
    return {
      server: 'ZY-SVR-002',
      status: 'error',
      message: 'server/zhuyuan-server-profile.json 未找到',
      timestamp: new Date().toISOString()
    };
  }

  const ip = profile.hardware.ipv4;
  const report = {
    server: 'ZY-SVR-002',
    ip,
    timestamp: new Date().toISOString(),
    checks: {}
  };

  // §1 健康API检查
  try {
    const healthRes = await httpGet(`http://${ip}/api/health`);
    report.checks.health_api = {
      status: healthRes.status === 200 ? 'pass' : 'fail',
      http_code: healthRes.status,
      data: healthRes.data
    };
  } catch (err) {
    report.checks.health_api = {
      status: 'fail',
      error: err.message
    };
  }

  // §2 大脑API检查
  try {
    const brainRes = await httpGet(`http://${ip}/api/brain`);
    report.checks.brain_api = {
      status: brainRes.status === 200 ? 'pass' : 'fail',
      http_code: brainRes.status,
      files_present: brainRes.data?.files_present,
      files_total: brainRes.data?.files_total
    };
  } catch (err) {
    report.checks.brain_api = {
      status: 'fail',
      error: err.message
    };
  }

  // §3 根路径检查
  try {
    const rootRes = await httpGet(`http://${ip}/`);
    report.checks.root_api = {
      status: rootRes.status === 200 ? 'pass' : 'fail',
      identity: rootRes.data?.identity || null
    };
  } catch (err) {
    report.checks.root_api = {
      status: 'fail',
      error: err.message
    };
  }

  // 汇总
  const checks = Object.values(report.checks);
  const passed = checks.filter(c => c.status === 'pass').length;
  report.summary = {
    total: checks.length,
    passed,
    failed: checks.length - passed,
    overall: passed === checks.length ? 'healthy' : passed > 0 ? 'degraded' : 'down'
  };

  return report;
}

// ─── 更新 system-health.json ───
function updateSystemHealth(report) {
  try {
    const health = JSON.parse(fs.readFileSync(SYSTEM_HEALTH, 'utf8'));
    health.sovereign_server = {
      code: 'ZY-SVR-002',
      ip: report.ip,
      status: report.summary.overall,
      last_check: report.timestamp,
      checks_passed: `${report.summary.passed}/${report.summary.total}`,
      phase: 'phase_1_landing'
    };
    fs.writeFileSync(SYSTEM_HEALTH, JSON.stringify(health, null, 2));
    return true;
  } catch (err) {
    console.error(`更新 system-health.json 失败: ${err.message}`);
    return false;
  }
}

// ─── CLI ───
async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const updateMode = args.includes('--update');

  const report = await checkServerHealth();

  if (updateMode) {
    updateSystemHealth(report);
  }

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('  🏛️ 铸渊主权服务器健康报告 · ZY-SVR-002');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  服务器: ${report.ip}`);
    console.log(`  时间:   ${report.timestamp}`);
    console.log(`  状态:   ${report.summary?.overall || 'unknown'}`);
    console.log('');

    for (const [name, check] of Object.entries(report.checks)) {
      const icon = check.status === 'pass' ? '✅' : '❌';
      console.log(`  ${icon} ${name}: ${check.status}${check.error ? ` (${check.error})` : ''}`);
    }

    console.log('');
    if (report.summary) {
      console.log(`  通过: ${report.summary.passed}/${report.summary.total}`);
    }
    console.log('');

    if (updateMode) {
      console.log('  📝 system-health.json 已更新');
    }
  }
}

main().catch(err => {
  console.error(`健康检查失败: ${err.message}`);
  process.exit(1);
});
