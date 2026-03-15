/**
 * openclaw/verify-loop — 唤醒闭环验证
 *
 * AGE OS v1.0 Phase 1 · Step 4
 *
 * 验证完整闭环：
 *   定时触发 → OpenClaw 唤醒铸渊大脑 → 大脑读取巡检结果 →
 *   大脑判断 → 大脑驱动修复/写公告 → 大脑休眠
 *
 * 调用方式：
 *   node openclaw/verify-loop                # 完整验证（dry-run 模式）
 *   node openclaw/verify-loop --live         # 实际调用 LLM API 验证
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ══════════════════════════════════════════════════════════
// 验证检查项
// ══════════════════════════════════════════════════════════

const CHECKS = [
  {
    id: 'SOUL',
    name: 'Soul 文件存在',
    check: () => {
      const soulPath = path.join(__dirname, 'soul/zhuyuan.json');
      if (!fs.existsSync(soulPath)) return { pass: false, detail: 'Soul 文件不存在' };
      const soul = JSON.parse(fs.readFileSync(soulPath, 'utf-8'));
      if (!soul.persona_id || !soul.name) return { pass: false, detail: 'Soul 文件缺少必要字段' };
      return { pass: true, detail: `${soul.name} (${soul.persona_id})` };
    },
  },
  {
    id: 'BRAIN_WAKE',
    name: '核心大脑唤醒模块',
    check: () => {
      const modulePath = path.join(ROOT, 'core/brain-wake/index.js');
      if (!fs.existsSync(modulePath)) return { pass: false, detail: '模块不存在' };
      const mod = require(modulePath);
      if (typeof mod.wake !== 'function') return { pass: false, detail: '缺少 wake 函数' };
      if (typeof mod.detectAvailableBackends !== 'function') return { pass: false, detail: '缺少 detectAvailableBackends' };
      return { pass: true, detail: '模块完整' };
    },
  },
  {
    id: 'MODEL_ROUTER',
    name: '模型路由连接器',
    check: () => {
      const modulePath = path.join(ROOT, 'connectors/model-router/index.js');
      if (!fs.existsSync(modulePath)) return { pass: false, detail: '模块不存在' };
      const mod = require(modulePath);
      if (typeof mod.detectCloudBackends !== 'function') return { pass: false, detail: '缺少 detectCloudBackends' };
      return { pass: true, detail: '模块完整' };
    },
  },
  {
    id: 'INSPECT',
    name: '全面排查脚本',
    check: () => {
      const scriptPath = path.join(ROOT, 'scripts/zhuyuan-full-inspection.js');
      if (!fs.existsSync(scriptPath)) return { pass: false, detail: '脚本不存在' };
      return { pass: true, detail: '脚本存在' };
    },
  },
  {
    id: 'CONTEXT',
    name: '上下文加载器',
    check: () => {
      const modulePath = path.join(ROOT, 'core/context-loader/index.js');
      if (!fs.existsSync(modulePath)) return { pass: false, detail: '模块不存在' };
      return { pass: true, detail: '模块存在' };
    },
  },
  {
    id: 'SYSTEM_CHECK',
    name: '系统自检模块',
    check: () => {
      const modulePath = path.join(ROOT, 'core/system-check/index.js');
      if (!fs.existsSync(modulePath)) return { pass: false, detail: '模块不存在' };
      return { pass: true, detail: '模块存在' };
    },
  },
  {
    id: 'BRAIN_FILES',
    name: '大脑文件完整性',
    check: () => {
      const required = ['master-brain.md', 'system-health.json', 'repo-map.json'];
      const missing = [];
      for (const file of required) {
        if (!fs.existsSync(path.join(ROOT, 'brain', file))) {
          missing.push(file);
        }
      }
      if (missing.length > 0) return { pass: false, detail: `缺少: ${missing.join(', ')}` };
      return { pass: true, detail: `${required.length} 个核心文件完整` };
    },
  },
  {
    id: 'WORKFLOW',
    name: 'OpenClaw 工作流',
    check: () => {
      const wfPath = path.join(ROOT, '.github/workflows/openclaw-wake-loop.yml');
      if (!fs.existsSync(wfPath)) return { pass: false, detail: '工作流文件不存在' };
      return { pass: true, detail: '工作流已配置' };
    },
  },
  {
    id: 'OPENCLAW_MODULE',
    name: 'OpenClaw 主模块',
    check: () => {
      const modulePath = path.join(__dirname, 'index.js');
      if (!fs.existsSync(modulePath)) return { pass: false, detail: '主模块不存在' };
      const mod = require(modulePath);
      if (typeof mod.runLoop !== 'function') return { pass: false, detail: '缺少 runLoop 函数' };
      if (typeof mod.loadSoul !== 'function') return { pass: false, detail: '缺少 loadSoul 函数' };
      return { pass: true, detail: '模块完整' };
    },
  },
];

// ══════════════════════════════════════════════════════════
// 静态验证（检查所有组件是否就绪）
// ══════════════════════════════════════════════════════════

function verifyStatic() {
  console.log('');
  console.log('🔍 ═══════════════════════════════════════════');
  console.log('   OpenClaw · 唤醒闭环验证 · 静态检查');
  console.log('═══════════════════════════════════════════════');
  console.log('');

  const results = [];
  let passCount = 0;

  for (const check of CHECKS) {
    try {
      const result = check.check();
      results.push({ id: check.id, name: check.name, ...result });
      const icon = result.pass ? '✅' : '❌';
      console.log(`  ${icon} ${check.name}: ${result.detail}`);
      if (result.pass) passCount++;
    } catch (err) {
      results.push({ id: check.id, name: check.name, pass: false, detail: err.message });
      console.log(`  ❌ ${check.name}: ${err.message}`);
    }
  }

  const total = CHECKS.length;
  const allPass = passCount === total;

  console.log('');
  console.log(`📊 验证结果: ${passCount}/${total} 通过`);
  console.log(`${allPass ? '✅ 所有组件就绪' : '⚠️  部分组件未就绪'}`);

  return { pass: allPass, total, passed: passCount, results };
}

// ══════════════════════════════════════════════════════════
// 闭环运行验证（Dry Run / Live）
// ══════════════════════════════════════════════════════════

async function verifyLoop(live) {
  console.log('');
  console.log('🔄 ═══════════════════════════════════════════');
  console.log(`   OpenClaw · 唤醒闭环验证 · ${live ? '实际运行' : 'Dry Run'}`);
  console.log('═══════════════════════════════════════════════');

  const openclaw = require(path.join(__dirname, 'index.js'));

  try {
    const result = await openclaw.runLoop({
      dryRun: !live,
      persona: 'zhuyuan',
      task: '闭环验证',
    });

    console.log('');
    if (result.success !== false) {
      console.log('✅ 唤醒闭环验证通过');
      console.log(`   完成阶段: ${(result.phases || []).join(' → ')}`);
    } else {
      console.log('❌ 唤醒闭环验证失败');
      console.log(`   失败阶段: ${result.phase || 'unknown'}`);
      console.log(`   错误: ${result.error || 'unknown'}`);
    }

    return result;
  } catch (err) {
    console.log(`[VERIFY] ❌ 闭环验证异常: ${err.message}`);
    return { success: false, error: err.message };
  }
}

// ══════════════════════════════════════════════════════════
// 综合验证
// ══════════════════════════════════════════════════════════

async function verify(options = {}) {
  const timestamp = new Date().toISOString();

  console.log('');
  console.log('🌅 ═══════════════════════════════════════════');
  console.log('   AGE OS v1.0 · Phase 1 · Step 4');
  console.log('   唤醒闭环验证');
  console.log(`   时间: ${timestamp}`);
  console.log('═══════════════════════════════════════════════');

  // Step 1: 静态验证
  const staticResult = verifyStatic();

  // Step 2: 闭环运行验证
  const loopResult = await verifyLoop(options.live);

  // 综合结果
  const allPass = staticResult.pass && loopResult.success !== false;

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`📊 综合验证结果: ${allPass ? '✅ 通过' : '❌ 未通过'}`);
  console.log(`   静态检查: ${staticResult.pass ? '✅' : '❌'} (${staticResult.passed}/${staticResult.total})`);
  console.log(`   闭环运行: ${loopResult.success !== false ? '✅' : '❌'}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  // 输出到 GITHUB_OUTPUT
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `verify_pass=${allPass}\n`);
    fs.appendFileSync(outputFile, `static_pass=${staticResult.pass}\n`);
    fs.appendFileSync(outputFile, `loop_pass=${loopResult.success !== false}\n`);
  }

  return { pass: allPass, static: staticResult, loop: loopResult, timestamp };
}

// ══════════════════════════════════════════════════════════
// 模块导出
// ══════════════════════════════════════════════════════════

module.exports = { verify, verifyStatic, verifyLoop };

// ══════════════════════════════════════════════════════════
// CLI 入口
// ══════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  const live = args.includes('--live');

  verify({ live }).then(result => {
    if (!result.pass) {
      process.exit(1);
    }
  }).catch(err => {
    console.error('[VERIFY] 💥 致命错误:', err.message);
    process.exit(1);
  });
}
