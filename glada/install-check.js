#!/usr/bin/env node
/**
 * GLADA · 预飞检查 · install-check.js
 *
 * 部署后立即运行，检查所有前置条件是否满足：
 *   1. Node.js 版本
 *   2. 依赖安装
 *   3. 环境变量（LLM密钥、Base URL）
 *   4. LLM API 连通性（发一个 ping 请求）
 *   5. 目录权限（queue、logs、receipts）
 *   6. 端口可用
 *
 * 用法：
 *   node glada/install-check.js
 *   npm run preflight          (从 glada/ 目录)
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const net = require('net');

const ROOT = path.resolve(__dirname, '..');
let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;
let warningChecks = 0;

function pass(name, detail) {
  totalChecks++; passedChecks++;
  console.log(`  ✅ ${name}${detail ? ': ' + detail : ''}`);
}
function fail(name, detail) {
  totalChecks++; failedChecks++;
  console.log(`  ❌ ${name}${detail ? ': ' + detail : ''}`);
}
function warn(name, detail) {
  totalChecks++; warningChecks++;
  console.log(`  ⚠️ ${name}${detail ? ': ' + detail : ''}`);
}

// Load env files (same as service.js)
const envFiles = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.app'),
  path.join(__dirname, '.env.glada'),
];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

async function main() {
  console.log('═'.repeat(50));
  console.log('🔍 GLADA 预飞检查 · Pre-flight Diagnostics');
  console.log('═'.repeat(50));

  // ── 1. Node.js 版本 ──
  console.log('\n📦 运行环境:');
  const nodeVersion = process.versions.node;
  const major = parseInt(nodeVersion.split('.')[0], 10);
  if (major >= 20) {
    pass('Node.js 版本', `v${nodeVersion} (>= 20 ✓)`);
  } else {
    fail('Node.js 版本', `v${nodeVersion} (需要 >= 20)`);
  }

  // ── 2. 依赖检查 ──
  console.log('\n📦 依赖检查:');
  try {
    require('express');
    pass('express', '已安装');
  } catch {
    fail('express', '未安装 · 请运行: cd glada && npm install');
  }

  // Node 内建模块（不需要安装）
  const builtins = ['fs', 'path', 'https', 'http', 'child_process', 'crypto', 'net'];
  for (const mod of builtins) {
    try {
      require(mod);
      pass(`${mod}`, '内建模块 ✓');
    } catch {
      fail(`${mod}`, '缺失（不应发生）');
    }
  }

  // ── 3. GLADA 模块加载 ──
  console.log('\n🤖 GLADA 模块:');
  const modules = [
    'task-receiver', 'context-builder', 'step-executor',
    'code-generator', 'git-operator', 'notifier', 'execution-loop'
  ];
  for (const mod of modules) {
    try {
      require(`./${mod}`);
      pass(mod, '加载成功');
    } catch (err) {
      fail(mod, `加载失败: ${err.message}`);
    }
  }

  // ── 4. 环境变量 ──
  console.log('\n🔑 环境变量:');
  const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
  const baseUrl = process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '';

  if (apiKey && apiKey.length > 5) {
    pass('ZY_LLM_API_KEY', `已配置 (${apiKey.length}字符 · ***已脱敏***)`);
  } else {
    fail('ZY_LLM_API_KEY', '未配置或无效');
  }

  if (baseUrl) {
    pass('ZY_LLM_BASE_URL', baseUrl);
  } else {
    fail('ZY_LLM_BASE_URL', '未配置');
  }

  const port = process.env.GLADA_PORT || process.env.PORT || '3900';
  pass('GLADA_PORT', port);

  const model = process.env.GLADA_MODEL || 'deepseek-chat';
  pass('GLADA_MODEL', model);

  // DingTalk webhook (optional)
  const dingWebhook = process.env.DINGTALK_WEBHOOK || process.env.GLADA_DINGTALK_WEBHOOK || '';
  if (dingWebhook) {
    pass('DINGTALK_WEBHOOK', '已配置');
  } else {
    warn('DINGTALK_WEBHOOK', '未配置（可选·完成通知将仅写入本地日志）');
  }

  // ── 5. 目录检查 ──
  console.log('\n📁 目录检查:');
  const requiredDirs = [
    path.join(__dirname, 'queue'),
    path.join(__dirname, 'queue', 'completed'),
    path.join(__dirname, 'logs'),
    path.join(__dirname, 'logs', 'executions'),
    path.join(__dirname, 'logs', 'notifications'),
    path.join(__dirname, 'receipts'),
    path.join(ROOT, 'bridge', 'chat-to-agent', 'pending'),
    path.join(ROOT, 'bridge', 'chat-to-agent', 'completed')
  ];

  for (const dir of requiredDirs) {
    const relDir = path.relative(ROOT, dir);
    if (fs.existsSync(dir)) {
      try {
        // Test write permission
        const testFile = path.join(dir, '.write-test');
        fs.writeFileSync(testFile, 'test', 'utf-8');
        fs.unlinkSync(testFile);
        pass(relDir, '存在 + 可写');
      } catch {
        warn(relDir, '存在但不可写');
      }
    } else {
      try {
        fs.mkdirSync(dir, { recursive: true });
        pass(relDir, '已创建');
      } catch (err) {
        fail(relDir, `创建失败: ${err.message}`);
      }
    }
  }

  // ── 6. LLM API 连通性 ──
  console.log('\n🌐 LLM API 连通性:');
  if (apiKey && baseUrl) {
    try {
      const testResult = await testLLMConnection(baseUrl, apiKey, model);
      if (testResult.success) {
        pass('LLM API 连通', `${testResult.model} 响应正常 (${testResult.latencyMs}ms)`);
      } else {
        fail('LLM API 连通', testResult.error);
      }
    } catch (err) {
      fail('LLM API 连通', err.message);
    }
  } else {
    fail('LLM API 连通', '跳过（密钥或URL未配置）');
  }

  // ── 7. 端口检查 ──
  console.log('\n🔌 端口检查:');
  const portNum = parseInt(port, 10);
  try {
    const portAvailable = await checkPort(portNum);
    if (portAvailable) {
      pass(`端口 ${portNum}`, '可用');
    } else {
      warn(`端口 ${portNum}`, '已被占用（可能 GLADA 已在运行）');
    }
  } catch {
    warn(`端口 ${portNum}`, '检查失败');
  }

  // ── 8. CAB 待执行任务 ──
  console.log('\n📥 待执行任务:');
  const pendingDir = path.join(ROOT, 'bridge', 'chat-to-agent', 'pending');
  if (fs.existsSync(pendingDir)) {
    const pending = fs.readdirSync(pendingDir).filter(f => f.endsWith('.json'));
    if (pending.length > 0) {
      pass('CAB 任务队列', `${pending.length} 个待执行: ${pending.join(', ')}`);
    } else {
      warn('CAB 任务队列', '无待执行任务（系统就绪但空闲）');
    }
  }

  // ── 汇总 ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`📊 检查结果: ${passedChecks} 通过, ${warningChecks} 警告, ${failedChecks} 失败`);
  console.log(`${'═'.repeat(50)}`);

  if (failedChecks === 0) {
    console.log('✅ GLADA 预飞检查通过！系统可以启动。');
    console.log('   启动命令: pm2 start glada/ecosystem.config.js');
    console.log('');
  } else {
    console.log('❌ GLADA 预飞检查未通过，请修复上述问题后再启动。');
    console.log('');
    process.exit(1);
  }
}

/**
 * 测试 LLM API 连通性（发送极小的请求）
 */
async function testLLMConnection(baseUrl, apiKey, model) {
  return new Promise((resolve) => {
    const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve({ success: false, error: `无效的 URL: ${url}` });
      return;
    }
    const isHttps = parsed.protocol === 'https:';
    const mod = isHttps ? https : http;

    const body = JSON.stringify({
      model,
      max_tokens: 5,
      messages: [
        { role: 'user', content: 'Say "ok"' }
      ]
    });

    const startMs = Date.now();
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(body)
      },
      timeout: 30000
    };

    const req = mod.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const latencyMs = Date.now() - startMs;
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data);
            resolve({
              success: true,
              model: json.model || model,
              latencyMs
            });
          } catch {
            resolve({ success: true, model, latencyMs });
          }
        } else {
          resolve({
            success: false,
            error: `HTTP ${res.statusCode}: ${data.substring(0, 200)}`
          });
        }
      });
    });

    req.on('error', (err) => resolve({ success: false, error: err.message }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ success: false, error: '连接超时 (30s)' });
    });

    req.write(body);
    req.end();
  });
}

/**
 * 检查端口是否可用
 */
function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

main().catch(err => {
  console.error(`预飞检查异常: ${err.message}`);
  process.exit(1);
});
