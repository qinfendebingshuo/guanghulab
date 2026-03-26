// scripts/agents/actions-parser.js
// Actions Parser · 工作流输出解析器
// ZY-P1-README-001 · Phase 1 · README Management Agent
// 版权：国作登字-2026-A-00037559

'use strict';

/**
 * 解析工作流输出 · 提取测试结果、部署状态、错误
 * @param {string} output - 工作流原始输出
 * @returns {{ tests: object, deployments: string[], errors: string[] }}
 */
function parseWorkflowOutput(output) {
  if (!output || typeof output !== 'string') {
    return { tests: { passed: 0, failed: 0, total: 0 }, deployments: [], errors: [] };
  }

  const passCount = (output.match(/✅/g) || []).length;
  const failCount = (output.match(/❌/g) || []).length;

  const deployments = [];
  const deployMatch = output.match(/deploy(?:ed|ing|ment).*?(?:success|complete|done)/gi);
  if (deployMatch) {
    deployments.push(...deployMatch);
  }

  const errors = [];
  const errorLines = output.split('\n').filter(line =>
    /error|Error|ERROR|❌|FAIL/.test(line)
  );
  errors.push(...errorLines.slice(0, 10));

  return {
    tests: { passed: passCount, failed: failCount, total: passCount + failCount },
    deployments,
    errors
  };
}

/**
 * 解析 PR 合并信息
 * @param {{ title: string, number: number, author: string, files: string[] }} prInfo
 * @returns {{ summary: string, title: string, filesChanged: number, author: string }}
 */
function parsePRMerge(prInfo) {
  if (!prInfo) {
    return { summary: '无 PR 信息', title: '', filesChanged: 0, author: '' };
  }

  return {
    summary: `PR #${prInfo.number}: ${prInfo.title}`,
    title: prInfo.title || '',
    filesChanged: Array.isArray(prInfo.files) ? prInfo.files.length : 0,
    author: prInfo.author || ''
  };
}

/**
 * 解析测试报告 · 从输出中提取通过/失败/总数
 * @param {string} output
 * @returns {{ passed: number, failed: number, total: number, passRate: number }}
 */
function parseTestReport(output) {
  if (!output || typeof output !== 'string') {
    return { passed: 0, failed: 0, total: 0, passRate: 0 };
  }

  const passed = (output.match(/✅/g) || []).length;
  const failed = (output.match(/❌/g) || []).length;
  const total = passed + failed;
  const passRate = total > 0 ? Math.round((passed / total) * 10000) / 10000 : 0;

  return { passed, failed, total, passRate };
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  console.log('📡 Actions Parser · 工作流解析器\n');

  const sampleOutput = '  ✅ test1 passed\n  ✅ test2 passed\n  ❌ test3 failed\n';
  const result = parseWorkflowOutput(sampleOutput);
  console.log(`  解析结果: ${result.tests.passed} passed, ${result.tests.failed} failed`);
}

module.exports = { parseWorkflowOutput, parsePRMerge, parseTestReport };
