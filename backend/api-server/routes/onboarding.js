/**
 * 认知引导流程 API 路由
 *
 * GET  /api/onboarding/status   — 获取引导状态
 * POST /api/onboarding/start    — 开始引导
 * POST /api/onboarding/complete — 完成引导（自动升级权限）
 * GET  /api/tools               — 获取可用工具列表（根据权限过滤）
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var authMiddleware = require('../middleware/auth');
var intentRouter = require('../middleware/intent-router');
var onboardingScript = require('../config/onboarding-script.json');
var permissions = require('../config/permissions');

// 引导状态存储（内存，生产环境应持久化）
var onboardingState = new Map();

// ====== 获取引导状态 ======
router.get('/onboarding/status',
  authMiddleware.requireAuth,
  function(req, res) {
    var devId = req.user.devId;
    var state = onboardingState.get(devId);

    if (!state) {
      // 未开始引导
      res.json({
        started: false,
        completed: false,
        currentRound: 0,
        totalRounds: onboardingScript.onboarding.length,
        permissionLevel: req.user.permissionLevel
      });
    } else {
      res.json({
        started: true,
        completed: state.completed,
        currentRound: state.currentRound,
        totalRounds: onboardingScript.onboarding.length,
        permissionLevel: req.user.permissionLevel,
        script: state.completed ? null : onboardingScript.onboarding[state.currentRound - 1]
      });
    }
  }
);

// ====== 开始/推进引导 ======
router.post('/onboarding/start',
  authMiddleware.requireAuth,
  function(req, res) {
    var devId = req.user.devId;
    var state = onboardingState.get(devId);

    if (!state) {
      // 开始新引导
      state = { currentRound: 1, completed: false, startedAt: new Date().toISOString() };
      onboardingState.set(devId, state);
    } else if (!state.completed) {
      // 推进到下一轮
      if (state.currentRound < onboardingScript.onboarding.length) {
        state.currentRound++;
      } else {
        state.completed = true;
        state.completedAt = new Date().toISOString();
      }
    }

    var script = state.completed ? null : onboardingScript.onboarding[state.currentRound - 1];

    res.json({
      currentRound: state.currentRound,
      totalRounds: onboardingScript.onboarding.length,
      completed: state.completed,
      script: script
    });
  }
);

// ====== 完成引导（自动升级权限）======
router.post('/onboarding/complete',
  authMiddleware.requireAuth,
  function(req, res) {
    var devId = req.user.devId;
    var state = onboardingState.get(devId);

    if (!state) {
      return res.status(400).json({
        error: true,
        code: 'NOT_STARTED',
        message: '引导尚未开始'
      });
    }

    // 标记完成
    state.completed = true;
    state.completedAt = new Date().toISOString();

    // 自动升级权限：Level 0 → Level 1
    var devConfig = permissions.DEV_PERMISSIONS[devId];
    if (devConfig && devConfig.level === 0) {
      devConfig.level = 1;
    }

    res.json({
      success: true,
      previousLevel: 0,
      newLevel: devConfig ? devConfig.level : 0,
      reply: '🎉 恭喜！你已完成认知引导。\n\n你的权限已从「👀 观察者」升级为「📖 学习者」。\n现在可以在预览站创建工单、提交日志、触发部署了。\n\n有什么问题随时找我。'
    });
  }
);

// ====== 获取可用工具列表 ======
router.get('/tools',
  authMiddleware.requireAuth,
  function(req, res) {
    var available = intentRouter.getAvailableTools(req.user);

    res.json({
      dev_id: req.user.devId,
      permission_level: req.user.permissionLevel,
      permission_label: req.user.permissionLabel,
      environment: req.user.environment,
      tools_count: available.length,
      tools: available
    });
  }
);

module.exports = router;
