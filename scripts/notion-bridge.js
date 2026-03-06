// scripts/notion-bridge.js
// 铸渊 → Notion 数据桥（共用模块）
//
// 管道 A (syslog):   node scripts/notion-bridge.js syslog
// 管道 E (changes):  node scripts/notion-bridge.js changes
//
// 必需环境变量：
//   NOTION_TOKEN     GitHub Secret: NOTION_TOKEN
//
// 可选环境变量（有内置默认值）：
//   SYSLOG_DB_ID     「GitHub SYSLOG 收件箱」database_id（默认已内置）
//   CHANGES_DB_ID    「GitHub 变更日志」database_id（默认已内置）
//
// 管道 E 额外环境变量（由 workflow 注入，见下方说明）

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ══════════════════════════════════════════════════════════
// 常量
// ══════════════════════════════════════════════════════════

const NOTION_VERSION        = '2022-06-28';
const NOTION_API_HOSTNAME   = 'api.notion.com';
const NOTION_RICH_TEXT_MAX  = 2000; // Notion rich_text 单个 text object 内容上限
const NOTION_TITLE_MAX      = 120;  // Notion 标题属性建议截断长度
const UNKNOWN_COMMITTER     = '未知'; // 提交者信息缺失时的默认值

// Notion 数据库 ID（霜砚已在 Notion 侧建好，ID 固定）
const DEFAULT_SYSLOG_DB_ID  = '330ab17507d542c9bbb96d0749b41197';
const DEFAULT_CHANGES_DB_ID = 'e740b77aa6bd4ac0a2e8a75f678fba98';

// ══════════════════════════════════════════════════════════
// Notion API 基础调用
// ══════════════════════════════════════════════════════════

/**
 * 向 Notion API 发起 HTTPS POST 请求
 * @param {string} endpoint  - e.g. '/v1/pages'
 * @param {object} body      - JSON body
 * @param {string} token     - Bearer token
 * @returns {Promise<object>} - Notion API 返回值
 */
function notionPost(endpoint, body, token) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const opts = {
      hostname: NOTION_API_HOSTNAME,
      port:     443,
      path:     endpoint,
      method:   'POST',
      headers: {
        'Authorization':  'Bearer ' + token,
        'Content-Type':   'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };

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
    req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// Notion 属性构建辅助函数
// ══════════════════════════════════════════════════════════

/**
 * 构建 Notion rich_text 属性值
 * 自动将超过 NOTION_RICH_TEXT_MAX 的内容切分为多个 text object
 * @param {string} content
 * @returns {Array}
 */
function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

/**
 * 构建 Notion title 属性值
 * @param {string} content
 */
function titleProp(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, NOTION_TITLE_MAX) } }];
}

/**
 * 构建 Notion paragraph block（用于页面正文）
 * @param {string} content
 */
function paragraph(content) {
  return {
    object:    'block',
    type:      'paragraph',
    paragraph: { rich_text: richText(String(content || '').slice(0, NOTION_RICH_TEXT_MAX)) },
  };
}

/**
 * 构建 Notion heading_3 block
 */
function heading3(content) {
  return {
    object:    'block',
    type:      'heading_3',
    heading_3: { rich_text: [{ type: 'text', text: { content: String(content || '') } }] },
  };
}

// ══════════════════════════════════════════════════════════
// 管道 A · SYSLOG 收件箱同步到 Notion
// ══════════════════════════════════════════════════════════
//
// Notion「📥 GitHub SYSLOG 收件箱」数据库属性（霜砚已建）：
//   标题       title       SYSLOG 文件名
//   DEV编号    select      开发者编号，如 DEV-001
//   文件内容   rich_text   SYSLOG 文件完整文本
//   接收时间   date        推送时间
//   处理状态   status      固定填「待处理」
//   来源路径   rich_text   GitHub 中的文件路径
//   commit_sha rich_text   对应的 Git commit SHA
//   推送方     rich_text   固定填「铸渊」

/**
 * 将单条 syslog entry 写入 Notion 数据库
 * @param {string} dbId        - 「GitHub SYSLOG 收件箱」database_id
 * @param {string} fileContent - 文件原始内容（字符串）
 * @param {string} filePath    - 相对路径（用于溯源）
 * @param {object} entry       - 解析后的 JSON（或空对象）
 * @param {string} commitSha   - Git commit SHA
 * @param {string} token       - Notion token
 */
async function createSyslogRecord(dbId, fileContent, filePath, entry, commitSha, token) {
  const filename = path.basename(filePath);
  const title    = entry.title || filename;
  const devId    = entry.from  || entry.dev_id || '';
  const ts       = entry.timestamp || new Date().toISOString();

  const properties = {
    '标题':      { title: titleProp(title) },
    '文件内容':  { rich_text: richText(fileContent) },
    '来源路径':  { rich_text: richText(filePath) },
    '接收时间':  { date: { start: ts } },
    '处理状态':  { status: { name: '待处理' } },
    'commit_sha': { rich_text: richText(commitSha || '') },
    '推送方':    { rich_text: richText('铸渊') },
  };

  // DEV编号 select 只在有值时设置（空值会导致 Notion API 报错）
  if (devId) {
    properties['DEV编号'] = { select: { name: devId } };
  }

  const body = {
    parent:     { database_id: dbId },
    properties,
  };

  return notionPost('/v1/pages', body, token);
}

/**
 * 递归扫描目录，返回所有匹配的文件路径
 */
function scanDir(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.gitkeep') continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...scanDir(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

async function runPipelineA() {
  const token    = process.env.NOTION_TOKEN;
  const dbId     = process.env.SYSLOG_DB_ID || DEFAULT_SYSLOG_DB_ID;
  const commitSha = process.env.COMMIT_SHA  || '';

  if (!token) {
    console.log('⚠️  管道A: 缺少 NOTION_TOKEN，跳过 Notion 同步');
    process.exit(0);
  }

  const INBOX_DIR = 'syslog-inbox';
  const files = scanDir(INBOX_DIR, ['.json', '.md', '.txt']);

  if (files.length === 0) {
    console.log('📭 syslog-inbox/ 无待处理条目，跳过 Notion 同步');
    process.exit(0);
  }

  console.log(`📥 管道A: 发现 ${files.length} 条 syslog，开始同步到 Notion…`);

  let ok = 0, failed = 0;

  for (const fullPath of files) {
    const relPath = fullPath.replace(/\\/g, '/'); // normalize on Windows
    let raw, entry;

    try {
      raw   = fs.readFileSync(fullPath, 'utf8');
      entry = fullPath.endsWith('.json') ? JSON.parse(raw) : {};
    } catch (e) {
      console.error(`❌ 读取 ${relPath} 失败: ${e.message}`);
      failed++;
      continue;
    }

    try {
      const page = await createSyslogRecord(dbId, raw, relPath, entry, commitSha, token);
      console.log(`  ✅ ${relPath} → Notion page: ${page.id}`);
      ok++;
    } catch (e) {
      console.error(`  ❌ ${relPath} → Notion 失败: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n✅ 管道A Notion 同步完成 · 成功 ${ok} 条 · 失败 ${failed} 条`);
  if (failed > 0) process.exit(1);
}

// ══════════════════════════════════════════════════════════
// 管道 E · GitHub 变更日志同步到 Notion
// ══════════════════════════════════════════════════════════
//
// Notion「📋 GitHub 变更日志」数据库属性（霜砚已建）：
//   标题       title       commit message 或 PR标题
//   提交者     select      DEV编号或"铸渊""妈妈"
//   变更类型   select      Commit / PR opened / PR merged / PR closed
//   变更文件   rich_text   变更的文件路径列表
//   提交时间   date        Git提交时间
//   commit_sha rich_text   Git commit SHA
//   PR编号     rich_text   PR号（PR事件）
//   分支       rich_text   分支名
//   霜砚已读   checkbox    固定填 false
//
// 环境变量（由 workflow 注入）：
//   EVENT_TYPE        commit | pr
//   COMMIT_SHA        提交 SHA
//   COMMIT_MSG        commit message（push 事件）
//   COMMITTER         提交者用户名
//   COMMIT_TIMESTAMP  提交时间 ISO
//   CHANGED_FILES     换行符分隔的变更文件路径列表
//   BRANCH            分支名
//   PR_NUMBER         PR 编号（pr 事件）
//   PR_TITLE          PR 标题（pr 事件）
//   PR_ACTION         opened | closed（pr 事件）
//   PR_MERGED         true | false（pr 事件）

async function runPipelineE() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.CHANGES_DB_ID || DEFAULT_CHANGES_DB_ID;

  if (!token) {
    console.log('⚠️  管道E: 缺少 NOTION_TOKEN，跳过 Notion 同步');
    process.exit(0);
  }

  const eventType    = process.env.EVENT_TYPE        || 'commit';
  const now          = process.env.COMMIT_TIMESTAMP  || new Date().toISOString();
  const commitSha    = process.env.COMMIT_SHA        || '';
  const branch       = process.env.BRANCH            || '';
  const changedFiles = (process.env.CHANGED_FILES || '').trim();
  const committer    = process.env.COMMITTER         || UNKNOWN_COMMITTER;

  let title, changeType, prNumber;

  if (eventType === 'pr') {
    const action  = process.env.PR_ACTION || 'opened';
    const merged  = process.env.PR_MERGED === 'true';
    prNumber      = process.env.PR_NUMBER || '';
    const prTitle = process.env.PR_TITLE  || '(无标题)';

    if (merged)          changeType = 'PR merged';
    else if (action === 'closed') changeType = 'PR closed';
    else                 changeType = 'PR opened';

    title = `PR #${prNumber}: ${prTitle}`.slice(0, NOTION_TITLE_MAX);
  } else {
    const msg = process.env.COMMIT_MSG || '(无 commit message)';
    title      = msg.split('\n')[0].slice(0, NOTION_TITLE_MAX);
    changeType = 'Commit';
    prNumber   = '';
  }

  console.log(`📡 管道E: 同步变更记录到 Notion: ${title}`);

  const properties = {
    '标题':      { title: titleProp(title) },
    '变更类型':  { select: { name: changeType } },
    '变更文件':  { rich_text: richText(changedFiles) },
    '提交时间':  { date: { start: now } },
    'commit_sha': { rich_text: richText(commitSha) },
    'PR编号':    { rich_text: richText(prNumber || '') },
    '分支':      { rich_text: richText(branch) },
    '霜砚已读':  { checkbox: false },
  };

  // 提交者 select 只在有值时设置
  if (committer && committer !== UNKNOWN_COMMITTER) {
    properties['提交者'] = { select: { name: committer } };
  }

  const body = {
    parent:     { database_id: dbId },
    properties,
  };

  try {
    const page = await notionPost('/v1/pages', body, token);
    console.log(`✅ 管道E 变更记录已写入 Notion: ${page.id}`);
  } catch (e) {
    console.error(`❌ 管道E 写入 Notion 失败: ${e.message}`);
    process.exit(1);
  }
}

// ══════════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════════

const mode = process.argv[2];

if (mode === 'syslog') {
  runPipelineA().catch(e => { console.error(e); process.exit(1); });
} else if (mode === 'changes') {
  runPipelineE().catch(e => { console.error(e); process.exit(1); });
} else {
  console.error('用法: node scripts/notion-bridge.js [syslog|changes]');
  process.exit(1);
}
