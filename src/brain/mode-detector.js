// src/brain/mode-detector.js
// 模式检测器 — 从前端迁出的核心脑逻辑
// 职责：根据用户输入文本自动检测任务模式

'use strict';

const MODES = {
  chat:   { emoji: '💬', label: '对话模式' },
  build:  { emoji: '🔨', label: '构建模式' },
  review: { emoji: '📋', label: '审查模式' },
  brain:  { emoji: '🧠', label: '大脑模式' },
};

const MODE_PATTERNS = {
  build: /写代码|新增接口|实现|接口|路由|schema|\.js\b|fix\b|bug\b|报错|error\b|部署|deploy|typescript|javascript|hli-|新建|create|npm|git\b|commit|push|merge|编译|build\b|构建|安装|install|配置|config/i,
  review: /检查|审查|review\b|分析|有没有问题|看看这|对不对|代码质量|优化|性能|安全|vulnerability|lint|测试|test\b|诊断|排查|debug/i,
  brain: /记住|保存|更新记忆|写到大脑|growth\b|brain\b|memory\.json|记忆|学习|总结|归档|同步.*notion|自检/i,
};

/**
 * 检测用户输入对应的任务模式
 * @param {string} text - 用户输入文本
 * @returns {{ mode: string, emoji: string, label: string }}
 */
function detectMode(text) {
  if (!text || typeof text !== 'string') {
    return { mode: 'chat', ...MODES.chat };
  }

  for (const [mode, pattern] of Object.entries(MODE_PATTERNS)) {
    if (pattern.test(text)) {
      return { mode, ...MODES[mode] };
    }
  }

  return { mode: 'chat', ...MODES.chat };
}

module.exports = { detectMode, MODES, MODE_PATTERNS };
