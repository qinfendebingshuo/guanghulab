#!/usr/bin/env node
// scripts/skyeye/pr-risk-check.js
// 天眼·合并膜 — PR合并前风险检查引擎 (SkyEye Merge Membrane)
//
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
//
// 架构背景：
//   所有开发者共用 qinfendebingshuo 账号（企业权限单人仓库）
//   代理（Copilot Agent）以 copilot/* 分支开发，通过 PR 合并
//   无法通过 GitHub username 区分身份 → 改用分支名/commit元数据识别
//
// 沙箱隔离原则：
//   开发者在各自分支自由开发（沙箱）→ 天眼不干预
//   合并到 main 时 → 天眼合并膜启动，全系统审核
//   天眼审核不通过 → 物理层拒绝合并（exit 1 = GitHub Status Check 失败）
//
// 身份识别（不依赖 GitHub username）：
//   I1 · 分支名模式匹配（copilot/* = 代理PR）
//   I2 · Commit 签名提取（Co-authored-by, Agent-Logs-Url）
//   I3 · PR 标题/描述中的开发者编号（DEV-XXX, TCS-GL-XX）
//
// 风险检测维度：
//   R1 · 关键文件覆盖检测（docs/index.html 等核心文件）
//   R2 · 天眼系统包裹区域入侵检测（.github/, scripts/, skyeye/ 等）
//   R3 · 构建产物误入检测（Vite/Webpack hash文件）
//   R4 · 天眼核心配置篡改检测（security-protocol, gate-guard-config 等）
//   R5 · 大规模删除检测（>500行删除）
//   R6 · 工作流篡改检测（.github/workflows/ 修改）
//
// 输入环境变量：
//   PR_AUTHOR      — PR 作者 GitHub username
//   PR_BRANCH      — PR 源分支名
//   PR_TITLE       — PR 标题
//   PR_FILES       — 变更文件列表路径（默认 /tmp/pr_files.txt）
//   PR_STATS       — 变更统计路径（默认 /tmp/pr_stats.txt）
//   PR_COMMITS     — PR commit 信息路径（默认 /tmp/pr_commits.txt）
//
// 输出：
//   exit 0 → pass（允许合并）
//   exit 1 → block（物理层拒绝合并）
//   GITHUB_OUTPUT → risk_level, risk_summary, decision, identity_source

'use strict';

const fs   = require('fs');
const path = require('path');

// ━━━ 配置路径 ━━━
const ROOT = path.resolve(__dirname, '../..');
const BRAIN_CONFIG_PATH = path.join(ROOT, '.github/persona-brain/gate-guard-config.json');
const OWNER_CONFIG_PATH = path.join(ROOT, '.github/gate-guard-config.json');
const SECURITY_PROTOCOL_PATH = path.join(ROOT, '.github/persona-brain/security-protocol.json');
const PR_FILES_PATH = process.env.PR_FILES || '/tmp/pr_files.txt';
const PR_STATS_PATH = process.env.PR_STATS || '/tmp/pr_stats.txt';
const PR_COMMITS_PATH = process.env.PR_COMMITS || '/tmp/pr_commits.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 仓库主人 ━━━
const REPO_OWNER = 'qinfendebingshuo';

// ━━━ Copilot Agent 分支模式 ━━━
const AGENT_BRANCH_PATTERNS = [
  /^copilot\//,           // GitHub Copilot agent branches
  /^agent\//,             // Generic agent branches
  /^bot\//                // Bot branches
];

// ━━━ 天眼系统包裹区域 — 这些路径构成天眼保护的核心系统 ━━━
const SKYEYE_WRAPPED_PATHS = [
  '.github/workflows/',
  '.github/persona-brain/',
  '.github/brain/',
  '.github/gate-guard-config.json',
  'scripts/',
  'skyeye/',
  'core/',
  'connectors/',
  'backend/api-server/',
  'docs/index.html',
  'docs/CNAME',
  'docs/.nojekyll',
  'docs/js/',
  'docs/css/',
  'docs/dashboard/',
  'data/system-health.json',
  'data/bulletin-board.json',
  'README.md',
  'package.json',
  'package-lock.json'
];

// ━━━ 天眼核心配置 — 最高保护等级，任何修改都触发 block ━━━
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

// ━━━ 大规模删除阈值 ━━━
const MASS_DELETE_THRESHOLD = 500;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`⚠️ 无法读取 ${path.basename(filePath)}: ${e.message}`);
    return null;
  }
}

// ━━━ 输出到 GITHUB_OUTPUT ━━━
function setOutput(key, value) {
  try {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) {
    // silent fail for local testing
  }
}

// ━━━ I1 · 检测是否为代理（Agent）PR ━━━
function isAgentBranch(branchName) {
  if (!branchName) return false;
  return AGENT_BRANCH_PATTERNS.some(p => p.test(branchName));
}

// ━━━ I2 · 从 commit 元数据提取代理身份 ━━━
function extractAgentIdentity(commitsPath, prTitle) {
  const identity = {
    isAgent: false,
    agentName: null,
    devId: null,
    devName: null,
    source: 'unknown'
  };

  // Check PR title for dev identifiers
  if (prTitle) {
    const devMatch = prTitle.match(/\b(DEV-\d{3})\b/i);
    const tcsMatch = prTitle.match(/\b(TCS-GL-\d{2})\b/i);
    if (devMatch) {
      identity.devId = devMatch[1].toUpperCase();
      identity.source = 'pr_title';
    }
    if (tcsMatch) {
      identity.devId = tcsMatch[1].toUpperCase();
      identity.source = 'pr_title';
    }
  }

  // Check commit messages
  try {
    if (fs.existsSync(commitsPath)) {
      const content = fs.readFileSync(commitsPath, 'utf8');

      // Agent-Logs-Url indicates Copilot agent
      if (content.includes('Agent-Logs-Url:')) {
        identity.isAgent = true;
        identity.source = 'agent_logs_url';
      }

      // Co-authored-by pattern
      const coAuthorMatch = content.match(/Co-authored-by:\s*(.+?)\s*</);
      if (coAuthorMatch) {
        identity.agentName = coAuthorMatch[1].trim();
        identity.isAgent = true;
        if (identity.source === 'unknown') identity.source = 'co_authored_by';
      }

      // Persona signature in commit messages [PER-XXX] [TCS-XXX]
      const sigMatch = content.match(/^\[([A-Z]+-[A-Z0-9\-∞]+)\]/m);
      if (sigMatch) {
        identity.devId = identity.devId || sigMatch[1];
        if (identity.source === 'unknown') identity.source = 'commit_signature';
      }

      // DEV-XXX in commit messages
      const devInCommit = content.match(/\b(DEV-\d{3})\b/i);
      if (devInCommit && !identity.devId) {
        identity.devId = devInCommit[1].toUpperCase();
        if (identity.source === 'unknown') identity.source = 'commit_message';
      }
    }
  } catch (e) {
    // Non-fatal - continue without commit analysis
  }

  return identity;
}

// ━━━ 加载门禁配置 ━━━
function loadConfig() {
  const brainConfig = readJSON(BRAIN_CONFIG_PATH);
  const ownerConfig = readJSON(OWNER_CONFIG_PATH);

  if (!brainConfig && !ownerConfig) {
    console.error('⚠️ 门禁配置缺失，使用最小安全配置');
    return {
      whitelist: ['github-actions[bot]', 'zhuyuan-bot'],
      system_protected_paths: ['.github/', 'scripts/', 'docs/', 'data/', 'core/', 'connectors/'],
      developers: {}
    };
  }

  return {
    whitelist: (brainConfig?.whitelist_actors || ownerConfig?.whitelist || [])
      .filter(u => u !== REPO_OWNER), // Do NOT whitelist owner for agent PRs
    system_protected_paths: brainConfig?.system_protected_paths || ownerConfig?.protected_paths || [],
    developers_brain: brainConfig?.developer_permissions || {},
    developers_owner: ownerConfig?.developers || {}
  };
}

// ━━━ 读取 PR 变更文件列表 ━━━
function loadPRFiles() {
  try {
    if (!fs.existsSync(PR_FILES_PATH)) {
      console.warn('⚠️ PR文件列表不存在: ' + PR_FILES_PATH);
      return [];
    }
    return fs.readFileSync(PR_FILES_PATH, 'utf8')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  } catch (e) {
    console.error('⚠️ 无法读取PR文件列表: ' + e.message);
    return [];
  }
}

// ━━━ 读取 PR 变更统计 ━━━
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
  } catch (e) {
    return null;
  }
}

// ━━━ 根据 devId 查找注册开发者 ━━━
function findDeveloperByDevId(devId, config) {
  if (!devId) return null;

  if (config.developers_brain) {
    for (const [id, dev] of Object.entries(config.developers_brain)) {
      if (id === devId) {
        return { devId: id, name: dev.name, allowed_paths: dev.allowed_paths || [] };
      }
    }
  }

  if (config.developers_owner) {
    for (const [, dev] of Object.entries(config.developers_owner)) {
      if (dev.dev_id === devId) {
        return { devId: dev.dev_id, name: dev.name, allowed_paths: dev.allowed_paths || [] };
      }
    }
  }

  return null;
}

// ━━━ 检查文件是否在天眼包裹区域内 ━━━
function isInSkyeyeZone(file) {
  return SKYEYE_WRAPPED_PATHS.some(p => file === p || file.startsWith(p));
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
      risks.push({
        dimension: 'R1',
        severity: 'high',
        file,
        detail: `关键文件被修改: ${file}`
      });
    }
  }
  return risks;
}

// ━━━ R2 · 天眼包裹区域入侵检测 ━━━
function checkSkyeyeZoneIntrusion(files, developer) {
  const risks = [];

  for (const file of files) {
    if (!isInSkyeyeZone(file)) continue;

    // If developer is identified, check allowed_paths
    if (developer) {
      const isAllowed = developer.allowed_paths.some(p => file.startsWith(p));
      if (!isAllowed) {
        risks.push({
          dimension: 'R2',
          severity: 'high',
          file,
          detail: `${developer.name}(${developer.devId}) 修改了天眼包裹区域: ${file}`
        });
      }
    } else {
      // Unknown identity touching SkyEye zone
      risks.push({
        dimension: 'R2',
        severity: 'high',
        file,
        detail: `代理PR修改天眼包裹区域: ${file}`
      });
    }
  }

  return risks;
}

// ━━━ R3 · 构建产物误入检测 ━━━
function checkBuildArtifacts(files) {
  const risks = [];
  for (const file of files) {
    for (const pattern of BUILD_ARTIFACT_PATTERNS) {
      if (pattern.test(file)) {
        risks.push({
          dimension: 'R3',
          severity: 'high',
          file,
          detail: `构建产物不应提交到仓库: ${file}`
        });
        break;
      }
    }
  }
  return risks;
}

// ━━━ R4 · 天眼核心配置篡改检测 ━━━
function checkCoreConfigTampering(files) {
  const risks = [];
  for (const file of files) {
    if (SKYEYE_CORE_FILES.includes(file)) {
      risks.push({
        dimension: 'R4',
        severity: 'critical',
        file,
        detail: `天眼核心配置被修改: ${file} — 此文件仅限 TCS-0002∞ 主权者修改`
      });
    }
  }
  return risks;
}

// ━━━ R5 · 大规模删除检测 ━━━
function checkMassDeletion(stats) {
  const risks = [];
  if (stats && stats.totalDeletions > MASS_DELETE_THRESHOLD) {
    risks.push({
      dimension: 'R5',
      severity: 'high',
      file: '(multiple)',
      detail: `大规模删除检测: ${stats.totalDeletions} 行被删除（阈值: ${MASS_DELETE_THRESHOLD}）`
    });
  }
  return risks;
}

// ━━━ R6 · 工作流篡改检测 ━━━
function checkWorkflowTampering(files) {
  const risks = [];
  for (const file of files) {
    if (file.startsWith('.github/workflows/') && (file.endsWith('.yml') || file.endsWith('.yaml'))) {
      risks.push({
        dimension: 'R6',
        severity: 'critical',
        file,
        detail: `工作流文件被修改: ${file} — 代理PR不应修改自动化管线`
      });
    }
  }
  return risks;
}

// ━━━ 天眼系统完整性验证 ━━━
function verifySkyeyeIntegrity() {
  const issues = [];

  // Check security protocol
  const protocol = readJSON(SECURITY_PROTOCOL_PATH);
  if (!protocol) {
    issues.push('security-protocol.json 不存在或无法读取');
  } else {
    if (!protocol.permanent) issues.push('security-protocol.json: permanent 标记缺失');
    if (!protocol.root_rules || protocol.root_rules.length < 3) {
      issues.push('security-protocol.json: root_rules 不完整');
    }
  }

  // Check gate-guard configs
  if (!readJSON(BRAIN_CONFIG_PATH) && !readJSON(OWNER_CONFIG_PATH)) {
    issues.push('门禁配置文件全部缺失');
  }

  return issues;
}

// ━━━ 风险评估决策 ━━━
function makeDecision(risks, touchesSkyeyeZone) {
  const hasCritical = risks.some(r => r.severity === 'critical');
  const highCount = risks.filter(r => r.severity === 'high').length;

  // Any critical risk = immediate block
  if (hasCritical) {
    return { decision: 'block', risk_level: 'critical' };
  }

  // Multiple high risks = block
  if (highCount >= 2) {
    return { decision: 'block', risk_level: 'high' };
  }

  // Single high risk = warn (allow merge but notify)
  if (highCount === 1) {
    return { decision: 'warn', risk_level: 'high' };
  }

  // No SkyEye zone touched = safe pass
  if (!touchesSkyeyeZone) {
    return { decision: 'pass', risk_level: 'low' };
  }

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

  // ─── 检测 PR 来源类型 ───
  const fromAgent = isAgentBranch(branch);
  const identity = extractAgentIdentity(PR_COMMITS_PATH, prTitle);
  const isAgentPR = fromAgent || identity.isAgent;

  if (isAgentPR) {
    console.log('🤖 代理PR检测: 是');
    console.log(`   分支匹配: ${fromAgent ? '是' : '否'}`);
    console.log(`   Agent标记: ${identity.isAgent ? '是' : '否'}`);
    if (identity.agentName) console.log(`   代理名称: ${identity.agentName}`);
    if (identity.devId) console.log(`   开发者编号: ${identity.devId}`);
    console.log(`   身份来源: ${identity.source}`);
  } else {
    // Non-agent PR from repo owner — this is the owner's own manual work
    console.log('👤 主权者手动PR — 天眼合并膜放行');
    console.log('   (非代理分支，无Agent标记)');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'none');
    setOutput('identity_source', 'owner_manual');
    setOutput('risk_summary', '主权者手动PR，天眼合并膜放行');
    process.exit(0);
  }
  console.log('');

  // ─── 天眼系统完整性预检 ───
  console.log('━━━ 天眼系统完整性预检 ━━━');
  const integrityIssues = verifySkyeyeIntegrity();
  if (integrityIssues.length > 0) {
    console.log('⚠️ 天眼系统完整性问题:');
    integrityIssues.forEach(i => console.log(`  · ${i}`));
  } else {
    console.log('✅ 天眼系统完整性: 正常');
  }
  console.log('');

  // ─── 加载配置和文件 ───
  const config = loadConfig();
  const files = loadPRFiles();

  if (files.length === 0) {
    console.log('⚠️ 无变更文件或文件列表不可用');
    // For agent PRs with no file info, we block to be safe
    console.log('❌ 代理PR无法获取变更文件列表 — 安全起见阻止合并');
    setOutput('decision', 'block');
    setOutput('risk_level', 'unknown');
    setOutput('identity_source', identity.source);
    setOutput('risk_summary', '代理PR变更文件列表不可用');
    process.exit(1);
  }

  console.log(`📂 变更文件数: ${files.length}`);
  files.forEach(f => console.log(`  · ${f}`));
  console.log('');

  // ─── 查找注册开发者（通过 devId） ───
  const developer = identity.devId ? findDeveloperByDevId(identity.devId, config) : null;
  if (developer) {
    console.log(`👤 已识别开发者: ${developer.name} (${developer.devId})`);
  } else if (identity.devId) {
    console.log(`⚠️ 开发者编号 ${identity.devId} 未在门禁系统注册`);
  } else {
    console.log('⚠️ 无法识别开发者身份');
  }
  console.log('');

  // ─── 分析天眼区域接触情况 ───
  const skyeyeZoneFiles = files.filter(f => isInSkyeyeZone(f));
  const nonSkyeyeFiles = files.filter(f => !isInSkyeyeZone(f));
  const touchesSkyeyeZone = skyeyeZoneFiles.length > 0;

  console.log(`🛡️ 天眼包裹区域文件: ${skyeyeZoneFiles.length}/${files.length}`);
  if (touchesSkyeyeZone) {
    console.log('   ⚠️ 此PR修改了天眼系统包裹区域 — 启动完整审核');
    skyeyeZoneFiles.forEach(f => console.log(`   🔒 ${f}`));
  } else {
    console.log('   ✅ 此PR未触及天眼包裹区域 — 沙箱内操作');
  }
  if (nonSkyeyeFiles.length > 0) {
    console.log(`   📦 沙箱区域文件: ${nonSkyeyeFiles.length}`);
  }
  console.log('');

  // ─── 如果完全在沙箱内且有注册身份 → 放行 ───
  if (!touchesSkyeyeZone && developer) {
    console.log('✅ 沙箱内操作 + 已注册开发者 — 天眼合并膜放行');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'low');
    setOutput('identity_source', identity.source);
    setOutput('risk_summary', `${developer.name}(${developer.devId}) 沙箱内操作，未触及天眼区域`);
    process.exit(0);
  }

  // ─── 加载统计 ───
  const stats = loadPRStats();

  // ─── 风险检测 ───
  console.log('━━━ 天眼风险检测启动 ━━━');
  const allRisks = [
    ...checkCriticalFiles(files),
    ...checkSkyeyeZoneIntrusion(files, developer),
    ...checkBuildArtifacts(files),
    ...checkCoreConfigTampering(files),
    ...checkMassDeletion(stats),
    ...checkWorkflowTampering(files)
  ];

  // Deduplicate by file + dimension
  const seen = new Set();
  const risks = allRisks.filter(r => {
    const key = `${r.dimension}:${r.file}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  if (risks.length === 0 && !touchesSkyeyeZone) {
    console.log('✅ 未检测到风险（沙箱内操作）');
    console.log('');
    console.log('═══ 决策: PASS ═══');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'low');
    setOutput('identity_source', identity.source);
    setOutput('risk_summary', '沙箱内操作，未检测到风险');
    process.exit(0);
  }

  if (risks.length === 0 && touchesSkyeyeZone) {
    // Touches SkyEye zone but no specific risks detected
    // This could happen if a registered developer touches their allowed paths
    console.log('✅ 天眼区域变更已验证 — 在授权范围内');
    console.log('');
    console.log('═══ 决策: PASS ═══');
    setOutput('decision', 'pass');
    setOutput('risk_level', 'low');
    setOutput('identity_source', identity.source);
    setOutput('risk_summary', '天眼区域变更已验证，在授权范围内');
    process.exit(0);
  }

  // ─── 输出风险报告 ───
  console.log('');
  console.log(`⚠️ 检测到 ${risks.length} 项风险:`);
  for (const risk of risks) {
    const icon = risk.severity === 'critical' ? '🔴' : risk.severity === 'high' ? '🟠' : '🟡';
    console.log(`  ${icon} [${risk.dimension}] ${risk.detail}`);
  }
  console.log('');

  // ─── 决策 ───
  const { decision, risk_level } = makeDecision(risks, touchesSkyeyeZone);
  const summary = risks.map(r => `[${r.dimension}] ${r.detail}`).join(' | ');

  setOutput('decision', decision);
  setOutput('risk_level', risk_level);
  setOutput('identity_source', identity.source);
  setOutput('risk_summary', summary.slice(0, 500));

  if (decision === 'block') {
    console.log(`═══ 决策: BLOCK (风险等级: ${risk_level}) ═══`);
    console.log('❌ 天眼合并膜: 物理层拒绝合并');
    console.log('   此PR的变更触及天眼系统包裹区域且未通过审核');
    console.log('   请联系主权者 TCS-0002∞ 审核后手动合并');
    process.exit(1);
  } else if (decision === 'warn') {
    console.log(`═══ 决策: WARN (风险等级: ${risk_level}) ═══`);
    console.log('⚠️ 天眼合并膜: 存在风险 — 建议主权者审核');
    process.exit(0);
  } else {
    console.log(`═══ 决策: PASS (风险等级: ${risk_level}) ═══`);
    process.exit(0);
  }
}

run();
