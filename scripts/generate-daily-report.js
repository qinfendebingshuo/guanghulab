/**
 * generate-daily-report.js
 * 生成「光湖开发日报」内容，并通过 GitHub GraphQL API 发布到 Discussions
 *
 * 使用方式：
 *   GITHUB_TOKEN=xxx GITHUB_REPOSITORY=owner/repo node scripts/generate-daily-report.js
 *
 * 环境变量：
 *   GITHUB_TOKEN        - GitHub token (需要 discussions:write 权限)
 *   GITHUB_REPOSITORY   - 仓库名 (owner/repo)
 *   DISCUSSION_CATEGORY - Discussions 分类名 (默认: Announcements)
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY || '';
const DISCUSSION_CATEGORY = process.env.DISCUSSION_CATEGORY || 'Announcements';

const DEV_STATUS_PATH = path.join('.github', 'persona-brain', 'dev-status.json');

// ── GitHub GraphQL API 请求 ──
function graphqlRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });
    const options = {
      hostname: 'api.github.com',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'guanghulab-daily-report',
        'Content-Length': Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(result));
        } catch {
          reject(new Error(`GraphQL 解析失败: ${result.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── 获取 Discussion 分类 ID ──
async function getCategoryId(owner, repo, categoryName) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        discussionCategories(first: 20) {
          nodes {
            id
            name
          }
        }
      }
    }
  `;
  const result = await graphqlRequest(query, { owner, repo });
  const categories = result?.data?.repository?.discussionCategories?.nodes || [];
  const category = categories.find(c => c.name === categoryName);
  return category?.id || null;
}

// ── 获取仓库 ID ──
async function getRepositoryId(owner, repo) {
  const query = `
    query($owner: String!, $repo: String!) {
      repository(owner: $owner, name: $repo) {
        id
      }
    }
  `;
  const result = await graphqlRequest(query, { owner, repo });
  return result?.data?.repository?.id || null;
}

// ── 创建 Discussion ──
async function createDiscussion(repoId, categoryId, title, body) {
  const mutation = `
    mutation($repoId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: {
        repositoryId: $repoId,
        categoryId: $categoryId,
        title: $title,
        body: $body
      }) {
        discussion {
          id
          url
        }
      }
    }
  `;
  return graphqlRequest(mutation, { repoId, categoryId, title, body });
}

// ── 获取最近 24h 的 Git 活动 ──
function getRecentActivity() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let commits = [];
  let prActivity = '';

  try {
    const log = execSync(
      `git log --since="${since}" --oneline --no-merges 2>/dev/null || true`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    if (log) {
      commits = log.split('\n').filter(Boolean).slice(0, 10);
    }
  } catch {
    // Git log may fail in shallow clone
  }

  try {
    const merges = execSync(
      `git log --since="${since}" --oneline --merges 2>/dev/null || true`,
      { encoding: 'utf8', timeout: 10000 }
    ).trim();
    if (merges) {
      prActivity = merges.split('\n').filter(Boolean).slice(0, 5).join('\n');
    }
  } catch {
    // Ignore errors
  }

  return { commits, prActivity };
}

// ── 生成日报 Markdown ──
function generateReport(devStatus, activity) {
  const today = new Date();
  const bjDate = new Date(today.getTime() + 8 * 60 * 60 * 1000);
  const dateStr = bjDate.toISOString().split('T')[0];
  const team = devStatus.team || [];

  // 团队状态表格
  let teamTable = '| 开发者 | 当前模块 | 连胜 | 状态 |\n| --- | --- | --- | --- |\n';
  team.forEach(dev => {
    const statusEmoji = {
      'active': '🟢 活跃',
      'waiting_syslog': '🟡 等待SYSLOG',
      'waiting_broadcast': '🔵 等待广播',
      'paused': '⏸️ 暂停',
    };
    const status = statusEmoji[dev.status] || dev.status;
    const streak = dev.streak > 0 ? `🔥${dev.streak}` : '—';
    teamTable += `| ${dev.name} | ${dev.module} | ${streak} | ${status} |\n`;
  });

  // 今日亮点
  let highlights = '';
  if (activity.commits.length > 0) {
    highlights += activity.commits.slice(0, 5).map(c => `· ${c}`).join('\n') + '\n';
  }
  // 连胜记录
  const topStreakers = team.filter(d => d.streak >= 5).sort((a, b) => b.streak - a.streak);
  if (topStreakers.length > 0) {
    highlights += topStreakers.map(d => `· 🔥 ${d.name} ${d.streak}连胜 — ${d.module}`).join('\n') + '\n';
  }
  if (!highlights) {
    highlights = '· 团队持续推进中，期待新的突破！\n';
  }

  // 项目概览
  const activeDevs = team.filter(d => d.status !== 'paused').length;
  const summary = devStatus.summary || {};

  const report = `# 🌊 光湖开发日报 · ${dateStr}

## 📊 团队状态
${teamTable}
## 🔥 今日亮点
${highlights}
## 🏗️ 项目概览
· 活跃开发者：${activeDevs}人
· 最高连胜：${summary.top_streak || '无'}
· 代码仓库：[guanghulab](https://github.com/qinfendebingshuo/guanghulab)
· 🏛️ 通感语言核系统编程语言 · 作品著作权认证（中国版权保护中心）

---
⭐ 觉得有意思？给个 Star 支持一下！
💬 有问题或想聊聊？欢迎到 [访客留言板](https://github.com/qinfendebingshuo/guanghulab/discussions/categories/访客留言板) 留言！
`;

  return { title: `🌊 光湖开发日报 · ${dateStr}`, body: report };
}

// ── 主流程 ──
async function main() {
  console.log('📰 开始生成光湖开发日报...');

  // 读取 dev-status
  let devStatus = {};
  try {
    devStatus = JSON.parse(fs.readFileSync(DEV_STATUS_PATH, 'utf8'));
  } catch {
    console.log('⚠️ dev-status.json 读取失败，使用空数据');
  }

  // 获取 Git 活动
  const activity = getRecentActivity();

  // 生成日报内容
  const { title, body } = generateReport(devStatus, activity);

  console.log(`📝 日报标题: ${title}`);
  console.log('---');
  console.log(body.slice(0, 500) + '...');

  // 保存日报到本地（供调试和存档）
  const reportDir = 'docs/daily-reports';
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  const bjDate = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().split('T')[0];
  fs.writeFileSync(path.join(reportDir, `${bjDate}.md`), `# ${title}\n\n${body}`);
  console.log(`✅ 日报已保存到 ${reportDir}/${bjDate}.md`);

  // 发布到 Discussions
  if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
    console.log('⚠️ GITHUB_TOKEN 或 GITHUB_REPOSITORY 未配置，跳过 Discussion 发布');
    return;
  }

  const [owner, repo] = GITHUB_REPOSITORY.split('/');
  if (!owner || !repo) {
    console.log('⚠️ GITHUB_REPOSITORY 格式错误，应为 owner/repo');
    return;
  }

  // 获取仓库和分类 ID
  let repoId;
  try {
    repoId = await getRepositoryId(owner, repo);
  } catch (err) {
    console.log(`⚠️ 无法连接 GitHub API: ${err.message}，跳过 Discussion 发布`);
    return;
  }
  if (!repoId) {
    console.log('⚠️ 无法获取仓库 ID，跳过 Discussion 发布');
    return;
  }

  let categoryId;
  try {
    categoryId = await getCategoryId(owner, repo, DISCUSSION_CATEGORY);
  } catch (err) {
    console.log(`⚠️ 获取分类失败: ${err.message}，跳过 Discussion 发布`);
    return;
  }
  if (!categoryId) {
    console.log(`⚠️ 未找到 "${DISCUSSION_CATEGORY}" 分类，跳过 Discussion 发布`);
    console.log('   请先在仓库 Settings → Discussions 中创建该分类');
    return;
  }

  // 创建 Discussion
  try {
    const result = await createDiscussion(repoId, categoryId, title, body);
    if (result?.data?.createDiscussion?.discussion?.url) {
      console.log(`✅ 日报已发布: ${result.data.createDiscussion.discussion.url}`);
    } else {
      console.log('⚠️ Discussion 创建结果:', JSON.stringify(result?.errors || result).slice(0, 500));
    }
  } catch (err) {
    console.log(`⚠️ Discussion 发布失败: ${err.message}`);
  }
}

main().catch(err => {
  console.error('❌ 日报生成失败:', err.message);
  process.exit(1);
});
