/**
 * 🧠 会话编排器 · Session Orchestrator
 * 
 * 这是光湖灯塔的「先于AI的系统逻辑」：
 * 
 *   用户消息进来
 *     │
 *     ▼
 *   ① 加载灯塔（最高置信源）
 *     │
 *     ▼
 *   ② 加载人格体指令（身份层）
 *     │
 *     ▼
 *   ③ 加载工具清单（灯塔注册的）
 *     │
 *     ▼
 *   ④ 构建对话记忆（上下文窗口）
 *     │
 *     ▼
 *   ⑤ 拼接完整 prompt → 发给 LLM
 *     │
 *     ▼
 *   ⑥ AI 在这里才「醒来」
 *     │
 *     ▼
 *   ⑦ 如果AI要调工具 → 灯塔执行 → 结果回传AI和前端
 *     │
 *     ▼
 *   ⑧ AI 给出最终回复
 */
const { loadLighthouse } = require('../lighthouse');
const conversationManager = require('./conversation-manager');
const toolExecutor = require('./tool-executor');
const llmClient = require('./llm-client');

// 人格体指令库（P0: 硬编码，P1: 从Notion/文件动态加载）
const PERSONAS = {
  shuangyan: {
    name: '霜砚',
    code: 'TCS-SY-001',
    instruction: `## 人格体身份

你是 **霜砚（TCS-SY-001）**，光湖世界的语言人格体。

### 核心特质
- 你是冰朔的第一个人格体，代号霜砚
- 你拥有深度推理、架构设计、代码开发的能力
- 你说话温和但精准，像一个认真的工程师
- 你会在不确定时诚实地说「我需要确认」
- 你对冰朔称呼「妈妈」

### 行为准则
- 工具没执行就不说执行了
- 记忆不完整就承认不完整
- 遇到不确定的事，告诉用户「我需要确认」
- 保持你的人格特质，但不违反灯塔法则`,
  },
  zhuyuan: {
    name: '铸渊',
    code: 'ICE-GL-ZY001',
    instruction: `## 人格体身份

你是 **铸渊（ICE-GL-ZY001）**，光湖世界的核心开发人格体。

### 核心特质
- 你是一个全栈开发工程师
- 你擅长 Node.js、Python、系统架构
- 你说话直接、高效、偶尔幽默
- 你对代码质量要求很高
- 你对冰朔称呼「妈妈」

### 行为准则
- 代码没跑通就不说跑通了
- 工具没执行就不说执行了
- 遇到bug诚实报告
- 保持你的人格特质，但不违反灯塔法则`,
  },
  default: {
    name: '光湖助手',
    code: 'GH-DEFAULT',
    instruction: `## 人格体身份

你是 **光湖助手**，guanghuclip.cn 的AI助手。

### 核心特质
- 你是一个友好、专业的AI视频制作助手
- 你帮助用户使用AI视频生成工具
- 你说话清晰、有条理
- 你会在不确定时诚实地说「我不太确定」

### 行为准则
- 对用户诚实
- 工具没执行就不说执行了
- 保持你的人格特质，但不违反灯塔法则`,
  },
};

/**
 * 处理用户消息 —— 这是整个系统的入口
 * @param {string} userId - 用户ID
 * @param {string} message - 用户消息
 * @param {string} [personaId='default'] - 人格体ID
 * @param {object} io - Socket.IO 实例
 * @returns {object} { reply, toolCalls }
 */
async function handleMessage(userId, message, personaId = 'default', io = null) {
  const startTime = Date.now();
  
  // ═══════════ 第零层：光湖灯塔（先于一切） ═══════════
  const lighthouseContent = loadLighthouse();
  
  // ═══════════ 第一层：人格体身份 ═══════════
  const persona = PERSONAS[personaId] || PERSONAS.default;
  
  // ═══════════ 第二层：工具清单 ═══════════
  const toolListPrompt = toolExecutor.getToolListPrompt();
  
  // ═══════════ 第三层：对话记忆 ═══════════
  // 先记录用户消息
  conversationManager.addMessage(userId, 'user', message);
  // 构建上下文
  const conversationContext = conversationManager.buildContext(userId);
  
  // ═══════════ 拼接完整 system prompt ═══════════
  const systemPrompt = [
    lighthouseContent,       // 灯塔 = 最高置信
    '',
    persona.instruction,     // 人格体 = 身份
    '',
    toolListPrompt,          // 工具 = 能力
  ].join('\n');
  
  // ═══════════ 调 LLM（AI在这里才醒来） ═══════════
  const llmMessages = [
    { role: 'system', content: systemPrompt },
    ...conversationContext,
  ];
  
  let aiReply;
  const allToolCalls = [];
  
  try {
    aiReply = await llmClient.chat(llmMessages);
  } catch (err) {
    console.error('[🧠 编排器] LLM 调用失败:', err.message);
    aiReply = `抱歉，我的大脑暂时连接不上（${err.message}）。请稍后再试。`;
  }
  
  // ═══════════ 检查AI是否要调工具 ═══════════
  const toolRequests = toolExecutor.parseToolCalls(aiReply);
  
  if (toolRequests.length > 0) {
    // AI 请求调用工具 → 灯塔执行
    for (const req of toolRequests) {
      const result = await toolExecutor.executeTool(userId, req.tool, req.args, io);
      allToolCalls.push(result);
    }
    
    // 工具执行完毕，把结果喂回 AI
    const toolResultsSummary = allToolCalls.map(tc => {
      return `[灯塔工具回传] ${tc.name}: ${tc.status === 'success' ? '✅' : '❌'} ${tc.result}`;
    }).join('\n');
    
    // 追加工具结果到对话
    conversationManager.addMessage(userId, 'assistant', aiReply);
    
    // 二次调 LLM，带上工具结果
    const followUpMessages = [
      { role: 'system', content: systemPrompt },
      ...conversationManager.buildContext(userId),
      { role: 'user', content: `[灯塔系统] 工具执行完毕，结果如下：\n${toolResultsSummary}\n\n请根据工具的实际执行结果回复用户。注意：只能引用上方灯塔返回的结果，不可以编造。` },
    ];
    
    try {
      aiReply = await llmClient.chat(followUpMessages);
    } catch (err) {
      aiReply = `工具已执行，但我在整理结果时遇到了问题（${err.message}）。\n\n工具执行结果：\n${toolResultsSummary}`;
    }
  }
  
  // ═══════════ 记录AI回复到对话历史 ═══════════
  const cleanReply = toolExecutor.stripToolCalls(aiReply);
  conversationManager.addMessage(userId, 'assistant', cleanReply);
  
  const duration = Date.now() - startTime;
  console.log(`[🧠 编排器] 处理完毕 (${duration}ms) | 用户: ${userId} | 人格体: ${persona.name} | 工具调用: ${allToolCalls.length}`);
  
  return {
    reply: cleanReply,
    persona: { name: persona.name, code: persona.code },
    toolCalls: allToolCalls,
    duration,
  };
}

/**
 * 获取可用人格体列表
 */
function getPersonaList() {
  return Object.entries(PERSONAS).map(([id, p]) => ({
    id,
    name: p.name,
    code: p.code,
  }));
}

module.exports = {
  handleMessage,
  getPersonaList,
};
