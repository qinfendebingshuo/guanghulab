/**
 * Smoke test · HLI 接口健康检查
 *
 * 测试 GET /health 端点可达性
 * 版权：国作登字-2026-A-00037559
 */
'use strict';

const http = require('http');

const BASE = process.env.TEST_BASE || 'http://localhost:3001';

function get(urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + urlPath);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'GET',
      timeout: 10000
    };

    const req = http.request(options, (res) => {
      let chunks = '';
      res.on('data', (c) => { chunks += c; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(chunks) });
        } catch (e) {
          resolve({ status: res.statusCode, body: chunks });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.end();
  });
}

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

async function run() {
  console.log('🚀 HLI 接口冒烟测试\n');

  // Test 1: Health endpoint
  console.log('── 测试 1: 健康检查端点 ──');
  try {
    const res = await get('/health');
    assert(res.status === 200, '/health 返回 200');
    assert(res.body.status === 'ok', '/health 状态 ok');
  } catch (e) {
    failed++;
    console.error(`  ❌ /health 请求失败: ${e.message}`);
  }

  console.log(`\n📊 冒烟测试: ${passed} 通过, ${failed} 失败`);
  if (failed > 0) {
    console.error('❌ HLI Smoke Test FAILED');
    process.exit(1);
  } else {
    console.log('✅ HLI Smoke Test PASSED');
  }
}

run();
