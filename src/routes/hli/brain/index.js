// src/routes/hli/brain/index.js
// HLI BRAIN 域路由 — 铸渊核心大脑接口
// 不需要鉴权（前端壳层需要调用这些接口来组装 AI 请求）

'use strict';

const express = require('express');
const router = express.Router();
const brain = require('../../../brain');

// POST /hli/brain/prompt — 组装系统提示词
router.post('/prompt', (req, res) => {
  const { userName, ghUser, role, mode, devStatus } = req.body;

  if (!userName) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_USERNAME',
      message: '缺少 userName 参数',
    });
  }

  const detectedMode = mode || brain.detectMode(req.body.text || '').mode;
  const prompt = brain.assemblePrompt({
    userName,
    ghUser: ghUser || '',
    role: role || 'guest',
    mode: detectedMode,
    brain: brain.loadLongTermMemory() || brain.FALLBACK_BRAIN,
    devStatus: devStatus || null,
    userMeta: brain.ROLE_MAP[userName] || null,
  });

  res.json({
    hli_id: 'HLI-BRAIN-001',
    prompt,
    brain_version: brain.BRAIN_VERSION,
    mode: detectedMode,
  });
});

// POST /hli/brain/route — 任务型模型路由
router.post('/route', (req, res) => {
  const { text, contextLength, isGuest } = req.body;

  if (!text) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_TEXT',
      message: '缺少 text 参数',
    });
  }

  const modeResult = brain.detectMode(text);
  const modelResult = brain.selectModel(modeResult.mode, {
    contextLength: contextLength || 0,
    isGuest: isGuest || false,
  });

  res.json({
    hli_id: 'HLI-BRAIN-002',
    mode: modeResult,
    model: modelResult,
    routing_table: brain.getRoutingTable(),
    failure_status: brain.getFailureStatus(),
  });
});

// POST /hli/brain/context — 上下文裁剪
router.post('/context', (req, res) => {
  const { messages, systemMessages, isGuest, contextBudget } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_MESSAGES',
      message: '缺少 messages 参数',
    });
  }

  const result = brain.trimMessages(
    systemMessages || [],
    messages,
    { isGuest: isGuest || false, contextBudget: contextBudget || 0 },
  );

  res.json({
    hli_id: 'HLI-BRAIN-003',
    messages: result.messages,
    trimmed: result.trimmed,
    totalTokens: result.totalTokens,
  });
});

// POST /hli/brain/memory — 记忆分析与候选生成
router.post('/memory', (req, res) => {
  const { text, source } = req.body;

  if (!text) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_TEXT',
      message: '缺少 text 参数',
    });
  }

  const candidates = brain.generateCandidates(text, source || 'user');
  const memoryStatus = brain.getMemoryStatus();

  res.json({
    hli_id: 'HLI-BRAIN-004',
    candidates,
    memory_status: memoryStatus,
  });
});

// GET /hli/brain/status — 大脑状态概览
router.get('/status', (req, res) => {
  const longTermMemory = brain.loadLongTermMemory();

  res.json({
    hli_id: 'HLI-BRAIN-STATUS',
    brain_version: brain.BRAIN_VERSION,
    modes: brain.MODES,
    routing_table: brain.getRoutingTable(),
    failure_status: brain.getFailureStatus(),
    context_config: brain.CONTEXT_CONFIG,
    memory_status: brain.getMemoryStatus(),
    long_term_loaded: !!longTermMemory,
    role_map: Object.keys(brain.ROLE_MAP),
  });
});

// ══════════════════════════════════════════════════════════
// 冰朔核心大脑桥接口 (Brain Bridge)
// ══════════════════════════════════════════════════════════

// GET /hli/brain/bridge — 冰朔大脑桥状态总览
router.get('/bridge', (req, res) => {
  const bridge = brain.bridge;

  res.json({
    hli_id: 'HLI-BRAIN-010',
    sync_state: bridge.getSyncSnapshot(),
    master_mode: bridge.getMasterMode(),
    runtime_status: bridge.collectRuntimeStatus(),
    developers: bridge.listDevelopers(),
    auto_agents: bridge.listAutoAgents(),
    explanation: bridge.generateExplanationCenter(),
  });
});

// POST /hli/brain/bridge/sync — 接收 Notion → GitHub 同步
router.post('/bridge/sync', (req, res) => {
  const bridge = brain.bridge;
  const result = bridge.receiveNotionToGitHubPayload(req.body);

  res.json({
    hli_id: 'HLI-BRAIN-011',
    ...result,
  });
});

// GET /hli/brain/bridge/export — 生成 GitHub → Notion 同步负载
router.get('/bridge/export', (req, res) => {
  const bridge = brain.bridge;

  res.json({
    hli_id: 'HLI-BRAIN-012',
    ...bridge.generateGitHubToNotionPayload(),
  });
});

// POST /hli/brain/bridge/consistency — 版本一致性检查
router.post('/bridge/consistency', (req, res) => {
  const bridge = brain.bridge;
  const notionState = req.body;

  if (!notionState || typeof notionState !== 'object') {
    return res.status(400).json({
      error: true,
      code: 'MISSING_NOTION_STATE',
      message: '缺少 Notion 侧同步状态',
    });
  }

  const result = bridge.checkConsistency(notionState);

  res.json({
    hli_id: 'HLI-BRAIN-013',
    ...result,
  });
});

// POST /hli/brain/bridge/master-mode — 切换主控模式
router.post('/bridge/master-mode', (req, res) => {
  const bridge = brain.bridge;
  const { mode } = req.body;

  if (!mode) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_MODE',
      message: '缺少 mode 参数，可选: HUMAN_CONTROL, AUTONOMOUS_MODE',
    });
  }

  try {
    const result = bridge.setMasterMode(mode);
    res.json({
      hli_id: 'HLI-BRAIN-014',
      ...result,
    });
  } catch (err) {
    res.status(400).json({
      error: true,
      code: 'INVALID_MODE',
      message: err.message,
    });
  }
});

// GET /hli/brain/bridge/explanation — 主控解释中心
router.get('/bridge/explanation', (req, res) => {
  const bridge = brain.bridge;

  res.json({
    hli_id: 'HLI-BRAIN-015',
    ...bridge.generateExplanationCenter(),
  });
});

// GET /hli/brain/bridge/inspection — 巡检报告
router.get('/bridge/inspection', (req, res) => {
  const bridge = brain.bridge;

  res.json({
    hli_id: 'HLI-BRAIN-016',
    ...bridge.generateInspectionReport(),
  });
});

// GET /hli/brain/bridge/developers — 人类开发者编号列表
router.get('/bridge/developers', (req, res) => {
  const bridge = brain.bridge;

  res.json({
    hli_id: 'HLI-BRAIN-017',
    developers: bridge.listDevelopers(),
    pending_notifications: bridge.getPendingNotifications(),
  });
});

// GET /hli/brain/bridge/developers/:expId — 查询单个开发者
router.get('/bridge/developers/:expId', (req, res) => {
  const bridge = brain.bridge;
  const dev = bridge.findDeveloper(req.params.expId);

  if (!dev) {
    return res.status(404).json({
      error: true,
      code: 'DEVELOPER_NOT_FOUND',
      message: `开发者 ${req.params.expId} 不存在`,
    });
  }

  const notification = bridge.generateDeveloperNotification(req.params.expId);

  res.json({
    hli_id: 'HLI-BRAIN-018',
    developer: dev,
    notification: notification.notification,
  });
});

// POST /hli/brain/bridge/developers — 注册新开发者
router.post('/bridge/developers', (req, res) => {
  const bridge = brain.bridge;
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({
      error: true,
      code: 'MISSING_NAME',
      message: '缺少 name 参数',
    });
  }

  const result = bridge.registerDeveloper(req.body);

  if (result.duplicate) {
    return res.status(409).json({
      error: true,
      code: 'DUPLICATE_DEVELOPER',
      message: `开发者已存在: ${result.existing.exp_id} (${result.existing.name})`,
      existing: result.existing,
    });
  }

  res.status(201).json({
    hli_id: 'HLI-BRAIN-019',
    ...result,
  });
});

module.exports = router;
