/**
 * 💬 对话记忆管理器
 * 每个用户独立的对话历史，带上下文窗口管理
 * 
 * P0: 内存存储
 * P1: 迁移到文件/数据库持久化
 */

const MAX_HISTORY = 20;          // 最多保留轮数
const MAX_CONTEXT_CHARS = 6000;  // 上下文窗口字符数
const EXPIRE_MS = 24 * 60 * 60 * 1000; // 24小时过期

// 内存存储: userId -> { messages, lastActive, toolCalls }
const store = new Map();

/**
 * 获取或创建用户会话
 */
function getSession(userId) {
  let session = store.get(userId);
  
  if (!session || (Date.now() - session.lastActive > EXPIRE_MS)) {
    session = {
      messages: [],
      toolCalls: [],
      lastActive: Date.now(),
    };
    store.set(userId, session);
  }
  
  session.lastActive = Date.now();
  return session;
}

/**
 * 添加消息
 * @param {string} userId
 * @param {'user'|'assistant'|'tool'} role
 * @param {string} content
 * @param {object} [meta] - 额外元数据
 */
function addMessage(userId, role, content, meta = {}) {
  const session = getSession(userId);
  
  const msg = {
    role,
    content,
    timestamp: new Date().toISOString(),
    ...meta,
  };
  
  session.messages.push(msg);
  
  while (session.messages.length > MAX_HISTORY * 2) {
    session.messages.shift();
  }
  
  return msg;
}

/**
 * 记录工具调用（同时存入对话历史和工具调用历史）
 * @param {string} userId
 * @param {object} toolCall - { name, args, result, status, duration }
 */
function addToolCall(userId, toolCall) {
  const session = getSession(userId);
  
  const record = {
    id: `tc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name: toolCall.name,
    args: toolCall.args,
    result: toolCall.result,
    status: toolCall.status || 'success',
    duration: toolCall.duration || 0,
    timestamp: new Date().toISOString(),
  };
  
  session.toolCalls.push(record);
  
  // 工具调用也记入对话历史，这样AI可以「看见」
  addMessage(userId, 'tool', JSON.stringify({
    tool: record.name,
    status: record.status,
    result: record.result,
    duration: `${record.duration}ms`,
  }), { toolCallId: record.id });
  
  while (session.toolCalls.length > 50) {
    session.toolCalls.shift();
  }
  
  return record;
}

/**
 * 构建上下文（从最新往回取，直到超过窗口）
 * 返回给 LLM 的 messages 数组
 */
function buildContext(userId) {
  const session = getSession(userId);
  const context = [];
  let totalChars = 0;
  
  for (let i = session.messages.length - 1; i >= 0; i--) {
    const msg = session.messages[i];
    const chars = (msg.content || '').length;
    
    if (totalChars + chars > MAX_CONTEXT_CHARS && context.length > 0) {
      break;
    }
    
    context.unshift({
      role: msg.role === 'tool' ? 'assistant' : msg.role,
      content: msg.content,
    });
    
    totalChars += chars;
  }
  
  return context;
}

/**
 * 获取最近的工具调用记录（给前端展示用）
 */
function getRecentToolCalls(userId, limit = 10) {
  const session = getSession(userId);
  return session.toolCalls.slice(-limit);
}

/**
 * 清空用户会话
 */
function clearSession(userId) {
  store.delete(userId);
}

/**
 * 获取所有活跃会话统计
 */
function getStats() {
  const now = Date.now();
  let active = 0;
  let expired = 0;
  
  for (const [, session] of store) {
    if (now - session.lastActive > EXPIRE_MS) {
      expired++;
    } else {
      active++;
    }
  }
  
  return { active, expired, total: store.size };
}

module.exports = {
  addMessage,
  addToolCall,
  buildContext,
  getRecentToolCalls,
  clearSession,
  getStats,
};
