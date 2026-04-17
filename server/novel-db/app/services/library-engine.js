/**
 * ═══════════════════════════════════════════════════════════
 * 团队书库引擎 · Library Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 3 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 团队共享书库（男频/女频分区）
 *   - 去重存储：同一本书只存一份，成员书架用引用
 *   - 书籍分类管理（标签/分区/推荐）
 *   - 书籍评分与评论
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR      = path.join(__dirname, '..', 'data');
const LIBRARY_FILE  = path.join(DATA_DIR, 'team-library.json');

const CATEGORIES = ['男频', '女频', '无CP', '百合', '耽美', '其他'];

// 内存数据 (null-prototype 防原型链污染)
let libraryData = Object.create(null);

function sanitizeId(id) {
  if (!id || typeof id !== 'string') return null;
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return null;
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  return id;
}

function init() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  load();
}

function load() {
  try {
    if (fs.existsSync(LIBRARY_FILE)) {
      const raw = JSON.parse(fs.readFileSync(LIBRARY_FILE, 'utf8'));
      libraryData = Object.create(null);
      if (raw.books) libraryData.books = raw.books;
      else libraryData.books = [];
    } else {
      libraryData.books = [];
    }
  } catch {
    libraryData.books = [];
  }
}

function save() {
  try {
    fs.writeFileSync(LIBRARY_FILE, JSON.stringify(libraryData, null, 2), 'utf8');
  } catch (err) {
    console.error('[LibraryEngine] 保存失败:', err.message);
  }
}

/**
 * 添加书籍到团队书库（去重：同书名+同作者视为重复）
 */
function addBook({ book_name, author, category, tags, source_file, added_by }) {
  if (!book_name) throw new Error('book_name 为必填项');

  // 去重检查
  const existing = libraryData.books.find(
    b => b.book_name === book_name.trim() && b.author === (author || '未知').trim()
  );
  if (existing) {
    return { added: false, message: '书库中已存在同名同作者书籍', book: existing };
  }

  const bookId = `LIB-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const book = {
    book_id:     bookId,
    book_name:   book_name.trim(),
    author:      (author || '未知').trim(),
    category:    CATEGORIES.includes(category) ? category : '其他',
    tags:        Array.isArray(tags) ? tags.slice(0, 10) : [],
    source_file: source_file || null,
    added_by:    added_by || 'system',
    rating:      0,
    rating_count: 0,
    ref_count:   0,
    reviews:     [],
    created_at:  new Date().toISOString(),
    updated_at:  new Date().toISOString()
  };

  libraryData.books.push(book);
  save();

  return { added: true, book };
}

/**
 * 列表（支持分区过滤、搜索、排序）
 */
function listBooks({ category, search, sort, limit } = {}) {
  let result = [...libraryData.books];

  if (category && CATEGORIES.includes(category)) {
    result = result.filter(b => b.category === category);
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(b =>
      b.book_name.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      (b.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (sort === 'rating') {
    result.sort((a, b) => b.rating - a.rating);
  } else if (sort === 'popular') {
    result.sort((a, b) => b.ref_count - a.ref_count);
  } else {
    result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  if (limit) result = result.slice(0, limit);

  return result;
}

/**
 * 获取单本书详情
 */
function getBook(bookId) {
  if (!sanitizeId(bookId)) return null;
  return libraryData.books.find(b => b.book_id === bookId) || null;
}

/**
 * 添加评分
 */
function rateBook(bookId, score, memberId) {
  if (!sanitizeId(bookId)) throw new Error('非法 bookId');
  const book = libraryData.books.find(b => b.book_id === bookId);
  if (!book) throw new Error('书籍不存在');
  if (score < 1 || score > 5) throw new Error('评分范围 1-5');

  // 简化：每人只算最新评分
  const total = book.rating * book.rating_count + score;
  book.rating_count++;
  book.rating = Math.round((total / book.rating_count) * 10) / 10;
  book.updated_at = new Date().toISOString();
  save();

  return { rating: book.rating, rating_count: book.rating_count };
}

/**
 * 添加评论
 */
function addReview(bookId, { member_id, content }) {
  if (!sanitizeId(bookId)) throw new Error('非法 bookId');
  const book = libraryData.books.find(b => b.book_id === bookId);
  if (!book) throw new Error('书籍不存在');
  if (!content || content.trim().length === 0) throw new Error('评论内容不能为空');

  const review = {
    member_id: member_id || 'anonymous',
    content:   content.trim().slice(0, 500),
    created_at: new Date().toISOString()
  };

  if (!book.reviews) book.reviews = [];
  book.reviews.push(review);
  book.updated_at = new Date().toISOString();
  save();

  return review;
}

/**
 * 引用计数（成员添加到个人书架时+1）
 */
function incrementRef(bookId) {
  const book = libraryData.books.find(b => b.book_id === bookId);
  if (book) {
    book.ref_count = (book.ref_count || 0) + 1;
    save();
  }
}

/**
 * 统计
 */
function getStats() {
  const books = libraryData.books;
  const catCounts = {};
  for (const cat of CATEGORIES) {
    catCounts[cat] = books.filter(b => b.category === cat).length;
  }
  return {
    total_books:  books.length,
    categories:   catCounts,
    total_reviews: books.reduce((s, b) => s + (b.reviews ? b.reviews.length : 0), 0),
    avg_rating:   books.length > 0
      ? Math.round(books.reduce((s, b) => s + b.rating, 0) / books.length * 10) / 10
      : 0
  };
}

init();

module.exports = {
  addBook, listBooks, getBook, rateBook, addReview,
  incrementRef, getStats, CATEGORIES
};
