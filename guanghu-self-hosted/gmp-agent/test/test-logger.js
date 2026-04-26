/**
 * Logger模块自测 · GH-GMP-004 · 录册A02
 *
 * 测试项：
 * 1. logger实例化
 * 2. 各级别日志写入
 * 3. 安装日志通道
 * 4. 日志查询
 * 5. 日志统计
 * 6. 日志文件实际存在
 */

'use strict';

const path = require('path');
const fs = require('fs');
const os = require('os');

// 用临时目录避免污染
const testLogDir = path.join(os.tmpdir(), `gmp-test-logger-${Date.now()}`);

// 设置环境变量后再加载模块
process.env.GMP_LOG_CONSOLE = 'false';
const { GmpLogger, getLogger, queryAll } = require('../src/logger');

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

// ─── 测试 ──────────────────────────────────────────────

console.log('\n🧪 test-logger.js · Logger模块自测\n');

// Test 1: 实例化
const logger = new GmpLogger('test-module', {
  logDir: testLogDir,
  enableConsole: false,
});
assert(logger instanceof GmpLogger, 'Logger实例化成功');
assert(logger.moduleName === 'test-module', '模块名正确');

// Test 2: 各级别日志写入
const infoEntry = logger.info('测试info消息', { key: 'value' });
assert(infoEntry !== null, 'info日志返回entry');
assert(infoEntry.level === 'info', 'info级别正确');
assert(infoEntry.module === 'test-module', 'entry模块名正确');
assert(infoEntry.message === '测试info消息', 'entry消息正确');
assert(infoEntry.key === 'value', 'entry元数据正确');

logger.warn('测试warn消息');
logger.error('测试error消息', { code: 500 });

// Test 3: debug级别被过滤（默认minLevel=info）
const debugEntry = logger.debug('这条应该被过滤');
assert(debugEntry === null, 'debug日志被正确过滤（minLevel=info）');

// Test 4: 安装日志通道
logger.install('模块安装成功', { version: '1.0.0' });

// Test 5: 日志文件存在
const runtimeLog = path.join(testLogDir, 'test-module', 'runtime.jsonl');
const installLog = path.join(testLogDir, 'test-module', 'install.jsonl');
assert(fs.existsSync(runtimeLog), 'runtime.jsonl文件存在');
assert(fs.existsSync(installLog), 'install.jsonl文件存在');

// Test 6: 日志查询
const allLogs = logger.query();
assert(allLogs.length >= 3, `查询返回>=3条日志（实际${allLogs.length}条）`);

const errorLogs = logger.query({ level: 'error' });
assert(errorLogs.length === 1, '按level过滤error返回1条');
assert(errorLogs[0].code === 500, 'error日志元数据正确');

const installLogs = logger.query({ channel: 'install' });
assert(installLogs.length === 1, '按channel过滤install返回1条');

// Test 7: 日志统计
const stats = logger.stats();
assert(stats.total >= 4, `统计总数>=4（实际${stats.total}）`);
assert(stats.byLevel.info >= 1, '统计按级别分组正确');
assert(stats.byChannel.install === 1, '统计按通道分组正确');

// ─── 清理 ──────────────────────────────────────────────
try {
  fs.rmSync(testLogDir, { recursive: true, force: true });
} catch {
  // ignore cleanup errors
}

// ─── 结果 ──────────────────────────────────────────────
console.log(`\n📊 结果: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  process.exit(1);
}
