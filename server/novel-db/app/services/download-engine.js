/**
 * ═══════════════════════════════════════════════════════════
 * 下载引擎 · Download Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 接收下载任务（书名+作者+平台）
 *   - 任务队列管理（排队/执行/完成/失败）
 *   - TXT 文件存储到本地 data/books/
 *   - 下载完成后自动触发分章引擎
 *   - 开源小说下载器数据库匹配（优先本地库匹配）
 *
 * 支持平台:
 *   - qimao   (七猫)
 *   - fanqie  (番茄)
 *   - yuewen  (阅文)
 *   - jjwxc   (晋江)
 *
 * 开源数据源:
 *   - novel-downloader (GitHub: 404)
 *   - FreeNovel (GitHub: cnbattle/novel)
 *   - NovelHarvester (GitHub: unclezs/NovelHarvester)
 *   - biqugen / zxcs (知轩藏书)
 *   - 69shu / 笔趣阁系列
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const BOOKS_DIR = process.env.BOOKS_DIR || path.join(__dirname, '..', 'data', 'books');
const TASKS_FILE = path.join(__dirname, '..', 'data', 'download-tasks.json');
const SOURCES_FILE = path.join(__dirname, '..', 'data', 'book-sources.json');

const SUPPORTED_PLATFORMS = ['qimao', 'fanqie', 'yuewen', 'jjwxc'];

// ═══════════════════════════════════════════════════════════
// 开源小说下载器数据库注册表
// ═══════════════════════════════════════════════════════════
const OPEN_SOURCE_REGISTRIES = [
  {
    id: 'novel-downloader',
    name: 'novel-downloader',
    description: '全平台小说下载工具 · 支持多源聚合',
    url: 'https://github.com/404',
    type: 'downloader',
    platforms: ['qimao', 'fanqie', 'yuewen', 'jjwxc', 'qidian'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  },
  {
    id: 'novel-harvester',
    name: 'NovelHarvester (uncle小说)',
    description: 'Java桌面端小说下载器 · 全平台采集',
    url: 'https://github.com/unclezs/NovelHarvester',
    type: 'downloader',
    platforms: ['qimao', 'fanqie', 'yuewen', 'qidian', 'biquge'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  },
  {
    id: 'free-novel',
    name: 'FreeNovel (cnbattle)',
    description: 'Go语言小说聚合 · 多源搜索下载',
    url: 'https://github.com/cnbattle/novel',
    type: 'aggregator',
    platforms: ['biquge', '69shu', 'shuquge', 'xbiquge'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  },
  {
    id: 'zxcs-archive',
    name: '知轩藏书数据库',
    description: '精校TXT小说归档 · 含大量完本',
    url: 'https://zxcs.info',
    type: 'archive',
    platforms: ['zxcs'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  },
  {
    id: 'biquge-series',
    name: '笔趣阁系列源',
    description: '笔趣阁及镜像站 · 免费小说资源',
    url: 'https://www.biquge.com',
    type: 'source',
    platforms: ['biquge', 'xbiquge', 'ibiquge'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  },
  {
    id: '69shu-archive',
    name: '69书吧数据库',
    description: '69书吧 · 大量TXT小说资源',
    url: 'https://www.69shu.com',
    type: 'source',
    platforms: ['69shu'],
    status: 'registered',
    book_count_estimate: 0,
    last_checked: null
  }
];

// 本地书源索引 (缓存已知可匹配的书籍列表)
let bookSourceIndex = Object.create(null);

function loadBookSources() {
  try {
    if (fs.existsSync(SOURCES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(SOURCES_FILE, 'utf8'));
      bookSourceIndex = Object.create(null);
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const key of Object.keys(raw)) {
          if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
            bookSourceIndex[key] = raw[key];
          }
        }
      }
    }
  } catch {
    bookSourceIndex = Object.create(null);
  }
}

function saveBookSources() {
  try {
    const dir = path.dirname(SOURCES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SOURCES_FILE, JSON.stringify(bookSourceIndex, null, 2), 'utf8');
  } catch (err) {
    console.error('[DownloadEngine] 保存书源索引失败:', err.message);
  }
}

/**
 * 搜索开源数据库匹配
 * @param {string} bookName - 书名
 * @param {string} author - 作者
 * @returns {object} 匹配结果
 */
function searchOpenSources(bookName, author) {
  const query = (bookName || '').trim().toLowerCase();
  const authorQuery = (author || '').trim().toLowerCase();
  const matches = [];

  // 1. 搜索本地书源索引（已缓存的书籍）
  for (const key of Object.keys(bookSourceIndex)) {
    const entry = bookSourceIndex[key];
    if (!entry || typeof entry !== 'object') continue;
    const name = (entry.book_name || '').toLowerCase();
    const auth = (entry.author || '').toLowerCase();

    if (name.includes(query) || query.includes(name)) {
      if (!authorQuery || auth.includes(authorQuery) || authorQuery.includes(auth)) {
        matches.push({
          source_id: entry.source_id || 'local',
          source_name: entry.source_name || '本地缓存',
          book_name: entry.book_name,
          author: entry.author,
          match_type: name === query ? 'exact' : 'partial',
          available: true,
          file_path: entry.file_path || null
        });
      }
    }
  }

  // 2. 检查已下载的书籍
  const localBooks = listBooks();
  for (const book of localBooks) {
    const name = (book.book_name || '').toLowerCase();
    if (name.includes(query) || query.includes(name)) {
      if (!authorQuery || (book.author || '').toLowerCase().includes(authorQuery)) {
        const alreadyMatched = matches.some(m => m.book_name === book.book_name && m.source_id === 'local-downloaded');
        if (!alreadyMatched) {
          matches.push({
            source_id: 'local-downloaded',
            source_name: '本地已下载',
            book_name: book.book_name,
            author: book.author,
            match_type: name === query ? 'exact' : 'partial',
            available: true,
            file_path: book.filename
          });
        }
      }
    }
  }

  // 3. 返回注册的数据源列表（标注哪些可能有这本书）
  const potentialSources = OPEN_SOURCE_REGISTRIES.map(reg => ({
    source_id: reg.id,
    source_name: reg.name,
    type: reg.type,
    status: reg.status,
    platforms: reg.platforms,
    url: reg.url,
    can_search: reg.status === 'connected',
    description: reg.description
  }));

  return {
    query: { book_name: bookName, author: author || '' },
    local_matches: matches,
    local_match_count: matches.length,
    registered_sources: potentialSources,
    registered_source_count: potentialSources.length,
    recommendation: matches.length > 0
      ? '本地已有匹配，建议直接使用'
      : '本地无匹配，将尝试从平台下载'
  };
}

/**
 * 获取所有注册数据源信息
 */
function getRegisteredSources() {
  return OPEN_SOURCE_REGISTRIES.map(reg => ({
    id: reg.id,
    name: reg.name,
    description: reg.description,
    type: reg.type,
    url: reg.url,
    platforms: reg.platforms,
    status: reg.status,
    book_count_estimate: reg.book_count_estimate,
    last_checked: reg.last_checked
  }));
}

/**
 * 添加书源记录到本地索引
 */
function addBookSource(bookName, author, sourceId, sourceName, filePath) {
  const key = `${(bookName || '').trim()}_${(author || '').trim()}`.toLowerCase();
  bookSourceIndex[key] = {
    book_name: (bookName || '').trim(),
    author: (author || '').trim(),
    source_id: sourceId,
    source_name: sourceName,
    file_path: filePath || null,
    indexed_at: new Date().toISOString()
  };
  saveBookSources();
}

// 内存任务队列
let tasks = [];

// ─── 初始化 ───
function init() {
  if (!fs.existsSync(BOOKS_DIR)) {
    fs.mkdirSync(BOOKS_DIR, { recursive: true });
  }
  loadTasks();
}

// ─── 持久化任务列表 ───
function saveTasks() {
  try {
    const dir = path.dirname(TASKS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TASKS_FILE, JSON.stringify(tasks, null, 2), 'utf8');
  } catch (err) {
    console.error('[DownloadEngine] 保存任务列表失败:', err.message);
  }
}

function loadTasks() {
  try {
    if (fs.existsSync(TASKS_FILE)) {
      tasks = JSON.parse(fs.readFileSync(TASKS_FILE, 'utf8'));
    }
  } catch {
    tasks = [];
  }
}

/**
 * 创建下载任务
 * @param {object} params - { book_name, author, platform, requested_by }
 * @returns {object} task
 */
function createTask({ book_name, author, platform, requested_by }) {
  if (!book_name || !platform) {
    throw new Error('book_name 和 platform 为必填项');
  }

  if (!SUPPORTED_PLATFORMS.includes(platform)) {
    throw new Error(`不支持的平台: ${platform}。支持: ${SUPPORTED_PLATFORMS.join(', ')}`);
  }

  const taskId = `DL-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const task = {
    task_id:      taskId,
    book_name:    book_name.trim(),
    author:       (author || '未知').trim(),
    platform,
    status:       'queued',
    requested_by: requested_by || 'system',
    created_at:   new Date().toISOString(),
    updated_at:   new Date().toISOString(),
    file_path:    null,
    file_size:    null,
    error:        null
  };

  tasks.push(task);
  saveTasks();

  // 异步执行下载（模拟）
  processTask(taskId);

  return task;
}

/**
 * 处理下载任务（Phase 2 使用本地模拟 · Phase 3 接入真实下载器）
 */
async function processTask(taskId) {
  const task = tasks.find(t => t.task_id === taskId);
  if (!task) return;

  task.status = 'downloading';
  task.updated_at = new Date().toISOString();
  saveTasks();

  try {
    // Phase 2: 创建占位 TXT 文件（模拟下载完成）
    // Phase 3: 接入真实下载器（七猫/番茄/阅文/晋江 API 或爬虫）
    const safeBookName = task.book_name.replace(/[<>:"/\\|?*]/g, '_');
    const safeAuthor   = task.author.replace(/[<>:"/\\|?*]/g, '_');
    const filename     = `${safeBookName}_${safeAuthor}_${task.platform}.txt`;
    const filePath     = path.join(BOOKS_DIR, filename);

    // 模拟下载延时
    await new Promise(resolve => setTimeout(resolve, 500));

    // 生成占位内容
    const content = [
      `《${task.book_name}》`,
      `作者: ${task.author}`,
      `平台: ${task.platform}`,
      `下载时间: ${new Date().toISOString()}`,
      '',
      '─'.repeat(40),
      '',
      '第一章 开始',
      '',
      '这是一本好书。下载引擎已成功创建书籍记录。',
      '真实内容将在接入开源下载器后自动填充。',
      '',
      '─'.repeat(40),
      '',
      '第二章 世界',
      '',
      '世界很大，故事很长。',
      '每一章都是一个新的开始。',
      '',
      '─'.repeat(40),
      '',
      '第三章 结尾',
      '',
      '故事未完待续。',
      '智库节点 Phase 2 · 下载引擎占位内容。',
      ''
    ].join('\n');

    fs.writeFileSync(filePath, content, 'utf8');

    const stats = fs.statSync(filePath);
    task.status    = 'completed';
    task.file_path = filename;
    task.file_size = stats.size;
    task.updated_at = new Date().toISOString();

    // 自动将下载的书籍加入书源索引
    addBookSource(task.book_name, task.author, 'platform-' + task.platform, task.platform, filename);
  } catch (err) {
    task.status  = 'failed';
    task.error   = err.message;
    task.updated_at = new Date().toISOString();
  }

  saveTasks();
}

/**
 * 获取任务列表
 * @param {object} filter - { status, platform, limit }
 */
function listTasks({ status, platform, limit } = {}) {
  let result = [...tasks];

  if (status)   result = result.filter(t => t.status === status);
  if (platform) result = result.filter(t => t.platform === platform);

  result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  if (limit) result = result.slice(0, limit);

  return result;
}

/**
 * 获取单个任务
 */
function getTask(taskId) {
  return tasks.find(t => t.task_id === taskId) || null;
}

/**
 * 获取已下载书籍列表
 */
function listBooks() {
  if (!fs.existsSync(BOOKS_DIR)) return [];

  return fs.readdirSync(BOOKS_DIR)
    .filter(f => f.endsWith('.txt'))
    .map(filename => {
      const filePath = path.join(BOOKS_DIR, filename);
      const stats    = fs.statSync(filePath);
      // 从文件名解析信息
      const parts = filename.replace('.txt', '').split('_');
      return {
        filename,
        book_name: parts[0] || filename,
        author:    parts[1] || '未知',
        platform:  parts[2] || '未知',
        size:      stats.size,
        created_at: stats.birthtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

/**
 * 获取书籍内容
 */
function getBookContent(filename) {
  const filePath = path.join(BOOKS_DIR, filename);
  if (!fs.existsSync(filePath)) return null;

  // 防止路径遍历
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(BOOKS_DIR);
  if (!resolvedPath.startsWith(resolvedBase)) return null;

  return fs.readFileSync(filePath, 'utf8');
}

/**
 * 获取引擎统计
 */
function getStats() {
  const books    = listBooks();
  const allTasks = listTasks();

  return {
    total_books:      books.length,
    total_tasks:      allTasks.length,
    queued_tasks:     allTasks.filter(t => t.status === 'queued').length,
    downloading:      allTasks.filter(t => t.status === 'downloading').length,
    completed_tasks:  allTasks.filter(t => t.status === 'completed').length,
    failed_tasks:     allTasks.filter(t => t.status === 'failed').length,
    total_size_bytes: books.reduce((sum, b) => sum + b.size, 0),
    supported_platforms: SUPPORTED_PLATFORMS,
    registered_sources: OPEN_SOURCE_REGISTRIES.length,
    local_index_count: Object.keys(bookSourceIndex).length
  };
}

// 初始化
init();
loadBookSources();

module.exports = {
  createTask,
  listTasks,
  getTask,
  listBooks,
  getBookContent,
  getStats,
  searchOpenSources,
  getRegisteredSources,
  addBookSource,
  SUPPORTED_PLATFORMS
};
