/**
 * 执行状态查询路由 · L2 API 层
 *
 * GET  /api/execution/:executionId/status — 前端轮询执行状态
 * POST /api/execution/:executionId/cancel — 明确拒绝取消（403）
 * DELETE /api/execution/:executionId      — 明确拒绝删除（403）
 *
 * 注意：没有取消接口。这不是遗漏，是设计。
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var executionLock = require('../middleware/execution-lock');
var authMiddleware = require('../middleware/auth');

router.use(authMiddleware.requireAuth);

// 查询执行状态（前端轮询用）
router.get('/:executionId/status', function(req, res) {
  var status = executionLock.getExecutionStatus(req.params.executionId);

  if (!status) {
    return res.json({
      state: 'not_found',
      reply: '未找到该执行记录。可能已经完成。'
    });
  }

  // 计算进度百分比
  var progress = 5;
  if (status.totalSteps > 0) {
    progress = Math.min(95, Math.round((status.completedSteps / status.totalSteps) * 100));
  } else if (status.steps.length > 0) {
    progress = Math.min(95, status.steps.length * 15);
  }

  var afterIdx = parseInt(req.query.after, 10) || 0;

  res.json({
    executionId: status.executionId,
    state: status.state,
    operation: status.operation,
    progress: progress,
    currentStep: status.steps.length > 0
      ? status.steps[status.steps.length - 1].message
      : '初始化执行环境…',
    completedSteps: status.steps.filter(function(s) { return s.success; }).map(function(s) {
      return { message: s.message, timestamp: s.timestamp };
    }),
    newLogs: status.steps.slice(afterIdx),
    startTime: new Date(status.startTime).toISOString(),
    elapsed: Date.now() - status.startTime,
    result: status.state === 'completed' ? status.result : undefined,
    error: status.state === 'failed' ? status.error : undefined
  });
});

// 明确拒绝取消执行的请求
router.post('/:executionId/cancel', function(_req, res) {
  res.status(403).json({
    error: true,
    code: 'CANCEL_FORBIDDEN',
    reply: '🔒 执行中的操作不可取消。\n\n' +
           '系统已开始执行，多个自动化流程正在联动。' +
           '中途中断会导致数据不一致和级联故障。\n\n' +
           '请等待执行完成。如果结果不理想，你可以说：\n' +
           '「前面的我没想好，我们重新来」\n' +
           '系统会在已有基础上重新迭代。'
  });
});

// 明确拒绝删除执行记录
router.delete('/:executionId', function(_req, res) {
  res.status(403).json({
    error: true,
    code: 'DELETE_FORBIDDEN',
    reply: '🔒 不可删除执行记录。所有执行都是永久记录。'
  });
});

module.exports = router;
