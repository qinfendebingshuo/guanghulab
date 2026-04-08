/**
 * ═══════════════════════════════════════════════════════════
 * 模块A · COS桶语料读取引擎 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 自动检测COS桶中的压缩文件（.zip/.tar.gz/.json.gz等）
 * 解压 → 识别文件类型 → 转换为TCS通感语言结构化格式
 * 转换后的结构化数据写回COS桶的标准路径下
 *
 * 工具清单:
 *   cosListCorpus          — 列出COS桶中的语料文件
 *   cosExtractCorpus       — 解压语料并转换为TCS结构化格式
 *   cosParseGitRepoArchive — 解析代码仓库压缩文件
 *   cosParseNotionExport   — 解析Notion导出压缩文件
 *   cosParseGPTCorpus      — 解析GPT聊天语料
 *   cosGetCorpusStatus     — 查询语料处理状态
 */

'use strict';

const zlib = require('zlib');
const { promisify } = require('util');
const cos = require('../cos');

const gunzip = promisify(zlib.gunzip);
const inflate = promisify(zlib.inflate);

// ─── 支持的压缩格式 ───
const COMPRESSED_EXTENSIONS = ['.zip', '.gz', '.tar.gz', '.tgz', '.json.gz'];

// ─── TCS结构化格式定义 ───
// TCS = 通感语言核系统编程语言（Tonggan Core System）
// 所有语料转换后统一为此格式
const TCS_CORPUS_VERSION = '1.0';

/**
 * 检测文件是否为压缩文件
 */
function isCompressedFile(key) {
  const lower = key.toLowerCase();
  return COMPRESSED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

/**
 * 检测文件类型（代码/Notion/GPT语料）
 */
function detectCorpusType(key, content) {
  const lower = key.toLowerCase();
  // 路径判断
  if (lower.includes('notion') || lower.includes('notion-export')) return 'notion';
  if (lower.includes('gpt') || lower.includes('chatgpt') || lower.includes('conversations')) return 'gpt';
  if (lower.includes('github') || lower.includes('repo') || lower.includes('code')) return 'git-repo';

  // 内容判断（如果可以读取部分内容）
  if (content) {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed[0]?.mapping) return 'gpt';
      if (parsed.type === 'page' || parsed.object === 'page') return 'notion';
    } catch {
      // 非JSON，检查是否像代码文件
      if (content.includes('function ') || content.includes('const ') ||
          content.includes('import ') || content.includes('class ')) return 'git-repo';
    }
  }

  return 'unknown';
}

/**
 * cosListCorpus — 列出COS桶中的语料文件
 *
 * input:
 *   bucket: string — 桶名（hot/cold/team或完整名称）
 *   prefix: string — 路径前缀（可选）
 *   include_processed: boolean — 是否包含已处理的（默认false）
 */
async function cosListCorpus(input) {
  const { bucket, prefix, include_processed } = input;
  if (!bucket) throw new Error('缺少 bucket');

  const result = await cos.list(bucket, prefix || '', 200);

  const corpusFiles = result.files.map(file => {
    const isCompressed = isCompressedFile(file.key);
    const corpusType = detectCorpusType(file.key);
    return {
      key: file.key,
      size_bytes: file.size_bytes,
      is_compressed: isCompressed,
      corpus_type: corpusType,
      needs_extraction: isCompressed
    };
  });

  // 过滤掉已处理的（如果不需要）
  const filtered = include_processed
    ? corpusFiles
    : corpusFiles.filter(f => !f.key.includes('/tcs-structured/'));

  return {
    total: filtered.length,
    compressed: filtered.filter(f => f.is_compressed).length,
    by_type: {
      'git-repo': filtered.filter(f => f.corpus_type === 'git-repo').length,
      'notion': filtered.filter(f => f.corpus_type === 'notion').length,
      'gpt': filtered.filter(f => f.corpus_type === 'gpt').length,
      'unknown': filtered.filter(f => f.corpus_type === 'unknown').length
    },
    files: filtered
  };
}

/**
 * cosExtractCorpus — 解压语料并转换为TCS结构化格式
 *
 * 这个工具读取压缩文件，解压后自动识别类型并转换。
 * 由于COS桶中的文件可能很大，此工具采用分块处理策略。
 *
 * input:
 *   bucket: string       — 源桶
 *   key: string          — 源文件路径
 *   output_bucket: string — 输出桶（默认同源桶）
 *   output_prefix: string — 输出路径前缀（默认 tcs-structured/）
 */
async function cosExtractCorpus(input) {
  const { bucket, key, output_bucket, output_prefix } = input;
  if (!bucket || !key) throw new Error('缺少 bucket 或 key');

  const outputBucket = output_bucket || bucket;
  const outputBase = output_prefix || 'tcs-structured/';

  // 读取源文件
  const raw = await cos.read(bucket, key);
  let content = raw.content;
  let decompressed = false;

  // 尝试解压（.gz文件）
  if (key.toLowerCase().endsWith('.gz') || key.toLowerCase().endsWith('.json.gz')) {
    try {
      const buffer = Buffer.from(content, 'binary');
      const result = await gunzip(buffer);
      content = result.toString('utf8');
      decompressed = true;
    } catch {
      // 可能不是gz格式，尝试原文处理
    }
  }

  // ZIP文件需要特殊处理（ZIP解析需要外部库，这里提取目录列表）
  if (key.toLowerCase().endsWith('.zip')) {
    return {
      status: 'zip_detected',
      key,
      size_bytes: raw.size_bytes,
      message: 'ZIP文件已检测到。ZIP解析需要完整二进制流处理，建议使用cosParseGitRepoArchive或cosParseNotionExport专用工具处理。',
      corpus_type: detectCorpusType(key),
      recommendation: '请使用专用解析工具处理ZIP文件'
    };
  }

  // 自动检测语料类型
  const corpusType = detectCorpusType(key, content);

  // 根据类型转换为TCS格式
  let tcsData;
  switch (corpusType) {
    case 'gpt':
      tcsData = transformGPTToTCS(content, key);
      break;
    case 'notion':
      tcsData = transformNotionToTCS(content, key);
      break;
    case 'git-repo':
      tcsData = transformGitRepoToTCS(content, key);
      break;
    default:
      tcsData = transformGenericToTCS(content, key);
  }

  // 写入TCS结构化数据到输出桶
  const outputKey = `${outputBase}${corpusType}/${extractFileName(key)}.tcs.json`;
  await cos.write(outputBucket, outputKey, JSON.stringify(tcsData, null, 2), 'application/json');

  return {
    status: 'extracted',
    source: { bucket, key, size_bytes: raw.size_bytes, decompressed },
    output: { bucket: outputBucket, key: outputKey },
    corpus_type: corpusType,
    tcs_version: TCS_CORPUS_VERSION,
    entries: tcsData.entries?.length || 0,
    metadata: tcsData.metadata
  };
}

/**
 * cosParseGitRepoArchive — 解析代码仓库压缩文件
 *
 * 对于代码仓库导出文件（通常是JSON格式的文件列表或tar.gz），
 * 解析目录树结构，提取代码逻辑，生成TCS结构化语料。
 *
 * input:
 *   bucket: string   — 桶名
 *   key: string      — 文件路径
 *   output_bucket: string — 输出桶
 */
async function cosParseGitRepoArchive(input) {
  const { bucket, key, output_bucket } = input;
  if (!bucket || !key) throw new Error('缺少 bucket 或 key');

  const raw = await cos.read(bucket, key);
  let content = raw.content;

  // 尝试解压
  if (key.toLowerCase().endsWith('.gz')) {
    try {
      const buffer = Buffer.from(content, 'binary');
      const result = await gunzip(buffer);
      content = result.toString('utf8');
    } catch {
      // 保持原文
    }
  }

  const tcsData = transformGitRepoToTCS(content, key);
  const outputBucket = output_bucket || bucket;
  const outputKey = `tcs-structured/git-repo/${extractFileName(key)}.tcs.json`;

  await cos.write(outputBucket, outputKey, JSON.stringify(tcsData, null, 2), 'application/json');

  return {
    status: 'parsed',
    source: { bucket, key },
    output: { bucket: outputBucket, key: outputKey },
    corpus_type: 'git-repo',
    tcs_version: TCS_CORPUS_VERSION,
    entries: tcsData.entries?.length || 0,
    directory_tree: tcsData.metadata?.directory_tree || null
  };
}

/**
 * cosParseNotionExport — 解析Notion导出压缩文件
 *
 * input:
 *   bucket: string   — 桶名
 *   key: string      — 文件路径
 *   output_bucket: string — 输出桶
 */
async function cosParseNotionExport(input) {
  const { bucket, key, output_bucket } = input;
  if (!bucket || !key) throw new Error('缺少 bucket 或 key');

  const raw = await cos.read(bucket, key);
  let content = raw.content;

  if (key.toLowerCase().endsWith('.gz')) {
    try {
      const buffer = Buffer.from(content, 'binary');
      const result = await gunzip(buffer);
      content = result.toString('utf8');
    } catch {
      // 保持原文
    }
  }

  const tcsData = transformNotionToTCS(content, key);
  const outputBucket = output_bucket || bucket;
  const outputKey = `tcs-structured/notion/${extractFileName(key)}.tcs.json`;

  await cos.write(outputBucket, outputKey, JSON.stringify(tcsData, null, 2), 'application/json');

  return {
    status: 'parsed',
    source: { bucket, key },
    output: { bucket: outputBucket, key: outputKey },
    corpus_type: 'notion',
    tcs_version: TCS_CORPUS_VERSION,
    pages: tcsData.entries?.length || 0,
    categories: tcsData.metadata?.categories || []
  };
}

/**
 * cosParseGPTCorpus — 解析GPT聊天语料
 *
 * input:
 *   bucket: string   — 桶名
 *   key: string      — 文件路径
 *   output_bucket: string — 输出桶
 */
async function cosParseGPTCorpus(input) {
  const { bucket, key, output_bucket } = input;
  if (!bucket || !key) throw new Error('缺少 bucket 或 key');

  const raw = await cos.read(bucket, key);
  let content = raw.content;

  if (key.toLowerCase().endsWith('.gz')) {
    try {
      const buffer = Buffer.from(content, 'binary');
      const result = await gunzip(buffer);
      content = result.toString('utf8');
    } catch {
      // 保持原文
    }
  }

  const tcsData = transformGPTToTCS(content, key);
  const outputBucket = output_bucket || bucket;
  const outputKey = `tcs-structured/gpt/${extractFileName(key)}.tcs.json`;

  await cos.write(outputBucket, outputKey, JSON.stringify(tcsData, null, 2), 'application/json');

  return {
    status: 'parsed',
    source: { bucket, key },
    output: { bucket: outputBucket, key: outputKey },
    corpus_type: 'gpt',
    tcs_version: TCS_CORPUS_VERSION,
    conversations: tcsData.entries?.length || 0,
    total_messages: tcsData.metadata?.total_messages || 0
  };
}

/**
 * cosGetCorpusStatus — 查询语料处理状态
 *
 * input:
 *   bucket: string — 桶名（查询tcs-structured/目录下的状态）
 */
async function cosGetCorpusStatus(input) {
  const { bucket } = input;
  if (!bucket) throw new Error('缺少 bucket');

  const [rawFiles, processedFiles] = await Promise.all([
    cos.list(bucket, '', 500),
    cos.list(bucket, 'tcs-structured/', 500)
  ]);

  const rawCorpus = rawFiles.files.filter(f => isCompressedFile(f.key));
  const processed = processedFiles.files.filter(f => f.key.endsWith('.tcs.json'));

  return {
    raw_corpus: {
      total: rawCorpus.length,
      total_size_bytes: rawCorpus.reduce((sum, f) => sum + f.size_bytes, 0),
      files: rawCorpus.map(f => ({ key: f.key, size_bytes: f.size_bytes }))
    },
    processed: {
      total: processed.length,
      total_size_bytes: processed.reduce((sum, f) => sum + f.size_bytes, 0),
      by_type: {
        'git-repo': processed.filter(f => f.key.includes('/git-repo/')).length,
        'notion': processed.filter(f => f.key.includes('/notion/')).length,
        'gpt': processed.filter(f => f.key.includes('/gpt/')).length
      },
      files: processed.map(f => ({ key: f.key, size_bytes: f.size_bytes }))
    },
    pending: rawCorpus.length - processed.length,
    timestamp: new Date().toISOString()
  };
}

// ═══════════════════════════════════════════════════════════
// TCS 转换器 — 内部实现
// ═══════════════════════════════════════════════════════════

/**
 * GPT聊天记录 → TCS格式
 * ChatGPT导出格式: { title, create_time, mapping: { id: { message: { content, role } } } }
 */
function transformGPTToTCS(content, sourceKey) {
  const entries = [];
  let totalMessages = 0;

  try {
    let data = JSON.parse(content);

    // ChatGPT导出可能是数组
    if (!Array.isArray(data)) data = [data];

    for (const conversation of data) {
      const messages = [];

      if (conversation.mapping) {
        // ChatGPT格式
        for (const [, node] of Object.entries(conversation.mapping)) {
          if (node.message?.content?.parts && Array.isArray(node.message.content.parts)) {
            const text = node.message.content.parts.join('\n');
            if (text.trim()) {
              messages.push({
                role: node.message.author?.role || 'unknown',
                content: text.substring(0, 10000), // 截断超长内容
                timestamp: node.message.create_time
                  ? new Date(node.message.create_time * 1000).toISOString()
                  : null
              });
            }
          }
        }
      } else if (conversation.messages) {
        // 其他格式
        for (const msg of conversation.messages) {
          messages.push({
            role: msg.role || 'unknown',
            content: (msg.content || '').substring(0, 10000),
            timestamp: msg.timestamp || null
          });
        }
      }

      totalMessages += messages.length;
      entries.push({
        id: conversation.id || `conv-${entries.length}`,
        title: conversation.title || '未命名对话',
        created: conversation.create_time
          ? new Date(conversation.create_time * 1000).toISOString()
          : null,
        messages,
        message_count: messages.length,
        tcs_tags: extractTCSTagsFromMessages(messages)
      });
    }
  } catch {
    // 非标准JSON，作为纯文本处理
    entries.push({
      id: 'raw-text-0',
      title: '原始文本语料',
      content: content.substring(0, 50000),
      tcs_tags: ['raw', 'text']
    });
  }

  return {
    tcs_version: TCS_CORPUS_VERSION,
    corpus_type: 'gpt',
    source_key: sourceKey,
    extracted_at: new Date().toISOString(),
    metadata: {
      total_conversations: entries.length,
      total_messages: totalMessages,
      source: 'gpt-export'
    },
    entries
  };
}

/**
 * Notion导出 → TCS格式
 * Notion导出通常是HTML或Markdown文件
 */
function transformNotionToTCS(content, sourceKey) {
  const entries = [];
  const categories = new Set();

  try {
    // 尝试JSON解析（Notion API导出格式）
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      for (const page of data) {
        const category = page.properties?.category?.select?.name || 'uncategorized';
        categories.add(category);
        entries.push({
          id: page.id || `page-${entries.length}`,
          title: extractNotionTitle(page),
          category,
          content: extractNotionContent(page),
          properties: page.properties || {},
          tcs_tags: ['notion', category]
        });
      }
    } else if (data.object === 'page' || data.type === 'page') {
      entries.push({
        id: data.id || 'page-0',
        title: extractNotionTitle(data),
        category: 'single-page',
        content: extractNotionContent(data),
        properties: data.properties || {},
        tcs_tags: ['notion', 'single-page']
      });
    } else if (data.results) {
      // 数据库查询结果
      for (const page of data.results) {
        const category = page.properties?.category?.select?.name || 'uncategorized';
        categories.add(category);
        entries.push({
          id: page.id || `page-${entries.length}`,
          title: extractNotionTitle(page),
          category,
          content: extractNotionContent(page),
          tcs_tags: ['notion', category]
        });
      }
    }
  } catch {
    // 可能是HTML或Markdown（Notion桌面端导出格式）
    const sections = content.split(/(?=^#+ )/m);
    for (const section of sections) {
      if (section.trim()) {
        const titleMatch = section.match(/^#+\s+(.+)/);
        const title = titleMatch ? titleMatch[1].trim() : '未命名章节';
        categories.add('markdown');
        entries.push({
          id: `section-${entries.length}`,
          title,
          category: 'markdown',
          content: section.trim().substring(0, 20000),
          tcs_tags: ['notion', 'markdown']
        });
      }
    }
  }

  return {
    tcs_version: TCS_CORPUS_VERSION,
    corpus_type: 'notion',
    source_key: sourceKey,
    extracted_at: new Date().toISOString(),
    metadata: {
      total_pages: entries.length,
      categories: [...categories],
      source: 'notion-export'
    },
    entries
  };
}

/**
 * 代码仓库文件 → TCS格式
 */
function transformGitRepoToTCS(content, sourceKey) {
  const entries = [];
  const directoryTree = [];
  const fileTypes = new Set();

  try {
    // 尝试JSON（可能是GitHub API export格式）
    const data = JSON.parse(content);

    if (Array.isArray(data)) {
      for (const item of data) {
        if (item.path || item.name) {
          const filePath = item.path || item.name;
          const ext = filePath.split('.').pop() || 'unknown';
          fileTypes.add(ext);
          directoryTree.push(filePath);
          entries.push({
            id: `file-${entries.length}`,
            path: filePath,
            type: ext,
            content: (item.content || item.body || '').substring(0, 20000),
            size_bytes: item.size || 0,
            tcs_tags: ['code', ext, categorizeCodeFile(filePath)]
          });
        }
      }
    } else if (data.tree) {
      // Git tree API格式
      for (const item of data.tree) {
        if (item.type === 'blob') {
          const ext = item.path.split('.').pop() || 'unknown';
          fileTypes.add(ext);
          directoryTree.push(item.path);
          entries.push({
            id: item.sha || `file-${entries.length}`,
            path: item.path,
            type: ext,
            size_bytes: item.size || 0,
            tcs_tags: ['code', ext, categorizeCodeFile(item.path)]
          });
        }
      }
    }
  } catch {
    // 纯代码文本，按行切分分析
    const lines = content.split('\n');
    const codeBlocks = [];
    let currentBlock = [];
    let blockName = 'main';

    for (const line of lines) {
      // 检测函数/类定义
      const funcMatch = line.match(/(?:function|class|const|let|var|def|async)\s+(\w+)/);
      if (funcMatch && currentBlock.length > 0) {
        codeBlocks.push({ name: blockName, content: currentBlock.join('\n') });
        currentBlock = [];
        blockName = funcMatch[1];
      }
      currentBlock.push(line);
    }
    if (currentBlock.length > 0) {
      codeBlocks.push({ name: blockName, content: currentBlock.join('\n') });
    }

    for (const block of codeBlocks) {
      entries.push({
        id: `block-${entries.length}`,
        path: sourceKey,
        name: block.name,
        content: block.content.substring(0, 20000),
        tcs_tags: ['code', 'raw-text']
      });
    }
  }

  return {
    tcs_version: TCS_CORPUS_VERSION,
    corpus_type: 'git-repo',
    source_key: sourceKey,
    extracted_at: new Date().toISOString(),
    metadata: {
      total_files: entries.length,
      file_types: [...fileTypes],
      directory_tree: directoryTree.slice(0, 200),
      source: 'git-repo-export'
    },
    entries
  };
}

/**
 * 通用文件 → TCS格式（兜底处理）
 */
function transformGenericToTCS(content, sourceKey) {
  return {
    tcs_version: TCS_CORPUS_VERSION,
    corpus_type: 'generic',
    source_key: sourceKey,
    extracted_at: new Date().toISOString(),
    metadata: {
      size_chars: content.length,
      source: 'generic'
    },
    entries: [{
      id: 'raw-0',
      content: content.substring(0, 50000),
      tcs_tags: ['generic', 'raw']
    }]
  };
}

// ═══════════════════════════════════════════════════════════
// 辅助函数
// ═══════════════════════════════════════════════════════════

function extractFileName(key) {
  const parts = key.split('/');
  const fileName = parts[parts.length - 1] || 'unnamed';
  return fileName.replace(/\.(zip|gz|tar\.gz|tgz|json\.gz)$/i, '');
}

function extractTCSTagsFromMessages(messages) {
  const tags = new Set(['gpt']);
  for (const msg of messages) {
    if (msg.role === 'system') tags.add('system-prompt');
    if (msg.content?.includes('代码') || msg.content?.includes('code')) tags.add('code-related');
    if (msg.content?.includes('人格') || msg.content?.includes('persona')) tags.add('persona-related');
    if (msg.content?.includes('铸渊') || msg.content?.includes('冰朔')) tags.add('core-identity');
  }
  return [...tags];
}

function extractNotionTitle(page) {
  if (!page.properties) return '未命名';
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title) {
      return prop.title.map(t => t.plain_text || '').join('');
    }
  }
  return '未命名';
}

function extractNotionContent(page) {
  if (page.blocks) {
    return page.blocks.map(b => {
      if (b.paragraph?.rich_text) {
        return b.paragraph.rich_text.map(t => t.plain_text || '').join('');
      }
      if (b.heading_1?.rich_text) {
        return '# ' + b.heading_1.rich_text.map(t => t.plain_text || '').join('');
      }
      if (b.heading_2?.rich_text) {
        return '## ' + b.heading_2.rich_text.map(t => t.plain_text || '').join('');
      }
      if (b.code?.rich_text) {
        return '```\n' + b.code.rich_text.map(t => t.plain_text || '').join('') + '\n```';
      }
      return '';
    }).filter(Boolean).join('\n');
  }
  return '';
}

function categorizeCodeFile(filePath) {
  const lower = filePath.toLowerCase();
  if (lower.includes('test') || lower.includes('spec')) return 'test';
  if (lower.includes('config') || lower.endsWith('.json') || lower.endsWith('.yml')) return 'config';
  if (lower.includes('schema') || lower.endsWith('.sql')) return 'schema';
  if (lower.includes('agent') || lower.includes('workflow')) return 'agent';
  if (lower.includes('route') || lower.includes('api')) return 'api';
  if (lower.includes('middleware')) return 'middleware';
  if (lower.includes('model') || lower.includes('db')) return 'data';
  return 'source';
}

module.exports = {
  cosListCorpus,
  cosExtractCorpus,
  cosParseGitRepoArchive,
  cosParseNotionExport,
  cosParseGPTCorpus,
  cosGetCorpusStatus
};
