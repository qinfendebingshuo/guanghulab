/**
 * ═══════════════════════════════════════════════════════════
 * 七猫小说直连适配器 · Qimao Direct Adapter
 * ═══════════════════════════════════════════════════════════
 *
 * 直接调用七猫小说 Web API / 网页抓取，不需要外部 SwiftCat 服务
 * 当 SwiftCat (port 7700) 不可达时自动启用
 *
 * 多层策略:
 *   主策略: www.qimao.com Web API 直连
 *   备用策略: www.qimao.com 网页抓取
 *   应急策略: 可配置代理端点（由铸渊哨兵自动维护）
 *
 * API 端点:
 *   搜索: www.qimao.com/api/search/search-book/v1
 *   目录: www.qimao.com/shuku/{bookId}/ (网页抓取)
 *   章节: www.qimao.com/read/{bookId}/{chapterId}/ (网页抓取)
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const QIMAO_HOST = 'www.qimao.com';
const CHAPTER_DOWNLOAD_DELAY_MS = 400;

// AES 解密密钥（七猫章节内容加密 · AES-128-CBC · PKCS7 Padding）
const AES_KEY = Buffer.from('32343263636238323330643730396531', 'hex');

// ─── 可由铸渊哨兵动态更新的配置 ───
let activeConfig = {
  primaryHost: QIMAO_HOST,
  backupHosts: [],
  searchStrategy: 'api',    // 'api' | 'scrape'
  catalogStrategy: 'scrape', // 'api' | 'scrape'
  chapterStrategy: 'scrape', // 'api' | 'scrape'
};

/**
 * 更新运行时配置（由铸渊哨兵调用）
 */
function updateConfig(newConfig) {
  if (newConfig && typeof newConfig === 'object') {
    Object.assign(activeConfig, newConfig);
  }
}

/**
 * 获取当前运行时配置
 */
function getConfig() {
  return { ...activeConfig };
}

/**
 * HTTP(S) GET 请求 · 返回原始响应体
 */
function httpGetRaw(urlStr, timeoutMs, extraHeaders) {
  const timeout = timeoutMs || 12000;
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
        'Accept': 'text/html,application/xhtml+xml,application/json,*/*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': `https://${QIMAO_HOST}/`,
        'Origin': `https://${QIMAO_HOST}`,
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
 * HTTPS GET 请求 · 返回解析后的 JSON
 */
async function httpsGetJson(urlStr, timeoutMs) {
  const { body, status } = await httpGetRaw(urlStr, timeoutMs, {
    'Accept': 'application/json, text/plain, */*'
  });
  try {
    return JSON.parse(body);
  } catch {
    return { _raw: body, _status: status };
  }
}

/**
 * AES-128-CBC 解密七猫章节内容
 * @param {string} encrypted - Base64 编码的加密内容
 * @returns {string} 解密后的明文
 */
function decryptChapterContent(encrypted) {
  if (!encrypted || typeof encrypted !== 'string') return '';
  try {
    const raw = Buffer.from(encrypted, 'base64');
    if (raw.length < 17) return encrypted; // 太短，可能不是加密内容
    const iv = raw.slice(0, 16);
    const data = raw.slice(16);
    const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, iv);
    let decrypted = decipher.update(data);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    // 解密失败，内容可能不是加密的，原样返回
    return encrypted;
  }
}

/**
 * 从HTML中提取纯文本（安全清理）
 * 先移除标签，再解码实体
 */
function cleanHtml(html) {
  if (!html || typeof html !== 'string') return '';
  let text = html;
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n');
  text = text.replace(/<\/div>/gi, '\n');
  // 循环移除标签（最多10轮防DoS）
  let prev;
  let rounds = 0;
  do {
    prev = text;
    text = text.replace(/<[^>]*>/g, '');
    rounds++;
  } while (text !== prev && rounds < 10);
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

// ═══════════════════════════════════════════════════════════
// 搜索
// ═══════════════════════════════════════════════════════════

/**
 * 通过 API 搜索七猫小说
 */
async function searchViaApi(query, page) {
  const pageIndex = page || 1;
  const host = activeConfig.primaryHost;
  const url = `https://${host}/api/search/search-book/v1`
    + `?search_key=${encodeURIComponent(query)}&page=${pageIndex}&page_size=10`;

  const data = await httpsGetJson(url, 8000);

  // 格式1: {code: 1, data: {list: [...]}}
  if (data && (data.code === 1 || data.code === 0) && data.data) {
    const list = data.data.list || data.data.books || data.data.search_book_data_list || [];
    if (Array.isArray(list) && list.length > 0) {
      return list.map(book => normalizeBookResult(book));
    }
  }

  // 格式2: {code: 200, data: {books: [...]}}
  if (data && data.code === 200 && data.data && Array.isArray(data.data.books)) {
    return data.data.books.map(book => normalizeBookResult(book));
  }

  return null; // null = API不可用，触发fallback
}

/**
 * 通过网页抓取搜索七猫小说
 */
async function searchViaScrape(query) {
  const host = activeConfig.primaryHost;
  const url = `https://${host}/search/${encodeURIComponent(query)}/`;

  const { body } = await httpGetRaw(url, 10000);
  if (!body || body.length < 200) return [];

  const books = [];

  // 匹配搜索结果中的书籍条目
  // 七猫搜索页: <a href="/shuku/{book_id}/">{book_name}</a>
  const patterns = [
    // 常见格式: shuku/数字ID
    /<a[^>]*href="\/shuku\/(\d+)\/?[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    // 备用格式: book/数字ID
    /<a[^>]*href="[^"]*\/book\/(\d+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const bookId = match[1];
      const title = cleanHtml(match[2]).trim();
      if (!title || title.length < 2) continue;
      if (books.some(b => b.source_book_id === bookId)) continue;

      // 尝试提取作者
      const afterMatch = body.slice(match.index, match.index + 500);
      const authorMatch = afterMatch.match(/作者[：:]\s*([^<\n]+)/i)
        || afterMatch.match(/class="[^"]*author[^"]*"[^>]*>([\s\S]*?)<\//i);
      const author = authorMatch ? cleanHtml(authorMatch[1]).trim() : '';

      books.push({
        id: `qm-${bookId}`,
        title,
        author,
        category: '七猫小说',
        source: 'qimao',
        source_name: '七猫小说',
        source_book_id: bookId,
        word_count: 0,
        has_file: false,
        description: ''
      });
    }
    if (books.length > 0) break;
  }

  return books.slice(0, 20);
}

/**
 * 标准化书籍搜索结果
 */
function normalizeBookResult(book) {
  const bookId = String(book.book_id || book.bookId || book.id || '');
  return {
    id: `qm-${bookId}`,
    title: book.book_name || book.title || book.bookName || book.original_title || '',
    author: book.author || book.author_name || book.original_author || '',
    category: book.category || book.genre || '七猫小说',
    source: 'qimao',
    source_name: '七猫小说',
    source_book_id: bookId,
    word_count: parseInt(book.word_count || book.wordCount || book.words_num || 0, 10) || 0,
    has_file: false,
    description: (book.desc || book.abstract || book.intro || '').slice(0, 200),
    cover: book.cover_url || book.cover || book.thumb_url || ''
  };
}

/**
 * 搜索七猫小说（自动策略选择）
 * @param {string} query - 搜索关键词
 * @param {number} page - 页码
 * @returns {Promise<Array>} 书籍列表
 */
async function search(query, page) {
  // 策略1: API
  try {
    const apiResults = await searchViaApi(query, page);
    if (apiResults && apiResults.length > 0) {
      if (activeConfig.searchStrategy !== 'api') {
        activeConfig.searchStrategy = 'api';
      }
      return apiResults;
    }
  } catch {
    // API 不可用
  }

  // 策略2: 网页抓取
  try {
    const scrapeResults = await searchViaScrape(query);
    if (scrapeResults.length > 0) {
      activeConfig.searchStrategy = 'scrape';
      return scrapeResults;
    }
  } catch {
    // 网页也不可用
  }

  // 策略3: 备用主机
  for (const backupHost of activeConfig.backupHosts) {
    try {
      const url = `https://${backupHost}/search?wd=${encodeURIComponent(query)}`;
      const data = await httpsGetJson(url, 8000);
      if (data && data.data && Array.isArray(data.data.books)) {
        return data.data.books.map(book => normalizeBookResult(book));
      }
    } catch {
      continue;
    }
  }

  return [];
}

// ═══════════════════════════════════════════════════════════
// 目录
// ═══════════════════════════════════════════════════════════

/**
 * 通过网页抓取获取书籍目录
 */
async function getCatalogViaScrape(bookId) {
  const safeId = String(bookId).replace(/[^0-9]/g, '');
  if (!safeId) throw new Error('Invalid book ID');

  const host = activeConfig.primaryHost;
  const url = `https://${host}/shuku/${safeId}/`;
  const { body } = await httpGetRaw(url, 12000);

  if (!body || body.length < 200) return [];

  const chapters = [];

  // 七猫目录页: <a href="/read/{bookId}/{chapterId}/">章节标题</a>
  const patterns = [
    new RegExp(`<a[^>]*href="[^"]*\\/read\\/${safeId}\\/(\\d+)\\/?[^"]*"[^>]*>([\\s\\S]*?)<\\/a>`, 'gi'),
    /<a[^>]*href="[^"]*\/read\/\d+\/(\d+)\/?[^"]*"[^>]*>([\s\S]*?)<\/a>/gi,
    /<a[^>]*data-chapter-id="(\d+)"[^>]*>([\s\S]*?)<\/a>/gi
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(body)) !== null) {
      const chapterId = match[1];
      const title = cleanHtml(match[2]).trim();
      if (!title || title.length < 2) continue;
      if (chapters.some(c => c.item_id === chapterId)) continue;
      chapters.push({
        item_id: chapterId,
        title,
        index: chapters.length
      });
    }
    if (chapters.length > 0) break;
  }

  return chapters;
}

/**
 * 通过 API 获取书籍目录
 */
async function getCatalogViaApi(bookId) {
  const safeId = String(bookId).replace(/[^0-9]/g, '');
  if (!safeId) throw new Error('Invalid book ID');

  // 尝试多种 API 格式
  const apiUrls = [
    `https://${activeConfig.primaryHost}/api/book/catalog?book_id=${safeId}`,
    `https://${activeConfig.primaryHost}/api/book/catalog?bookId=${safeId}`,
  ];

  // 备用主机
  for (const host of activeConfig.backupHosts) {
    apiUrls.push(`https://${host}/book/${safeId}/chapters`);
  }

  for (const url of apiUrls) {
    try {
      const data = await httpsGetJson(url, 8000);
      if (data && data.data) {
        const chapters = data.data.chapters || data.data.list || data.data.chapter_list || [];
        if (Array.isArray(chapters) && chapters.length > 0) {
          return chapters.map((ch, i) => ({
            item_id: String(ch.chapter_id || ch.chapterId || ch.id || ''),
            title: ch.title || ch.chapter_title || ch.chapterTitle || `第${i + 1}章`,
            index: i
          })).filter(ch => ch.item_id);
        }
      }
    } catch {
      continue;
    }
  }

  return null; // null = API不可用
}

/**
 * 获取书籍目录（自动策略选择）
 * @param {string} bookId - 七猫小说 book_id
 * @returns {Promise<Array>} 章节列表
 */
async function getCatalog(bookId) {
  // 策略1: API
  try {
    const apiChapters = await getCatalogViaApi(bookId);
    if (apiChapters && apiChapters.length > 0) {
      activeConfig.catalogStrategy = 'api';
      return apiChapters;
    }
  } catch {
    // API 不可用
  }

  // 策略2: 网页抓取
  try {
    const scrapeChapters = await getCatalogViaScrape(bookId);
    if (scrapeChapters.length > 0) {
      activeConfig.catalogStrategy = 'scrape';
      return scrapeChapters;
    }
  } catch {
    // 网页也不可用
  }

  return [];
}

// ═══════════════════════════════════════════════════════════
// 章节内容
// ═══════════════════════════════════════════════════════════

/**
 * 通过网页抓取获取章节内容
 */
async function getChapterViaScrape(bookId, chapterId) {
  const safeBookId = String(bookId).replace(/[^0-9]/g, '');
  const safeChapterId = String(chapterId).replace(/[^0-9]/g, '');
  if (!safeBookId || !safeChapterId) throw new Error('Invalid IDs');

  const host = activeConfig.primaryHost;
  const url = `https://${host}/read/${safeBookId}/${safeChapterId}/`;
  const { body } = await httpGetRaw(url, 12000);

  if (!body) return '';

  // 尝试多种内容容器选择器
  const contentPatterns = [
    /<div[^>]*id="(?:content|chaptercontent|chapter-content|readContent|read-content)"[^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class="[^"]*(?:chapter-content|read-content|article-content|content-text)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  ];

  for (const pattern of contentPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const text = cleanHtml(match[1]);
      if (text.length > 50) return text;
    }
  }

  return '';
}

/**
 * 通过 API 获取章节内容
 */
async function getChapterViaApi(bookId, chapterId) {
  const safeBookId = String(bookId).replace(/[^0-9]/g, '');
  const safeChapterId = String(chapterId).replace(/[^0-9]/g, '');

  const apiUrls = [
    `https://${activeConfig.primaryHost}/api/book/chapter/content?book_id=${safeBookId}&chapter_id=${safeChapterId}`,
    `https://${activeConfig.primaryHost}/api/book/chapter/content?bookId=${safeBookId}&chapterId=${safeChapterId}`,
  ];

  for (const host of activeConfig.backupHosts) {
    apiUrls.push(`https://${host}/chapter/info?id=${safeChapterId}`);
  }

  for (const url of apiUrls) {
    try {
      const data = await httpsGetJson(url, 10000);
      if (data && data.data) {
        let content = data.data.content || data.data.chapter_content || data.data.chapterContent || '';
        if (typeof content === 'string' && content.length > 0) {
          // 检查是否加密（Base64 编码通常全是 ASCII）
          if (/^[A-Za-z0-9+/=\s]+$/.test(content.trim()) && content.length > 100) {
            const decrypted = decryptChapterContent(content.trim());
            if (decrypted && decrypted.length > content.length * 0.3) {
              content = decrypted;
            }
          }
          const cleaned = cleanHtml(content);
          if (cleaned.length > 50) return cleaned;
        }
      }
    } catch {
      continue;
    }
  }

  return null; // null = API 不可用
}

/**
 * 获取章节内容（自动策略选择）
 * @param {string} bookId - 书籍ID
 * @param {string} chapterId - 章节ID
 * @returns {Promise<string>} 章节纯文本内容
 */
async function getChapterContent(bookId, chapterId) {
  // 策略1: API
  try {
    const apiContent = await getChapterViaApi(bookId, chapterId);
    if (apiContent && apiContent.length > 50) {
      activeConfig.chapterStrategy = 'api';
      return apiContent;
    }
  } catch {
    // API 不可用
  }

  // 策略2: 网页抓取
  try {
    const scrapeContent = await getChapterViaScrape(bookId, chapterId);
    if (scrapeContent && scrapeContent.length > 50) {
      activeConfig.chapterStrategy = 'scrape';
      return scrapeContent;
    }
  } catch {
    // 网页也不可用
  }

  return '';
}

// ═══════════════════════════════════════════════════════════
// 下载完整书籍
// ═══════════════════════════════════════════════════════════

/**
 * 下载完整书籍（所有章节）
 * @param {string} bookId - 七猫小说 book_id
 * @param {string} title - 书名
 * @param {string} author - 作者
 * @param {function} onProgress - 进度回调 (current, total, message)
 * @returns {Promise<string>} 完整书籍内容
 */
async function downloadBook(bookId, title, author, onProgress) {
  const chapters = await getCatalog(bookId);
  if (!chapters || chapters.length === 0) {
    throw new Error('无法获取七猫小说章节目录');
  }

  if (onProgress) onProgress(0, chapters.length, `共${chapters.length}章，开始下载...`);

  const contents = [];
  let failCount = 0;
  let consecutiveFails = 0;
  const MAX_CONSECUTIVE_FAILS = 10;

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
    } catch (chErr) {
      failCount++;
      consecutiveFails++;
      console.warn(`[qimao-direct] 章节 ${i + 1} 下载失败: ${chErr.message}`);
    }

    if (consecutiveFails >= MAX_CONSECUTIVE_FAILS) {
      console.warn(`[qimao-direct] 连续${MAX_CONSECUTIVE_FAILS}章失败，中止下载`);
      break;
    }

    if (onProgress) {
      onProgress(i + 1, chapters.length, `下载中 ${i + 1}/${chapters.length} 章...`);
    }

    await new Promise(r => setTimeout(r, CHAPTER_DOWNLOAD_DELAY_MS));
  }

  if (contents.length === 0) {
    throw new Error(`未能获取到任何七猫小说章节内容 (尝试${chapters.length}章·全部失败)`);
  }

  if (contents.length < chapters.length) {
    console.warn(`[qimao-direct] 部分下载: ${contents.length}/${chapters.length} 章成功`);
  }

  return `《${title}》\n作者：${author || '未知'}\n来源：七猫小说（直连）\n` +
    `下载时间：${new Date().toISOString()}\n` +
    `成功章节：${contents.length}/${chapters.length}\n\n` +
    contents.join('\n\n───────────────\n\n');
}

// ═══════════════════════════════════════════════════════════
// 健康检查
// ═══════════════════════════════════════════════════════════

/**
 * 健康检查 · 测试七猫小说是否可达
 */
async function healthCheck() {
  const startTime = Date.now();
  try {
    const result = await search('斗破苍穹', 1);
    const elapsed = Date.now() - startTime;
    return {
      reachable: Array.isArray(result) && result.length > 0,
      source: 'qimao-direct',
      name: '七猫小说(直连)',
      result_count: result.length,
      strategy: activeConfig.searchStrategy,
      latency_ms: elapsed
    };
  } catch (err) {
    return {
      reachable: false,
      source: 'qimao-direct',
      name: '七猫小说(直连)',
      error: err.message,
      latency_ms: Date.now() - startTime
    };
  }
}

module.exports = {
  search,
  getCatalog,
  getChapterContent,
  downloadBook,
  healthCheck,
  decryptChapterContent,
  cleanHtml,
  updateConfig,
  getConfig
};
