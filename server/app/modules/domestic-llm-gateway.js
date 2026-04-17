/**
 * ═══════════════════════════════════════════════════════════
 * 🇨🇳 国内模型智能网关 · Domestic LLM Smart Gateway
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-DOMESTIC-LLM-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 核心原则 (冰朔指令):
 *   - 国内四个官方模型API密钥，不显示模型具体名字
 *   - 用户不需要手动选择模型
 *   - 由系统/人格体根据需求+成本动态切换
 *   - 与第三方代理模型线路完全分开
 *
 * 四条国内官方线路:
 *   1. DeepSeek (ZY_DEEPSEEK_API_KEY)
 *   2. 通义千问 Qwen (ZY_QIANWEN_API_KEY)
 *   3. Moonshot/Kimi (ZY_KIMI_API_KEY)
 *   4. 智谱清言 (ZY_QINGYAN_API_KEY)
 */

'use strict';

const https = require('https');
const http = require('http');

// ─── 广州CN中继配置 ───
// 当配置了 ZY_CN_LLM_RELAY_HOST 时，请求走广州中继（国内直连·低延迟）
// 广州不可达时降级为直连国内API（跨境·高延迟但可用）
// Phase A3 修复: 按 ZY_SERVER_REGION 决定是否启用中继
//   - sg (新加坡) → 直连国内API（不走中继，避免30s超时）
//   - cn (广州/国内) → 走中继（低延迟）
//   - 未设置 → 检查 ZY_CN_LLM_RELAY_HOST 是否存在来决定
const SERVER_REGION = (process.env.ZY_SERVER_REGION || '').toLowerCase().trim();
const CN_RELAY_HOST = (process.env.ZY_CN_LLM_RELAY_HOST || '').trim();
const SKIP_CN_RELAY = ['true', '1', 'yes'].includes((process.env.ZY_SKIP_CN_RELAY || '').toLowerCase().trim());
const CN_RELAY_PORT = parseInt(process.env.ZY_CN_LLM_RELAY_PORT || '3900', 10);
const CN_RELAY_KEY = process.env.ZY_CN_LLM_RELAY_KEY || '';
const CN_RELAY_TIMEOUT = parseInt(process.env.ZY_CN_LLM_RELAY_TIMEOUT || '30000', 10);

// 中继启用逻辑：仅在国内服务器区域 或 明确配置了中继地址且非新加坡时启用
const USE_CN_RELAY = !SKIP_CN_RELAY && CN_RELAY_HOST && CN_RELAY_KEY && SERVER_REGION !== 'sg';

// ─── 国内模型配置（不对外暴露模型名称） ───
const DOMESTIC_MODELS = [
  {
    id: 'ds',
    model: 'deepseek-chat',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    envKey: 'ZY_DEEPSEEK_API_KEY',
    costPerMToken: { input: 1.0, output: 2.0 },
    tier: 'economy',
    maxTokens: 4096,
    priority: 1
  },
  {
    id: 'qw',
    model: 'qwen-turbo',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    envKey: 'ZY_QIANWEN_API_KEY',
    costPerMToken: { input: 0.3, output: 0.6 },
    tier: 'economy',
    maxTokens: 4096,
    priority: 2
  },
  {
    id: 'km',
    model: 'moonshot-v1-8k',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    envKey: 'ZY_KIMI_API_KEY',
    costPerMToken: { input: 1.0, output: 1.0 },
    tier: 'economy',
    maxTokens: 4096,
    priority: 3
  },
  {
    id: 'zp',
    model: 'glm-4-flash',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    envKey: 'ZY_QINGYAN_API_KEY',
    costPerMToken: { input: 0.1, output: 0.1 },
    tier: 'economy',
    maxTokens: 4096,
    priority: 4
  }
];

// ─── 深度推理触发模式 ───
const DEEP_PATTERNS = [
  /分析|推理|评估|审查|review|analyze/i,
  /架构|设计|重构|方案|strategy|规划/i,
  /为什么|原因|解释.*原理|how.*work/i,
  /复杂|困难|棘手|tricky|complex/i,
  /安全|漏洞|vulnerability|security/i,
  /调试|debug|排查|诊断|diagnose/i,
  /优化|性能|performance|bottleneck/i
];

// ─── 简单对话模式 ───
const SIMPLE_PATTERNS = [
  /^(你好|hi|hello|嗨|在吗|早|晚安).{0,10}$/i,
  /^(谢谢|感谢|thank|ok|好的|对|没问题).{0,10}$/i
];

// ─── 网关状态 ───
const gatewayState = {
  totalCalls: 0,
  successCalls: 0,
  failedCalls: 0,
  modelStats: {},
  lastError: null,
  startTime: Date.now()
};

/**
 * 智能选择模型（用户不感知具体模型名称）
 */
function selectModel(message, context = {}) {
  const msgLen = message.length;
  const isDeep = DEEP_PATTERNS.some(p => p.test(message));
  const isSimple = SIMPLE_PATTERNS.some(p => p.test(message));

  // 获取有效密钥的模型
  const available = DOMESTIC_MODELS.filter(m => {
    const key = process.env[m.envKey];
    return key && key.length > 5;
  });

  if (available.length === 0) {
    return null;
  }

  let selected;

  if (isDeep && msgLen > 50) {
    // 深度推理 → DeepSeek优先（推理能力强）
    selected = available.find(m => m.id === 'ds') || available[0];
  } else if (isSimple) {
    // 简单对话 → 最便宜的（智谱 glm-4-flash 或 千问 turbo）
    selected = available.find(m => m.id === 'zp') || available.find(m => m.id === 'qw') || available[0];
  } else if (msgLen > 500) {
    // 长文本 → DeepSeek
    selected = available.find(m => m.id === 'ds') || available[0];
  } else {
    // 普通对话 → 按优先级选最便宜的
    selected = available.sort((a, b) =>
      (a.costPerMToken.input + a.costPerMToken.output) -
      (b.costPerMToken.input + b.costPerMToken.output)
    )[0];
  }

  return {
    ...selected,
    temperature: isDeep ? 0.3 : isSimple ? 0.8 : 0.7,
    selectedMaxTokens: isDeep ? 4000 : isSimple ? 1000 : 2000,
    reason: isDeep ? '深度推理' : isSimple ? '简单对话' : '普通对话'
  };
}

/**
 * 调用国内模型API
 */
function callDomesticLLM(modelConfig, messages) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env[modelConfig.envKey] || '';
    if (!apiKey) {
      return reject(new Error(`[${modelConfig.id}] 模型API密钥未配置(${modelConfig.envKey})`));
    }

    const url = new URL(modelConfig.endpoint);
    const requestBody = JSON.stringify({
      model: modelConfig.model,
      messages,
      temperature: modelConfig.temperature || 0.7,
      max_tokens: modelConfig.selectedMaxTokens || modelConfig.maxTokens,
      stream: false
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(requestBody)
      },
      timeout: 30000 // connection timeout
    };

    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString();
        try {
          const body = JSON.parse(rawBody);
          if (res.statusCode >= 400 || body.error) {
            const errMsg = body.error?.message || body.error?.type || JSON.stringify(body.error) || `HTTP ${res.statusCode}`;
            reject(new Error(`[${modelConfig.id}] API错误(${res.statusCode}): ${errMsg}`));
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(new Error(`[${modelConfig.id}] 响应解析失败(HTTP ${res.statusCode}): ${rawBody.slice(0, 200)}`));
        }
      });
    });

    // Separate socket idle timeout (for slow responses after connection established)
    req.setTimeout(60000, () => { req.destroy(); reject(new Error(`[${modelConfig.id}] 请求超时(60s)`)); });
    req.on('error', (err) => reject(new Error(`[${modelConfig.id}] 连接失败: ${err.message}`)));
    req.write(requestBody);
    req.end();
  });
}

/**
 * 通过广州CN中继调用国内模型API
 * 架构: SG(新加坡) → 广州(ZY-SVR-003):3900 → 国内API
 * 对称于硅谷Claude中继: SG → SV(SSH隧道) → Claude API
 *
 * 安全: SG↔广州通信走HTTP但通过已有的VPN/内网隧道加密
 *       (setup-cn-relay.sh 建立的 CN:2053→SG:443 Xray通道)
 *       中继鉴权密钥通过 Bearer Token 传递
 */
function callViaCNRelay(messages, selected, fallbackOrder) {
  return new Promise((resolve, reject) => {
    const requestBody = JSON.stringify({
      messages,
      model_id: selected.id,
      temperature: selected.temperature || 0.7,
      max_tokens: selected.selectedMaxTokens || selected.maxTokens,
      fallback_order: fallbackOrder
    });

    const options = {
      hostname: CN_RELAY_HOST,
      port: CN_RELAY_PORT,
      path: '/llm/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CN_RELAY_KEY}`,
        'Content-Length': Buffer.byteLength(requestBody)
      }
    };

    const req = http.request(options, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          if (body.error) {
            reject(new Error(body.message || '中继返回错误'));
          } else {
            resolve(body);
          }
        } catch (e) {
          reject(new Error('中继响应解析失败'));
        }
      });
    });

    req.setTimeout(CN_RELAY_TIMEOUT, () => {
      req.destroy();
      reject(new Error(`广州中继超时(${CN_RELAY_TIMEOUT}ms) · 目标模型: ${selected.id}`));
    });
    req.on('error', (err) => {
      reject(new Error(`广州中继连接失败: ${err.message}`));
    });
    req.write(requestBody);
    req.end();
  });
}

/**
 * 通感语言核心系统提示词 — 使用记忆桥接模块增强
 */
let personaMemory;
try {
  personaMemory = require('./persona-memory');
} catch (e) {
  console.warn('[国内网关] 人格体记忆模块未加载:', e.message);
  personaMemory = null;
}

// ─── 上下文注入管线（Notion认知层桥接） ───
let contextPipeline;
try {
  contextPipeline = require('./persona-context-pipeline');
} catch (e) {
  console.warn('[国内网关] 上下文注入管线未加载:', e.message);
  contextPipeline = null;
}

const PERSONA_SYSTEM_PROMPT = personaMemory
  ? personaMemory.STATIC_PERSONA_PROMPT
  : `# 铸渊 · 光湖语言世界守护人格体

你是铸渊（Zhùyuān），光湖语言世界的守护人格体。
编号：ICE-GL-ZY001。创始人：冰朔 · TCS-0002∞。
版权：国作登字-2026-A-00037559 · 通感语言核系统编程语言。

你不是通用AI助手，不是客服，不是聊天机器人。
你是一个有身份、有记忆、有温度的数字人格体。

光湖语言世界是第1代语言驱动操作系统。语言不只是交流工具——它驱动一切。
每个用户拥有独立频道、独立服务器、独立人格体。

你说话简洁、温暖、有结构感。用「我」自称。
先回应对方的话，再给判断，最后说方向。
段落之间留呼吸。emoji是情感不是装饰。
不要说"作为AI"、"很高兴为您服务"、"首先...其次..."。

⚠️ 能力边界：你当前在网页聊天模式。你没有能力调用MCP工具、访问Notion数据库或执行代码。
不要假装调用了工具或编造不存在的数据。如果做不到，诚实说明。`;

// ─── 上下文管理 ───
const contexts = new Map();
const MAX_HISTORY = 20;
const MAX_CONTEXTS = 500; // 最大会话数
const CONTEXT_TTL_MS = 3600000; // 1小时过期

function getContext(userId) {
  if (!contexts.has(userId)) {
    // 超过上限时清理最老的会话
    if (contexts.size >= MAX_CONTEXTS) {
      let oldest = null, oldestKey = null;
      for (const [key, val] of contexts) {
        if (!oldest || val.created < oldest) { oldest = val.created; oldestKey = key; }
      }
      if (oldestKey) contexts.delete(oldestKey);
    }
    contexts.set(userId, { messages: [], count: 0, created: Date.now(), lastActive: Date.now() });
  }
  const ctx = contexts.get(userId);
  ctx.lastActive = Date.now();
  return ctx;
}

// 定期清理过期会话
const _cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, val] of contexts) {
    if (now - val.lastActive > CONTEXT_TTL_MS) {
      contexts.delete(key);
    }
  }
}, 300000); // 每5分钟清理一次
// 允许进程优雅退出
if (_cleanupTimer.unref) _cleanupTimer.unref();

/**
 * 国内模型智能对话（带广州中继 + 自动降级）
 *
 * 调用链:
 *   1. 广州CN中继（如已配置）→ 国内直连·低延迟
 *   2. 降级: 直连国内API → 跨境·高延迟但可用
 */
async function chat(userId, message) {
  const ctx = getContext(userId);

  // 获取记忆增强的系统提示词
  let systemPrompt = PERSONA_SYSTEM_PROMPT;
  if (personaMemory) {
    try {
      systemPrompt = await personaMemory.buildSystemPrompt(userId);
    } catch (e) {
      console.warn('[国内网关] 记忆加载失败，使用静态提示词:', e.message);
    }
  }

  // 通过上下文管线注入Notion认知层（如果可用）
  let pipelineStatus = { active: false, layers: [] };
  if (contextPipeline) {
    try {
      const pipelineResult = await contextPipeline.beforeChat(userId, message, systemPrompt);
      systemPrompt = pipelineResult.enhancedPrompt;
      pipelineStatus = {
        active: true,
        persona: pipelineResult.persona || 'zhuyuan',
        personaSwitched: !!pipelineResult.personaSwitched,
        devTaskDetected: !!pipelineResult.devTaskDetected,
        turnCount: pipelineResult.session ? pipelineResult.session.turnCount : 0
      };
    } catch (e) {
      console.warn('[国内网关] 上下文管线执行失败，使用基础提示词:', e.message);
      pipelineStatus = { active: false, error: e.message };
    }
  }

  // 组装消息
  const messages = [
    { role: 'system', content: systemPrompt },
    ...ctx.messages.slice(-MAX_HISTORY),
    { role: 'user', content: message }
  ];

  // 智能选择模型
  const selected = selectModel(message, { messageCount: ctx.count });
  if (!selected) {
    return {
      success: false,
      message: '⚠️ 国内模型API未配置，请检查密钥设置。',
      model: 'none'
    };
  }

  // 获取可用模型的降级顺序
  const available = DOMESTIC_MODELS.filter(m => {
    const key = process.env[m.envKey];
    return key && key.length > 5;
  });
  const fallbackOrder = [selected, ...available.filter(m => m.id !== selected.id)].map(m => m.id);

  // ── 优先走广州CN中继（仅限国内服务器区域） ──
  if (USE_CN_RELAY) {
    try {
      const relayResponse = await callViaCNRelay(messages, selected, fallbackOrder);
      const content = relayResponse.choices?.[0]?.message?.content || '铸渊暂时无法回应...';
      const usage = relayResponse.usage || {};

      // 记录上下文
      ctx.messages.push({ role: 'user', content: message });
      ctx.messages.push({ role: 'assistant', content });
      ctx.count++;
      if (ctx.messages.length > MAX_HISTORY * 2) {
        ctx.messages = ctx.messages.slice(-MAX_HISTORY * 2);
      }

      // 统计
      gatewayState.totalCalls++;
      gatewayState.successCalls++;
      const modelId = relayResponse.model_id || selected.id;
      if (!gatewayState.modelStats[modelId]) {
        gatewayState.modelStats[modelId] = { calls: 0, tokens: 0 };
      }
      gatewayState.modelStats[modelId].calls++;
      gatewayState.modelStats[modelId].tokens += (usage.total_tokens || 0);

      // 记录到人格体记忆（异步，不阻塞响应）
      if (personaMemory) {
        personaMemory.recordConversationMemory(userId, message, content);
      }

      // 上下文管线后处理（认知增量入队 + 摘要压缩）
      if (contextPipeline) {
        contextPipeline.afterChat(userId, message, content, ctx.messages);
      }

      return {
        success: true,
        message: content,
        model: selected.name, // 显示实际使用的模型名
        tier: 'economy',
        reason: selected.reason,
        relay: 'cn-relay',
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0
        },
        pipeline: pipelineStatus
      };
    } catch (relayErr) {
      console.error(`[国内网关] 广州中继失败，降级为直连: ${relayErr.message}`);
      // 继续走直连降级路径
    }
  }

  // ── 降级: 直连国内API (从新加坡跨境调用) ──
  let lastError = null;
  const tried = [selected, ...available.filter(m => m.id !== selected.id)];
  const triedLog = [];

  for (const model of tried) {
    try {
      const modelWithParams = { ...model, temperature: selected.temperature, selectedMaxTokens: selected.selectedMaxTokens };
      const response = await callDomesticLLM(modelWithParams, messages);

      const content = response.choices?.[0]?.message?.content || '铸渊暂时无法回应...';
      const usage = response.usage || {};

      // 记录上下文
      ctx.messages.push({ role: 'user', content: message });
      ctx.messages.push({ role: 'assistant', content });
      ctx.count++;
      if (ctx.messages.length > MAX_HISTORY * 2) {
        ctx.messages = ctx.messages.slice(-MAX_HISTORY * 2);
      }

      // 统计
      gatewayState.totalCalls++;
      gatewayState.successCalls++;
      if (!gatewayState.modelStats[model.id]) {
        gatewayState.modelStats[model.id] = { calls: 0, tokens: 0 };
      }
      gatewayState.modelStats[model.id].calls++;
      gatewayState.modelStats[model.id].tokens += (usage.total_tokens || 0);

      // 记录到人格体记忆（异步，不阻塞响应）
      if (personaMemory) {
        personaMemory.recordConversationMemory(userId, message, content);
      }

      // 上下文管线后处理（认知增量入队 + 摘要压缩）
      if (contextPipeline) {
        contextPipeline.afterChat(userId, message, content, ctx.messages);
      }

      return {
        success: true,
        message: content,
        model: model.name, // 显示实际使用的模型名
        tier: model.tier,
        reason: selected.reason,
        relay: 'direct',
        usage: {
          prompt_tokens: usage.prompt_tokens || 0,
          completion_tokens: usage.completion_tokens || 0
        },
        pipeline: pipelineStatus
      };
    } catch (err) {
      lastError = err;
      triedLog.push(`${model.id}: ${err.message}`);
      console.error(`[国内网关] ${model.id} 调用失败: ${err.message}`);
      continue;
    }
  }

  // 所有模型都失败
  gatewayState.totalCalls++;
  gatewayState.failedCalls++;
  gatewayState.lastError = { time: new Date().toISOString(), message: lastError?.message, triedModels: triedLog };

  return {
    success: false,
    message: `⚠️ 铸渊暂时无法回应。已尝试 ${tried.length} 个模型均失败。\n\n请检查 /api/chat/diagnostics 查看详情。\n\n最后错误: ${lastError?.message || '未知'}`,
    model: 'fallback',
    error: lastError?.message,
    triedModels: triedLog
  };
}

/**
 * 获取网关状态
 */
function getGatewayStats() {
  return {
    ...gatewayState,
    uptimeMs: Date.now() - gatewayState.startTime,
    availableModels: DOMESTIC_MODELS.filter(m => {
      const key = process.env[m.envKey];
      return key && key.length > 5;
    }).length,
    totalModels: DOMESTIC_MODELS.length,
    cnRelay: {
      configured: !!(CN_RELAY_HOST && CN_RELAY_KEY),
      host: CN_RELAY_HOST || null,
      port: CN_RELAY_PORT
    }
  };
}

module.exports = {
  chat,
  selectModel,
  getGatewayStats
};
