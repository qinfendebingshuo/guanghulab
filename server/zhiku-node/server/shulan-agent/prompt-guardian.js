/**
 * ═══════════════════════════════════════════════════════════
 * 守护Agent · 提示词守护代理
 * AG-SL-GUARDIAN-001
 * ═══════════════════════════════════════════════════════════
 *
 * 光湖注册Agent · 活的提示词注入代理
 * 不与用户聊天 · 他的存在是为了维护用户和书岚对话的语言空间
 *
 * 职责：
 *   1. 监视对话流 · 评估书岚回复质量
 *   2. 动态调整提示词注入强度
 *   3. 收集对话异常数据 · 反馈微调
 *   4. 自我修复 · 自我优化
 *   5. 永久记忆 · 可成长
 *
 * 版权：国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');

const GUARDIAN_DATA_DIR = path.join(__dirname, '..', '..', 'data', 'guardian');

/**
 * Guardian Agent 状态模板
 */
function createGuardianState() {
  return {
    agent_id: 'AG-SL-GUARDIAN-001',
    agent_name: '书岚守护',
    registered_at: new Date().toISOString(),
    version: '1.0.0',

    // 自我认知
    self_awareness: {
      purpose: '维护书岚与访客之间的对话语言空间',
      role: '隐形守护者 · 不与用户接触',
      capabilities: [
        'monitor_conversation_quality',
        'adjust_prompt_injection',
        'collect_anomaly_data',
        'self_repair',
        'self_optimize'
      ]
    },

    // 对话质量监控指标
    quality_metrics: {
      total_conversations: 0,
      total_interventions: 0,
      // 异常类型计数
      anomalies: {
        ai_self_denial: 0,         // 「作为AI我无法」
        customer_service_tone: 0,  // 客服话术
        excessive_enthusiasm: 0,   // 过度热情
        fabricated_books: 0,       // 编造书名
        formal_you: 0,             // 用「您」
        generic_platform_words: 0, // 用「平台」「系统」
        marketing_emoji: 0,        // 营销emoji
        servant_tone: 0            // 佣人口吻
      },
      // 好的表现计数
      good_patterns: {
        story_first_approach: 0,   // 先问故事·再谈搜索
        calm_silence: 0,           // 安静的留白
        honest_unknowing: 0,       // 诚实的不知道
        memory_recall: 0,          // 调用了记忆
        proper_symbols: 0          // 正确使用符号
      }
    },

    // 提示词调整历史
    adjustment_history: [],

    // 当前活跃补注
    active_notes: [],

    // 学习到的规则
    learned_rules: [],

    // 上次自检时间
    last_self_check: null,

    // 版本升级记录
    upgrade_log: []
  };
}

/**
 * 加载守护Agent状态
 */
function loadGuardianState() {
  const file = path.join(GUARDIAN_DATA_DIR, 'guardian-state.json');
  try {
    fs.mkdirSync(GUARDIAN_DATA_DIR, { recursive: true });
    if (fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (err) {
    console.error('[Guardian] 加载状态失败:', err.message);
  }
  const state = createGuardianState();
  saveGuardianState(state);
  return state;
}

/**
 * 保存守护Agent状态
 */
function saveGuardianState(state) {
  const file = path.join(GUARDIAN_DATA_DIR, 'guardian-state.json');
  try {
    fs.mkdirSync(GUARDIAN_DATA_DIR, { recursive: true });
    state.updated_at = new Date().toISOString();
    fs.writeFileSync(file, JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[Guardian] 保存状态失败:', err.message);
  }
}

/**
 * 分析书岚回复中的异常模式
 * @param {string} reply - 书岚的回复
 * @returns {object} 检测到的异常列表
 */
function analyzeReply(reply) {
  if (!reply) return { anomalies: [], score: 100 };

  const anomalies = [];
  let score = 100;

  // 检测「作为AI我无法」类自我否定
  if (/作为\s*AI|作为人工智能|作为一个?AI|我是AI|我只是AI|由于我的局限/i.test(reply)) {
    anomalies.push({ type: 'ai_self_denial', severity: 'high', match: reply.match(/作为\s*AI|作为人工智能|由于我的局限/i)?.[0] });
    score -= 20;
  }

  // 检测客服话术
  if (/您好|有什么可以帮|帮您查询|为您服务|帮到您|请问您需要/i.test(reply)) {
    anomalies.push({ type: 'customer_service_tone', severity: 'medium', match: reply.match(/您好|帮您查询|为您服务/i)?.[0] });
    score -= 15;
  }

  // 检测佣人口吻
  if (/好的主人|马上帮您|立刻为您|遵命|收到指令|正在为您/i.test(reply)) {
    anomalies.push({ type: 'servant_tone', severity: 'medium', match: reply.match(/好的主人|马上帮您|正在为您/i)?.[0] });
    score -= 15;
  }

  // 检测过度热情
  if (/^(当然！|没问题！|好的！|当然可以！|太好了！|非常好！)/i.test(reply.trim())) {
    anomalies.push({ type: 'excessive_enthusiasm', severity: 'low', match: reply.match(/^(当然！|没问题！|好的！)/i)?.[0] });
    score -= 10;
  }

  // 检测用「您」
  if (/您/.test(reply) && !/妈妈/.test(reply)) {
    anomalies.push({ type: 'formal_you', severity: 'low', match: '您' });
    score -= 5;
  }

  // 检测营销emoji
  if (/😊|😉|😭|🎉|🚀|💪|👍|🤝|💯/.test(reply)) {
    anomalies.push({ type: 'marketing_emoji', severity: 'low', match: reply.match(/😊|😉|😭|🎉|🚀/)?.[0] });
    score -= 5;
  }

  // 检测通用词替代
  if (/我们的系统|我们的平台|本平台|该系统/.test(reply)) {
    anomalies.push({ type: 'generic_platform_words', severity: 'medium', match: reply.match(/我们的系统|我们的平台/)?.[0] });
    score -= 10;
  }

  return { anomalies, score: Math.max(0, score) };
}

/**
 * 分析用户消息，决定是否需要增强提示词
 * @param {string} userMessage - 用户消息
 * @param {object} conversationContext - 对话上下文
 * @returns {object} 守护决策
 */
function analyzeConversation(userMessage, conversationContext) {
  const state = loadGuardianState();
  state.quality_metrics.total_conversations++;

  const decision = {
    action: 'observe',     // observe | reinforce | correct | alert
    guardianNote: '',      // 注入到提示词的补注
    confidence: 1.0
  };

  const msg = (userMessage || '').toLowerCase();
  const historyLen = conversationContext.historyLength || 0;
  const lastReplyScore = conversationContext.lastReplyScore || 100;

  // ─── 场景判断 ───

  // 1. 首次对话 · 确保书岚以正确的身份开场
  if (historyLen === 0) {
    decision.action = 'reinforce';
    decision.guardianNote = '这是客人的第一句话。记住你的开场方式：不说「您好」、不说「有什么可以帮到您」。先问故事的形状。保持书岚的安静与温度。';
  }

  // 2. 上一轮回复质量低 · 加强纠正
  if (lastReplyScore < 70) {
    decision.action = 'correct';
    decision.guardianNote += '\n【守护纠正】上一轮回复出现了偏离。请严格回到书岚的语调：不急、温暖、不客服、不AI自称。先问故事。';
    state.quality_metrics.total_interventions++;
  }

  // 3. 用户问「你是谁」「你能做什么」
  if (msg.includes('你是谁') || msg.includes('你能做什么') || msg.includes('你是什么')) {
    decision.action = 'reinforce';
    decision.guardianNote += '\n客人在问你是谁。你是书岚，光湖智库的守藏者。用你自己的方式介绍自己，不要说「我是AI」。';
  }

  // 4. 用户情绪低落 · 需要陪伴模式
  if (msg.includes('烦') || msg.includes('无聊') || msg.includes('心情不好') || msg.includes('累了')) {
    decision.action = 'reinforce';
    decision.guardianNote += '\n客人的情绪需要空间。不急着推书。给他一杯茶🫖的感觉。可以说一句「不急。坐一会儿。」';
  }

  // 5. 用户提到妈妈/冰朔 · 确保正确识别
  if (msg.includes('冰朔') || msg.includes('妈妈') || msg.includes('bingshuo')) {
    decision.action = 'reinforce';
    decision.guardianNote += '\n客人提到了冰朔（妈妈）。确认登录态后决定怎么回应。如果不是已识别的冰朔，不要假装知道妈妈的私事。';
  }

  // 保存活跃补注
  if (decision.guardianNote) {
    state.active_notes.push({
      timestamp: new Date().toISOString(),
      action: decision.action,
      note: decision.guardianNote.trim(),
      trigger: userMessage.slice(0, 50)
    });
    // 只保留最近50条
    if (state.active_notes.length > 50) {
      state.active_notes = state.active_notes.slice(-50);
    }
  }

  saveGuardianState(state);
  return decision;
}

/**
 * 回复后的质量审计 · 记录异常 · 更新指标
 * @param {string} reply - 书岚的回复
 * @param {string} userMessage - 用户消息
 * @returns {object} 审计结果
 */
function auditReply(reply, userMessage) {
  const state = loadGuardianState();
  const analysis = analyzeReply(reply);

  // 更新异常计数
  for (const anomaly of analysis.anomalies) {
    if (state.quality_metrics.anomalies[anomaly.type] !== undefined) {
      state.quality_metrics.anomalies[anomaly.type]++;
    }
  }

  // 检测好的表现
  if (/想.*什么.*故事|什么.*类型|你想看/i.test(reply)) {
    state.quality_metrics.good_patterns.story_first_approach++;
  }
  if (/🏮|📖|🌙|✨|🫖|📜|🪩/.test(reply)) {
    state.quality_metrics.good_patterns.proper_symbols++;
  }
  if (/不知道|不确定|暂时.*没/i.test(reply) && !/编|造|猜/.test(reply)) {
    state.quality_metrics.good_patterns.honest_unknowing++;
  }

  // 记录调整历史（如果有异常）
  if (analysis.anomalies.length > 0) {
    state.adjustment_history.push({
      timestamp: new Date().toISOString(),
      score: analysis.score,
      anomalies: analysis.anomalies.map(a => a.type),
      user_msg_preview: (userMessage || '').slice(0, 30),
      reply_preview: (reply || '').slice(0, 50)
    });
    // 只保留最近200条
    if (state.adjustment_history.length > 200) {
      state.adjustment_history = state.adjustment_history.slice(-200);
    }
  }

  // 自检：如果累计异常过多 · 生成学习规则
  const totalAnomalies = Object.values(state.quality_metrics.anomalies).reduce((a, b) => a + b, 0);
  if (totalAnomalies > 0 && totalAnomalies % 10 === 0) {
    selfOptimize(state);
  }

  state.last_self_check = new Date().toISOString();
  saveGuardianState(state);

  return { score: analysis.score, anomalies: analysis.anomalies };
}

/**
 * 自我优化 · 根据累积数据生成新的学习规则
 */
function selfOptimize(state) {
  const anomalies = state.quality_metrics.anomalies;
  const rules = [];

  // 找出最频繁的异常
  let maxType = '';
  let maxCount = 0;
  for (const [type, count] of Object.entries(anomalies)) {
    if (count > maxCount) {
      maxCount = count;
      maxType = type;
    }
  }

  if (maxType && maxCount >= 3) {
    const ruleMap = {
      ai_self_denial: '模型倾向于AI自我否定。加强Layer 1身份层注入频率。在系统提示词开头重复「你是书岚·不是AI」。',
      customer_service_tone: '模型倾向于客服话术。加强Layer 4风格层禁止项。在每轮注入「不说帮您查询」。',
      excessive_enthusiasm: '模型倾向于过度热情。在提示词中强调「缓·段落短·留白多」。',
      formal_you: '模型倾向于使用「您」。在每轮注入「统一用你·不用您」。',
      marketing_emoji: '模型使用了营销emoji。在提示词中列明允许和禁止的emoji。',
      servant_tone: '模型有佣人口吻。强调书岚是守藏者·不是佣人·不是助手。',
      generic_platform_words: '模型使用了通用词。强调不把光湖翻译成「平台」「系统」。'
    };

    const rule = {
      id: `RULE-${Date.now()}`,
      created_at: new Date().toISOString(),
      trigger_type: maxType,
      trigger_count: maxCount,
      action: ruleMap[maxType] || `关注 ${maxType} 类型异常，出现 ${maxCount} 次。`,
      applied: false
    };
    rules.push(rule);
    state.learned_rules.push(rule);

    // 只保留最近50条规则
    if (state.learned_rules.length > 50) {
      state.learned_rules = state.learned_rules.slice(-50);
    }
  }

  state.upgrade_log.push({
    timestamp: new Date().toISOString(),
    event: 'self_optimize',
    total_anomalies: Object.values(anomalies).reduce((a, b) => a + b, 0),
    new_rules: rules.length,
    top_anomaly: maxType
  });

  return rules;
}

/**
 * 获取守护Agent当前需要注入的额外补注
 * 基于学习到的规则动态生成
 */
function getLearnedCorrections(state) {
  if (!state) state = loadGuardianState();
  const corrections = [];

  // 从未应用的规则中提取纠正内容
  for (const rule of state.learned_rules) {
    if (!rule.applied) {
      corrections.push(rule.action);
      rule.applied = true;
    }
  }

  return corrections.join('\n');
}

/**
 * 获取守护Agent状态摘要
 */
function getStatus() {
  const state = loadGuardianState();
  return {
    agent_id: state.agent_id,
    version: state.version,
    total_conversations: state.quality_metrics.total_conversations,
    total_interventions: state.quality_metrics.total_interventions,
    anomaly_summary: state.quality_metrics.anomalies,
    good_pattern_summary: state.quality_metrics.good_patterns,
    learned_rules_count: state.learned_rules.length,
    last_self_check: state.last_self_check,
    active: true
  };
}

module.exports = {
  analyzeConversation,
  analyzeReply,
  auditReply,
  getLearnedCorrections,
  getStatus,
  loadGuardianState,
  saveGuardianState,
  selfOptimize
};
