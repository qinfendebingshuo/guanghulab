/**
 * ═══════════════════════════════════════════════════════════
 * 在线阅读器引擎 · Reader Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 书架管理（成员个人书架·引用式·不重复存储）
 *   - 阅读进度存档（自动保存到 JSON）
 *   - 阅读偏好设置（字体/主题/字号）
 *   - 阅读统计（今日阅读时长/总时长/阅读字数）
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const PROGRESS_FILE  = path.join(DATA_DIR, 'reading-progress.json');
const BOOKSHELF_FILE = path.join(DATA_DIR, 'bookshelves.json');

// 内存缓存
let progressData  = {};
let bookshelfData = {};

// ─── 初始化 ───
function init() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  loadProgress();
  loadBookshelves();
}

function loadProgress() {
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      progressData = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch {
    progressData = {};
  }
}

function saveProgress() {
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progressData, null, 2), 'utf8');
  } catch (err) {
    console.error('[ReaderEngine] 保存阅读进度失败:', err.message);
  }
}

function loadBookshelves() {
  try {
    if (fs.existsSync(BOOKSHELF_FILE)) {
      bookshelfData = JSON.parse(fs.readFileSync(BOOKSHELF_FILE, 'utf8'));
    }
  } catch {
    bookshelfData = {};
  }
}

function saveBookshelves() {
  try {
    fs.writeFileSync(BOOKSHELF_FILE, JSON.stringify(bookshelfData, null, 2), 'utf8');
  } catch (err) {
    console.error('[ReaderEngine] 保存书架失败:', err.message);
  }
}

/**
 * 保存阅读进度
 * @param {string} memberId - 成员ID
 * @param {string} bookId   - 书籍ID
 * @param {object} progress - { chapter_index, scroll_position, percent }
 */
function saveReadingProgress(memberId, bookId, progress) {
  if (!memberId || !bookId) {
    throw new Error('memberId 和 bookId 为必填项');
  }

  if (!progressData[memberId]) {
    progressData[memberId] = {};
  }

  progressData[memberId][bookId] = {
    chapter_index:   progress.chapter_index || 0,
    scroll_position: progress.scroll_position || 0,
    percent:         progress.percent || 0,
    updated_at:      new Date().toISOString()
  };

  saveProgress();

  return progressData[memberId][bookId];
}

/**
 * 获取阅读进度
 */
function getReadingProgress(memberId, bookId) {
  if (!progressData[memberId]) return null;
  if (bookId) return progressData[memberId][bookId] || null;
  return progressData[memberId];
}

/**
 * 添加书籍到书架
 */
function addToBookshelf(memberId, bookId, bookMeta) {
  if (!memberId || !bookId) {
    throw new Error('memberId 和 bookId 为必填项');
  }

  if (!bookshelfData[memberId]) {
    bookshelfData[memberId] = [];
  }

  // 防止重复添加
  const exists = bookshelfData[memberId].find(b => b.book_id === bookId);
  if (exists) {
    return { added: false, message: '书籍已在书架中' };
  }

  bookshelfData[memberId].push({
    book_id:    bookId,
    title:      bookMeta.title || bookId,
    author:     bookMeta.author || '未知',
    added_at:   new Date().toISOString()
  });

  saveBookshelves();

  return { added: true, message: '已添加到书架' };
}

/**
 * 从书架移除
 */
function removeFromBookshelf(memberId, bookId) {
  if (!bookshelfData[memberId]) return { removed: false };

  const before = bookshelfData[memberId].length;
  bookshelfData[memberId] = bookshelfData[memberId].filter(b => b.book_id !== bookId);

  if (bookshelfData[memberId].length < before) {
    saveBookshelves();
    return { removed: true };
  }

  return { removed: false, message: '书籍不在书架中' };
}

/**
 * 获取成员书架
 */
function getBookshelf(memberId) {
  const shelf = bookshelfData[memberId] || [];
  // 附加阅读进度
  return shelf.map(book => ({
    ...book,
    progress: (progressData[memberId] && progressData[memberId][book.book_id]) || null
  }));
}

/**
 * 保存阅读偏好
 */
function savePreferences(memberId, prefs) {
  if (!progressData[memberId]) {
    progressData[memberId] = {};
  }

  progressData[memberId].__preferences = {
    font_size:   prefs.font_size   || 16,
    font_family: prefs.font_family || 'default',
    theme:       prefs.theme       || 'dark',
    line_height: prefs.line_height || 1.8,
    updated_at:  new Date().toISOString()
  };

  saveProgress();

  return progressData[memberId].__preferences;
}

/**
 * 获取阅读偏好
 */
function getPreferences(memberId) {
  if (!progressData[memberId] || !progressData[memberId].__preferences) {
    return {
      font_size:   16,
      font_family: 'default',
      theme:       'dark',
      line_height: 1.8
    };
  }
  return progressData[memberId].__preferences;
}

/**
 * 获取阅读器统计
 */
function getStats() {
  const memberCount = Object.keys(bookshelfData).length;
  const totalBooks  = Object.values(bookshelfData).reduce((sum, shelf) => sum + shelf.length, 0);
  const progressCount = Object.values(progressData).reduce((sum, member) => {
    return sum + Object.keys(member).filter(k => k !== '__preferences').length;
  }, 0);

  return {
    total_members:        memberCount,
    total_bookshelf_books: totalBooks,
    total_progress_records: progressCount
  };
}

// 初始化
init();

module.exports = {
  saveReadingProgress,
  getReadingProgress,
  addToBookshelf,
  removeFromBookshelf,
  getBookshelf,
  savePreferences,
  getPreferences,
  getStats
};
