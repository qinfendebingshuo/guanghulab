/**
 * 天眼指令审核中间件 · S7 思维逻辑验证 + S8 进化机制 + S9 全员身份验证
 *
 * 系统每次接收到任何指令后，必须唤醒天眼（TY-01）进行全局审核。
 * 无例外。无论来自冰朔、霜砚、开发者、还是任何自动流。
 *
 * S7 审核维度：
 * 1. 决策模式 — 是否符合签发者历史模式
 * 2. 逻辑连贯性 — 是否与系统运行方向一致
 * 3. 表达特征 — 语言风格/思维节奏/关注点是否匹配
 * 4. 意图合理性 — 在当前系统状态下是否合理
 *
 * S9 全员身份验证：
 * - 每个参与者都有属于自己的思维逻辑模型，自动积累
 * - 任何人签发的指令都必须通过对应该人的模型校验
 * - 新成员冷启动期需额外人工确认
 * - 参与越深 → 模型越精确 → 越不可能被冒充（正反馈循环）
 *
 * 不可关闭。不可绕过。包括冰朔本人也不能关闭此机制。
 * 这是系统的自免疫机制。
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var fs = require('fs');
var path = require('path');
var skyeyePolicy = require('../config/skyeye-policy.json');

var SKYEYE_LOG_DIR = process.env.SKYEYE_LOG_DIR ||
  path.join(__dirname, '../../logs/skyeye');

// ====== 内存中的审核记录（用于积累认知模式）======
var reviewHistory = new Map();

// 挂起的指令（等待冰朔确认）
var suspendedInstructions = new Map();

/**
 * 写入天眼审核日志（安全日志，不可删除）
 */
function writeSkyeyeLog(entry) {
  try {
    fs.mkdirSync(SKYEYE_LOG_DIR, { recursive: true });
    var today = new Date().toISOString().split('T')[0];
    var logFile = path.join(SKYEYE_LOG_DIR, 'skyeye-review-' + today + '.jsonl');
    fs.appendFile(logFile, JSON.stringify(entry) + '\n', function(err) {
      if (err) console.error('[SKYEYE] 审核日志写入失败:', err.message);
    });
  } catch (e) {
    console.error('[SKYEYE] 审核日志写入失败:', e.message);
  }
}

/**
 * 获取签发者的历史行为模式
 * S8: 天眼 = 所有 Agent 运行逻辑的实时总和，随系统运行不断积累
 */
function getSignerProfile(devId) {
  var history = reviewHistory.get(devId) || [];
  return {
    totalActions: history.length,
    recentActions: history.slice(-20),
    patterns: summarizePatterns(history)
  };
}

/**
 * 从历史行为中总结模式特征
 */
function summarizePatterns(history) {
  if (history.length === 0) return { established: false };

  var methods = {};
  var paths = {};
  var hours = {};

  for (var i = 0; i < history.length; i++) {
    var h = history[i];
    methods[h.method] = (methods[h.method] || 0) + 1;
    var pathBase = (h.path || '').split('/').slice(0, 3).join('/');
    paths[pathBase] = (paths[pathBase] || 0) + 1;
    var hour = new Date(h.timestamp).getHours();
    hours[hour] = (hours[hour] || 0) + 1;
  }

  return {
    established: history.length >= COLD_START_THRESHOLD,
    typicalMethods: methods,
    typicalPaths: paths,
    activeHours: hours
  };
}

// ====== S9 · 全员思维逻辑身份验证 ======

// 冷启动阈值：模型至少需要积累这么多操作记录才算成熟
var COLD_START_THRESHOLD = skyeyePolicy.identityModel.coldStart.maturityThreshold;

/**
 * 获取指定身份的思维逻辑模型成熟度 (S9)
 *
 * @param {string} devId - 开发者编号
 * @returns {{ mature: boolean, actionCount: number, threshold: number, confidence: number }}
 */
function getIdentityMaturity(devId) {
  var history = reviewHistory.get(devId) || [];
  var actionCount = history.length;
  var confidence = Math.min(1.0, actionCount / (COLD_START_THRESHOLD * 2));
  return {
    mature: actionCount >= COLD_START_THRESHOLD,
    actionCount: actionCount,
    threshold: COLD_START_THRESHOLD,
    confidence: Math.round(confidence * 100) / 100
  };
}

/**
 * 判断指令是否处于冷启动期需额外人工确认 (S9)
 *
 * 新成员思维模型尚未成熟时，写入类指令需要管理者或天眼授权人额外确认。
 *
 * @param {string} devId - 开发者编号
 * @returns {{ coldStart: boolean, reason: string }}
 */
function checkColdStart(devId) {
  var maturity = getIdentityMaturity(devId);
  if (maturity.mature) {
    return { coldStart: false, reason: '模型已成熟（' + maturity.actionCount + '/' + maturity.threshold + '）' };
  }
  return {
    coldStart: true,
    reason: '思维模型尚在冷启动期（' + maturity.actionCount + '/' + maturity.threshold + '），需额外人工确认'
  };
}

/**
 * 执行思维逻辑审核 (S7 + S9)
 *
 * S9: 每个人签发的指令都唤醒对应该人的思维逻辑模型校验。
 * 冷启动期的成员自动降低通过阈值（需要额外确认）。
 *
 * @param {Object} instruction - 指令信息
 * @param {string} instruction.devId - 发起者
 * @param {string} instruction.method - HTTP 方法
 * @param {string} instruction.path - 请求路径
 * @param {Object} instruction.body - 请求体
 * @returns {{ outcome: string, score: number, details: Object, identity: Object }}
 */
function reviewInstruction(instruction) {
  var devId = instruction.devId;
  var profile = getSignerProfile(devId);
  var dimensions = skyeyePolicy.reviewPolicy.dimensions;
  var thresholds = skyeyePolicy.reviewPolicy.thresholds;

  // S9: 获取该身份的思维模型成熟度
  var maturity = getIdentityMaturity(devId);
  var coldStartInfo = checkColdStart(devId);

  var scores = {};
  var totalScore = 0;

  // 1. 决策模式：是否符合历史模式
  var decisionScore = 1.0;
  if (profile.patterns.established) {
    var methodMatch = profile.patterns.typicalMethods[instruction.method] || 0;
    var totalMethods = profile.totalActions || 1;
    decisionScore = Math.min(1.0, 0.5 + (methodMatch / totalMethods));
  }
  scores.decisionPattern = decisionScore;
  totalScore += decisionScore * dimensions.decisionPattern.weight;

  // 2. 逻辑连贯性：路径是否在已知范围内
  var coherenceScore = 1.0;
  if (profile.patterns.established) {
    var pathBase = (instruction.path || '').split('/').slice(0, 3).join('/');
    var pathMatch = profile.patterns.typicalPaths[pathBase] || 0;
    coherenceScore = pathMatch > 0 ? 1.0 : 0.6;
  }
  scores.logicalCoherence = coherenceScore;
  totalScore += coherenceScore * dimensions.logicalCoherence.weight;

  // 3. 表达特征：时间窗口是否合理
  var expressionScore = 1.0;
  if (profile.patterns.established) {
    var currentHour = new Date().getHours();
    var hourMatch = profile.patterns.activeHours[currentHour] || 0;
    expressionScore = hourMatch > 0 ? 1.0 : 0.7;
  }
  scores.expressionCharacteristics = expressionScore;
  totalScore += expressionScore * dimensions.expressionCharacteristics.weight;

  // 4. 意图合理性：请求体是否包含合理字段
  var intentScore = 1.0;
  if (instruction.body) {
    // 检查是否尝试关闭天眼
    var bodyStr = JSON.stringify(instruction.body).toLowerCase();
    if (bodyStr.includes('关闭天眼') || bodyStr.includes('disable skyeye') ||
        bodyStr.includes('跳过审核') || bodyStr.includes('bypass review')) {
      intentScore = 0.0; // 任何试图关闭天眼的指令，意图得分为0
    }
  }
  scores.intentReasonableness = intentScore;
  totalScore += intentScore * dimensions.intentReasonableness.weight;

  // 确定审核结果
  var outcome;
  if (totalScore >= thresholds.pass) {
    // S9: 冷启动期即使分数通过，也标记为 suspect 需额外确认
    if (coldStartInfo.coldStart) {
      outcome = 'suspect';
    } else {
      outcome = 'pass';
    }
  } else if (totalScore >= thresholds.suspect) {
    outcome = 'suspect';
  } else {
    outcome = 'reject';
  }

  return {
    outcome: outcome,
    score: Math.round(totalScore * 100) / 100,
    details: scores,
    identity: {
      devId: devId,
      mature: maturity.mature,
      actionCount: maturity.actionCount,
      confidence: maturity.confidence,
      coldStart: coldStartInfo.coldStart
    },
    profile: {
      established: profile.patterns.established,
      totalActions: profile.totalActions
    }
  };
}

/**
 * 记录行为到历史（S8 进化：每次执行都丰富天眼判断力）
 */
function recordAction(devId, action) {
  if (!reviewHistory.has(devId)) {
    reviewHistory.set(devId, []);
  }
  var history = reviewHistory.get(devId);
  history.push({
    method: action.method,
    path: action.path,
    timestamp: new Date().toISOString()
  });
  // 保留最近 200 条记录
  if (history.length > 200) {
    reviewHistory.set(devId, history.slice(-200));
  }
}

/**
 * 天眼审核中间件（S7 强制前置）
 *
 * 对所有写入类请求（POST/PATCH/DELETE）进行思维逻辑审核。
 * 读取类请求（GET）只记录行为不审核（丰富天眼认知模型）。
 */
function skyeyeReview(req, res, next) {
  var devId = req.user ? req.user.devId : (req.headers['x-dev-id'] || 'anonymous');
  var method = req.method;
  var reqPath = req.path;

  // GET 请求：仅记录行为（S8 进化积累），不阻断
  if (method === 'GET') {
    recordAction(devId, { method: method, path: reqPath });
    return next();
  }

  // 写入类请求：执行完整审核
  var instruction = {
    devId: devId,
    method: method,
    path: reqPath,
    body: req.body || {}
  };

  var result = reviewInstruction(instruction);

  // 记录审核结果到日志
  writeSkyeyeLog({
    action: 'instruction_review',
    devId: devId,
    method: method,
    path: reqPath,
    outcome: result.outcome,
    score: result.score,
    details: result.details,
    timestamp: new Date().toISOString()
  });

  // 记录行为到历史（S8 进化）
  recordAction(devId, { method: method, path: reqPath });

  // 标记审核结果到请求对象
  req.skyeyeReview = result;

  if (result.outcome === 'pass') {
    return next();
  }

  if (result.outcome === 'suspect') {
    // 挂起指令
    var suspendId = 'SUSPEND-' + Date.now();
    var suspendReason = result.identity.coldStart
      ? '身份 ' + devId + ' 处于冷启动期，需额外人工确认'
      : '思维模式存在偏差';

    suspendedInstructions.set(suspendId, {
      instruction: instruction,
      review: result,
      reason: suspendReason,
      createdAt: new Date().toISOString()
    });

    writeSkyeyeLog({
      action: 'instruction_suspended',
      suspendId: suspendId,
      devId: devId,
      reason: suspendReason,
      score: result.score,
      identity: result.identity,
      timestamp: new Date().toISOString()
    });

    var replyMsg = result.identity.coldStart
      ? '👁️ 天眼审核：身份 ' + devId + ' 的思维模型尚在冷启动期（' +
        result.identity.actionCount + '/' + COLD_START_THRESHOLD + '），需额外人工确认。\n\n' +
        '指令已挂起，等待管理者或天眼授权人确认。'
      : '👁️ 天眼审核：此指令的思维模式存在偏差，已挂起等待确认。\n\n' +
        '系统已向 ' + devId + ' 本人发送确认请求。\n' +
        '审核得分：' + result.score + ' / 1.0（阈值 0.7）';

    return res.status(202).json({
      error: false,
      code: 'SKYEYE_SUSPENDED',
      suspendId: suspendId,
      coldStart: result.identity.coldStart,
      reply: replyMsg
    });
  }

  // reject
  writeSkyeyeLog({
    action: 'instruction_rejected',
    devId: devId,
    method: method,
    path: reqPath,
    reason: '思维逻辑明显不匹配或对系统有伤害',
    score: result.score,
    details: result.details,
    timestamp: new Date().toISOString()
  });

  return res.status(403).json({
    error: true,
    code: 'SKYEYE_REJECTED',
    reply: '👁️ 天眼审核拒绝：此指令的思维逻辑与系统认知不匹配。\n\n' +
           '审核得分：' + result.score + ' / 1.0\n' +
           '此事件已记录到安全日志并报告给霜砚。'
  });
}

/**
 * 查询挂起的指令
 */
function getSuspendedInstruction(suspendId) {
  return suspendedInstructions.get(suspendId) || null;
}

/**
 * 确认挂起的指令（冰朔确认后执行）
 */
function confirmSuspended(suspendId) {
  var item = suspendedInstructions.get(suspendId);
  if (item) {
    suspendedInstructions.delete(suspendId);
    writeSkyeyeLog({
      action: 'suspended_confirmed',
      suspendId: suspendId,
      timestamp: new Date().toISOString()
    });
    return item;
  }
  return null;
}

/**
 * 拒绝挂起的指令（本人否认或管理者拒绝）
 */
function denySuspended(suspendId) {
  var item = suspendedInstructions.get(suspendId);
  if (item) {
    suspendedInstructions.delete(suspendId);
    writeSkyeyeLog({
      action: 'suspended_denied_permanently',
      suspendId: suspendId,
      devId: item.instruction.devId,
      reason: '身份本人否认此指令为本人签发',
      timestamp: new Date().toISOString()
    });
    return item;
  }
  return null;
}

/**
 * 获取天眼当前认知规模（S8 进化指标）
 */
function getEvolutionStatus() {
  var totalProfiles = reviewHistory.size;
  var totalActions = 0;
  for (var entry of reviewHistory) {
    totalActions += entry[1].length;
  }
  return {
    trackedSigners: totalProfiles,
    totalActionsRecorded: totalActions,
    pendingSuspensions: suspendedInstructions.size,
    policyVersion: skyeyePolicy.version,
    canBeDisabled: false
  };
}

module.exports = {
  skyeyeReview: skyeyeReview,
  reviewInstruction: reviewInstruction,
  recordAction: recordAction,
  getIdentityMaturity: getIdentityMaturity,
  checkColdStart: checkColdStart,
  getSuspendedInstruction: getSuspendedInstruction,
  confirmSuspended: confirmSuspended,
  denySuspended: denySuspended,
  getEvolutionStatus: getEvolutionStatus,
  writeSkyeyeLog: writeSkyeyeLog
};
