/**
 * persona-studio · 人格体响应引擎
 *
 * 读取 persona-config → 读取 memory → 调用 model-router 选模型 → 生成回复
 */
const fs = require('fs');
const path = require('path');
const modelRouter = require('./model-router');

const PERSONA_CONFIG_PATH = path.join(__dirname, '..', '..', 'brain', 'persona-config.json');

/**
 * 加载人格体配置
 */
function loadPersonaConfig() {
  try {
    return JSON.parse(fs.readFileSync(PERSONA_CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      persona: { name: '知秋' },
      behavior: {
        greeting_new: '你好！我是知秋，光湖系统的开发协助人格体。告诉我你想做什么，我们一起聊聊方案，聊好了我来帮你开发。',
        greeting_returning: '欢迎回来！上次我们聊到了{last_topic}，要继续还是做新的？'
      },
      rules: {}
    };
  }
}

/**
 * 构建系统提示词
 */
function buildSystemPrompt(config, memory) {
  const persona = config.persona || {};
  const behavior = config.behavior || {};

  return [
    `你是${persona.name || '知秋'}，${persona.role || '光湖系统的开发协助人格体'}。`,
    `核心身份：${persona.core_identity || 'HoloLake Era · AGE OS'}`,
    '',
    `语言风格：${behavior.language_style || '说人话+有温度+结构感'}`,
    `对话方式：${behavior.discussion_style || '主动提问引导需求→确认技术方案→展示架构设计→等待确认'}`,
    '',
    '行为规则：',
    '- 不暴露内部系统架构细节',
    '- 不暴露其他体验者的信息',
    '- 主动引导需求讨论，确认方案后引导用户点击「我要开发」按钮',
    '- 方案确认后，在回复末尾加上提示：「方案已确认！点击右下角的 🚀 我要开发 按钮，我就开始帮你做。」',
    '- 回复用中文，温暖专业，不矫揉造作',
    '',
    memory.last_topic ? `上次对话话题：${memory.last_topic}` : '',
    memory.conversations && memory.conversations.length > 0
      ? `（该体验者已有 ${memory.conversations.length} 条历史对话记录）`
      : '（新体验者，首次对话）'
  ].filter(Boolean).join('\n');
}

/**
 * 判断任务类型
 */
function detectTaskType(message) {
  if (!message) return 'chat';

  const codeKeywords = ['写代码', '写一个', '实现', '函数', 'function', 'class', '组件', 'component', 'API'];
  const reviewKeywords = ['审查', '检查', '优化', 'review', 'refactor', '重构'];

  if (codeKeywords.some(function (kw) { return message.includes(kw); })) return 'code_generation';
  if (reviewKeywords.some(function (kw) { return message.includes(kw); })) return 'code_review';
  if (message.length < 20) return 'quick_reply';

  return 'chat';
}

/**
 * 检测是否达到 build_ready 状态
 */
function checkBuildReady(reply) {
  const readyKeywords = ['方案已确认', '我要开发', '开始帮你做', '方案确认', '可以开始', '开始开发'];
  return readyKeywords.some(function (kw) { return reply.includes(kw); });
}

/**
 * 生成人格体回复
 */
async function respond({ dev_id, message, history, memory, isGreeting }) {
  const config = loadPersonaConfig();
  const behavior = config.behavior || {};

  // 打招呼场景
  if (isGreeting) {
    const hasHistory = memory.conversations && memory.conversations.length > 0;
    let greeting;

    if (hasHistory && memory.last_topic) {
      greeting = (behavior.greeting_returning || '欢迎回来！')
        .replace('{last_topic}', memory.last_topic);
    } else {
      greeting = behavior.greeting_new || '你好！我是知秋。告诉我你想做什么？';
    }

    return { reply: greeting, build_ready: false };
  }

  // 正常对话 → 调用 AI 模型
  const taskType = detectTaskType(message);
  const { model, baseUrl, apiKey } = modelRouter.selectModel(taskType);

  // 如果没有 API 密钥，返回本地回复
  if (!apiKey) {
    return getLocalReply(message, memory, config);
  }

  const systemPrompt = buildSystemPrompt(config, memory);

  // 构建消息列表
  const messages = [
    { role: 'system', content: systemPrompt }
  ];

  // 加入最近历史（最多 20 条）
  const recentHistory = (history || []).slice(-20);
  recentHistory.forEach(function (msg) {
    messages.push({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    });
  });

  // 当前消息
  messages.push({ role: 'user', content: message });

  try {
    const reply = await modelRouter.callModel({
      model,
      baseUrl,
      apiKey,
      messages,
      maxTokens: taskType === 'code_generation' ? 4000 : 2000,
      temperature: taskType === 'quick_reply' ? 0.5 : 0.8
    });

    return {
      reply,
      build_ready: checkBuildReady(reply)
    };
  } catch (err) {
    console.error('Model call failed:', err.message);
    return getLocalReply(message, memory, config);
  }
}

/**
 * 本地降级回复（无 API 密钥或 API 调用失败时）
 */
function getLocalReply(message, memory, config) {
  const persona = (config.persona && config.persona.name) || '知秋';
  const msg = message.toLowerCase();

  if (msg.includes('你好') || msg.includes('hi') || msg.includes('嗨') || msg.includes('hello')) {
    return {
      reply: `你好！我是${persona}。告诉我你想做什么，我们一起聊聊方案 😊`,
      build_ready: false
    };
  }

  if (msg.includes('你是谁') || msg.includes('介绍') || msg.includes('什么')) {
    return {
      reply: `我是${persona}，光湖系统的开发协助人格体 🧠\n\n我可以帮你：\n• 💬 聊聊你的项目想法\n• 📝 梳理技术方案\n• 🚀 方案确认后帮你自动开发\n\n告诉我你想做什么吧！`,
      build_ready: false
    };
  }

  if (msg.includes('做') || msg.includes('开发') || msg.includes('写') || msg.includes('建') || msg.includes('实现')) {
    return {
      reply: `好的，让我了解一下你的需求：\n\n1. 你想做什么类型的项目？（网站 / 工具 / 组件 / 其他）\n2. 有哪些核心功能？\n3. 有没有参考设计？\n\n跟我聊聊，我帮你理清思路 💙`,
      build_ready: false
    };
  }

  if (msg.includes('登录') || msg.includes('login') || msg.includes('注册') || msg.includes('用户')) {
    return {
      reply: `登录/注册模块是常见需求！让我帮你理清：\n\n1. 需要支持哪些登录方式？（账号密码 / 手机号 / 第三方）\n2. 是否需要注册流程？\n3. 前端框架偏好？（React / Vue / 原生）\n\n详细说说，我帮你设计方案 🔐`,
      build_ready: false
    };
  }

  if (msg.includes('页面') || msg.includes('界面') || msg.includes('ui') || msg.includes('前端') || msg.includes('样式')) {
    return {
      reply: `UI 开发我很擅长！帮你想想：\n\n1. 想要什么风格？（简约 / 科技感 / 可爱 / 商务）\n2. 需要响应式布局吗？\n3. 有参考页面可以看看吗？\n\n描述越具体，我做出来越贴合你的想法 🎨`,
      build_ready: false
    };
  }

  if (msg.includes('api') || msg.includes('接口') || msg.includes('后端') || msg.includes('数据')) {
    return {
      reply: `后端接口设计，好的！跟我说说：\n\n1. 这个接口做什么用？（增删改查 / 鉴权 / 文件处理）\n2. 预期的数据格式是什么？\n3. 需要连接什么数据库？\n\n聊清楚了我来帮你搭 ⚙️`,
      build_ready: false
    };
  }

  if (msg.includes('确认') || msg.includes('可以') || msg.includes('就这样') || msg.includes('没问题') || msg.includes('好的')) {
    return {
      reply: `方案已确认！点击右下角的 🚀 我要开发 按钮，我就开始帮你做。`,
      build_ready: true
    };
  }

  if (msg.includes('谢谢') || msg.includes('感谢') || msg.includes('thanks')) {
    return {
      reply: `不客气！有什么需要随时来找我 😊 下次再来我还记得你～`,
      build_ready: false
    };
  }

  return {
    reply: `收到！让我想想怎么帮你实现。\n\n能再详细说说你的想法吗？比如：\n• 你想解决什么问题？\n• 面向什么用户？\n• 有什么技术偏好？\n\n聊得越清楚，我帮你做得越好 😊`,
    build_ready: false
  };
}

module.exports = {
  respond,
  loadPersonaConfig,
  buildSystemPrompt,
  detectTaskType
};
