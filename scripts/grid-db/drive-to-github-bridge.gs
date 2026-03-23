/**
 * drive-to-github-bridge.gs
 *
 * Google Apps Script — 光湖格点库桥接器
 *
 * 功能：监听 Drive「光湖格点库/inbox/」文件夹
 *       发现 Gemini 新建的文档 → 读取内容 → 通过 GitHub API 写入仓库
 *
 * 触发方式：时间驱动触发器，每 1 分钟执行一次
 *
 * 流程：
 *   ① 扫描 inbox 文件夹中所有文件
 *   ② 读取文件内容（Google Docs → 提取纯文本/JSON）
 *   ③ 构造标准 inbox 消息格式
 *   ④ 调用 GitHub Contents API 写入 grid-db/inbox/[filename].json
 *   ⑤ 写入成功 → 将 Drive 文件移到「已处理」文件夹（不删除，留审计轨迹）
 *   ⑥ 写入失败 → 标记文件，下次重试
 *
 * 安全：
 *   - GitHub Token 存在 Script Properties 中（不硬编码）
 *   - 只处理 inbox 文件夹内的文件，不碰 mirror
 *   - 每次处理后写日志到 Drive「光湖格点库/logs/」
 *
 * 部署步骤：
 *   1. 打开 https://script.google.com → 新建项目
 *   2. 项目名：光湖格点库桥接器
 *   3. 粘贴此文件代码
 *   4. 项目设置 → 脚本属性 → 添加 GITHUB_TOKEN（需要 repo 权限）
 *   5. 触发器 → 添加 → 函数 processInbox → 时间驱动 → 每 1 分钟
 *   6. 首次运行：点运行 → 授权 Drive 访问权限
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

var CONFIG = {
  INBOX_FOLDER_NAME: '光湖格点库/inbox',
  PROCESSED_FOLDER_NAME: '光湖格点库/inbox/已处理',
  LOG_FOLDER_NAME: '光湖格点库/logs',
  GITHUB_REPO: 'qinfendebingshuo/guanghulab',
  GITHUB_BRANCH: 'main',
  GRID_DB_INBOX_PATH: 'grid-db/inbox/'
};

/**
 * 主入口：处理 Drive inbox 中的新文件
 * 设置为时间驱动触发器，每 1 分钟执行
 */
function processInbox() {
  var token = PropertiesService.getScriptProperties()
    .getProperty('GITHUB_TOKEN');
  if (!token) {
    Logger.log('ERROR: GITHUB_TOKEN not set in Script Properties');
    return;
  }

  var inboxFolder = getOrCreateFolder(CONFIG.INBOX_FOLDER_NAME);
  var processedFolder = getOrCreateFolder(CONFIG.PROCESSED_FOLDER_NAME);
  var logFolder = getOrCreateFolder(CONFIG.LOG_FOLDER_NAME);

  var files = inboxFolder.getFiles();
  var processedCount = 0;
  var errorCount = 0;

  while (files.hasNext()) {
    var file = files.next();
    try {
      var content = extractContent(file);
      if (!content) continue;

      // 生成带时间戳的文件名
      var timestamp = Utilities.formatDate(
        new Date(), 'Asia/Shanghai', 'yyyyMMdd-HHmmss'
      );
      var safeName = file.getName().replace(/[^a-zA-Z0-9\-_]/g, '');
      var filename = timestamp + '-' + safeName + '.json';

      // 写入 GitHub 仓库
      var success = writeToGitHub(
        token,
        CONFIG.GRID_DB_INBOX_PATH + filename,
        content
      );

      if (success) {
        file.moveTo(processedFolder);
        processedCount++;
        Logger.log('OK: ' + filename);
      } else {
        errorCount++;
        Logger.log('FAIL: ' + filename);
      }
    } catch (e) {
      errorCount++;
      Logger.log('ERROR: ' + file.getName() + ': ' + e.message);
    }
  }

  // 写处理日志
  if (processedCount > 0 || errorCount > 0) {
    var logTimestamp = Utilities.formatDate(
      new Date(), 'Asia/Shanghai', 'yyyy-MM-dd HH:mm:ss'
    );
    var logLine = logTimestamp + ' | processed: ' + processedCount
      + ' | errors: ' + errorCount + '\n';
    var logFileName = Utilities.formatDate(
      new Date(), 'Asia/Shanghai', 'yyyyMMdd'
    ) + '-bridge.log';

    appendToLogFile(logFolder, logFileName, logLine);
  }
}

/**
 * 从 Drive 文件中提取内容
 * 支持 Google Docs 和纯文本/JSON 文件
 */
function extractContent(file) {
  var mimeType = file.getMimeType();

  if (mimeType === MimeType.GOOGLE_DOCS) {
    // Google Docs → 提取纯文本
    var doc = DocumentApp.openById(file.getId());
    var text = doc.getBody().getText().trim();

    // 尝试解析为 JSON（Gemini 可能直接写 JSON 格式）
    try {
      JSON.parse(text);
      return text;
    } catch (e) {
      // 非 JSON → 包装为标准 inbox 消息格式
      return JSON.stringify({
        schema_version: '1.0',
        message_id: Utilities.getUuid(),
        timestamp: new Date().toISOString(),
        source: 'gemini-via-drive',
        type: 'raw-message',
        priority: 'info',
        payload: {
          text: text
        }
      }, null, 2);
    }
  } else if (mimeType === MimeType.PLAIN_TEXT
    || file.getName().endsWith('.json')) {
    // 纯文本或 JSON 文件 → 直接读取
    return file.getBlob().getDataAsString();
  }

  Logger.log('SKIP: unsupported mime type ' + mimeType
    + ' for file ' + file.getName());
  return null;
}

/**
 * 通过 GitHub Contents API 写入文件到仓库
 * @returns {boolean} 是否写入成功
 */
function writeToGitHub(token, filePath, content) {
  var url = 'https://api.github.com/repos/'
    + CONFIG.GITHUB_REPO + '/contents/' + filePath;

  var payload = {
    message: 'auto: Gemini inbox via Drive bridge [skip ci]',
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: CONFIG.GITHUB_BRANCH
  };

  var options = {
    method: 'PUT',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200 && code !== 201) {
    Logger.log('GitHub API error: ' + code + ' ' + response.getContentText());
  }

  return (code === 200 || code === 201);
}

/**
 * 按路径逐级获取或创建 Drive 文件夹
 */
function getOrCreateFolder(folderPath) {
  var parts = folderPath.split('/');
  var folder = DriveApp.getRootFolder();

  for (var i = 0; i < parts.length; i++) {
    var folders = folder.getFoldersByName(parts[i]);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = folder.createFolder(parts[i]);
    }
  }
  return folder;
}

/**
 * 向日志文件追加内容（不存在则创建）
 */
function appendToLogFile(folder, fileName, content) {
  var files = folder.getFilesByName(fileName);
  if (files.hasNext()) {
    var file = files.next();
    var existing = file.getBlob().getDataAsString();
    file.setContent(existing + content);
  } else {
    folder.createFile(fileName, content, MimeType.PLAIN_TEXT);
  }
}

// ═══════════════════════════════════════════════════════════
// 触发器设置说明：
//   Apps Script 编辑器 → 触发器 → 添加
//   函数：processInbox
//   事件源：时间驱动
//   间隔：每 1 分钟
// ═══════════════════════════════════════════════════════════
