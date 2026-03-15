/**
 * 铸渊 · 每日巡检 Agent
 *
 * 目的：每天自动巡检仓库健康状况，检查当天遗漏的任务，
 * 生成巡检报告，并自动触发修复流程。
 *
 * 检查项：
 *   1. 公告栏是否已更新（README 中日期是否为今天）
 *   2. 每日自检是否执行（memory.json 中 daily_selfcheck 日期）
 *   3. PSP 巡检是否执行
 *   4. 大脑文件完整性
 *   5. CI/CD 最近状态
 *   6. 关键模块 README 是否存在
 *
 * 输出：
 *   - 控制台巡检报告
 *   - 更新 .github/brain/memory.json 写入巡检结果
 *   - 设置 GitHub Actions 输出变量供后续步骤使用
 *
 * 环境变量：
 *   GITHUB_TOKEN       - GitHub API token
 *   GITHUB_REPOSITORY  - owner/repo
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const MEMORY_PATH = path.join(ROOT, '.github', 'brain', 'memory.json');
const PERSONA_MEMORY_PATH = path.join(ROOT, '.github', 'persona-brain', 'memory.json');
const README_PATH = path.join(ROOT, 'README.md');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.GITHUB_REPOSITORY || 'qinfendebingshuo/guanghulab';

const now = new Date();
const todayStr = now.toISOString().split('T')[0];
const todayShort = (() => {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(now);
  const get = (type) => (parts.find(p => p.type === type) || {}).value || '';
  return `${get('month')}-${get('day')}`;
})();

/* ── 工具函数 ────────────────────────────── */

function loadJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function saveJson(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function githubApi(endpoint) {
  return new Promise((resolve, reject) => {
    if (!GITHUB_TOKEN) {
      resolve(null);
      return;
    }
    const url = `https://api.github.com/repos/${REPO}${endpoint}`;
    const options = {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'zhuyuan-agent',
      },
      timeout: 15000,
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(null); }
      });
    }).on('error', () => resolve(null))
      .on('timeout', function () { this.destroy(); resolve(null); });
  });
}

/* ── 巡检项 ──────────────────────────────── */

const checks = [];
const issues = [];
const actions = [];

// CHK-1: 公告栏是否有今天的条目
function checkBulletin() {
  console.log('🔍 CHK-1: 检查公告栏更新...');
  const readme = fs.existsSync(README_PATH) ? fs.readFileSync(README_PATH, 'utf8') : '';
  const hasTodayEntry = readme.includes(todayShort);

  if (hasTodayEntry) {
    checks.push({ id: 'CHK-1', name: '公告栏更新', status: '✅', detail: `今日 (${todayShort}) 有更新条目` });
    console.log(`  ✅ 公告栏包含今日 (${todayShort}) 条目`);
  } else {
    checks.push({ id: 'CHK-1', name: '公告栏更新', status: '❌', detail: `今日 (${todayShort}) 无更新条目` });
    issues.push('公告栏今日未更新');
    actions.push('trigger_bulletin_update');
    console.log(`  ❌ 公告栏缺少今日 (${todayShort}) 条目`);
  }
}

// CHK-2: 每日自检是否执行
function checkDailySelfcheck() {
  console.log('🔍 CHK-2: 检查每日自检...');
  const memory = loadJson(PERSONA_MEMORY_PATH);
  const lastRun = memory?.daily_selfcheck?.last_run || '';
  const ranToday = lastRun.startsWith(todayStr);

  if (ranToday) {
    checks.push({ id: 'CHK-2', name: '每日自检', status: '✅', detail: `今日已执行 (${lastRun})` });
    console.log(`  ✅ 每日自检已执行 (${lastRun})`);
  } else {
    checks.push({ id: 'CHK-2', name: '每日自检', status: '⚠️', detail: `今日未执行，上次: ${lastRun || '无记录'}` });
    issues.push('每日自检今日未执行');
    actions.push('trigger_selfcheck');
    console.log(`  ⚠️ 每日自检今日未执行，上次: ${lastRun || '无记录'}`);
  }
}

// CHK-3: 大脑文件完整性
function checkBrainIntegrity() {
  console.log('🔍 CHK-3: 检查大脑文件完整性...');
  const requiredFiles = [
    '.github/brain/memory.json',
    '.github/persona-brain/memory.json',
  ];
  const missing = [];

  for (const f of requiredFiles) {
    const fullPath = path.join(ROOT, f);
    if (!fs.existsSync(fullPath)) {
      missing.push(f);
    }
  }

  if (missing.length === 0) {
    checks.push({ id: 'CHK-3', name: '大脑文件完整性', status: '✅', detail: '所有核心文件完整' });
    console.log('  ✅ 所有核心文件完整');
  } else {
    checks.push({ id: 'CHK-3', name: '大脑文件完整性', status: '❌', detail: `缺失: ${missing.join(', ')}` });
    issues.push(`大脑文件缺失: ${missing.join(', ')}`);
    console.log(`  ❌ 大脑文件缺失: ${missing.join(', ')}`);
  }
}

// CHK-4: CI 最近状态
async function checkCiStatus() {
  console.log('🔍 CHK-4: 检查 CI 状态...');
  const runs = await githubApi('/actions/runs?per_page=5&status=completed');

  if (!runs || !runs.workflow_runs) {
    checks.push({ id: 'CHK-4', name: 'CI 状态', status: '⚠️', detail: '无法获取 CI 状态' });
    console.log('  ⚠️ 无法获取 CI 状态');
    return;
  }

  const recent = runs.workflow_runs;
  const failures = recent.filter(r => r.conclusion === 'failure');

  if (failures.length === 0) {
    checks.push({ id: 'CHK-4', name: 'CI 状态', status: '✅', detail: `最近 ${recent.length} 次运行全部成功` });
    console.log(`  ✅ 最近 ${recent.length} 次运行全部成功`);
  } else {
    const failNames = failures.map(f => f.name).join(', ');
    checks.push({ id: 'CHK-4', name: 'CI 状态', status: '⚠️', detail: `${failures.length} 个失败: ${failNames}` });
    issues.push(`CI 有 ${failures.length} 个失败工作流`);
    console.log(`  ⚠️ CI 有 ${failures.length} 个失败: ${failNames}`);
  }
}

// CHK-5: 关键模块 README 检查
function checkModuleReadmes() {
  console.log('🔍 CHK-5: 检查关键模块 README...');
  const modules = [
    'persona-studio', 'backend', 'backend-integration',
    'status-board', 'dingtalk-bot', 'notification',
  ];
  const missingReadme = [];

  for (const mod of modules) {
    const modDir = path.join(ROOT, mod);
    if (!fs.existsSync(modDir)) continue;
    const readmePath = path.join(modDir, 'README.md');
    if (!fs.existsSync(readmePath)) {
      missingReadme.push(mod);
    }
  }

  if (missingReadme.length === 0) {
    checks.push({ id: 'CHK-5', name: '模块 README', status: '✅', detail: '所有关键模块有 README' });
    console.log('  ✅ 所有关键模块有 README');
  } else {
    checks.push({ id: 'CHK-5', name: '模块 README', status: '⚠️', detail: `缺失 README: ${missingReadme.join(', ')}` });
    console.log(`  ⚠️ 缺失 README: ${missingReadme.join(', ')}`);
  }
}

// CHK-6: 公告栏更新工作流最近是否有失败
async function checkBulletinWorkflow() {
  console.log('🔍 CHK-6: 检查公告栏更新工作流...');
  const runs = await githubApi('/actions/workflows/update-readme-bulletin.yml/runs?per_page=3&status=completed');

  if (!runs || !runs.workflow_runs) {
    checks.push({ id: 'CHK-6', name: '公告栏工作流', status: '⚠️', detail: '无法获取工作流状态' });
    console.log('  ⚠️ 无法获取工作流状态');
    return;
  }

  const latest = runs.workflow_runs[0];
  if (!latest) {
    checks.push({ id: 'CHK-6', name: '公告栏工作流', status: '⚠️', detail: '无运行记录' });
    return;
  }

  if (latest.conclusion === 'success') {
    checks.push({ id: 'CHK-6', name: '公告栏工作流', status: '✅', detail: `最近一次成功 (${latest.created_at})` });
    console.log(`  ✅ 最近一次成功 (${latest.created_at})`);
  } else {
    checks.push({ id: 'CHK-6', name: '公告栏工作流', status: '❌', detail: `最近一次 ${latest.conclusion} (${latest.created_at})` });
    issues.push(`公告栏工作流最近结论: ${latest.conclusion}`);
    actions.push('trigger_bulletin_update');
    console.log(`  ❌ 最近一次 ${latest.conclusion} (${latest.created_at})`);
  }
}

/* ── 主流程 ──────────────────────────────── */

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('🤖 铸渊每日巡检 Agent · ' + todayStr);
  console.log('═══════════════════════════════════════════\n');

  // 执行所有检查
  checkBulletin();
  checkDailySelfcheck();
  checkBrainIntegrity();
  await checkCiStatus();
  checkModuleReadmes();
  await checkBulletinWorkflow();

  // 汇总
  const passed = checks.filter(c => c.status === '✅').length;
  const warnings = checks.filter(c => c.status === '⚠️').length;
  const failed = checks.filter(c => c.status === '❌').length;

  console.log('\n═══════════════════════════════════════════');
  console.log('📊 巡检报告');
  console.log('═══════════════════════════════════════════');
  console.log(`  ✅ 通过: ${passed}  ⚠️ 警告: ${warnings}  ❌ 失败: ${failed}`);
  console.log(`  📋 总检查项: ${checks.length}`);

  if (issues.length > 0) {
    console.log('\n🔴 待处理问题:');
    issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
  }

  if (actions.length > 0) {
    console.log('\n🔧 建议自动修复:');
    const uniqueActions = [...new Set(actions)];
    uniqueActions.forEach(a => console.log(`  → ${a}`));
  }

  // 更新 memory.json
  const memory = loadJson(MEMORY_PATH) || {};
  if (!memory.events) memory.events = [];

  const summaryText = `铸渊巡检Agent · ✅${passed} ⚠️${warnings} ❌${failed}` +
    (issues.length > 0 ? ` · ${issues.length}个问题` : ' · 全部通过');

  memory.events.push({
    type: 'daily_agent_inspection',
    timestamp: now.toISOString(),
    description: summaryText,
    result: failed > 0 ? 'issues_found' : (warnings > 0 ? 'warnings' : 'passed'),
    checks: checks.length,
    passed,
    warnings,
    failed,
    issues_detail: issues,
    actions_suggested: [...new Set(actions)],
  });

  // 保留最近 50 条事件
  if (memory.events.length > 50) {
    memory.events = memory.events.slice(-50);
  }

  memory.last_agent_inspection = {
    timestamp: now.toISOString(),
    result: failed > 0 ? 'issues_found' : (warnings > 0 ? 'warnings' : 'passed'),
    summary: summaryText,
  };

  saveJson(MEMORY_PATH, memory);
  console.log('\n💾 巡检结果已写入 memory.json');

  // 输出 GitHub Actions 变量
  const needBulletin = uniqueActions.includes('trigger_bulletin_update');
  const needSelfcheck = uniqueActions.includes('trigger_selfcheck');
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    const outputs = [
      `has_issues=${issues.length > 0}`,
      `issue_count=${issues.length}`,
      `need_bulletin_update=${needBulletin}`,
      `need_selfcheck=${needSelfcheck}`,
      `summary=${summaryText}`,
    ];
    fs.appendFileSync(outputFile, outputs.join('\n') + '\n');
  }

  console.log('\n✅ 铸渊巡检 Agent 完成');
}

main().catch(err => {
  console.error('❌ 巡检 Agent 异常:', err.message);
  process.exit(1);
});
