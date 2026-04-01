/**
 * 行业模块接入协议 · Module Registry
 * 语言膜核心组件
 *
 * 行业模块 = OS上的App · 每个行业一个模块
 * 模块接入操作系统需要满足操作系统的规则。
 *
 * App Store 模型:
 *   肥猫网文行业 = 第一个模块 + 唯一入口
 *   其他行业通过 App Store 接入
 *
 * 模块生命周期:
 *   注册 → 审核 → 激活 → 运行 → 休眠/注销
 *
 * 编号: SY-MEMBRANE-MODULE-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// 模块注册表存储路径
const REGISTRY_PATH = process.env.ZY_MODULE_REGISTRY
  || path.join(process.env.ZY_ROOT || process.cwd(), 'data', 'module-registry.json');

/**
 * 模块状态
 */
const MODULE_STATUS = {
  PENDING: 'pending',     // 待审核
  ACTIVE: 'active',       // 已激活
  SUSPENDED: 'suspended', // 已暂停
  REVOKED: 'revoked',     // 已注销
};

/**
 * 加载模块注册表
 *
 * @returns {object}
 */
function loadRegistry() {
  if (!fs.existsSync(REGISTRY_PATH)) {
    return { modules: [], updated_at: new Date().toISOString() };
  }

  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch (err) {
    process.stderr.write(`[MODULE-REGISTRY] parse error: ${err.message}\n`);
    return { modules: [], updated_at: new Date().toISOString() };
  }
}

/**
 * 保存模块注册表
 *
 * @param {object} registry
 */
function saveRegistry(registry) {
  const dir = path.dirname(REGISTRY_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  registry.updated_at = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2), 'utf8');
}

/**
 * 生成模块ID
 * 格式: MOD-INDUSTRY-XXXX
 *
 * @param {string} industry — 行业标识
 * @returns {string}
 */
function generateModuleId(industry) {
  const rand = crypto.randomBytes(2).toString('hex').toUpperCase();
  const tag = (industry || 'GEN').toUpperCase().slice(0, 8);
  return `MOD-${tag}-${rand}`;
}

/**
 * 注册新行业模块
 *
 * @param {object} params
 * @param {string} params.name          — 模块名称
 * @param {string} params.industry      — 行业标识
 * @param {string} params.description   — 模块描述
 * @param {string} params.owner         — 模块负责人/团队
 * @param {string} [params.contact]     — 联系方式
 * @returns {object} 注册结果
 */
function registerModule(params) {
  const registry = loadRegistry();

  // 检查是否已存在同名模块
  const existing = registry.modules.find(
    m => m.name === params.name && m.status !== MODULE_STATUS.REVOKED
  );
  if (existing) {
    return {
      success: false,
      reason: 'module-already-exists',
      module_id: existing.module_id,
    };
  }

  const moduleEntry = {
    module_id: generateModuleId(params.industry),
    name: params.name,
    industry: params.industry,
    description: params.description || '',
    owner: params.owner,
    contact: params.contact || '',
    status: MODULE_STATUS.PENDING,
    registered_at: new Date().toISOString(),
    activated_at: null,
    persona_assigned: null,
  };

  registry.modules.push(moduleEntry);
  saveRegistry(registry);

  return {
    success: true,
    module_id: moduleEntry.module_id,
    status: moduleEntry.status,
  };
}

/**
 * 激活模块（需要主权授权）
 *
 * @param {string} moduleId
 * @param {string} [personaId] — 分配的人格体
 * @returns {object}
 */
function activateModule(moduleId, personaId) {
  const registry = loadRegistry();
  const mod = registry.modules.find(m => m.module_id === moduleId);

  if (!mod) {
    return { success: false, reason: 'module-not-found' };
  }

  mod.status = MODULE_STATUS.ACTIVE;
  mod.activated_at = new Date().toISOString();
  if (personaId) {
    mod.persona_assigned = personaId;
  }

  saveRegistry(registry);
  return { success: true, module_id: moduleId, status: MODULE_STATUS.ACTIVE };
}

/**
 * 查询模块信息
 *
 * @param {string} moduleId
 * @returns {object|null}
 */
function getModule(moduleId) {
  const registry = loadRegistry();
  return registry.modules.find(m => m.module_id === moduleId) || null;
}

/**
 * 列出所有活跃模块
 *
 * @returns {Array}
 */
function listActiveModules() {
  const registry = loadRegistry();
  return registry.modules.filter(m => m.status === MODULE_STATUS.ACTIVE);
}

/**
 * 列出所有模块
 *
 * @returns {Array}
 */
function listAllModules() {
  const registry = loadRegistry();
  return registry.modules;
}

/**
 * 暂停模块
 *
 * @param {string} moduleId
 * @returns {object}
 */
function suspendModule(moduleId) {
  const registry = loadRegistry();
  const mod = registry.modules.find(m => m.module_id === moduleId);

  if (!mod) {
    return { success: false, reason: 'module-not-found' };
  }

  mod.status = MODULE_STATUS.SUSPENDED;
  saveRegistry(registry);
  return { success: true, module_id: moduleId, status: MODULE_STATUS.SUSPENDED };
}

module.exports = {
  registerModule,
  activateModule,
  getModule,
  listActiveModules,
  listAllModules,
  suspendModule,
  generateModuleId,
  MODULE_STATUS,
};
