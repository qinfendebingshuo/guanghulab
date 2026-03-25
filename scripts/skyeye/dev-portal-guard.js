#!/usr/bin/env node
// scripts/skyeye/dev-portal-guard.js
// 天眼·开发者门户沙箱守卫 (Dev Portal Sandbox Guard)
//
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
//
// 目的：保护开发者门户的沙箱隔离
//   每位开发者只能部署到自己的频道 (channels/DEV-XXX/)
//   门户框架文件 (index.html, manifest.json) 受保护
//   必须提供完整身份三要素：开发者编号 + 姓名 + 人格体编号
//   匿名代理（无身份信息）= 禁止部署到任何真实路径
//
// 输入环境变量：
//   PR_BRANCH    — 分支名
//   PR_TITLE     — PR 标题
//   PR_COMMITS   — Commit 信息路径
//   PR_FILES     — 变更文件列表路径
//   NOTION_API_KEY — Notion API 密钥（可选，用于跟踪）
//   DEV_PROFILE_DB_ID — 开发者画像数据库 ID（可选）
//
// 输出：
//   exit 0 → 允许部署
//   exit 1 → 禁止部署
//   GITHUB_OUTPUT → decision, dev_id, dev_name, persona_id, channel_files

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const BRAIN_CONFIG_PATH = path.join(ROOT, '.github/persona-brain/gate-guard-config.json');
const MANIFEST_PATH = path.join(ROOT, 'docs/dev-portal/manifest.json');
const PR_FILES_PATH = process.env.PR_FILES || '/tmp/pr_files.txt';
const PR_COMMITS_PATH = process.env.PR_COMMITS || '/tmp/pr_commits.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 门户保护文件 — 开发者不可修改 ━━━
const PORTAL_FRAMEWORK_FILES = [
  'docs/dev-portal/index.html',
  'docs/dev-portal/manifest.json'
];

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

function setOutput(key, value) {
  try {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) { /* silent */ }
}

// ━━━ 从 PR 元数据中提取身份三要素 ━━━
function extractIdentity(prTitle, commitsPath) {
  const identity = {
    devId: null,
    devName: null,
    personaId: null,
    complete: false,
    source: []
  };

  // From PR title
  if (prTitle) {
    const devMatch = prTitle.match(/\b(DEV-\d{3})\b/i);
    if (devMatch) { identity.devId = devMatch[1].toUpperCase(); identity.source.push('pr_title'); }
  }

  // From commit messages
  try {
    if (fs.existsSync(commitsPath)) {
      const content = fs.readFileSync(commitsPath, 'utf8');

      // DEV-XXX
      if (!identity.devId) {
        const devMatch = content.match(/\b(DEV-\d{3})\b/i);
        if (devMatch) { identity.devId = devMatch[1].toUpperCase(); identity.source.push('commit_msg'); }
      }

      // Persona signature [PER-XXX]
      const perMatch = content.match(/\[(PER-\d{3})\]/);
      if (perMatch) { identity.personaId = perMatch[1]; identity.source.push('commit_sig'); }

      // TCS-GL-XX format
      const tcsMatch = content.match(/\b(TCS-GL-\d{2})\b/i);
      if (tcsMatch && !identity.devId) { identity.devId = tcsMatch[1].toUpperCase(); identity.source.push('tcs_ref'); }
    }
  } catch (e) { /* non-fatal */ }

  // From changed file paths — infer DEV-XXX from channel paths
  try {
    if (fs.existsSync(PR_FILES_PATH)) {
      const files = fs.readFileSync(PR_FILES_PATH, 'utf8').split('\n').filter(Boolean);
      for (const file of files) {
        const channelMatch = file.match(/^docs\/dev-portal\/channels\/(DEV-\d{3})\//);
        if (channelMatch) {
          if (!identity.devId) {
            identity.devId = channelMatch[1];
            identity.source.push('file_path');
          }
          break;
        }
      }
    }
  } catch (e) { /* non-fatal */ }

  // Cross-reference with gate-guard config for name and persona_id
  if (identity.devId) {
    const config = readJSON(BRAIN_CONFIG_PATH);
    if (config && config.developer_permissions && config.developer_permissions[identity.devId]) {
      const dev = config.developer_permissions[identity.devId];
      identity.devName = dev.name;
      if (!identity.personaId) identity.personaId = dev.persona_id;
    }
  }

  // Completeness check: need all three (devId + devName + personaId)
  identity.complete = !!(identity.devId && identity.devName && identity.personaId);

  return identity;
}

// ━━━ 读取变更文件列表 ━━━
function loadPRFiles() {
  try {
    if (!fs.existsSync(PR_FILES_PATH)) return [];
    return fs.readFileSync(PR_FILES_PATH, 'utf8')
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  } catch (e) {
    return [];
  }
}

// ━━━ 分类文件 ━━━
function classifyFiles(files) {
  const result = {
    portalFramework: [],    // 门户框架文件（保护）
    ownChannel: [],         // 自己频道的文件
    otherChannels: [],      // 他人频道的文件
    outsidePortal: [],      // 门户以外的文件
    channelDevIds: new Set() // 涉及的频道编号
  };

  for (const file of files) {
    if (PORTAL_FRAMEWORK_FILES.includes(file)) {
      result.portalFramework.push(file);
    } else if (file.startsWith('docs/dev-portal/channels/')) {
      const channelMatch = file.match(/^docs\/dev-portal\/channels\/(DEV-\d{3})\//);
      if (channelMatch) {
        result.channelDevIds.add(channelMatch[1]);
        result.ownChannel.push(file); // Will be re-classified after identity check
      }
    } else if (file.startsWith('docs/dev-portal/')) {
      result.portalFramework.push(file); // Any other dev-portal file is framework
    } else {
      result.outsidePortal.push(file);
    }
  }

  return result;
}

// ━━━ 主逻辑 ━━━
function run() {
  const branch = process.env.PR_BRANCH || '';
  const prTitle = process.env.PR_TITLE || '';

  console.log('═══════════════════════════════════════════════');
  console.log('🛡️ 天眼 · 开发者门户沙箱守卫');
  console.log('═══════════════════════════════════════════════');
  console.log(`分支: ${branch}`);
  console.log(`标题: ${prTitle}`);
  console.log(`时间: ${new Date().toISOString()}`);
  console.log('');

  // ─── 提取身份三要素 ───
  console.log('━━━ 身份验证 ━━━');
  const identity = extractIdentity(prTitle, PR_COMMITS_PATH);

  if (identity.devId) console.log(`  开发者编号: ${identity.devId}`);
  if (identity.devName) console.log(`  开发者姓名: ${identity.devName}`);
  if (identity.personaId) console.log(`  人格体编号: ${identity.personaId}`);
  console.log(`  身份来源: ${identity.source.join(', ') || '无'}`);
  console.log(`  三要素完整: ${identity.complete ? '✅ 是' : '❌ 否'}`);
  console.log('');

  // ─── 匿名屏蔽 ───
  if (!identity.complete) {
    console.log('❌ 身份验证失败 — 匿名代理禁止部署');
    console.log('');
    console.log('   缺失信息:');
    if (!identity.devId) console.log('   · 开发者编号 (DEV-XXX)');
    if (!identity.devName) console.log('   · 开发者姓名');
    if (!identity.personaId) console.log('   · 人格体编号 (PER-XXX)');
    console.log('');
    console.log('   提示: 在 PR 标题或 commit 信息中包含 DEV-XXX 和 [PER-XXX]');
    console.log('   例: "DEV-002: deploy login module" 或 "[PER-002] feat: add feature"');
    setOutput('decision', 'block');
    setOutput('block_reason', 'anonymous_agent');
    process.exit(1);
  }

  // ─── 分类变更文件 ───
  const files = loadPRFiles();
  if (files.length === 0) {
    console.log('⚠️ 无变更文件 — 放行');
    setOutput('decision', 'pass');
    setOutput('dev_id', identity.devId);
    process.exit(0);
  }

  const classified = classifyFiles(files);
  const portalFiles = files.filter(f => f.startsWith('docs/dev-portal/'));

  if (portalFiles.length === 0) {
    console.log('ℹ️ 此 PR 不涉及门户文件 — 跳过门户守卫');
    setOutput('decision', 'skip');
    setOutput('dev_id', identity.devId);
    process.exit(0);
  }

  console.log('━━━ 文件分类 ━━━');
  console.log(`  门户框架文件: ${classified.portalFramework.length}`);
  classified.portalFramework.forEach(f => console.log(`    🔒 ${f}`));
  console.log(`  频道文件: ${classified.ownChannel.length}`);
  console.log(`  涉及频道: ${[...classified.channelDevIds].join(', ') || '无'}`);
  console.log(`  门户外文件: ${classified.outsidePortal.length}`);
  console.log('');

  // ─── 检查框架文件保护 ───
  if (classified.portalFramework.length > 0) {
    console.log('❌ 禁止修改门户框架文件:');
    classified.portalFramework.forEach(f => console.log(`   🔒 ${f}`));
    console.log('');
    console.log('   门户框架文件由天眼系统维护，开发者不可修改');
    setOutput('decision', 'block');
    setOutput('block_reason', 'framework_tampering');
    setOutput('dev_id', identity.devId);
    process.exit(1);
  }

  // ─── 检查频道隔离 ───
  const channelIds = [...classified.channelDevIds];
  const touchesOtherChannels = channelIds.some(id => id !== identity.devId);

  if (touchesOtherChannels) {
    const otherChannels = channelIds.filter(id => id !== identity.devId);
    console.log('❌ 频道隔离违规 — 修改了他人频道:');
    otherChannels.forEach(id => console.log(`   🚫 ${id} (不属于 ${identity.devId})`));
    console.log('');
    console.log('   每位开发者只能部署到自己的频道沙箱');
    setOutput('decision', 'block');
    setOutput('block_reason', 'channel_isolation');
    setOutput('dev_id', identity.devId);
    process.exit(1);
  }

  // ─── 验证频道归属 ───
  if (channelIds.length === 1 && channelIds[0] === identity.devId) {
    const channelFiles = classified.ownChannel;
    console.log(`✅ 频道验证通过 — ${identity.devName}(${identity.devId}) → channels/${identity.devId}/`);
    console.log(`   部署文件: ${channelFiles.length}`);
    channelFiles.forEach(f => console.log(`   📦 ${f}`));
    console.log('');

    setOutput('decision', 'pass');
    setOutput('dev_id', identity.devId);
    setOutput('dev_name', identity.devName);
    setOutput('persona_id', identity.personaId);
    setOutput('channel_files', channelFiles.join(','));

    console.log('═══ 决策: PASS ═══');
    console.log(`   ${identity.devName} 的模块可以部署到 channels/${identity.devId}/`);
    process.exit(0);
  }

  // Default pass for edge cases
  console.log('✅ 门户守卫检查通过');
  setOutput('decision', 'pass');
  setOutput('dev_id', identity.devId);
  process.exit(0);
}

run();
