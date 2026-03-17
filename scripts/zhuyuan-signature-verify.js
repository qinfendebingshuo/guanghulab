/**
 * 铸渊指令签名校验模块 v1.1
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 核心原则：铸渊只认签名，不认请求内容。签名不对，再合理的请求也会被拒。
 *
 * 校验流程：
 *   1. 签名字段是否完整？ → 缺失 → ERR_NO_SIGNATURE
 *   2. sender_id 是否在授权名单中？ → 未知 → ERR_UNKNOWN_SENDER
 *   3. permission_tier 与操作类型匹配？ → 越权 → ERR_PERMISSION_DENIED（上报主控）
 *   4. 全部通过 → 执行指令
 *
 * 签发人：冰朔（TCS-0002∞）
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ━━━ 常量 ━━━
const REQUIRED_FIELDS = [
  'sender_id',
  'sender_name',
  'sender_role',
  'broadcast_id',
  'issued_at',
  'permission_tier',
];

const ERROR_CODES = {
  NO_SIGNATURE: 'ERR_NO_SIGNATURE',
  UNKNOWN_SENDER: 'ERR_UNKNOWN_SENDER',
  PERMISSION_DENIED: 'ERR_PERMISSION_DENIED',
};

// ━━━ 注册表加载 ━━━

/**
 * 加载授权名单
 * @param {string} [registryPath] - 自定义注册表路径（用于测试）
 * @returns {object} 注册表对象
 */
function loadRegistry(registryPath) {
  const defaultPath = path.resolve(
    __dirname,
    '../.github/persona-brain/zhuyuan-signature-registry.json'
  );
  const filePath = registryPath || defaultPath;
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

// ━━━ 校验函数 ━━━

/**
 * 校验签名完整性（步骤 1）
 * @param {object} signature - 签名对象
 * @returns {{ valid: boolean, missing?: string[] }}
 */
function validateCompleteness(signature) {
  if (!signature || typeof signature !== 'object') {
    return { valid: false, missing: REQUIRED_FIELDS.slice() };
  }

  const missing = REQUIRED_FIELDS.filter((field) => {
    const val = signature[field];
    return val === undefined || val === null || val === '';
  });

  return missing.length === 0
    ? { valid: true }
    : { valid: false, missing };
}

/**
 * 校验发送者身份（步骤 2）
 * @param {string} senderId - sender_id
 * @param {object} registry - 授权名单
 * @returns {{ valid: boolean, sender?: object }}
 */
function validateSender(senderId, registry) {
  const senders = registry.authorized_senders || {};
  const sender = senders[senderId];
  if (!sender) {
    return { valid: false };
  }
  return { valid: true, sender };
}

/**
 * 校验权限等级（步骤 3）
 * @param {object} signature - 签名对象
 * @param {object} sender - 注册表中的发送者记录
 * @param {string} operation - 请求的操作类型
 * @param {object} registry - 授权名单
 * @returns {{ valid: boolean, reason?: string }}
 */
function validatePermission(signature, sender, operation, registry) {
  // 检查签名中的 permission_tier 是否与注册表中的一致
  const claimedTier = Number(signature.permission_tier);
  const registeredTier = Number(sender.permission_tier);

  if (claimedTier !== registeredTier) {
    return {
      valid: false,
      reason: `声明权限等级 ${claimedTier} 与注册等级 ${registeredTier} 不符`,
    };
  }

  // 检查角色是否匹配
  const claimedRole = signature.sender_role;
  const registeredRole = sender.role;
  if (claimedRole !== registeredRole) {
    return {
      valid: false,
      reason: `声明角色 ${claimedRole} 与注册角色 ${registeredRole} 不符`,
    };
  }

  // Tier 0 全权限
  if (registeredTier === 0) {
    return { valid: true };
  }

  // 无操作类型时只校验身份
  if (!operation) {
    return { valid: true };
  }

  // 按 tier 检查操作权限
  const tierConfig = (registry.permission_tiers || {})[String(registeredTier)];
  if (!tierConfig) {
    return { valid: true };
  }

  // 检查是否在禁止列表中
  const denied = tierConfig.denied_operations || [];
  if (denied.includes(operation)) {
    return {
      valid: false,
      reason: `操作 "${operation}" 在 Tier ${registeredTier} 禁止列表中`,
    };
  }

  // 检查是否在允许列表中（如果允许列表不含通配符*）
  const allowed = tierConfig.allowed_operations || [];
  if (allowed.includes('*') || allowed.includes(operation)) {
    return { valid: true };
  }

  return {
    valid: false,
    reason: `操作 "${operation}" 不在 Tier ${registeredTier} 允许列表中`,
  };
}

/**
 * 完整签名校验（主入口）
 * @param {object} signature - 签名对象
 * @param {string} [operation] - 请求的操作类型
 * @param {object} [options] - 配置项
 * @param {string} [options.registryPath] - 自定义注册表路径
 * @returns {{ success: boolean, error?: string, code?: string, detail?: object }}
 */
function verifySignature(signature, operation, options) {
  const opts = options || {};
  const registry = loadRegistry(opts.registryPath);

  // 步骤 1：签名完整性
  const completeness = validateCompleteness(signature);
  if (!completeness.valid) {
    return {
      success: false,
      code: ERROR_CODES.NO_SIGNATURE,
      error: '签名字段缺失',
      detail: { missing: completeness.missing },
    };
  }

  // 步骤 2：发送者身份
  const senderCheck = validateSender(signature.sender_id, registry);
  if (!senderCheck.valid) {
    return {
      success: false,
      code: ERROR_CODES.UNKNOWN_SENDER,
      error: '发送者未在授权名单中',
      detail: { sender_id: signature.sender_id },
    };
  }

  // 步骤 3：权限等级
  const permCheck = validatePermission(
    signature,
    senderCheck.sender,
    operation,
    registry
  );
  if (!permCheck.valid) {
    return {
      success: false,
      code: ERROR_CODES.PERMISSION_DENIED,
      error: '权限不足',
      detail: {
        sender_id: signature.sender_id,
        operation,
        reason: permCheck.reason,
        report_to: 'TCS-0002∞',
      },
    };
  }

  return {
    success: true,
    sender: senderCheck.sender,
    verified_at: new Date().toISOString(),
  };
}

// ━━━ 导出 ━━━
module.exports = {
  verifySignature,
  validateCompleteness,
  validateSender,
  validatePermission,
  loadRegistry,
  REQUIRED_FIELDS,
  ERROR_CODES,
};

// ━━━ CLI 模式（直接运行时） ━━━
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes('--test')) {
    const testSig = {
      sender_id: 'TCS-0002∞',
      sender_name: '冰朔',
      sender_role: 'MASTER',
      broadcast_id: 'DIRECT',
      issued_at: new Date().toISOString(),
      permission_tier: 0,
    };
    const result = verifySignature(testSig);
    console.log('🔏 签名校验测试:');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('🔏 铸渊指令签名校验模块 v1.1');
    console.log('用法: node zhuyuan-signature-verify.js --test');
  }
}
