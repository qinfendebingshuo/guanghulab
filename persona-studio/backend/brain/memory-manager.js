/**
 * persona-studio · 记忆读写管理
 * 管理每个体验者的独立记忆空间 brain/memory/{EXP-XXX}/
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const MEMORY_DIR = path.join(BRAIN_DIR, 'memory');

/**
 * 确保体验者目录存在
 */
function ensureDevDir(devId) {
  const dir = path.join(MEMORY_DIR, devId);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * 加载体验者的对话记忆
 */
function loadMemory(devId) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'memory.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    const initial = {
      dev_id: devId,
      conversations: [],
      last_topic: null,
      preferences: {},
      updated_at: null
    };
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

/**
 * 追加对话记录
 */
function appendConversation(devId, messages) {
  const memory = loadMemory(devId);
  memory.conversations = memory.conversations.concat(messages);

  // 保留最近 200 条对话
  if (memory.conversations.length > 200) {
    memory.conversations = memory.conversations.slice(-200);
  }

  memory.updated_at = new Date().toISOString();
  saveMemory(devId, memory);
}

/**
 * 更新最后话题
 */
function updateLastTopic(devId, topic) {
  const memory = loadMemory(devId);
  // 取消息的前 30 个字符作为话题摘要
  memory.last_topic = topic.length > 30 ? topic.substring(0, 30) + '…' : topic;
  memory.updated_at = new Date().toISOString();
  saveMemory(devId, memory);
}

/**
 * 保存记忆
 */
function saveMemory(devId, memory) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'memory.json');
  fs.writeFileSync(file, JSON.stringify(memory, null, 2), 'utf-8');
}

/**
 * 加载体验者的项目记录
 */
function loadProjects(devId) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'projects.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    const initial = { dev_id: devId, projects: [], updated_at: null };
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

/**
 * 添加项目记录
 */
function addProject(devId, project) {
  const data = loadProjects(devId);
  data.projects.push(project);
  data.updated_at = new Date().toISOString();
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'projects.json');
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * 加载/更新体验者画像
 */
function loadProfile(devId) {
  const dir = ensureDevDir(devId);
  const file = path.join(dir, 'profile.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch {
    const initial = {
      dev_id: devId,
      tech_level: null,
      communication_style: null,
      aesthetic_preference: null,
      growth_records: [],
      updated_at: null
    };
    fs.writeFileSync(file, JSON.stringify(initial, null, 2), 'utf-8');
    return initial;
  }
}

module.exports = {
  loadMemory,
  saveMemory,
  appendConversation,
  updateLastTopic,
  loadProjects,
  addProject,
  loadProfile
};
