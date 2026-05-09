#!/usr/bin/env node
/**
 * ════════════════════════════════════════════════════════════════
 * 国内 2C2G 域名机隔离守卫 · check-server-isolation.js
 * Sovereign: TCS-0002∞ · 国作登字-2026-A-00037559
 * 守护: 铸渊 · ICE-GL-ZY001
 * ════════════════════════════════════════════════════════════════
 *
 * 背景 (cc-004 · 团队技术能力近 0):
 *   广州 2C2G (GH-CVM-DOMAIN-PROD-01) 是冰朔挂 guanghulab.com 的
 *   唯一对外服务器, 必须单线运行. 仓库里几十个 deploy-* workflow
 *   有可能在 push 时把代码推回来污染这台机器.
 *
 *   本脚本扫描 .github/workflows/ 下所有 .yml, 找引用了
 *   ZY_CN_SERVER_HOST / USER / KEY / PATH / PORT 的, 必须出现在
 *   cn-isolation-allowlist.json 里, 否则 CI 红灯.
 *
 * 用法:
 *   node scripts/preflight/check-server-isolation.js
 *
 * 退出码:
 *   0 = 全部合法
 *   1 = 发现未授权引用 (CI 阻断)
 *   2 = 入参/文件错误
 *
 * 关键设计:
 *   - 只扫 .github/workflows/ 根目录, 不进 .archive/
 *   - 中文输出 (cc-004: 给 Awen / 冰朔看的, 不是给开发者)
 *   - 报告"哪个文件 / 哪一行 / 怎么修"
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const WORKFLOWS_DIR = path.join(ROOT, '.github', 'workflows');
const ALLOWLIST_PATH = path.join(__dirname, 'cn-isolation-allowlist.json');

// 受保护的 secret 名称 (任何引用都需要白名单授权)
const CN_SECRETS = [
  'ZY_CN_SERVER_HOST',
  'ZY_CN_SERVER_USER',
  'ZY_CN_SERVER_KEY',
  'ZY_CN_SERVER_PATH',
  'ZY_CN_SERVER_PORT',
  'ZY_CN_SSH_PORT',
];
const AUTODL_SECRETS = [
  'ZY_AUTODL_HOST',
  'ZY_AUTODL_PORT',
  'ZY_AUTODL_USER',
  'ZY_AUTODL_PASS',
];

// 匹配 ${{ secrets.NAME }} 或 secrets.NAME 引用
function makePattern(names) {
  // 守卫: secret 名必须只含 A-Z 0-9 _, 否则正则会被注入. 出现非法名字直接 throw.
  for (const n of names) {
    if (!/^[A-Z0-9_]+$/.test(n)) {
      throw new Error('[隔离守卫] 非法 secret 名 (只允许 A-Z0-9_): ' + n);
    }
  }
  return new RegExp(`\\bsecrets\\.(${names.join('|')})\\b`);
}
const CN_PATTERN = makePattern(CN_SECRETS);
const AUTODL_PATTERN = makePattern(AUTODL_SECRETS);

function readAllowlist() {
  try {
    return JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  } catch (err) {
    console.error('[隔离守卫] ❌ 读不到白名单文件: ' + ALLOWLIST_PATH);
    console.error('         ' + err.message);
    process.exit(2);
  }
}

function listWorkflowFiles() {
  if (!fs.existsSync(WORKFLOWS_DIR)) return [];
  return fs
    .readdirSync(WORKFLOWS_DIR, { withFileTypes: true })
    .filter((d) => d.isFile() && /\.ya?ml$/.test(d.name))
    .map((d) => d.name);
}

function scanFile(filename) {
  const full = path.join(WORKFLOWS_DIR, filename);
  const content = fs.readFileSync(full, 'utf8');
  const lines = content.split('\n');

  const cnHits = [];
  const autodlHits = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (CN_PATTERN.test(line)) {
      const m = line.match(CN_PATTERN);
      cnHits.push({ line: i + 1, secret: m[1], snippet: line.trim().slice(0, 120) });
    }
    if (AUTODL_PATTERN.test(line)) {
      const m = line.match(AUTODL_PATTERN);
      autodlHits.push({ line: i + 1, secret: m[1], snippet: line.trim().slice(0, 120) });
    }
  }

  return { cnHits, autodlHits };
}

function main() {
  const allowlist = readAllowlist();
  const cnAllowed = new Set(
    (allowlist.cn_server_workflows || []).map((w) => w.name)
  );
  const autodlAllowed = new Set(
    (allowlist.autodl_workflows || []).map((w) => w.name)
  );

  const files = listWorkflowFiles();

  const line = '═'.repeat(64);
  console.log(line);
  console.log('  国内域名机隔离守卫 · 扫描 .github/workflows/');
  console.log('  保护对象: GH-CVM-DOMAIN-PROD-01 (广州 2C2G · 单线运行)');
  console.log('  扫描文件数: ' + files.length);
  console.log(line);

  const violations = [];
  const reportCn = [];
  const reportAutodl = [];

  for (const f of files) {
    const { cnHits, autodlHits } = scanFile(f);

    if (cnHits.length > 0) {
      const allowed = cnAllowed.has(f);
      reportCn.push({ file: f, hits: cnHits, allowed });
      if (!allowed) {
        violations.push({
          type: 'cn',
          file: f,
          hits: cnHits,
        });
      }
    }
    if (autodlHits.length > 0) {
      const allowed = autodlAllowed.has(f);
      reportAutodl.push({ file: f, hits: autodlHits, allowed });
      if (!allowed) {
        violations.push({
          type: 'autodl',
          file: f,
          hits: autodlHits,
        });
      }
    }
  }

  // ── 报告 CN 引用 ──
  console.log('');
  console.log('§ 引用 ZY_CN_SERVER_* 的工作流 (' + reportCn.length + ' 个)');
  if (reportCn.length === 0) {
    console.log('  (无 · 干净)');
  } else {
    for (const r of reportCn) {
      const tag = r.allowed ? '✅ 已授权' : '❌ 未授权';
      console.log('  ' + tag + '  ' + r.file);
      for (const h of r.hits) {
        console.log('       L' + h.line + '  ' + h.secret);
      }
    }
  }

  // ── 报告 AutoDL 引用 ──
  console.log('');
  console.log('§ 引用 ZY_AUTODL_* 的工作流 (' + reportAutodl.length + ' 个)');
  if (reportAutodl.length === 0) {
    console.log('  (无 · PR-3 之前应该是空的)');
  } else {
    for (const r of reportAutodl) {
      const tag = r.allowed ? '✅ 已授权' : '❌ 未授权';
      console.log('  ' + tag + '  ' + r.file);
      for (const h of r.hits) {
        console.log('       L' + h.line + '  ' + h.secret);
      }
    }
  }

  // ── 结论 ──
  console.log('');
  console.log(line);
  if (violations.length === 0) {
    console.log('  [OK] 隔离守卫通过 · 广州 2C2G 单线运行已守住');
    console.log(line);
    process.exit(0);
  } else {
    console.log('  [STOP] 发现 ' + violations.length + ' 处未授权引用');
    console.log('');
    console.log('  下一步:');
    console.log('    1. 如果这个 workflow 应该被授权, 把它加到');
    console.log('       scripts/preflight/cn-isolation-allowlist.json');
    console.log('       的 cn_server_workflows / autodl_workflows 列表里');
    console.log('       并在 reason 字段写清楚为什么');
    console.log('');
    console.log('    2. 如果这个 workflow 不应该再用了, 移到');
    console.log('       .github/workflows/.archive/  (git mv)');
    console.log('       归档不是删除, 以后能复活');
    console.log('');
    console.log('  原因 (cc-004): 团队技术能力近 0, 任何 push 误触发都');
    console.log('  可能把这台 2C2G 单线机器搞污染. 守卫必须在 PR 合之前');
    console.log('  红灯, 不能等机器爆了再翻英文 stacktrace.');
    console.log(line);
    process.exit(1);
  }
}

main();
