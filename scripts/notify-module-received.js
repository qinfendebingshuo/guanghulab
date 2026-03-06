// scripts/notify-module-received.js
// 铸渊 · 模块收讫通知系统
// 当合作者上传模块后，自动创建 GitHub Issue @提及 → GitHub 自动发邮件给对方
//
// 环境变量（由 GitHub Actions 注入）：
//   GITHUB_TOKEN   — 仓库 token（自动注入）
//   GITHUB_REPO    — 格式: owner/repo（如 qinfendebingshuo/guanghulab）
//   PUSHER_LOGIN   — github.actor，即推送者的 GitHub 用户名
//   CHANGED_FILES  — 本次 push 中改动的文件列表（换行分隔）
//   COMMIT_SHA     — 本次 commit SHA（前8位）
//   COMMIT_MESSAGE — 本次 commit 消息

const fs = require('fs');
const https = require('https');

// ========== 读取配置 ==========
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || '';
const PUSHER_LOGIN = (process.env.PUSHER_LOGIN || '').trim();
const CHANGED_FILES = (process.env.CHANGED_FILES || '').trim();
const COMMIT_SHA = (process.env.COMMIT_SHA || '').slice(0, 8);
const COMMIT_MSG = (process.env.COMMIT_MESSAGE || '').split('\n')[0].slice(0, 80);

if (!GITHUB_TOKEN || !GITHUB_REPO) {
  console.error('❌ 缺少 GITHUB_TOKEN 或 GITHUB_REPO');
  process.exit(1);
}

if (!PUSHER_LOGIN) {
  console.log('⚠️ 未获取到推送者用户名，跳过通知');
  process.exit(0);
}

const [OWNER, REPO] = GITHUB_REPO.split('/');

// ========== 加载合作者配置 ==========
let collaborators = [];
try {
  const config = JSON.parse(fs.readFileSync('.github/brain/collaborators.json', 'utf8'));
  collaborators = config.collaborators || [];
} catch (e) {
  console.error('❌ 无法读取 collaborators.json:', e.message);
  process.exit(1);
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

// ========== 构建通知 Issue 内容 ==========
function buildIssueContent(collab, changedModules, allFiles) {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const mention = collab && collab.github_username ? `@${collab.github_username}` : `@${PUSHER_LOGIN}`;
  const devLabel = collab ? `${collab.dev_id} · ${collab.emoji} ${collab.name}` : PUSHER_LOGIN;

  const moduleListStr = changedModules.length > 0
    ? changedModules.map(m => `- \`${m}/\``).join('\n')
    : '- （系统自动检测，请核对）';

  const fileLines = allFiles.split('\n').filter(Boolean);
  const fileListStr = fileLines.slice(0, 20).map(f => `  - \`${f}\``).join('\n');
  const extraNote = fileLines.length > 20 ? `\n  - ...（共 ${fileLines.length} 个文件）` : '';

  const title = `📦 铸渊收讫 · [${collab ? collab.dev_id : 'DEV-???'}] ${collab ? collab.name : PUSHER_LOGIN} 模块已收到`;

  const body = `## 铸渊收讫通知

${mention} 你好！🎉

铸渊（自动化系统）已确认收到你上传的模块。

---

### 📋 收讫详情

| 字段 | 内容 |
|------|------|
| **合作者** | ${devLabel} |
| **GitHub 账号** | @${PUSHER_LOGIN} |
| **收到时间** | ${now} |
| **Commit** | \`${COMMIT_SHA}\` |
| **提交说明** | ${COMMIT_MSG || '（无）'} |

### 📦 涉及模块

${moduleListStr}

### 📄 上传文件清单

${fileListStr}${extraNote}

---

### 📌 下一步

1. **铸渊将自动更新** [HoloLake Era 操作系统部署模块](https://github.com/${GITHUB_REPO}/blob/main/docs/HoloLake-Era-OS-Modules.md) 总文档
2. **模块结构检查** 已自动运行，请确认 CI 状态绿灯
3. 如需补充 \`SYSLOG.md\`、\`package.json\` 或 \`src/\` 目录，请继续推送

> 💡 如有问题，请直接在本 Issue 回复，铸渊会收到通知。

---
*—— 铸渊（ZhùYuān）· 光湖自动化系统 · 自动通知 #${now}*`;

  return { title, body };
}

// ========== 调用 GitHub API 创建 Issue ==========
function createIssue(title, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ title, body, labels: ['模块收讫'] });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/issues`,
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
          const issue = JSON.parse(data);
          resolve(issue);
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

// ========== 确保标签存在（不存在则自动创建）==========
function ensureLabel() {
  return new Promise((resolve) => {
    const labelPayload = JSON.stringify({
      name: '模块收讫',
      color: '0075ca',
      description: '铸渊自动通知：合作者模块收讫确认',
    });
    const options = {
      hostname: 'api.github.com',
      path: `/repos/${OWNER}/${REPO}/labels`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(labelPayload),
        'User-Agent': 'ZhuyuanBot/1.0',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        // 201 = created, 422 = already exists，都算OK
        resolve();
      });
    });
    req.on('error', () => resolve()); // 标签创建失败不阻断主流程
    req.write(labelPayload);
    req.end();
  });
}

// ========== 主流程 ==========
async function main() {
  console.log(`👤 推送者：${PUSHER_LOGIN}`);
  console.log(`📁 改动文件：${CHANGED_FILES ? CHANGED_FILES.split('\n').length : 0} 个`);

  const collab = findCollaborator(PUSHER_LOGIN);
  if (collab) {
    console.log(`✅ 识别合作者：${collab.dev_id} · ${collab.name}`);
    if (!collab.github_username) {
      console.log(`⚠️ ${collab.dev_id}（${collab.name}）的 github_username 尚未填写`);
      console.log(`   请在 .github/brain/collaborators.json 中补充，以便 @提及 生效`);
      console.log(`   通知将仍然创建，但不会有 @提及 邮件通知`);
    }
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

  // 确保标签存在
  await ensureLabel();

  // 构建并发送通知
  const { title, body } = buildIssueContent(collab, changedModules, CHANGED_FILES);
  console.log(`📝 创建通知 Issue：${title}`);

  const issue = await createIssue(title, body);
  console.log(`✅ Issue 已创建：#${issue.number} → ${issue.html_url}`);
  console.log(`📧 GitHub 将自动发送邮件通知给 @${collab?.github_username || PUSHER_LOGIN}`);
}

main().catch(err => {
  console.error('❌ 通知失败：', err.message);
  process.exit(1);
});
