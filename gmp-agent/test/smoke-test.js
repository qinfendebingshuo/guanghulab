/**
 * M4 · 烟雾测试 · Smoke Test
 * GH-GMP-005 · Agent搬迁工程
 *
 * 用于验证服务器在线状态和GMP-Agent基础功能。
 * 需要服务器运行中 + .env配置。
 *
 * 运行：node gmp-agent/test/smoke-test.js [server-url]
 * 默认：http://43.153.203.105:9800
 */

'use strict';

const http = require('http');
const https = require('https');

const SERVER_URL = process.argv[2] || 'http://43.153.203.105:9800';

let _pass = 0;
let _fail = 0;

function ok(msg) { _pass++; console.log('  ✅ ' + msg); }
function fail(msg) { _fail++; console.log('  ❌ ' + msg); }

/**
 * HTTP GET请求
 */
function httpGet(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const timer = setTimeout(() => reject(new Error('超时 ' + timeoutMs + 'ms')), timeoutMs || 10000);

    lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        clearTimeout(timer);
        resolve({ status: res.statusCode, body: data, headers: res.headers });
      });
    }).on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function main() {
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  M4 · 烟雾测试 · GMP-Agent 服务器在线检测     ║');
  console.log('║  Target: ' + SERVER_URL.padEnd(36) + ' ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  // ── Test 1: Health Endpoint ──
  console.log('── Test 1: /health 端点 ──');
  try {
    const res = await httpGet(SERVER_URL + '/health', 15000);
    if (res.status === 200) {
      ok('/health 返回 200');
      try {
        const body = JSON.parse(res.body);
        if (body.status === 'ok' || body.status === 'running') {
          ok('状态: ' + body.status);
        } else {
          fail('状态异常: ' + body.status);
        }
        if (body.version) {
          ok('版本: ' + body.version);
        }
        if (body.uptime !== undefined) {
          ok('运行时间: ' + Math.round(body.uptime) + 's');
        }
        if (body.modules) {
          const moduleNames = Object.keys(body.modules);
          ok('已加载模块: ' + moduleNames.join(', '));

          // 检查关键模块
          if (body.modules['notion-sync']) {
            ok('notion-sync模块已加载');
          } else {
            fail('notion-sync模块未找到');
          }
          if (body.modules['llm-router']) {
            ok('llm-router模块已加载');
          } else {
            fail('llm-router模块未找到');
          }
          if (body.modules['agent-engine']) {
            ok('agent-engine模块已加载');
          } else {
            fail('agent-engine模块未找到');
          }
        }
      } catch (e) {
        ok('/health返回非JSON (可能是简单文本): ' + res.body.slice(0, 100));
      }
    } else {
      fail('/health 返回 ' + res.status);
    }
  } catch (err) {
    fail('/health 不可达: ' + err.message);
    console.log('  ⚠️  服务器可能未运行。请确认GMP-Agent已通过PM2启动。');
    console.log('  ⚠️  命令: ssh root@43.153.203.105 "pm2 status"');
  }

  // ── Test 2: Root Endpoint ──
  console.log('\n── Test 2: / 根端点 ──');
  try {
    const res = await httpGet(SERVER_URL + '/', 10000);
    if (res.status === 200 || res.status === 302) {
      ok('根端点可访问 (status: ' + res.status + ')');
    } else {
      fail('根端点异常 (status: ' + res.status + ')');
    }
  } catch (err) {
    fail('根端点不可达: ' + err.message);
  }

  // ── Test 3: Webhook Endpoint ──
  console.log('\n── Test 3: /webhook 端点（仅检查可达性） ──');
  try {
    const res = await httpGet(SERVER_URL + '/webhook', 10000);
    // webhook通常只接受POST，GET可能返回405或其他
    if (res.status < 500) {
      ok('/webhook端点存在 (status: ' + res.status + ')');
    } else {
      fail('/webhook返回服务器错误 (status: ' + res.status + ')');
    }
  } catch (err) {
    fail('/webhook不可达: ' + err.message);
  }

  // ── Test 4: 响应时间 ──
  console.log('\n── Test 4: 响应时间 ──');
  try {
    const start = Date.now();
    await httpGet(SERVER_URL + '/health', 10000);
    const elapsed = Date.now() - start;
    if (elapsed < 1000) {
      ok('响应时间: ' + elapsed + 'ms (< 1s)');
    } else if (elapsed < 5000) {
      ok('响应时间: ' + elapsed + 'ms (< 5s · 可接受)');
    } else {
      fail('响应时间: ' + elapsed + 'ms (> 5s · 过慢)');
    }
  } catch (err) {
    fail('响应时间测试失败: ' + err.message);
  }

  // ── 报告 ──
  console.log('\n╔══════════════════════════════════════════════╗');
  console.log('║  📊 烟雾测试报告                               ║');
  console.log('║  通过: ' + String(_pass).padEnd(3) + ' ✅                                 ║');
  console.log('║  失败: ' + String(_fail).padEnd(3) + (_fail > 0 ? ' ❌' : ' ✅') + '                                 ║');
  console.log('╚══════════════════════════════════════════════╝');

  if (_fail === 0) {
    console.log('\n🎉 GMP-Agent服务器在线 · 所有端点可达！');
  } else {
    console.log('\n⚠️  部分检测未通过。请检查服务器状态。');
  }

  process.exit(_fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ 致命错误: ' + err.message);
  process.exit(1);
});
