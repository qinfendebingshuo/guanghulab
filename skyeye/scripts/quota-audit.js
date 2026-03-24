#!/usr/bin/env node
/**
 * skyeye/scripts/quota-audit.js
 * 天眼配额审计脚本 — 配额精算与预警
 * Performs quota audit across all services defined in quota-ledger.json
 */

const fs = require('fs');
const path = require('path');

const SKYEYE_DIR = path.resolve(__dirname, '..');
const LEDGER_PATH = path.join(SKYEYE_DIR, 'quota-ledger.json');
const MANIFEST_PATH = path.join(SKYEYE_DIR, 'infra-manifest.json');
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

function getDaysRemainingInMonth() {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return lastDay.getDate() - now.getDate();
}

function auditService(name, data) {
  const result = {
    service: name,
    status: 'healthy',
    usage_percent: 0,
    alerts: [],
    actions: []
  };

  if (data.limit && data.used !== undefined && data.used !== null) {
    result.usage_percent = data.limit > 0
      ? Math.round((data.used / data.limit) * 100 * 10) / 10
      : 0;
  }

  // Threshold checks
  if (result.usage_percent > 95) {
    result.status = 'critical';
    result.alerts.push(`${name}: 配额消耗 ${result.usage_percent}% · 立即降频/暂停非核心触发`);
    result.actions.push('emergency_throttle');
  } else if (result.usage_percent > 80) {
    result.status = 'warning';
    result.alerts.push(`${name}: 配额消耗 ${result.usage_percent}% · 配额告警`);
    result.actions.push('reduce_frequency');
  }

  // Budget projection for monthly services
  if (data.remaining !== undefined) {
    const daysLeft = getDaysRemainingInMonth();
    if (daysLeft > 0) {
      result.daily_budget = Math.round(data.remaining / daysLeft);
    }
  }

  return result;
}

function run() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');

  console.log(`[SkyEye Quota Audit] Starting quota audit`);
  console.log(`[SkyEye Quota Audit] Timestamp: ${getTimestamp()}`);

  const ledger = loadJSON(LEDGER_PATH);
  if (!ledger) {
    console.error('[SkyEye Quota Audit] ERROR: Cannot load quota-ledger.json');
    process.exit(1);
  }

  const manifest = loadJSON(MANIFEST_PATH);

  const auditResult = {
    audit_id: `QUOTA-AUDIT-${getDateStr()}`,
    timestamp: getTimestamp(),
    services: {},
    overall_status: 'healthy',
    total_alerts: 0,
    actions_required: []
  };

  // Audit each service
  if (ledger.services) {
    for (const [name, data] of Object.entries(ledger.services)) {
      const serviceAudit = auditService(name, data);
      auditResult.services[name] = serviceAudit;

      if (serviceAudit.status === 'critical') {
        auditResult.overall_status = 'critical';
      } else if (serviceAudit.status === 'warning' && auditResult.overall_status !== 'critical') {
        auditResult.overall_status = 'warning';
      }

      auditResult.total_alerts += serviceAudit.alerts.length;
      auditResult.actions_required.push(...serviceAudit.actions);
    }
  }

  // Update ledger health summary
  if (ledger.health_summary) {
    ledger.health_summary.overall = auditResult.overall_status;
    ledger.health_summary.alerts = [];
    for (const [, svc] of Object.entries(auditResult.services)) {
      ledger.health_summary.alerts.push(...svc.alerts);
    }
    ledger.health_summary.last_updated = getTimestamp();
    saveJSON(LEDGER_PATH, ledger);
  }

  // Write audit log
  const logDir = path.join(LOGS_DIR, 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `quota-audit-${getDateStr()}.json`);
  saveJSON(logPath, auditResult);

  console.log(`[SkyEye Quota Audit] Overall: ${auditResult.overall_status}`);
  console.log(`[SkyEye Quota Audit] Alerts: ${auditResult.total_alerts}`);
  for (const [name, svc] of Object.entries(auditResult.services)) {
    console.log(`  ${name}: ${svc.status} (${svc.usage_percent}%)`);
  }
  console.log(`[SkyEye Quota Audit] Log saved: ${logPath}`);

  console.log('---QUOTA_AUDIT_JSON---');
  console.log(JSON.stringify(auditResult, null, 2));

  return auditResult;
}

run();
