/**
 * ═══════════════════════════════════════════════════════════
 * 番茄小说直连适配器 · Fanqie Direct Adapter
 * ═══════════════════════════════════════════════════════════
 *
 * 直接调用番茄小说 Web API，不需要外部 FQWeb 服务
 * 当 FQWeb (port 9999) 不可达时自动启用
 *
 * API 端点:
 *   搜索: fanqienovel.com/api/author/search/search_book/v1
 *   目录: fanqienovel.com/api/reader/directory/detail
 *   章节: fanqienovel.com/api/reader/full
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const https = require('https');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const FANQIE_HOST = 'fanqienovel.com';

/**
 * HTTPS GET 请求 (直连番茄小说)
 */
function httpsGet(urlStr, timeoutMs) {
  const timeout = timeoutMs || 10000;
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const opts = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'GET',
      timeout,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Referer': `https://${FANQIE_HOST}/`,
        'Origin': `https://${FANQIE_HOST}`
      }
    };

    const req = https.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try {
          resolve(JSON.parse(raw));
        } catch {
          resolve({ _raw: raw, _status: res.statusCode });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

/**
 * 搜索番茄小说
 * @param {string} query - 搜索关键词
 * @param {number} page - 页码 (0-based)
 * @returns {Promise<Array>} 书籍列表
 */
async function search(query, page) {
  const pageIndex = page || 0;
  const url = `https://${FANQIE_HOST}/api/author/search/search_book/v1`
    + `?filter=127,127,127,127&page_count=10&page_index=${pageIndex}`
    + `&query=${encodeURIComponent(query)}`;

  const data = await httpsGet(url, 8000);

  // 番茄小说 Web API 返回格式: { code: 0, data: { search_book_data_list: [...] } }
  if (data && data.code === 0 && data.data && Array.isArray(data.data.search_book_data_list)) {
    return data.data.search_book_data_list.map(item => {
      const book = item.book_data || item;
      return {
        id: `fq-${book.book_id || ''}`,
        title: book.book_name || '',
        author: book.author || '',
        category: book.category || book.genre || '番茄小说',
        source: 'fanqie',
        source_name: '番茄小说',
        source_book_id: String(book.book_id || ''),
        word_count: parseInt(book.word_count, 10) || 0,
        has_file: false,
        description: (book.abstract || '').slice(0, 200),
        cover: book.thumb_url || ''
      };
    });
  }

  // 备用: 尝试不同的 API 格式
  if (data && Array.isArray(data.data)) {
    return data.data.map(book => ({
      id: `fq-${book.book_id || book.bookId || book.id || ''}`,
      title: book.book_name || book.title || book.bookName || '',
      author: book.author || book.author_name || '',
      category: book.category || book.genre || '番茄小说',
      source: 'fanqie',
      source_name: '番茄小说',
      source_book_id: String(book.book_id || book.bookId || book.id || ''),
      word_count: parseInt(book.word_count || book.wordCount, 10) || 0,
      has_file: false
    }));
  }

  return [];
}

/**
 * 获取书籍目录
 * @param {string} bookId - 番茄小说 book_id
 * @returns {Promise<Array>} 章节列表
 */
async function getCatalog(bookId) {
  const url = `https://${FANQIE_HOST}/api/reader/directory/detail?bookId=${bookId}`;
  const data = await httpsGet(url, 10000);

  if (data && data.code === 0 && data.data) {
    const volumes = data.data.chapterListWithVolume || data.data.allItemIds || [];
    const chapters = [];

    if (Array.isArray(volumes)) {
      for (const vol of volumes) {
        if (vol.chapterList && Array.isArray(vol.chapterList)) {
          for (const ch of vol.chapterList) {
            chapters.push({
              item_id: ch.itemId || ch.item_id || '',
              title: ch.title || ch.chapterTitle || '',
              index: chapters.length
            });
          }
        } else if (typeof vol === 'string' || typeof vol === 'number') {
          // allItemIds format
          chapters.push({
            item_id: String(vol),
            title: `第${chapters.length + 1}章`,
            index: chapters.length
          });
        }
      }
    }

    return chapters;
  }

  // 备用格式
  if (data && Array.isArray(data.data)) {
    return data.data.map((ch, i) => ({
      item_id: ch.item_id || ch.itemId || ch.id || '',
      title: ch.title || ch.chapter_title || `第${i + 1}章`,
      index: i
    }));
  }

  return [];
}

/**
 * 获取章节内容
 * @param {string} itemId - 章节 item_id
 * @returns {Promise<string>} 章节正文内容
 */
async function getChapterContent(itemId) {
  const url = `https://${FANQIE_HOST}/api/reader/full?itemId=${itemId}`;
  const data = await httpsGet(url, 10000);

  if (data && data.code === 0 && data.data) {
    // content可能是加密的HTML，需要解析
    const content = data.data.content || data.data.chapterData || '';
    if (content) {
      // 清理HTML标签，提取纯文本
      return cleanHtmlContent(content);
    }
  }

  // 尝试直接读取
  if (data && typeof data.data === 'string') {
    return cleanHtmlContent(data.data);
  }

  return '';
}

/**
 * 清理HTML内容为纯文本
 * 安全策略：先移除所有标签，最后才解码实体（防止编码绕过）
 */
function cleanHtmlContent(html) {
  if (!html || typeof html !== 'string') return '';

  let text = html;

  // 1. 转换段落和换行标签为换行符（在删除标签之前保留语义）
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n');

  // 2. 循环移除所有HTML标签直到没有残留（防止嵌套/编码标签绕过）
  let prevText;
  do {
    prevText = text;
    text = text.replace(/<[^>]*>/g, '');
  } while (text !== prevText);

  // 3. 最后才解码HTML实体（标签全部移除后解码是安全的）
  // &amp; 必须最后解码，防止 &amp;lt; → &lt; → < 的双重解码链
  text = text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  // 4. 清理多余空行
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  return text;
}

/**
 * 下载完整书籍（所有章节）
 * @param {string} bookId - 番茄小说 book_id
 * @param {string} title - 书名
 * @param {string} author - 作者
 * @param {function} onProgress - 进度回调 (current, total, message)
 * @returns {Promise<string>} 完整书籍内容
 */
async function downloadBook(bookId, title, author, onProgress) {
  const chapters = await getCatalog(bookId);
  if (!chapters || chapters.length === 0) {
    throw new Error('无法获取章节目录');
  }

  if (onProgress) onProgress(0, chapters.length, `共${chapters.length}章，开始下载...`);

  const contents = [];
  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    if (!ch.item_id) continue;

    try {
      const text = await getChapterContent(ch.item_id);
      if (text) {
        contents.push(`${ch.title}\n\n${text}`);
      }
    } catch (chErr) {
      console.warn(`[fanqie-direct] 章节 ${i + 1} 下载失败: ${chErr.message}`);
    }

    if (onProgress) {
      onProgress(i + 1, chapters.length, `下载中 ${i + 1}/${chapters.length} 章...`);
    }

    // 章间延迟防止请求过快
    await new Promise(r => setTimeout(r, 300));
  }

  if (contents.length === 0) {
    throw new Error('未能获取到任何章节内容');
  }

  return `《${title}》\n作者：${author || '未知'}\n来源：番茄小说（直连）\n下载时间：${new Date().toISOString()}\n\n` +
    contents.join('\n\n───────────────\n\n');
}

/**
 * 健康检查 · 测试番茄小说 API 是否可达
 */
async function healthCheck() {
  try {
    const result = await search('斗破苍穹', 0);
    return {
      reachable: Array.isArray(result) && result.length > 0,
      source: 'fanqie-direct',
      name: '番茄小说(直连)',
      result_count: result.length
    };
  } catch (err) {
    return {
      reachable: false,
      source: 'fanqie-direct',
      name: '番茄小说(直连)',
      error: err.message
    };
  }
}

module.exports = {
  search,
  getCatalog,
  getChapterContent,
  downloadBook,
  healthCheck,
  cleanHtmlContent
};
