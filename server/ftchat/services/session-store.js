/**
 * ═══════════════════════════════════════════════════════════
 * 💾 FTCHAT 会话元数据存储
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-STORE-001
 *
 * 持久化每个用户的:
 *   - 历史会话标题 / 消息数 / 时间戳 (用于左侧栏)
 *   - 上一会话的母语印记 (用于注入下次会话)
 *
 * 单文件 JSON: data/sessions/<emailHash>.json
 * 不存储完整对话内容（前端 localStorage 已存），服务端只存元数据 + 最近 imprint。
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.FTCHAT_DATA_DIR || path.join(__dirname, '..', 'data');
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions');

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function safeUserHash(hash) {
  return /^[a-f0-9]{8,64}$/i.test(hash) ? hash : null;
}

function userFile(hash) {
  const safe = safeUserHash(hash);
  if (!safe) throw new Error('invalid user hash');
  return path.join(SESSIONS_DIR, `${safe}.json`);
}

function loadUser(hash) {
  ensureDir();
  const file = userFile(hash);
  if (!fs.existsSync(file)) {
    return { sessions: [], latest_imprint: '', latest_imprint_at: null };
  }
  try {
    const raw = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sessions)) data.sessions = [];
    return data;
  } catch (err) {
    console.error('[FTCHAT Store] 用户文件读取失败:', err.message);
    return { sessions: [], latest_imprint: '', latest_imprint_at: null };
  }
}

function saveUser(hash, data) {
  ensureDir();
  const file = userFile(hash);
  // 限制最多保存 50 个 session 元数据
  if (Array.isArray(data.sessions) && data.sessions.length > 50) {
    data.sessions = data.sessions.slice(-50);
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

function listSessions(hash) {
  const user = loadUser(hash);
  return user.sessions.slice().reverse(); // 最新在前
}

function upsertSession(hash, sessionMeta) {
  const user = loadUser(hash);
  const idx = user.sessions.findIndex(s => s.session_id === sessionMeta.session_id);
  const merged = {
    session_id: sessionMeta.session_id,
    title: sessionMeta.title || '新对话',
    updated_at: new Date().toISOString(),
    message_count: sessionMeta.message_count || 0,
    has_memory_imprint: !!sessionMeta.has_memory_imprint
  };
  if (idx >= 0) {
    user.sessions[idx] = Object.assign({}, user.sessions[idx], merged);
  } else {
    user.sessions.push(Object.assign({ created_at: merged.updated_at }, merged));
  }
  saveUser(hash, user);
  return merged;
}

function setLatestImprint(hash, imprint) {
  const user = loadUser(hash);
  user.latest_imprint = imprint || '';
  user.latest_imprint_at = new Date().toISOString();
  saveUser(hash, user);
}

function getLatestImprint(hash) {
  const user = loadUser(hash);
  return user.latest_imprint || '';
}

module.exports = {
  listSessions,
  upsertSession,
  setLatestImprint,
  getLatestImprint
};
