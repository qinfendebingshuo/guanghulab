/**
 * ═══════════════════════════════════════════════════════════
 * 模块G · COS桶内自研数据库协议 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * cos-persona-db 协议 — COS桶内的文件组织结构 = 人格体数据库
 *
 * 代码仓库侧结构:
 *   /zhuyuan/db/
 *   ├── index.json          — 全局索引
 *   ├── code-modules/       — 代码模块结构化
 *   ├── brain-nodes/        — 认知节点
 *   └── training-data/      — 训练数据（TCS格式）
 *
 * Notion侧结构:
 *   /notion-db/
 *   ├── index.json          — 全局索引
 *   ├── pages/              — 页面内容（按分类）
 *   ├── databases/          — 数据库结构
 *   └── training-data/      — 训练数据（TCS格式）
 *
 * 工具清单:
 *   cosDbInit              — 初始化COS数据库结构
 *   cosDbGetIndex          — 获取数据库全局索引
 *   cosDbUpdateIndex       — 更新全局索引
 *   cosDbWriteEntry        — 写入数据条目
 *   cosDbReadEntry         — 读取数据条目
 *   cosDbListEntries       — 列出数据条目
 *   cosDbDeleteEntry       — 删除数据条目
 *   cosDbGetStats          — 获取数据库统计信息
 */

'use strict';

const cos = require('../cos');

// ─── 数据库协议版本 ───
const COS_DB_VERSION = '1.0';

// ─── 数据库类型定义 ───
const DB_TYPES = {
  'zhuyuan': {
    root: 'zhuyuan/db',
    description: '铸渊·代码仓库侧人格体大脑',
    categories: ['code-modules', 'brain-nodes', 'training-data', 'directives', 'alerts']
  },
  'notion': {
    root: 'notion-db',
    description: 'Notion侧人格体大脑',
    categories: ['pages', 'databases', 'training-data', 'workorders']
  },
  'team': {
    root: 'team-hub',
    description: '团队协作通信枢纽',
    categories: ['workorders', 'reports', 'tasks', 'alerts']
  },
  'awen': {
    root: 'awen-hub',
    description: 'Awen技术主控通信桶',
    categories: ['tasks', 'reports', 'progress', 'alerts']
  }
};

/**
 * cosDbInit — 初始化COS数据库结构
 *
 * input:
 *   bucket: string   — 桶名
 *   db_type: string  — 数据库类型（zhuyuan/notion/team/awen）
 */
async function cosDbInit(input) {
  const { bucket, db_type } = input;
  if (!bucket) throw new Error('缺少 bucket');
  if (!db_type || !DB_TYPES[db_type]) {
    throw new Error(`无效的 db_type，可选: ${Object.keys(DB_TYPES).join(', ')}`);
  }

  const dbConfig = DB_TYPES[db_type];
  const now = new Date().toISOString();

  // 创建索引文件
  const index = {
    cos_db_version: COS_DB_VERSION,
    db_type,
    description: dbConfig.description,
    root_path: dbConfig.root,
    categories: dbConfig.categories,
    created_at: now,
    updated_at: now,
    total_entries: 0,
    category_counts: Object.fromEntries(dbConfig.categories.map(c => [c, 0])),
    last_write: null,
    sovereign: '冰朔 · TCS-0002∞',
    guardian: '铸渊 · ICE-GL-ZY001',
    copyright: '国作登字-2026-A-00037559'
  };

  await cos.write(bucket, `${dbConfig.root}/index.json`, JSON.stringify(index, null, 2), 'application/json');

  // 创建各分类目录的.gitkeep文件
  const writes = dbConfig.categories.map(category =>
    cos.write(bucket, `${dbConfig.root}/${category}/.init`, JSON.stringify({
      category,
      created_at: now,
      entries: 0
    }), 'application/json')
  );
  await Promise.all(writes);

  return {
    status: 'initialized',
    db_type,
    bucket,
    root: dbConfig.root,
    categories: dbConfig.categories,
    index_key: `${dbConfig.root}/index.json`
  };
}

/**
 * cosDbGetIndex — 获取数据库全局索引
 *
 * input:
 *   bucket: string   — 桶名
 *   db_type: string  — 数据库类型
 */
async function cosDbGetIndex(input) {
  const { bucket, db_type } = input;
  if (!bucket || !db_type) throw new Error('缺少 bucket 或 db_type');

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  try {
    const result = await cos.read(bucket, `${dbConfig.root}/index.json`);
    return {
      index: JSON.parse(result.content),
      size_bytes: result.size_bytes
    };
  } catch {
    return {
      index: null,
      error: '索引不存在，请先执行 cosDbInit 初始化'
    };
  }
}

/**
 * cosDbUpdateIndex — 更新全局索引
 *
 * input:
 *   bucket: string   — 桶名
 *   db_type: string  — 数据库类型
 *   updates: object  — 要更新的字段
 */
async function cosDbUpdateIndex(input) {
  const { bucket, db_type, updates } = input;
  if (!bucket || !db_type) throw new Error('缺少 bucket 或 db_type');

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  // 读取现有索引
  let index;
  try {
    const result = await cos.read(bucket, `${dbConfig.root}/index.json`);
    index = JSON.parse(result.content);
  } catch {
    throw new Error('索引不存在，请先执行 cosDbInit 初始化');
  }

  // 合并更新（只允许更新安全字段）
  const safeFields = ['total_entries', 'category_counts', 'last_write', 'description'];
  for (const [key, value] of Object.entries(updates || {})) {
    if (safeFields.includes(key)) {
      index[key] = value;
    }
  }
  index.updated_at = new Date().toISOString();

  await cos.write(bucket, `${dbConfig.root}/index.json`, JSON.stringify(index, null, 2), 'application/json');

  return { index, updated: true };
}

/**
 * cosDbWriteEntry — 写入数据条目
 *
 * input:
 *   bucket: string    — 桶名
 *   db_type: string   — 数据库类型
 *   category: string  — 分类（如 code-modules, pages, workorders）
 *   entry_id: string  — 条目ID
 *   content: object   — 条目内容（JSON）
 *   metadata: object  — 元数据（可选）
 */
async function cosDbWriteEntry(input) {
  const { bucket, db_type, category, entry_id, content, metadata } = input;
  if (!bucket || !db_type || !category || !entry_id) {
    throw new Error('缺少必填字段: bucket, db_type, category, entry_id');
  }
  if (!content) throw new Error('缺少 content');

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);
  if (!dbConfig.categories.includes(category)) {
    throw new Error(`无效的 category: ${category}，可选: ${dbConfig.categories.join(', ')}`);
  }

  // 验证 entry_id 安全性
  if (!/^[a-zA-Z0-9_-]+$/.test(entry_id)) {
    throw new Error('entry_id 包含非法字符，仅允许字母、数字、下划线、连字符');
  }
  if (entry_id.includes('..')) {
    throw new Error('entry_id 包含非法路径穿越');
  }

  const now = new Date().toISOString();
  const entry = {
    cos_db_version: COS_DB_VERSION,
    entry_id,
    category,
    db_type,
    created_at: now,
    updated_at: now,
    metadata: metadata || {},
    content
  };

  const key = `${dbConfig.root}/${category}/${entry_id}.json`;
  await cos.write(bucket, key, JSON.stringify(entry, null, 2), 'application/json');

  // 异步更新索引（不阻塞写入）
  updateIndexAfterWrite(bucket, db_type, category).catch(() => {});

  return {
    status: 'written',
    key,
    entry_id,
    category,
    db_type,
    size_bytes: Buffer.byteLength(JSON.stringify(entry))
  };
}

/**
 * cosDbReadEntry — 读取数据条目
 *
 * input:
 *   bucket: string    — 桶名
 *   db_type: string   — 数据库类型
 *   category: string  — 分类
 *   entry_id: string  — 条目ID
 */
async function cosDbReadEntry(input) {
  const { bucket, db_type, category, entry_id } = input;
  if (!bucket || !db_type || !category || !entry_id) {
    throw new Error('缺少必填字段: bucket, db_type, category, entry_id');
  }

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  const key = `${dbConfig.root}/${category}/${entry_id}.json`;
  const result = await cos.read(bucket, key);

  return {
    entry: JSON.parse(result.content),
    size_bytes: result.size_bytes,
    last_modified: result.last_modified
  };
}

/**
 * cosDbListEntries — 列出数据条目
 *
 * input:
 *   bucket: string    — 桶名
 *   db_type: string   — 数据库类型
 *   category: string  — 分类
 *   limit: number     — 最大数量（默认100）
 */
async function cosDbListEntries(input) {
  const { bucket, db_type, category, limit } = input;
  if (!bucket || !db_type || !category) {
    throw new Error('缺少必填字段: bucket, db_type, category');
  }

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  const prefix = `${dbConfig.root}/${category}/`;
  const result = await cos.list(bucket, prefix, limit || 100);

  const entries = result.files
    .filter(f => f.key.endsWith('.json') && !f.key.endsWith('.init'))
    .map(f => ({
      key: f.key,
      entry_id: f.key.replace(prefix, '').replace('.json', ''),
      size_bytes: f.size_bytes
    }));

  return {
    entries,
    count: entries.length,
    category,
    db_type
  };
}

/**
 * cosDbDeleteEntry — 删除数据条目
 *
 * input:
 *   bucket: string    — 桶名
 *   db_type: string   — 数据库类型
 *   category: string  — 分类
 *   entry_id: string  — 条目ID
 */
async function cosDbDeleteEntry(input) {
  const { bucket, db_type, category, entry_id } = input;
  if (!bucket || !db_type || !category || !entry_id) {
    throw new Error('缺少必填字段: bucket, db_type, category, entry_id');
  }

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  const key = `${dbConfig.root}/${category}/${entry_id}.json`;
  await cos.del(bucket, key);

  // 异步更新索引
  updateIndexAfterWrite(bucket, db_type, category).catch(() => {});

  return { status: 'deleted', key, entry_id };
}

/**
 * cosDbGetStats — 获取数据库统计信息
 *
 * input:
 *   bucket: string   — 桶名
 *   db_type: string  — 数据库类型
 */
async function cosDbGetStats(input) {
  const { bucket, db_type } = input;
  if (!bucket || !db_type) throw new Error('缺少 bucket 或 db_type');

  const dbConfig = DB_TYPES[db_type];
  if (!dbConfig) throw new Error(`无效的 db_type: ${db_type}`);

  // 读取索引
  let index = null;
  try {
    const result = await cos.read(bucket, `${dbConfig.root}/index.json`);
    index = JSON.parse(result.content);
  } catch {
    // 索引不存在
  }

  // 统计各分类文件数
  const categoryStats = {};
  for (const category of dbConfig.categories) {
    try {
      const result = await cos.list(bucket, `${dbConfig.root}/${category}/`, 500);
      const entries = result.files.filter(f => f.key.endsWith('.json') && !f.key.endsWith('.init'));
      categoryStats[category] = {
        entries: entries.length,
        total_size_bytes: entries.reduce((sum, f) => sum + f.size_bytes, 0)
      };
    } catch {
      categoryStats[category] = { entries: 0, total_size_bytes: 0 };
    }
  }

  const totalEntries = Object.values(categoryStats).reduce((sum, c) => sum + c.entries, 0);
  const totalSize = Object.values(categoryStats).reduce((sum, c) => sum + c.total_size_bytes, 0);

  return {
    db_type,
    bucket,
    root: dbConfig.root,
    index_exists: !!index,
    total_entries: totalEntries,
    total_size_bytes: totalSize,
    categories: categoryStats,
    last_updated: index?.updated_at || null,
    timestamp: new Date().toISOString()
  };
}

// ─── 内部辅助 ───

async function updateIndexAfterWrite(bucket, dbType, category) {
  const dbConfig = DB_TYPES[dbType];
  try {
    const result = await cos.read(bucket, `${dbConfig.root}/index.json`);
    const index = JSON.parse(result.content);

    // 更新分类计数
    const listResult = await cos.list(bucket, `${dbConfig.root}/${category}/`, 500);
    const count = listResult.files.filter(f => f.key.endsWith('.json') && !f.key.endsWith('.init')).length;

    index.category_counts = index.category_counts || {};
    index.category_counts[category] = count;
    index.total_entries = Object.values(index.category_counts).reduce((s, c) => s + c, 0);
    index.last_write = new Date().toISOString();
    index.updated_at = new Date().toISOString();

    await cos.write(bucket, `${dbConfig.root}/index.json`, JSON.stringify(index, null, 2), 'application/json');
  } catch {
    // 索引更新失败不影响主操作
  }
}

module.exports = {
  cosDbInit,
  cosDbGetIndex,
  cosDbUpdateIndex,
  cosDbWriteEntry,
  cosDbReadEntry,
  cosDbListEntries,
  cosDbDeleteEntry,
  cosDbGetStats
};
