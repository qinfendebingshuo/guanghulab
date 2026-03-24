/**
 * scripts/grid-db/sync-to-drive.js
 *
 * 功能：将 grid-db/ 中的关键文件同步到 Google Drive 镜像目录
 *
 * 同步范围：
 *   grid-db/memory/DEV-XXX/*.json  →  Drive/mirror/memory/DEV-XXX/
 *   grid-db/outbox/latest/*.json    →  Drive/mirror/outbox/
 *   grid-db/rules/*.json            →  Drive/mirror/rules/
 *   grid-db/drive-index/*.json      →  Drive/mirror/（每个 DEV 的 index.json）
 *
 * 同步策略：
 *   - 比较文件内容 MD5 hash，仅同步有变更的文件（节省 API 配额）
 *   - 文件不存在则创建，已存在则覆盖更新
 *   - Drive 中多出的文件不删除（防误删）
 *
 * 注意：
 *   - 不同步 interactions/ 和 training-lake/（数据量大 + 无需 Gemini 读取）
 *   - 不同步 inbox/ 和 processing/（系统内部流转区）
 *
 * 环境变量：
 *   - GOOGLE_DRIVE_SERVICE_ACCOUNT: Service Account JSON 密钥内容
 *   - DRIVE_FOLDER_ID: Drive 镜像根文件夹 ID
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GRID_DB_ROOT = path.join(__dirname, '../../grid-db');

// 同步目录映射：本地相对路径 → Drive 镜像子目录
const SYNC_DIRS = [
  { local: 'memory',        drivePrefix: 'mirror/memory',  recursive: true },
  { local: 'outbox/latest', drivePrefix: 'mirror/outbox',  recursive: false },
  { local: 'rules',         drivePrefix: 'mirror/rules',   recursive: false },
  { local: 'drive-index',   drivePrefix: 'mirror',         recursive: false }
];

/**
 * 计算文件内容的 MD5 哈希
 */
function md5(content) {
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * 递归收集目录下的所有 JSON 文件
 */
function collectFiles(dirPath, recursive) {
  const results = [];
  if (!fs.existsSync(dirPath)) return results;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && recursive) {
      results.push(...collectFiles(fullPath, true));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * 转义 Drive API 查询中的单引号
 */
function escapeQuery(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * 在 Drive 中查找或创建文件夹（按路径逐级创建）
 */
async function getOrCreateDriveFolder(drive, parentId, folderPath) {
  const parts = folderPath.split('/').filter(Boolean);
  let currentParentId = parentId;

  for (const part of parts) {
    const safePart = escapeQuery(part);
    const query = `name='${safePart}' and '${currentParentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const res = await drive.files.list({
      q: query,
      fields: 'files(id, name)',
      pageSize: 1
    });

    if (res.data.files && res.data.files.length > 0) {
      currentParentId = res.data.files[0].id;
    } else {
      const createRes = await drive.files.create({
        requestBody: {
          name: part,
          mimeType: 'application/vnd.google-apps.folder',
          parents: [currentParentId]
        },
        fields: 'id'
      });
      currentParentId = createRes.data.id;
      console.log(`[sync-to-drive] Created folder: ${part}`);
    }
  }

  return currentParentId;
}

/**
 * 在 Drive 目标文件夹中查找同名文件
 */
async function findFileInDrive(drive, folderId, fileName) {
  const safeFileName = escapeQuery(fileName);
  const query = `name='${safeFileName}' and '${folderId}' in parents and trashed=false`;
  const res = await drive.files.list({
    q: query,
    fields: 'files(id, name, md5Checksum)',
    pageSize: 1
  });

  if (res.data.files && res.data.files.length > 0) {
    return res.data.files[0];
  }
  return null;
}

/**
 * 上传或更新单个文件到 Drive
 */
async function uploadFile(drive, folderId, fileName, content) {
  const existingFile = await findFileInDrive(drive, folderId, fileName);
  const { Readable } = require('stream');

  const media = {
    mimeType: 'application/json',
    body: Readable.from([content])
  };

  if (existingFile) {
    // 检查内容是否变更（Drive 对上传文件自动计算 MD5）
    const localHash = md5(content);
    if (existingFile.md5Checksum === localHash) {
      return { action: 'skipped', fileName };
    }

    await drive.files.update({
      fileId: existingFile.id,
      media
    });
    return { action: 'updated', fileName };
  } else {
    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [folderId]
      },
      media,
      fields: 'id'
    });
    return { action: 'created', fileName };
  }
}

/**
 * 主同步流程
 */
async function main() {
  // 验证环境变量
  const serviceAccountJson = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT;
  const rootFolderId = process.env.DRIVE_FOLDER_ID;

  if (!serviceAccountJson) {
    console.log('[sync-to-drive] GOOGLE_DRIVE_SERVICE_ACCOUNT not set, skipping');
    return;
  }
  if (!rootFolderId) {
    console.log('[sync-to-drive] DRIVE_FOLDER_ID not set, skipping');
    return;
  }

  // 解析 Service Account 凭证（天眼密钥流校验）
  let credentials;
  try {
    const { validateServiceAccountJSON, formatDiagnosticReport } = require('../skyeye/credential-validator');
    const validation = validateServiceAccountJSON(serviceAccountJson);
    if (!validation.valid) {
      console.error('[sync-to-drive] 🔴 Credential validation failed:');
      console.error(formatDiagnosticReport(validation));
      process.exit(1);
    }
    credentials = validation.credentials;
    console.log('[sync-to-drive] ✅ Service account credentials validated');
  } catch (err) {
    // Fallback: if validator module is unavailable, try direct parse
    try {
      credentials = JSON.parse(serviceAccountJson);
    } catch (parseErr) {
      console.error('[sync-to-drive] Failed to parse service account JSON:', parseErr.message);
      process.exit(1);
    }
  }

  // 认证 Google Drive API
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive']
  });

  const drive = google.drive({ version: 'v3', auth });

  // 预生成 Drive 索引文件
  try {
    const { main: generateIndex } = require('./generate-drive-index');
    generateIndex();
  } catch (err) {
    console.log('[sync-to-drive] Index generation skipped (non-fatal):', err.message);
  }

  console.log('[sync-to-drive] Starting Grid-DB → Drive mirror sync');

  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  // 遍历每个同步目录
  for (const syncDir of SYNC_DIRS) {
    const localDir = path.join(GRID_DB_ROOT, syncDir.local);
    const files = collectFiles(localDir, syncDir.recursive);

    if (files.length === 0) {
      console.log(`[sync-to-drive] ${syncDir.local}: no files to sync`);
      continue;
    }

    console.log(`[sync-to-drive] ${syncDir.local}: found ${files.length} file(s)`);

    for (const filePath of files) {
      try {
        // 计算 Drive 中的目标路径
        const relativePath = path.relative(localDir, filePath);
        const dirParts = path.dirname(relativePath);
        const fileName = path.basename(filePath);

        // 构建 Drive 文件夹路径
        let driveFolderPath = syncDir.drivePrefix;
        if (dirParts !== '.') {
          driveFolderPath = `${syncDir.drivePrefix}/${dirParts}`;
        }

        // 确保 Drive 文件夹存在
        const targetFolderId = await getOrCreateDriveFolder(
          drive, rootFolderId, driveFolderPath
        );

        // 读取文件内容并上传
        const content = fs.readFileSync(filePath, 'utf8');
        const result = await uploadFile(drive, targetFolderId, fileName, content);

        if (result.action === 'created') {
          totalCreated++;
          console.log(`[sync-to-drive]   + ${relativePath} (created)`);
        } else if (result.action === 'updated') {
          totalUpdated++;
          console.log(`[sync-to-drive]   ~ ${relativePath} (updated)`);
        } else {
          totalSkipped++;
        }
      } catch (err) {
        totalErrors++;
        console.error(`[sync-to-drive]   ! ${filePath}: ${err.message}`);
      }
    }
  }

  // 输出统计
  console.log('[sync-to-drive] Sync complete:');
  console.log(`  Created: ${totalCreated}`);
  console.log(`  Updated: ${totalUpdated}`);
  console.log(`  Skipped (unchanged): ${totalSkipped}`);
  console.log(`  Errors: ${totalErrors}`);

  if (totalErrors > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[sync-to-drive] Fatal error:', err.message);
  process.exit(1);
});
