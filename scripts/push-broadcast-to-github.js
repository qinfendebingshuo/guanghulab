// scripts/push-broadcast-to-github.js
// 铸渊 · Phase B4 · 广播文件推送到 GitHub 仓库
//
// 人格体生成广播后，通过 GitHub API 将广播 .md 文件推送到仓库。
// 路径规范：broadcasts/{developer_id}/{taskId}.md
// 提交信息：[AutoBroadcast] {taskId} · {developer} · {描述}
//
// 环境变量：
//   GITHUB_TOKEN           GitHub API token（推送用）
//   BROADCAST_ID           广播编号（如 BC-M23-001-AW）
//   DEVELOPER_ID           开发者编号（如 DEV-012）
//   DEVELOPER_NAME         开发者名字（如 Awen）
//   BROADCAST_CONTENT      广播全文内容（Markdown）
//   MODULE_NAME            模块名（可选，如 M23）
//   PHASE_NUMBER           环节号（可选，如 1）

'use strict';

var https = require('https');
var fs = require('fs');
var devSuffixMap = require('./utils/dev-suffix-map');

var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var BROADCAST_ID = process.env.BROADCAST_ID || '';
var DEVELOPER_ID = process.env.DEVELOPER_ID || '';
var DEVELOPER_NAME = process.env.DEVELOPER_NAME || '';
var BROADCAST_CONTENT = process.env.BROADCAST_CONTENT || '';
var MODULE_NAME = process.env.MODULE_NAME || '';
var PHASE_NUMBER = process.env.PHASE_NUMBER || '';

var REPO_OWNER = 'qinfendebingshuo';
var REPO_NAME = 'guanghulab';

// ══════════════════════════════════════════════════════════
// GitHub API 工具
// ══════════════════════════════════════════════════════════

function githubRequest(method, apiPath, body) {
  return new Promise(function (resolve, reject) {
    var payload = body ? JSON.stringify(body) : '';
    var opts = {
      hostname: 'api.github.com',
      port: 443,
      path: apiPath,
      method: method,
      headers: {
        'User-Agent': 'ZhuyuanBroadcast/1.0',
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    };

    if (GITHUB_TOKEN) {
      opts.headers['Authorization'] = 'Bearer ' + GITHUB_TOKEN;
    }

    if (payload) {
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    var req = https.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// ══════════════════════════════════════════════════════════
// 广播推送
// ══════════════════════════════════════════════════════════

async function pushBroadcast() {
  if (!GITHUB_TOKEN) {
    console.log('⚠️  缺少 GITHUB_TOKEN，无法推送广播');
    process.exit(1);
  }

  if (!BROADCAST_ID || !BROADCAST_CONTENT) {
    console.log('⚠️  缺少 BROADCAST_ID 或 BROADCAST_CONTENT');
    process.exit(1);
  }

  // 确定开发者 ID（从广播编号提取或使用环境变量）
  var devId = DEVELOPER_ID;
  if (!devId) {
    devId = devSuffixMap.getDevIdFromBroadcast(BROADCAST_ID) || 'UNKNOWN';
  }

  // 构建路径和提交信息
  var filePath = 'broadcasts/' + devId + '/' + BROADCAST_ID + '.md';
  var moduleLabel = MODULE_NAME || BROADCAST_ID.match(/BC-([A-Z0-9-]+)-/i)?.[1] || '';
  var phaseLabel = PHASE_NUMBER ? '环节' + PHASE_NUMBER : '';
  var devLabel = DEVELOPER_NAME || devId;
  var commitMessage = '[AutoBroadcast] ' + BROADCAST_ID + ' · ' + devLabel + ' · ' + moduleLabel + phaseLabel;

  console.log('📡 推送广播到 GitHub...');
  console.log('  路径: ' + filePath);
  console.log('  提交: ' + commitMessage);

  // 检查文件是否已存在（获取 SHA）
  var existingRes = await githubRequest('GET',
    '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + filePath);

  var sha = null;
  if (existingRes.status === 200 && existingRes.data && existingRes.data.sha) {
    sha = existingRes.data.sha;
    console.log('  → 文件已存在，将覆盖更新 (sha: ' + sha.slice(0, 8) + ')');
  }

  // Base64 编码广播内容
  var contentBase64 = Buffer.from(BROADCAST_CONTENT, 'utf8').toString('base64');

  // 创建或更新文件
  var putBody = {
    message: commitMessage,
    content: contentBase64,
    committer: {
      name: 'zhuyuan-agent[bot]',
      email: 'zhuyuan-agent[bot]@users.noreply.github.com',
    },
  };

  if (sha) {
    putBody.sha = sha;
  }

  var putRes = await githubRequest('PUT',
    '/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents/' + filePath,
    putBody);

  if (putRes.status === 200 || putRes.status === 201) {
    console.log('✅ 广播已推送: ' + filePath);
    console.log('  → commit: ' + (putRes.data.commit ? putRes.data.commit.sha.slice(0, 8) : 'unknown'));

    // 输出到 GITHUB_OUTPUT
    var outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, 'broadcast_pushed=true\n');
      fs.appendFileSync(outputFile, 'broadcast_path=' + filePath + '\n');
      fs.appendFileSync(outputFile, 'broadcast_commit=' + (putRes.data.commit ? putRes.data.commit.sha : '') + '\n');
    }
  } else {
    console.error('❌ 广播推送失败: HTTP ' + putRes.status);
    console.error('  → ' + JSON.stringify(putRes.data));

    // 输出失败状态
    var outputFile = process.env.GITHUB_OUTPUT;
    if (outputFile) {
      fs.appendFileSync(outputFile, 'broadcast_pushed=false\n');
    }

    process.exit(1);
  }
}

pushBroadcast().catch(function (err) {
  console.error('❌ 广播推送异常: ' + err.message);
  process.exit(1);
});
