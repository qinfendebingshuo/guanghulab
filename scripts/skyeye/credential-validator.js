#!/usr/bin/env node
/**
 * scripts/skyeye/credential-validator.js
 *
 * 天眼密钥流完整性校验器 (Sky-Eye Credential Validator)
 *
 * 功能：对 Google Drive Service Account JSON 执行结构化检测
 *   - JSON 语法完整性（检测未闭合 {} / 截断）
 *   - 必需字段存在性验证
 *   - 字段值格式校验（private_key PEM 格式等）
 *
 * 可作为模块 require() 使用，也可直接运行：
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT='...' node credential-validator.js
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主控: TCS-0002∞ (冰朔)
 */

'use strict';

// Google Service Account JSON 必需字段
const REQUIRED_FIELDS = [
  'type',
  'project_id',
  'private_key_id',
  'private_key',
  'client_email',
  'client_id',
  'auth_uri',
  'token_uri'
];

/**
 * 验证 Service Account JSON 字符串
 * @param {string} jsonStr - JSON 字符串
 * @returns {{ valid: boolean, credentials: object|null, issues: string[], diagnostics: object }}
 */
function validateServiceAccountJSON(jsonStr) {
  const result = {
    valid: false,
    credentials: null,
    issues: [],
    diagnostics: {
      input_length: 0,
      is_empty: true,
      json_parseable: false,
      is_object: false,
      has_all_required_fields: false,
      missing_fields: [],
      field_checks: {},
      truncation_suspected: false
    }
  };

  // ① 空值检查
  if (!jsonStr || typeof jsonStr !== 'string') {
    result.issues.push('Credential string is empty or not a string');
    return result;
  }

  const trimmed = jsonStr.trim();
  result.diagnostics.input_length = trimmed.length;
  result.diagnostics.is_empty = trimmed.length === 0;

  if (trimmed.length === 0) {
    result.issues.push('Credential string is empty after trimming');
    return result;
  }

  // ② 基本结构检查（闭合括号）
  if (!trimmed.startsWith('{')) {
    result.issues.push(`JSON does not start with '{' (starts with '${trimmed[0]}')`);
  }
  if (!trimmed.endsWith('}')) {
    result.issues.push(`JSON does not end with '}' (ends with '${trimmed[trimmed.length - 1]}')`);
    result.diagnostics.truncation_suspected = true;
  }

  // 检查大括号平衡
  let braceDepth = 0;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === '{') braceDepth++;
    else if (trimmed[i] === '}') braceDepth--;
  }
  if (braceDepth !== 0) {
    result.issues.push(`Unbalanced braces: depth=${braceDepth} (${braceDepth > 0 ? 'missing closing }' : 'extra closing }'})`);
    result.diagnostics.truncation_suspected = braceDepth > 0;
  }

  // ③ JSON 解析
  let parsed;
  try {
    parsed = JSON.parse(trimmed);
    result.diagnostics.json_parseable = true;
  } catch (err) {
    result.issues.push(`JSON parse error: ${err.message}`);
    // 尝试诊断截断位置
    const posMatch = err.message.match(/position (\d+)/);
    if (posMatch) {
      const pos = parseInt(posMatch[1], 10);
      result.diagnostics.error_position = pos;
      result.diagnostics.context_at_error = trimmed.substring(
        Math.max(0, pos - 30),
        Math.min(trimmed.length, pos + 30)
      );
    }
    return result;
  }

  // ④ 类型检查
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    result.issues.push('Parsed JSON is not a plain object');
    return result;
  }

  result.diagnostics.is_object = true;
  result.credentials = parsed;

  // ⑤ 必需字段检查
  for (const field of REQUIRED_FIELDS) {
    if (!(field in parsed) || parsed[field] === undefined || parsed[field] === null || parsed[field] === '') {
      result.diagnostics.missing_fields.push(field);
      result.issues.push(`Missing or empty required field: '${field}'`);
    }
  }

  result.diagnostics.has_all_required_fields = result.diagnostics.missing_fields.length === 0;

  // ⑥ 字段格式校验
  if (parsed.type) {
    const typeOk = parsed.type === 'service_account';
    result.diagnostics.field_checks.type = typeOk ? 'ok' : `expected 'service_account', got '${parsed.type}'`;
    if (!typeOk) result.issues.push(`Field 'type' should be 'service_account', got '${parsed.type}'`);
  }

  if (parsed.private_key) {
    const pkStr = String(parsed.private_key);
    const hasBegin = pkStr.includes('-----BEGIN');
    const hasEnd = pkStr.includes('-----END');
    result.diagnostics.field_checks.private_key_format = hasBegin && hasEnd ? 'ok' : 'PEM markers missing';
    if (!hasBegin || !hasEnd) {
      result.issues.push('Field \'private_key\' does not contain valid PEM BEGIN/END markers');
      result.diagnostics.truncation_suspected = true;
    }
  }

  if (parsed.client_email) {
    const emailStr = String(parsed.client_email);
    const emailOk = /^[^@]+@[^@]+\.iam\.gserviceaccount\.com$/.test(emailStr);
    result.diagnostics.field_checks.client_email_format = emailOk ? 'ok' : 'not a valid service account email';
    if (!emailOk) result.issues.push('Field \'client_email\' does not match service account email pattern');
  }

  // ⑦ 最终判定
  result.valid = result.issues.length === 0;
  return result;
}

/**
 * 生成人类可读的诊断报告
 * @param {object} validationResult - validateServiceAccountJSON 的返回值
 * @returns {string}
 */
function formatDiagnosticReport(validationResult) {
  const r = validationResult;
  const lines = [];

  lines.push('╔════════════════════════════════════════════════════════╗');
  lines.push('║  🛰️ 天眼密钥流完整性校验报告 (Credential Audit)     ║');
  lines.push('╚════════════════════════════════════════════════════════╝');
  lines.push('');
  lines.push(`状态: ${r.valid ? '✅ 绿色信号 (PASS)' : '🔴 逻辑红区 (FAIL)'}`);
  lines.push(`输入长度: ${r.diagnostics.input_length} bytes`);
  lines.push(`JSON 可解析: ${r.diagnostics.json_parseable ? '是' : '否'}`);
  lines.push(`是否为对象: ${r.diagnostics.is_object ? '是' : '否'}`);
  lines.push(`全部必需字段: ${r.diagnostics.has_all_required_fields ? '齐全' : '缺失'}`);
  lines.push(`截断嫌疑: ${r.diagnostics.truncation_suspected ? '⚠️ 是' : '否'}`);

  if (r.diagnostics.missing_fields.length > 0) {
    lines.push(`缺失字段: ${r.diagnostics.missing_fields.join(', ')}`);
  }

  if (r.diagnostics.error_position !== undefined) {
    lines.push(`错误位置: position ${r.diagnostics.error_position}`);
    lines.push(`上下文: ...${r.diagnostics.context_at_error}...`);
  }

  if (Object.keys(r.diagnostics.field_checks).length > 0) {
    lines.push('');
    lines.push('字段检查:');
    for (const [k, v] of Object.entries(r.diagnostics.field_checks)) {
      lines.push(`  ${k}: ${v}`);
    }
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

module.exports = { validateServiceAccountJSON, formatDiagnosticReport, REQUIRED_FIELDS };

// ═══════════════════════════════════════════════
// CLI 模式
// ═══════════════════════════════════════════════

if (require.main === module) {
  const jsonStr = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  if (!jsonStr) {
    console.error('[credential-validator] GOOGLE_DRIVE_SERVICE_ACCOUNT not set');
    process.exit(1);
  }

  const result = validateServiceAccountJSON(jsonStr);
  console.log(formatDiagnosticReport(result));
  console.log('');
  console.log('---CREDENTIAL_AUDIT_JSON---');
  // 不输出 credentials 本身以避免泄露密钥
  const safeResult = { ...result, credentials: result.credentials ? '[REDACTED]' : null };
  console.log(JSON.stringify(safeResult, null, 2));

  process.exit(result.valid ? 0 : 1);
}
