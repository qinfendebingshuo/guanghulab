/**
 * 🔧 工具执行层 · 灯塔监管
 * 
 * 核心设计：
 * 1. 每次工具调用由灯塔系统记录并监管
 * 2. 执行结果同时展示给人类（前端UI）和AI（下一轮对话）
 * 3. AI不能编造工具结果——它只能看到灯塔给的
 */
const conversationManager = require('./conversation-manager');

// 工具注册表
const toolRegistry = new Map();

/**
 * 注册一个工具
 * @param {string} name - 工具名（如 'video.generate'）
 * @param {object} config
 * @param {string} config.description - 工具描述
 * @param {object} config.parameters - JSON Schema 参数定义
 * @param {Function} config.handler - 实际执行函数 (args) => result
 */
function registerTool(name, config) {
  toolRegistry.set(name, {
    name,
    description: config.description || '',
    parameters: config.parameters || {},
    handler: config.handler,
  });
  console.log(`[🗼 灯塔] 工具已注册: ${name}`);
}

/**
 * 获取所有已注册工具的清单（用于注入 system prompt）
 */
function getToolList() {
  const tools = [];
  for (const [name, tool] of toolRegistry) {
    tools.push({
      name,
      description: tool.description,
      parameters: tool.parameters,
    });
  }
  return tools;
}

/**
 * 生成工具清单的文本描述（注入到 system prompt）
 */
function getToolListPrompt() {
  const tools = getToolList();
  if (tools.length === 0) return '\n当前无可用工具。\n';
  
  let prompt = '\n### 当前可用工具\n\n';
  for (const tool of tools) {
    prompt += `- \`${tool.name}\` — ${tool.description}\n`;
    if (tool.parameters && Object.keys(tool.parameters).length > 0) {
      prompt += `  参数: ${JSON.stringify(tool.parameters)}\n`;
    }
  }
  prompt += '\n要调用工具，请在回复中使用以下格式：\n';
  prompt += '```tool\n{"tool": "工具名", "args": {参数}}\n```\n';
  prompt += '灯塔会执行工具并将结果返回给你。\n';
  
  return prompt;
}

/**
 * 执行工具调用（灯塔监管）
 * @param {string} userId - 用户ID
 * @param {string} toolName - 工具名
 * @param {object} args - 参数
 * @param {object} io - Socket.IO 实例（用于实时推送给前端）
 * @returns {object} { id, name, status, result, duration }
 */
async function executeTool(userId, toolName, args, io) {
  const tool = toolRegistry.get(toolName);
  
  if (!tool) {
    const record = {
      name: toolName,
      args,
      status: 'error',
      result: `工具 "${toolName}" 未在灯塔中注册`,
      duration: 0,
    };
    
    // 记录到对话历史
    const logged = conversationManager.addToolCall(userId, record);
    
    // 推送给前端
    if (io) {
      io.emit('tool:executed', {
        userId,
        ...logged,
      });
    }
    
    return logged;
  }
  
  // ═══ 灯塔监管：开始执行 ═══
  const startTime = Date.now();
  
  // 推送「开始执行」事件给前端
  if (io) {
    io.emit('tool:start', {
      userId,
      name: toolName,
      args,
      timestamp: new Date().toISOString(),
    });
  }
  
  let record;
  
  try {
    const result = await tool.handler(args);
    const duration = Date.now() - startTime;
    
    record = {
      name: toolName,
      args,
      status: 'success',
      result: typeof result === 'string' ? result : JSON.stringify(result),
      duration,
    };
    
    console.log(`[🗼 灯塔] ✅ ${toolName} 执行成功 (${duration}ms)`);
  } catch (err) {
    const duration = Date.now() - startTime;
    
    record = {
      name: toolName,
      args,
      status: 'error',
      result: `执行失败: ${err.message}`,
      duration,
    };
    
    console.error(`[🗼 灯塔] ❌ ${toolName} 执行失败 (${duration}ms):`, err.message);
  }
  
  // ═══ 灯塔监管：记录结果 ═══
  const logged = conversationManager.addToolCall(userId, record);
  
  // ═══ 双向可视化 ═══
  // 1. 推送给前端（人类看到）
  if (io) {
    io.emit('tool:executed', {
      userId,
      ...logged,
    });
  }
  
  // 2. 记录到对话历史（AI看到）—— 已在 addToolCall 中完成
  
  return logged;
}

/**
 * 从AI回复中解析工具调用请求
 * @param {string} text - AI的回复文本
 * @returns {Array<{tool: string, args: object}>}
 */
function parseToolCalls(text) {
  const calls = [];
  const regex = /```tool\s*\n([\s\S]*?)\n```/g;
  let match;
  
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed.tool) {
        calls.push({
          tool: parsed.tool,
          args: parsed.args || {},
        });
      }
    } catch (e) {
      console.warn('[🗼 灯塔] 工具调用解析失败:', match[1]);
    }
  }
  
  return calls;
}

/**
 * 从AI回复中移除工具调用块，保留纯文本回复
 */
function stripToolCalls(text) {
  return text.replace(/```tool\s*\n[\s\S]*?\n```/g, '').trim();
}

module.exports = {
  registerTool,
  getToolList,
  getToolListPrompt,
  executeTool,
  parseToolCalls,
  stripToolCalls,
};
