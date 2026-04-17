/**
 * ═══════════════════════════════════════════════════════════
 * 智能小说系统 · Novel Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * ZY-PROJ-004 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 小说项目管理 (创建/列表/详情/删除)
 *   - 章节管理 (CRUD + 排序)
 *   - 人物卡管理 (创建/编辑/关系图)
 *   - 大纲管理 (层级大纲 + 节点)
 *   - AI辅助写作 (续写/改写/情节建议 · SSE流式)
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR    = path.join(__dirname, '..', 'data');
const NOVELS_FILE = path.join(DATA_DIR, 'novels.json');

let novelsData = Object.create(null);

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
    if (fs.existsSync(NOVELS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(NOVELS_FILE, 'utf8'));
      novelsData = Object.create(null);
      if (raw.novels) novelsData.novels = raw.novels;
      else novelsData.novels = [];
    } else {
      novelsData.novels = [];
    }
  } catch {
    novelsData.novels = [];
  }
}

function save() {
  try {
    fs.writeFileSync(NOVELS_FILE, JSON.stringify(novelsData, null, 2), 'utf8');
  } catch (err) {
    console.error('[NovelEngine] 保存失败:', err.message);
  }
}

// ══════════════════════════════════════════
// 小说项目 CRUD
// ══════════════════════════════════════════

function createNovel({ title, author, genre, synopsis, target_words }) {
  if (!title) throw new Error('title 为必填项');

  const novelId = `NVL-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const novel = {
    novel_id:     novelId,
    title:        title.trim(),
    author:       (author || '未知').trim(),
    genre:        genre || '玄幻',
    synopsis:     (synopsis || '').slice(0, 1000),
    target_words: target_words || 0,
    status:       'drafting',
    chapters:     [],
    characters:   [],
    outline:      [],
    word_count:   0,
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString()
  };

  novelsData.novels.push(novel);
  save();
  return novel;
}

function listNovels({ author, status, limit } = {}) {
  let result = [...novelsData.novels];
  if (author) result = result.filter(n => n.author === author);
  if (status) result = result.filter(n => n.status === status);
  result.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  if (limit) result = result.slice(0, limit);
  return result;
}

function getNovel(novelId) {
  if (!sanitizeId(novelId)) return null;
  return novelsData.novels.find(n => n.novel_id === novelId) || null;
}

function updateNovel(novelId, updates) {
  if (!sanitizeId(novelId)) throw new Error('非法 novelId');
  const novel = novelsData.novels.find(n => n.novel_id === novelId);
  if (!novel) throw new Error('小说不存在');

  const allowed = ['title', 'genre', 'synopsis', 'target_words', 'status'];
  for (const key of allowed) {
    if (updates[key] !== undefined) novel[key] = updates[key];
  }
  novel.updated_at = new Date().toISOString();
  save();
  return novel;
}

function deleteNovel(novelId) {
  if (!sanitizeId(novelId)) throw new Error('非法 novelId');
  const idx = novelsData.novels.findIndex(n => n.novel_id === novelId);
  if (idx === -1) throw new Error('小说不存在');
  novelsData.novels.splice(idx, 1);
  save();
  return { deleted: true };
}

// ══════════════════════════════════════════
// 章节管理
// ══════════════════════════════════════════

function addChapter(novelId, { title, content, order }) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');

  const chapterId = `CH-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const chapter = {
    chapter_id: chapterId,
    title:      (title || `第${novel.chapters.length + 1}章`).slice(0, 100),
    content:    (content || '').slice(0, 50000),
    order:      order !== undefined ? order : novel.chapters.length,
    word_count: (content || '').replace(/\s/g, '').length,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  novel.chapters.push(chapter);
  novel.word_count = novel.chapters.reduce((s, c) => s + c.word_count, 0);
  novel.updated_at = new Date().toISOString();
  save();
  return chapter;
}

function getChapter(novelId, chapterId) {
  const novel = getNovel(novelId);
  if (!novel) return null;
  if (!sanitizeId(chapterId)) return null;
  return novel.chapters.find(c => c.chapter_id === chapterId) || null;
}

function updateChapter(novelId, chapterId, updates) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');
  if (!sanitizeId(chapterId)) throw new Error('非法 chapterId');

  const chapter = novel.chapters.find(c => c.chapter_id === chapterId);
  if (!chapter) throw new Error('章节不存在');

  if (updates.title !== undefined) chapter.title = updates.title.slice(0, 100);
  if (updates.content !== undefined) {
    chapter.content = updates.content.slice(0, 50000);
    chapter.word_count = updates.content.replace(/\s/g, '').length;
  }
  if (updates.order !== undefined) chapter.order = updates.order;

  chapter.updated_at = new Date().toISOString();
  novel.word_count = novel.chapters.reduce((s, c) => s + c.word_count, 0);
  novel.updated_at = new Date().toISOString();
  save();
  return chapter;
}

function deleteChapter(novelId, chapterId) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');
  if (!sanitizeId(chapterId)) throw new Error('非法 chapterId');

  const idx = novel.chapters.findIndex(c => c.chapter_id === chapterId);
  if (idx === -1) throw new Error('章节不存在');

  novel.chapters.splice(idx, 1);
  novel.word_count = novel.chapters.reduce((s, c) => s + c.word_count, 0);
  novel.updated_at = new Date().toISOString();
  save();
  return { deleted: true };
}

function listChapters(novelId) {
  const novel = getNovel(novelId);
  if (!novel) return [];
  return [...novel.chapters].sort((a, b) => a.order - b.order);
}

// ══════════════════════════════════════════
// 人物卡管理
// ══════════════════════════════════════════

function addCharacter(novelId, { name, role, description, appearance, personality, relationships }) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');
  if (!name) throw new Error('name 为必填项');

  const charId = `CHR-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const character = {
    char_id:       charId,
    name:          name.trim().slice(0, 50),
    role:          role || '配角',
    description:   (description || '').slice(0, 1000),
    appearance:    (appearance || '').slice(0, 500),
    personality:   (personality || '').slice(0, 500),
    relationships: Array.isArray(relationships) ? relationships.slice(0, 20) : [],
    created_at:    new Date().toISOString(),
    updated_at:    new Date().toISOString()
  };

  novel.characters.push(character);
  novel.updated_at = new Date().toISOString();
  save();
  return character;
}

function updateCharacter(novelId, charId, updates) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');
  if (!sanitizeId(charId)) throw new Error('非法 charId');

  const character = novel.characters.find(c => c.char_id === charId);
  if (!character) throw new Error('人物不存在');

  const allowed = ['name', 'role', 'description', 'appearance', 'personality', 'relationships'];
  for (const key of allowed) {
    if (updates[key] !== undefined) character[key] = updates[key];
  }
  character.updated_at = new Date().toISOString();
  novel.updated_at = new Date().toISOString();
  save();
  return character;
}

function listCharacters(novelId) {
  const novel = getNovel(novelId);
  if (!novel) return [];
  return novel.characters;
}

// ══════════════════════════════════════════
// 大纲管理
// ══════════════════════════════════════════

function addOutlineNode(novelId, { title, content, parent_id, order }) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');

  const nodeId = `OL-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const node = {
    node_id:   nodeId,
    title:     (title || '未命名节点').slice(0, 100),
    content:   (content || '').slice(0, 2000),
    parent_id: parent_id || null,
    order:     order !== undefined ? order : novel.outline.length,
    created_at: new Date().toISOString()
  };

  novel.outline.push(node);
  novel.updated_at = new Date().toISOString();
  save();
  return node;
}

function updateOutlineNode(novelId, nodeId, updates) {
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');
  if (!sanitizeId(nodeId)) throw new Error('非法 nodeId');

  const node = novel.outline.find(n => n.node_id === nodeId);
  if (!node) throw new Error('节点不存在');

  if (updates.title !== undefined)    node.title = updates.title.slice(0, 100);
  if (updates.content !== undefined)  node.content = updates.content.slice(0, 2000);
  if (updates.parent_id !== undefined) node.parent_id = updates.parent_id;
  if (updates.order !== undefined)    node.order = updates.order;

  novel.updated_at = new Date().toISOString();
  save();
  return node;
}

function getOutline(novelId) {
  const novel = getNovel(novelId);
  if (!novel) return [];

  // 构建层级树
  const nodes = [...novel.outline].sort((a, b) => a.order - b.order);
  const roots = nodes.filter(n => !n.parent_id);
  const tree = roots.map(root => ({
    ...root,
    children: nodes.filter(n => n.parent_id === root.node_id)
  }));
  return tree;
}

// ══════════════════════════════════════════
// AI辅助写作 (MVP: 模板生成 · Phase 4: 接入LLM)
// ══════════════════════════════════════════

function aiContinue(novelId, chapterId, options) {
  const prompt = typeof options.prompt === 'string' ? options.prompt : '续写';
  const chapter = getChapter(novelId, chapterId);
  if (!chapter) throw new Error('章节不存在');

  const lastParagraph = (chapter.content || '').trim().split('\n').slice(-3).join('\n');

  // MVP: 生成模板续写提示
  return {
    type: 'continue',
    prompt_used: prompt,
    context: lastParagraph.slice(-200),
    generated: `[AI续写预留位 · 接入DeepSeek后自动生成]\n\n基于上文"${lastParagraph.slice(-50)}..."的续写将在此处呈现。\n\n当前为MVP占位内容。`,
    model: 'placeholder',
    note: 'Phase 4 将接入 DeepSeek/Kimi API 实现真实续写'
  };
}

function aiRewrite(novelId, chapterId, options) {
  const text = typeof options.text === 'string' ? options.text : '';
  const style = typeof options.style === 'string' ? options.style : 'default';
  return {
    type: 'rewrite',
    original: text.slice(0, 500),
    style: style,
    generated: `[AI改写预留位 · 接入DeepSeek后自动生成]\n\n原文将按"${style}"风格改写。`,
    model: 'placeholder',
    note: 'Phase 4 将接入 DeepSeek/Kimi API 实现真实改写'
  };
}

function aiSuggest(novelId, options) {
  const type = typeof options.type === 'string' ? options.type : 'plot';
  const novel = getNovel(novelId);
  if (!novel) throw new Error('小说不存在');

  const charNames = novel.characters.map(c => c.name).join('、') || '暂无人物';
  const chapterCount = novel.chapters.length;

  return {
    type: type,
    novel_title: novel.title,
    context: `${novel.genre}类型 · ${chapterCount}章 · 人物: ${charNames}`,
    suggestions: [
      `[建议1] 基于当前${chapterCount}章的走势，可以考虑引入新的冲突线...`,
      `[建议2] ${charNames.split('、')[0] || '主角'}的人物弧可以在接下来展开...`,
      `[建议3] 当前节奏适合加入一段过渡章节，调节阅读节奏...`
    ],
    model: 'placeholder',
    note: 'Phase 4 将接入 DeepSeek/Kimi API 实现真实情节建议'
  };
}

// ══════════════════════════════════════════
// 统计
// ══════════════════════════════════════════

function getStats() {
  const novels = novelsData.novels;
  return {
    total_novels:     novels.length,
    total_chapters:   novels.reduce((s, n) => s + n.chapters.length, 0),
    total_characters: novels.reduce((s, n) => s + n.characters.length, 0),
    total_words:      novels.reduce((s, n) => s + n.word_count, 0),
    by_status: {
      drafting:  novels.filter(n => n.status === 'drafting').length,
      writing:   novels.filter(n => n.status === 'writing').length,
      completed: novels.filter(n => n.status === 'completed').length,
      paused:    novels.filter(n => n.status === 'paused').length
    }
  };
}

init();

module.exports = {
  createNovel, listNovels, getNovel, updateNovel, deleteNovel,
  addChapter, getChapter, updateChapter, deleteChapter, listChapters,
  addCharacter, updateCharacter, listCharacters,
  addOutlineNode, updateOutlineNode, getOutline,
  aiContinue, aiRewrite, aiSuggest,
  getStats
};
