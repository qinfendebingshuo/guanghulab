// scripts/notify-module-received.js
// 铸渊 · 模块收讫通知系统 v2.0
// 当合作者上传模块后，通过 Commit Comment @推送者 → GitHub 自动发邮件给推送者
//
// v2.0 改动：
//   - 改用 Commit Comment（而非 Issue）通知，邮件只发给推送者本人，不再通知仓库所有者
//   - 通知中包含模块自检结果（通过/未通过 + 详细报告）
//   - 直接使用 github.actor 作为 @提及目标，无需 collaborators.json 中填写 github_username
//
// 环境变量（由 GitHub Actions 注入）：
//   GITHUB_TOKEN   — 仓库 token（自动注入）
//   GITHUB_REPO    — 格式: owner/repo（如 qinfendebingshuo/guanghulab）
//   PUSHER_LOGIN   — github.actor，即推送者的 GitHub 用户名
//   CHANGED_FILES  — 本次 push 中改动的文件列表（换行分隔）
//   COMMIT_SHA     — 本次 commit 完整 SHA
//   COMMIT_MESSAGE — 本次 commit 消息
//   TEST_RESULT    — 自检结果：pass / fail
//   TEST_DETAILS   — 自检详细报告

const fs = require('fs');
const https = require('https');

// ========== 读取配置 ==========
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const PUSHER_LOGIN = (process.env.PUSHER_LOGIN || '').trim();
const CHANGED_FILES = (process.env.CHANGED_FILES || '').trim();
const COMMIT_SHA = (process.env.COMMIT_SHA || '').trim();
const COMMIT_SHA_SHORT = COMMIT_SHA.slice(0, 8);
const COMMIT_MSG = (process.env.COMMIT_MESSAGE || '').split('\n')[0].slice(0, 80);
const TEST_RESULT = (process.env.TEST_RESULT || 'unknown').trim();
const TEST_DETAILS = (process.env.TEST_DETAILS || '').trim();

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('❌ 缺少 GITHUB_TOKEN 或 GITHUB_REPO');
  process.exit(1);
}

if (!PUSHER_LOGIN) {
  console.log('⚠️ 未获取到推送者用户名，跳过通知');
  process.exit(0);
}

if (!COMMIT_SHA) {
  console.log('⚠️ 未获取到 Commit SHA，跳过通知');
  process.exit(0);
}

const [OWNER, REPO] = GITHUB_REPO.split('/');

// ========== 加载合作者配置 ==========
let collaborators = [];
try {
  const config = JSON.parse(fs.readFileSync('.github/brain/collaborators.json', 'utf8'));
  collaborators = config.collaborators || [];
} catch (e) {
  console.log('⚠️ 无法读取 collaborators.json，将使用 GitHub 用户名:', e.message);
}

// ========== 按推送者 GitHub 用户名查找合作者 ==========
function findCollaborator(githubLogin) {
  // 先按 github_username 精确匹配
  const byUsername = collaborators.find(c =>
    c.github_username && c.github_username.toLowerCase() === githubLogin.toLowerCase()
  );
  if (byUsername) return byUsername;
  return null;
}

// ========== 分析改动了哪些模块 ==========
function detectChangedModules(changedFilesStr) {
  if (!changedFilesStr) return [];
  const files = changedFilesStr.split('\n').map(f => f.trim()).filter(Boolean);
  const moduleDirs = new Set();

  // 已知模块目录前缀列表
  const KNOWN_MODULE_PREFIXES = [
    'm01-login', 'm03-personality', 'm05-user-center', 'm06-ticket',
    'm07-dialogue-ui', 'm10-cloud', 'm11-module', 'm12-kanban',
    'm15-cloud-drive', 'dingtalk-bot', 'backend-integration', 'status-board',
  ];

  for (const file of files) {
    for (const prefix of KNOWN_MODULE_PREFIXES) {
      if (file.startsWith(prefix + '/') || file === prefix) {
        moduleDirs.add(prefix);
      }
    }
  }
  return Array.from(moduleDirs);
}

// ========== 构建通知内容（Commit Comment 格式）==========
function buildNotificationContent(collab, changedModules, allFiles) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const devLabel = collab ? `${collab.dev_id} · ${collab.emoji} ${collab.name}` : PUSHER_LOGIN;

  const moduleListStr = changedModules.length > 0
    ? changedModules.map(m => `- \`${m}/\``).join('\n')
    : '- （未检测到标准模块目录）';

  const fileLines = allFiles.split('\n').filter(Boolean);
  const fileListStr = fileLines.slice(0, 20).map(f => `  - \`${f}\``).join('\n');
  const extraNote = fileLines.length > 20 ? `\n  - ...（共 ${fileLines.length} 个文件）` : '';

  const isPass = TEST_RESULT === 'pass';
  const isUnknown = TEST_RESULT === 'unknown';
  const statusEmoji = isPass ? '✅' : (isUnknown ? 'ℹ️' : '❌');
  const statusText = isPass ? '自检通过' : (isUnknown ? '自检未执行' : '自检未通过');

  let body = `## 📦 光湖自动化系统 · 模块收讫回执\n\n`;
  body += `@${PUSHER_LOGIN} 你好！\n\n`;

  if (isPass || isUnknown) {
    body += `🎉 **你上传的模块已收到，自检通过！**\n\n`;
  } else {
    body += `⚠️ **你上传的模块已收到，但自检发现以下问题，请修改后重新上传：**\n\n`;
  }

  body += `---\n\n`;
  body += `### 📋 收讫详情\n\n`;
  body += `| 字段 | 内容 |\n`;
  body += `|------|------|\n`;
  body += `| **合作者** | ${devLabel} |\n`;
  body += `| **GitHub 账号** | @${PUSHER_LOGIN} |\n`;
  body += `| **收到时间** | ${now} |\n`;
  body += `| **Commit** | \`${COMMIT_SHA_SHORT}\` |\n`;
  body += `| **提交说明** | ${COMMIT_MSG || '（无）'} |\n`;
  body += `| **自检结果** | ${statusEmoji} ${statusText} |\n\n`;

  body += `### 📦 涉及模块\n\n${moduleListStr}\n\n`;
  body += `### 📄 上传文件清单\n\n${fileListStr}${extraNote}\n\n`;

  // 自检报告
  body += `### ${statusEmoji} 自检报告\n\n`;
  if (TEST_DETAILS) {
    body += `\`\`\`\n${TEST_DETAILS}\n\`\`\`\n\n`;
  } else {
    body += isPass ? '所有检查项目通过。\n\n' : '（未获取到详细检查报告）\n\n';
  }

  if (!isPass && !isUnknown) {
    body += `### 📌 修改指南\n\n`;
    body += `1. 请根据以上自检报告修改相关文件\n`;
    body += `2. 修改完成后重新推送到仓库\n`;
    body += `3. 铸渊将自动重新检查并发送新的回执\n\n`;
  } else {
    body += `### 📌 下一步\n\n`;
    body += `1. 模块结构检查已通过，无需额外操作\n`;
    body += `2. 铸渊将自动更新 [部署模块总文档](https://github.com/${GITHUB_REPO}/blob/main/docs/HoloLake-Era-OS-Modules.md)\n`;
    body += `3. 如需修改，请继续推送即可\n\n`;
  }

  body += `---\n`;
  body += `*—— 光湖自动化系统 · 铸渊（ZhùYuān）· ${now}*`;

  return body;
}

// ========== 调用 GitHub API 创建 Commit Comment ==========
// Commit Comment 只通知 commit 作者 + @提及的用户，不通知仓库所有者
function createCommitComment(body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ body });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/commits/${COMMIT_SHA}/comments`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'ZhuyuanBot/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(data));
        } else {
          reject(new Error(`GitHub API 返回 ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ========== 主流程 ==========
async function main() {
  console.log(`👤 推送者：${PUSHER_LOGIN}`);
  console.log(`📁 改动文件：${CHANGED_FILES ? CHANGED_FILES.split('\n').length : 0} 个`);
  console.log(`🔍 自检结果：${TEST_RESULT}`);

  const collab = findCollaborator(PUSHER_LOGIN);
  if (collab) {
    console.log(`✅ 识别合作者：${collab.dev_id} · ${collab.name}`);
  } else {
    console.log(`ℹ️ 未在 collaborators.json 中找到 "${PUSHER_LOGIN}" 的映射，将使用 GitHub 用户名通知`);
  }

  const changedModules = detectChangedModules(CHANGED_FILES);
  console.log(`📦 涉及模块：${changedModules.join(', ') || '（未检测到标准模块目录）'}`);

  // 如果改动文件全部在 docs/ 或 scripts/ 或 .github/，说明是系统自动提交，跳过通知
  const allFiles = CHANGED_FILES.split('\n').filter(Boolean);
  const isSystemCommit = allFiles.length > 0 && allFiles.every(f =>
    f.startsWith('docs/') || f.startsWith('scripts/') || f.startsWith('.github/')
  );
  if (isSystemCommit) {
    console.log('🤖 检测到系统自动提交（非模块上传），跳过通知');
    process.exit(0);
  }

  if (changedModules.length === 0) {
    console.log('⚠️ 未检测到标准模块目录的改动，跳过通知');
    process.exit(0);
  }

  // 构建并发送通知（通过 Commit Comment，直接通知推送者本人）
  const body = buildNotificationContent(collab, changedModules, CHANGED_FILES);
  console.log(`📝 创建 Commit Comment 通知（通知目标：@${PUSHER_LOGIN}）...`);

  const comment = await createCommitComment(body);
  console.log(`✅ Commit Comment 已创建：${comment.html_url}`);
  console.log(`📧 GitHub 将自动发送邮件通知给 @${PUSHER_LOGIN}（推送者本人）`);
  console.log(`📧 仓库所有者将不会收到此通知`);
}

main().catch(err => {
  console.error('❌ 通知失败：', err.message);
  process.exit(1);
});
