/**
 * 铸渊跨仓库同步脚本 · cross-repo-sync.js
 *
 * 将 guanghulab/persona-studio/ 下的文件同步到独立仓库 persona-studio
 * 使用 GitHub API 进行文件级同步
 *
 * 需要环境变量：
 *   GITHUB_TOKEN 或 CROSS_REPO_TOKEN — 拥有 persona-studio 仓库写权限的 PAT
 *   SYNC_TARGET — 同步目标：all / brain / frontend / backend
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const TOKEN = process.env.CROSS_REPO_TOKEN || '';
const TARGET_OWNER = 'qinfendebingshuo';
const TARGET_REPO = 'persona-studio';
const SYNC_TARGET = process.env.SYNC_TARGET || 'all';

const SOURCE_BASE = path.join(__dirname, '..', 'persona-studio');

// 同步映射：本仓库路径 → 目标仓库路径
const SYNC_MAP = {
  brain: [
    { src: 'brain/persona-config.json', dest: 'brain/persona-config.json' },
    { src: 'brain/registry.json', dest: 'brain/registry.json' }
  ],
  frontend: [
    { src: 'frontend/index.html', dest: 'frontend/index.html' },
    { src: 'frontend/chat.html', dest: 'frontend/chat.html' },
    { src: 'frontend/chat.js', dest: 'frontend/chat.js' },
    { src: 'frontend/style.css', dest: 'frontend/style.css' }
  ],
  backend: [
    { src: 'backend/server.js', dest: 'backend/server.js' },
    { src: 'backend/routes/auth.js', dest: 'backend/routes/auth.js' },
    { src: 'backend/routes/chat.js', dest: 'backend/routes/chat.js' },
    { src: 'backend/routes/build.js', dest: 'backend/routes/build.js' },
    { src: 'backend/routes/notify.js', dest: 'backend/routes/notify.js' },
    { src: 'backend/brain/persona-engine.js', dest: 'backend/brain/persona-engine.js' },
    { src: 'backend/brain/model-router.js', dest: 'backend/brain/model-router.js' },
    { src: 'backend/brain/model-config.json', dest: 'backend/brain/model-config.json' },
    { src: 'backend/brain/memory-manager.js', dest: 'backend/brain/memory-manager.js' },
    { src: 'backend/brain/code-generator.js', dest: 'backend/brain/code-generator.js' },
    { src: 'backend/utils/email-sender.js', dest: 'backend/utils/email-sender.js' },
    { src: 'backend/utils/github-api.js', dest: 'backend/utils/github-api.js' }
  ]
};

/**
 * GitHub API 请求
 */
function githubRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'zhuyuan-cross-repo-sync',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };

    if (body) {
      const bodyStr = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
      options.headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: data ? JSON.parse(data) : null });
        } catch {
          resolve({ status: res.statusCode, data: null });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('GitHub API request timed out after 15s')); });

    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * 获取目标仓库中文件的 SHA（用于更新）
 */
async function getFileSha(filePath) {
  const apiPath = `/repos/${TARGET_OWNER}/${TARGET_REPO}/contents/${encodeURIComponent(filePath)}`;
  const res = await githubRequest('GET', apiPath);
  if (res.status === 200 && res.data && res.data.sha) {
    return res.data.sha;
  }
  return null;
}

/**
 * 同步单个文件
 */
async function syncFile(srcRelative, destPath) {
  const srcFull = path.join(SOURCE_BASE, srcRelative);

  if (!fs.existsSync(srcFull)) {
    console.log(`  ⏭️  跳过（源文件不存在）：${srcRelative}`);
    return false;
  }

  const content = fs.readFileSync(srcFull);
  const contentBase64 = content.toString('base64');

  // 获取目标文件 SHA
  const sha = await getFileSha(destPath);

  const body = {
    message: `🔄 铸渊同步 · ${destPath}`,
    content: contentBase64,
    committer: {
      name: 'zhuyuan-sync',
      email: 'zhuyuan-sync@users.noreply.github.com'
    }
  };

  if (sha) {
    body.sha = sha;
  }

  const apiPath = `/repos/${TARGET_OWNER}/${TARGET_REPO}/contents/${encodeURIComponent(destPath)}`;
  const res = await githubRequest('PUT', apiPath, body);

  if (res.status === 200 || res.status === 201) {
    console.log(`  ✅ 同步成功：${destPath}`);
    return true;
  } else {
    console.log(`  ❌ 同步失败 (${res.status})：${destPath} — ${res.data && res.data.message}`);
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  console.log('🔄 铸渊跨仓库同步启动');
  console.log(`  目标仓库：${TARGET_OWNER}/${TARGET_REPO}`);
  console.log(`  同步范围：${SYNC_TARGET}`);
  console.log('');

  if (!TOKEN) {
    console.log('⚠️  未设置 CROSS_REPO_TOKEN 或 GITHUB_TOKEN');
    console.log('   需要创建一个拥有 persona-studio 仓库写权限的 Personal Access Token');
    console.log('   然后在 guanghulab 仓库 Settings → Secrets 中添加为 CROSS_REPO_TOKEN');
    console.log('');
    console.log('📋 本次同步报告（仅检查，未推送）：');

    const targets = SYNC_TARGET === 'all' ? Object.keys(SYNC_MAP) : [SYNC_TARGET];
    for (const target of targets) {
      const files = SYNC_MAP[target] || [];
      console.log(`\n  📂 ${target}:`);
      for (const f of files) {
        const srcFull = path.join(SOURCE_BASE, f.src);
        const exists = fs.existsSync(srcFull);
        console.log(`    ${exists ? '✅' : '❌'} ${f.src} → ${f.dest}`);
      }
    }
    return;
  }

  // 验证 token 有效性
  const testRes = await githubRequest('GET', `/repos/${TARGET_OWNER}/${TARGET_REPO}`);
  if (testRes.status !== 200) {
    console.error(`❌ 无法访问目标仓库（${testRes.status}）。请检查 Token 权限。`);
    process.exit(1);
  }
  console.log(`✅ 目标仓库已验证：${testRes.data.full_name}\n`);

  const targets = SYNC_TARGET === 'all' ? Object.keys(SYNC_MAP) : [SYNC_TARGET];
  let synced = 0;
  let failed = 0;

  for (const target of targets) {
    const files = SYNC_MAP[target] || [];
    console.log(`📂 同步 ${target}（${files.length} 个文件）：`);

    for (const f of files) {
      try {
        const success = await syncFile(f.src, f.dest);
        if (success) synced++; else failed++;
      } catch (err) {
        console.log(`  ❌ 错误：${f.dest} — ${err.message}`);
        failed++;
      }
    }
    console.log('');
  }

  console.log(`\n🔄 同步完成：✅ ${synced} 成功 / ❌ ${failed} 失败`);
}

main().catch(err => {
  console.error('跨仓库同步异常：', err.message);
  process.exit(1);
});
