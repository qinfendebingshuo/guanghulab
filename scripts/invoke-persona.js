// scripts/invoke-persona.js
// 铸渊 · Phase B2 · 人格体唤醒调用脚本
//
// Notion Agent 调用此脚本（通过 workflow_dispatch），
// 脚本读取 Notion 工单内容 → 唤醒人格体 → 处理结果写回 Notion。
//
// 环境变量：
//   WORK_ORDER_ID          Notion 工单页面 ID
//   TASK_ID                广播编号（如 BC-M23-001-AW）
//   DEVELOPER              开发者信息（如 "DEV-012 Awen"）
//   SYSLOG_RAW             SYSLOG JSON 原文
//   ACTION                 动作类型（process_syslog / retry）
//   LLM_API_KEY            第三方 LLM 平台密钥
//   LLM_BASE_URL           第三方 LLM 平台 API 地址
//   NOTION_TOKEN           Notion API token
//   CORE_BRAIN_PAGE_ID     曜冥核心大脑 v4.0 页面 ID
//   PORTRAIT_DB_ID         开发者动态画像库 ID
//   FINGERPRINT_DB_ID      模块指纹注册表 ID
//   INVOKE_API_KEY         鉴权密钥（用于 API 调用验证）

'use strict';

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

// ══════════════════════════════════════════════════════════
// 配置
// ══════════════════════════════════════════════════════════

var WORK_ORDER_ID = process.env.WORK_ORDER_ID || '';
var TASK_ID = process.env.TASK_ID || process.env.BROADCAST_ID || 'UNKNOWN';
var DEVELOPER = process.env.DEVELOPER || 'unknown';
var SYSLOG_RAW = process.env.SYSLOG_RAW || '';
var ACTION = process.env.ACTION || 'process_syslog';

var LLM_API_KEY = process.env.LLM_API_KEY || '';
var LLM_BASE_URL = (process.env.LLM_BASE_URL || '').replace(/\/+$/, '');
var NOTION_TOKEN = process.env.NOTION_TOKEN || '';
var CORE_BRAIN_PAGE_ID = process.env.CORE_BRAIN_PAGE_ID || '';
var PORTRAIT_DB_ID = process.env.PORTRAIT_DB_ID || '';
var FINGERPRINT_DB_ID = process.env.FINGERPRINT_DB_ID || '';

var NOTION_VERSION = '2022-06-28';
var NOTION_API_HOSTNAME = 'api.notion.com';

// ══════════════════════════════════════════════════════════
// HTTP 工具
// ══════════════════════════════════════════════════════════

function httpRequest(url, options, body) {
  return new Promise(function (resolve, reject) {
    var parsed = new URL(url);
    var isHttps = parsed.protocol === 'https:';
    var mod = isHttps ? https : http;

    var opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 120000,
    };

    var req = mod.request(opts, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', reject);
    req.on('timeout', function () { req.destroy(); reject(new Error('Request timeout')); });

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

function notionRequest(method, endpoint, body) {
  var url = 'https://' + NOTION_API_HOSTNAME + endpoint;
  var headers = {
    'Authorization': 'Bearer ' + NOTION_TOKEN,
    'Content-Type': 'application/json',
    'Notion-Version': NOTION_VERSION,
  };
  return httpRequest(url, { method: method, headers: headers }, body ? JSON.stringify(body) : null)
    .then(function (res) {
      var parsed = JSON.parse(res.body);
      if (res.status >= 200 && res.status < 300) return parsed;
      throw new Error('Notion API ' + res.status + ': ' + (parsed.message || res.body));
    });
}

// ══════════════════════════════════════════════════════════
// Step 1: 读取工单内容（从 Notion）
// ══════════════════════════════════════════════════════════

async function readWorkOrder() {
  if (!WORK_ORDER_ID) {
    console.log('ℹ️  No WORK_ORDER_ID, using SYSLOG_RAW directly');
    return { syslog_raw: SYSLOG_RAW, taskId: TASK_ID, developer: DEVELOPER };
  }

  console.log('📖 读取 Notion 工单: ' + WORK_ORDER_ID);
  try {
    var page = await notionRequest('GET', '/v1/pages/' + WORK_ORDER_ID);
    var props = page.properties || {};

    // 提取工单字段
    var taskId = TASK_ID;
    var developer = DEVELOPER;

    // 尝试从工单属性中读取
    if (props['广播编号'] && props['广播编号'].rich_text) {
      var bcText = props['广播编号'].rich_text.map(function (t) { return t.plain_text || ''; }).join('');
      if (bcText) taskId = bcText;
    }
    if (props['开发者编号'] && props['开发者编号'].rich_text) {
      var devText = props['开发者编号'].rich_text.map(function (t) { return t.plain_text || ''; }).join('');
      if (devText) developer = devText;
    }

    // 读取页面内容（子块）来获取 SYSLOG 原文
    var blocks = await notionRequest('GET', '/v1/blocks/' + WORK_ORDER_ID + '/children?page_size=20');
    var syslogRaw = SYSLOG_RAW;

    if (blocks.results) {
      blocks.results.forEach(function (block) {
        if (block.type === 'code' && block.code && block.code.rich_text) {
          var codeText = block.code.rich_text.map(function (t) { return t.plain_text || ''; }).join('');
          if (codeText.length > syslogRaw.length) {
            syslogRaw = codeText;
          }
        }
      });
    }

    console.log('  → taskId: ' + taskId);
    console.log('  → developer: ' + developer);
    console.log('  → syslog_raw length: ' + syslogRaw.length);

    return { syslog_raw: syslogRaw, taskId: taskId, developer: developer };
  } catch (err) {
    console.log('⚠️  工单读取失败: ' + err.message + '，使用环境变量');
    return { syslog_raw: SYSLOG_RAW, taskId: TASK_ID, developer: DEVELOPER };
  }
}

// ══════════════════════════════════════════════════════════
// Step 2: 唤醒人格体（复用 wake-persona.js 的逻辑）
// ══════════════════════════════════════════════════════════

async function invokePersona(workOrder) {
  console.log('🧠 唤醒人格体处理 SYSLOG...');

  // 设置环境变量供 wake-persona.js 读取
  process.env.BROADCAST_ID = workOrder.taskId;
  process.env.SUBMIT_TYPE = 'syslog';
  process.env.SUBMIT_CONTENT = workOrder.syslog_raw;
  process.env.AUTHOR = workOrder.developer;

  // 执行 wake-persona.js（fork 子进程）
  var wakeScript = path.join(__dirname, 'wake-persona.js');

  return new Promise(function (resolve, reject) {
    var child = childProcess.fork(wakeScript, [], {
      env: Object.assign({}, process.env, {
        BROADCAST_ID: workOrder.taskId,
        SUBMIT_TYPE: 'syslog',
        SUBMIT_CONTENT: workOrder.syslog_raw,
        AUTHOR: workOrder.developer,
        LLM_API_KEY: LLM_API_KEY,
        LLM_BASE_URL: LLM_BASE_URL,
        NOTION_TOKEN: NOTION_TOKEN,
        CORE_BRAIN_PAGE_ID: CORE_BRAIN_PAGE_ID,
        PORTRAIT_DB_ID: PORTRAIT_DB_ID,
        FINGERPRINT_DB_ID: FINGERPRINT_DB_ID,
      }),
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
    });

    var stdout = '';
    var stderr = '';
    child.stdout.on('data', function (d) { stdout += d; process.stdout.write(d); });
    child.stderr.on('data', function (d) { stderr += d; process.stderr.write(d); });

    child.on('exit', function (code) {
      if (code === 0) {
        // 从 GITHUB_OUTPUT 文件读取 result（如果存在）
        var outputFile = process.env.GITHUB_OUTPUT;
        var result = '';
        if (outputFile && fs.existsSync(outputFile)) {
          var outputContent = fs.readFileSync(outputFile, 'utf8');
          var resultMatch = outputContent.match(/result<<EOF_\d+\n([\s\S]*?)\nEOF_\d+/);
          if (resultMatch) result = resultMatch[1];
        }
        if (!result) result = stdout.slice(-3000);
        resolve(result);
      } else {
        reject(new Error('wake-persona.js exited with code ' + code + ': ' + stderr));
      }
    });

    child.on('error', reject);
  });
}

// ══════════════════════════════════════════════════════════
// Step 3: 回写 Notion 工单（更新 receipt_status）
// ══════════════════════════════════════════════════════════

async function writeResultsToNotion(workOrderId, result, taskId) {
  if (!workOrderId || !NOTION_TOKEN) {
    console.log('⚠️  无法回写 Notion（缺少 workOrderId 或 NOTION_TOKEN）');
    return;
  }

  console.log('📝 回写 Notion 工单结果...');

  try {
    // 更新工单状态
    await notionRequest('PATCH', '/v1/pages/' + workOrderId, {
      properties: {
        '状态': { select: { name: '✅ 已完成' } },
      },
    });
    console.log('  → 工单状态更新为 ✅ 已完成');

    // 在工单页面追加处理结果
    var resultBlocks = [
      {
        object: 'block',
        type: 'heading_2',
        heading_2: {
          rich_text: [{ type: 'text', text: { content: '🧠 人格体处理结果' } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: '处理时间: ' + new Date().toISOString() } }],
        },
      },
      {
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: 'receipt_status: completed' } }],
        },
      },
    ];

    // 将人格体结果作为代码块
    if (result) {
      resultBlocks.push({
        object: 'block',
        type: 'code',
        code: {
          rich_text: [{ type: 'text', text: { content: result.slice(0, 2000) } }],
          language: 'markdown',
        },
      });
    }

    await notionRequest('PATCH', '/v1/blocks/' + workOrderId + '/children', {
      children: resultBlocks,
    });
    console.log('  → 处理结果已追加到工单页面');
  } catch (err) {
    console.error('⚠️  Notion 回写失败: ' + err.message);
    // 重试一次
    try {
      console.log('  → 重试回写...');
      await notionRequest('PATCH', '/v1/pages/' + workOrderId, {
        properties: {
          '状态': { select: { name: '⚠️ 异常·等人工介入' } },
        },
      });
    } catch (_) { /* ignore */ }
  }
}

// ══════════════════════════════════════════════════════════
// Step 4: 输出结果
// ══════════════════════════════════════════════════════════

function outputResult(result) {
  var outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    var delimiter = 'EOF_' + Date.now();
    fs.appendFileSync(outputFile, 'persona_result<<' + delimiter + '\n' + result + '\n' + delimiter + '\n');
    fs.appendFileSync(outputFile, 'invocation_status=completed\n');
  }
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🔗 铸渊 · 人格体唤醒调用（Phase B2）');
  console.log('═══════════════════════════════════════════');
  console.log('  workOrderId: ' + WORK_ORDER_ID);
  console.log('  taskId:      ' + TASK_ID);
  console.log('  developer:   ' + DEVELOPER);
  console.log('  action:      ' + ACTION);
  console.log('');

  // Step 1: 读取工单
  var workOrder = await readWorkOrder();

  if (!workOrder.syslog_raw) {
    console.error('❌ 缺少 SYSLOG 原文，无法处理');
    process.exit(1);
  }

  // Step 2: 唤醒人格体
  var result;
  try {
    result = await invokePersona(workOrder);
  } catch (err) {
    console.error('❌ 人格体唤醒失败: ' + err.message);
    result = '(人格体唤醒失败: ' + err.message + ')';
  }

  // Step 3: 回写 Notion
  if (WORK_ORDER_ID) {
    await writeResultsToNotion(WORK_ORDER_ID, result, workOrder.taskId);
  }

  // Step 4: 输出结果
  outputResult(result || '(no result)');

  console.log('');
  console.log('✅ 人格体调用完成');
}

main().catch(function (err) {
  console.error('❌ invoke-persona 失败: ' + err.message);

  // 尝试标记工单异常
  if (WORK_ORDER_ID && NOTION_TOKEN) {
    notionRequest('PATCH', '/v1/pages/' + WORK_ORDER_ID, {
      properties: {
        '状态': { select: { name: '⚠️ 异常·等人工介入' } },
      },
    }).catch(function () { /* ignore */ });
  }

  process.exit(1);
});
