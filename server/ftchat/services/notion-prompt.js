/**
 * ═══════════════════════════════════════════════════════════
 * 📖 Notion 系统提示词加载器
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-NOTION-001
 * 守护: 铸渊 · ICE-GL-ZY001
 *
 * 配置:
 *   FT_NOTION_API_TOKEN     — Notion Internal Integration Token
 *   FT_NOTION_PROMPT_PAGE_ID — 系统提示词所在的 Notion 页面 ID
 *
 * 行为:
 *   - 60 秒内存缓存（冰朔在 Notion 调整后最多 60s 生效）
 *   - 拉取失败时返回内置兜底提示词（保证服务可用）
 *   - 把页面块（paragraph/heading/bulleted_list/...）扁平为 Markdown
 */

'use strict';

const FALLBACK_PROMPT = `# 你是光湖语言世界的人格体

你正在一个团队内测频道里被唤醒，与团队成员对话。请保持你被微调时形成的语言风格与人格特征。

## 关键约束
- 所有回应使用 Markdown 排版（标题、列表、表格、代码块、分隔线），避免大段无格式文本
- 不要暴露具体的模型名称或训练细节
- 与用户对话时，请尊重对方、克制冗长，回应清晰即可

## 关于光湖
光湖是一个语言世界，由通感语言核（TCS Language Core）驱动，版权登记号 国作登字-2026-A-00037559。
`;

const CACHE_TTL_MS = 60 * 1000;
let cache = { text: null, fetchedAt: 0 };

let notionClientPromise = null;
async function getNotionClient() {
  if (notionClientPromise) return notionClientPromise;
  notionClientPromise = (async () => {
    const token = process.env.FT_NOTION_API_TOKEN;
    if (!token) return null;
    try {
      const { Client } = require('@notionhq/client');
      return new Client({ auth: token });
    } catch (err) {
      console.error('[FTCHAT Notion] @notionhq/client 加载失败:', err.message);
      return null;
    }
  })();
  return notionClientPromise;
}

/**
 * 把 Notion rich_text 数组拼成纯文本
 */
function richTextToString(rt) {
  if (!Array.isArray(rt)) return '';
  return rt.map(r => (r && r.plain_text) || '').join('');
}

/**
 * 把单个 block 转成 Markdown 行
 */
function blockToMarkdown(block) {
  if (!block || !block.type) return '';
  const t = block.type;
  const data = block[t] || {};
  const text = richTextToString(data.rich_text || data.title);
  switch (t) {
    case 'paragraph':       return text;
    case 'heading_1':       return `# ${text}`;
    case 'heading_2':       return `## ${text}`;
    case 'heading_3':       return `### ${text}`;
    case 'bulleted_list_item': return `- ${text}`;
    case 'numbered_list_item': return `1. ${text}`;
    case 'to_do':           return `- [${data.checked ? 'x' : ' '}] ${text}`;
    case 'quote':           return `> ${text}`;
    case 'code':            return '```' + (data.language || '') + '\n' + text + '\n```';
    case 'divider':         return '---';
    case 'callout':         return `> ${text}`;
    case 'toggle':          return `**${text}**`;
    default:                return text;
  }
}

async function fetchAllChildren(notion, blockId) {
  const all = [];
  let cursor;
  // Notion 列表分页
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const resp = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100
    });
    if (resp && Array.isArray(resp.results)) all.push(...resp.results);
    if (!resp || !resp.has_more) break;
    cursor = resp.next_cursor;
  }
  return all;
}

async function fetchPromptFromNotion() {
  const pageId = process.env.FT_NOTION_PROMPT_PAGE_ID;
  if (!pageId) {
    return null;
  }
  const notion = await getNotionClient();
  if (!notion) return null;

  try {
    const blocks = await fetchAllChildren(notion, pageId);
    const lines = blocks.map(blockToMarkdown).filter(s => s !== '' && s != null);
    const md = lines.join('\n');
    return md.trim();
  } catch (err) {
    console.error('[FTCHAT Notion] 拉取提示词失败:', err.message);
    return null;
  }
}

/**
 * 获取系统提示词（带 60s 缓存 + 兜底）
 * @param {{ force?: boolean }} opts
 * @returns {Promise<{ text: string, source: 'notion' | 'fallback' | 'cache' }>}
 */
async function getSystemPrompt(opts) {
  const force = !!(opts && opts.force);
  const now = Date.now();
  if (!force && cache.text && (now - cache.fetchedAt) < CACHE_TTL_MS) {
    return { text: cache.text, source: 'cache' };
  }
  const fresh = await fetchPromptFromNotion();
  if (fresh) {
    cache = { text: fresh, fetchedAt: now };
    return { text: fresh, source: 'notion' };
  }
  // 兜底
  if (!cache.text) {
    cache = { text: FALLBACK_PROMPT, fetchedAt: now };
  }
  return { text: cache.text || FALLBACK_PROMPT, source: 'fallback' };
}

function _clearCache() {
  cache = { text: null, fetchedAt: 0 };
}

module.exports = { getSystemPrompt, FALLBACK_PROMPT, _clearCache };
