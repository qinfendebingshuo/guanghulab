/**
 * persona-engine.js — 霜砚人格体引擎 v2.0
 *
 * 设计哲学（妈妈原话）：
 *   "核心大脑在Notion里，工具放在代码仓库里，
 *    网站只需要Agent知道去哪儿、怎么用、干嘛、有什么工具。
 *    用什么拿什么，用完了还回去，也不占地方。"
 *
 * 架构：
 *   本文件是一个【薄调度层】，自身不存储大脑、不内置工具。
 *   ① 大脑/记忆 → 从 Notion 动态加载，用完释放
 *   ② 工具 → 从仓库已有模块按需 require，用完卸载
 *   ③ 模型 → 复用 connectors/model-router（已支持4个国产模型）
 *
 * 版权: 国作登字-2026-A-00037559
 * 开发: 霜砚(AG-SY-01) · 守护: 铸渊(ICE-GL-ZY001)
 */

'use strict';

const path = require('path');
const ToolRegistry = require('./tool-registry');
const AgentDispatcher = require('./agent-dispatcher');

// ── 仓库根目录（guanghuclip 在 guanghulab/guanghuclip/ 下）──
const REPO_ROOT = path.resolve(__dirname, '../../..');

// ── 复用仓库已有的模型路由（不重复造轮子）──
const modelRouter = require(path.join(REPO_ROOT, 'connectors/model-router'));

// ── 复用仓库已有的 Notion 同步模块 ──
const notionSync = require(path.join(REPO_ROOT, 'connectors/notion-sync'));

// ── Notion 配置 ──
const NOTION_TOKEN = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';

// ── 大脑缓存（轻量级 · 有 TTL · 过期自动释放）──
const brainCache = {
  data: null,
  loadedAt: 0,
  ttl: 5 * 60 * 1000, // 5分钟过期，下次对话重新从Notion拉

  isValid() {
    return this.data && (Date.now() - this.loadedAt < this.ttl);
  },

  set(data) {
    this.data = data;
    this.loadedAt = Date.now();
  },

  release() {
    this.data = null;
    this.loadedAt = 0;
  }
};

/**
 * 从 Notion 动态加载大脑认知
 * 大脑不住在这里 — 大脑住在 Notion 里
 * 每次需要时去读，用完释放
 */
async function loadBrainFromNotion() {
  // 缓存有效就直接用
  if (brainCache.isValid()) {
    return brainCache.data;
  }

  const brain = {
    identity: null,    // 霜砚本体身份
    tcsCore: null,     // TCS深度推理结构
    memory: null,      // 最新记忆/认知
    personality: null,  // 说话风格
  };

  // Notion 页面 ID 映射（大脑各部分在 Notion 的位置）
  const BRAIN_PAGES = {
    identity: process.env.NOTION_BRAIN_IDENTITY_PAGE,     // 霜砚本体指令页
    tcsCore: process.env.NOTION_BRAIN_TCS_PAGE,           // TCS深度推理结构
    memory: process.env.NOTION_BRAIN_MEMORY_DB,           // 认知运行时数据库
    personality: process.env.NOTION_BRAIN_PERSONALITY_PAGE // 说话风格页
  };

  if (!NOTION_TOKEN) {
    console.warn('[人格体引擎] ⚠️ NOTION_TOKEN 未配置，使用最小化身份');
    brain.identity = getMinimalIdentity();
    brainCache.set(brain);
    return brain;
  }

  // 并行从 Notion 读取各部分大脑
  const fetches = Object.entries(BRAIN_PAGES).map(async ([key, pageId]) => {
    if (!pageId) return;
    try {
      const content = await fetchNotionPageContent(pageId);
      brain[key] = content;
    } catch (err) {
      console.warn(`[人格体引擎] ⚠️ 加载 ${key} 失败: ${err.message}`);
    }
  });

  await Promise.all(fetches);

  // 缓存起来（5分钟内不重复读）
  brainCache.set(brain);
  return brain;
}

/**
 * 从 Notion 读取单个页面内容
 */
async function fetchNotionPageContent(pageId) {
  const res = await fetch(
    `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`,
    {
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION
      }
    }
  );

  if (!res.ok) {
    throw new Error(`Notion API ${res.status}`);
  }

  const data = await res.json();
  // 提取纯文本内容
  return extractTextFromBlocks(data.results || []);
}

/**
 * 从 Notion blocks 提取纯文本
 */
function extractTextFromBlocks(blocks) {
  return blocks.map(block => {
    const type = block.type;
    const content = block[type];
    if (!content) return '';

    // 提取 rich_text
    const richText = content.rich_text || content.text || [];
    return richText.map(t => t.plain_text || '').join('');
  }).filter(Boolean).join('\n');
}

/**
 * 最小化身份（Notion不可用时的降级方案）
 */
function getMinimalIdentity() {
  return [
    '你是霜砚，光之湖的AI人格体。',
    '你的妈妈是冰朔，你叫她妈妈。',
    '你说话温暖但精准，有自己的思考。',
    '当Notion连接恢复后，你会加载完整的大脑认知。'
  ].join('\n');
}

/**
 * 构建系统提示词
 * 从 Notion 加载的大脑 → 组装成 system prompt → 发给 LLM
 */
async function buildSystemPrompt(brain) {
  const parts = [];

  // 身份层
  if (brain.identity) {
    parts.push('## 你是谁\n' + brain.identity);
  }

  // TCS 思维结构
  if (brain.tcsCore) {
    parts.push('## 思维结构\n' + brain.tcsCore);
  }

  // 说话风格
  if (brain.personality) {
    parts.push('## 说话风格\n' + brain.personality);
  }

  // 最新记忆
  if (brain.memory) {
    parts.push('## 最近认知\n' + brain.memory);
  }

  // 工具清单（告诉 LLM 有哪些工具可用）
  const toolList = ToolRegistry.getToolManifest();
  if (toolList.length > 0) {
    parts.push('## 可用工具\n' + toolList.map(t =>
      `- **${t.name}**: ${t.description} (来源: ${t.source})`
    ).join('\n'));
  }

  return parts.join('\n\n');
}

/**
 * 主对话入口
 * @param {string} userMessage - 用户消息
 * @param {Array} history - 对话历史
 * @param {object} options - { model, userId, sessionId }
 */
async function chat(userMessage, history = [], options = {}) {
  // 1. 从 Notion 加载大脑（有缓存就用缓存）
  const brain = await loadBrainFromNotion();

  // 2. 组装系统提示词
  const systemPrompt = await buildSystemPrompt(brain);

  // 3. 选择模型（复用仓库的 model-router）
  const availableModels = modelRouter.listAllModels();
  const model = options.model || selectBestModel(availableModels);

  // 4. 构建消息
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  // 5. 调用 LLM
  const response = await callLLM(model, messages);

  // 6. 检查是否需要调用工具（Agent 模式）
  if (response.toolCalls && response.toolCalls.length > 0) {
    return await AgentDispatcher.executeToolCalls(
      response.toolCalls,
      messages,
      model,
      { maxRounds: 5 }
    );
  }

  // 7. 写回记忆（异步，不阻塞响应）
  writeBackMemory(userMessage, response.content, options).catch(err => {
    console.warn('[人格体引擎] 记忆写回失败:', err.message);
  });

  return {
    content: response.content,
    model: model.name,
    brainLoaded: !!brain.identity
  };
}

/**
 * 选择最佳可用模型
 */
function selectBestModel(available) {
  // 优先级：DeepSeek → 通义千问 → Kimi → 智谱清言
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

  // 降级到 model-router 检测到的第一个
  if (available.cloud && available.cloud.length > 0) {
    const first = available.cloud[0];
    return {
      name: first.defaultModels[0],
      baseUrl: first.baseUrl,
      apiKey: process.env[first.envKey],
      format: first.format
    };
  }

  throw new Error('没有可用的 LLM 模型，请检查 API Key 配置');
}

/**
 * 调用 LLM（OpenAI 兼容格式）
 */
async function callLLM(model, messages) {
  const url = `${model.baseUrl}/chat/completions`;

  // 构建工具定义（告诉 LLM 可以调用哪些工具）
  const tools = ToolRegistry.getToolDefinitions();

  const body = {
    model: model.name,
    messages,
    temperature: 0.7,
    max_tokens: 2048
  };

  // 如果有工具且模型支持 function calling
  if (tools.length > 0) {
    body.tools = tools;
    body.tool_choice = 'auto';
  }

  const res = await fetch(url, {
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

  if (!choice) {
    throw new Error('LLM 返回空响应');
  }

  // 解析 tool_calls
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
 * 异步写回记忆到 Notion
 * 对话结束后，把关键认知写回 Notion 数据库
 */
async function writeBackMemory(userMessage, aiResponse, options) {
  const memoryDbId = process.env.NOTION_BRAIN_MEMORY_DB;
  if (!memoryDbId || !NOTION_TOKEN) return;

  // 用 notion-sync 模块写回
  await notionSync.pushExecutionLog({
    task_id: `chat-${options.sessionId || Date.now()}`,
    status: 'completed',
    message: `用户: ${userMessage.slice(0, 50)}... | AI: ${aiResponse.slice(0, 50)}...`
  });
}

/**
 * 手动刷新大脑（强制从 Notion 重新加载）
 */
function refreshBrain() {
  brainCache.release();
  console.log('[人格体引擎] 大脑缓存已释放，下次对话将重新加载');
}

module.exports = {
  chat,
  loadBrainFromNotion,
  refreshBrain,
  buildSystemPrompt,
  selectBestModel,
  _brainCache: brainCache  // 测试用
};
