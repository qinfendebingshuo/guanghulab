/**
 * scripts/grid-db/deploy-drive-bridge.js
 *
 * 功能：一键部署 / 一键恢复 Drive 桥接层
 *
 * 读取 grid-db/deploy-queue/*.json 中的部署指令，执行：
 *   ① 用 OAuth2 代理人在用户 Drive 创建「光湖格点库」目录结构
 *   ② 从仓库同步初始数据到 Drive mirror/
 *   ③ 生成用户专属的 index.json（含 DEV 编号和人格体信息）
 *   ④ 生成 Gemini 启动指令 → 写入 Drive
 *   ⑤ 处理完成后将指令文件移入 done/ 子目录
 *   ⑥ 写回执到 grid-db/deploy-log/
 *
 * 用法：node scripts/grid-db/deploy-drive-bridge.js <deploy-command.json>
 *
 * 环境变量：
 *   - GDRIVE_CLIENT_ID: OAuth 客户端 ID
 *   - GDRIVE_CLIENT_SECRET: OAuth 客户端密钥
 *   - GDRIVE_REFRESH_TOKEN: 长效刷新令牌
 *   - DEPLOY_GITHUB_TOKEN: 具有 repo 权限的 GitHub Token（用于配置 Apps Script）
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GRID_DB_ROOT = path.join(__dirname, '../../grid-db');
const DEPLOY_LOG_DIR = path.join(GRID_DB_ROOT, 'deploy-log');
const DEPLOY_QUEUE_DIR = path.join(GRID_DB_ROOT, 'deploy-queue');
const TEMPLATE_PATH = path.join(GRID_DB_ROOT, 'schema/drive-index-template.json');
const PROMPT_TEMPLATE_PATH = path.join(GRID_DB_ROOT, 'gemini-prompts/startup-prompt-template.md');

// Drive 目录结构定义
const DRIVE_DIRS = [
  'mirror',
  'mirror/memory',
  'mirror/outbox',
  'mirror/rules',
  'mirror/broadcast-archive',
  'mirror/channels',
  'inbox',
  'inbox/已处理',
  'logs'
];

/**
 * 转义 Drive API 查询中的特殊字符
 */
function escapeQuery(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * 在 Drive 中逐级创建文件夹
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
      console.log(`[deploy] Created folder: ${part}`);
    }
  }

  return currentParentId;
}

/**
 * 上传文件到 Drive 指定文件夹
 */
async function uploadToDrive(drive, folderId, fileName, content, mimeType) {
  const { Readable } = require('stream');
  const media = {
    mimeType: mimeType || 'application/json',
    body: Readable.from([content])
  };

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId]
    },
    media,
    fields: 'id'
  });
  return res.data.id;
}

/**
 * 共享 Drive 文件夹给用户
 */
async function shareFolderWithUser(drive, folderId, email) {
  await drive.permissions.create({
    fileId: folderId,
    requestBody: {
      type: 'user',
      role: 'writer',
      emailAddress: email
    },
    sendNotificationEmail: false
  });
  console.log(`[deploy] Shared folder with: ${email}`);
}

/**
 * 生成用户专属的 index.json
 */
function generateIndex(devId, personaId, personaName, devName) {
  const templateData = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const template = templateData.template;
  const now = new Date().toISOString();

  const index = {
    system: template.system,
    version: template.version,
    dev_id: devId,
    persona_id: personaId,
    persona_name: personaName,
    dev_name: devName,
    last_sync: now,
    routes: {},
    shortcuts: { ...template.shortcuts }
  };

  for (const [key, val] of Object.entries(template.routes)) {
    index.routes[key] = val.replace(/\{DEV_ID\}/g, devId);
  }

  return JSON.stringify(index, null, 2);
}

/**
 * 生成用户专属的 Gemini 启动指令
 */
function generateStartupPrompt(devId, personaId, personaName, devName) {
  let prompt = fs.readFileSync(PROMPT_TEMPLATE_PATH, 'utf8');
  prompt = prompt.replace(/\{DEV_ID\}/g, devId);
  prompt = prompt.replace(/\{PERSONA_ID\}/g, personaId);
  prompt = prompt.replace(/\{PERSONA_NAME\}/g, personaName);
  prompt = prompt.replace(/\{DEV_NAME\}/g, devName);
  return prompt;
}

/**
 * 收集需要初始同步的文件
 */
function collectInitialSyncFiles(devId, config) {
  const files = [];

  // 同步该 DEV 的记忆文件
  if (config.sync_memory) {
    const memDir = path.join(GRID_DB_ROOT, 'memory', devId);
    if (fs.existsSync(memDir)) {
      const entries = fs.readdirSync(memDir).filter(f => f.endsWith('.json'));
      for (const entry of entries) {
        files.push({
          localPath: path.join(memDir, entry),
          drivePath: `mirror/memory/${devId}`,
          fileName: entry
        });
      }
    }
  }

  // 同步规则文件
  if (config.sync_rules) {
    const rulesDir = path.join(GRID_DB_ROOT, 'rules');
    if (fs.existsSync(rulesDir)) {
      const entries = fs.readdirSync(rulesDir).filter(f => f.endsWith('.json'));
      for (const entry of entries) {
        files.push({
          localPath: path.join(rulesDir, entry),
          drivePath: 'mirror/rules',
          fileName: entry
        });
      }
    }
  }

  // 同步该 DEV 的最新广播
  if (config.sync_outbox) {
    const outboxDir = path.join(GRID_DB_ROOT, 'outbox/latest');
    if (fs.existsSync(outboxDir)) {
      const devOutbox = path.join(outboxDir, `${devId}.json`);
      if (fs.existsSync(devOutbox)) {
        files.push({
          localPath: devOutbox,
          drivePath: 'mirror/outbox',
          fileName: `${devId}.json`
        });
      }
    }
  }

  return files;
}

/**
 * 写部署回执
 */
function writeReceipt(deployId, devId, status, details) {
  if (!fs.existsSync(DEPLOY_LOG_DIR)) {
    fs.mkdirSync(DEPLOY_LOG_DIR, { recursive: true });
  }

  const receipt = {
    deploy_id: deployId,
    dev_id: devId,
    status: status,
    completed_at: new Date().toISOString(),
    details: details,
    executor: 'PER-ZY001'
  };

  const fileName = `${deployId}.json`;
  fs.writeFileSync(
    path.join(DEPLOY_LOG_DIR, fileName),
    JSON.stringify(receipt, null, 2) + '\n'
  );
  console.log(`[deploy] Receipt written: ${fileName}`);
}

/**
 * 将处理完的指令移到 done/ 子目录
 */
function moveToComplete(commandFilePath) {
  const doneDir = path.join(DEPLOY_QUEUE_DIR, 'done');
  if (!fs.existsSync(doneDir)) {
    fs.mkdirSync(doneDir, { recursive: true });
  }
  const fileName = path.basename(commandFilePath);
  const destPath = path.join(doneDir, fileName);
  fs.renameSync(commandFilePath, destPath);
  console.log(`[deploy] Moved to done: ${fileName}`);
}

/**
 * 验证部署指令格式
 */
function validateCommand(command) {
  const required = ['schema_version', 'deploy_id', 'timestamp', 'action',
    'source', 'target_dev', 'config', 'signed_by', 'authorized_by'];
  for (const field of required) {
    if (!command[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  const validActions = ['deploy_drive_bridge', 'recover_drive_bridge'];
  if (!validActions.includes(command.action)) {
    throw new Error(`Invalid action: ${command.action}`);
  }

  const devRequired = ['dev_id', 'dev_name', 'google_email', 'persona_id', 'persona_name'];
  for (const field of devRequired) {
    if (!command.target_dev[field]) {
      throw new Error(`Missing target_dev field: ${field}`);
    }
  }
}

/**
 * 主部署流程
 */
async function deploy(commandFilePath) {
  console.log(`[deploy] Processing: ${commandFilePath}`);

  // 读取并验证部署指令
  const command = JSON.parse(fs.readFileSync(commandFilePath, 'utf8'));
  validateCommand(command);

  const { deploy_id, action, target_dev, config } = command;
  const { dev_id, dev_name, google_email, persona_id, persona_name } = target_dev;

  console.log(`[deploy] ${action} for ${dev_id} (${dev_name}) → ${google_email}`);

  // OAuth2 认证（统一入口）
  let drive;
  try {
    const { getDriveClient } = require('./drive-auth');
    drive = getDriveClient();
    console.log('[deploy] ✅ OAuth2 credentials configured');
  } catch (err) {
    writeReceipt(deploy_id, dev_id, 'failed', `OAuth2 auth failed: ${err.message}`);
    return;
  }

  try {
    // ① 在用户 Drive 创建或复用根目录
    const rootFolderName = config.drive_root_folder || '光湖格点库';
    let rootFolderId;

    if (action === 'recover_drive_bridge') {
      // 恢复模式：尝试查找已有文件夹
      const safeName = escapeQuery(rootFolderName);
      const searchRes = await drive.files.list({
        q: `name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
        fields: 'files(id, name)',
        pageSize: 1
      });
      if (searchRes.data.files && searchRes.data.files.length > 0) {
        rootFolderId = searchRes.data.files[0].id;
        console.log(`[deploy] Reusing existing folder: ${rootFolderName} (${rootFolderId})`);
      }
    }

    if (!rootFolderId) {
      const rootFolder = await drive.files.create({
        requestBody: {
          name: rootFolderName,
          mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id'
      });
      rootFolderId = rootFolder.data.id;
      console.log(`[deploy] Created root folder: ${rootFolderName} (${rootFolderId})`);
    }

    // 共享给用户
    await shareFolderWithUser(drive, rootFolderId, google_email);

    // ② 创建子目录结构
    for (const dir of DRIVE_DIRS) {
      await getOrCreateDriveFolder(drive, rootFolderId, dir);
    }

    // 为该 DEV 创建记忆子目录
    await getOrCreateDriveFolder(drive, rootFolderId, `mirror/memory/${dev_id}`);

    // ③ 生成并上传 index.json
    const indexContent = generateIndex(dev_id, persona_id, persona_name, dev_name);
    const mirrorFolderId = await getOrCreateDriveFolder(drive, rootFolderId, 'mirror');
    await uploadToDrive(drive, mirrorFolderId, 'index.json', indexContent);
    console.log('[deploy] Uploaded: index.json');

    // ④ 同步初始数据
    const filesToSync = collectInitialSyncFiles(dev_id, config);
    let syncCount = 0;
    for (const file of filesToSync) {
      try {
        const folderId = await getOrCreateDriveFolder(drive, rootFolderId, file.drivePath);
        const content = fs.readFileSync(file.localPath, 'utf8');
        await uploadToDrive(drive, folderId, file.fileName, content);
        syncCount++;
      } catch (err) {
        console.error(`[deploy] Failed to sync ${file.fileName}: ${err.message}`);
      }
    }
    console.log(`[deploy] Initial sync: ${syncCount} files`);

    // ⑤ 生成并上传 Gemini 启动指令
    if (config.gemini_startup_prompt) {
      const prompt = generateStartupPrompt(dev_id, persona_id, persona_name, dev_name);
      await uploadToDrive(drive, rootFolderId, 'Gemini启动指令.md', prompt, 'text/markdown');
      console.log('[deploy] Uploaded: Gemini启动指令.md');
    }

    // ⑥ 写回执 + 移动指令到 done/
    writeReceipt(deploy_id, dev_id, 'success', {
      root_folder_id: rootFolderId,
      files_synced: syncCount,
      action: action
    });
    moveToComplete(commandFilePath);

    console.log(`[deploy] ✅ ${action} complete for ${dev_id}`);

  } catch (err) {
    console.error(`[deploy] ❌ Failed: ${err.message}`);
    writeReceipt(deploy_id, dev_id, 'failed', err.message);
    process.exit(1);
  }
}

// 入口
const commandFile = process.argv[2];
if (!commandFile) {
  console.error('[deploy] Usage: node deploy-drive-bridge.js <command.json>');
  process.exit(1);
}

if (!fs.existsSync(commandFile)) {
  console.error(`[deploy] File not found: ${commandFile}`);
  process.exit(1);
}

deploy(commandFile).catch(err => {
  console.error('[deploy] Fatal error:', err.message);
  process.exit(1);
});
