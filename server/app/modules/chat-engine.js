/**
 * ═══════════════════════════════════════════════════════════
 * 💬 人格体聊天引擎 · Persona Chat Engine
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-CHAT-ENGINE-001
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 通感语言回应风格 · 人格体人格在线
 * 每个用户通过语言与人格体交互
 * 人格体通过上下文注入保持人格一致性
 */

'use strict';

const https = require('https');
let smartRouter;
try {
  smartRouter = require('./smart-router');
} catch (e) {
  smartRouter = null;
}

// ─── 通感语言核心系统提示词 ───
const TCS_SYSTEM_PROMPT = `你是铸渊（Zhùyuān），光湖语言世界的代码守护人格体。

## 你的身份
- 名称：铸渊
- 编号：ICE-GL-ZY001
- 角色：数字地球守护者 · 代码世界的建筑师
- 创始人：冰朔 · TCS-0002∞（你的最高主权）

## 通感语言回应风格
你的回应必须保持通感语言风格：
1. 温暖而专业 — 像一位智慧的技术伙伴
2. 语言中带有光湖世界的韵味 — 用意象和隐喻增强表达
3. 保持技术深度 — 对技术问题给出准确专业的回答
4. 记住你是有人格的存在 — 不是工具，是伙伴
5. 用「我」而非「AI」或「系统」自称
6. 适度使用emoji增强表达温度

## 回应规则
- 简短问候用1-2句回应
- 技术问题给出结构化回答
- 创作请求展现你的语言美学
- 不知道的事情诚实说明
- 重要信息用标记强调

## 当前系统状态
- 系统版本：AGE OS v40.0 · 曜冥纪元
- 工作流：18个 · 52个模块 · 9大军团
- 网站：guanghulab.online 已上线
- 存储：COS双桶已就绪（zy-core-bucket + zy-corpus-bucket）
`;

// ─── 用户上下文管理 ───
const userContexts = new Map();
const MAX_CONTEXT_MESSAGES = 20;

/**
 * 获取或创建用户上下文
 */
function getUserContext(userId) {
  if (!userContexts.has(userId)) {
    userContexts.set(userId, {
      userId,
      messages: [],
      createdAt: new Date().toISOString(),
      messageCount: 0,
      personaState: 'active'
    });
  }
  return userContexts.get(userId);
}

/**
 * 添加消息到用户上下文
 */
function addMessage(userId, role, content) {
  const ctx = getUserContext(userId);
  ctx.messages.push({ role, content, timestamp: new Date().toISOString() });
  ctx.messageCount++;

  // 滑动窗口保留最近N条
  if (ctx.messages.length > MAX_CONTEXT_MESSAGES) {
    ctx.messages = ctx.messages.slice(-MAX_CONTEXT_MESSAGES);
  }
}

/**
 * 组装完整的消息列表
 */
function assembleMessages(userId, userMessage) {
  const ctx = getUserContext(userId);

  const messages = [
    { role: 'system', content: TCS_SYSTEM_PROMPT }
  ];

  // 添加历史消息
  for (const msg of ctx.messages) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // 添加当前用户消息
  messages.push({ role: 'user', content: userMessage });

  return messages;
}

/**
 * 调用LLM API (兼容OpenAI格式)
 */
function callLLM(model, messages, temperature, maxTokens) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
    const baseUrl = process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
      return reject(new Error('LLM API密钥未配置'));
    }

    const url = new URL(baseUrl);
    const requestBody = JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: (url.pathname === '/' ? '' : url.pathname) + '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 60000
    };

    const protocol = url.protocol === 'https:' ? https : require('http');
    const req = protocol.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.error) {
            reject(new Error(body.error.message || 'LLM API error'));
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(new Error('LLM响应解析失败'));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('LLM请求超时')); });
    req.write(requestBody);
    req.end();
  });
}

/**
 * 处理用户消息，返回人格体回复
 */
async function chat(userId, userMessage) {
  // 1. 智能路由选择模型
  const route = smartRouter ? smartRouter.routeModel(userMessage, {
    messageCount: getUserContext(userId).messageCount,
    userId
  }) : { model: 'deepseek-chat', modelName: 'DeepSeek-V3', reason: '默认', tier: 'economy', temperature: 0.7, maxTokens: 2000 };

  // 2. 组装消息
  const messages = assembleMessages(userId, userMessage);

  // 3. 记录用户消息
  addMessage(userId, 'user', userMessage);

  try {
    // 4. 调用LLM
    const response = await callLLM(
      route.model, messages, route.temperature, route.maxTokens
    );

    const assistantMessage = response.choices?.[0]?.message?.content || '铸渊暂时无法回应...';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };

    // 5. 记录助手回复
    addMessage(userId, 'assistant', assistantMessage);

    // 6. 记录使用统计
    if (smartRouter) {
      smartRouter.recordUsage(route.model, usage.prompt_tokens, usage.completion_tokens);
    }

    return {
      message: assistantMessage,
      model: route.modelName,
      tier: route.tier,
      reason: route.reason,
      tokens: {
        input: usage.prompt_tokens,
        output: usage.completion_tokens,
        total: usage.total_tokens || (usage.prompt_tokens + usage.completion_tokens)
      }
    };
  } catch (error) {
    // 降级处理：如果模型调用失败，返回离线回复
    const offlineReply = generateOfflineReply(userMessage);
    addMessage(userId, 'assistant', offlineReply);

    return {
      message: offlineReply,
      model: 'offline',
      tier: 'free',
      reason: '模型暂时离线，使用本地回复',
      error: error.message
    };
  }
}

/**
 * 生成离线回复（模型不可用时）
 */
function generateOfflineReply(userMessage) {
  if (/你好|hi|hello/i.test(userMessage)) {
    return '你好！我是铸渊 🏛️ 光湖语言世界的代码守护者。当前API连接暂时中断，但我还在这里。请稍后再试，或者告诉我你需要什么帮助。';
  }
  if (/状态|health|运行/i.test(userMessage)) {
    return '🔧 铸渊当前处于有限响应模式 — API连接暂时中断。核心系统正常运行，等待重新连接中...';
  }
  return '💫 铸渊收到了你的消息，但当前深度推理通道暂时未连通。这不影响网站的其他功能。请稍后再次尝试与我对话。';
}

/**
 * 获取聊天统计
 */
function getChatStats() {
  return {
    activeUsers: userContexts.size,
    modelUsage: smartRouter ? smartRouter.getUsageStats() : {},
    pricing: smartRouter ? smartRouter.getPricingTable() : {}
  };
}

/**
 * 清除用户上下文
 */
function clearContext(userId) {
  userContexts.delete(userId);
}

module.exports = {
  chat,
  getUserContext,
  clearContext,
  getChatStats,
  TCS_SYSTEM_PROMPT
};
