// scripts/notion-page-reader.js
// 铸渊 · Notion 页面阅读器
//
// 从 Notion 页面链接或 ID 读取内容，输出 Markdown 格式纯文本。
//
// 用法：
//   node scripts/notion-page-reader.js <NOTION_URL_OR_PAGE_ID>
//
// 环境变量：
//   NOTION_TOKEN       Notion API token（必须）
//
// 支持的 URL 格式：
//   https://www.notion.so/workspace/Page-Title-abc123def456...
//   https://www.notion.so/abc123def456...
//   https://notion.so/abc123def456...
//   https://workspace.notion.site/Page-Title-abc123def456...
//   直接传入 32 位十六进制 ID 或带连字符的 UUID

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';

// ══════════════════════════════════════════════════════════
// URL 解析
// ══════════════════════════════════════════════════════════

/**
 * 从 Notion URL 或原始 ID 中提取页面 ID
 * @param {string} input - Notion URL 或页面 ID
 * @returns {string|null} 标准化的页面 ID（带连字符的 UUID）或 null
 */
function extractPageId(input) {
  if (!input || typeof input !== 'string') return null;

  var cleaned = input.trim();

  // 去掉尾部查询参数和锚点
  cleaned = cleaned.split('?')[0].split('#')[0];

  var hex32;

  // 已经是带连字符的 UUID 格式
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  // 已经是 32 位纯十六进制
  if (/^[0-9a-f]{32}$/i.test(cleaned)) {
    hex32 = cleaned.toLowerCase();
    return hex32.slice(0, 8) + '-' + hex32.slice(8, 12) + '-' + hex32.slice(12, 16) + '-' + hex32.slice(16, 20) + '-' + hex32.slice(20);
  }

  // URL 格式：提取路径末尾的 32 位十六进制
  var match = cleaned.match(/([0-9a-f]{32})$/i);
  if (match) {
    hex32 = match[1].toLowerCase();
    return hex32.slice(0, 8) + '-' + hex32.slice(8, 12) + '-' + hex32.slice(12, 16) + '-' + hex32.slice(16, 20) + '-' + hex32.slice(20);
  }

  // URL 中嵌入的带连字符 UUID
  var uuidMatch = cleaned.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (uuidMatch) {
    return uuidMatch[1].toLowerCase();
  }

  return null;
}

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
// ══════════════════════════════════════════════════════════

function httpsRequest(options) {
  return new Promise(function (resolve, reject) {
    var req = https.request(options, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API 响应解析失败: ' + data.slice(0, 200)));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, function () {
      req.destroy(new Error('请求超时 (30s)'));
    });
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// Notion API
// ══════════════════════════════════════════════════════════

function notionGet(endpoint, token) {
  return httpsRequest({
    hostname: NOTION_API_HOSTNAME,
    port: 443,
    path: endpoint,
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Notion-Version': NOTION_VERSION,
    },
  });
}

/**
 * 获取 Notion 页面元数据（标题、属性等）
 */
async function getNotionPage(pageId, token) {
  return notionGet('/v1/pages/' + pageId, token);
}

/**
 * 读取 Notion 页面的所有子块（递归分页）
 */
async function getNotionPageBlocks(pageId, token) {
  var blocks = [];
  var cursor = undefined;
  do {
    var qs = cursor ? '?start_cursor=' + cursor : '';
    var result = await notionGet('/v1/blocks/' + pageId + '/children' + qs, token);
    blocks.push.apply(blocks, result.results || []);
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

// ══════════════════════════════════════════════════════════
// 内容提取
// ══════════════════════════════════════════════════════════

/**
 * 从 Notion 页面属性中提取标题
 */
function extractPageTitle(page) {
  var props = page.properties || {};
  var keys = Object.keys(props);
  for (var i = 0; i < keys.length; i++) {
    var prop = props[keys[i]];
    if (prop.type === 'title' && prop.title) {
      return prop.title.map(function (t) { return t.plain_text || ''; }).join('');
    }
  }
  return '(无标题)';
}

/**
 * 从 Notion 块中提取纯文本
 */
function extractBlockText(block) {
  var type = block.type;
  if (!block[type]) return '';

  var richTexts = block[type].rich_text || block[type].text || [];
  return richTexts.map(function (rt) { return rt.plain_text || ''; }).join('');
}

/**
 * 将 Notion 块列表转为 Markdown 格式纯文本
 */
function blocksToMarkdown(blocks) {
  return blocks.map(function (block) {
    var type = block.type;
    var text = extractBlockText(block);

    if (type === 'heading_1') return '\n# ' + text;
    if (type === 'heading_2') return '\n## ' + text;
    if (type === 'heading_3') return '\n### ' + text;
    if (type === 'bulleted_list_item') return '- ' + text;
    if (type === 'numbered_list_item') return '1. ' + text;
    if (type === 'to_do') {
      var checked = block.to_do && block.to_do.checked ? '☑' : '☐';
      return checked + ' ' + text;
    }
    if (type === 'code') {
      var lang = (block.code && block.code.language) || '';
      return '```' + lang + '\n' + text + '\n```';
    }
    if (type === 'divider') return '---';
    if (type === 'callout') return '> ' + text;
    if (type === 'quote') return '> ' + text;
    if (type === 'toggle') return '▸ ' + text;
    if (type === 'table_row') {
      var cells = (block.table_row && block.table_row.cells) || [];
      return '| ' + cells.map(function (cell) {
        return cell.map(function (rt) { return rt.plain_text || ''; }).join('');
      }).join(' | ') + ' |';
    }
    if (type === 'image') {
      var src = '';
      if (block.image) {
        if (block.image.type === 'external') src = block.image.external && block.image.external.url;
        if (block.image.type === 'file') src = block.image.file && block.image.file.url;
      }
      var caption = (block.image && block.image.caption) || [];
      var captionText = caption.map(function (rt) { return rt.plain_text || ''; }).join('');
      return '![' + (captionText || 'image') + '](' + (src || '') + ')';
    }
    if (type === 'bookmark') {
      var url = (block.bookmark && block.bookmark.url) || '';
      return '🔗 ' + url;
    }
    if (type === 'child_page') {
      var childTitle = (block.child_page && block.child_page.title) || '';
      return '📄 ' + childTitle;
    }
    if (type === 'child_database') {
      var dbTitle = (block.child_database && block.child_database.title) || '';
      return '🗃️ ' + dbTitle;
    }
    return text;
  }).filter(Boolean).join('\n');
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  var input = process.env.NOTION_PAGE_URL || process.argv[2];
  var token = process.env.NOTION_TOKEN;
  var outputDir = process.env.NOTION_OUTPUT_DIR || '';

  if (!token) {
    console.error('❌ 缺少 NOTION_TOKEN 环境变量');
    process.exit(1);
  }

  if (!input) {
    console.error('❌ 用法: node scripts/notion-page-reader.js <NOTION_URL_OR_PAGE_ID>');
    console.error('   或设置环境变量 NOTION_PAGE_URL');
    process.exit(1);
  }

  var pageId = extractPageId(input);
  if (!pageId) {
    console.error('❌ 无法从输入中提取页面 ID: ' + input);
    process.exit(1);
  }

  console.log('📖 铸渊 · Notion 页面阅读器');
  console.log('  → 页面 ID: ' + pageId);
  console.log('');

  // 1. 获取页面元数据
  console.log('⏳ 正在获取页面信息...');
  var page = await getNotionPage(pageId, token);
  var title = extractPageTitle(page);
  console.log('  → 标题: ' + title);

  // 2. 获取页面内容块
  console.log('⏳ 正在读取页面内容...');
  var blocks = await getNotionPageBlocks(pageId, token);
  console.log('  → 获取到 ' + blocks.length + ' 个内容块');

  // 3. 转换为可读文本
  var markdown = blocksToMarkdown(blocks);

  // 4. 输出
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('📄 ' + title);
  console.log('════════════════════════════════════════');
  console.log(markdown);
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('✅ 读取完成 · 共 ' + blocks.length + ' 个内容块');

  // 5. 可选：保存到文件
  if (outputDir) {
    var safeTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '_').slice(0, 80);
    var filename = safeTitle + '-' + pageId.replace(/-/g, '') + '.md';
    var outputPath = path.join(outputDir, filename);

    var fileContent = '# ' + title + '\n\n';
    fileContent += '> 📖 Notion 页面 ID: `' + pageId + '`\n';
    fileContent += '> 🕐 读取时间: ' + new Date().toISOString() + '\n\n';
    fileContent += '---\n\n';
    fileContent += markdown + '\n';

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    fs.writeFileSync(outputPath, fileContent, 'utf-8');
    console.log('');
    console.log('💾 已保存到: ' + outputPath);
  }
}

// ══════════════════════════════════════════════════════════
// 模块导出（供其他脚本引用）
// ══════════════════════════════════════════════════════════

module.exports = {
  extractPageId: extractPageId,
  extractBlockText: extractBlockText,
  blocksToMarkdown: blocksToMarkdown,
  extractPageTitle: extractPageTitle,
};

// 直接运行时执行主流程
if (require.main === module) {
  main().catch(function (err) {
    console.error('❌ 读取失败: ' + err.message);
    process.exit(1);
  });
}
