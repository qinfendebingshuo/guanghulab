// src/brain/index.js
// 铸渊核心大脑模块 v3.0
// 职责：统一导出大脑各子系统
//
// 架构：
//   prompt-assembler  — 系统提示词组装
//   mode-detector     — 任务模式检测
//   model-router      — 任务型模型路由
//   context-trimmer   — 上下文滑动窗口裁剪
//   memory-manager    — 三层记忆管理
//   brain-bridge      — 冰朔核心大脑桥（双层互通系统）

'use strict';

const { assemblePrompt, ROLE_MAP, FALLBACK_BRAIN } = require('./prompt-assembler');
const { detectMode, MODES } = require('./mode-detector');
const { selectModel, recordFailure, getRoutingTable, getFailureStatus } = require('./model-router');
const { trimMessages, estimateTokens, CONTEXT_CONFIG } = require('./context-trimmer');
const { generateCandidates, getMemoryStatus, loadLongTermMemory, setTaskMemory, getTaskMemory } = require('./memory-manager');
const bridge = require('./brain-bridge');

const BRAIN_VERSION = 'v3.0';

module.exports = {
  BRAIN_VERSION,

  // 提示词组装
  assemblePrompt,
  ROLE_MAP,
  FALLBACK_BRAIN,

  // 模式检测
  detectMode,
  MODES,

  // 模型路由
  selectModel,
  recordFailure,
  getRoutingTable,
  getFailureStatus,

  // 上下文裁剪
  trimMessages,
  estimateTokens,
  CONTEXT_CONFIG,

  // 记忆管理
  generateCandidates,
  getMemoryStatus,
  loadLongTermMemory,
  setTaskMemory,
  getTaskMemory,

  // 冰朔核心大脑桥
  bridge,
};
