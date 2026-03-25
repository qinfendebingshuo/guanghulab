#!/usr/bin/env node
// scripts/skyeye/pr-risk-check.js
// 天眼·合并膜 — PR合并前全系统审核引擎 (SkyEye Merge Membrane)
//
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
//
// 核心原则（冰朔 2026-03-25 确认）：
//   所有合并到 main 的 PR — 无论冰朔还是其他开发者
//   均全部启动天眼系统全局全仓库架构审核
//   不符合现有仓库整体系统结构 → 物理切断合并通道
//   不再区分身份放行 — 天眼对所有人一视同仁
//
// 架构背景：
//   两条完全分离的部署路径：
//   Path A · 主站 (guanghulab.com) — 全PR审核，物理阻塞
//   Path B · 开发者门户 (dev-portal/) — 沙箱隔离，频道部署
//
// 风险检测维度（全PR适用）：
//   R1 · 关键文件覆盖检测
//   R2 · 构建产物误入检测
//   R3 · 大规模删除检测
//   R4 · 天眼核心配置篡改检测（仅代理PR触发 critical）
//   R5 · 工作流篡改检测（仅代理PR触发 critical）
//   R6 · 开发者门户框架保护
//   R7 · 仓库结构完整性验证（全PR适用 — 核心审计维度）
//
// 输入环境变量：
//   PR_AUTHOR, PR_BRANCH, PR_TITLE
//   PR_FILES, PR_STATS, PR_COMMITS
//
// 输出：
//   exit 0 → pass（允许合并）
//   exit 1 → block（物理层拒绝合并）

'use strict';

const fs   = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ━━━ 配置路径 ━━━
const ROOT = path.resolve(__dirname, '../..');
const BRAIN_CONFIG_PATH = path.join(ROOT, '.github/persona-brain/gate-guard-config.json');
const OWNER_CONFIG_PATH = path.join(ROOT, '.github/gate-guard-config.json');
const SECURITY_PROTOCOL_PATH = path.join(ROOT, '.github/persona-brain/security-protocol.json');
const PR_FILES_PATH = process.env.PR_FILES || '/tmp/pr_files.txt';
const PR_STATS_PATH = process.env.PR_STATS || '/tmp/pr_stats.txt';
const PR_COMMITS_PATH = process.env.PR_COMMITS || '/tmp/pr_commits.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ Copilot Agent 分支模式 ━━━
const AGENT_BRANCH_PATTERNS = [
  /^copilot\//,
  /^agent\//,
  /^bot\//
];

// ━━━ 天眼核心配置 — 代理PR修改触发 critical ━━━
const SKYEYE_CORE_FILES = [
  '.github/persona-brain/security-protocol.json',
  '.github/persona-brain/gate-guard-config.json',
  '.github/persona-brain/agent-registry.json',
  '.github/persona-brain/ontology.json',
  '.github/gate-guard-config.json',
  'scripts/gate-guard.js',
  'scripts/gate-guard-v2.js',
  'scripts/skyeye/pr-risk-check.js'
];

// ━━━ 门户框架文件 — 不可被开发者修改 ━━━
const PORTAL_FRAMEWORK_FILES = [
  'docs/dev-portal/index.html',
  'docs/dev-portal/manifest.json'
];

// ━━━ 构建产物特征 ━━━
const BUILD_ARTIFACT_PATTERNS = [
  /^docs\/assets\/index-[A-Za-z0-9_-]+\.(js|css)$/,
  /^dist\//,
  /^build\//,
  /^\.next\//,
  /^node_modules\//,
  /\.chunk\.(js|css)$/,
  /\.bundle\.(js|css)$/
];

// ━━━ 仓库必需目录 — R7 结构完整性检查 ━━━
const REQUIRED_DIRS = [
  '.github/workflows',
  '.github/persona-brain',
  'scripts',
  'scripts/skyeye',
  'skyeye',
  'skyeye/guards',
  'skyeye/scripts',
  'core',
  'docs',
  'data'
];

// ━━━ 仓库必需文件 — R7 结构完整性检查 ━━━
const REQUIRED_FILES = [
  '.github/persona-brain/security-protocol.json',
  '.github/persona-brain/gate-guard-config.json',
  '.github/persona-brain/agent-registry.json',
  'docs/index.html',
  'docs/CNAME',
  'README.md',
  'package.json'
];

// ━━━ 大规模删除阈值 ━━━
const MASS_DELETE_THRESHOLD = 500;

// ━━━ 工具函数 ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`⚠️ 无法读取 ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

function setOutput(key, value) {
  try {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) { /* silent */ }
}

function isAgentBranch(branchName) {
  if (!branchName) return false;
  return AGENT_BRANCH_PATTERNS.some(p => p.test(branchName));
}

function loadPRFiles() {
  try {
    if (!fs.existsSync(PR_FILES_PATH)) return [];
    return fs.readFileSync(PR_FILES_PATH, 'utf8')
      .split('\n').map(f => f.trim()).filter(f => f.length > 0);
  } catch (e) { return []; }
}

function loadPRStats() {
  try {
    if (!fs.existsSync(PR_STATS_PATH)) return null;
    const content = fs.readFileSync(PR_STATS_PATH, 'utf8').trim();
    let totalDeletions = 0;
    for (const line of content.split('\n')) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        const del = parseInt(parts[1], 10);
        if (!isNaN(del)) totalDeletions += del;
      }
    }
    return { totalDeletions };
  } catch (e) { return null; }
}

// ━━━ 身份提取（用于日志/上下文，不用于放行决策）━━━
function extractIdentity(commitsPath, prTitle) {
  const identity = { isAgent: false, agentName: null, devId: null, source: 'unknown' };

  if (prTitle) {
    const devMatch = prTitle.match(/\b(DEV-\d{3})\b/i);
    if (devMatch) { identity.devId = devMatch[1].toUpperCase(); identity.source = 'pr_title'; }
  }

  try {
    if (fs.existsSync(commitsPath)) {
      const content = fs.readFileSync(commitsPath, 'utf8');
      if (content.includes('Agent-Logs-Url:')) { identity.isAgent = true; identity.source = 'agent_logs_url'; }
      const coAuth = content.match(/Co-authored-by:\s*(.+?)\s*</);
      if (coAuth) { identity.agentName = coAuth[1].trim(); identity.isAgent = true; }
      if (!identity.devId) {
        const devMatch = content.match(/\b(DEV-\d{3})\b/i);
        if (devMatch) { identity.devId = devMatch[1].toUpperCase(); }
      }
    }
  } catch (e) { /* non-fatal */ }

  return identity;
}

// ━━━ R1 · 关键文件覆盖检测 ━━━
function checkCriticalFiles(files) {
  const risks = [];
  const criticalFiles = [
    'docs/index.html', 'docs/CNAME', 'docs/.nojekyll',
    'README.md', 'package.json', 'package-lock.json'
  ];
  for (const file of files) {
    if (criticalFiles.includes(file)) {
      risks.push({ dimension: 'R1', severity: 'high', file,
        detail: `关键文件被修改: ${file}` });
    }
  }
  return risks;
}

// ━━━ R2 · 构建产物误入检测 ━━━
function checkBuildArtifacts(files) {
  const risks = [];
  for (const file of files) {
    for (const pattern of BUILD_ARTIFACT_PATTERNS) {
      if (pattern.test(file)) {
        risks.push({ dimension: 'R2', severity: 'high', file,
          detail: `构建产物不应提交到仓库: ${file}` });
        break;
      }
    }
  }
  return risks;
}

// ━━━ R3 · 大规模删除检测 ━━━
function checkMassDeletion(stats) {
  const risks = [];
  if (stats && stats.totalDeletions > MASS_DELETE_THRESHOLD) {
    risks.push({ dimension: 'R3', severity: 'high', file: '(multiple)',
      detail: `大规模删除: ${stats.totalDeletions} 行被删除（阈值: ${MASS_DELETE_THRESHOLD}）` });
  }
  return risks;
}

// ━━━ R4 · 天眼核心配置篡改检测（代理PR = critical，手动PR = high） ━━━
function checkCoreConfigTampering(files, isAgent) {
  const risks = [];
  for (const file of files) {
    if (SKYEYE_CORE_FILES.includes(file)) {
      risks.push({ dimension: 'R4', severity: isAgent ? 'critical' : 'high', file,
        detail: `天眼核心配置被修改: ${file}` });
    }
  }
  return risks;
}

// ━━━ R5 · 工作流篡改检测（代理PR = critical，手动PR = high） ━━━
function checkWorkflowTampering(files, isAgent) {
  const risks = [];
  for (const file of files) {
    if (file.startsWith('.github/workflows/') && (file.endsWith('.yml') || file.endsWith('.yaml'))) {
      risks.push({ dimension: 'R5', severity: isAgent ? 'critical' : 'high', file,
        detail: `工作流文件被修改: ${file}` });
    }
  }
  return risks;
}

// ━━━ R6 · 开发者门户框架保护 ━━━
function checkPortalFramework(files, isAgent) {
  if (!isAgent) return []; // Owner can modify portal framework
  const risks = [];
  for (const file of files) {
    if (PORTAL_FRAMEWORK_FILES.includes(file)) {
      risks.push({ dimension: 'R6', severity: 'critical', file,
        detail: `门户框架文件被修改: ${file} — 仅限天眼系统维护` });
    }
  }
  return risks;
}

// ━━━ R7 · 仓库结构完整性验证（核心审计维度 — 对所有PR生效）━━━
function checkStructuralIntegrity(files) {
  const risks = [];

  // 7a. Security protocol must remain intact
  const protocol = readJSON(SECURITY_PROTOCOL_PATH);
  if (!protocol) {
    risks.push({ dimension: 'R7', severity: 'critical', file: '.github/persona-brain/security-protocol.json',
      detail: '安全协议文件不存在或无法解析 — 仓库安全基础被破坏' });
  } else {
    if (!protocol.permanent || !protocol.cannot_be_overridden) {
      risks.push({ dimension: 'R7', severity: 'critical', file: '.github/persona-brain/security-protocol.json',
        detail: '安全协议 permanent/cannot_be_overridden 标记丢失' });
    }
    if (!protocol.root_rules || protocol.root_rules.length < 3) {
      risks.push({ dimension: 'R7', severity: 'critical', file: '.github/persona-brain/security-protocol.json',
        detail: '安全协议 root_rules 不完整（需 3 条根规则）' });
    }
  }

  // 7b. Gate guard config must remain valid
  const brainConfig = readJSON(BRAIN_CONFIG_PATH);
  const ownerConfig = readJSON(OWNER_CONFIG_PATH);
  if (!brainConfig && !ownerConfig) {
    risks.push({ dimension: 'R7', severity: 'critical', file: '(gate-guard-config)',
      detail: '门禁配置文件全部缺失 — 系统安全体系被破坏' });
  }

  // 7c. Check that required directories still exist
  for (const dir of REQUIRED_DIRS) {
    const dirPath = path.join(ROOT, dir);
    if (!fs.existsSync(dirPath)) {
      risks.push({ dimension: 'R7', severity: 'high', file: dir + '/',
        detail: `必需目录缺失: ${dir}/` });
    }
  }

  // 7d. Check that required files still exist
  for (const file of REQUIRED_FILES) {
    const filePath = path.join(ROOT, file);
    if (!fs.existsSync(filePath)) {
      risks.push({ dimension: 'R7', severity: 'high', file,
        detail: `必需文件缺失: ${file}` });
    }
  }

  // 7e. Check that PR doesn't DELETE required files
  for (const file of files) {
    if (REQUIRED_FILES.includes(file)) {
      const filePath = path.join(ROOT, file);
      // File is in the PR diff — check if it still exists in the working tree
      // (if checkout has the merged version, missing = deleted)
      if (!fs.existsSync(filePath)) {
        risks.push({ dimension: 'R7', severity: 'critical', file,
          detail: `PR删除了仓库必需文件: ${file}` });
      }
    }
  }

  // 7f. Run structural scan scripts if available
  const scanScripts = [
    { name: 'scan-structure', path: path.join(ROOT, 'scripts/skyeye/scan-structure.js') },
    { name: 'scan-brain-health', path: path.join(ROOT, 'scripts/skyeye/scan-brain-health.js') },
    { name: 'scan-security-protocol', path: path.join(ROOT, 'scripts/skyeye/scan-security-protocol.js') }
  ];

  for (const script of scanScripts) {
    if (fs.existsSync(script.path)) {
      try {
        const output = execSync(`node "${script.path}" 2>&1`, {
          cwd: ROOT, timeout: 30000, encoding: 'utf8'
        });
        // Check for failure indicators in output
        if (output.includes('❌') || output.includes('FAIL') || output.includes('ERROR')) {
          const failLines = output.split('\n').filter(l =>
            l.includes('❌') || l.includes('FAIL') || l.includes('ERROR')
          ).slice(0, 3);
          risks.push({ dimension: 'R7', severity: 'high', file: `(${script.name})`,
            detail: `结构扫描 ${script.name} 报告问题: ${failLines.join('; ').slice(0, 200)}` });
        }
      } catch (e) {
        // Script execution failure is itself a structural concern
        const errMsg = (e.stderr || e.message || '').slice(0, 100);
        risks.push({ dimension: 'R7', severity: 'high', file: `(${script.name})`,
          detail: `结构扫描 ${script.name} 执行失败: ${errMsg}` });
      }
    }
  }

  return risks;
}

// ━━━ 风险决策 ━━━
function makeDecision(risks) {
  const hasCritical = risks.some(r => r.severity === 'critical');
  const highCount = risks.filter(r => r.severity === 'high').length;

  if (hasCritical) return { decision: 'block', risk_level: 'critical' };
  if (highCount >= 2) return { decision: 'block', risk_level: 'high' };
  if (highCount === 1) return { decision: 'warn', risk_level: 'high' };
  return { decision: 'pass', risk_level: 'low' };
}

// ━━━ 主逻辑 ━━━
function run() {
  const author = process.env.PR_AUTHOR || '';
  const branch = process.env.PR_BRANCH || '';
  const prTitle = process.env.PR_TITLE || '';

  console.log('═══════════════════════════════════════════════');
  console.log('🛡️ 天眼 · 合并膜 (SkyEye Merge Membrane)');
  console.log('═══════════════════════════════════════════════');
  console.log(`PR作者(GitHub): ${author || '(unknown)'}`);
  console.log(`分支: ${branch || '(unknown)'}`);
  console.log(`标题: ${prTitle || '(unknown)'}`);
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('');
  console.log('⚖️ 审核模式: 全员全审 — 不区分身份，天眼对所有人一视同仁');
  console.log('');

  // ─── 身份识别（仅用于日志/上下文，不影响审核决策）───
  const isAgent = isAgentBranch(branch);
  const identity = extractIdentity(PR_COMMITS_PATH, prTitle);
  const isAgentPR = isAgent || identity.isAgent;

  if (isAgentPR) {
    console.log('🤖 PR来源: 代理 (Copilot Agent)');
    if (identity.devId) console.log(`   开发者编号: ${identity.devId}`);
    if (identity.agentName) console.log(`   代理名称: ${identity.agentName}`);
  } else {
    console.log('👤 PR来源: 手动提交');
  }
  console.log('');

  // ─── 加载变更文件 ───
  const files = loadPRFiles();
  if (files.length === 0) {
    console.log('⚠️ 无变更文件或文件列表不可用');
    console.log('❌ 无法获取变更文件列表 — 安全起见阻止合并');
    setOutput('decision', 'block');
    setOutput('risk_level', 'unknown');
    setOutput('risk_summary', 'PR变更文件列表不可用');
    process.exit(1);
  }

  console.log(`📂 变更文件数: ${files.length}`);
  files.forEach(f => console.log(`  · ${f}`));
  console.log('');

  const stats = loadPRStats();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 天眼全系统审核 — 对所有PR生效，无例外
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  console.log('━━━ 天眼全系统审核启动 ━━━');
  console.log('');

  // Phase 1: 风险维度检测 (R1-R6)
  console.log('[Phase 1] 风险维度检测 (R1-R6)...');
  const riskChecks = [
    ...checkCriticalFiles(files),
    ...checkBuildArtifacts(files),
    ...checkMassDeletion(stats),
    ...checkCoreConfigTampering(files, isAgentPR),
    ...checkWorkflowTampering(files, isAgentPR),
    ...checkPortalFramework(files, isAgentPR)
  ];

  // Phase 2: 仓库结构完整性验证 (R7)
  console.log('[Phase 2] 仓库结构完整性验证 (R7)...');
  const structuralRisks = checkStructuralIntegrity(files);

  // Combine all risks
  const allRisks = [...riskChecks, ...structuralRisks];

  // Deduplicate
  const seen = new Set();
  const risks = allRisks.filter(r => {
    const key = `${r.dimension}:${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log('');

  // ─── 结果报告 ───
  if (risks.length === 0) {
    console.log('✅ 天眼全系统审核通过');
    console.log('   风险维度检测: 无风险');
    console.log('   仓库结构完整性: 正常');
    console.log('');
    console.log('═══ 决策: PASS ═══');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'low');
    setOutput('risk_summary', '天眼全系统审核通过');
    process.exit(0);
  }

  // ─── 输出风险报告 ───
  console.log(`⚠️ 检测到 ${risks.length} 项风险:`);
  for (const risk of risks) {
    const icon = risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} [${risk.dimension}] ${risk.detail}`);
  }
  console.log('');

  // ─── 决策 ───
  const { decision, risk_level } = makeDecision(risks);
  const summary = risks.map(r => `[${r.dimension}] ${r.detail}`).join(' | ');

  setOutput('decision', decision);
  setOutput('risk_level', risk_level);
  setOutput('risk_summary', summary.slice(0, 500));

  if (decision === 'block') {
    console.log(`═══ 决策: BLOCK (风险等级: ${risk_level}) ═══`);
    console.log('❌ 天眼合并膜: 物理切断合并通道');
    console.log('   此PR不符合仓库整体系统结构要求');
    process.exit(1);
  } else if (decision === 'warn') {
    console.log(`═══ 决策: WARN (风险等级: ${risk_level}) ═══`);
    console.log('⚠️ 天眼合并膜: 存在风险项，建议审核后合并');
    process.exit(0);
  } else {
    console.log(`═══ 决策: PASS (风险等级: ${risk_level}) ═══`);
    process.exit(0);
  }
}

run();
