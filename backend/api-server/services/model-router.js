/**
 * 智能模型路由 — 基于用户意图的模型自动选择
 *
 * 根据人类说话的意图（关键词匹配），自动选择最合适的模型回复。
 * 人类不需要知道背后用了哪个模型，系统自己选。
 *
 * 与 src/brain/model-router.js（任务型路由）互补：
 *   - src/brain/model-router.js → 按任务模式（chat/build/review/brain/long）路由
 *   - 本模块 → 按用户消息内容（关键词意图检测）路由
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var MODEL_PROFILES = {
  // 日常对话、闲聊、简单问答
  casual: {
    models: ['deepseek-chat', 'glm-4-flash'],
    keywords: ['你好', '聊聊', '怎么样', '帮我', '是什么', '谢谢', '请问', '可以吗'],
    maxTokens: 2000
  },
  // 代码相关、技术问题
  coding: {
    models: ['deepseek-chat', 'gpt-4o'],
    keywords: ['代码', 'code', 'bug', '报错', '函数', 'API', '部署', '配置', 'npm', 'git', '编译', '调试', 'debug', '接口', '数据库'],
    maxTokens: 4000
  },
  // 创意写作、长文生成
  creative: {
    models: ['deepseek-chat', 'moonshot-v1-128k'],
    keywords: ['写', '故事', '文案', '小说', '剧情', '人设', '大纲', '创意', '灵感', '文章', '描写'],
    maxTokens: 8000
  },
  // 数据分析、逻辑推理
  analytical: {
    models: ['deepseek-chat', 'gpt-4o'],
    keywords: ['分析', '对比', '数据', '统计', '逻辑', '推理', '策略', '方案', '评估', '优化'],
    maxTokens: 4000
  },
  // 系统指令、架构级操作
  system: {
    models: ['deepseek-chat', 'gpt-4o'],
    keywords: ['指令', '部署', '架构', '系统', '铁律', '天眼', '权限', '工单', '广播', '流程'],
    maxTokens: 6000
  }
};

/**
 * 分析用户意图，选择最佳模型
 * @param {string} userMessage - 用户消息
 * @param {Object} context - 上下文（保留扩展）
 * @returns {{ model: string, maxTokens: number, profile: string, fallbacks: string[] }}
 */
function routeToModel(userMessage, context) {
  if (!userMessage || typeof userMessage !== 'string') {
    var casualConfig = MODEL_PROFILES.casual;
    return {
      model: casualConfig.models[0],
      maxTokens: casualConfig.maxTokens,
      profile: 'casual',
      fallbacks: casualConfig.models.slice(1)
    };
  }

  var msg = userMessage.toLowerCase();

  // 计算每个 profile 的匹配分数
  var scores = {};
  var profileNames = Object.keys(MODEL_PROFILES);
  for (var i = 0; i < profileNames.length; i++) {
    var profileName = profileNames[i];
    var config = MODEL_PROFILES[profileName];
    var score = 0;
    for (var j = 0; j < config.keywords.length; j++) {
      if (msg.includes(config.keywords[j])) {
        score++;
      }
    }
    scores[profileName] = score;
  }

  // 选择得分最高的 profile，默认 casual
  var bestProfile = 'casual';
  var bestScore = 0;
  for (var k = 0; k < profileNames.length; k++) {
    var pName = profileNames[k];
    if (scores[pName] > bestScore) {
      bestScore = scores[pName];
      bestProfile = pName;
    }
  }

  var selected = MODEL_PROFILES[bestProfile];

  return {
    model: selected.models[0],
    maxTokens: selected.maxTokens,
    profile: bestProfile,
    fallbacks: selected.models.slice(1)
  };
}

/**
 * 带降级的 API 调用
 * @param {Object} route - routeToModel 的返回值
 * @param {Array} messages - 消息列表
 * @param {Function} callAPI - 实际的 API 调用函数 (model, messages, maxTokens) => Promise<response>
 * @returns {Promise<{ success: boolean, model?: string, response?: *, error?: string }>}
 */
async function callWithFallback(route, messages, callAPI) {
  if (typeof callAPI !== 'function') {
    return { success: false, error: 'callAPI 函数未提供' };
  }

  var models = [route.model].concat(route.fallbacks || []);

  for (var i = 0; i < models.length; i++) {
    var model = models[i];
    try {
      var response = await callAPI(model, messages, route.maxTokens);
      return { success: true, model: model, response: response };
    } catch (err) {
      console.warn('[model-router] Model ' + model + ' failed, trying next... ' + (err.message || ''));
      continue;
    }
  }

  return { success: false, error: '所有模型均不可用，请稍后重试。' };
}

module.exports = {
  routeToModel: routeToModel,
  callWithFallback: callWithFallback,
  MODEL_PROFILES: MODEL_PROFILES
};
