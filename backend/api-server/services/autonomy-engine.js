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

module.exports = {
  checkAutonomyCompliance: checkAutonomyCompliance,
  detectInteractionMode: detectInteractionMode,
  logAutonomousAction: logAutonomousAction,
  getDeploymentStages: getDeploymentStages,
  getDualLineConfig: getDualLineConfig,
  writeAutonomyLog: writeAutonomyLog
};
