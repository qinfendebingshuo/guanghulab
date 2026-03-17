// scripts/skyeye/skyeye-main.js
// 天眼·主编排器
//
// 本地运行入口：node scripts/skyeye/skyeye-main.js
// 在 CI 中各模块由 workflow steps 分别调用
// 本地调试时可通过此脚本串联执行所有模块

'use strict';

const { execSync } = require('child_process');
const path = require('path');
const fs   = require('fs');

const SKYEYE_DIR = '/tmp/skyeye';
const SCRIPTS_DIR = path.resolve(__dirname);

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now = new Date();
const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString()
  .replace('T', ' ').slice(0, 19) + '+08:00';

// ━━━ 执行模块 ━━━
function runModule(scriptName, outputFile) {
  const scriptPath = path.join(SCRIPTS_DIR, scriptName);
  console.log(`\n🔄 运行: ${scriptName}`);
  console.log('─'.repeat(50));

  try {
    const output = execSync(`node "${scriptPath}"`, {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env },
      encoding: 'utf8',
      timeout: 60000
    });

    // Save output to file
    if (outputFile) {
      const outputPath = path.join(SKYEYE_DIR, outputFile);
      fs.writeFileSync(outputPath, output);
      console.log(`💾 输出保存到: ${outputFile}`);
    }

    return true;
  } catch (e) {
    console.error(`❌ ${scriptName} 执行失败: ${e.message}`);
    if (e.stdout) console.log(e.stdout);
    return false;
  }
}

// ━━━ 主流程 ━━━
function main() {
  console.log('');
  console.log('🦅 ═══════════════════════════════════════════');
  console.log('   天眼系统 · 全局俯瞰 + 自动诊断 + 修复驱动');
  console.log(`   时间: ${bjTime}`);
  console.log('═══════════════════════════════════════════════');

  // 确保输出目录
  fs.mkdirSync(SKYEYE_DIR, { recursive: true });

  const results = {};

  // Phase 1.6: 拉取 Agent 集群公告板
  console.log('\n📡 Phase 1.6 · 拉取 Agent 集群公告板');
  results.bulletin = runModule('bulletin-board.js', 'bulletin-board.json');

  // Phase 2: 全局扫描
  console.log('\n🦅 Phase 2 · 全局扫描');
  results.workflows = runModule('scan-workflows.js', 'workflow-health.json');
  results.structure = runModule('scan-structure.js', 'structure-health.json');
  results.brain     = runModule('scan-brain-health.js', 'brain-health.json');
  results.bridges   = runModule('scan-external-bridges.js', 'bridge-health.json');

  // Phase 3: 诊断
  console.log('\n🔬 Phase 3 · 诊断');
  results.diagnosis = runModule('diagnose.js', 'diagnosis.json');

  // Phase 3.5: ASOP 审批（新增）
  console.log('\n🔄 Phase 3.5 · ASOP 自优化审批');
  results.asop_review = runModule('asop-reviewer.js', 'asop-review.json');

  // Phase 4: 修复
  console.log('\n🔧 Phase 4 · 修复 Agent');
  results.repair = runModule('repair-agent.js', 'repair-result.json');

  // Phase 4.5: ASOP 执行已批准的优化
  console.log('\n🔧 Phase 4.5 · ASOP 执行已批准优化');
  results.asop_execute = runModule('asop-executor.js', 'asop-execute.json');

  // Phase 4.7: ASOP 验证之前执行的优化效果
  console.log('\n🔍 Phase 4.7 · ASOP 验证优化效果');
  results.asop_verify = runModule('asop-verifier.js', 'asop-verify.json');

  // Phase 6: 报告
  console.log('\n📋 Phase 6 · 全局健康报告');
  results.report = runModule('report-generator.js', null);

  // 汇总
  console.log('\n═══════════════════════════════════════════');
  console.log('🦅 天眼运行完毕');
  const passed = Object.values(results).filter(r => r).length;
  const total = Object.keys(results).length;
  console.log(`   模块: ${passed}/${total} 成功`);
  console.log('═══════════════════════════════════════════\n');
}

main();
