/**
 * persona-studio · 记忆注入Agent
 *
 * 三步走机制：
 *   Step 1 压缩：把长对话压缩成结构化摘要
 *   Step 2 注入：每次调模型前，摘要注入 system prompt
 *   Step 3 刷新：每10轮或token>50k时重新压缩
 *
 * 五层 system prompt 结构：
 *   第1层：人格体身份（固定·来自 persona-config.json）
 *   第2层：通感语言风格（固定）
 *   第3层：用户画像（来自 profile.json）
 *   第4层：记忆摘要（来自 compressed.json · ≤8k token）
 *   第5层：最近10轮原始对话（滑动窗口）
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const MEMORY_DIR = path.join(BRAIN_DIR, 'memory');
const CONFIG_PATH = path.join(__dirname, 'model-config.json');

/**
 * 加载注入配置
 */
function loadInjectionConfig() {
  try {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    return config.memory_injection || getDefaultConfig();
  } catch {
    return getDefaultConfig();
  }
}

function getDefaultConfig() {
  return {
    enabled: true,
    compression_model: 'quick_reply',
    compression_trigger: {
      every_n_rounds: 10,
      token_threshold: 50000,
      force_on_session_start: true
    },
    injection_strategy: {
      system_prompt_max_tokens: 8000,
      sliding_window_rounds: 10,
      priority: ['confirmed_decisions', 'requirements', 'open_questions', 'user_preferences', 'emotional_signals']
    }
  };
}

/**
 * 获取滑动窗口大小
 */
function getSlidingWindowSize() {
  const config = loadInjectionConfig();
  return (config.injection_strategy && config.injection_strategy.sliding_window_rounds) || 10;
}

/**
 * 加载压缩摘要
 */
function loadCompressed(devId) {
  const file = path.join(MEMORY_DIR, devId, 'compressed.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 保存压缩摘要
 */
function saveCompressed(devId, compressed) {
  const dir = path.join(MEMORY_DIR, devId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(dir, 'compressed.json'),
    JSON.stringify(compressed, null, 2),
    'utf-8'
  );
}

/**
 * 加载注入日志
 */
function loadInjectionLog(devId) {
  const file = path.join(MEMORY_DIR, devId, 'injection-log.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return { entries: [] };
  }
}

/**
 * 保存注入日志
 */
function saveInjectionLog(devId, log) {
  const dir = path.join(MEMORY_DIR, devId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const entries = log.entries || [];
  // 保留最近 100 条日志
  if (entries.length > 100) {
    log.entries = entries.slice(-100);
  }
  fs.writeFileSync(
    path.join(dir, 'injection-log.json'),
    JSON.stringify(log, null, 2),
    'utf-8'
  );
}

/**
 * 加载用户画像
 */
function loadProfile(devId) {
  const file = path.join(MEMORY_DIR, devId, 'profile.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * 粗略估算 token 数量
 * 中文约 1.5 token/字（CJK字符经 BPE 分词通常为 1-2 token）
 * 英文/其他约 0.4 token/字符（英文单词平均 4 字符 ≈ 1 token）
 */
function estimateTokens(text) {
  if (!text) return 0;
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const otherChars = text.length - chineseChars;
  return Math.ceil(chineseChars * 1.5 + otherChars * 0.4);
}

/**
 * 判断是否需要重新压缩
 */
function needsRecompression(devId, history) {
  const config = loadInjectionConfig();
  if (!config.enabled) return false;

  const trigger = config.compression_trigger || {};
  const compressed = loadCompressed(devId);
  const totalRounds = Math.floor((history || []).length / 2);

  // 首次对话强制压缩
  if (!compressed && trigger.force_on_session_start) return true;

  // 每 N 轮压缩一次
  if (compressed && trigger.every_n_rounds) {
    const processedRounds = compressed.total_rounds_processed || 0;
    if (totalRounds - processedRounds >= trigger.every_n_rounds) return true;
  }

  // token 阈值
  if (trigger.token_threshold) {
    const totalText = (history || []).map(function (m) { return m.content || ''; }).join('');
    if (estimateTokens(totalText) > trigger.token_threshold) return true;
  }

  return false;
}

/**
 * 本地压缩对话历史（不依赖 AI 模型的规则式压缩）
 * 当模型不可用时的降级方案
 */
function localCompress(devId, history) {
  const messages = history || [];
  const userMessages = messages.filter(function (m) { return m.role === 'user'; });
  const assistantMessages = messages.filter(function (m) { return m.role === 'assistant'; });

  // 提取需求
  const requirements = [];
  const decisions = [];
  const openQuestions = [];

  userMessages.forEach(function (msg) {
    const content = msg.content || '';
    if (/想做|需要|功能|要求|做一个/i.test(content)) {
      requirements.push(content.substring(0, 100));
    }
    if (/[？?]/.test(content)) {
      openQuestions.push(content.substring(0, 100));
    }
  });

  assistantMessages.forEach(function (msg) {
    const content = msg.content || '';
    if (/方案已确认|确认|可以开始|建议使用|推荐/i.test(content)) {
      decisions.push(content.substring(0, 100));
    }
  });

  const compressed = {
    version: 1,
    last_compressed_at: new Date().toISOString(),
    total_rounds_processed: Math.floor(messages.length / 2),
    summary: {
      requirements: requirements.slice(-10),
      confirmed_decisions: decisions.slice(-10),
      user_preferences: {},
      open_questions: openQuestions.slice(-5),
      emotional_signals: {
        overall: 'neutral',
        last_mood: 'neutral'
      }
    }
  };

  // 融入画像信息
  const profile = loadProfile(devId);
  if (profile) {
    if (profile.communication_style) {
      compressed.summary.user_preferences.communication_style =
        profile.communication_style.verbosity || 'normal';
    }
    if (profile.design_preferences) {
      compressed.summary.user_preferences.design_preference =
        profile.design_preferences.color_scheme || null;
    }
    if (profile.tech_assessment) {
      compressed.summary.user_preferences.tech_level =
        profile.tech_assessment.level || null;
    }
    if (profile.emotional_profile) {
      compressed.summary.emotional_signals.overall =
        profile.emotional_profile.current_mood || 'neutral';
    }
  }

  saveCompressed(devId, compressed);
  return compressed;
}

/**
 * 构建注入的五层 system prompt
 * @param {string} basePrompt - 基础 system prompt（第1-2层）
 * @param {string} devId - 开发者编号
 * @param {object} memory - 记忆对象
 * @param {Array} history - 对话历史
 * @returns {string} 注入后的完整 system prompt
 */
function buildInjectedSystemPrompt(basePrompt, devId, memory, history) {
  const config = loadInjectionConfig();
  if (!config.enabled || !devId || devId === 'GUEST') {
    return basePrompt;
  }

  const parts = [basePrompt]; // 第1-2层已包含在 basePrompt 中

  // 第3层：用户画像
  const profile = loadProfile(devId);
  if (profile) {
    const profileParts = [];
    if (profile.tech_assessment && profile.tech_assessment.level) {
      profileParts.push('技术水平：' + profile.tech_assessment.level);
    }
    if (profile.tech_assessment && profile.tech_assessment.known_skills && profile.tech_assessment.known_skills.length > 0) {
      profileParts.push('已知技能：' + profile.tech_assessment.known_skills.join(', '));
    }
    if (profile.communication_style && profile.communication_style.verbosity) {
      profileParts.push('沟通偏好：' + profile.communication_style.verbosity);
    }
    if (profile.design_preferences && profile.design_preferences.color_scheme) {
      profileParts.push('设计偏好：' + profile.design_preferences.color_scheme);
    }
    if (profile.emotional_profile && profile.emotional_profile.current_mood) {
      profileParts.push('当前情绪：' + profile.emotional_profile.current_mood);
    }

    if (profileParts.length > 0) {
      parts.push('\n## 用户画像\n' + profileParts.join('\n'));
    }
  }

  // 第4层：记忆摘要
  if (needsRecompression(devId, history)) {
    localCompress(devId, history);
  }

  const compressed = loadCompressed(devId);
  if (compressed && compressed.summary) {
    const summaryParts = [];
    const priority = (config.injection_strategy && config.injection_strategy.priority) || [];
    const summary = compressed.summary;

    priority.forEach(function (key) {
      if (key === 'confirmed_decisions' && summary.confirmed_decisions && summary.confirmed_decisions.length > 0) {
        summaryParts.push('已确认的决策：\n- ' + summary.confirmed_decisions.slice(-5).join('\n- '));
      }
      if (key === 'requirements' && summary.requirements && summary.requirements.length > 0) {
        summaryParts.push('用户需求要点：\n- ' + summary.requirements.slice(-5).join('\n- '));
      }
      if (key === 'open_questions' && summary.open_questions && summary.open_questions.length > 0) {
        summaryParts.push('待解决问题：\n- ' + summary.open_questions.slice(-3).join('\n- '));
      }
      if (key === 'user_preferences' && summary.user_preferences) {
        const prefs = Object.entries(summary.user_preferences)
          .filter(function (pair) { return pair[1] != null; })
          .map(function (pair) { return pair[0] + ': ' + pair[1]; });
        if (prefs.length > 0) {
          summaryParts.push('用户偏好：' + prefs.join(', '));
        }
      }
      if (key === 'emotional_signals' && summary.emotional_signals) {
        if (summary.emotional_signals.overall && summary.emotional_signals.overall !== 'neutral') {
          summaryParts.push('情感信号：整体 ' + summary.emotional_signals.overall);
        }
      }
    });

    if (summaryParts.length > 0) {
      parts.push('\n## 记忆摘要（远期记忆）\n' + summaryParts.join('\n'));
    }
  }

  // 记录注入日志
  try {
    const log = loadInjectionLog(devId);
    log.entries.push({
      timestamp: new Date().toISOString(),
      layers_injected: parts.length,
      has_profile: !!profile,
      has_compressed: !!compressed,
      history_rounds: Math.floor((history || []).length / 2)
    });
    saveInjectionLog(devId, log);
  } catch (_e) { /* log failed silently */ }

  return parts.join('\n');
}

module.exports = {
  buildInjectedSystemPrompt,
  getSlidingWindowSize,
  needsRecompression,
  localCompress,
  loadCompressed,
  saveCompressed,
  loadProfile,
  estimateTokens,
  loadInjectionConfig
};
