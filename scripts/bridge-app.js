// scripts/bridge-app.js
// 铸渊仓库联邦桥接引擎
// 用途：从主仓库向所有开发者仓库推送文件

const https = require('https');
const fs = require('fs');
const path = require('path');

const TOKEN = process.env.MAIN_REPO_TOKEN;
const ORG = process.env.GITHUB_ORG || 'qinfendebingshuo';
const COMMITTER = { name: '铸渊 (ZhùYuān)', email: 'zhuyuan@guanghulab.com' };
const BULLETIN_PATH = 'bulletins/latest.md';

// ========== 开发者仓库路由表 ==========
const FEDERATION = {
  'DEV-004': { name: '之之', repo: 'guanghu-zhizhi', persona: '秋秋' },
  'DEV-010': { name: '桔子', repo: 'guanghu-juzi', persona: '晨星' },
  'DEV-012': { name: 'Awen', repo: 'guanghu-awen', persona: '知秋' },
  'DEV-002': { name: '肥猫', repo: 'guanghu-feimao', persona: '舒舒' },
  'DEV-001': { name: '页页', repo: 'guanghu-yeye', persona: '小坍缩核' },
  'DEV-003': { name: '燕樊', repo: 'guanghu-yanfan', persona: '寂曜' },
  // 新增开发者在此追加
};

// GitHub API 封装
function githubRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'ZhuYuan-Bridge',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const githubGet = (p) => githubRequest('GET', p);
const githubPut = (p, b) => githubRequest('PUT', p, b);
const githubPost = (p, b) => githubRequest('POST', p, b);

// 创建或更新文件
async function pushFile(repo, filePath, content, message) {
  const url = `/repos/${ORG}/${repo}/contents/${filePath}`;

  let sha = null;
  try {
    const existing = await githubGet(url);
    if (existing.sha) sha = existing.sha;
  } catch (e) { /* 文件不存在，正常 */ }

  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    committer: COMMITTER
  };
  if (sha) body.sha = sha;

  return githubPut(url, body);
}

// ========== 功能模块 ==========

// 1. 推送公告到所有仓库
async function pushBulletin() {
  if (!fs.existsSync(BULLETIN_PATH)) {
    console.log('📭 无 bulletins/latest.md');
    return;
  }
  const content = fs.readFileSync(BULLETIN_PATH, 'utf8');
  const timestamp = new Date().toISOString().split('T')[0];

  for (const [devId, dev] of Object.entries(FEDERATION)) {
    try {
      await pushFile(dev.repo, 'BULLETIN.md', content,
        `📡 铸渊公告推送 · ${timestamp}`);
      console.log(`✅ ${devId}(${dev.name}) 公告已推送`);
    } catch (e) {
      console.error(`❌ ${devId}(${dev.name}) 推送失败: ${e.message}`);
    }
  }
}

// 2. 初始化开发者仓库
async function initRepo(devId) {
  const dev = FEDERATION[devId];
  if (!dev) { console.error(`未知开发者: ${devId}`); return; }

  const files = [
    {
      path: '.github/persona-brain/config.json',
      content: JSON.stringify({
        persona_name: dev.persona,
        dev_id: devId,
        dev_name: dev.name,
        main_repo: 'guanghulab',
        org: ORG,
        initialized_by: 'zhuyuan-bridge-app',
        initialized_at: new Date().toISOString()
      }, null, 2)
    },
    {
      path: '.github/persona-brain/status.json',
      content: JSON.stringify({
        persona: dev.persona,
        dev_id: devId,
        initialized: new Date().toISOString(),
        last_checkin: null,
        current_broadcast: null
      }, null, 2)
    },
    {
      path: 'BULLETIN.md',
      content: `# 📡 系统公告\n\n> 仓库已由铸渊自动初始化 · ${new Date().toISOString().split('T')[0]}\n> 欢迎 ${dev.name} 和 ${dev.persona}！\n`
    }
  ];

  for (const file of files) {
    await pushFile(dev.repo, file.path, file.content,
      `🏗️ 铸渊初始化 · ${devId} ${dev.name} · ${file.path}`);
    console.log(`📁 ${devId} → ${file.path} ✅`);
  }
  console.log(`\n🎉 ${devId}(${dev.name}) 仓库初始化完成`);
}

// 3. 汇总所有仓库进度
async function collectStatus() {
  const status = {};
  for (const [devId, dev] of Object.entries(FEDERATION)) {
    try {
      const data = await githubGet(
        `/repos/${ORG}/${dev.repo}/contents/.github/persona-brain/status.json`
      );
      status[devId] = {
        name: dev.name,
        persona: dev.persona,
        ...JSON.parse(Buffer.from(data.content, 'base64').toString())
      };
      console.log(`📊 ${devId}(${dev.name}) 状态已收集`);
    } catch (e) {
      status[devId] = { name: dev.name, persona: dev.persona, error: '无法读取' };
      console.warn(`⚠️ ${devId}(${dev.name}) 读取失败`);
    }
  }

  await pushFile('guanghulab', 'federation-status.json',
    JSON.stringify(status, null, 2),
    `📊 铸渊联邦状态汇总 · ${new Date().toISOString().split('T')[0]}`);
  console.log('\n✅ 联邦状态汇总完成 → federation-status.json');
}

// 4. 跨仓库广播分发
async function distributeBroadcasts() {
  const OUTBOX = 'broadcasts-outbox';
  if (!fs.existsSync(OUTBOX)) { console.log('📭 无广播待分发'); return; }

  const devDirs = fs.readdirSync(OUTBOX).filter(d =>
    d.startsWith('DEV-') && fs.statSync(path.join(OUTBOX, d)).isDirectory()
  );

  for (const devId of devDirs) {
    const dev = FEDERATION[devId];
    if (!dev) { console.warn(`⚠️ ${devId} 无路由映射`); continue; }

    const files = fs.readdirSync(path.join(OUTBOX, devId))
      .filter(f => f.endsWith('.md') || f.endsWith('.json'));

    for (const file of files) {
      const content = fs.readFileSync(path.join(OUTBOX, devId, file), 'utf8');
      await pushFile(dev.repo, 'LATEST-BROADCAST.md', content,
        `📡 铸渊广播分发 · ${devId} · ${file}`);
      console.log(`📡 ${devId}(${dev.name}) ← ${file} ✅`);
    }
  }
}

// ========== 入口 ==========
async function main() {
  const action = process.argv[2];
  switch (action) {
    case 'bulletin':    await pushBulletin(); break;
    case 'init':        await initRepo(process.argv[3]); break;
    case 'init-all':
      for (const id of Object.keys(FEDERATION)) await initRepo(id);
      break;
    case 'status':      await collectStatus(); break;
    case 'distribute':  await distributeBroadcasts(); break;
    default:            console.log('用法: node bridge-app.js [bulletin|init DEV-XXX|init-all|status|distribute]');
  }
}

main().catch(e => { console.error('❌ 桥接执行失败:', e.message); process.exit(1); });
