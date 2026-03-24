#!/usr/bin/env node
/**
 * scripts/skyeye/credential-validator.js
 *
 * 天眼 OAuth2 凭据校验器 (Sky-Eye Credential Validator)
 *
 * 功能：对 Google Drive OAuth2 环境变量执行存在性检测
 *   - GDRIVE_CLIENT_ID 存在性
 *   - GDRIVE_CLIENT_SECRET 存在性
 *   - GDRIVE_REFRESH_TOKEN 存在性
 *
 * 可作为模块 require() 使用，也可直接运行：
 *   GDRIVE_CLIENT_ID='...' GDRIVE_CLIENT_SECRET='...' GDRIVE_REFRESH_TOKEN='...' node credential-validator.js
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ (冰朔)
 */

'use strict';

// OAuth2 必需环境变量
const REQUIRED_OAUTH2_VARS = [
  'GDRIVE_CLIENT_ID',
  'GDRIVE_CLIENT_SECRET',
  'GDRIVE_REFRESH_TOKEN'
];

/**
 * 验证 OAuth2 环境变量是否齐全
 * @returns {{ valid: boolean, issues: string[], diagnostics: object }}
 */
function validateOAuth2Credentials() {
  const result = {
    valid: false,
    issues: [],
    diagnostics: {
      auth_mode: 'oauth2',
      vars_checked: REQUIRED_OAUTH2_VARS.length,
      vars_present: 0,
      missing_vars: []
    }
  };

  for (const varName of REQUIRED_OAUTH2_VARS) {
    const val = process.env[varName];
    if (!val || val.trim().length === 0) {
      result.diagnostics.missing_vars.push(varName);
      result.issues.push(`Missing or empty environment variable: ${varName}`);
    } else {
      result.diagnostics.vars_present++;
    }
  }

  result.valid = result.issues.length === 0;
  return result;
}

/**
 * 生成人类可读的诊断报告
 * @param {object} validationResult - validateOAuth2Credentials 的返回值
 * @returns {string}
 */
function formatDiagnosticReport(validationResult) {
  const r = validationResult;
  const lines = [];

  lines.push('╔════════════════════════════════════════════════════════╗');
  lines.push('║  🛰️ 天眼 OAuth2 凭据校验报告 (Credential Audit)     ║');
  lines.push('╚════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`状态: ${r.valid ? '✅ 绿色信号 (PASS)' : '🔴 逻辑红区 (FAIL)'}`);
  lines.push(`认证模式: OAuth2 代理人`);
  lines.push(`环境变量检查: ${r.diagnostics.vars_present}/${r.diagnostics.vars_checked} 齐全`);

  if (r.diagnostics.missing_vars.length > 0) {
    lines.push(`缺失变量: ${r.diagnostics.missing_vars.join(', ')}`);
  }

  if (r.issues.length > 0) {
    lines.push('');
    lines.push('发现问题:');
    r.issues.forEach((issue, i) => {
      lines.push(`  ${i + 1}. ${issue}`);
    });
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════
// 模块导出
// ═══════════════════════════════════════════════

module.exports = { validateOAuth2Credentials, formatDiagnosticReport, REQUIRED_OAUTH2_VARS };

// ═══════════════════════════════════════════════
// CLI 模式
// ═══════════════════════════════════════════════

if (require.main === module) {
  const result = validateOAuth2Credentials();
  console.log(formatDiagnosticReport(result));
  console.log('');
  console.log('---CREDENTIAL_AUDIT_JSON---');
  console.log(JSON.stringify(result, null, 2));

  process.exit(result.valid ? 0 : 1);
}
