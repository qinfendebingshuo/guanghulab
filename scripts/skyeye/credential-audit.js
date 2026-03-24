#!/usr/bin/env node
/**
 * scripts/skyeye/credential-audit.js
 *
 * 天眼全域系统审计 (Sky-Eye Credential Audit)
 *
 * 功能：
 *   ① 校验 OAuth2 凭据环境变量完整性
 *   ② 扫描所有依赖 Drive 凭据的工作流和脚本
 *   ③ 验证 YAML 语法（.github/workflows/ 下所有配置文件）
 *   ④ 生成审计报告写入 System_Logs/
 *
 * 环境变量：
 *   - GDRIVE_CLIENT_ID: (可选) OAuth 客户端 ID
 *   - GDRIVE_CLIENT_SECRET: (可选) OAuth 客户端密钥
 *   - GDRIVE_REFRESH_TOKEN: (可选) 长效刷新令牌
 *
 * 用法：node scripts/skyeye/credential-audit.js
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ (冰朔)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { validateOAuth2Credentials, formatDiagnosticReport } = require('./credential-validator');

const ROOT = path.resolve(__dirname, '../..');
const WORKFLOWS_DIR = path.join(ROOT, '.github/workflows');
const SYSTEM_LOGS_DIR = path.join(ROOT, 'System_Logs');

function getTimestamp() {
  return new Date().toISOString();
}

function getDateStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

// ═══════════════════════════════════════════════
// ① 密钥流校验
// ═══════════════════════════════════════════════

function auditCredential() {
  const hasAnyVar = process.env.GDRIVE_CLIENT_ID || process.env.GDRIVE_CLIENT_SECRET || process.env.GDRIVE_REFRESH_TOKEN;

  if (!hasAnyVar) {
    return {
      status: 'skipped',
      reason: 'OAuth2 credentials not available in environment (GDRIVE_CLIENT_ID / GDRIVE_CLIENT_SECRET / GDRIVE_REFRESH_TOKEN)',
      recommendation: 'Run this audit in a GitHub Actions workflow with the secrets configured'
    };
  }

  const validation = validateOAuth2Credentials();
  return {
    status: validation.valid ? 'pass' : 'fail',
    diagnostics: validation.diagnostics,
    issues: validation.issues,
    report: formatDiagnosticReport(validation)
  };
}

// ═══════════════════════════════════════════════
// ② 依赖图扫描
// ═══════════════════════════════════════════════

function scanCredentialDependencies() {
  const results = {
    workflows: [],
    scripts: [],
    total_dependents: 0
  };

  const SEARCH_PATTERN = 'GDRIVE_CLIENT_ID';

  // 扫描 workflows
  if (fs.existsSync(WORKFLOWS_DIR)) {
    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(WORKFLOWS_DIR, file), 'utf8');
        if (content.includes(SEARCH_PATTERN)) {
          results.workflows.push(file);
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  }

  // 扫描 scripts
  const scriptDirs = [
    path.join(ROOT, 'scripts'),
    path.join(ROOT, 'scripts/grid-db'),
    path.join(ROOT, 'scripts/skyeye')
  ];

  for (const dir of scriptDirs) {
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf8');
        if (content.includes(SEARCH_PATTERN)) {
          const relPath = path.relative(ROOT, path.join(dir, file));
          results.scripts.push(relPath);
        }
      } catch (e) {
        // Skip unreadable files
      }
    }
  }

  results.total_dependents = results.workflows.length + results.scripts.length;
  return results;
}

// ═══════════════════════════════════════════════
// ③ YAML 语法扫描
// ═══════════════════════════════════════════════

function scanYAMLSyntax() {
  const results = {
    total: 0,
    valid: 0,
    issues: []
  };

  if (!fs.existsSync(WORKFLOWS_DIR)) {
    results.issues.push({ file: '.github/workflows/', error: 'Directory not found' });
    return results;
  }

  const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
  results.total = files.length;

  for (const file of files) {
    const filePath = path.join(WORKFLOWS_DIR, file);
    try {
      const content = fs.readFileSync(filePath, 'utf8');

      // Basic YAML structural checks (without full YAML parser)
      const lines = content.split('\n');
      let hasName = false;
      let hasOn = false;
      let hasJobs = false;
      let tabIssues = 0;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^name:/.test(line)) hasName = true;
        if (/^on:/.test(line) || /^'on':/.test(line) || /^"on":/.test(line)) hasOn = true;
        if (/^jobs:/.test(line)) hasJobs = true;
        // Check for tabs (YAML should use spaces)
        if (line.includes('\t')) tabIssues++;
      }

      const fileIssues = [];
      if (!hasName) fileIssues.push('Missing top-level "name:" field');
      if (!hasOn) fileIssues.push('Missing top-level "on:" trigger');
      if (!hasJobs) fileIssues.push('Missing top-level "jobs:" section');
      if (tabIssues > 0) fileIssues.push(`${tabIssues} line(s) contain tabs (use spaces)`);

      if (fileIssues.length > 0) {
        results.issues.push({ file, errors: fileIssues });
      } else {
        results.valid++;
      }
    } catch (e) {
      results.issues.push({ file, errors: [`Read error: ${e.message}`] });
    }
  }

  return results;
}

// ═══════════════════════════════════════════════
// ④ 生成审计报告
// ═══════════════════════════════════════════════

function run() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  🛰️ 天眼全域系统审计 (Sky-Eye Audit)                ║');
  console.log('║  TCS-0002∞ → PER-ZY001                              ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log('');

  const auditReport = {
    audit_id: `AUDIT-${getDateStr()}`,
    timestamp: getTimestamp(),
    system: 'SYS-GLW-0001',
    guardian: 'PER-ZY001',
    controller: 'TCS-0002∞',
    credential_audit: auditCredential(),
    dependency_scan: scanCredentialDependencies(),
    yaml_scan: scanYAMLSyntax(),
    summary: {}
  };

  // Summary
  const credStatus = auditReport.credential_audit.status;
  const yamlIssues = auditReport.yaml_scan.issues.length;
  const totalDeps = auditReport.dependency_scan.total_dependents;

  auditReport.summary = {
    credential_status: credStatus,
    yaml_issues: yamlIssues,
    yaml_total: auditReport.yaml_scan.total,
    yaml_valid: auditReport.yaml_scan.valid,
    total_credential_dependents: totalDeps,
    overall_status: credStatus === 'pass' && yamlIssues === 0 ? 'GREEN' : 'RED'
  };

  // Console output
  console.log(`[Sky-Eye Audit] Credential status: ${credStatus}`);
  if (auditReport.credential_audit.report) {
    console.log('');
    console.log(auditReport.credential_audit.report);
  }
  console.log('');
  console.log(`[Sky-Eye Audit] Credential dependents: ${totalDeps} (${auditReport.dependency_scan.workflows.length} workflows, ${auditReport.dependency_scan.scripts.length} scripts)`);
  console.log(`[Sky-Eye Audit] YAML scan: ${auditReport.yaml_scan.valid}/${auditReport.yaml_scan.total} valid`);

  if (yamlIssues > 0) {
    console.log(`[Sky-Eye Audit] YAML issues found in ${yamlIssues} file(s):`);
    for (const issue of auditReport.yaml_scan.issues) {
      console.log(`  - ${issue.file}: ${issue.errors ? issue.errors.join('; ') : issue.error}`);
    }
  }

  console.log('');
  console.log(`[Sky-Eye Audit] Overall: ${auditReport.summary.overall_status === 'GREEN' ? '✅ 绿色信号' : '🔴 逻辑红区'}`);

  // Write report to System_Logs/
  if (!fs.existsSync(SYSTEM_LOGS_DIR)) {
    fs.mkdirSync(SYSTEM_LOGS_DIR, { recursive: true });
  }
  const reportPath = path.join(SYSTEM_LOGS_DIR, `credential-audit-${getDateStr()}.json`);
  // Ensure no credential data leaks into the report
  const safeReport = JSON.parse(JSON.stringify(auditReport));
  if (safeReport.credential_audit && safeReport.credential_audit.diagnostics) {
    delete safeReport.credential_audit.diagnostics.context_at_error;
  }
  fs.writeFileSync(reportPath, JSON.stringify(safeReport, null, 2) + '\n', 'utf8');
  console.log(`[Sky-Eye Audit] Report saved: ${reportPath}`);

  // Also write to skyeye logs
  const skyeyeLogDir = path.join(ROOT, 'skyeye/logs/daily');
  if (!fs.existsSync(skyeyeLogDir)) {
    fs.mkdirSync(skyeyeLogDir, { recursive: true });
  }
  const skyeyeLogPath = path.join(skyeyeLogDir, `credential-audit-${getDateStr()}.json`);
  fs.writeFileSync(skyeyeLogPath, JSON.stringify(safeReport, null, 2) + '\n', 'utf8');

  console.log('');
  console.log('---AUDIT_RESULT_JSON---');
  console.log(JSON.stringify(safeReport, null, 2));

  return auditReport;
}

run();
