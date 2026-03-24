/**
 * scripts/tcs-semantic-landing.js
 *
 * 功能：语义直连落盘 (Semantic Direct Landing)
 *
 * 监听含 [TCS-MEMO] 或 [TCS-TABLE] 标题的 Issue，执行以下动作：
 *   - [TCS-MEMO]：将 Issue Body 创建/更新为 Google Docs（原生文档）
 *   - [TCS-TABLE]：将 Issue Body 解析为 CSV/JSON，写入 Google Sheets（原生表格）
 *
 * 所有文档投射至目标文件夹 ID：1fqWdLPaZkUZYt4OT_h3fJQHnd-q5QN3G
 * 完成后在 Issue 下回复文档/表格直连 ID。
 *
 * 环境变量：
 *   - GDRIVE_CLIENT_ID: OAuth 客户端 ID
 *   - GDRIVE_CLIENT_SECRET: OAuth 客户端密钥
 *   - GDRIVE_REFRESH_TOKEN: 长效刷新令牌
 *   - DRIVE_LANDING_FOLDER_ID: 目标 Drive 文件夹 ID
 *   - GITHUB_TOKEN: GitHub API 令牌
 *   - ISSUE_NUMBER: Issue 编号
 *   - ISSUE_TITLE: Issue 标题
 *   - ISSUE_BODY: Issue 正文内容
 *   - GITHUB_REPOSITORY: owner/repo
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 * 主权: TCS-0002∞
 */

const { google } = require('googleapis');
const https = require('https');

// ═══════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════

const TAG_MEMO = '[TCS-MEMO]';
const TAG_TABLE = '[TCS-TABLE]';
const LANDING_SUBFOLDER = 'tcs-semantic-landing';

// ═══════════════════════════════════════════════
// Google API 认证（OAuth2 代理人模式）
// ═══════════════════════════════════════════════

function buildAuth() {
  const { getOAuth2Client } = require('./grid-db/drive-auth');
  return getOAuth2Client();
}

// ═══════════════════════════════════════════════
// Drive 辅助函数
// ═══════════════════════════════════════════════

function escapeQuery(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * 在 Drive 中查找或创建子文件夹
 */
async function getOrCreateFolder(drive, parentId, folderName) {
  const safeName = escapeQuery(folderName);
  const query = `name='${safeName}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0].id;
  }

  const createRes = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [parentId]
    },
    fields: 'id'
  });
  console.log(`[semantic-landing] Created folder: ${folderName}`);
  return createRes.data.id;
}

/**
 * 在 Drive 文件夹中查找同名文件
 */
async function findFileByName(drive, folderId, fileName, mimeType) {
  const safeName = escapeQuery(fileName);
  let query = `name='${safeName}' and '${folderId}' in parents and trashed=false`;
  if (mimeType) {
    query += ` and mimeType='${mimeType}'`;
  }
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name)',
    pageSize: 1
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }
  return null;
}

// ═══════════════════════════════════════════════
// [TCS-MEMO] 处理：创建/更新 Google Docs
// ═══════════════════════════════════════════════

async function handleMemo(auth, drive, folderId, issueTitle, issueBody, issueNumber) {
  const docs = google.docs({ version: 'v1', auth });
  const docTitle = `TCS-MEMO #${issueNumber}: ${issueTitle.replace(TAG_MEMO, '').trim()}`;
  const content = issueBody || '(empty)';

  // 检查是否已存在同名文档
  const existingFile = await findFileByName(
    drive, folderId, docTitle, 'application/vnd.google-apps.document'
  );

  let docId;

  if (existingFile) {
    // 更新：先清空再写入
    docId = existingFile.id;
    console.log(`[semantic-landing] Updating existing doc: ${docId}`);

    // 获取当前文档内容长度
    // Google Docs body content elements each have an endIndex; we need the max
    // to know where existing content ends. Start at 1 because index 0 is reserved
    // by Docs for the document root and content starts at index 1.
    const docData = await docs.documents.get({ documentId: docId });
    const endIndex = docData.data.body.content
      .reduce((max, el) => Math.max(max, el.endIndex || 0), 1);

    const requests = [];
    if (endIndex > 2) {
      requests.push({
        deleteContentRange: {
          range: { startIndex: 1, endIndex: endIndex - 1 }
        }
      });
    }
    requests.push({
      insertText: {
        location: { index: 1 },
        text: content
      }
    });

    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: { requests }
    });
    console.log(`[semantic-landing] Doc updated: ${docId}`);
  } else {
    // 创建新 Google Doc
    const createRes = await drive.files.create({
      requestBody: {
        name: docTitle,
        mimeType: 'application/vnd.google-apps.document',
        parents: [folderId]
      },
      fields: 'id'
    });
    docId = createRes.data.id;
    console.log(`[semantic-landing] Doc created: ${docId}`);

    // 写入内容
    await docs.documents.batchUpdate({
      documentId: docId,
      requestBody: {
        requests: [{
          insertText: {
            location: { index: 1 },
            text: content
          }
        }]
      }
    });
    console.log(`[semantic-landing] Content written to doc: ${docId}`);
  }

  return {
    type: 'Google Docs',
    id: docId,
    url: `https://docs.google.com/document/d/${docId}/edit`,
    action: existingFile ? 'updated' : 'created'
  };
}

// ═══════════════════════════════════════════════
// [TCS-TABLE] 处理：创建/更新 Google Sheets
// ═══════════════════════════════════════════════

/**
 * 从 Issue Body 解析表格数据
 * 支持格式：
 *   1. JSON 数组: [["a","b"],["c","d"]]
 *   2. CSV 文本块 (用 ```csv 包裹或纯 CSV)
 *   3. Markdown 表格: | col1 | col2 |
 */
function parseTableData(body) {
  if (!body || !body.trim()) {
    return [['(empty)']];
  }

  // 1. 尝试 JSON 解析
  const jsonMatch = body.match(/```(?:json)?\s*\n([\s\S]*?)\n?```/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1].trim());
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && Array.isArray(parsed[0])) {
          return parsed; // 二维数组
        }
        if (parsed.length > 0 && typeof parsed[0] === 'object') {
          // 对象数组 → 表头 + 行
          const headers = Object.keys(parsed[0]);
          const rows = parsed.map(obj => headers.map(h => String(obj[h] ?? '')));
          return [headers, ...rows];
        }
      }
    } catch (e) {
      // 不是 JSON，继续其他解析
    }
  }

  // 也尝试直接从 body 解析 JSON（不在代码块中）
  const trimmed = body.trim();
  if (trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        if (parsed.length > 0 && Array.isArray(parsed[0])) {
          return parsed;
        }
        if (parsed.length > 0 && typeof parsed[0] === 'object') {
          const headers = Object.keys(parsed[0]);
          const rows = parsed.map(obj => headers.map(h => String(obj[h] ?? '')));
          return [headers, ...rows];
        }
      }
    } catch (e) {
      // 继续其他解析
    }
  }

  // 2. 尝试 CSV 解析（代码块内或纯文本）
  const csvMatch = body.match(/```(?:csv)?\s*\n([\s\S]*?)\n?```/);
  const csvContent = csvMatch ? csvMatch[1].trim() : null;

  if (csvContent) {
    return parseCSV(csvContent);
  }

  // 3. 尝试 Markdown 表格解析
  const mdTableMatch = body.match(/(\|[^\n]+\|\s*\n\|[-\s|:]+\|\s*\n(?:\|[^\n]+\|\s*\n?)*)/);
  if (mdTableMatch) {
    return parseMarkdownTable(mdTableMatch[1]);
  }

  // 4. Check if body looks like CSV (consistent comma-separated columns across lines)
  const lines = trimmed.split('\n').filter(l => l.trim());
  if (lines.length >= 2 && lines.every(l => l.includes(','))) {
    const colCounts = lines.map(l => parseCSVLine(l).length);
    const firstCount = colCounts[0];
    if (firstCount >= 2 && colCounts.every(c => c === firstCount)) {
      return parseCSV(trimmed);
    }
  }

  // 5. 降级：整个 body 作为单格数据
  return [[trimmed]];
}

/**
 * Parse a single CSV line, handling quoted values containing commas.
 */
function parseCSVLine(line) {
  const cells = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCSV(text) {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => parseCSVLine(line));
}

function parseMarkdownTable(text) {
  const lines = text.split('\n').filter(l => l.trim());
  const rows = [];

  for (const line of lines) {
    // 跳过分隔行 |---|---|
    if (/^\|[\s\-:|]+\|$/.test(line.trim())) continue;
    const cells = line
      .split('|')
      .slice(1, -1) // 去掉首尾空元素
      .map(c => c.trim());
    if (cells.length > 0) {
      rows.push(cells);
    }
  }

  return rows.length > 0 ? rows : [['(empty)']];
}

async function handleTable(auth, drive, folderId, issueTitle, issueBody, issueNumber) {
  const sheets = google.sheets({ version: 'v4', auth });
  const sheetTitle = `TCS-TABLE #${issueNumber}: ${issueTitle.replace(TAG_TABLE, '').trim()}`;
  const tableData = parseTableData(issueBody);

  // 检查是否已存在同名表格
  const existingFile = await findFileByName(
    drive, folderId, sheetTitle, 'application/vnd.google-apps.spreadsheet'
  );

  let spreadsheetId;

  if (existingFile) {
    spreadsheetId = existingFile.id;
    console.log(`[semantic-landing] Updating existing sheet: ${spreadsheetId}`);

    // 清空并写入
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'Sheet1'
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: tableData
      }
    });
    console.log(`[semantic-landing] Sheet updated: ${spreadsheetId}`);
  } else {
    // 创建新 Spreadsheet
    const createRes = await drive.files.create({
      requestBody: {
        name: sheetTitle,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        parents: [folderId]
      },
      fields: 'id'
    });
    spreadsheetId = createRes.data.id;
    console.log(`[semantic-landing] Sheet created: ${spreadsheetId}`);

    // 写入数据
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: tableData
      }
    });
    console.log(`[semantic-landing] Data written to sheet: ${spreadsheetId}`);
  }

  return {
    type: 'Google Sheets',
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    action: existingFile ? 'updated' : 'created'
  };
}

// ═══════════════════════════════════════════════
// GitHub Issue 回复
// ═══════════════════════════════════════════════

function postIssueComment(token, repo, issueNumber, body) {
  return new Promise((resolve, reject) => {
    const [owner, repoName] = repo.split('/');
    const data = JSON.stringify({ body });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${owner}/${repoName}/issues/${issueNumber}/comments`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'zhuyuan-semantic-landing',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = https.request(options, (res) => {
      let responseBody = '';
      res.on('data', chunk => responseBody += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(responseBody));
          } catch (e) {
            resolve({ raw: responseBody });
          }
        } else {
          reject(new Error(`GitHub API ${res.statusCode}: ${responseBody}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ═══════════════════════════════════════════════
// 主流程
// ═══════════════════════════════════════════════

async function main() {
  const rootFolderId = process.env.DRIVE_LANDING_FOLDER_ID;
  const githubToken = process.env.GITHUB_TOKEN;
  const issueNumber = process.env.ISSUE_NUMBER;
  const issueTitle = process.env.ISSUE_TITLE || '';
  const issueBody = process.env.ISSUE_BODY || '';
  const repo = process.env.GITHUB_REPOSITORY;

  // 验证必需环境变量
  if (!rootFolderId) {
    console.error('[semantic-landing] DRIVE_LANDING_FOLDER_ID not set');
    process.exit(1);
  }
  if (!githubToken || !issueNumber || !repo) {
    console.error('[semantic-landing] Missing GITHUB_TOKEN, ISSUE_NUMBER, or GITHUB_REPOSITORY');
    process.exit(1);
  }

  // 判断类型
  const isMemo = issueTitle.includes(TAG_MEMO);
  const isTable = issueTitle.includes(TAG_TABLE);

  if (!isMemo && !isTable) {
    console.log('[semantic-landing] Issue title does not contain [TCS-MEMO] or [TCS-TABLE], skipping');
    return;
  }

  console.log(`[semantic-landing] Processing Issue #${issueNumber}: ${issueTitle}`);
  console.log(`[semantic-landing] Type: ${isMemo ? 'MEMO (Google Docs)' : 'TABLE (Google Sheets)'}`);

  // 初始化 Google API（OAuth2 代理人模式）
  const auth = buildAuth();
  const drive = google.drive({ version: 'v3', auth });
  console.log('[semantic-landing] ✅ OAuth2 credentials configured');

  // 确保子文件夹存在
  const landingFolderId = await getOrCreateFolder(drive, rootFolderId, LANDING_SUBFOLDER);

  let result;
  if (isMemo) {
    result = await handleMemo(auth, drive, landingFolderId, issueTitle, issueBody, issueNumber);
  } else {
    result = await handleTable(auth, drive, landingFolderId, issueTitle, issueBody, issueNumber);
  }

  console.log(`[semantic-landing] ${result.action}: ${result.type} → ${result.id}`);

  // 回复 Issue
  const now = new Date().toISOString();
  const comment = [
    '## 📡 语义落盘完成 · Semantic Landing Complete',
    '',
    `> **类型 (Type)**: ${result.type}`,
    `> **动作 (Action)**: ${result.action}`,
    `> **文档 ID (Doc ID)**: \`${result.id}\``,
    `> **直连 (Direct Link)**: [打开文档](${result.url})`,
    `> **目标文件夹**: \`tcs-semantic-landing/\``,
    `> **完成时间**: ${now}`,
    '',
    '✅ 格点已对齐，主控人格可通过 Doc ID 进行读取核验。',
    '',
    '> *—— 铸渊（ICE-GL-ZY001）· 代码守护人格体*'
  ].join('\n');

  await postIssueComment(githubToken, repo, issueNumber, comment);
  console.log(`[semantic-landing] Feedback posted to Issue #${issueNumber}`);
}

main().catch(err => {
  console.error('[semantic-landing] Fatal error:', err.message);
  process.exit(1);
});
