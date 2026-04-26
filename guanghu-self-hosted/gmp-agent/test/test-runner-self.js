/**
 * Test-Runner自测 · GH-GMP-004 · 录册A02
 *
 * 测试test-runner模块自身的功能（不递归执行自己）
 * 测试项：
 * 1. discoverTests能发现测试文件
 * 2. generateReport生成正确的报告结构
 * 3. 报告verdict逻辑正确
 */

'use strict';

const path = require('path');
const { discoverTests, generateReport } = require('../src/test-runner');

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

console.log('\n🧪 test-runner-self.js · Test-Runner自测\n');

// Test 1: discoverTests
const testDir = path.join(__dirname);
const tests = discoverTests(testDir);
assert(Array.isArray(tests), 'discoverTests返回数组');
assert(tests.length >= 2, `发现>=2个测试文件（实际${tests.length}）`);
assert(tests.every(f => f.endsWith('.js')), '所有文件以.js结尾');
assert(tests.every(f => path.basename(f).startsWith('test-')), '所有文件以test-开头');

// Test 2: discoverTests对不存在的目录
const empty = discoverTests('/nonexistent/path/xxx');
assert(Array.isArray(empty) && empty.length === 0, '不存在的目录返回空数组');

// Test 3: generateReport全通过场景
const passResults = [
  { file: 'a.js', name: 'a', status: 'pass', duration: 10, output: 'ok', error: null },
  { file: 'b.js', name: 'b', status: 'pass', duration: 20, output: 'ok', error: null },
];
const passReport = generateReport(passResults);
assert(passReport.verdict === 'PASS', '全通过时verdict=PASS');
assert(passReport.summary.total === 2, '总数正确');
assert(passReport.summary.pass === 2, '通过数正确');
assert(passReport.summary.fail === 0, '失败数为0');
assert(passReport.summary.totalDuration === 30, '总耗时正确');
assert(passReport.reportVersion === '1.0.0', '报告版本号正确');
assert(passReport.generator.includes('LC-A02'), '生成器标记包含LC-A02');

// Test 4: generateReport有失败场景
const failResults = [
  { file: 'a.js', name: 'a', status: 'pass', duration: 10, output: '', error: null },
  { file: 'b.js', name: 'b', status: 'fail', duration: 20, output: '', error: 'assertion failed' },
];
const failReport = generateReport(failResults);
assert(failReport.verdict === 'FAIL', '有失败时verdict=FAIL');
assert(failReport.summary.fail === 1, '失败数=1');

// Test 5: generateReport空结果
const emptyReport = generateReport([]);
assert(emptyReport.verdict === 'PASS', '空结果时verdict=PASS');
assert(emptyReport.summary.total === 0, '空结果总数=0');

// ─── 结果 ──────────────────────────────────────────────
console.log(`\n📊 结果: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
