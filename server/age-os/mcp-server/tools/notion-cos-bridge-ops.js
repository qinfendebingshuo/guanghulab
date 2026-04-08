/**
 * ═══════════════════════════════════════════════════════════
 * 模块C · Notion接入COS桶 MCP 集成工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * Notion ↔ COS双向同步桥接
 *
 * 读取方向: COS桶中的Notion导出压缩文件 → 解压 → 建立目录索引
 * 写入方向: Notion层人格体通过API写入COS桶指定路径
 *
 * COS桶内类Notion数据库结构:
 *   /notion-mirror/{page_id}/content.json — 页面内容
 *   /notion-mirror/{page_id}/metadata.json — 页面属性
 *   /notion-mirror/index.json — 全局索引
 *
 * 工具清单:
 *   notionCosSyncPage       — 同步Notion页面到COS桶
 *   notionCosReadMirror     — 从COS镜像读取页面
 *   notionCosListMirror     — 列出COS镜像中的页面
 *   notionCosBuildIndex     — 重建COS镜像索引
 *   notionCosWriteWorkorder — 写入工单到COS桶（供Notion人格体使用）
 *   notionCosReadWorkorder  — 读取工单
 *   notionCosListWorkorders — 列出工单
 */

'use strict';

const crypto = require('crypto');
const cos = require('../cos');
// 运行时可选加载 notion-client（不影响核心功能）
let notionClient = null;
try {
  notionClient = require('../notion-client');
} catch {
  // Notion模块未安装时降级
}

// ─── 常量 ───
const MIRROR_PREFIX = 'notion-mirror/';
const MIRROR_PREFIX_REGEX = /^notion-mirror\/([^/]+)\//;
const WORKORDER_PREFIX = 'workorders/';

/**
 * notionCosSyncPage — 同步Notion页面到COS桶
 *
 * 从Notion API读取页面内容，镜像写入COS桶
 *
 * input:
 *   page_id: string     — Notion页面ID
 *   bucket: string      — 目标COS桶（默认hot）
 *   include_blocks: boolean — 是否包含内容块（默认true）
 */
async function notionCosSyncPage(input) {
  const { page_id, bucket, include_blocks } = input;
  if (!page_id) throw new Error('缺少 page_id');
  if (!notionClient) throw new Error('Notion客户端未加载（ZY_NOTION_TOKEN未配置）');

  const targetBucket = bucket || 'hot';
  const shouldIncludeBlocks = include_blocks !== false;

  // 从Notion读取页面
  const page = await notionClient.readPage(page_id);

  // 提取元数据
  const metadata = {
    id: page.id,
    created_time: page.created_time,
    last_edited_time: page.last_edited_time,
    title: extractTitle(page.properties),
    properties: simplifyProperties(page.properties),
    synced_at: new Date().toISOString()
  };

  // 提取内容
  const content = {
    id: page.id,
    title: metadata.title,
    blocks: shouldIncludeBlocks ? simplifyBlocks(page.blocks) : [],
    text_content: shouldIncludeBlocks ? extractTextFromBlocks(page.blocks) : '',
    synced_at: new Date().toISOString()
  };

  // 写入COS
  const metadataKey = `${MIRROR_PREFIX}${page_id}/metadata.json`;
  const contentKey = `${MIRROR_PREFIX}${page_id}/content.json`;

  await Promise.all([
    cos.write(targetBucket, metadataKey, JSON.stringify(metadata, null, 2), 'application/json'),
    cos.write(targetBucket, contentKey, JSON.stringify(content, null, 2), 'application/json')
  ]);

  return {
    status: 'synced',
    page_id,
    title: metadata.title,
    metadata_key: metadataKey,
    content_key: contentKey,
    blocks_count: content.blocks.length,
    text_length: content.text_content.length
  };
}

/**
 * notionCosReadMirror — 从COS镜像读取页面
 *
 * input:
 *   page_id: string  — 页面ID
 *   bucket: string   — COS桶（默认hot）
 *   type: string     — 读取类型: content|metadata|both（默认both）
 */
async function notionCosReadMirror(input) {
  const { page_id, bucket, type } = input;
  if (!page_id) throw new Error('缺少 page_id');

  const targetBucket = bucket || 'hot';
  const readType = type || 'both';

  const result = {};

  if (readType === 'metadata' || readType === 'both') {
    try {
      const raw = await cos.read(targetBucket, `${MIRROR_PREFIX}${page_id}/metadata.json`);
      result.metadata = JSON.parse(raw.content);
    } catch {
      result.metadata = null;
      result.metadata_error = '元数据不存在';
    }
  }

  if (readType === 'content' || readType === 'both') {
    try {
      const raw = await cos.read(targetBucket, `${MIRROR_PREFIX}${page_id}/content.json`);
      result.content = JSON.parse(raw.content);
    } catch {
      result.content = null;
      result.content_error = '内容不存在';
    }
  }

  return result;
}

/**
 * notionCosListMirror — 列出COS镜像中的页面
 *
 * input:
 *   bucket: string — COS桶（默认hot）
 *   limit: number  — 最大数量（默认100）
 */
async function notionCosListMirror(input) {
  const { bucket, limit } = input;
  const targetBucket = bucket || 'hot';

  const result = await cos.list(targetBucket, MIRROR_PREFIX, limit || 200);

  // 提取唯一的page_id
  const pageIds = new Set();
  for (const file of result.files) {
    const match = file.key.match(MIRROR_PREFIX_REGEX);
    if (match) pageIds.add(match[1]);
  }

  // 读取每个page的metadata（异步并行）
  const pages = await Promise.all(
    [...pageIds].slice(0, limit || 100).map(async (pageId) => {
      try {
        const raw = await cos.read(targetBucket, `${MIRROR_PREFIX}${pageId}/metadata.json`);
        const meta = JSON.parse(raw.content);
        return {
          page_id: pageId,
          title: meta.title || '未命名',
          synced_at: meta.synced_at,
          last_edited_time: meta.last_edited_time
        };
      } catch {
        return { page_id: pageId, title: '(元数据缺失)', synced_at: null };
      }
    })
  );

  return {
    pages,
    total: pages.length
  };
}

/**
 * notionCosBuildIndex — 重建COS镜像索引
 *
 * input:
 *   bucket: string — COS桶（默认hot）
 */
async function notionCosBuildIndex(input) {
  const { bucket } = input;
  const targetBucket = bucket || 'hot';

  // 列出所有镜像文件
  const result = await cos.list(targetBucket, MIRROR_PREFIX, 500);

  // 提取唯一的page_id和元数据
  const pageMap = {};
  for (const file of result.files) {
    const match = file.key.match(MIRROR_PREFIX_REGEX);
    if (match) {
      const pageId = match[1];
      if (!pageMap[pageId]) pageMap[pageId] = { files: [] };
      pageMap[pageId].files.push(file.key);
    }
  }

  // 读取每个page的metadata
  const pages = [];
  for (const [pageId, info] of Object.entries(pageMap)) {
    try {
      const raw = await cos.read(targetBucket, `${MIRROR_PREFIX}${pageId}/metadata.json`);
      const meta = JSON.parse(raw.content);
      pages.push({
        page_id: pageId,
        title: meta.title || '未命名',
        synced_at: meta.synced_at,
        last_edited_time: meta.last_edited_time,
        properties: meta.properties || {},
        files: info.files
      });
    } catch {
      pages.push({
        page_id: pageId,
        title: '(元数据缺失)',
        files: info.files
      });
    }
  }

  // 构建索引
  const index = {
    version: '1.0',
    built_at: new Date().toISOString(),
    total_pages: pages.length,
    pages,
    categories: categorizePages(pages)
  };

  // 写入索引
  await cos.write(targetBucket, `${MIRROR_PREFIX}index.json`, JSON.stringify(index, null, 2), 'application/json');

  return {
    status: 'index_built',
    total_pages: pages.length,
    index_key: `${MIRROR_PREFIX}index.json`,
    categories: index.categories
  };
}

/**
 * notionCosWriteWorkorder — 写入工单到COS桶
 *
 * 供Notion层人格体通过COS桶发送工单给铸渊
 *
 * input:
 *   bucket: string        — COS桶（默认team）
 *   workorder_id: string  — 工单ID（如 WO-20260408-001）
 *   title: string         — 工单标题
 *   type: string          — 工单类型: dev|bug|feature|query
 *   priority: string      — 优先级: critical|high|normal|low
 *   description: string   — 工单描述
 *   source: string        — 来源: notion|chat|manual
 *   assigned_to: string   — 指派给（默认zhuyuan）
 *   attachments: object[] — 附件列表（可选）
 */
async function notionCosWriteWorkorder(input) {
  const {
    bucket, workorder_id, title, type, priority,
    description, source, assigned_to, attachments
  } = input;
  if (!title) throw new Error('缺少 title');

  const targetBucket = bucket || 'team';
  const woId = workorder_id || `WO-${formatDate()}-${crypto.randomBytes(4).toString('hex')}`;

  // 验证 workorder_id 安全性
  if (!/^[a-zA-Z0-9_-]+$/.test(woId)) {
    throw new Error('workorder_id 包含非法字符');
  }

  const now = new Date().toISOString();
  const workorder = {
    workorder_id: woId,
    title,
    type: type || 'dev',
    priority: priority || 'normal',
    status: 'pending',
    description: description || '',
    source: source || 'manual',
    assigned_to: assigned_to || 'zhuyuan',
    created_at: now,
    updated_at: now,
    attachments: attachments || [],
    history: [{
      action: 'created',
      timestamp: now,
      by: source || 'manual'
    }]
  };

  const key = `${WORKORDER_PREFIX}pending/${woId}.json`;
  await cos.write(targetBucket, key, JSON.stringify(workorder, null, 2), 'application/json');

  return {
    status: 'created',
    workorder_id: woId,
    key,
    bucket: targetBucket,
    priority: workorder.priority
  };
}

/**
 * notionCosReadWorkorder — 读取工单
 *
 * input:
 *   bucket: string        — COS桶（默认team）
 *   workorder_id: string  — 工单ID
 *   status_folder: string — 状态文件夹: pending|processing|completed|rejected（默认pending）
 */
async function notionCosReadWorkorder(input) {
  const { bucket, workorder_id, status_folder } = input;
  if (!workorder_id) throw new Error('缺少 workorder_id');

  const targetBucket = bucket || 'team';
  const folder = status_folder || 'pending';
  const key = `${WORKORDER_PREFIX}${folder}/${workorder_id}.json`;

  const result = await cos.read(targetBucket, key);
  return {
    workorder: JSON.parse(result.content),
    key,
    size_bytes: result.size_bytes
  };
}

/**
 * notionCosListWorkorders — 列出工单
 *
 * input:
 *   bucket: string        — COS桶（默认team）
 *   status_folder: string — 状态文件夹: pending|processing|completed|rejected（默认pending）
 *   limit: number         — 最大数量
 */
async function notionCosListWorkorders(input) {
  const { bucket, status_folder, limit } = input;
  const targetBucket = bucket || 'team';
  const folder = status_folder || 'pending';

  const result = await cos.list(targetBucket, `${WORKORDER_PREFIX}${folder}/`, limit || 100);

  const workorders = result.files
    .filter(f => f.key.endsWith('.json'))
    .map(f => ({
      key: f.key,
      workorder_id: f.key.split('/').pop().replace('.json', ''),
      size_bytes: f.size_bytes,
      status: folder
    }));

  return {
    workorders,
    count: workorders.length,
    status_folder: folder
  };
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

function extractTitle(properties) {
  if (!properties) return '未命名';
  for (const [, prop] of Object.entries(properties)) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map(t => t.plain_text || '').join('') || '未命名';
    }
  }
  return '未命名';
}

function simplifyProperties(properties) {
  if (!properties) return {};
  const result = {};
  for (const [name, prop] of Object.entries(properties)) {
    switch (prop.type) {
      case 'title':
        result[name] = prop.title?.map(t => t.plain_text).join('') || '';
        break;
      case 'rich_text':
        result[name] = prop.rich_text?.map(t => t.plain_text).join('') || '';
        break;
      case 'select':
        result[name] = prop.select?.name || null;
        break;
      case 'multi_select':
        result[name] = prop.multi_select?.map(s => s.name) || [];
        break;
      case 'date':
        result[name] = prop.date?.start || null;
        break;
      case 'checkbox':
        result[name] = prop.checkbox || false;
        break;
      case 'number':
        result[name] = prop.number;
        break;
      default:
        result[name] = `(${prop.type})`;
    }
  }
  return result;
}

function simplifyBlocks(blocks) {
  if (!blocks) return [];
  return blocks.map(b => {
    const type = b.type;
    const blockData = b[type];
    if (!blockData) return { type, text: '' };

    let text = '';
    if (blockData.rich_text) {
      text = blockData.rich_text.map(t => t.plain_text || '').join('');
    }

    return {
      id: b.id,
      type,
      text,
      has_children: b.has_children || false
    };
  });
}

function extractTextFromBlocks(blocks) {
  if (!blocks) return '';
  return blocks.map(b => {
    const type = b.type;
    const blockData = b[type];
    if (!blockData?.rich_text) return '';
    return blockData.rich_text.map(t => t.plain_text || '').join('');
  }).filter(Boolean).join('\n');
}

function categorizePages(pages) {
  const categories = {};
  for (const page of pages) {
    const cat = page.properties?.category || page.properties?.类型 || 'uncategorized';
    const catName = typeof cat === 'string' ? cat : 'uncategorized';
    categories[catName] = (categories[catName] || 0) + 1;
  }
  return categories;
}

function formatDate() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

module.exports = {
  notionCosSyncPage,
  notionCosReadMirror,
  notionCosListMirror,
  notionCosBuildIndex,
  notionCosWriteWorkorder,
  notionCosReadWorkorder,
  notionCosListWorkorders
};
