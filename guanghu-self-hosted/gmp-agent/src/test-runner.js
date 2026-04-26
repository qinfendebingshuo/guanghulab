/**
 * GMP-Agent 测试报告生成器
 * test-runner.js · GH-GMP-004 · 录册A02
 *
 * 功能：
 * - 自动发现 test/ 目录下的测试文件（test-*.js）
 * - 运行每个测试文件，捕获结果
 * - 生成结构化JSON测试报告
 * - 输出人类可读的摘要
 * - 退出码反映测试结果（0=全通过, 1=有失败）
 *
 * 环境要求：Node.js 20+ · 纯标准库 · 无第三方依赖
 *
 * 用法：
 *   node gmp-agent/src/test-runner.js [--dir=test/] [--report=test-report.json] [--verbose]
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

// ─── 配置 ───────────────────────────────────────────────
const DEFAULT_TEST_DIR = path.join(__dirname, '..', 'test');
const DEFAULT_REPORT_FILE = path.join(__dirname, '..', 'test-report.json');

// ─── 测试发现 ──────────────────────────────────────────

/**
 * 发现测试文件
 * @param {string} testDir - 测试目录
 * @returns {string[]} 测试文件路径列表
 */
function discoverTests(testDir) {
  if (!fs.existsSync(testDir)) {
    console.warn(`[test-runner] Test directory not found: ${testDir}`);
    return [];
  }
  return fs.readdirSync(testDir)
    .filter(f => f.startsWith('test-') && f.endsWith('.js'))
    .map(f => path.join(testDir, f))
    .sort();
}

// ─── 测试执行 ──────────────────────────────────────────

/**
 * 运行单个测试文件
 * @param {string} testFile - 测试文件路径
 * @param {boolean} verbose - 是否输出详细信息
 * @returns {object} { file, name, status, duration, output, error? }
 */
function runTest(testFile, verbose = false) {
  const name = path.basename(testFile, '.js');
  const startTime = Date.now();
  const result = {
    file: testFile,
    name,
    status: 'pass',  // pass | fail | error | skip
    duration: 0,
    output: '',
    error: null,
  };

  try {
    const output = execFileSync('node', [testFile], {
      timeout: 30000,  // 30秒超时
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, GMP_TEST_MODE: 'true' },
    });
    result.output = output.trim();
    result.status = 'pass';
  } catch (err) {
    result.status = err.killed ? 'error' : 'fail';
    result.output = (err.stdout || '').trim();
    result.error = (err.stderr || err.message || '').trim();
  }

  result.duration = Date.now() - startTime;

  if (verbose) {
    const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
    console.log(`  ${icon} ${name} (${result.duration}ms)`);
    if (result.error) {
      console.log(`     Error: ${result.error.split('\n')[0]}`);
    }
  }

  return result;
}

// ─── 报告生成 ──────────────────────────────────────────

/**
 * 生成测试报告
 * @param {Array<object>} results - 测试结果列表
 * @returns {object} 结构化测试报告
 */
function generateReport(results) {
  const summary = {
    total: results.length,
    pass: results.filter(r => r.status === 'pass').length,
    fail: results.filter(r => r.status === 'fail').length,
    error: results.filter(r => r.status === 'error').length,
    skip: results.filter(r => r.status === 'skip').length,
    totalDuration: results.reduce((sum, r) => sum + r.duration, 0),
  };

  return {
    reportVersion: '1.0.0',
    generator: 'gmp-agent/test-runner · LC-A02',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    summary,
    verdict: summary.fail === 0 && summary.error === 0 ? 'PASS' : 'FAIL',
    results,
  };
}

/**
 * 打印人类可读摘要
 */
function printSummary(report) {
  console.log('\n══════════════════════════════════════');
  console.log('  GMP-Agent Test Report');
  console.log('══════════════════════════════════════');
  console.log(`  Timestamp : ${report.timestamp}`);
  console.log(`  Node      : ${report.environment.node}`);
  console.log(`  Total     : ${report.summary.total}`);
  console.log(`  Pass      : ${report.summary.pass}`);
  console.log(`  Fail      : ${report.summary.fail}`);
  console.log(`  Error     : ${report.summary.error}`);
  console.log(`  Skip      : ${report.summary.skip}`);
  console.log(`  Duration  : ${report.summary.totalDuration}ms`);
  console.log(`  Verdict   : ${report.verdict}`);
  console.log('══════════════════════════════════════\n');
}

// ─── 主流程 ──────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const testDirArg = args.find(a => a.startsWith('--dir='));
  const reportArg = args.find(a => a.startsWith('--report='));

  const testDir = testDirArg ? testDirArg.split('=')[1] : DEFAULT_TEST_DIR;
  const reportFile = reportArg ? reportArg.split('=')[1] : DEFAULT_REPORT_FILE;

  console.log(`[test-runner] Discovering tests in: ${testDir}`);
  const testFiles = discoverTests(testDir);

  if (testFiles.length === 0) {
    console.log('[test-runner] No test files found.');
    process.exit(0);
  }

  console.log(`[test-runner] Found ${testFiles.length} test file(s)\n`);

  const results = testFiles.map(f => runTest(f, verbose));
  const report = generateReport(results);

  // 写报告文件
  try {
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[test-runner] Report saved to: ${reportFile}`);
  } catch (err) {
    console.error(`[test-runner] Failed to save report: ${err.message}`);
  }

  printSummary(report);

  // 退出码
  process.exit(report.verdict === 'PASS' ? 0 : 1);
}

// ─── 导出（供其他模块调用）+ CLI入口 ────────────────────
module.exports = { discoverTests, runTest, generateReport, printSummary };

if (require.main === module) {
  main();
}
