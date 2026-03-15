// backend/feishu-bot/context-manager.js
// 铸渊 · 飞书机器人多轮对话上下文管理
//
// 为每个用户维护独立的对话上下文
// 支持上下文压缩、过期清理、会话隔离
//
// 基于 persona-studio/backend/brain/memory-injector.js 的五层模型简化版

'use strict';

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

const MAX_HISTORY_ROUNDS     = 10;    // 保留最近 10 轮对话
const MAX_HISTORY_MESSAGES   = 20;    // 10 轮 = 20 条消息
const SESSION_TIMEOUT_MS     = 30 * 60 * 1000; // 30 分钟无活动则清除上下文
const MAX_SESSIONS           = 500;   // 内存中最多保留的会话数

// ══════════════════════════════════════════════════════════
// 会话存储（内存级，重启后清空）
// ══════════════════════════════════════════════════════════

// Map<userId, SessionData>
const sessions = new Map();

/**
 * @typedef {object} SessionData
 * @property {string} userId
 * @property {Array<{role: string, content: string}>} history
 * @property {number} lastActiveAt
 * @property {string} channel
 * @property {number} totalRounds
 */

// ══════════════════════════════════════════════════════════
// 会话管理
// ══════════════════════════════════════════════════════════

/**
 * 获取或创建用户会话
 * @param {string} userId - 飞书用户 ID
 * @returns {SessionData}
 */
function getSession(userId) {
  cleanExpiredSessions();

  if (sessions.has(userId)) {
    const session = sessions.get(userId);
    session.lastActiveAt = Date.now();
    return session;
  }

  const session = {
    userId,
    history: [],
    lastActiveAt: Date.now(),
    channel: 'shuangyan',
    totalRounds: 0,
  };

  // 如果超过最大会话数，清除最旧的会话
  if (sessions.size >= MAX_SESSIONS) {
    evictOldestSession();
  }

  sessions.set(userId, session);
  return session;
}

/**
 * 添加一轮对话到上下文
 * @param {string} userId - 飞书用户 ID
 * @param {string} userMessage - 用户消息
 * @param {string} assistantReply - 助手回复
 * @param {string} channel - 通道标识
 */
function addRound(userId, userMessage, assistantReply, channel) {
  const session = getSession(userId);

  session.history.push(
    { role: 'user', content: userMessage },
    { role: 'assistant', content: assistantReply }
  );

  session.channel = channel || session.channel;
  session.totalRounds += 1;

  // 保留最近 N 轮
  if (session.history.length > MAX_HISTORY_MESSAGES) {
    session.history = session.history.slice(-MAX_HISTORY_MESSAGES);
  }
}

/**
 * 获取用户的对话历史
 * @param {string} userId - 飞书用户 ID
 * @returns {Array<{role: string, content: string}>}
 */
function getHistory(userId) {
  const session = getSession(userId);
  return session.history;
}

/**
 * 清除用户的对话上下文
 * @param {string} userId - 飞书用户 ID
 */
function clearSession(userId) {
  sessions.delete(userId);
}

/**
 * 获取会话统计信息
 * @param {string} userId - 飞书用户 ID
 * @returns {object}
 */
function getSessionInfo(userId) {
  const session = sessions.get(userId);
  if (!session) {
    return { exists: false, totalRounds: 0, historyLength: 0 };
  }
  return {
    exists: true,
    totalRounds: session.totalRounds,
    historyLength: session.history.length,
    channel: session.channel,
    lastActiveAt: new Date(session.lastActiveAt).toISOString(),
    idleMinutes: Math.floor((Date.now() - session.lastActiveAt) / 60000),
  };
}

// ══════════════════════════════════════════════════════════
// 内部维护
// ══════════════════════════════════════════════════════════

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [userId, session] of sessions) {
    if (now - session.lastActiveAt > SESSION_TIMEOUT_MS) {
      sessions.delete(userId);
    }
  }
}

function evictOldestSession() {
  let oldestKey = null;
  let oldestTime = Infinity;
  for (const [userId, session] of sessions) {
    if (session.lastActiveAt < oldestTime) {
      oldestTime = session.lastActiveAt;
      oldestKey = userId;
    }
  }
  if (oldestKey) sessions.delete(oldestKey);
}

/**
 * 获取全局统计
 * @returns {object}
 */
function getStats() {
  cleanExpiredSessions();
  return {
    activeSessions: sessions.size,
    maxSessions: MAX_SESSIONS,
    sessionTimeoutMinutes: SESSION_TIMEOUT_MS / 60000,
    maxHistoryRounds: MAX_HISTORY_ROUNDS,
  };
}

module.exports = {
  getSession,
  addRound,
  getHistory,
  clearSession,
  getSessionInfo,
  getStats,
};
