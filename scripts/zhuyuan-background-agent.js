// scripts/zhuyuan-background-agent.js
// 铸渊 · 后台自动排查 Agent
//
// 铸渊代理每次开发时，后台自动运行排查：
//   1. 监控代码变更、构建状态、测试结果
//   2. 发现异常或阶段完成时 → 自动写 Notion 工单
//   3. 不需要人类触发，跟着开发流程自动跑
//
// 环境变量：
//   NOTION_TOKEN           Notion API token
//   NOTION_TICKET_DB_ID    工单队列数据库 ID
//   GITHUB_TOKEN           GitHub API token
//   COMMIT_SHA             触发此次排查的 commit SHA
//   COMMIT_MESSAGE         触发此次排查的 commit message
//   COMMIT_AUTHOR          触发此次排查的 commit author
//   PR_NUMBER              （可选）关联的 PR 编号
//   BUILD_STATUS            构建状态（success / failure / unknown）
//   TEST_RESULT             测试结果（passed / failed / skipped / unknown）

'use strict';

var https = require('https');
var fs = require('fs');
var path = require('path');

var NOTION_TOKEN = process.env.NOTION_TOKEN || '';
var NOTION_TICKET_DB_ID = process.env.NOTION_TICKET_DB_ID || '';
var GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
var COMMIT_SHA = process.env.COMMIT_SHA || '';
var COMMIT_MESSAGE = process.env.COMMIT_MESSAGE || '';
var COMMIT_AUTHOR = process.env.COMMIT_AUTHOR || '';
var PR_NUMBER = process.env.PR_NUMBER || '';
var BUILD_STATUS = process.env.BUILD_STATUS || 'unknown';
var TEST_RESULT = process.env.TEST_RESULT || 'unknown';

var NOTION_VERSION = '2022-06-28';
var REPO_OWNER = 'qinfendebingshuo';
var REPO_NAME = 'guanghulab';
var ROOT = path.resolve(__dirname, '..');

// ══════════════════════════════════════════════════════════
// HTTP 工具
// ══════════════════════════════════════════════════════════

function notionPost(endpoint, body) {
  return new Promise(function (resolve, reject) {
    var payload = JSON.stringify(body);
    var opts = {
      hostname: 'api.notion.com',
      port: 443,
      path: endpoint,
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    var req = https.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Notion API ' + res.statusCode + ': ' + (parsed.message || data)));
          }
        } catch (e) {
          reject(new Error('Notion API parse error: ' + data));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function richTextChunks(content) {
  var str = String(content || '');
  var chunks = [];
  for (var i = 0; i < str.length; i += 2000) {
    chunks.push({ type: 'text', text: { content: str.slice(i, i + 2000) } });
  }
  if (chunks.length === 0) {
    chunks.push({ type: 'text', text: { content: '' } });
  }
  return chunks;
}

// ══════════════════════════════════════════════════════════
// 排查检查器
// ══════════════════════════════════════════════════════════

var findings = [];

// CHK-1: 构建状态检查
function checkBuildStatus() {
  if (BUILD_STATUS === 'failure') {
    findings.push({
      type: '构建失败',
      severity: 'P1',
      detail: '构建失败 · commit: ' + COMMIT_SHA.slice(0, 7) + ' · ' + COMMIT_MESSAGE.slice(0, 100),
    });
  }
}

// CHK-2: 测试结果检查
function checkTestResult() {
  if (TEST_RESULT === 'failed') {
    findings.push({
      type: '测试失败',
      severity: 'P1',
      detail: '测试失败 · commit: ' + COMMIT_SHA.slice(0, 7) + ' · ' + COMMIT_MESSAGE.slice(0, 100),
    });
  }
}

// CHK-3: Schema 覆盖率检查
function checkSchemaCoverage() {
  var routesDir = path.join(ROOT, 'src', 'routes', 'hli');
  var schemasDir = path.join(ROOT, 'src', 'schemas', 'hli');

  if (!fs.existsSync(routesDir) || !fs.existsSync(schemasDir)) return;

  var routeFiles = [];
  try {
    var domains = fs.readdirSync(routesDir).filter(function (d) {
      return fs.statSync(path.join(routesDir, d)).isDirectory();
    });

    domains.forEach(function (domain) {
      var files = fs.readdirSync(path.join(routesDir, domain))
        .filter(function (f) { return f.endsWith('.js') && f !== 'index.js'; });
      files.forEach(function (f) { routeFiles.push(domain + '/' + f); });
    });
  } catch (_) { return; }

  var missingSchemas = [];
  routeFiles.forEach(function (routeFile) {
    var schemaFile = routeFile.replace('.js', '.schema.json');
    if (!fs.existsSync(path.join(schemasDir, schemaFile))) {
      missingSchemas.push(routeFile);
    }
  });

  if (missingSchemas.length > 0) {
    findings.push({
      type: 'Schema缺失',
      severity: 'P2',
      detail: missingSchemas.length + ' 个路由缺少 schema: ' + missingSchemas.slice(0, 3).join(', '),
    });
  }
}

// CHK-4: 大脑文件完整性检查
function checkBrainIntegrity() {
  var brainFiles = [
    '.github/brain/memory.json',
    '.github/persona-brain/memory.json',
    '.github/persona-brain/dev-status.json',
    '.github/persona-brain/knowledge-base.json',
  ];

  var missing = brainFiles.filter(function (f) {
    return !fs.existsSync(path.join(ROOT, f));
  });

  if (missing.length > 0) {
    findings.push({
      type: '大脑文件缺失',
      severity: 'P1',
      detail: '缺失文件: ' + missing.join(', '),
    });
  }
}

// CHK-5: Commit 变更范围分析
function analyzeCommitScope() {
  var msg = COMMIT_MESSAGE.toLowerCase();

  // 检测阶段完成信号
  var phaseCompletionPatterns = [
    /phase\s*\d+\s*(完成|done|complete)/i,
    /阶段\s*\d+\s*完成/,
    /milestone\s*reached/i,
    /功能.*上线/,
    /全闭环.*完成/,
  ];

  for (var i = 0; i < phaseCompletionPatterns.length; i++) {
    if (phaseCompletionPatterns[i].test(COMMIT_MESSAGE)) {
      findings.push({
        type: '阶段完成',
        severity: 'INFO',
        detail: '检测到阶段完成信号: ' + COMMIT_MESSAGE.slice(0, 100),
      });
      break;
    }
  }

  // 检测需要协同的信号
  var collabPatterns = [
    /需要.*协同/,
    /等待.*回复/,
    /blocked/i,
    /waiting\s+for/i,
  ];

  for (var j = 0; j < collabPatterns.length; j++) {
    if (collabPatterns[j].test(COMMIT_MESSAGE)) {
      findings.push({
        type: '需要协同',
        severity: 'P2',
        detail: '检测到协同需求: ' + COMMIT_MESSAGE.slice(0, 100),
      });
      break;
    }
  }
}

// ══════════════════════════════════════════════════════════
// Notion 工单创建
// ══════════════════════════════════════════════════════════

async function createNotionTicket(finding) {
  if (!NOTION_TOKEN || !NOTION_TICKET_DB_ID) {
    console.log('⚠️  缺少 Notion 配置，跳过工单创建');
    return;
  }

  var title = '[排查Agent] ' + finding.type + ' · ' + COMMIT_SHA.slice(0, 7);
  var status = finding.severity === 'P1' ? '待处理' : '已完成';

  var contentText = [
    '## 🔍 后台排查 Agent 报告',
    '',
    '| 字段 | 值 |',
    '|------|-----|',
    '| 类型 | ' + finding.type + ' |',
    '| 严重程度 | ' + finding.severity + ' |',
    '| commit | ' + COMMIT_SHA.slice(0, 7) + ' |',
    '| author | ' + COMMIT_AUTHOR + ' |',
    '| 时间 | ' + new Date().toISOString() + ' |',
    '',
    '### 详情',
    '',
    finding.detail,
  ].join('\n');

  var body = {
    parent: { database_id: NOTION_TICKET_DB_ID },
    properties: {
      '标题': { title: [{ type: 'text', text: { content: title.slice(0, 120) } }] },
      '操作类型': { select: { name: '其他' } },
      '提交者': { rich_text: [{ type: 'text', text: { content: '铸渊·排查Agent' } }] },
      '状态': { select: { name: status } },
      '优先级': { select: { name: finding.severity === 'P1' ? 'P1' : 'P2' } },
      'receipt_status': { select: { name: finding.severity === 'P1' ? 'pending' : 'completed' } },
      'retry_count': { number: 0 },
      'taskId': { rich_text: [{ type: 'text', text: { content: 'BG-' + COMMIT_SHA.slice(0, 7) } }] },
      'developer': { rich_text: [{ type: 'text', text: { content: COMMIT_AUTHOR.slice(0, 200) } }] },
    },
    children: [
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: richTextChunks(contentText),
        },
      },
    ],
  };

  try {
    var result = await notionPost('/v1/pages', body);
    console.log('  → ✅ 工单已创建: ' + result.id + ' (' + finding.type + ')');
  } catch (err) {
    console.log('  → ⚠️  工单创建失败: ' + err.message);
  }
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🔍 铸渊 · 后台排查 Agent');
  console.log('═══════════════════════════════════════════');
  console.log('  commit:   ' + COMMIT_SHA.slice(0, 7));
  console.log('  author:   ' + COMMIT_AUTHOR);
  console.log('  message:  ' + COMMIT_MESSAGE.slice(0, 80));
  console.log('  build:    ' + BUILD_STATUS);
  console.log('  test:     ' + TEST_RESULT);
  console.log('');

  // 执行所有排查
  checkBuildStatus();
  checkTestResult();
  checkSchemaCoverage();
  checkBrainIntegrity();
  analyzeCommitScope();

  console.log('🔍 排查结果: ' + findings.length + ' 个发现');

  if (findings.length === 0) {
    console.log('✅ 一切正常，无需创建工单');
    return;
  }

  // 输出发现
  findings.forEach(function (f, i) {
    console.log('  [' + (i + 1) + '] ' + f.severity + ' · ' + f.type + ': ' + f.detail.slice(0, 80));
  });

  // 只对 P1/P2 级别的发现创建工单
  var actionableFindings = findings.filter(function (f) {
    return f.severity === 'P1' || f.severity === 'P2';
  });

  if (actionableFindings.length === 0) {
    console.log('ℹ️  仅有 INFO 级别发现，跳过工单创建');
    return;
  }

  console.log('');
  console.log('📋 创建 Notion 工单...');

  for (var i = 0; i < actionableFindings.length; i++) {
    await createNotionTicket(actionableFindings[i]);
  }

  // 输出结果到 GITHUB_OUTPUT
  var outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, 'findings_count=' + findings.length + '\n');
    fs.appendFileSync(outputFile, 'tickets_created=' + actionableFindings.length + '\n');
  }

  console.log('');
  console.log('✅ 后台排查完成');
}

main().catch(function (err) {
  console.error('❌ 后台排查 Agent 异常: ' + err.message);
  process.exit(1);
});
