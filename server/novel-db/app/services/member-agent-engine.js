/**
 * ═══════════════════════════════════════════════════════════
 * 成员Agent引擎 · Member Agent Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 3 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 每成员独立Agent（永久记忆）
 *   - 记忆存储：对话历史 + 笔记 + 偏好
 *   - AI辅助接口：摘要/拆文/大纲（预留DeepSeek/Kimi接入）
 *   - 成员管理：注册/资料/Agent状态
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR     = path.join(__dirname, '..', 'data');
const AGENTS_FILE  = path.join(DATA_DIR, 'member-agents.json');

let agentsData = Object.create(null);

function sanitizeId(id) {
  if (!id || typeof id !== 'string') return null;
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return null;
  return id;
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  load();
}

function load() {
  try {
    if (fs.existsSync(AGENTS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
      agentsData = Object.create(null);
      for (const key of Object.keys(raw)) {
        if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
          agentsData[key] = raw[key];
        }
      }
    }
  } catch {
    agentsData = Object.create(null);
  }
}

function save() {
  try {
    fs.writeFileSync(AGENTS_FILE, JSON.stringify(agentsData, null, 2), 'utf8');
  } catch (err) {
    console.error('[MemberAgent] 保存失败:', err.message);
  }
}

/**
 * 注册/获取成员Agent
 */
function getOrCreateAgent(memberId, profile) {
  if (!sanitizeId(memberId)) throw new Error('非法 memberId');

  if (!Object.prototype.hasOwnProperty.call(agentsData, memberId)) {
    agentsData[memberId] = {
      member_id:  memberId,
      nickname:   (profile && profile.nickname) || memberId,
      role:       (profile && profile.role) || 'reader',
      memory:     [],
      notes:      [],
      chat_history: [],
      preferences: {
        ai_model: 'deepseek',
        language: 'zh-CN'
      },
      created_at: new Date().toISOString(),
      last_active: new Date().toISOString()
    };
    save();
  }

  agentsData[memberId].last_active = new Date().toISOString();
  return agentsData[memberId];
}

/**
 * 获取成员Agent（不自动创建）
 */
function getAgent(memberId) {
  if (!sanitizeId(memberId)) return null;
  if (!Object.prototype.hasOwnProperty.call(agentsData, memberId)) return null;
  return agentsData[memberId];
}

/**
 * 列出所有成员Agent
 */
function listAgents() {
  return Object.values(agentsData).map(a => ({
    member_id:   a.member_id,
    nickname:    a.nickname,
    role:        a.role,
    memory_count: a.memory ? a.memory.length : 0,
    note_count:  a.notes ? a.notes.length : 0,
    last_active: a.last_active,
    created_at:  a.created_at
  }));
}

/**
 * 添加记忆（Agent永久记忆·自动生成的摘要/标签）
 */
function addMemory(memberId, { type, content, source, tags }) {
  const agent = getOrCreateAgent(memberId);

  const memoryItem = {
    id:         `MEM-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    type:       type || 'note',
    content:    (content || '').slice(0, 2000),
    source:     source || null,
    tags:       Array.isArray(tags) ? tags.slice(0, 5) : [],
    created_at: new Date().toISOString()
  };

  agent.memory.push(memoryItem);
  if (agent.memory.length > 500) agent.memory = agent.memory.slice(-500);
  save();

  return memoryItem;
}

/**
 * 获取记忆列表
 */
function getMemories(memberId, { type, limit } = {}) {
  const agent = getAgent(memberId);
  if (!agent) return [];

  let result = [...(agent.memory || [])];
  if (type) result = result.filter(m => m.type === type);
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (limit) result = result.slice(0, limit);

  return result;
}

/**
 * 添加笔记
 */
function addNote(memberId, { title, content, book_id }) {
  const agent = getOrCreateAgent(memberId);

  const note = {
    id:         `NOTE-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    title:      (title || '无标题').slice(0, 100),
    content:    (content || '').slice(0, 5000),
    book_id:    book_id || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  agent.notes.push(note);
  save();

  return note;
}

/**
 * 获取笔记列表
 */
function getNotes(memberId, { book_id, limit } = {}) {
  const agent = getAgent(memberId);
  if (!agent) return [];

  let result = [...(agent.notes || [])];
  if (book_id) result = result.filter(n => n.book_id === book_id);
  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (limit) result = result.slice(0, limit);

  return result;
}

/**
 * 对话（Agent记录对话历史 · 预留AI接入）
 * Phase 3 MVP: echo 回复 + 基础指令解析
 * Phase 4: 接入 DeepSeek/Kimi API
 */
function chat(memberId, message) {
  const agent = getOrCreateAgent(memberId);

  const userMsg = {
    role:       'user',
    content:    (message || '').slice(0, 2000),
    timestamp:  new Date().toISOString()
  };

  agent.chat_history.push(userMsg);

  // MVP: 基础指令解析
  const reply = generateReply(agent, message);

  const assistantMsg = {
    role:       'assistant',
    content:    reply,
    timestamp:  new Date().toISOString()
  };

  agent.chat_history.push(assistantMsg);
  if (agent.chat_history.length > 200) agent.chat_history = agent.chat_history.slice(-200);
  save();

  return {
    reply,
    history_length: agent.chat_history.length
  };
}

/**
 * MVP 回复生成（基础指令 · Phase 4 换成真实AI）
 */
function generateReply(agent, message) {
  const msg = (message || '').trim().toLowerCase();

  if (msg.includes('你好') || msg.includes('hi') || msg.includes('hello')) {
    return `你好，${agent.nickname}！我是你的专属阅读Agent。我可以帮你：\n- 记录阅读笔记\n- 整理书籍摘要\n- 分析人物关系\n告诉我你想做什么？`;
  }

  if (msg.includes('记忆') || msg.includes('记录')) {
    const memCount = agent.memory ? agent.memory.length : 0;
    const noteCount = agent.notes ? agent.notes.length : 0;
    return `📝 你的记忆档案：\n- 记忆条目: ${memCount}\n- 阅读笔记: ${noteCount}\n- 对话轮次: ${agent.chat_history.length}`;
  }

  if (msg.includes('摘要') || msg.includes('总结')) {
    return '📋 摘要功能将在接入 DeepSeek API 后启用。当前你可以手动添加笔记来记录阅读感想。\n\n使用 POST /api/zhiku/agent/:id/notes 添加笔记。';
  }

  if (msg.includes('帮助') || msg.includes('help')) {
    return `🤖 Agent 功能一览：\n\n1. 💬 对话 — 随时和我聊天\n2. 📝 笔记 — 记录阅读感想\n3. 🧠 记忆 — 我会记住你的偏好\n4. 📋 摘要 — AI辅助总结（即将上线）\n5. 🔍 拆文 — 分析小说结构（即将上线）\n\n有什么我可以帮忙的？`;
  }

  return `我收到了你的消息。作为${agent.nickname}的专属Agent，我正在学习中。\n\n💡 试试说"帮助"查看我的功能列表。\n\n（AI辅助功能将在接入 DeepSeek/Kimi 后全面启用）`;
}

/**
 * 获取对话历史
 */
function getChatHistory(memberId, limit) {
  const agent = getAgent(memberId);
  if (!agent) return [];

  const history = agent.chat_history || [];
  if (limit) return history.slice(-limit);
  return history;
}

/**
 * 统计
 */
function getStats() {
  const agents = Object.values(agentsData);
  return {
    total_agents:   agents.length,
    total_memories: agents.reduce((s, a) => s + (a.memory ? a.memory.length : 0), 0),
    total_notes:    agents.reduce((s, a) => s + (a.notes ? a.notes.length : 0), 0),
    total_chats:    agents.reduce((s, a) => s + (a.chat_history ? a.chat_history.length : 0), 0),
    active_today:   agents.filter(a => {
      if (!a.last_active) return false;
      return a.last_active.slice(0, 10) === new Date().toISOString().slice(0, 10);
    }).length
  };
}

init();

module.exports = {
  getOrCreateAgent, getAgent, listAgents,
  addMemory, getMemories,
  addNote, getNotes,
  chat, getChatHistory,
  getStats
};
