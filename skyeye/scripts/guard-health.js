#!/usr/bin/env node
/**
 * skyeye/scripts/guard-health.js
 * 天眼守卫健康检查脚本 — 逐一验证五个 Guard 进程状态
 * Activates and checks all Guard processes: GitHub / Notion / Actions / Gemini / Drive
 */

const fs = require('fs');
const path = require('path');

const SKYEYE_DIR = path.resolve(__dirname, '..');
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

function checkGuardHealth(filePath) {
  const guard = loadJSON(filePath);
  if (!guard) {
    return { status: 'error', reason: 'invalid_json', healthy: false };
  }

  const result = {
    guard_id: guard.guard_id,
    target_service: guard.target_service,
    status: guard.status,
    mode: guard.mode,
    healthy: false,
    checks: {}
  };

  // Check 1: Status is active
  result.checks.status_active = guard.status === 'active';

  // Check 2: Mode is not suspended
  result.checks.mode_operational = guard.mode !== 'suspended';

  // Check 3: Required fields present
  const requiredFields = ['guard_id', 'status', 'mode', 'quota_policy', 'health_check'];
  const missing = requiredFields.filter(f => !(f in guard));
  result.checks.fields_complete = missing.length === 0;
  if (missing.length > 0) {
    result.checks.missing_fields = missing;
  }

  // Check 4: Consecutive failures below threshold
  const failures = guard.health_check?.consecutive_failures || 0;
  const maxFailures = guard.health_check?.max_failures_before_alert || 3;
  result.checks.failures_within_limit = failures < maxFailures;
  result.checks.consecutive_failures = failures;

  // Check 5: Last heartbeat freshness (if available)
  if (guard.health_check?.last_check) {
    const lastCheckTime = new Date(guard.health_check.last_check).getTime();
    if (!isNaN(lastCheckTime)) {
      const lastCheckAge = Date.now() - lastCheckTime;
      const intervalMs = (guard.health_check.interval_hours || 6) * 60 * 60 * 1000;
      result.checks.heartbeat_fresh = lastCheckAge < intervalMs * 3; // 3x tolerance
    } else {
      result.checks.heartbeat_fresh = null; // Invalid date
    }
  } else {
    result.checks.heartbeat_fresh = null; // No heartbeat recorded yet
  }

  // Overall health determination
  result.healthy = result.checks.status_active
    && result.checks.mode_operational
    && result.checks.fields_complete
    && result.checks.failures_within_limit;

  return result;
}

function run() {
  console.log(`[SkyEye Guard Health] Starting guard health check`);
  console.log(`[SkyEye Guard Health] Timestamp: ${getTimestamp()}`);

  if (!fs.existsSync(GUARDS_DIR)) {
    console.error('[SkyEye Guard Health] ERROR: guards/ directory not found');
    process.exit(1);
  }

  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  const healthResult = {
    check_id: `GUARD-HEALTH-${getDateStr()}`,
    timestamp: getTimestamp(),
    total: files.length,
    healthy: 0,
    unhealthy: 0,
    guards: [],
    issues: []
  };

  for (const file of files) {
    const filePath = path.join(GUARDS_DIR, file);
    const health = checkGuardHealth(filePath);
    health.file = file;
    healthResult.guards.push(health);

    if (health.healthy) {
      healthResult.healthy++;
      console.log(`  ✅ ${health.guard_id || file}: healthy`);
    } else {
      healthResult.unhealthy++;
      const reason = !health.checks.status_active ? 'inactive'
        : !health.checks.mode_operational ? 'suspended'
        : !health.checks.fields_complete ? 'incomplete_config'
        : !health.checks.failures_within_limit ? 'too_many_failures'
        : 'unknown';
      healthResult.issues.push({
        guard: health.guard_id || file,
        file,
        reason,
        detail: health.checks
      });
      console.log(`  🔴 ${health.guard_id || file}: ${reason}`);
    }
  }

  healthResult.summary = {
    status: healthResult.unhealthy === 0 ? 'all_healthy'
      : healthResult.healthy >= 3 ? 'mostly_healthy'
      : 'degraded',
    healthy_ratio: `${healthResult.healthy}/${healthResult.total}`,
    issues_count: healthResult.issues.length
  };

  // Write log
  const logDir = path.join(LOGS_DIR, 'daily');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `guard-health-${getDateStr()}.json`);
  saveJSON(logPath, healthResult);

  console.log(`[SkyEye Guard Health] Result: ${healthResult.summary.status}`);
  console.log(`[SkyEye Guard Health] Healthy: ${healthResult.summary.healthy_ratio}`);
  console.log(`[SkyEye Guard Health] Issues: ${healthResult.summary.issues_count}`);
  console.log(`[SkyEye Guard Health] Log saved: ${logPath}`);

  console.log('---GUARD_HEALTH_JSON---');
  console.log(JSON.stringify(healthResult, null, 2));

  return healthResult;
}

run();
