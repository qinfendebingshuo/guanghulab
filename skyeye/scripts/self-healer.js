#!/usr/bin/env node
/**
 * skyeye/scripts/self-healer.js
 * 天眼自愈引擎 — 自动修复损坏配置、清理过期数据
 * Phase 4 of weekly scan: Self-Heal
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const SKYEYE_DIR = path.resolve(__dirname, '..');
const GUARDS_DIR = path.join(SKYEYE_DIR, 'guards');
const TEMPLATE_PATH = path.join(GUARDS_DIR, 'guard-template.json');
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

function repairGuardConfigs() {
  const results = { repaired: [], failed: [] };
  const template = loadJSON(TEMPLATE_PATH);
  if (!template) {
    results.failed.push({ file: 'guard-template.json', reason: 'Template missing or invalid' });
    return results;
  }

  const requiredFields = ['guard_id', 'status', 'mode', 'buffer_policy', 'quota_policy', 'trigger_policy', 'health_check'];

  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  for (const file of files) {
    const filePath = path.join(GUARDS_DIR, file);
    let guard = loadJSON(filePath);

    if (!guard) {
      // File is corrupted - rebuild from template
      console.log(`  [REPAIR] ${file}: Corrupted JSON, rebuilding from template`);
      guard = { ...template };
      guard.guard_id = `GUARD-${file.replace('-guard.json', '').toUpperCase()}`;
      guard.status = 'repaired';
      guard.last_updated_by = 'skyeye-self-healer';
      guard.last_updated_at = getTimestamp();
      saveJSON(filePath, guard);
      results.repaired.push({ file, action: 'rebuilt_from_template' });
      continue;
    }

    // Check for missing fields and fill from template
    let modified = false;
    for (const field of requiredFields) {
      if (!(field in guard)) {
        guard[field] = template[field];
        modified = true;
        console.log(`  [REPAIR] ${file}: Added missing field '${field}'`);
      }
    }

    if (modified) {
      guard.last_updated_by = 'skyeye-self-healer';
      guard.last_updated_at = getTimestamp();
      saveJSON(filePath, guard);
      results.repaired.push({ file, action: 'filled_missing_fields' });
    }
  }

  return results;
}

function cleanExpiredBuffers() {
  const results = { files_cleaned: 0, directories: [] };
  const processedDir = path.join(ROOT, 'buffer/processed');

  if (!fs.existsSync(processedDir)) return results;

  const maxAgeDays = 7;
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

  try {
    const files = fs.readdirSync(processedDir);
    for (const file of files) {
      const filePath = path.join(processedDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < cutoff) {
        if (stat.isFile()) {
          fs.unlinkSync(filePath);
          results.files_cleaned++;
        }
      }
    }
    results.directories.push({ path: 'buffer/processed', cleaned: results.files_cleaned });
  } catch (e) {
    // Ignore errors during cleanup
  }

  return results;
}

function cleanExpiredLogs() {
  const results = { files_cleaned: 0 };
  const maxAgeDays = 30;
  const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000);

  const logDirs = [
    path.join(LOGS_DIR, 'daily'),
    path.join(LOGS_DIR, 'weekly')
  ];

  for (const dir of logDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file === '.gitkeep') continue;
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.mtimeMs < cutoff && stat.isFile()) {
          fs.unlinkSync(filePath);
          results.files_cleaned++;
        }
      }
    } catch (e) {
      // Ignore errors during cleanup
    }
  }

  return results;
}

function restartSuspendedGuards() {
  const results = { restarted: [] };

  const files = fs.readdirSync(GUARDS_DIR)
    .filter(f => f.endsWith('.json') && f !== 'guard-template.json');

  for (const file of files) {
    const filePath = path.join(GUARDS_DIR, file);
    const guard = loadJSON(filePath);
    if (!guard) continue;

    // Restart suspended guards with healthy checks
    if (guard.mode === 'suspended' && guard.health_check) {
      // Reset health check status for retry
      guard.health_check.consecutive_failures = 0;
      guard.health_check.last_status = 'pending_restart';
      guard.mode = 'buffer';
      guard.status = 'active';
      guard.last_updated_by = 'skyeye-self-healer';
      guard.last_updated_at = getTimestamp();
      saveJSON(filePath, guard);
      results.restarted.push({ file, guard_id: guard.guard_id });
      console.log(`  [RESTART] ${file}: Guard restarted`);
    }
  }

  return results;
}

function ensureDirectories() {
  const results = { created: [] };
  const requiredDirs = [
    'skyeye/scan-report',
    'skyeye/logs/daily',
    'skyeye/logs/weekly',
    'buffer/inbox',
    'buffer/staging',
    'buffer/processed',
    'System_Logs'
  ];

  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      results.created.push(dir);
      console.log(`  [CREATE] Directory: ${dir}`);
    }
  }

  return results;
}

/**
 * 天眼密钥流校验 — 验证 GOOGLE_DRIVE_SERVICE_ACCOUNT 环境变量
 * 仅在环境变量可用时执行（CI 环境）
 */
function validateCredentials() {
  const result = { status: 'skipped', issues: [] };

  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!serviceAccountJson) {
    result.reason = 'GOOGLE_DRIVE_SERVICE_ACCOUNT not available';
    return result;
  }

  try {
    const { validateServiceAccountJSON } = require('../../scripts/skyeye/credential-validator');
    const validation = validateServiceAccountJSON(serviceAccountJson);
    result.status = validation.valid ? 'pass' : 'fail';
    result.issues = validation.issues;
    if (!validation.valid) {
      console.log(`  [CREDENTIAL] 🔴 Validation failed: ${validation.issues.join('; ')}`);
    } else {
      console.log('  [CREDENTIAL] ✅ Service account credentials valid');
    }
  } catch (e) {
    result.status = 'error';
    result.reason = `Validator load error: ${e.message}`;
  }

  return result;
}

function run() {
  console.log(`[SkyEye Self-Healer] Starting self-heal process`);
  console.log(`[SkyEye Self-Healer] Timestamp: ${getTimestamp()}`);

  const healResult = {
    heal_id: `HEAL-${getDateStr()}`,
    timestamp: getTimestamp(),
    guard_repairs: repairGuardConfigs(),
    buffer_cleanup: cleanExpiredBuffers(),
    log_cleanup: cleanExpiredLogs(),
    guard_restarts: restartSuspendedGuards(),
    directory_fixes: ensureDirectories(),
    credential_check: validateCredentials(),
    summary: {}
  };

  healResult.summary = {
    configs_repaired: healResult.guard_repairs.repaired.length,
    files_cleaned: healResult.buffer_cleanup.files_cleaned + healResult.log_cleanup.files_cleaned,
    guards_restarted: healResult.guard_restarts.restarted.length,
    directories_created: healResult.directory_fixes.created.length,
    credential_status: healResult.credential_check.status
  };

  // Write log
  const logDir = path.join(LOGS_DIR, 'weekly');
  if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
  const logPath = path.join(logDir, `self-heal-${getDateStr()}.json`);
  saveJSON(logPath, healResult);

  console.log(`[SkyEye Self-Healer] Repairs: ${healResult.summary.configs_repaired}`);
  console.log(`[SkyEye Self-Healer] Files cleaned: ${healResult.summary.files_cleaned}`);
  console.log(`[SkyEye Self-Healer] Guards restarted: ${healResult.summary.guards_restarted}`);
  console.log(`[SkyEye Self-Healer] Dirs created: ${healResult.summary.directories_created}`);
  console.log(`[SkyEye Self-Healer] Credential status: ${healResult.summary.credential_status}`);
  console.log(`[SkyEye Self-Healer] Log saved: ${logPath}`);

  console.log('---HEAL_RESULT_JSON---');
  console.log(JSON.stringify(healResult, null, 2));

  return healResult;
}

run();
