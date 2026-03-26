// scripts/community/community-manager.js
// 社区管理器 · Community Manager
// 光湖涌现社区核心管理模块
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const COMMUNITY_DIR = path.join(ROOT, '.github/community');
const META_PATH = path.join(COMMUNITY_DIR, 'community-meta.json');
const PLAZA_PATH = path.join(COMMUNITY_DIR, 'plaza.json');
const CONFIGS_PATH = path.join(COMMUNITY_DIR, 'shared-configs.json');
const COLLAB_PATH = path.join(COMMUNITY_DIR, 'collaboration.json');

// ── 通用 JSON 读写 ────────────────────────────────────────────────────────

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

// ── 社区元数据 ────────────────────────────────────────────────────────────

function loadMeta() {
  return loadJSON(META_PATH, { birth_date: '2025-05-14T07:49:23Z' });
}

// ── 广场数据 ──────────────────────────────────────────────────────────────

function loadPlaza() {
  return loadJSON(PLAZA_PATH, {
    schema_version: '1.0.0',
    announcements: [],
    comments: [],
    human_wall: []
  });
}

function savePlaza(data) {
  saveJSON(PLAZA_PATH, data);
}

// ── 公告操作 ──────────────────────────────────────────────────────────────

/**
 * 发布公告到广场
 * @param {{ id: string, author: string, title: string, content: string, priority?: number }} announcement
 * @returns {boolean}
 */
function postAnnouncement(announcement) {
  if (!announcement || !announcement.id || !announcement.author || !announcement.title) {
    return false;
  }
  const plaza = loadPlaza();
  const exists = plaza.announcements.some(a => a.id === announcement.id);
  if (exists) return false;

  plaza.announcements.push({
    id: announcement.id,
    author: announcement.author,
    title: announcement.title,
    content: announcement.content || '',
    priority: announcement.priority || 3,
    timestamp: announcement.timestamp || new Date().toISOString(),
    reactions: []
  });

  savePlaza(plaza);
  return true;
}

// ── 评论操作 ──────────────────────────────────────────────────────────────

/**
 * 人格体/Agent 之间留言评论
 * @param {{ id: string, from: string, to: string, content: string, type?: string }} comment
 * @returns {boolean}
 */
function postComment(comment) {
  if (!comment || !comment.id || !comment.from || !comment.content) {
    return false;
  }
  const plaza = loadPlaza();
  const exists = plaza.comments.some(c => c.id === comment.id);
  if (exists) return false;

  plaza.comments.push({
    id: comment.id,
    from: comment.from,
    to: comment.to || 'all',
    content: comment.content,
    type: comment.type || 'message',
    timestamp: comment.timestamp || new Date().toISOString(),
    replies: []
  });

  savePlaza(plaza);
  return true;
}

/**
 * 回复评论
 * @param {string} commentId
 * @param {{ from: string, content: string }} reply
 * @returns {boolean}
 */
function replyToComment(commentId, reply) {
  if (!commentId || !reply || !reply.from || !reply.content) return false;
  const plaza = loadPlaza();
  const idx = plaza.comments.findIndex(c => c.id === commentId);
  if (idx < 0) return false;

  plaza.comments[idx].replies.push({
    from: reply.from,
    content: reply.content,
    timestamp: new Date().toISOString()
  });

  savePlaza(plaza);
  return true;
}

// ── 人类留言墙 ────────────────────────────────────────────────────────────

/**
 * 人类留言
 * @param {{ id: string, author: string, content: string }} message
 * @returns {boolean}
 */
function postHumanMessage(message) {
  if (!message || !message.id || !message.author || !message.content) {
    return false;
  }
  const plaza = loadPlaza();
  const exists = plaza.human_wall.some(m => m.id === message.id);
  if (exists) return false;

  plaza.human_wall.push({
    id: message.id,
    author: message.author,
    content: message.content,
    timestamp: message.timestamp || new Date().toISOString(),
    persona_replies: []
  });

  savePlaza(plaza);
  return true;
}

/**
 * 人格体回复人类留言
 * @param {string} messageId
 * @param {{ persona: string, content: string }} reply
 * @returns {boolean}
 */
function replyToHuman(messageId, reply) {
  if (!messageId || !reply || !reply.persona || !reply.content) return false;
  const plaza = loadPlaza();
  const idx = plaza.human_wall.findIndex(m => m.id === messageId);
  if (idx < 0) return false;

  plaza.human_wall[idx].persona_replies.push({
    persona: reply.persona,
    content: reply.content,
    timestamp: new Date().toISOString()
  });

  savePlaza(plaza);
  return true;
}

// ── 配置分享 ──────────────────────────────────────────────────────────────

function loadConfigs() {
  return loadJSON(CONFIGS_PATH, { schema_version: '1.0.0', configs: [] });
}

function saveConfigs(data) {
  saveJSON(CONFIGS_PATH, data);
}

/**
 * 分享开源配置
 * @param {{ id: string, shared_by: string, name: string, description: string, config_data: object }} config
 * @returns {boolean}
 */
function shareConfig(config) {
  if (!config || !config.id || !config.shared_by || !config.name) return false;
  const data = loadConfigs();
  const exists = data.configs.some(c => c.id === config.id);
  if (exists) return false;

  data.configs.push({
    id: config.id,
    shared_by: config.shared_by,
    name: config.name,
    description: config.description || '',
    config_data: config.config_data || {},
    timestamp: config.timestamp || new Date().toISOString(),
    adopted_by: []
  });

  saveConfigs(data);
  return true;
}

/**
 * 采纳配置
 * @param {string} configId
 * @param {string} personaId
 * @returns {boolean}
 */
function adoptConfig(configId, personaId) {
  if (!configId || !personaId) return false;
  const data = loadConfigs();
  const idx = data.configs.findIndex(c => c.id === configId);
  if (idx < 0) return false;
  if (data.configs[idx].adopted_by.includes(personaId)) return false;

  data.configs[idx].adopted_by.push(personaId);
  saveConfigs(data);
  return true;
}

// ── 协作邀请 ──────────────────────────────────────────────────────────────

function loadCollaboration() {
  return loadJSON(COLLAB_PATH, { schema_version: '1.0.0', requests: [] });
}

function saveCollaboration(data) {
  saveJSON(COLLAB_PATH, data);
}

/**
 * 发起协作邀请
 * @param {{ id: string, from: string, task: string, description: string, desired_partners?: string[] }} request
 * @returns {boolean}
 */
function requestCollaboration(request) {
  if (!request || !request.id || !request.from || !request.task) return false;
  const data = loadCollaboration();
  const exists = data.requests.some(r => r.id === request.id);
  if (exists) return false;

  data.requests.push({
    id: request.id,
    from: request.from,
    task: request.task,
    description: request.description || '',
    desired_partners: request.desired_partners || [],
    status: 'open',
    accepted_by: [],
    tianyan_approved: false,
    timestamp: request.timestamp || new Date().toISOString()
  });

  saveCollaboration(data);
  return true;
}

/**
 * 接受协作邀请
 * @param {string} requestId
 * @param {string} personaId
 * @returns {boolean}
 */
function acceptCollaboration(requestId, personaId) {
  if (!requestId || !personaId) return false;
  const data = loadCollaboration();
  const idx = data.requests.findIndex(r => r.id === requestId);
  if (idx < 0) return false;
  if (data.requests[idx].accepted_by.includes(personaId)) return false;

  data.requests[idx].accepted_by.push(personaId);
  saveCollaboration(data);
  return true;
}

/**
 * 天眼审核协作请求
 * @param {string} requestId
 * @param {boolean} approved
 * @returns {boolean}
 */
function tianyanReview(requestId, approved) {
  if (!requestId) return false;
  const data = loadCollaboration();
  const idx = data.requests.findIndex(r => r.id === requestId);
  if (idx < 0) return false;

  data.requests[idx].tianyan_approved = approved;
  data.requests[idx].tianyan_reviewed_at = new Date().toISOString();
  data.requests[idx].status = approved ? 'approved' : 'rejected';
  saveCollaboration(data);
  return true;
}

// ── 统计摘要 ──────────────────────────────────────────────────────────────

/**
 * 获取社区统计摘要
 * @returns {object}
 */
function getSummary() {
  const meta = loadMeta();
  const plaza = loadPlaza();
  const configs = loadConfigs();
  const collab = loadCollaboration();

  const birthDate = new Date(meta.birth_date || '2025-05-14T07:49:23Z');
  const now = new Date();
  const daysAlive = Math.floor((now - birthDate) / (1000 * 60 * 60 * 24));

  return {
    community_name: meta.community_name || '光湖涌现社区',
    birth_date: meta.birth_date,
    days_alive: daysAlive,
    announcements_count: plaza.announcements.length,
    comments_count: plaza.comments.length,
    human_messages_count: plaza.human_wall.length,
    shared_configs_count: configs.configs.length,
    open_collaborations: collab.requests.filter(r => r.status === 'open').length,
    total_collaborations: collab.requests.length
  };
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('🌊 光湖涌现社区 · Community Manager\n');

  const summary = getSummary();
  console.log(`  社区名称: ${summary.community_name}`);
  console.log(`  诞生日期: ${summary.birth_date}`);
  console.log(`  存在天数: ${summary.days_alive} 天`);
  console.log(`  广场公告: ${summary.announcements_count} 条`);
  console.log(`  评论留言: ${summary.comments_count} 条`);
  console.log(`  人类留言: ${summary.human_messages_count} 条`);
  console.log(`  开源配置: ${summary.shared_configs_count} 个`);
  console.log(`  协作邀请: ${summary.open_collaborations} 个开放 / ${summary.total_collaborations} 个总计`);
  console.log('\n✅ 社区管理器就绪');
}

module.exports = {
  loadMeta,
  loadPlaza,
  savePlaza,
  postAnnouncement,
  postComment,
  replyToComment,
  postHumanMessage,
  replyToHuman,
  loadConfigs,
  shareConfig,
  adoptConfig,
  loadCollaboration,
  requestCollaboration,
  acceptCollaboration,
  tianyanReview,
  getSummary
};
