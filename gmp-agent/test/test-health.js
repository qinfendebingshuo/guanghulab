/**
 * GMP-Agent健康检查测试 · GH-GMP-004 · 录册A02
 *
 * 测试项：
 * 1. Node.js版本 >= 20
 * 2. 必要的标准库可用
 * 3. 文件系统可写
 * 4. 环境变量可读
 * 5. GMP目录结构正确
 */

'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

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

console.log('\n🧪 test-health.js · GMP-Agent健康检查\n');

// Test 1: Node.js版本
const nodeVersion = parseInt(process.versions.node.split('.')[0]);
assert(nodeVersion >= 20, `Node.js版本 >= 20（实际v${process.versions.node}）`);

// Test 2: 标准库可用
let stdlibOk = true;
try {
  require('fs');
  require('path');
  require('child_process');
  require('events');
  require('http');
  require('os');
  require('crypto');
} catch (err) {
  stdlibOk = false;
}
assert(stdlibOk, '所有必要标准库可用（fs/path/child_process/events/http/os/crypto）');

// Test 3: 文件系统可写
const testFile = path.join(os.tmpdir(), `gmp-health-test-${Date.now()}.tmp`);
try {
  fs.writeFileSync(testFile, 'health-check', 'utf-8');
  const content = fs.readFileSync(testFile, 'utf-8');
  assert(content === 'health-check', '文件系统读写正常');
  fs.unlinkSync(testFile);
} catch (err) {
  assert(false, `文件系统读写正常（错误: ${err.message}）`);
}

// Test 4: 环境变量可读
assert(typeof process.env === 'object', '环境变量对象可访问');
assert(typeof process.env.PATH === 'string' || typeof process.env.Path === 'string', 'PATH环境变量存在');

// Test 5: GMP目录结构（如果在仓库内运行）
const gmpAgentDir = path.join(__dirname, '..');
const srcDir = path.join(gmpAgentDir, 'src');
if (fs.existsSync(srcDir)) {
  assert(fs.existsSync(path.join(srcDir, 'logger.js')), 'src/logger.js 存在');
  assert(fs.existsSync(path.join(srcDir, 'test-runner.js')), 'src/test-runner.js 存在');
} else {
  console.log('  ⏭️ 跳过目录结构检查（非仓库环境）');
}

// Test 6: JSON序列化正常（确保日志模块能工作）
try {
  const obj = { timestamp: new Date().toISOString(), level: 'info', message: '测试中文消息', emoji: '🔥' };
  const json = JSON.stringify(obj);
  const parsed = JSON.parse(json);
  assert(parsed.message === '测试中文消息', 'JSON中文序列化/反序列化正常');
  assert(parsed.emoji === '🔥', 'JSON emoji序列化正常');
} catch {
  assert(false, 'JSON序列化正常');
}

// ─── 结果 ──────────────────────────────────────────────
console.log(`\n📊 结果: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
