/**
 * ═══════════════════════════════════════════════════════════
 * 智能分章引擎 · Chapter Engine Service
 * ═══════════════════════════════════════════════════════════
 *
 * 智库节点 Phase 2 · ZY-SVR-006
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   - 识别 TXT 章节分隔规律（正则匹配多种格式）
 *   - 无章节标识时按内容结构分段（空行/字数阈值）
 *   - 输出整齐 TXT + 目录索引 JSON
 *   - 支持重新分章（更新索引）
 *
 * 章节识别规则（优先级从高到低）:
 *   1. 标准格式: "第X章 标题" / "第X回 标题"
 *   2. 数字格式: "Chapter N" / "章节N"
 *   3. 简写格式: "1." / "001" 开头的行
 *   4. 分隔符: "──" / "***" / "===" 等分隔线
 *   5. 兜底: 按空行+字数阈值切分
 *
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const BOOKS_DIR    = process.env.BOOKS_DIR    || path.join(__dirname, '..', 'data', 'books');
const CHAPTERS_DIR = process.env.CHAPTERS_DIR || path.join(__dirname, '..', 'data', 'chapters');

// ─── 章节匹配正则 ───
const CHAPTER_PATTERNS = [
  // 第X章/回/节/篇/卷 (支持中文数字和阿拉伯数字)
  /^第[一二三四五六七八九十百千万\d]+[章回节篇卷]\s*.*/,
  // Chapter N / CHAPTER N
  /^[Cc]hapter\s+\d+/,
  // 章节N / 章N
  /^章节?\s*\d+/,
  // 序章/楔子/尾声/番外
  /^(序章|楔子|引子|尾声|番外|后记|前言|附录)\s*/,
  // 纯数字行（如 "001" 或 "1."）
  /^\d{1,4}[.、．]\s*.+/
];

// 分隔符模式
const SEPARATOR_PATTERN = /^[─━═\-\*]{5,}$/;

// 初始化目录
function init() {
  if (!fs.existsSync(CHAPTERS_DIR)) {
    fs.mkdirSync(CHAPTERS_DIR, { recursive: true });
  }
}

/**
 * 验证 ID 安全性（防止路径遍历和原型链污染）
 */
function sanitizeId(id) {
  if (!id || typeof id !== 'string') return null;
  // 禁止原型链污染
  if (id === '__proto__' || id === 'constructor' || id === 'prototype') return null;
  // 禁止路径遍历字符
  if (id.includes('..') || id.includes('/') || id.includes('\\')) return null;
  return id;
}

/**
 * 对一本书进行分章
 * @param {string} filename - 书籍文件名 (在 data/books/ 下)
 * @returns {object} { book_id, title, total_chapters, chapters: [...], toc: [...] }
 */
function splitChapters(filename) {
  if (!sanitizeId(filename)) {
    throw new Error('非法文件名');
  }

  const filePath = path.join(BOOKS_DIR, filename);

  // 防止路径遍历
  const resolvedPath = path.resolve(filePath);
  const resolvedBase = path.resolve(BOOKS_DIR);
  if (!resolvedPath.startsWith(resolvedBase)) {
    throw new Error('非法路径');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`书籍文件不存在: ${filename}`);
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines   = content.split('\n');

  // 提取书名（文件名或第一行）
  const bookId   = filename.replace('.txt', '');
  const bookMeta = extractBookMeta(lines);

  // 尝试按章节标识分割
  let chapters = splitByPatterns(lines);

  // 如果没有找到章节标识，按分隔符分割
  if (chapters.length <= 1) {
    chapters = splitBySeparators(lines);
  }

  // 如果仍然只有一章，按空行+字数阈值切分
  if (chapters.length <= 1) {
    chapters = splitByParagraphs(lines);
  }

  // 构建目录索引
  const toc = chapters.map((ch, idx) => ({
    index:      idx,
    title:      ch.title,
    start_line: ch.start_line,
    char_count: ch.content.length,
    word_count: ch.content.replace(/\s/g, '').length
  }));

  // 保存分章结果
  const result = {
    book_id:        bookId,
    title:          bookMeta.title || bookId,
    author:         bookMeta.author || '未知',
    total_chapters: chapters.length,
    total_chars:    content.length,
    split_method:   chapters.length > 1 ? detectMethod(chapters) : 'single',
    created_at:     new Date().toISOString(),
    toc,
    chapters:       chapters.map((ch, idx) => ({
      index:   idx,
      title:   ch.title,
      content: ch.content
    }))
  };

  // 保存到 chapters 目录
  const chapterDir = path.join(CHAPTERS_DIR, bookId);
  if (!fs.existsSync(chapterDir)) {
    fs.mkdirSync(chapterDir, { recursive: true });
  }

  // 保存索引
  fs.writeFileSync(
    path.join(chapterDir, 'index.json'),
    JSON.stringify({ ...result, chapters: undefined }, null, 2),
    'utf8'
  );

  // 保存每章内容
  for (let i = 0; i < chapters.length; i++) {
    fs.writeFileSync(
      path.join(chapterDir, `chapter-${String(i).padStart(4, '0')}.txt`),
      chapters[i].content,
      'utf8'
    );
  }

  return result;
}

/**
 * 提取书籍元信息（从前几行）
 */
function extractBookMeta(lines) {
  const meta = { title: '', author: '' };
  const header = lines.slice(0, 10).join('\n');

  // 匹配书名：《xxx》
  const titleMatch = header.match(/《(.+?)》/);
  if (titleMatch) meta.title = titleMatch[1];

  // 匹配作者
  const authorMatch = header.match(/作者[:：]\s*(.+)/);
  if (authorMatch) meta.author = authorMatch[1].trim();

  return meta;
}

/**
 * 按章节正则模式分割
 */
function splitByPatterns(lines) {
  const chapters = [];
  let currentChapter = null;
  let lineNum = 0;

  for (const line of lines) {
    lineNum++;
    const trimmed = line.trim();

    // 检查是否匹配章节模式
    const isChapterHead = CHAPTER_PATTERNS.some(p => p.test(trimmed));

    if (isChapterHead) {
      if (currentChapter) {
        chapters.push(currentChapter);
      }
      currentChapter = {
        title:      trimmed,
        start_line: lineNum,
        content:    ''
      };
    } else if (currentChapter) {
      currentChapter.content += line + '\n';
    }
  }

  if (currentChapter) {
    chapters.push(currentChapter);
  }

  return chapters;
}

/**
 * 按分隔符分割
 */
function splitBySeparators(lines) {
  const chapters = [];
  let currentContent = '';
  let chapterNum = 0;
  let startLine = 1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (SEPARATOR_PATTERN.test(trimmed) && currentContent.trim().length > 50) {
      chapterNum++;
      chapters.push({
        title:      `段落 ${chapterNum}`,
        start_line: startLine,
        content:    currentContent.trim()
      });
      currentContent = '';
      startLine = i + 2;
    } else {
      currentContent += lines[i] + '\n';
    }
  }

  // 最后一段
  if (currentContent.trim().length > 0) {
    chapterNum++;
    chapters.push({
      title:      `段落 ${chapterNum}`,
      start_line: startLine,
      content:    currentContent.trim()
    });
  }

  return chapters;
}

/**
 * 按空行+字数阈值切分（兜底方案）
 */
function splitByParagraphs(lines, threshold = 3000) {
  const chapters = [];
  let currentContent = '';
  let chapterNum = 0;
  let startLine = 1;
  let consecutiveEmpty = 0;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    if (trimmed === '') {
      consecutiveEmpty++;
    } else {
      consecutiveEmpty = 0;
    }

    currentContent += lines[i] + '\n';

    // 当连续空行≥2且已超过阈值时切分
    if (consecutiveEmpty >= 2 && currentContent.trim().length >= threshold) {
      chapterNum++;
      chapters.push({
        title:      `自动段落 ${chapterNum}`,
        start_line: startLine,
        content:    currentContent.trim()
      });
      currentContent = '';
      startLine = i + 2;
      consecutiveEmpty = 0;
    }
  }

  // 最后一段
  if (currentContent.trim().length > 0) {
    chapterNum++;
    chapters.push({
      title:      chapters.length === 0 ? '全文' : `自动段落 ${chapterNum}`,
      start_line: startLine,
      content:    currentContent.trim()
    });
  }

  return chapters;
}

/**
 * 检测使用了哪种分割方法
 */
function detectMethod(chapters) {
  if (chapters.length === 0) return 'none';
  const firstTitle = chapters[0].title;
  if (CHAPTER_PATTERNS.some(p => p.test(firstTitle))) return 'pattern';
  if (firstTitle.startsWith('段落')) return 'separator';
  if (firstTitle.startsWith('自动段落')) return 'paragraph';
  return 'mixed';
}

/**
 * 获取已分章的书籍列表
 */
function listChapteredBooks() {
  if (!fs.existsSync(CHAPTERS_DIR)) return [];

  return fs.readdirSync(CHAPTERS_DIR)
    .filter(d => {
      const indexPath = path.join(CHAPTERS_DIR, d, 'index.json');
      return fs.existsSync(indexPath);
    })
    .map(d => {
      const indexPath = path.join(CHAPTERS_DIR, d, 'index.json');
      try {
        return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * 获取某本书的分章详情
 */
function getBookChapters(bookId) {
  if (!sanitizeId(bookId)) return null;
  const indexPath = path.join(CHAPTERS_DIR, bookId, 'index.json');
  if (!fs.existsSync(indexPath)) return null;

  try {
    return JSON.parse(fs.readFileSync(indexPath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * 获取某章内容
 */
function getChapterContent(bookId, chapterIndex) {
  if (!sanitizeId(bookId)) return null;
  const chapterPath = path.join(
    CHAPTERS_DIR,
    bookId,
    `chapter-${String(chapterIndex).padStart(4, '0')}.txt`
  );

  // 防止路径遍历
  const resolvedPath = path.resolve(chapterPath);
  const resolvedBase = path.resolve(CHAPTERS_DIR);
  if (!resolvedPath.startsWith(resolvedBase)) return null;

  if (!fs.existsSync(chapterPath)) return null;

  return fs.readFileSync(chapterPath, 'utf8');
}

/**
 * 获取分章引擎统计
 */
function getStats() {
  const books = listChapteredBooks();
  return {
    total_chaptered_books: books.length,
    total_chapters:        books.reduce((sum, b) => sum + (b.total_chapters || 0), 0),
    total_chars:           books.reduce((sum, b) => sum + (b.total_chars || 0), 0),
    methods: {
      pattern:   books.filter(b => b.split_method === 'pattern').length,
      separator: books.filter(b => b.split_method === 'separator').length,
      paragraph: books.filter(b => b.split_method === 'paragraph').length
    }
  };
}

// 初始化
init();

module.exports = {
  splitChapters,
  listChapteredBooks,
  getBookChapters,
  getChapterContent,
  getStats,
  CHAPTER_PATTERNS
};
