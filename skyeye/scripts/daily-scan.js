#!/usr/bin/env node
/**
 * skyeye/scripts/daily-scan.js
 * 天眼日常扫描脚本 — 轻量级每日巡检（感知 + 护卫 + 精算）
 * Covers Phase 1 steps ①②③ of the five-sense cycle
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(SKYEYE_DIR, 'infra-manifest.json');
const LEDGER_PATH = path.join(SKYEYE_DIR, 'quota-ledger.json');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const LOGS_DIR = path.join(SKYEYE_DIR, 'logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ① 感知（Sense）— 扫描 infra-manifest，确认节点状态
function sense() {
  const result = { status: 'ok', nodes: [], issues: [] };

  const manifest = loadJSON(MANIFEST_PATH);
  if (!manifest) {
    result.status = 'error';
    result.issues.push('infra-manifest.json 不可读');
    return result;
  }

  // Check last scan freshness (48h threshold)
  if (manifest.last_scan) {
    const lastScanTime = new Date(manifest.last_scan).getTime();
    if (isNaN(lastScanTime)) {
      result.issues.push('infra-manifest.last_scan 日期格式无效');
    }
    const lastScanAge = isNaN(lastScanTime) ? 0 : Date.now() - lastScanTime;
    const hours = Math.round(lastScanAge / (1000 * 60 * 60));
    if (!isNaN(lastScanTime) && hours > 48) {
      result.issues.push(`infra-manifest 最后扫描距今 ${hours}h，超过 48h 阈值`);
    }
  }

  // Enumerate registered infrastructure nodes
  if (manifest.infrastructure) {
    for (const [key, svc] of Object.entries(manifest.infrastructure)) {
      result.nodes.push({
        id: key,
        service: svc.service || key,
        plan: svc.plan || 'unknown'
      });
    }
  }

  return result;
}

// ② 护卫（Guard）— 逐一检查五个 Guard 守卫状态
function guardCheck() {
  const result = { total: 0, healthy: 0, issues: [], guards: [] };

  if (!fs.existsSync(GUARDS_DIR)) {
    result.issues.push('guards/ 目录不存在');
    return result;
  }

  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');
  result.total = files.length;

  for (const file of files) {
    const guard = loadJSON(path.join(GUARDS_DIR, file));
    if (!guard) {
      result.issues.push(`${file}: JSON 解析失败`);
      result.guards.push({ file, status: 'error', reason: 'invalid_json' });
      continue;
    }

    const entry = {
      file,
      guard_id: guard.guard_id,
      status: guard.status,
      mode: guard.mode,
      last_check: guard.health_check?.last_check || null,
      consecutive_failures: guard.health_check?.consecutive_failures || 0
    };

    if (guard.status === 'active' && (guard.health_check?.consecutive_failures || 0) < 3) {
      result.healthy++;
    } else {
      result.issues.push(`${guard.guard_id}: status=${guard.status}, failures=${guard.health_check?.consecutive_failures || 0}`);
    }

    result.guards.push(entry);
  }

  return result;
}

// ③ 精算（Audit）— 读 quota-ledger，检查配额消耗
function auditQuotas() {
  const result = { status: 'healthy', alerts: [], services: {} };

  const ledger = loadJSON(LEDGER_PATH);
  if (!ledger) {
    result.status = 'error';
    result.alerts.push('quota-ledger.json 不可读');
    return result;
  }

  if (ledger.services) {
    for (const [name, data] of Object.entries(ledger.services)) {
      let usagePct = 0;
      if (data.limit && data.used !== undefined && data.used !== null) {
        usagePct = Math.round((data.used / data.limit) * 100 * 10) / 10;
      }

      const entry = { usage_percent: usagePct, status: 'normal' };

      if (usagePct > 95) {
        entry.status = 'critical';
        result.alerts.push(`${name}: 配额消耗 ${usagePct}% > 95%，需立即降频`);
        result.status = 'critical';
      } else if (usagePct > 80) {
        entry.status = 'warning';
        result.alerts.push(`${name}: 配额消耗 ${usagePct}% > 80%，配额告警`);
        if (result.status !== 'critical') result.status = 'warning';
      }

      result.services[name] = entry;
    }
  }

  return result;
}

function run() {
  console.log(`[SkyEye Daily Scan] Starting daily scan`);
  console.log(`[SkyEye Daily Scan] Timestamp: ${getTimestamp()}`);

  const scanResult = {
    scan_id: `DAILY-SCAN-${getDateStr()}`,
    timestamp: getTimestamp(),
    type: 'daily',
    sense: sense(),
    guard_check: guardCheck(),
    quota_audit: auditQuotas(),
    summary: {}
  };

  // Aggregate summary
  const allIssues = [
    ...scanResult.sense.issues,
    ...scanResult.guard_check.issues,
    ...scanResult.quota_audit.alerts
  ];

  scanResult.summary = {
    nodes_registered: scanResult.sense.nodes.length,
    guards_healthy: `${scanResult.guard_check.healthy}/${scanResult.guard_check.total}`,
    quota_status: scanResult.quota_audit.status,
    total_issues: allIssues.length,
    issues: allIssues
  };

  // Write daily log
  const logDir = path.join(LOGS_DIR, 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `daily-scan-${getDateStr()}.json`);
  saveJSON(logPath, scanResult);

  console.log(`[SkyEye Daily Scan] Nodes: ${scanResult.summary.nodes_registered}`);
  console.log(`[SkyEye Daily Scan] Guards: ${scanResult.summary.guards_healthy}`);
  console.log(`[SkyEye Daily Scan] Quota: ${scanResult.summary.quota_status}`);
  console.log(`[SkyEye Daily Scan] Issues: ${scanResult.summary.total_issues}`);
  console.log(`[SkyEye Daily Scan] Log saved: ${logPath}`);

  console.log('---DAILY_SCAN_JSON---');
  console.log(JSON.stringify(scanResult, null, 2));

  return scanResult;
}

run();
