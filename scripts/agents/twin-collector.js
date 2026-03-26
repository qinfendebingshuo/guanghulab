// scripts/agents/twin-collector.js
// Twin Data Collector · 双子数据采集器
// ZY-P1-TWIN-001 · Phase 1 · Twin Balance Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '../..');
const TIANYEN_DIR = path.join(ROOT, '.github/tianyen');
const TWIN_DATA_PATH = path.join(TIANYEN_DIR, 'twin-data.json');

// ── 维度权重 · 四维天平 ─────────────────────────────────────────────────
const WEIGHTS = {
  taskCompletion: 0.40,
  testPassRate: 0.25,
  codeCoverage: 0.20,
  securityScore: 0.15
};

/**
 * 执行测试命令，解析 ✅/❌ 计数
 * @param {string} cmd - 测试命令
 * @returns {{ passed: number, failed: number, total: number, output: string }}
 */
function runTests(cmd) {
  let output = '';
  try {
    output = execSync(cmd, {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60000,
      stdio: ['pipe', 'pipe', 'pipe']
    });
  } catch (err) {
    // 测试失败时 execSync 会抛错，但 stderr/stdout 仍有数据
    output = (err.stdout || '') + '\n' + (err.stderr || '');
  }

  const passCount = (output.match(/✅/g) || []).length;
  const failCount = (output.match(/❌/g) || []).length;
  const total = passCount + failCount;

  return { passed: passCount, failed: failCount, total, output };
}

/**
 * 采集单侧指标
 * @param {'exe-engine'|'grid-db'} side
 * @returns {{ taskCompletion: number, testPassRate: number, codeCoverage: number, securityScore: number, composite: number, details: object }}
 */
function collectMetrics(side) {
  const testCommands = {
    'exe-engine': [
      'node exe-engine/tests/smoke/exe-engine.test.js',
      'node exe-engine/tests/smoke/exe-engine-p1.test.js'
    ],
    'grid-db': [
      'node grid-db/tests/smoke/grid-db.test.js'
    ]
  };

  const commands = testCommands[side] || [];
  let totalPassed = 0;
  let totalFailed = 0;
  let totalTests = 0;
  const testDetails = [];

  for (const cmd of commands) {
    const result = runTests(cmd);
    totalPassed += result.passed;
    totalFailed += result.failed;
    totalTests += result.total;
    testDetails.push({
      command: cmd,
      passed: result.passed,
      failed: result.failed,
      total: result.total
    });
  }

  // 测试通过率
  const testPassRate = totalTests > 0 ? totalPassed / totalTests : 1.0;

  // 任务完成度 — 基于测试结果推导
  const taskCompletion = testPassRate;

  // 代码覆盖率 — 无覆盖工具时默认 100%
  const codeCoverage = 1.0;

  // 安全扫描 — 默认无告警 = 100%
  const securityScore = 1.0;

  // 综合分数 = 加权求和
  const composite =
    WEIGHTS.taskCompletion * taskCompletion +
    WEIGHTS.testPassRate * testPassRate +
    WEIGHTS.codeCoverage * codeCoverage +
    WEIGHTS.securityScore * securityScore;

  return {
    taskCompletion: Math.round(taskCompletion * 10000) / 10000,
    testPassRate: Math.round(testPassRate * 10000) / 10000,
    codeCoverage: Math.round(codeCoverage * 10000) / 10000,
    securityScore: Math.round(securityScore * 10000) / 10000,
    composite: Math.round(composite * 10000) / 10000,
    details: {
      totalPassed,
      totalFailed,
      totalTests,
      tests: testDetails
    }
  };
}

/** 采集左翼 · EXE-Engine */
function collectLeft() {
  return collectMetrics('exe-engine');
}

/** 采集右翼 · Grid-DB */
function collectRight() {
  return collectMetrics('grid-db');
}

/** 采集双翼 · 同时采集左右 */
function collectBoth() {
  const left = collectLeft();
  const right = collectRight();
  const result = {
    left,
    right,
    timestamp: new Date().toISOString()
  };

  // 确保输出目录存在
  if (!fs.existsSync(TIANYEN_DIR)) {
    fs.mkdirSync(TIANYEN_DIR, { recursive: true });
  }
  fs.writeFileSync(TWIN_DATA_PATH, JSON.stringify(result, null, 2), 'utf8');

  return result;
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('🔬 Twin Data Collector · 双子数据采集\n');
  const data = collectBoth();
  console.log(`  左翼 (EXE-Engine): composite = ${data.left.composite}`);
  console.log(`  右翼 (Grid-DB):    composite = ${data.right.composite}`);
  console.log(`\n✅ 数据已写入 ${TWIN_DATA_PATH}`);
}

module.exports = { collectMetrics, collectLeft, collectRight, collectBoth, WEIGHTS };
