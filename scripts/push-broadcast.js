// scripts/push-broadcast.js
// 铸渊 · 广播推送脚本
//
// Notion 广播页面 → 飞书文档B（追加到顶部）
//
// 环境变量：
//   NOTION_TOKEN           Notion API token
//   BROADCAST_PAGE_ID      Notion 广播页面 ID（由 dispatch payload 提供）
//   FEISHU_APP_ID          飞书应用 App ID
//   FEISHU_APP_SECRET      飞书应用 App Secret
//   FEISHU_DOC_B_ID        飞书文档B的 document_id

'use strict';

const https = require('https');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const FEISHU_API_HOSTNAME = 'open.feishu.cn';

// ══════════════════════════════════════════════════════════
// HTTP 请求工具
// ══════════════════════════════════════════════════════════

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    if (payload) {
      options.headers = options.headers || {};
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || parsed.msg || data}`));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
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

async function getNotionPage(pageId, token) {
  return notionGet('/v1/pages/' + pageId, token);
}

async function getNotionPageBlocks(pageId, token) {
  const blocks = [];
  let cursor = undefined;
  do {
    const qs = cursor ? '?start_cursor=' + cursor : '';
    const result = await notionGet('/v1/blocks/' + pageId + '/children' + qs, token);
    blocks.push(...(result.results || []));
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

// ══════════════════════════════════════════════════════════
// 飞书 API
// ══════════════════════════════════════════════════════════

async function getFeishuToken(appId, appSecret) {
  const result = await httpsRequest({
    hostname: FEISHU_API_HOSTNAME,
    port: 443,
    path: '/open-apis/auth/v3/tenant_access_token/internal',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { app_id: appId, app_secret: appSecret });
  return result.tenant_access_token;
}

async function addFeishuDocBlocks(token, docId, parentBlockId, children, index) {
  return httpsRequest({
    hostname: FEISHU_API_HOSTNAME,
    port: 443,
    path: '/open-apis/docx/v1/documents/' + docId + '/blocks/' + parentBlockId + '/children',
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
  }, { children, index });
}

// ══════════════════════════════════════════════════════════
// Notion → 飞书 格式转换
// ══════════════════════════════════════════════════════════

function notionRichTextToFeishu(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return [];
  return richTextArray.map(rt => {
    const elem = { content: rt.plain_text || '' };
    if (rt.annotations) {
      const style = {};
      if (rt.annotations.bold) style.bold = true;
      if (rt.annotations.italic) style.italic = true;
      if (rt.annotations.strikethrough) style.strikethrough = true;
      if (rt.annotations.underline) style.underline = true;
      if (rt.annotations.code) style.inline_code = true;
      if (Object.keys(style).length > 0) elem.text_element_style = style;
    }
    if (rt.href) {
      elem.text_element_style = elem.text_element_style || {};
      elem.text_element_style.link = { url: rt.href };
    }
    return { text_run: elem };
  });
}

function notionBlockToFeishu(block) {
  const type = block.type;
  const data = block[type];
  if (!data) return null;

  switch (type) {
    case 'paragraph':
      return {
        block_type: 2,
        text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_1':
      return {
        block_type: 4,
        heading1: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_2':
      return {
        block_type: 5,
        heading2: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_3':
      return {
        block_type: 6,
        heading3: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'bulleted_list_item':
      return {
        block_type: 12,
        bullet: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'numbered_list_item':
      return {
        block_type: 13,
        ordered: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'to_do':
      return {
        block_type: 14,
        todo: {
          elements: notionRichTextToFeishu(data.rich_text),
          style: { done: !!data.checked },
        },
      };
    case 'code':
      return {
        block_type: 15,
        code: {
          elements: notionRichTextToFeishu(data.rich_text),
          style: { language: 1 },
        },
      };
    case 'divider':
      return { block_type: 22, horizontal_rule: {} };
    case 'callout':
      return {
        block_type: 2,
        text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    default:
      if (data.rich_text) {
        return {
          block_type: 2,
          text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
        };
      }
      return null;
  }
}

function extractBroadcastId(page) {
  // 尝试从 Notion 页面属性中提取广播编号
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    const prop = props[key];
    if (prop.type === 'title' && prop.title) {
      const text = prop.title.map(t => t.plain_text).join('');
      const match = text.match(/BC-\w+-\d+-\d+/);
      if (match) return match[0];
    }
    if (prop.type === 'rich_text' && prop.rich_text) {
      const text = prop.rich_text.map(t => t.plain_text).join('');
      const match = text.match(/BC-\w+-\d+-\d+/);
      if (match) return match[0];
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const notionToken  = process.env.NOTION_TOKEN;
  const pageId       = process.env.BROADCAST_PAGE_ID;
  const feishuAppId  = process.env.FEISHU_APP_ID;
  const feishuSecret = process.env.FEISHU_APP_SECRET;
  const docBId       = process.env.FEISHU_DOC_B_ID;

  if (!notionToken || !pageId || !feishuAppId || !feishuSecret || !docBId) {
    console.error('❌ 缺少必要环境变量');
    console.error('  需要: NOTION_TOKEN, BROADCAST_PAGE_ID, FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_DOC_B_ID');
    process.exit(1);
  }

  // 1. 读取 Notion 广播页面元信息
  console.log('📖 读取 Notion 广播页面...');
  const page = await getNotionPage(pageId, notionToken);
  const broadcastId = extractBroadcastId(page) || 'UNKNOWN';
  const dateStr = new Date().toISOString().split('T')[0];
  console.log('  → 广播编号: ' + broadcastId);
  console.log('  → 签发日期: ' + dateStr);

  // 2. 读取 Notion 广播页面内容
  const blocks = await getNotionPageBlocks(pageId, notionToken);
  console.log('  → 获取到 ' + blocks.length + ' 个内容块');

  // 3. 转换为飞书文档格式
  const feishuBlocks = blocks
    .map(notionBlockToFeishu)
    .filter(b => b !== null);

  // 4. 构建追加内容（带分隔线+广播编号+日期头）
  const headerBlocks = [
    // 分隔线
    { block_type: 22, horizontal_rule: {} },
    // 广播编号 + 日期
    {
      block_type: 5, // heading2
      heading2: {
        elements: [
          { text_run: { content: '📡 ' + broadcastId + ' · ' + dateStr } },
        ],
        style: {},
      },
    },
  ];

  const allBlocks = headerBlocks.concat(feishuBlocks);
  console.log('  → 共 ' + allBlocks.length + ' 个飞书内容块（含头部）');

  // 5. 获取飞书 token
  console.log('🔑 获取飞书 access token...');
  const feishuToken = await getFeishuToken(feishuAppId, feishuSecret);

  // 6. 追加到飞书文档B顶部（index=0 表示插入到最前面）
  console.log('✍️  追加广播到飞书文档B顶部...');
  await addFeishuDocBlocks(feishuToken, docBId, docBId, allBlocks, 0);

  console.log('✅ 广播推送完成: ' + broadcastId);
}

main().catch(err => {
  console.error('❌ 推送失败: ' + err.message);
  process.exit(1);
});
