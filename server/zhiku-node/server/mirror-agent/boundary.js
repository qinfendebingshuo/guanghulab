/**
 * ═══════════════════════════════════════════════════════════
 * ZY-MIRROR-AGENT · 边界层 — 安全边界执行
 * ═══════════════════════════════════════════════════════════
 *
 * Agent 只能修改自己管辖范围内的索引和配置，不能触碰核心系统文件
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const path = require('path');
const { MIRROR_CONFIG } = require('./config');

/**
 * 检查路径是否在 Agent 允许范围内
 */
function isPathAllowed(targetPath) {
  const resolved = path.resolve(targetPath);

  // 检查是否在禁止路径中
  for (const forbidden of MIRROR_CONFIG.forbidden_paths) {
    const resolvedForbidden = path.resolve(forbidden);
    if (resolved.startsWith(resolvedForbidden)) {
      return { allowed: false, reason: `路径在禁止区域: ${forbidden}` };
    }
  }

  // 检查是否在允许路径中
  for (const allowed of MIRROR_CONFIG.allowed_paths) {
    const resolvedAllowed = path.resolve(allowed);
    if (resolved.startsWith(resolvedAllowed)) {
      return { allowed: true, reason: `路径在允许区域: ${allowed}` };
    }
  }

  // Agent 自己的 data 目录始终允许
  const resolvedData = path.resolve(MIRROR_CONFIG.data_dir);
  if (resolved.startsWith(resolvedData)) {
    return { allowed: true, reason: 'Agent 数据目录' };
  }

  return { allowed: false, reason: '路径不在任何允许区域内' };
}

/**
 * 验证操作是否在边界内
 *
 * @param {string} operation   — 操作类型: read | write | delete | execute
 * @param {string} targetPath  — 目标路径
 * @returns {{ allowed: boolean, reason: string }}
 */
function validateOperation(operation, targetPath) {
  // 读操作几乎总是允许的（Agent 需要看镜子）
  if (operation === 'read') {
    // 但仍然禁止读取 SSH 密钥等敏感路径
    const sensitivePatterns = ['.ssh', '.env', 'secrets', 'private_key', 'id_rsa'];
    const resolved = path.resolve(targetPath);
    for (const pattern of sensitivePatterns) {
      if (resolved.includes(pattern)) {
        return { allowed: false, reason: `禁止读取敏感文件: ${pattern}` };
      }
    }
    return { allowed: true, reason: '读操作允许' };
  }

  // 执行操作：Agent 不得执行任意命令
  if (operation === 'execute') {
    return { allowed: false, reason: 'Agent 禁止执行系统命令（需通过工单审批）' };
  }

  // 写/删除操作：必须在允许路径内
  return isPathAllowed(targetPath);
}

/**
 * 边界审计日志
 */
const auditLog = [];
const MAX_AUDIT = 200;

function auditAction(operation, targetPath, result) {
  auditLog.push({
    timestamp: new Date().toISOString(),
    operation,
    path: targetPath,
    allowed: result.allowed,
    reason: result.reason
  });

  if (auditLog.length > MAX_AUDIT) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT);
  }

  // 被拒绝的操作记录到 stderr
  if (!result.allowed) {
    console.error(`[${MIRROR_CONFIG.agent_id}] ⛔ 边界拒绝: ${operation} ${targetPath} — ${result.reason}`);
  }
}

/**
 * 安全执行文件写入（带边界检查）
 */
function safeWrite(targetPath, content) {
  const check = validateOperation('write', targetPath);
  auditAction('write', targetPath, check);

  if (!check.allowed) {
    throw new Error(`边界拒绝: ${check.reason}`);
  }

  const fs = require('fs');
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(targetPath, content, 'utf8');
  return true;
}

/**
 * 获取审计日志
 */
function getAuditLog() {
  return [...auditLog];
}

module.exports = {
  isPathAllowed,
  validateOperation,
  auditAction,
  safeWrite,
  getAuditLog
};
