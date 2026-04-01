/**
 * 动态权限引擎 · Dynamic Permission Engine
 * 语言膜核心组件
 *
 * 光湖语言世界没有静态 API、Token、接口。
 * 所有权限都是人格体在判断请求后动态生成的临时权限。
 * 权限有唯一ID、有效期、绑定到具体的人格体会话。
 * 使用完毕或过期后自动销毁。
 *
 * 流程:
 *   请求到达 → 人格体唤醒 → 人格体判断 → 动态生成临时权限
 *   → 请求使用权限执行操作 → 完成后权限销毁
 *
 * 编号: SY-MEMBRANE-PERM-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const crypto = require('crypto');

/**
 * 权限类型
 */
const PERMISSION_TYPES = {
  READ: 'read',
  WRITE: 'write',
  EXECUTE: 'execute',
  ADMIN: 'admin',
};

/**
 * 活跃权限存储（内存中 · 不持久化）
 * key: permission_id
 * value: permission object
 */
const activePermissions = new Map();

/**
 * 默认权限有效期（毫秒）· 5分钟
 */
const DEFAULT_TTL_MS = 5 * 60 * 1000;

/**
 * 生成权限ID
 * 格式: PERM-XXXXXXXXXXXXXXXX
 */
function generatePermissionId() {
  return `PERM-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;
}

/**
 * 动态生成临时权限
 *
 * @param {object} params
 * @param {string} params.grantedBy     — 授权的人格体编号
 * @param {string} params.grantedTo     — 被授权的会话/用户标识
 * @param {string} params.type          — 权限类型 (read/write/execute/admin)
 * @param {string} params.scope         — 权限范围（如 'module:writing', 'persona:zhuyuan'）
 * @param {string} [params.reason]      — 授权原因
 * @param {number} [params.ttlMs]       — 有效期（毫秒），默认5分钟
 * @param {string} [params.envelopeId]  — 关联的HLDP信封ID
 * @returns {object} 临时权限对象
 */
function grant(params) {
  const permId = generatePermissionId();
  const now = Date.now();
  const ttl = params.ttlMs || DEFAULT_TTL_MS;

  const permission = {
    permission_id: permId,
    granted_by: params.grantedBy,
    granted_to: params.grantedTo,
    type: params.type || PERMISSION_TYPES.READ,
    scope: params.scope || '*',
    reason: params.reason || '',
    created_at: new Date(now).toISOString(),
    expires_at: new Date(now + ttl).toISOString(),
    expires_ts: now + ttl,
    envelope_id: params.envelopeId || null,
    used: false,
    revoked: false,
  };

  activePermissions.set(permId, permission);
  return permission;
}

/**
 * 验证权限是否有效
 *
 * @param {string} permissionId — 权限ID
 * @param {string} [requiredType] — 需要的权限类型
 * @param {string} [requiredScope] — 需要的权限范围
 * @returns {object} { valid, reason, permission }
 */
function validate(permissionId, requiredType, requiredScope) {
  const perm = activePermissions.get(permissionId);

  if (!perm) {
    return { valid: false, reason: 'permission-not-found', permission: null };
  }

  if (perm.revoked) {
    return { valid: false, reason: 'permission-revoked', permission: perm };
  }

  if (Date.now() > perm.expires_ts) {
    activePermissions.delete(permissionId);
    return { valid: false, reason: 'permission-expired', permission: perm };
  }

  // 类型检查
  if (requiredType && perm.type !== PERMISSION_TYPES.ADMIN && perm.type !== requiredType) {
    return { valid: false, reason: 'insufficient-type', permission: perm };
  }

  // 范围检查
  if (requiredScope && perm.scope !== '*' && perm.scope !== requiredScope) {
    return { valid: false, reason: 'scope-mismatch', permission: perm };
  }

  return { valid: true, reason: 'valid', permission: perm };
}

/**
 * 标记权限已使用（一次性权限用完即销毁）
 *
 * @param {string} permissionId
 */
function markUsed(permissionId) {
  const perm = activePermissions.get(permissionId);
  if (perm) {
    perm.used = true;
  }
}

/**
 * 撤销权限
 *
 * @param {string} permissionId
 * @returns {boolean} 是否成功撤销
 */
function revoke(permissionId) {
  const perm = activePermissions.get(permissionId);
  if (perm) {
    perm.revoked = true;
    activePermissions.delete(permissionId);
    return true;
  }
  return false;
}

/**
 * 销毁过期权限（定期清理）
 *
 * @returns {number} 清理的权限数量
 */
function cleanup() {
  const now = Date.now();
  let cleaned = 0;
  for (const [id, perm] of activePermissions) {
    if (now > perm.expires_ts || perm.revoked) {
      activePermissions.delete(id);
      cleaned++;
    }
  }
  return cleaned;
}

/**
 * 获取当前活跃权限统计
 *
 * @returns {object}
 */
function getStats() {
  return {
    active_count: activePermissions.size,
    timestamp: new Date().toISOString(),
  };
}

/**
 * 撤销某个会话的所有权限
 *
 * @param {string} sessionId
 * @returns {number} 撤销数量
 */
function revokeBySession(sessionId) {
  let count = 0;
  for (const [id, perm] of activePermissions) {
    if (perm.granted_to === sessionId) {
      activePermissions.delete(id);
      count++;
    }
  }
  return count;
}

module.exports = {
  grant,
  validate,
  markUsed,
  revoke,
  cleanup,
  getStats,
  revokeBySession,
  generatePermissionId,
  PERMISSION_TYPES,
  DEFAULT_TTL_MS,
};
