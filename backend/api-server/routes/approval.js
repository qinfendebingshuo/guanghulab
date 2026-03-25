/**
 * 部署授权流程路由 · Phase 8 + S5 直通 + S6 频道自治
 *
 * 部署流分三条路径：
 * A) 冰朔直通(S5)：TCS-0002 或 ZY- 指令签发 → 直接部署，跳过一切审批
 * B) 频道自治(S6)：开发者自己频道内的变更 → 自己确认即部署，无天眼/授权人
 * C) 完整审批(S2)：跨频/系统级变更 → 天眼审核 → 授权人确认 → 自动发布
 *
 * POST /api/approval/request          — 创建授权请求（天眼/系统内部调用）
 * POST /api/approval/:id/decide       — 授权人确认/拒绝
 * GET  /api/approval/:id              — 查询单个授权状态
 * GET  /api/approval/pending          — 查询待处理的授权列表
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');
var authMiddleware = require('../middleware/auth');
var auditMiddleware = require('../middleware/audit');
var approversConfig = require('../config/approvers.json');

// ====== 内存中的授权记录（生产环境可迁移到持久化存储）======
var approvalStore = new Map();

// ====== S5 直通部署判断 ======

var autonomyEngine = require('../services/autonomy-engine');

/**
 * 判断部署请求是否来自冰朔直通路径（委托给 autonomy-engine 单一来源）
 */
function isDirectDeploySource(user, body) {
  var instructionId = body.instructionId || body.deployId || '';
  var signedBy = body.signedBy || '';
  return autonomyEngine.isDirectDeploySource(user.devId, instructionId, signedBy);
}

/**
 * 写入部署日志（直通和审批部署共用，保持可追溯性）
 */
function writeDeployLog(entry) {
  var logDir = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../../logs/audit');
  try {
    fs.mkdirSync(logDir, { recursive: true });
    var today = new Date().toISOString().split('T')[0];
    var logFile = path.join(logDir, 'deploy-' + today + '.jsonl');
    fs.appendFile(logFile, JSON.stringify(entry) + '\n', function(err) {
      if (err) console.error('部署日志写入失败:', err.message);
    });
  } catch (e) {
    console.error('部署日志写入失败:', e.message);
  }
}

// ====== 辅助函数 ======

/**
 * 根据频道获取授权人列表
 */
function getApprovers(channel) {
  var rule = approversConfig.rules[channel] || approversConfig.rules[approversConfig.defaults.channel];
  return rule ? rule.approvers : approversConfig.rules['系统'].approvers;
}

/**
 * 写入审计日志（授权专用）
 */
function writeApprovalAudit(entry) {
  var logDir = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../../logs/audit');
  try {
    fs.mkdirSync(logDir, { recursive: true });
    var today = new Date().toISOString().split('T')[0];
    var logFile = path.join(logDir, 'approval-' + today + '.jsonl');
    fs.appendFile(logFile, JSON.stringify(entry) + '\n', function(err) {
      if (err) console.error('授权审计日志写入失败:', err.message);
    });
  } catch (e) {
    console.error('授权审计日志写入失败:', e.message);
  }
}

// ====== 路由 ======

// 所有授权路由需要认证
router.use(authMiddleware.requireAuth);
router.use(auditMiddleware.auditLog);

/**
 * 创建授权请求（天眼审核通过后由系统调用）
 * S5: 冰朔直通路径 → 跳过审批，直接部署到正式站
 */
router.post('/request', function(req, res) {
  // 仅系统内部或管理员可创建授权请求
  if (req.user.permissionLevel < 3 && req.user.devId !== 'SYSTEM') {
    return res.status(403).json({
      error: true,
      code: 'PERMISSION_DENIED',
      reply: '🔒 仅系统内部或管理员可创建授权请求。'
    });
  }

  var body = req.body || {};
  var deployId = body.deployId;
  var module = body.module;
  var channel = body.channel || '系统';
  var reviewReport = body.reviewReport || {};

  if (!deployId || !module) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_FIELDS',
      reply: '❌ 缺少必要字段：deployId, module'
    });
  }

  // ====== S5 直通判断 ======
  if (isDirectDeploySource(req.user, body)) {
    // 冰朔/霜砚指令 → 直接部署，不走审批流程
    writeDeployLog({
      action: 'direct_deploy',
      deployId: deployId,
      module: module,
      channel: channel,
      source: req.user.devId,
      signedBy: body.signedBy || req.user.devId,
      instructionId: body.instructionId || deployId,
      reason: 'S5 冰朔直通部署规则：冰朔签发或口头下达的指令直接部署到正式站',
      timestamp: new Date().toISOString()
    });

    // 直接触发正式站部署
    var githubService;
    try {
      githubService = require('../services/github');
    } catch (_) {
      githubService = null;
    }

    if (githubService && githubService.triggerWorkflow) {
      githubService.triggerWorkflow('deploy-to-server.yml', {
        module: module,
        deploy_id: deployId,
        approved_by: req.user.devId,
        target: 'production',
        direct_deploy: 'true'
      }).then(function() {
        writeDeployLog({
          action: 'direct_deploy_triggered',
          deployId: deployId,
          module: module,
          source: req.user.devId,
          timestamp: new Date().toISOString()
        });
      }).catch(function(err) {
        console.error('直通部署触发失败:', err.message);
        writeDeployLog({
          action: 'direct_deploy_failed',
          deployId: deployId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });
    }

    return res.json({
      success: true,
      directDeploy: true,
      deployId: deployId,
      reply: '🚀 冰朔直通部署：' + module + ' 已直接触发正式站（guanghulab.com）部署。' +
             '不经预览站、不经天眼审核、不经授权审批。部署日志已记录。'
    });
  }

  // ====== S6 个人频道自治判断 ======
  // 开发者在自己频道内 → 自己确认即部署，不走天眼/授权人
  var channelCheck = autonomyEngine.isChannelSelfDeploy(req.user.devId, module, channel);
  if (channelCheck.selfChannel) {
    writeDeployLog({
      action: 'channel_self_deploy',
      deployId: deployId,
      module: module,
      channel: channel,
      devId: req.user.devId,
      reason: 'S6 个人频道自治：' + channelCheck.reason,
      timestamp: new Date().toISOString()
    });

    // 直接触发正式站部署（开发者自己频道区域）
    var ghService;
    try {
      ghService = require('../services/github');
    } catch (_) {
      ghService = null;
    }

    if (ghService && ghService.triggerWorkflow) {
      ghService.triggerWorkflow('deploy-to-server.yml', {
        module: module,
        deploy_id: deployId,
        approved_by: req.user.devId,
        target: 'production',
        channel_self_deploy: 'true'
      }).then(function() {
        writeDeployLog({
          action: 'channel_self_deploy_triggered',
          deployId: deployId,
          module: module,
          devId: req.user.devId,
          timestamp: new Date().toISOString()
        });
      }).catch(function(err) {
        console.error('频道自治部署触发失败:', err.message);
        writeDeployLog({
          action: 'channel_self_deploy_failed',
          deployId: deployId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });
    }

    return res.json({
      success: true,
      channelSelfDeploy: true,
      deployId: deployId,
      reply: '🏠 个人频道自治部署：' + module + ' 已触发正式站（guanghulab.com）部署。\n' +
             '你是自己频道的主控，无需天眼审核或第三方授权。\n' +
             '自己确认，自己负责。部署日志已记录。'
    });
  }

  // ====== 开发者流程：走完整 S2 审批 ======

  if (!deployId || !module) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_FIELDS',
      reply: '❌ 缺少必要字段：deployId, module'
    });
  }

  var approvers = getApprovers(channel);
  var approvalId = 'APPROVAL-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  var approval = {
    id: approvalId,
    deployId: deployId,
    module: module,
    channel: channel,
    reviewReport: reviewReport,
    approvers: approvers.map(function(a) { return a.devId; }),
    approverDetails: approvers,
    decisions: {},
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  approvalStore.set(approvalId, approval);

  writeApprovalAudit({
    action: 'approval_created',
    approvalId: approvalId,
    deployId: deployId,
    module: module,
    channel: channel,
    approvers: approvers.map(function(a) { return a.devId; }),
    createdBy: req.user.devId,
    timestamp: new Date().toISOString()
  });

  res.json({
    success: true,
    approvalId: approvalId,
    approvers: approvers,
    reply: '📋 授权请求已创建（' + approvalId + '）。已推送给授权人：' +
           approvers.map(function(a) { return a.name + '(' + a.devId + ')'; }).join('、') + '。'
  });
});

/**
 * 授权人确认/拒绝
 */
router.post('/:approvalId/decide', function(req, res) {
  var approvalId = req.params.approvalId;
  var decision = (req.body || {}).decision; // 'approved' | 'rejected'
  var reason = (req.body || {}).reason || '';
  var devId = req.user.devId;

  var approval = approvalStore.get(approvalId);
  if (!approval) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      reply: '❌ 授权请求 ' + approvalId + ' 不存在。'
    });
  }

  if (approval.status !== 'pending') {
    return res.status(400).json({
      error: true,
      code: 'ALREADY_DECIDED',
      reply: '❌ 该授权请求已处理完毕（状态：' + approval.status + '）。'
    });
  }

  // 验证是否为授权人
  if (!approval.approvers.includes(devId)) {
    return res.status(403).json({
      error: true,
      code: 'NOT_APPROVER',
      reply: '🔒 你不是这个部署的授权人。授权人：' +
             approval.approverDetails.map(function(a) { return a.name; }).join('、')
    });
  }

  if (decision !== 'approved' && decision !== 'rejected') {
    return res.status(400).json({
      error: true,
      code: 'INVALID_DECISION',
      reply: '❌ decision 必须是 "approved" 或 "rejected"。'
    });
  }

  // 记录决定
  approval.decisions[devId] = {
    decision: decision,
    reason: reason,
    timestamp: new Date().toISOString()
  };
  approval.updatedAt = new Date().toISOString();

  // 写入审计日志（不可逆）
  writeApprovalAudit({
    action: 'approval_decision',
    approvalId: approvalId,
    devId: devId,
    decision: decision,
    reason: reason,
    module: approval.module,
    channel: approval.channel,
    timestamp: new Date().toISOString()
  });

  if (decision === 'rejected') {
    approval.status = 'rejected';
    return res.json({
      success: true,
      reply: '❌ 已拒绝。部署不会执行。原因已记录到审计日志。'
    });
  }

  // 检查是否所有授权人都已通过
  var allApproved = approval.approvers.every(function(id) {
    return approval.decisions[id] && approval.decisions[id].decision === 'approved';
  });

  if (allApproved) {
    approval.status = 'approved';

    // 触发正式站部署
    var githubService;
    try {
      githubService = require('../services/github');
    } catch (_) {
      githubService = null;
    }

    if (githubService && githubService.triggerWorkflow) {
      githubService.triggerWorkflow('deploy-to-server.yml', {
        module: approval.module,
        deploy_id: approval.deployId,
        approved_by: approval.approvers.join(','),
        target: 'production'
      }).then(function() {
        writeApprovalAudit({
          action: 'deploy_triggered',
          approvalId: approvalId,
          module: approval.module,
          approvedBy: approval.approvers,
          timestamp: new Date().toISOString()
        });
      }).catch(function(err) {
        console.error('部署触发失败:', err.message);
        writeApprovalAudit({
          action: 'deploy_trigger_failed',
          approvalId: approvalId,
          error: err.message,
          timestamp: new Date().toISOString()
        });
      });
    }

    return res.json({
      success: true,
      reply: '✅ 所有授权人已通过。铸渊已自动触发正式站（guanghulab.com）部署。'
    });
  }

  // 还有授权人未决定
  var pending = approval.approvers.filter(function(id) { return !approval.decisions[id]; });
  res.json({
    success: true,
    reply: '✅ 你已授权通过。等待其他授权人确认：' + pending.join('、')
  });
});

/**
 * 查询单个授权状态
 */
router.get('/:approvalId', function(req, res) {
  var approval = approvalStore.get(req.params.approvalId);
  if (!approval) {
    return res.status(404).json({
      error: true,
      code: 'NOT_FOUND',
      reply: '❌ 授权请求不存在。'
    });
  }

  res.json({
    success: true,
    approval: {
      id: approval.id,
      deployId: approval.deployId,
      module: approval.module,
      channel: approval.channel,
      status: approval.status,
      approvers: approval.approverDetails,
      decisions: approval.decisions,
      createdAt: approval.createdAt,
      updatedAt: approval.updatedAt
    }
  });
});

/**
 * 查询待处理的授权列表（授权人查自己待处理的）
 */
router.get('/', function(req, res) {
  var devId = req.user.devId;
  var pending = [];

  for (var entry of approvalStore) {
    var approval = entry[1];
    if (approval.status === 'pending' && approval.approvers.includes(devId) && !approval.decisions[devId]) {
      pending.push({
        id: approval.id,
        module: approval.module,
        channel: approval.channel,
        createdAt: approval.createdAt
      });
    }
  }

  res.json({
    success: true,
    pending: pending,
    count: pending.length,
    reply: pending.length > 0
      ? '📋 你有 ' + pending.length + ' 个待授权请求。'
      : '✅ 没有待处理的授权请求。'
  });
});

module.exports = router;
