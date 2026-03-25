/**
 * 系统自治运行引擎 · Phase 9
 *
 * 系统自主监控运行状态，自动优化，异常时主动报告。
 * 遵循自治规则：不违反铁律、不绕过天眼审核、不绕过人类授权。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var fs = require('fs');
var path = require('path');
var autonomyRules = require('../config/autonomy-rules.json');

var AUTONOMY_LOG_DIR = process.env.AUTONOMY_LOG_DIR ||
  path.join(__dirname, '../../logs/autonomy');

/**
 * 写入自治日志（所有自主操作记录到审计日志）
 */
function writeAutonomyLog(entry) {
  try {
    fs.mkdirSync(AUTONOMY_LOG_DIR, { recursive: true });
    var today = new Date().toISOString().split('T')[0];
    var logFile = path.join(AUTONOMY_LOG_DIR, 'autonomy-' + today + '.jsonl');
    fs.appendFile(logFile, JSON.stringify(entry) + '\n', function(err) {
      if (err) console.error('自治日志写入失败:', err.message);
    });
  } catch (e) {
    console.error('自治日志写入失败:', e.message);
  }
}

/**
 * 检查自治操作是否合规
 * @param {string} action - 操作描述
 * @returns {Object} { allowed: boolean, reason: string }
 */
function checkAutonomyCompliance(action) {
  var forbidden = autonomyRules.autonomyRules.systemMustNot;
  var actionLower = action.toLowerCase();

  // 检查是否触及禁止项
  if (actionLower.includes('权限') && actionLower.includes('修改')) {
    return { allowed: false, reason: '权限变更只有冰朔能触发' };
  }
  if (actionLower.includes('绕过') && actionLower.includes('天眼')) {
    return { allowed: false, reason: '不得绕过天眼审核' };
  }
  if (actionLower.includes('绕过') && actionLower.includes('授权')) {
    return { allowed: false, reason: '不得绕过人类授权步骤' };
  }

  return { allowed: true, reason: 'ok' };
}

/**
 * 检测冰朔交互模式
 * @param {string} message - 用户消息
 * @returns {string} 'instruction' | 'natural'
 */
function detectInteractionMode(message) {
  var instructionTriggers = autonomyRules.dualLineArchitecture.lineA.interactionModes.instructionMode.trigger;
  var msgLower = message.toLowerCase();

  for (var i = 0; i < instructionTriggers.length; i++) {
    if (msgLower.includes(instructionTriggers[i].toLowerCase())) {
      return 'instruction';
    }
  }
  return 'natural';
}

/**
 * 记录自主优化操作
 * @param {string} action - 操作描述
 * @param {Object} details - 操作详情
 */
function logAutonomousAction(action, details) {
  var compliance = checkAutonomyCompliance(action);
  if (!compliance.allowed) {
    console.error('[AUTONOMY] 自治操作被阻止: ' + action + ' — ' + compliance.reason);
    writeAutonomyLog({
      type: 'blocked',
      action: action,
      reason: compliance.reason,
      timestamp: new Date().toISOString()
    });
    return false;
  }

  writeAutonomyLog({
    type: 'autonomous_action',
    action: action,
    details: details || {},
    timestamp: new Date().toISOString()
  });
  return true;
}

/**
 * 获取部署流水线阶段定义
 */
function getDeploymentStages() {
  return autonomyRules.deploymentFlow.stages;
}

/**
 * 获取双线架构配置
 */
function getDualLineConfig() {
  return autonomyRules.dualLineArchitecture;
}

/**
 * 判断请求是否来自冰朔直通部署路径 (S5)
 * @param {string} devId - 开发者编号
 * @param {string} instructionId - 指令编号
 * @param {string} signedBy - 签发者编号
 * @returns {boolean}
 */
function isDirectDeploySource(devId, instructionId, signedBy) {
  // 冰朔本人
  if (devId === 'TCS-0002') return true;

  // ZY- 指令 + 可信签发者
  if (instructionId && /^ZY-/.test(instructionId)) {
    var trustedSigners = ['AG-SY-01', 'TCS-0002', 'ICE-0002'];
    if (signedBy && trustedSigners.indexOf(signedBy) !== -1) return true;
  }

  return false;
}

/**
 * 判断部署是否为开发者自己频道内的变更 (S6)
 *
 * S6 规则：
 * - 开发者在自己频道内拥有完全自主权
 * - 频道内变更由自己审核，不需要天眼/授权人
 * - 开发者自己确认 → 直接部署到正式站（自己频道区域）
 *
 * 天眼只管：跨频操作、系统级变更、频道生命周期、公共区域
 *
 * @param {string} devId - 开发者编号
 * @param {string} module - 部署模块路径
 * @param {string} channel - 频道类型
 * @returns {{ selfChannel: boolean, reason: string }}
 */
function isChannelSelfDeploy(devId, module, channel) {
  // 系统级/跨频频道 → 不是自治范围，走天眼审批
  if (channel === '系统' || channel === '跨频') {
    return { selfChannel: false, reason: '系统级或跨频变更需天眼审核' };
  }

  // 获取开发者拥有的模块
  var permissions = require('../config/permissions');
  var devModules = permissions.DEV_MODULES[devId] || [];

  // 没有模块映射 → 不是自治范围
  if (devModules.length === 0) {
    return { selfChannel: false, reason: '开发者无模块映射' };
  }

  // 通配符 → 管理员走 S5 直通，不走 S6 频道自治
  // 原因：管理员有全局权限，应使用 S5 的冰朔直通规则而非 S6 的频道自治
  if (devModules.indexOf('*') !== -1) {
    return { selfChannel: false, reason: '管理员走 S5 直通' };
  }

  // 检查模块是否在开发者自己的频道内
  var modulePath = module.replace(/\/+$/, '') + '/';
  for (var i = 0; i < devModules.length; i++) {
    var owned = devModules[i].replace(/\/+$/, '') + '/';
    if (modulePath.indexOf(owned) === 0 || owned.indexOf(modulePath) === 0 || module === devModules[i].replace(/\/+$/, '')) {
      return { selfChannel: true, reason: '模块 ' + module + ' 属于 ' + devId + ' 的个人频道' };
    }
  }

  return { selfChannel: false, reason: '模块 ' + module + ' 不在 ' + devId + ' 的频道内' };
}

module.exports = {
  checkAutonomyCompliance: checkAutonomyCompliance,
  detectInteractionMode: detectInteractionMode,
  logAutonomousAction: logAutonomousAction,
  getDeploymentStages: getDeploymentStages,
  getDualLineConfig: getDualLineConfig,
  writeAutonomyLog: writeAutonomyLog,
  isDirectDeploySource: isDirectDeploySource,
  isChannelSelfDeploy: isChannelSelfDeploy
};
