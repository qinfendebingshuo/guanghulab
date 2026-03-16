// scripts/bridge/fetch-broadcast.js
// 🌉 桥接·从 Notion 拉取广播内容
//
// 根据调度队列中 BROADCAST_READY 任务的关联页面，
// 从 Notion 读取广播页面完整内容，转换为 Markdown 格式
//
// 环境变量：
//   NOTION_TOKEN          Notion API token
//   QUEUE_FILE            check-queue.js 输出的任务列表文件路径

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const OUTPUT_DIR          = path.join('data', 'broadcasts', 'pdf');

// ══════════════════════════════════════════════════════════
// Notion API
// ══════════════════════════════════════════════════════════

function notionRequest(method, endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   method,
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
      },
    };
    if (payload) {
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`Notion API ${res.statusCode}: ${parsed.message || data}`));
          }
        } catch (e) {
          reject(new Error(`Notion API parse error: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// Notion Block → Markdown 转换
// ══════════════════════════════════════════════════════════

function blockToMarkdown(block) {
  const type = block.type;
  const content = block[type];
  if (!content) return '';

  const text = extractRichTextContent(content.rich_text);

  switch (type) {
    case 'paragraph':       return text + '\n';
    case 'heading_1':       return '# ' + text + '\n';
    case 'heading_2':       return '## ' + text + '\n';
    case 'heading_3':       return '### ' + text + '\n';
    case 'bulleted_list_item': return '- ' + text + '\n';
    case 'numbered_list_item': return '1. ' + text + '\n';
    case 'to_do':           return (content.checked ? '- [x] ' : '- [ ] ') + text + '\n';
    case 'toggle':          return '> ' + text + '\n';
    case 'code':            return '```' + (content.language || '') + '\n' + text + '\n```\n';
    case 'quote':           return '> ' + text + '\n';
    case 'divider':         return '---\n';
    case 'callout':         return '> ' + (content.icon?.emoji || '💡') + ' ' + text + '\n';
    default:                return text ? text + '\n' : '';
  }
}

function extractRichTextContent(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(t => {
    let text = t.plain_text || '';
    if (t.annotations) {
      if (t.annotations.bold)          text = '**' + text + '**';
      if (t.annotations.italic)        text = '*' + text + '*';
      if (t.annotations.code)          text = '`' + text + '`';
      if (t.annotations.strikethrough) text = '~~' + text + '~~';
    }
    if (t.href) text = '[' + text + '](' + t.href + ')';
    return text;
  }).join('');
}

// ══════════════════════════════════════════════════════════
// 获取页面所有 blocks
// ══════════════════════════════════════════════════════════

async function getPageBlocks(pageId, token) {
  let allBlocks = [];
  let cursor = undefined;

  do {
    const endpoint = `/v1/blocks/${pageId}/children?page_size=100` +
                     (cursor ? `&start_cursor=${cursor}` : '');
    const result = await notionRequest('GET', endpoint, null, token);
    allBlocks = allBlocks.concat(result.results || []);
    cursor = result.has_more ? result.next_cursor : undefined;
  } while (cursor);

  return allBlocks;
}

// ══════════════════════════════════════════════════════════
// 获取页面标题
// ══════════════════════════════════════════════════════════

async function getPageTitle(pageId, token) {
  const page = await notionRequest('GET', `/v1/pages/${pageId}`, null, token);
  const props = page.properties || {};
  for (const key of Object.keys(props)) {
    if (props[key].type === 'title' && props[key].title) {
      return props[key].title.map(t => t.plain_text).join('');
    }
  }
  return '未命名广播';
}

// ══════════════════════════════════════════════════════════
// 主逻辑
// ══════════════════════════════════════════════════════════

async function main() {
  const token     = process.env.NOTION_TOKEN;
  const queueFile = process.env.QUEUE_FILE;

  if (!token) {
    console.log('⚠️  缺少 NOTION_TOKEN，跳过广播拉取');
    process.exit(0);
  }

  if (!queueFile || !fs.existsSync(queueFile)) {
    console.log('📭 无待处理的 BROADCAST_READY 任务，跳过');
    process.exit(0);
  }

  const tasks = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  if (tasks.length === 0) {
    console.log('📭 任务列表为空，跳过');
    process.exit(0);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`📥 准备拉取 ${tasks.length} 条广播内容…`);

  const mdFiles = [];
  let ok = 0, failed = 0;

  for (const task of tasks) {
    // 尝试从 Payload 中提取页面 ID
    let pageId = '';
    try {
      const payload = JSON.parse(task.payload || '{}');
      pageId = payload.page_id || payload.broadcast_page_id || '';
    } catch (_) { /* ignore */ }

    if (!pageId) {
      console.log(`  ⚠️  任务 ${task.task_name} 无关联页面 ID，跳过`);
      failed++;
      continue;
    }

    try {
      console.log(`  📖 拉取广播: ${task.task_name} (page: ${pageId})`);

      const title  = await getPageTitle(pageId, token);
      const blocks = await getPageBlocks(pageId, token);

      // 转换为 Markdown
      let markdown = `# ${title}\n\n`;
      markdown += `> 广播编号: ${task.broadcast_id || 'N/A'}\n`;
      markdown += `> 生成时间: ${new Date().toISOString()}\n\n`;
      markdown += '---\n\n';

      for (const block of blocks) {
        markdown += blockToMarkdown(block);
      }

      // 写入 Markdown 文件
      const safeName = (task.broadcast_id || task.task_name || 'broadcast')
        .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');
      const mdFile = path.join(OUTPUT_DIR, `${safeName}.md`);
      fs.writeFileSync(mdFile, markdown, 'utf8');
      mdFiles.push({ file: mdFile, task_id: task.id, title });
      console.log(`  ✅ ${mdFile} (${blocks.length} blocks)`);
      ok++;
    } catch (e) {
      console.error(`  ❌ 拉取失败: ${task.task_name}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ 广播内容拉取完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);

  // 将 Markdown 文件列表写入供后续步骤使用
  const manifestFile = path.join(OUTPUT_DIR, 'manifest.json');
  fs.writeFileSync(manifestFile, JSON.stringify(mdFiles, null, 2));
  console.log(`📁 清单已写入: ${manifestFile}`);

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,
      `broadcast_count=${ok}\nmanifest_file=${manifestFile}\n`
    );
  }
}

main().catch(e => { console.error(e); process.exit(1); });
