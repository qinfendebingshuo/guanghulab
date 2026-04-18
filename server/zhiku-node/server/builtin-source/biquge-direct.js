/**
 * ═══════════════════════════════════════════════════════════
 * 笔趣阁聚合搜索适配器 · Biquge Aggregator Direct Adapter
 * ═══════════════════════════════════════════════════════════
 *
 * 聚合多个免费小说网站进行搜索和下载
 * 这些站点对海外IP友好，无地域封锁
 *
 * 搜索策略:
 *   1. 69shu.buzs.cc (69书吧 · TXT资源丰富)
 *   2. www.bqgda.cc  (笔趣阁 · 免费小说源)
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const http = require('http');
const https = require('https');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

// ─── 数据源配置（可动态扩展） ───
const SOURCES = [
  {
    id: 'shu69',
    name: '69书吧',
    searchUrl: 'https://69shu.buzs.cc/modules/article/search.php',
    searchMethod: 'GET',
    searchParam: 'searchkey',
    charset: 'utf-8',
    enabled: true
  }
];

/**
 * HTTP(S) GET 请求 · 返回原始 HTML/文本
 */
function httpGetRaw(urlStr, timeoutMs, extraHeaders) {
  const timeout = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlStr);
    } catch (e) {
      return reject(new Error(`Invalid URL: ${urlStr}`));
    }
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      timeout,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        ...(extraHeaders || {})
      }
    };

    const req = mod.request(opts, (res) => {
      // Handle redirects
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        const redirectUrl = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${url.protocol}//${url.host}${res.headers.location}`;
        httpGetRaw(redirectUrl, timeout, extraHeaders).then(resolve).catch(reject);
        res.resume();
        return;
      }

      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        resolve({
          body: Buffer.concat(chunks).toString('utf-8'),
          status: res.statusCode,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

/**
 * 从HTML中提取纯文本（安全清理）
 * 先移除标签，再解码实体
 */
function cleanHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let text = html;
  // 保留段落换行
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  // 循环移除标签
  let prev;
  do {
    prev = text;
    text = text.replace(/<[^>]*>/g, '');
  } while (text !== prev);
  // 解码HTML实体（&amp; 最后）
  text = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
  text = text.replace(/\n{3,}/g, '\n\n').trim();
  return text;
}

/**
 * 从69书吧搜索结果HTML解析书籍列表
 * @param {string} html - 搜索结果页面HTML
 * @returns {Array} 书籍列表
 */
function parse69shuSearchResults(html) {
  const books = [];
  if (!html) return books;

  // 匹配搜索结果中的书籍条目
  // 69shu 搜索结果格式: <div class="newbox">...<a href="/book/ID">书名</a>...<span>作者</span>...
  const bookPattern = /<div[^>]*class="[^"]*newbox[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = bookPattern.exec(html)) !== null) {
    const block = match[1];
    // 提取链接和书名
    const linkMatch = block.match(/<a[^>]*href="\/book\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    if (!linkMatch) continue;

    const bookId = linkMatch[1];
    const title = cleanHtml(linkMatch[2]).trim();
    if (!title) continue;

    // 提取作者
    const authorMatch = block.match(/作者[：:]\s*([^<\n]+)/i)
      || block.match(/<a[^>]*class="[^"]*author[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
    const author = authorMatch ? cleanHtml(authorMatch[1]).trim() : '未知';

    // 提取分类
    const categoryMatch = block.match(/分类[：:]\s*([^<\n]+)/i);
    const category = categoryMatch ? cleanHtml(categoryMatch[1]).trim() : '';

    books.push({
      id: `shu69-${bookId}`,
      title,
      author,
      category,
      source: 'shu69',
      source_name: '69书吧',
      source_book_id: bookId,
      word_count: 0,
      has_file: false,
      description: ''
    });
  }

  // 备用解析：通过表格行或列表项解析
  if (books.length === 0) {
    const trPattern = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    while ((match = trPattern.exec(html)) !== null) {
      const row = match[1];
      const linkMatch = row.match(/<a[^>]*href="[^"]*\/book\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i)
        || row.match(/<a[^>]*href="[^"]*\/(\d+)\/?[^"]*"[^>]*>([\s\S]*?)<\/a>/i);
      if (!linkMatch) continue;

      const bookId = linkMatch[1];
      const title = cleanHtml(linkMatch[2]).trim();
      if (!title || title.length < 2) continue;

      const tdPattern = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;
      while ((tdMatch = tdPattern.exec(row)) !== null) {
        cells.push(cleanHtml(tdMatch[1]).trim());
      }

      // Avoid duplicates
      if (books.some(b => b.source_book_id === bookId)) continue;

      books.push({
        id: `shu69-${bookId}`,
        title,
        author: cells[1] || '未知',
        category: cells[2] || '',
        source: 'shu69',
        source_name: '69书吧',
        source_book_id: bookId,
        word_count: 0,
        has_file: false,
        description: ''
      });
    }
  }

  // Final fallback: generic link pattern
  if (books.length === 0) {
    const linkPattern = /<a[^>]*href="[^"]*\/book\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = linkPattern.exec(html)) !== null) {
      const bookId = match[1];
      const title = cleanHtml(match[2]).trim();
      if (!title || title.length < 2) continue;
      if (books.some(b => b.source_book_id === bookId)) continue;
      books.push({
        id: `shu69-${bookId}`,
        title,
        author: '未知',
        category: '',
        source: 'shu69',
        source_name: '69书吧',
        source_book_id: bookId,
        word_count: 0,
        has_file: false,
        description: ''
      });
    }
  }

  return books.slice(0, 20);
}

/**
 * 解析69书吧书籍详情页获取章节目录
 * @param {string} html - 书籍详情页HTML
 * @returns {Array} 章节列表 [{item_id, title, index, url}]
 */
function parse69shuCatalog(html) {
  const chapters = [];
  if (!html) return chapters;

  // 69shu catalog: <li><a href="/book/ID/CHAPTER_ID">章节标题</a></li>
  const chPattern = /<a[^>]*href="[^"]*\/book\/\d+\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = chPattern.exec(html)) !== null) {
    const chId = match[1];
    const title = cleanHtml(match[2]).trim();
    if (!title) continue;
    chapters.push({
      item_id: chId,
      title,
      index: chapters.length
    });
  }

  // Fallback: more generic chapter link patterns
  if (chapters.length === 0) {
    const altPattern = /<a[^>]*href="([^"]*\d+\.html?)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((match = altPattern.exec(html)) !== null) {
      const url = match[1];
      const title = cleanHtml(match[2]).trim();
      if (!title || title.length < 2) continue;
      // Extract numeric ID from URL
      const idMatch = url.match(/(\d+)\.html?$/);
      if (!idMatch) continue;
      chapters.push({
        item_id: idMatch[1],
        title,
        index: chapters.length,
        url
      });
    }
  }

  return chapters;
}

/**
 * 解析章节正文内容
 * @param {string} html - 章节页面HTML
 * @returns {string} 纯文本正文
 */
function parseChapterContent(html) {
  if (!html) return '';

  // 尝试多种正文容器选择器
  const contentPatterns = [
    /<div[^>]*id="(?:content|chaptercontent|BookText|booktext|htmlContent)"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*(?:content|chapter-content|book-content|read-content|txt)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*txtnav[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const pattern of contentPatterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      const text = cleanHtml(match[1]);
      if (text.length > 50) return text;
    }
  }

  return '';
}

/**
 * 搜索 69书吧
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 书籍列表
 */
async function search69shu(query) {
  const src = SOURCES.find(s => s.id === 'shu69');
  if (!src || !src.enabled) return [];

  const url = `${src.searchUrl}?${src.searchParam}=${encodeURIComponent(query)}`;
  const { body } = await httpGetRaw(url, 10000, {
    'Referer': 'https://69shu.buzs.cc/'
  });

  return parse69shuSearchResults(body);
}

/**
 * 搜索所有内置源
 * @param {string} query - 搜索关键词
 * @returns {Promise<Array>} 书籍列表
 */
async function search(query) {
  const allResults = [];
  const errors = [];

  // 69书吧
  try {
    const results = await search69shu(query);
    allResults.push(...results);
  } catch (err) {
    errors.push({ source: 'shu69', error: err.message });
  }

  return { results: allResults, errors };
}

/**
 * 获取书籍章节目录
 * @param {string} bookId - 书籍ID (纯数字)
 * @returns {Promise<Array>} 章节列表
 */
async function getCatalog(bookId) {
  // 清洁化 bookId 确保是纯数字
  const safeBookId = String(bookId).replace(/[^0-9]/g, '');
  if (!safeBookId) throw new Error('Invalid book ID');

  const url = `https://69shu.buzs.cc/book/${safeBookId}/`;
  const { body } = await httpGetRaw(url, 15000);

  return parse69shuCatalog(body);
}

/**
 * 获取单章内容
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @returns {Promise<string>} 章节纯文本内容
 */
async function getChapterContent(bookId, chapterId) {
  const safeBookId = String(bookId).replace(/[^0-9]/g, '');
  const safeChapterId = String(chapterId).replace(/[^0-9]/g, '');
  if (!safeBookId || !safeChapterId) throw new Error('Invalid book/chapter ID');

  const url = `https://69shu.buzs.cc/book/${safeBookId}/${safeChapterId}`;
  const { body } = await httpGetRaw(url, 15000);

  return parseChapterContent(body);
}

/**
 * 下载完整书籍
 * @param {string} bookId - 书籍ID
 * @param {string} title - 书名
 * @param {string} author - 作者
 * @param {function} onProgress - 进度回调 (current, total, message)
 * @returns {Promise<string>} 完整书籍TXT内容
 */
async function downloadBook(bookId, title, author, onProgress) {
  const chapters = await getCatalog(bookId);
  if (!chapters || chapters.length === 0) {
    throw new Error('无法获取章节目录');
  }

  if (onProgress) onProgress(0, chapters.length, `共${chapters.length}章，开始下载...`);

  const contents = [];
  let failCount = 0;
  const MAX_CONSECUTIVE_FAILS = 10;
  let consecutiveFails = 0;

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (!ch.item_id) continue;

    try {
      const text = await getChapterContent(bookId, ch.item_id);
      if (text && text.length > 20) {
        contents.push(`${ch.title}\n\n${text}`);
        consecutiveFails = 0;
      } else {
        failCount++;
        consecutiveFails++;
      }
    } catch (err) {
      failCount++;
      consecutiveFails++;
      console.warn(`[biquge-direct] 章节 ${i + 1} 下载失败: ${err.message}`);
    }

    // Safety: abort if too many consecutive failures (likely blocked or wrong URL)
    if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
      console.warn(`[biquge-direct] 连续${MAX_CONSECUTIVE_FAILS}章失败，中止下载`);
      break;
    }

    if (onProgress) {
      onProgress(i + 1, chapters.length, `下载中 ${i + 1}/${chapters.length} 章...`);
    }

    // 章间延迟 500ms，避免请求过快被封
    await new Promise(r => setTimeout(r, 500));
  }

  if (contents.length === 0) {
    throw new Error(`未能获取到任何章节内容 (尝试${chapters.length}章·全部失败)`);
  }

  return `《${title}》\n作者：${author || '未知'}\n来源：69书吧（直连聚合）\n` +
    `下载时间：${new Date().toISOString()}\n` +
    `成功章节：${contents.length}/${chapters.length}\n\n` +
    contents.join('\n\n───────────────\n\n');
}

/**
 * 健康检查
 */
async function healthCheck() {
  try {
    const { results } = await search('斗破苍穹');
    return {
      reachable: Array.isArray(results) && results.length > 0,
      source: 'biquge-direct',
      name: '笔趣阁聚合(直连)',
      result_count: results.length
    };
  } catch (err) {
    return {
      reachable: false,
      source: 'biquge-direct',
      name: '笔趣阁聚合(直连)',
      error: err.message
    };
  }
}

module.exports = {
  search,
  search69shu,
  getCatalog,
  getChapterContent,
  downloadBook,
  healthCheck,
  cleanHtml,
  parse69shuSearchResults,
  parse69shuCatalog,
  parseChapterContent
};
