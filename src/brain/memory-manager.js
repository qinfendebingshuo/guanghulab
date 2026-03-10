// src/brain/memory-manager.js
// 记忆管理器 — 三层记忆架构
// 职责：短期/中期/长期记忆管理，记忆候选生成，写入判定
//
// 记忆分层：
//   短期（session）：当前会话消息，存在前端 + 进程内存
//   中期（task）：当前任务状态、开发者进度、决策上下文，存在进程内存
//   长期（persistent）：身份信息、项目目标、关键决策，写入 brain 文件

'use strict';

const fs = require('fs');
const path = require('path');

// 中期记忆存储（进程内存，重启丢失）
const taskMemory = new Map();

// 记忆候选关键词 — 检测哪些信息值得生成记忆候选
const MEMORY_CANDIDATE_PATTERNS = [
  { type: 'identity_change',  pattern: /身份|角色|权限|加入团队|离开|转岗/i,           priority: 'high' },
  { type: 'project_goal',     pattern: /目标|里程碑|milestone|deadline|截止|规划|roadmap/i, priority: 'high' },
  { type: 'module_ownership', pattern: /负责|接手|模块|m\d{2}-|归属|分工/i,              priority: 'medium' },
  { type: 'decision',         pattern: /决定|确定|方案|选择|采用|放弃|不再|改为/i,        priority: 'high' },
  { type: 'todo',             pattern: /待办|todo|下一步|接下来|计划|需要做/i,             priority: 'medium' },
  { type: 'bug_fix',          pattern: /修复|fix|解决|排查到|根因|原因是/i,               priority: 'low' },
  { type: 'deployment',       pattern: /上线|部署|发布|deploy|release|版本/i,             priority: 'medium' },
];

/**
 * 判定规则：是否值得写入长期记忆
 * 不是什么都记——只记高优先级的、或中等优先级且重复出现的
 */
const WRITE_RULES = {
  high: { minOccurrences: 1, description: '首次出现即记录' },
  medium: { minOccurrences: 2, description: '重复提及 2 次后记录' },
  low: { minOccurrences: 3, description: '反复提及 3 次后记录' },
};

/**
 * 分析文本，生成记忆候选
 * @param {string} text - 要分析的文本
 * @param {string} source - 来源 (user/assistant/system)
 * @returns {Array<{type: string, priority: string, excerpt: string, shouldPersist: boolean}>}
 */
function generateCandidates(text, source = 'user') {
  if (!text || typeof text !== 'string') return [];

  const candidates = [];
  for (const { type, pattern, priority } of MEMORY_CANDIDATE_PATTERNS) {
    if (pattern.test(text)) {
      // 提取匹配上下文的前后50字符作为摘要
      const match = text.match(pattern);
      const idx = match ? match.index : 0;
      const start = Math.max(0, idx - 30);
      const end = Math.min(text.length, idx + 80);
      const excerpt = text.slice(start, end).replace(/\n/g, ' ').trim();

      // 检查中期记忆中的出现次数（使用类型+摘要前40字符作为键，降低碰撞风险）
      const memKey = type + ':' + excerpt.slice(0, 40).replace(/\s+/g, '_');
      const taskEntry = taskMemory.get(memKey) || { count: 0 };
      taskEntry.count++;
      taskEntry.lastSeen = Date.now();
      taskMemory.set(memKey, taskEntry);

      const rule = WRITE_RULES[priority];
      const shouldPersist = taskEntry.count >= rule.minOccurrences;

      candidates.push({
        type,
        priority,
        excerpt,
        source,
        shouldPersist,
        occurrences: taskEntry.count,
        threshold: rule.minOccurrences,
      });
    }
  }

  return candidates;
}

/**
 * 保存记忆到中期存储（任务级别）
 * @param {string} sessionId
 * @param {string} key
 * @param {*} value
 */
function setTaskMemory(sessionId, key, value) {
  const sKey = sessionId + ':' + key;
  taskMemory.set(sKey, { value, updatedAt: Date.now() });
}

/**
 * 读取中期记忆
 * @param {string} sessionId
 * @param {string} key
 * @returns {*}
 */
function getTaskMemory(sessionId, key) {
  const entry = taskMemory.get(sessionId + ':' + key);
  return entry ? entry.value : undefined;
}

/**
 * 清理过期的中期记忆（超过 2 小时的条目）
 */
function cleanupTaskMemory() {
  const cutoff = Date.now() - 2 * 60 * 60 * 1000;
  for (const [key, entry] of taskMemory.entries()) {
    const ts = entry.updatedAt || entry.lastSeen || 0;
    if (ts < cutoff) {
      taskMemory.delete(key);
    }
  }
}

// 每 30 分钟清理一次过期中期记忆
const cleanupInterval = setInterval(cleanupTaskMemory, 30 * 60 * 1000);
// 允许进程在没有其他活动时优雅退出
if (cleanupInterval.unref) cleanupInterval.unref();

/**
 * 获取长期记忆（从 brain 文件读取）
 * @returns {Object}
 */
function loadLongTermMemory() {
  const memoryPath = path.join(__dirname, '../../.github/brain/memory.json');
  try {
    return JSON.parse(fs.readFileSync(memoryPath, 'utf8'));
  } catch (e) {
    return null;
  }
}

/**
 * 获取记忆层状态概览
 */
function getMemoryStatus() {
  const longTerm = loadLongTermMemory();
  return {
    layers: {
      short_term: { type: 'session', storage: 'frontend + process', description: '当前会话消息' },
      mid_term: { type: 'task', storage: 'process memory', entries: taskMemory.size, description: '当前任务/开发者状态' },
      long_term: { type: 'persistent', storage: 'brain files', loaded: !!longTerm, description: '身份/目标/决策/待办' },
    },
    write_rules: WRITE_RULES,
    candidate_types: MEMORY_CANDIDATE_PATTERNS.map(p => ({ type: p.type, priority: p.priority })),
    recovery_path: [
      '.github/brain/memory.json',
      '.github/brain/routing-map.json',
      '.github/brain/wake-protocol.md',
      '.github/persona-brain/dev-status.json',
    ],
  };
}

module.exports = {
  generateCandidates,
  setTaskMemory,
  getTaskMemory,
  cleanupTaskMemory,
  loadLongTermMemory,
  getMemoryStatus,
  MEMORY_CANDIDATE_PATTERNS,
  WRITE_RULES,
};
