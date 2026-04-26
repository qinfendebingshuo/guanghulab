#!/usr/bin/env node
/**
 * GMP-Agent E2E 测试报告生成器
 * 工单: GH-GMP-006 · 录册A02 (5TH-LE-HK-A02)
 *
 * 功能:
 * - 汇总 deploy-verify.sh 和 e2e-test.js 的结果
 * - 输出 JSON 报告 + 人类可读文本报告
 * - 标记: ✅通过 / ❌失败 / ⚠️跳过
 * - 报告格式与 test-runner.js 风格一致
 *
 * 用法:
 *   node report-generator.js [--e2e-report=e2e-report.json] [--deploy-log=deploy.log] [--output=final-report.json]
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── 配置 ───────────────────────────────────────────────

const args = process.argv.slice(2);
const E2E_REPORT_ARG = args.find(a => a.startsWith('--e2e-report='));
const OUTPUT_ARG = args.find(a => a.startsWith('--output='));
const VERBOSE = args.includes('--verbose');

const E2E_REPORT_FILE = E2E_REPORT_ARG
  ? E2E_REPORT_ARG.split('=')[1]
  : path.join(__dirname, 'e2e-report.json');

const OUTPUT_FILE = OUTPUT_ARG
  ? OUTPUT_ARG.split('=')[1]
  : path.join(__dirname, 'final-report.json');

// ─── 报告加载 ──────────────────────────────────────────

/**
 * 安全加载 JSON 文件
 * @param {string} filePath
 * @returns {object|null}
 */
function loadJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      console.warn('[report-generator] 文件不存在: ' + filePath);
      return null;
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[report-generator] 加载失败: ' + filePath + ' -> ' + err.message);
    return null;
  }
}

// ─── 报告合并 ──────────────────────────────────────────

/**
 * 生成最终汇总报告
 * @param {object|null} e2eReport - e2e-test.js 的报告
 * @returns {object} 最终报告
 */
function generateFinalReport(e2eReport) {
  const sections = [];

  // E2E 测试结果
  if (e2eReport) {
    const e2eSection = {
      name: 'E2E Tests',
      source: E2E_REPORT_FILE,
      verdict: e2eReport.verdict || 'UNKNOWN',
      summary: e2eReport.summary || {},
      results: (e2eReport.results || []).map(r => ({
        name: r.name,
        description: r.description,
        status: r.status,
        duration: r.duration,
        error: r.error || null
      }))
    };
    sections.push(e2eSection);
  } else {
    sections.push({
      name: 'E2E Tests',
      source: E2E_REPORT_FILE,
      verdict: 'SKIP',
      summary: { note: '报告文件不存在, 请先运行 e2e-test.js' },
      results: []
    });
  }

  // 汇总
  const totalPass = sections.reduce((sum, s) => sum + (s.summary.pass || 0), 0);
  const totalFail = sections.reduce((sum, s) => sum + (s.summary.fail || 0), 0);
  const totalError = sections.reduce((sum, s) => sum + (s.summary.error || 0), 0);
  const totalSkip = sections.filter(s => s.verdict === 'SKIP').length;
  const totalTests = sections.reduce((sum, s) => sum + (s.summary.total || 0), 0);
  const totalDuration = sections.reduce((sum, s) => sum + (s.summary.totalDuration || 0), 0);

  const allVerdicts = sections.map(s => s.verdict);
  const overallVerdict = allVerdicts.includes('FAIL') ? 'FAIL'
    : allVerdicts.includes('UNKNOWN') ? 'UNKNOWN'
    : allVerdicts.every(v => v === 'SKIP') ? 'SKIP'
    : 'PASS';

  return {
    reportVersion: '1.0.0',
    generator: 'gmp-agent/report-generator · GH-GMP-006 · LC-A02',
    type: 'deployment-verification',
    timestamp: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      deployRoot: process.env.DEPLOY_ROOT || '/opt/guanghu',
      gmpPort: process.env.GMP_PORT || '9800'
    },
    overallSummary: {
      totalTests: totalTests,
      pass: totalPass,
      fail: totalFail,
      error: totalError,
      skip: totalSkip,
      totalDuration: totalDuration
    },
    verdict: overallVerdict,
    sections: sections
  };
}

// ─── 人类可读输出 ──────────────────────────────────────

/**
 * 打印人类可读的最终报告
 * @param {object} report - 最终报告
 */
function printFinalReport(report) {
  console.log('');
  console.log('══════════════════════════════════════════════');
  console.log('  GMP-Agent 部署验证 · 最终报告');
  console.log('══════════════════════════════════════════════');
  console.log('  时间     : ' + report.timestamp);
  console.log('  Node     : ' + report.environment.node);
  console.log('  部署根   : ' + report.environment.deployRoot);
  console.log('  GMP端口  : ' + report.environment.gmpPort);
  console.log('');

  for (const section of report.sections) {
    const icon = section.verdict === 'PASS' ? '✅'
      : section.verdict === 'FAIL' ? '❌'
      : section.verdict === 'SKIP' ? '⚠️'
      : '❓';
    console.log('  ' + icon + ' ' + section.name + ' — ' + section.verdict);

    if (section.results && section.results.length > 0) {
      for (const r of section.results) {
        const rIcon = r.status === 'pass' ? '✅'
          : r.status === 'fail' ? '❌'
          : r.status === 'skip' ? '⚠️'
          : '❓';
        console.log('     ' + rIcon + ' ' + (r.description || r.name) + ' (' + r.duration + 'ms)');
        if (r.error) {
          console.log('        错误: ' + r.error);
        }
      }
    }
    console.log('');
  }

  console.log('──────────────────────────────────────────────');
  console.log('  总测试数 : ' + report.overallSummary.totalTests);
  console.log('  ✅ 通过  : ' + report.overallSummary.pass);
  console.log('  ❌ 失败  : ' + report.overallSummary.fail);
  console.log('  ⚠️  跳过 : ' + report.overallSummary.skip);
  console.log('  耗时     : ' + report.overallSummary.totalDuration + 'ms');
  console.log('  最终判定 : ' + report.verdict);
  console.log('══════════════════════════════════════════════');
  console.log('');
}

// ─── 主流程 ──────────────────────────────────────────

function main() {
  console.log('[report-generator] 加载测试报告...');

  // 加载 e2e 报告
  const e2eReport = loadJSON(E2E_REPORT_FILE);

  // 生成最终报告
  const finalReport = generateFinalReport(e2eReport);

  // 保存 JSON 报告
  try {
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalReport, null, 2), 'utf-8');
    console.log('[report-generator] JSON 报告已保存: ' + OUTPUT_FILE);
  } catch (err) {
    console.error('[report-generator] 保存失败: ' + err.message);
  }

  // 打印人类可读报告
  printFinalReport(finalReport);

  // 退出码
  process.exit(finalReport.verdict === 'PASS' ? 0 : 1);
}

// ─── 导出 + CLI入口 ──────────────────────────────────
module.exports = { generateFinalReport, printFinalReport, loadJSON };

if (require.main === module) {
  main();
}
