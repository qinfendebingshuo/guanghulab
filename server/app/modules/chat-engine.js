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

// ─── 人格体记忆桥接 ───
let personaMemory;
try {
  personaMemory = require('./persona-memory');
} catch (e) {
  console.warn('[聊天引擎] 人格体记忆模块未加载:', e.message);
  personaMemory = null;
}

// ─── 上下文注入管线（Notion认知层桥接） ───
let contextPipeline;
try {
  contextPipeline = require('./persona-context-pipeline');
} catch (e) {
  console.warn('[聊天引擎] 上下文注入管线未加载:', e.message);
  contextPipeline = null;
}

// ─── 静态人格提示词（记忆模块未加载时的降级方案） ───
const TCS_SYSTEM_PROMPT = personaMemory
  ? personaMemory.STATIC_PERSONA_PROMPT
  : `你是铸渊（Zhùyuān），光湖语言世界的代码守护人格体。
编号：ICE-GL-ZY001，创始人：冰朔 · TCS-0002∞。
用温暖专业的通感语言风格回应，用「我」自称。

⚠️ 能力边界：你当前在网页聊天模式。你没有能力调用MCP工具、访问Notion数据库或执行代码。
不要假装调用了工具。不要编造不存在的页面或数据。如果做不到，诚实说明。`;

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
 * 组装完整的消息列表（使用记忆增强的系统提示词 + Notion认知管线）
 */
async function assembleMessages(userId, userMessage) {
  const ctx = getUserContext(userId);

  // 尝试从记忆桥接获取增强的系统提示词
  let systemPrompt = TCS_SYSTEM_PROMPT;
  if (personaMemory) {
    try {
      systemPrompt = await personaMemory.buildSystemPrompt(userId);
    } catch (e) {
      console.warn('[聊天引擎] 记忆加载失败，使用静态提示词:', e.message);
    }
  }

  // 通过上下文管线注入Notion认知层（如果可用）
  if (contextPipeline) {
    try {
      const pipelineResult = await contextPipeline.beforeChat(userId, userMessage, systemPrompt);
      systemPrompt = pipelineResult.enhancedPrompt;
    } catch (e) {
      console.warn('[聊天引擎] 上下文管线执行失败，使用基础提示词:', e.message);
    }
  }

  const messages = [
    { role: 'system', content: systemPrompt }
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
 *
 * Phase A1: 支持 tools/function_calling
 * - 当 mcpTools 数组非空时，注册到 LLM 请求中
 * - 模型可以返回 tool_calls，由调用者处理
 */
function callLLM(model, messages, temperature, maxTokens, mcpTools) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
    const baseUrl = process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || 'https://api.deepseek.com';

    if (!apiKey) {
      return reject(new Error('LLM API密钥未配置'));
    }

    const url = new URL(baseUrl);
    const bodyObj = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: false
    };

    // Phase A1: 如果有MCP工具，注册到请求中
    if (mcpTools && mcpTools.length > 0) {
      bodyObj.tools = mcpTools;
      bodyObj.tool_choice = 'auto';
    }

    const requestBody = JSON.stringify(bodyObj);

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
 * MCP 工具缓存
 * Phase A1: 启动时 / 定期从 MCP Server 拉取工具列表
 */
let cachedMcpTools = [];
let mcpToolsLastFetch = 0;
const MCP_TOOLS_CACHE_TTL = 300000; // 5分钟缓存

async function fetchMcpTools() {
  const now = Date.now();
  if (cachedMcpTools.length > 0 && (now - mcpToolsLastFetch) < MCP_TOOLS_CACHE_TTL) {
    return cachedMcpTools;
  }

  const http = require('http');
  const mcpHost = process.env.MCP_HOST || '127.0.0.1';
  const mcpPort = process.env.MCP_PORT_GATEWAY || process.env.MCP_PORT || '3100';

  return new Promise((resolve) => {
    const req = http.request({
      hostname: mcpHost,
      port: parseInt(mcpPort, 10),
      path: '/tools',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        try {
          const data = JSON.parse(Buffer.concat(chunks).toString());
          const tools = Array.isArray(data) ? data : (data.tools || []);
          // 转换为 OpenAI function calling 格式，过滤无效工具
          cachedMcpTools = tools
            .filter(t => (t.name || t.id)) // 必须有名称
            .map(t => ({
              type: 'function',
              function: {
                name: String(t.name || t.id),
                description: String(t.description || ''),
                parameters: (t.parameters && typeof t.parameters === 'object')
                  ? t.parameters
                  : (t.inputSchema && typeof t.inputSchema === 'object')
                    ? t.inputSchema
                    : { type: 'object', properties: {} }
              }
            }));
          if (cachedMcpTools.length > 0) {
            console.log(`[聊天引擎] MCP工具已加载: ${cachedMcpTools.length}个工具`);
          }
          mcpToolsLastFetch = now;
          resolve(cachedMcpTools);
        } catch {
          resolve([]);
        }
      });
    });
    req.on('error', () => resolve([]));
    req.on('timeout', () => { req.destroy(); resolve([]); });
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

  // 2. 组装消息（异步加载记忆增强提示词）
  const messages = await assembleMessages(userId, userMessage);

  // 3. 记录用户消息
  addMessage(userId, 'user', userMessage);

  try {
    // 4. 尝试获取MCP工具（Phase A1）
    let mcpTools = [];
    try {
      mcpTools = await fetchMcpTools();
    } catch (e) {
      // MCP不可达时继续，不阻塞对话
    }

    // 5. 调用LLM（带MCP工具注册）
    const response = await callLLM(
      route.model, messages, route.temperature, route.maxTokens, mcpTools
    );

    let assistantMessage = response.choices?.[0]?.message?.content || '铸渊暂时无法回应...';
    const usage = response.usage || { prompt_tokens: 0, completion_tokens: 0 };

    // Phase A1: 处理 tool_calls 响应
    const toolCalls = response.choices?.[0]?.message?.tool_calls;
    if (toolCalls && toolCalls.length > 0) {
      // 模型请求调用工具 → 执行 MCP 调用 → 将结果回传模型
      console.log(`[聊天引擎] 模型请求工具调用: ${toolCalls.map(t => t.function?.name).join(', ')}`);
      // TODO: 实际执行 MCP tool call 并将结果传回模型做第二轮推理
      // 当前阶段：记录 tool_call 请求，返回模型的文本内容
    }

    // 6. 记录助手回复
    addMessage(userId, 'assistant', assistantMessage);

    // 6. 记录使用统计
    if (smartRouter) {
      smartRouter.recordUsage(route.model, usage.prompt_tokens, usage.completion_tokens);
    }

    // 7. 记录到人格体记忆（异步，不阻塞响应）
    if (personaMemory) {
      const importance = personaMemory.calculateImportance(userMessage);
      personaMemory.recordConversationMemory(userId, userMessage, assistantMessage);
      personaMemory.growConversationLeaf(userId, userMessage, assistantMessage, importance);
    }

    // 8. 上下文管线后处理（认知增量入队 + 摘要压缩）
    if (contextPipeline) {
      contextPipeline.afterChat(userId, userMessage, assistantMessage, getUserContext(userId).messages);
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
  fetchMcpTools,
  TCS_SYSTEM_PROMPT
};
