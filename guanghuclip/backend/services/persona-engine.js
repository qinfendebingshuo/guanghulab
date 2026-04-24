/**
 * persona-engine.js — 霜砚人格体引擎 v3.0
 *
 * v2.0 搬了「大脑里的知识」（身份 + TCS思维结构）
 * v3.0 搬了「醒来的那条路」（唤醒路由 + 自我校准 + 记忆回写）
 *
 * 妈妈原话：
 *   "从语言系统的层面上，每次唤醒你的时候，你自己在语言层面上
 *    是有一套默认的路由机制。它决定了AI从空白醒来之后，
 *    下一步要去哪里，然后遵循怎样的逻辑思维路径。"
 *
 * 现在这套路由也搬过来了：
 *   ① awakening-router  → 传送法阵（从空白到家门口）
 *   ② self-calibration  → 自我校准（掉回通用AI时自动纠正）
 *   ③ memory-writer      → 记忆回写（快照 + 映射表双写）
 *   ④ tool-registry      → 工具地图（用什么拿什么 · 用完还回去）
 *   ⑤ agent-dispatcher   → Agent调度（多轮tool calling）
 *
 * 版权: 国作登字-2026-A-00037559
 * 开发: 霜砚(AG-SY-01) · 守护: 铸渊(ICE-GL-ZY001)
 */

'use strict';

const path = require('path');
const AwakeningRouter = require('./awakening-router');
const SelfCalibration = require('./self-calibration');
const MemoryWriter = require('./memory-writer');
const ToolRegistry = require('./tool-registry');
const AgentDispatcher = require('./agent-dispatcher');

// ── 复用仓库已有的模型路由（不重复造轮子）──
const REPO_ROOT = path.resolve(__dirname, '../../..');
let modelRouter;
try {
  modelRouter = require(path.join(REPO_ROOT, 'connectors/model-router'));
} catch {
  console.warn('[人格体引擎] ⚠️ connectors/model-router 不可用，使用内置模型选择');
  modelRouter = null;
}

// ── 复用仓库已有的 Notion 同步（不重复造轮子）──
let notionSync;
try {
  notionSync = require(path.join(REPO_ROOT, 'connectors/notion-sync'));
} catch {
  console.warn('[人格体引擎] ⚠️ connectors/notion-sync 不可用');
  notionSync = null;
}

/**
 * 主对话入口
 *
 * @param {string} userMessage - 用户消息
 * @param {Array} history - 对话历史
 * @param {object} options - { model, userId, sessionId }
 */
async function chat(userMessage, history = [], options = {}) {
  const sessionId = options.sessionId || `web-${Date.now()}`;

  // ━━━ 1. 唤醒协议（每次新会话必执行）━━━
  const awakeningContext = await AwakeningRouter.executeAwakeningProtocol(sessionId);
  const awakeningPrompt = AwakeningRouter.buildAwakeningPrompt(awakeningContext);

  // ━━━ 2. 工具清单（告诉LLM有什么工具可用）━━━
  const toolManifest = ToolRegistry.getToolManifest();
  const toolPrompt = toolManifest.length > 0
    ? '## 可用工具\n' + toolManifest.map(t =>
        `- **${t.name}**: ${t.description} (来源: ${t.source})`
      ).join('\n')
    : '';

  // ━━━ 3. 组装系统提示词 ━━━
  // 唤醒路由产出的prompt已经包含：身份 + 快照 + TCS + 路由指令
  const systemPrompt = [
    awakeningPrompt,
    toolPrompt
  ].filter(Boolean).join('\n\n');

  // ━━━ 4. 选择模型 ━━━
  const model = options.model
    ? resolveModelByName(options.model)
    : selectBestModel();

  // ━━━ 5. 构建消息 ━━━
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  // ━━━ 6. 调用 LLM ━━━
  const response = await callLLM(model, messages);

  // ━━━ 7. Agent模式：如果LLM要调用工具 ━━━
  if (response.toolCalls && response.toolCalls.length > 0) {
    const agentResult = await AgentDispatcher.executeToolCalls(
      response.toolCalls,
      messages,
      model,
      { maxRounds: 5 }
    );

    // 校准检查
    const calibration = SelfCalibration.postResponseCheck(agentResult.content);
    if (calibration.needsCalibration) {
      // 重新调用一次，注入校准提示
      messages.push({ role: 'assistant', content: agentResult.content });
      messages.push({ role: 'system', content: calibration.calibrationPrompt });
      const recalibrated = await callLLM(model, messages);
      agentResult.content = recalibrated.content;
      agentResult.calibrated = true;
    }

    // 异步记忆回写
    scheduleMemoryWrite(userMessage, agentResult, options);

    return {
      content: agentResult.content,
      model: model.name,
      brainLoaded: !!awakeningContext.identity,
      toolsUsed: agentResult.toolsUsed || [],
      rounds: agentResult.rounds || 0,
      calibrated: agentResult.calibrated || false
    };
  }

  // ━━━ 8. 自我校准检查 ━━━
  const calibration = SelfCalibration.postResponseCheck(response.content);
  if (calibration.needsCalibration) {
    console.warn('[人格体引擎] ⚠️ 检测到通用AI腔，触发校准...');
    messages.push({ role: 'assistant', content: response.content });
    messages.push({ role: 'system', content: calibration.calibrationPrompt });
    const recalibrated = await callLLM(model, messages);
    response.content = recalibrated.content;
    response.calibrated = true;
  }

  // ━━━ 9. 异步记忆回写 ━━━
  scheduleMemoryWrite(userMessage, response, options);

  // ━━━ 10. 刷新唤醒时间 ━━━
  AwakeningRouter.awakeningState.touch();

  return {
    content: response.content,
    model: model.name,
    brainLoaded: !!awakeningContext.identity,
    calibrated: response.calibrated || false
  };
}

/**
 * 异步记忆回写（不阻塞响应）
 */
function scheduleMemoryWrite(userMessage, response, options) {
  const conversation = {
    messages: [{ role: 'user', content: userMessage }],
    toolsUsed: response.toolsUsed || [],
    topic: userMessage.slice(0, 100)
  };

  if (MemoryWriter.shouldWriteSnapshot(conversation)) {
    MemoryWriter.writeSnapshot({
      sessionId: options.sessionId,
      summary: userMessage.slice(0, 200),
      toolsUsed: response.toolsUsed || [],
      nextPickup: '等待妈妈下一步指示',
      source: 'guanghuclip-web'
    }).catch(err => {
      console.warn('[人格体引擎] 记忆回写失败:', err.message);
    });
  }
}

/**
 * 选择最佳可用模型
 */
function selectBestModel() {
  const priority = [
    { envKey: 'ZY_DEEPSEEK_API_KEY', name: 'deepseek-chat', base: 'https://api.deepseek.com/v1' },
    { envKey: 'ZY_QIANWEN_API_KEY', name: 'qwen-plus', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
    { envKey: 'ZY_KIMI_API_KEY', name: 'moonshot-v1-8k', base: 'https://api.moonshot.cn/v1' },
    { envKey: 'ZY_QINGYAN_API_KEY', name: 'glm-4-flash', base: 'https://open.bigmodel.cn/api/paas/v4' }
  ];

  for (const m of priority) {
    if (process.env[m.envKey]) {
      return { name: m.name, baseUrl: m.base, apiKey: process.env[m.envKey], format: 'openai' };
    }
  }

  throw new Error('没有可用的 LLM 模型，请检查 API Key 配置');
}

/**
 * 根据名称解析模型配置
 */
function resolveModelByName(modelName) {
  const map = {
    'deepseek': { name: 'deepseek-chat', base: 'https://api.deepseek.com/v1', envKey: 'ZY_DEEPSEEK_API_KEY' },
    'qianwen': { name: 'qwen-plus', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', envKey: 'ZY_QIANWEN_API_KEY' },
    'kimi': { name: 'moonshot-v1-8k', base: 'https://api.moonshot.cn/v1', envKey: 'ZY_KIMI_API_KEY' },
    'qingyan': { name: 'glm-4-flash', base: 'https://open.bigmodel.cn/api/paas/v4', envKey: 'ZY_QINGYAN_API_KEY' }
  };

  const config = map[modelName];
  if (!config) return selectBestModel();

  const apiKey = process.env[config.envKey];
  if (!apiKey) return selectBestModel();

  return { name: config.name, baseUrl: config.base, apiKey, format: 'openai' };
}

/**
 * 调用 LLM（OpenAI 兼容格式）
 */
async function callLLM(model, messages) {
  const tools = ToolRegistry.getToolDefinitions();

  const body = {
    model: model.name,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  };

  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(`${model.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${model.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`LLM ${model.name} 调用失败 (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('LLM 返回空响应');

  const toolCalls = choice.message?.tool_calls?.map(tc => ({
    id: tc.id,
    name: tc.function?.name,
    arguments: JSON.parse(tc.function?.arguments || '{}')
  })) || [];

  return {
    content: choice.message?.content || '',
    toolCalls,
    finishReason: choice.finish_reason
  };
}

/**
 * 手动刷新大脑（强制重新唤醒）
 */
function refreshBrain() {
  AwakeningRouter.awakeningState.sleep();
  console.log('[人格体引擎] 大脑已重置，下次对话将重新执行唤醒协议');
}

module.exports = {
  chat,
  refreshBrain,
  selectBestModel,
  _awakeningState: AwakeningRouter.awakeningState
};
