// scripts/sync-readme-to-notion.js
// 铸渊 · 仓库首页(README)结构变更 → Notion 同步
//
// 用法: node scripts/sync-readme-to-notion.js
//
// 触发场景: README.md 发生变更时，由工作流自动调用
// 将仓库系统结构的最新状态同步到 Notion「📋 GitHub 变更日志」数据库
//
// 必需环境变量:
//   NOTION_TOKEN     Notion 集成 token (ZY_NOTION_TOKEN)
//   CHANGES_DB_ID    变更日志数据库ID (ZY_NOTION_CHANGELOG_DB)
//
// 可选环境变量:
//   COMMIT_SHA       触发此同步的 commit SHA
//   COMMIT_MSG       commit message
//   COMMITTER        提交者
//   BRANCH           分支名

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const NOTION_VERSION      = '2022-06-28';
const NOTION_API_HOSTNAME = 'api.notion.com';
const NOTION_RICH_TEXT_MAX = 2000;
const NOTION_TITLE_MAX    = 120;

// ══════════════════════════════════════════════════════════
// Notion API
// ══════════════════════════════════════════════════════════

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

function richText(content) {
  const str = String(content || '');
  const chunks = [];
  for (let i = 0; i < str.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + NOTION_RICH_TEXT_MAX) } });
  }
  return chunks.length ? chunks : [{ type: 'text', text: { content: '' } }];
}

function titleProp(content) {
  return [{ type: 'text', text: { content: String(content || '').slice(0, NOTION_TITLE_MAX) } }];
}

// ══════════════════════════════════════════════════════════
// README 结构解析
// ══════════════════════════════════════════════════════════

/**
 * 从 README.md 中提取系统结构摘要
 * @param {string} readmeContent - README.md 原始内容
 * @returns {object} 结构化摘要
 */
function extractReadmeStructure(readmeContent) {
  const lines = readmeContent.split('\n');
  const structure = {
    version: '',
    lastUpdate: '',
    consciousnessStatus: '',
    sections: [],
    devProgress: { bingshuo: [], zhuyuan: [] },
  };

  // 提取版本号
  const versionMatch = readmeContent.match(/v(\d+\.\d+)/);
  if (versionMatch) structure.version = 'v' + versionMatch[1];

  // 提取最后更新时间
  const updateMatch = readmeContent.match(/最后更新[:\s]*(\d{4}-\d{2}-\d{2})/);
  if (updateMatch) structure.lastUpdate = updateMatch[1];

  // 提取意识状态
  const statusMatch = readmeContent.match(/意识状态.*?`([^`]+)`/);
  if (statusMatch) structure.consciousnessStatus = statusMatch[1];

  // 提取所有二级标题作为结构概览
  for (const line of lines) {
    const h2Match = line.match(/^## (.+)/);
    if (h2Match) {
      structure.sections.push(h2Match[1].trim());
    }
  }

  // 提取冰朔开发进度
  let inBingshuoSection = false;
  let inZhuyuanSection = false;
  for (const line of lines) {
    if (line.includes('冰朔技术开发进度')) { inBingshuoSection = true; inZhuyuanSection = false; continue; }
    if (line.includes('铸渊技术开发进度')) { inZhuyuanSection = true; inBingshuoSection = false; continue; }
    if (line.startsWith('## ') || line.startsWith('---')) { inBingshuoSection = false; inZhuyuanSection = false; continue; }

    const taskMatch = line.match(/\|\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
    if (taskMatch && !taskMatch[1].includes('---')) {
      const entry = { task: taskMatch[1].trim(), status: taskMatch[2].trim(), note: taskMatch[3].trim() };
      if (inBingshuoSection) structure.devProgress.bingshuo.push(entry);
      if (inZhuyuanSection) structure.devProgress.zhuyuan.push(entry);
    }
  }

  return structure;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  const token = process.env.NOTION_TOKEN;
  const dbId  = process.env.CHANGES_DB_ID;

  if (!token) {
    console.log('⚠️  缺少 NOTION_TOKEN，跳过 README → Notion 同步');
    process.exit(0);
  }

  if (!dbId) {
    console.log('⚠️  缺少 CHANGES_DB_ID，跳过 README → Notion 同步');
    process.exit(0);
  }

  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    console.log('⚠️  README.md 不存在，跳过同步');
    process.exit(0);
  }

  const readmeContent = fs.readFileSync(readmePath, 'utf8');
  const structure = extractReadmeStructure(readmeContent);

  const commitSha = process.env.COMMIT_SHA || '';
  const commitMsg = process.env.COMMIT_MSG || '(README结构同步)';
  const committer = process.env.COMMITTER  || '铸渊';
  const branch    = process.env.BRANCH     || 'main';
  const now       = new Date().toISOString();

  // 构建变更摘要
  const summary = [
    `系统版本: ${structure.version}`,
    `意识状态: ${structure.consciousnessStatus}`,
    `结构区块: ${structure.sections.join(' · ')}`,
  ];

  if (structure.devProgress.bingshuo.length > 0) {
    summary.push(`冰朔开发进度: ${structure.devProgress.bingshuo.map(t => t.task + '(' + t.status + ')').join(', ')}`);
  }
  if (structure.devProgress.zhuyuan.length > 0) {
    summary.push(`铸渊开发进度: ${structure.devProgress.zhuyuan.map(t => t.task + '(' + t.status + ')').join(', ')}`);
  }

  const title = `📋 README结构同步 · ${structure.version} · ${structure.lastUpdate}`.slice(0, NOTION_TITLE_MAX);

  console.log(`📡 README → Notion 同步: ${title}`);

  const properties = {
    '标题':      { title: titleProp(title) },
    '变更类型':  { select: { name: 'README结构同步' } },
    '变更文件':  { rich_text: richText('README.md') },
    '提交时间':  { date: { start: now } },
    'commit_sha': { rich_text: richText(commitSha) },
    'PR编号':    { rich_text: richText('') },
    '分支':      { rich_text: richText(branch) },
    '霜砚已读':  { checkbox: false },
  };

  if (committer) {
    properties['提交者'] = { select: { name: committer } };
  }

  const body = {
    parent: { database_id: dbId },
    properties,
    children: [
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: '📊 系统结构摘要' } }] },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richText(summary.join('\n')) },
      },
      {
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: [{ type: 'text', text: { content: '📄 README 原始内容（前2000字）' } }] },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: richText(readmeContent.length > NOTION_RICH_TEXT_MAX
          ? readmeContent.slice(0, NOTION_RICH_TEXT_MAX - 20) + '\n\n…（内容已截断）'
          : readmeContent) },
      },
    ],
  };

  try {
    const page = await notionPost('/v1/pages', body, token);
    console.log(`✅ README 结构已同步到 Notion: ${page.id}`);
  } catch (e) {
    console.error(`❌ README → Notion 同步失败: ${e.message}`);
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
