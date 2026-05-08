#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * 启动前最小密钥校验 · check-secrets.js
 * Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * 给非技术触发者(冰朔/Awen)用. 在 workflow 跑实际部署之前先跑一遍
 * 这个脚本, 它会读 secrets-manifest.json, 对照当前注入到环境变量
 * 里的 secrets, 输出『中文人话 + 是否够 + 不够还差什么』的清单.
 *
 * 用法:
 *   node scripts/preflight/check-secrets.js \
 *     --workflow lighthouse-cn-deploy \
 *     --stage bootstrap \
 *     --target main
 *
 * 退出码:
 *   0  全部 required 都满足, 可以继续
 *   1  有 required 缺失, 必须先补完才能继续 (workflow 应当中止)
 *   2  manifest / 入参出错
 *
 * 安全: 只校验 secret 是否『非空』. 永远不打印 secret 的值, 只打印
 *      名称和是否设置. 真值不会进 stdout / stderr.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ─── CLI 解析 ──────────────────────────────────────────────────
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[k] = v;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const WORKFLOW = args.workflow || 'lighthouse-cn-deploy';
const STAGE = args.stage || 'bootstrap';
const TARGET = args.target || 'main';
const FAIL_FAST = args['fail-fast'] !== 'false'; // 默认 fail-fast

const MANIFEST_PATH = path.resolve(__dirname, 'secrets-manifest.json');

// ─── 读 manifest ──────────────────────────────────────────────
let manifest;
try {
  manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
} catch (err) {
  console.error(`[预检] ❌ 读不到 manifest: ${MANIFEST_PATH}`);
  console.error(`         ${err.message}`);
  process.exit(2);
}

const wf = manifest.workflows && manifest.workflows[WORKFLOW];
if (!wf) {
  console.error(`[预检] ❌ manifest 里没有 workflow: ${WORKFLOW}`);
  console.error(`         可选: ${Object.keys(manifest.workflows || {}).join(', ')}`);
  process.exit(2);
}

// ─── 分类校验 ─────────────────────────────────────────────────
const env = process.env;

const buckets = {
  ok: [],            // 已配置, OK
  missing_hard: [],  // required 但缺, 必须立即补
  missing_stage: [], // 当前 stage 必须补
  missing_target: [],// 当前 target 必须补
  missing_soft: [],  // optional 缺失, 仅提示
  warned: [],        // 强校验失败 (比如密码太短)
};

function classify(secret) {
  const v = env[secret.name];
  const present = typeof v === 'string' && v.length > 0;

  // 强校验
  if (present && secret['强校验']) {
    if (secret['强校验'] === 'length>=24' && v.length < 24) {
      buckets.warned.push({
        ...secret,
        warn: `值长度 ${v.length} < 24 (强烈建议 ≥24 位)`,
      });
      return;
    }
  }

  switch (secret.level) {
    case 'required':
      if (present) buckets.ok.push(secret);
      else buckets.missing_hard.push(secret);
      break;
    case 'required_on_stage':
      if ((secret.stages || []).includes(STAGE)) {
        if (present) buckets.ok.push(secret);
        else buckets.missing_stage.push(secret);
      } else {
        if (present) buckets.ok.push(secret);
      }
      break;
    case 'required_on_target':
      if ((secret.targets || []).includes(TARGET)) {
        if (present) buckets.ok.push(secret);
        else buckets.missing_target.push(secret);
      } else {
        if (present) buckets.ok.push(secret);
      }
      break;
    case 'optional':
    default:
      if (present) buckets.ok.push(secret);
      else buckets.missing_soft.push(secret);
      break;
  }
}

(wf.secrets || []).forEach(classify);

// ─── 输出报告 ─────────────────────────────────────────────────
const line = '═'.repeat(64);
console.log(line);
console.log(`  启动前密钥预检 · workflow=${WORKFLOW}`);
console.log(`  stage=${STAGE}  target=${TARGET}`);
console.log(`  manifest=${path.relative(process.cwd(), MANIFEST_PATH)}`);
console.log(line);

function printSecret(s, prefix) {
  const tail = s['用途'] ? `  · ${s['用途']}` : '';
  console.log(`  ${prefix} ${s.name}${tail}`);
  if (s['如何配置'] && (prefix.includes('❌') || prefix.includes('⚠️'))) {
    console.log(`     ↳ 怎么配: ${s['如何配置']}`);
  }
  if (s.where && prefix.includes('❌')) {
    console.log(`     ↳ 哪里取: ${s.where}`);
  }
  if (s.default && prefix.includes('⚠️') && !s['如何配置']) {
    console.log(`     ↳ 没配会用默认值: ${s.default}`);
  }
}

console.log('');
console.log(`§ 已配置 (${buckets.ok.length})`);
buckets.ok.forEach((s) => printSecret(s, '✅'));

if (buckets.missing_hard.length) {
  console.log('');
  console.log(`§ 必须补 · 缺这些直接停车 (${buckets.missing_hard.length})`);
  buckets.missing_hard.forEach((s) => printSecret(s, '❌ 必须'));
}

if (buckets.missing_stage.length) {
  console.log('');
  console.log(`§ 当前阶段(${STAGE})必须补 (${buckets.missing_stage.length})`);
  buckets.missing_stage.forEach((s) => printSecret(s, '❌ 阶段必须'));
}

if (buckets.missing_target.length) {
  console.log('');
  console.log(`§ 当前目标(${TARGET})必须补 (${buckets.missing_target.length})`);
  buckets.missing_target.forEach((s) => printSecret(s, '❌ 目标必须'));
}

if (buckets.warned.length) {
  console.log('');
  console.log(`§ 强校验告警 (${buckets.warned.length})`);
  buckets.warned.forEach((s) => {
    console.log(`  ⚠️ ${s.name}  · ${s.warn}`);
  });
}

if (buckets.missing_soft.length) {
  console.log('');
  console.log(`§ 可以缓 · 不影响主流程 (${buckets.missing_soft.length})`);
  buckets.missing_soft.forEach((s) => printSecret(s, '⚠️ 可缓'));
}

// ─── 结论 ─────────────────────────────────────────────────────
const hardMiss =
  buckets.missing_hard.length +
  buckets.missing_stage.length +
  buckets.missing_target.length;

console.log('');
console.log(line);
if (hardMiss === 0) {
  console.log(`  [OK] 预检通过 · 已配置 ${buckets.ok.length} 个密钥, 可继续部署`);
  if (buckets.warned.length) {
    console.log(`       (${buckets.warned.length} 个告警, 不阻塞)`);
  }
  if (buckets.missing_soft.length) {
    console.log(`       (${buckets.missing_soft.length} 个可选项缺, 走默认/降级)`);
  }
  console.log(line);
  process.exit(0);
} else {
  console.log(`  [STOP] 预检不通过 · 还差 ${hardMiss} 个必须密钥`);
  console.log('');
  console.log('  下一步给 Awen / 冰朔:');
  console.log('    1. 打开 GitHub 仓库 → Settings → Secrets and variables → Actions');
  console.log('    2. 把上面 ❌ 标的密钥逐个 New repository secret 填进去');
  console.log('    3. 回到 Actions → 重新 Run workflow');
  console.log('  系统不会继续往下跑 — 不会误触发, 不会改坏服务器.');
  console.log(line);
  if (FAIL_FAST) process.exit(1);
  process.exit(0);
}
