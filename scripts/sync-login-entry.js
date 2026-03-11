// scripts/sync-login-entry.js
// 铸渊 · 登录入口同步脚本
//
// Notion 登录入口页面 → 飞书文档A（全量替换）
//
// 环境变量：
//   NOTION_TOKEN           Notion API token
//   NOTION_LOGIN_PAGE_ID   Notion 登录入口页面 ID
//   FEISHU_APP_ID          飞书应用 App ID
//   FEISHU_APP_SECRET      飞书应用 App Secret
//   FEISHU_DOC_A_ID        飞书文档A的 document_id

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

async function getFeishuDocBlocks(token, docId) {
  return httpsRequest({
    hostname: FEISHU_API_HOSTNAME,
    port: 443,
    path: '/open-apis/docx/v1/documents/' + docId + '/blocks/' + docId + '/children',
    method: 'GET',
    headers: { 'Authorization': 'Bearer ' + token },
  });
}

async function deleteFeishuDocBlocks(token, docId, blockIds) {
  if (!blockIds || blockIds.length === 0) return;
  // 飞书 API 需要逐个或批量删除子块
  for (const blockId of blockIds) {
    try {
      await httpsRequest({
        hostname: FEISHU_API_HOSTNAME,
        port: 443,
        path: '/open-apis/docx/v1/documents/' + docId + '/blocks/' + blockId,
        method: 'DELETE',
        headers: { 'Authorization': 'Bearer ' + token },
      });
    } catch (e) {
      console.log('⚠️  删除块 ' + blockId + ' 失败: ' + e.message);
    }
  }
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
        block_type: 2, // text
        text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_1':
      return {
        block_type: 4, // heading1
        heading1: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_2':
      return {
        block_type: 5, // heading2
        heading2: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'heading_3':
      return {
        block_type: 6, // heading3
        heading3: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'bulleted_list_item':
      return {
        block_type: 12, // bullet
        bullet: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'numbered_list_item':
      return {
        block_type: 13, // ordered
        ordered: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    case 'to_do':
      return {
        block_type: 14, // todo
        todo: {
          elements: notionRichTextToFeishu(data.rich_text),
          style: { done: !!data.checked },
        },
      };
    case 'code':
      return {
        block_type: 15, // code
        code: {
          elements: notionRichTextToFeishu(data.rich_text),
          style: { language: 1 }, // plain text
        },
      };
    case 'divider':
      return {
        block_type: 22, // horizontal_rule
        horizontal_rule: {},
      };
    case 'quote':
      return {
        block_type: 19, // quote_container (simplified)
        quote_container: {},
      };
    case 'callout':
      return {
        block_type: 2, // fallback to text
        text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
      };
    default:
      // 不支持的块类型，转为文本
      if (data.rich_text) {
        return {
          block_type: 2,
          text: { elements: notionRichTextToFeishu(data.rich_text), style: {} },
        };
      }
      return null;
  }
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const notionToken  = process.env.NOTION_TOKEN;
  const pageId       = process.env.NOTION_LOGIN_PAGE_ID;
  const feishuAppId  = process.env.FEISHU_APP_ID;
  const feishuSecret = process.env.FEISHU_APP_SECRET;
  const docAId       = process.env.FEISHU_DOC_A_ID;

  if (!notionToken || !pageId || !feishuAppId || !feishuSecret || !docAId) {
    console.error('❌ 缺少必要环境变量');
    console.error('  需要: NOTION_TOKEN, NOTION_LOGIN_PAGE_ID, FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_DOC_A_ID');
    process.exit(1);
  }

  // 1. 读取 Notion 页面内容
  console.log('📖 读取 Notion 登录入口页面...');
  const blocks = await getNotionPageBlocks(pageId, notionToken);
  console.log('  → 获取到 ' + blocks.length + ' 个内容块');

  // 2. 转换为飞书文档格式
  const feishuBlocks = blocks
    .map(notionBlockToFeishu)
    .filter(b => b !== null);
  console.log('  → 转换为 ' + feishuBlocks.length + ' 个飞书内容块');

  if (feishuBlocks.length === 0) {
    console.log('⚠️  无可转换内容，跳过同步');
    process.exit(0);
  }

  // 3. 获取飞书 token
  console.log('🔑 获取飞书 access token...');
  const feishuToken = await getFeishuToken(feishuAppId, feishuSecret);

  // 4. 清除飞书文档现有内容（全量替换）
  console.log('🗑️  清除飞书文档A现有内容...');
  try {
    const existing = await getFeishuDocBlocks(feishuToken, docAId);
    const existingIds = (existing.data && existing.data.items || []).map(item => item.block_id);
    if (existingIds.length > 0) {
      await deleteFeishuDocBlocks(feishuToken, docAId, existingIds);
      console.log('  → 已删除 ' + existingIds.length + ' 个现有块');
    }
  } catch (e) {
    console.log('⚠️  清除现有内容时出错: ' + e.message + '（继续执行）');
  }

  // 5. 写入新内容
  console.log('✍️  写入新内容到飞书文档A...');
  await addFeishuDocBlocks(feishuToken, docAId, docAId, feishuBlocks, 0);

  console.log('✅ 登录入口同步完成');
}

main().catch(err => {
  console.error('❌ 同步失败: ' + err.message);
  process.exit(1);
});
