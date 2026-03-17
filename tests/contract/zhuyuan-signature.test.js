/**
 * 铸渊指令签名校验 · 契约测试
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * 验证签名校验模块的三步校验流程：
 *   1. 签名完整性 → ERR_NO_SIGNATURE
 *   2. 发送者身份 → ERR_UNKNOWN_SENDER
 *   3. 权限等级   → ERR_PERMISSION_DENIED
 */

'use strict';

const path = require('path');

const {
  verifySignature,
  validateCompleteness,
  validateSender,
  validatePermission,
  loadRegistry,
  REQUIRED_FIELDS,
  ERROR_CODES,
} = require('../../scripts/zhuyuan-signature-verify');

const REGISTRY_PATH = path.resolve(
  __dirname,
  '../../.github/persona-brain/zhuyuan-signature-registry.json'
);

// ━━━ 辅助函数 ━━━

function makeMasterSignature(overrides) {
  return Object.assign(
    {
      sender_id: 'TCS-0002∞',
      sender_name: '冰朔',
      sender_role: 'MASTER',
      broadcast_id: 'DIRECT',
      issued_at: '2026-03-17T09:53:00+08:00',
      permission_tier: 0,
    },
    overrides
  );
}

function makeDevSignature(devId, overrides) {
  const registry = loadRegistry(REGISTRY_PATH);
  const sender = registry.authorized_senders[devId];
  return Object.assign(
    {
      sender_id: devId,
      sender_name: sender ? sender.name : 'unknown',
      sender_role: sender ? sender.role : 'DEV',
      broadcast_id: 'DIRECT',
      issued_at: '2026-03-17T10:00:00+08:00',
      permission_tier: sender ? sender.permission_tier : 2,
    },
    overrides
  );
}

// ━━━ 测试 ━━━

describe('铸渊指令签名校验', () => {
  let registry;

  beforeAll(() => {
    registry = loadRegistry(REGISTRY_PATH);
  });

  // === 注册表加载 ===
  describe('注册表加载', () => {
    test('成功加载授权名单', () => {
      expect(registry).toBeDefined();
      expect(registry.authorized_senders).toBeDefined();
      expect(registry.permission_tiers).toBeDefined();
    });

    test('包含主控 TCS-0002∞', () => {
      const master = registry.authorized_senders['TCS-0002∞'];
      expect(master).toBeDefined();
      expect(master.role).toBe('MASTER');
      expect(master.permission_tier).toBe(0);
    });

    test('包含系统账号 SYSTEM-RT02', () => {
      const sys = registry.authorized_senders['SYSTEM-RT02'];
      expect(sys).toBeDefined();
      expect(sys.role).toBe('SYSTEM');
      expect(sys.permission_tier).toBe(3);
    });
  });

  // === 步骤 1：签名完整性校验 ===
  describe('步骤 1：签名完整性 (ERR_NO_SIGNATURE)', () => {
    test('null 签名 → 缺失所有字段', () => {
      const result = validateCompleteness(null);
      expect(result.valid).toBe(false);
      expect(result.missing).toEqual(REQUIRED_FIELDS);
    });

    test('空对象 → 缺失所有字段', () => {
      const result = validateCompleteness({});
      expect(result.valid).toBe(false);
      expect(result.missing.length).toBe(REQUIRED_FIELDS.length);
    });

    test('缺少 sender_id → 报告缺失', () => {
      const sig = makeMasterSignature({ sender_id: undefined });
      const result = validateCompleteness(sig);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('sender_id');
    });

    test('缺少 permission_tier → 报告缺失', () => {
      const sig = makeMasterSignature();
      delete sig.permission_tier;
      const result = validateCompleteness(sig);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('permission_tier');
    });

    test('空字符串字段 → 视为缺失', () => {
      const sig = makeMasterSignature({ sender_name: '' });
      const result = validateCompleteness(sig);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('sender_name');
    });

    test('完整签名 → 通过', () => {
      const sig = makeMasterSignature();
      const result = validateCompleteness(sig);
      expect(result.valid).toBe(true);
    });

    test('permission_tier 为 0 → 不被当作空值', () => {
      const sig = makeMasterSignature({ permission_tier: 0 });
      const result = validateCompleteness(sig);
      expect(result.valid).toBe(true);
    });
  });

  // === 步骤 2：发送者身份校验 ===
  describe('步骤 2：发送者身份 (ERR_UNKNOWN_SENDER)', () => {
    test('未知 sender_id → 拒绝', () => {
      const result = validateSender('UNKNOWN-999', registry);
      expect(result.valid).toBe(false);
    });

    test('已知 sender_id (TCS-0002∞) → 通过', () => {
      const result = validateSender('TCS-0002∞', registry);
      expect(result.valid).toBe(true);
      expect(result.sender.name).toBe('冰朔');
    });

    test('已知 sender_id (DEV-004) → 通过', () => {
      const result = validateSender('DEV-004', registry);
      expect(result.valid).toBe(true);
      expect(result.sender.name).toBe('之之');
    });

    test('已知 sender_id (SYSTEM-RT02) → 通过', () => {
      const result = validateSender('SYSTEM-RT02', registry);
      expect(result.valid).toBe(true);
    });
  });

  // === 步骤 3：权限等级校验 ===
  describe('步骤 3：权限等级 (ERR_PERMISSION_DENIED)', () => {
    test('Tier 0 (MASTER) → 任意操作通过', () => {
      const sig = makeMasterSignature();
      const sender = registry.authorized_senders['TCS-0002∞'];
      const result = validatePermission(sig, sender, 'modify_branch_protection', registry);
      expect(result.valid).toBe(true);
    });

    test('声明的 tier 与注册 tier 不符 → 拒绝', () => {
      const sig = makeDevSignature('DEV-001', { permission_tier: 0 });
      const sender = registry.authorized_senders['DEV-001'];
      const result = validatePermission(sig, sender, 'push_own_branch', registry);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/不符/);
    });

    test('声明的角色与注册角色不符 → 拒绝', () => {
      const sig = makeDevSignature('DEV-001', { sender_role: 'MASTER' });
      const sender = registry.authorized_senders['DEV-001'];
      const result = validatePermission(sig, sender, 'push_own_branch', registry);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/不符/);
    });

    test('Tier 2 (DEV) push 自己分支 → 通过', () => {
      const sig = makeDevSignature('DEV-001');
      const sender = registry.authorized_senders['DEV-001'];
      const result = validatePermission(sig, sender, 'push_own_branch', registry);
      expect(result.valid).toBe(true);
    });

    test('Tier 2 (DEV) 直接给铸渊下指令 → 拒绝', () => {
      const sig = makeDevSignature('DEV-001');
      const sender = registry.authorized_senders['DEV-001'];
      const result = validatePermission(sig, sender, 'direct_command_zhuyuan', registry);
      expect(result.valid).toBe(false);
    });

    test('Tier 1 (SUB_CTRL_PRIVATE) push 功能分支 → 通过', () => {
      const sig = makeDevSignature('DEV-004');
      const sender = registry.authorized_senders['DEV-004'];
      const result = validatePermission(sig, sender, 'push_feature_branch', registry);
      expect(result.valid).toBe(true);
    });

    test('Tier 1 (SUB_CTRL_PRIVATE) 修改分支保护 → 拒绝', () => {
      const sig = makeDevSignature('DEV-004');
      const sender = registry.authorized_senders['DEV-004'];
      const result = validatePermission(sig, sender, 'modify_branch_protection', registry);
      expect(result.valid).toBe(false);
    });

    test('Tier 3 (SYSTEM) 白名单 workflow → 通过', () => {
      const sig = {
        sender_id: 'SYSTEM-RT02',
        sender_name: 'RT-02自动调度',
        sender_role: 'SYSTEM',
        broadcast_id: 'DIRECT',
        issued_at: '2026-03-17T10:00:00+08:00',
        permission_tier: 3,
      };
      const sender = registry.authorized_senders['SYSTEM-RT02'];
      const result = validatePermission(sig, sender, 'trigger_whitelisted_workflow', registry);
      expect(result.valid).toBe(true);
    });

    test('无操作类型时只校验身份 → 通过', () => {
      const sig = makeDevSignature('DEV-001');
      const sender = registry.authorized_senders['DEV-001'];
      const result = validatePermission(sig, sender, null, registry);
      expect(result.valid).toBe(true);
    });
  });

  // === 完整流程 (verifySignature) ===
  describe('完整签名校验流程', () => {
    const opts = { registryPath: REGISTRY_PATH };

    test('空签名 → ERR_NO_SIGNATURE', () => {
      const result = verifySignature(null, null, opts);
      expect(result.success).toBe(false);
      expect(result.code).toBe('ERR_NO_SIGNATURE');
    });

    test('未知发送者 → ERR_UNKNOWN_SENDER', () => {
      const sig = makeMasterSignature({ sender_id: 'FAKE-001' });
      const result = verifySignature(sig, null, opts);
      expect(result.success).toBe(false);
      expect(result.code).toBe('ERR_UNKNOWN_SENDER');
    });

    test('越权操作 → ERR_PERMISSION_DENIED 含上报主控字段', () => {
      const sig = makeDevSignature('DEV-001');
      const result = verifySignature(sig, 'direct_command_zhuyuan', opts);
      expect(result.success).toBe(false);
      expect(result.code).toBe('ERR_PERMISSION_DENIED');
      expect(result.detail.report_to).toBe('TCS-0002∞');
    });

    test('主控签名 + 任意操作 → 成功', () => {
      const sig = makeMasterSignature();
      const result = verifySignature(sig, 'modify_branch_protection', opts);
      expect(result.success).toBe(true);
      expect(result.sender).toBeDefined();
      expect(result.verified_at).toBeDefined();
    });

    test('DEV 签名 + 允许操作 → 成功', () => {
      const sig = makeDevSignature('DEV-001');
      const result = verifySignature(sig, 'push_own_branch', opts);
      expect(result.success).toBe(true);
    });

    test('广播签名示例（冰朔签发）→ 成功', () => {
      const sig = {
        sender_id: 'TCS-0002∞',
        sender_name: '冰朔',
        sender_role: 'MASTER',
        permission_tier: 0,
        issued_at: '2026-03-17T09:53:00+08:00',
        broadcast_id: 'BC-GEN-XXX',
      };
      const result = verifySignature(sig, null, opts);
      expect(result.success).toBe(true);
    });

    test('广播签名示例（之之签发）→ 成功', () => {
      const sig = {
        sender_id: 'DEV-004',
        sender_name: '之之',
        sender_role: 'SUB_CTRL_PRIVATE',
        permission_tier: 1,
        issued_at: '2026-03-17T10:00:00+08:00',
        broadcast_id: 'BC-DINGTALK-009-ZZ',
      };
      const result = verifySignature(sig, null, opts);
      expect(result.success).toBe(true);
    });
  });
});
