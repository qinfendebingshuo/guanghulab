/**
 * persona-studio · 知识提取引擎
 *
 * 触发：代码生成完成时 / 用户确认方案时 / 解决技术问题时
 * 功能：从对话中提取有价值的知识条目存入 knowledge-base.json
 */
const fs = require('fs');
const path = require('path');

const BRAIN_DIR = path.join(__dirname, '..', '..', 'brain');
const KB_PATH = path.join(BRAIN_DIR, 'knowledge-base.json');

/**
 * 加载知识库
 */
function loadKnowledgeBase() {
  try {
    return JSON.parse(fs.readFileSync(KB_PATH, 'utf-8'));
  } catch {
    return {
      schema_version: '1.0',
      description: '系统知识库 · 自动积累',
      last_updated: null,
      total_entries: 0,
      entries: []
    };
  }
}

/**
 * 保存知识库
 */
function saveKnowledgeBase(kb) {
  kb.last_updated = new Date().toISOString();
  kb.total_entries = kb.entries.length;
  fs.writeFileSync(KB_PATH, JSON.stringify(kb, null, 2), 'utf-8');
}

/**
 * 从对话中提取技术方案
 */
function extractSolutions(conversation, sourceExp, sourceProject) {
  const entries = [];
  const messages = conversation || [];

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    if (msg.role !== 'assistant') continue;
    const content = msg.content || '';

    // 检测方案类关键词
    if (/技术方案|解决方案|实现方式|推荐.*方案|建议使用/i.test(content)) {
      entries.push({
        id: 'KB-' + Date.now() + '-' + i,
        type: 'solution',
        category: detectCategory(content),
        tags: extractTags(content),
        title: extractTitle(content),
        content: content.substring(0, 1000),
        source_exp: sourceExp,
        source_project: sourceProject || null,
        usage_count: 0,
        created_at: new Date().toISOString()
      });
    }

    // 检测最佳实践
    if (/最佳实践|best practice|推荐做法|正确.*方式/i.test(content)) {
      entries.push({
        id: 'KB-' + Date.now() + '-bp-' + i,
        type: 'best_practice',
        category: detectCategory(content),
        tags: extractTags(content),
        title: extractTitle(content),
        content: content.substring(0, 1000),
        source_exp: sourceExp,
        source_project: sourceProject || null,
        usage_count: 0,
        created_at: new Date().toISOString()
      });
    }

    // 检测常见陷阱
    if (/注意|陷阱|坑|避免|不要.*这样|常见错误|pitfall/i.test(content)) {
      entries.push({
        id: 'KB-' + Date.now() + '-pit-' + i,
        type: 'pitfall',
        category: detectCategory(content),
        tags: extractTags(content),
        title: extractTitle(content),
        content: content.substring(0, 1000),
        source_exp: sourceExp,
        source_project: sourceProject || null,
        usage_count: 0,
        created_at: new Date().toISOString()
      });
    }
  }

  return entries;
}

/**
 * 检测技术类别
 */
function detectCategory(content) {
  const lower = content.toLowerCase();
  if (/react|vue|angular|前端|frontend|html|css|ui/i.test(lower)) return 'frontend';
  if (/node|express|api|后端|backend|server|数据库|sql/i.test(lower)) return 'backend';
  if (/docker|部署|deploy|ci|cd|运维|devops|nginx/i.test(lower)) return 'devops';
  if (/设计|design|ux|ui|交互|布局|layout/i.test(lower)) return 'design';
  if (/安全|security|auth|鉴权|加密|token/i.test(lower)) return 'security';
  if (/性能|performance|优化|缓存|cache/i.test(lower)) return 'performance';
  return 'general';
}

/**
 * 提取标签
 */
function extractTags(content) {
  const tags = [];
  const techKeywords = [
    'javascript', 'typescript', 'python', 'react', 'vue', 'node',
    'express', 'html', 'css', 'sql', 'mongodb', 'redis', 'docker',
    'nginx', 'git', 'api', 'rest', 'graphql', 'websocket'
  ];
  const lower = content.toLowerCase();
  techKeywords.forEach(function (kw) {
    if (lower.includes(kw)) tags.push(kw);
  });
  return tags.slice(0, 10);
}

/**
 * 提取标题（取第一行非空文本的前50字符）
 */
function extractTitle(content) {
  const lines = content.split('\n').filter(function (l) { return l.trim().length > 0; });
  if (lines.length === 0) return '未命名知识条目';
  const first = lines[0].replace(/^[#*\-\s]+/, '').trim();
  return first.length > 50 ? first.substring(0, 50) + '…' : first;
}

/**
 * 将提取的知识添加到知识库（自动去重）
 */
function addToKnowledgeBase(entries) {
  if (!entries || entries.length === 0) return;

  const kb = loadKnowledgeBase();

  entries.forEach(function (entry) {
    // 简单去重：同标题+同类型 = 已存在
    const exists = kb.entries.some(function (existing) {
      return existing.title === entry.title && existing.type === entry.type;
    });
    if (!exists) {
      kb.entries.push(entry);
    }
  });

  // 保留最近 500 条
  if (kb.entries.length > 500) {
    kb.entries = kb.entries.slice(-500);
  }

  saveKnowledgeBase(kb);
}

/**
 * 查询知识库（供 persona-engine 调用）
 * @param {string} query - 搜索关键词
 * @param {number} limit - 最大返回数量
 * @returns {Array} 匹配的知识条目
 */
function queryKnowledge(query, limit) {
  const kb = loadKnowledgeBase();
  if (!query || kb.entries.length === 0) return [];

  const lowerQuery = query.toLowerCase();
  const keywords = lowerQuery.split(/[\s,，。.!?？！]+/).filter(Boolean);

  const scored = kb.entries.map(function (entry) {
    let score = 0;
    const entryText = ((entry.title || '') + ' ' + (entry.content || '') + ' ' + (entry.tags || []).join(' ')).toLowerCase();

    keywords.forEach(function (kw) {
      if (entryText.includes(kw)) score += 1;
    });

    // 使用次数加权
    score += (entry.usage_count || 0) * 0.1;

    return { entry: entry, score: score };
  });

  return scored
    .filter(function (s) { return s.score > 0; })
    .sort(function (a, b) { return b.score - a.score; })
    .slice(0, limit || 5)
    .map(function (s) {
      // 增加使用计数
      s.entry.usage_count = (s.entry.usage_count || 0) + 1;
      return s.entry;
    });
}

/**
 * 核心方法：自动提取知识
 */
function autoExtractKnowledge(devId, conversation, projectName) {
  const entries = extractSolutions(conversation, devId, projectName);
  if (entries.length > 0) {
    addToKnowledgeBase(entries);
  }
  return entries.length;
}

module.exports = {
  autoExtractKnowledge,
  queryKnowledge,
  loadKnowledgeBase,
  addToKnowledgeBase,
  extractSolutions
};
