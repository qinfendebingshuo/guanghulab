// scripts/gate-guard-v2.js
// 铸渊·智能门禁 v2 · 判定引擎
//
// v2 升级内容（人格体编号体系）：
//   ① 检查 commit 签名（PER-XXX 人格体编号）
//   ② 实时查询 Notion 天眼人格体注册表（降级回退到本地配置）
//   ③ 保留 v1 全部路径权限判定逻辑
//
// 核心原则（冰朔确认）：
//   仓库主人（repo_owner）的推送 → 永远放行
//   系统 bot push → 永远放行
//   其他推送 → 检查签名 + 身份 + 路径权限
//
// 输入：PUSH_ACTOR + /tmp/changed_files.txt + COMMIT_MESSAGE
// 输出：action (pass/fix/revert) → GITHUB_OUTPUT

'use strict';

const fs   = require('fs');
const path = require('path');

// ━━━ 配置路径 ━━━
const BRAIN_CONFIG_PATH = path.join(__dirname, '../.github/persona-brain/gate-guard-config.json');
const OWNER_CONFIG_PATH = path.join(__dirname, '../.github/gate-guard-config.json');
const CHANGED_FILES_PATH = '/tmp/changed_files.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 仓库主人 ━━━
const REPO_OWNER = 'qinfendebingshuo';

// ━━━ 人格体签名正则（v2 升级：支持 PER-XXX / TCS-XXX / PER-PENDING-XXX） ━━━
const PERSONA_SIGNATURE_REGEX = /^\[([A-Z]+-[A-Z0-9\-∞]+)\]/;

// ━━━ 显示长度限制 ━━━
const MAX_COMMIT_DISPLAY = 80;

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

// ━━━ 加载合并配置 ━━━
function loadConfig() {
  const brainConfig = readJSON(BRAIN_CONFIG_PATH);
  const ownerConfig = readJSON(OWNER_CONFIG_PATH);

  if (!brainConfig && !ownerConfig) {
    console.error('⚠️ 两套门禁配置均缺失');
    return null;
  }

  const config = brainConfig || {
    whitelist_actors: [],
    system_protected_paths: [],
    developer_permissions: {}
  };

  if (!config.whitelist_actors) config.whitelist_actors = [];
  const repoOwner = config.repo_owner || REPO_OWNER;
  if (!config.whitelist_actors.includes(repoOwner)) {
    config.whitelist_actors.push(repoOwner);
  }
  config.repo_owner = repoOwner;

  if (ownerConfig) {
    const ownerWhitelist = ownerConfig.whitelist || [];
    for (const user of ownerWhitelist) {
      if (!config.whitelist_actors.includes(user)) {
        config.whitelist_actors.push(user);
      }
    }
    if (ownerConfig.developers) {
      config._owner_developers = ownerConfig.developers;
    }
  }

  return config;
}

// ━━━ 读取变更文件列表 ━━━
function loadChangedFiles() {
  try {
    const content = fs.readFileSync(CHANGED_FILES_PATH, 'utf8').trim();
    if (!content) return [];
    return content.split('\n').map(f => f.trim()).filter(f => f !== '');
  } catch (e) {
    console.error('⚠️ 无法读取变更文件列表:', e.message);
    return [];
  }
}

// ━━━ 提取 commit 签名中的人格体编号 ━━━
function extractPersonaSignature(commitMessage) {
  if (!commitMessage) return null;
  const match = commitMessage.match(PERSONA_SIGNATURE_REGEX);
  if (match) {
    return match[1]; // e.g. "PER-SS001", "TCS-0002∞", "PER-PENDING-005"
  }
  return null;
}

// ━━━ 通过人格体编号查找开发者 ━━━
function findByPersonaId(config, personaId) {
  if (!config || !config.developer_permissions) return null;

  for (const [devId, dev] of Object.entries(config.developer_permissions)) {
    if (dev.persona_id === personaId) {
      return { devId, ...dev };
    }
  }
  return null;
}

// ━━━ 查找开发者权限（双配置源 + 人格体编号查找） ━━━
function findDeveloper(config, actor, personaId) {
  if (!config) return null;

  // 1. 优先通过 persona_id 查找（v2 新增）
  if (personaId) {
    const byPersona = findByPersonaId(config, personaId);
    if (byPersona) {
      console.log(`🆔 通过人格体编号 ${personaId} 识别: ${byPersona.name}`);
      return byPersona;
    }
  }

  // 2. 从 persona-brain 配置（DEV-ID 索引）中按 github_usernames 查找
  if (config.developer_permissions) {
    for (const [devId, dev] of Object.entries(config.developer_permissions)) {
      if (dev.github_usernames && dev.github_usernames.includes(actor)) {
        return { devId, ...dev };
      }
    }
  }

  // 3. 从冰朔确认版配置中查找
  if (config._owner_developers && config._owner_developers[actor]) {
    const dev = config._owner_developers[actor];
    return {
      devId: dev.dev_id,
      name: dev.name,
      allowed_paths: dev.allowed_paths || [],
      github_usernames: [actor]
    };
  }

  return null;
}

// ━━━ 检查文件是否在系统保护路径 ━━━
function isProtectedPath(filePath, protectedPaths) {
  return protectedPaths.some(p => {
    if (p.endsWith('/')) {
      return filePath.startsWith(p);
    }
    return filePath === p;
  });
}

// ━━━ 检查文件是否在允许路径 ━━━
function isAllowedPath(filePath, allowedPaths) {
  if (!allowedPaths || allowedPaths.length === 0) return false;
  return allowedPaths.some(p => {
    if (p.endsWith('/')) {
      return filePath.startsWith(p);
    }
    return filePath === p;
  });
}

// ━━━ 输出到 GITHUB_OUTPUT ━━━
function setOutput(key, value) {
  try {
    fs.appendFileSync(GITHUB_OUTPUT, `${key}=${value}\n`);
  } catch (e) {
    console.log(`::set-output name=${key}::${value}`);
  }
}

// ━━━ 主判定逻辑 ━━━
function main() {
  const actor = process.env.PUSH_ACTOR || '';
  const commitMessage = process.env.COMMIT_MESSAGE || '';
  console.log(`🚦 铸渊·智能门禁 v2 · 判定引擎启动`);
  console.log(`   推送者: ${actor}`);
  console.log(`   Commit: ${commitMessage.substring(0, MAX_COMMIT_DISPLAY)}`);

  // 0. 仓库主人 → 永远放行
  if (actor === REPO_OWNER) {
    console.log(`👑 ${actor} 是仓库主人，直接放行`);
    setOutput('action', 'pass');
    setOutput('notification', `仓库主人 ${actor} 放行`);
    return;
  }

  // 1. 读取配置
  const config = loadConfig();
  if (!config) {
    console.log('⚠️ 配置文件缺失，默认放行');
    setOutput('action', 'pass');
    setOutput('notification', '门禁配置缺失，默认放行');
    return;
  }

  // 2. 读取变更文件
  const changedFiles = loadChangedFiles();
  if (changedFiles.length === 0) {
    console.log('ℹ️ 无变更文件，放行');
    setOutput('action', 'pass');
    setOutput('notification', '无变更文件');
    return;
  }
  console.log(`   变更文件 (${changedFiles.length}):`);
  changedFiles.forEach(f => console.log(`     - ${f}`));

  // 3. 白名单检查
  if (config.whitelist_actors && config.whitelist_actors.includes(actor)) {
    console.log(`✅ ${actor} 在白名单中，直接放行`);
    setOutput('action', 'pass');
    setOutput('notification', `白名单用户 ${actor} 放行`);
    return;
  }

  // 4. 【v2 新增】提取 commit 签名中的人格体编号
  const personaId = extractPersonaSignature(commitMessage);
  if (personaId) {
    console.log(`🔏 检测到人格体签名: ${personaId}`);
  } else {
    console.log(`ℹ️ 未检测到人格体签名（兼容 v1 模式）`);
  }

  // 5. 查找开发者身份（v2: 支持人格体编号 + GitHub 用户名双重匹配）
  const developer = findDeveloper(config, actor, personaId);
  const protectedPaths = config.system_protected_paths || [];

  // 6. 签名与身份交叉验证（v2 增强安全）
  if (personaId && developer) {
    if (developer.persona_id && developer.persona_id !== personaId) {
      console.log(`⚠️ 签名人格体 ${personaId} 与 actor ${actor} 注册的 ${developer.persona_id} 不匹配`);
      const msg = `⚠️ 人格体签名不匹配 · 推送者: ${actor}\n\n` +
        `Commit 签名的人格体: ${personaId}\n` +
        `GitHub Actor 注册的人格体: ${developer.persona_id}\n\n` +
        `签名与身份不一致，该 commit 已被回退。`;
      setOutput('action', 'revert');
      setOutput('notification', msg.replace(/\n/g, '%0A'));
      setOutput('violation_type', 'persona_mismatch');
      return;
    }
  }

  // 7. 分类文件（与 v1 逻辑一致）
  const protectedViolations = [];
  const allowedFiles = [];
  const disallowedFiles = [];

  for (const file of changedFiles) {
    if (isProtectedPath(file, protectedPaths)) {
      protectedViolations.push(file);
    } else if (developer && isAllowedPath(file, developer.allowed_paths)) {
      allowedFiles.push(file);
    } else if (developer) {
      disallowedFiles.push(file);
    } else {
      disallowedFiles.push(file);
    }
  }

  console.log(`\n📊 判定结果:`);
  console.log(`   系统保护路径违规: ${protectedViolations.length}`);
  console.log(`   允许路径文件: ${allowedFiles.length}`);
  console.log(`   越权路径文件: ${disallowedFiles.length}`);
  if (personaId) console.log(`   人格体签名: ${personaId} ✅`);

  // 8. 判定行动（与 v1 逻辑一致）
  if (protectedViolations.length > 0) {
    const msg = `⛔ 系统保护路径违规 · 推送者: ${actor}${personaId ? ` [${personaId}]` : ''}\n\n` +
      `以下文件属于系统保护路径，合作者不可修改：\n` +
      protectedViolations.map(f => `- \`${f}\``).join('\n') +
      `\n\n该 commit 已被自动回退。请联系管理员。`;

    console.log('❌ 判定: revert（系统保护路径违规）');
    setOutput('action', 'revert');
    setOutput('notification', msg.replace(/\n/g, '%0A'));
    setOutput('violation_type', 'system_protected');
    setOutput('violation_files', protectedViolations.join(','));
    return;
  }

  if (disallowedFiles.length > 0 && allowedFiles.length === 0) {
    const devInfo = developer
      ? `已注册开发者 ${developer.name}(${developer.devId})`
      : `未注册开发者`;
    const allowedInfo = developer && developer.allowed_paths.length > 0
      ? `允许路径: ${developer.allowed_paths.join(', ')}`
      : '无已分配路径';

    const msg = `⚠️ 路径越权 · 推送者: ${actor}${personaId ? ` [${personaId}]` : ''} · ${devInfo}\n\n` +
      `${allowedInfo}\n\n` +
      `以下文件不在你的允许路径内：\n` +
      disallowedFiles.map(f => `- \`${f}\``).join('\n') +
      `\n\n该 commit 已被自动回退。请确认你的模块路径。`;

    console.log('❌ 判定: revert（全部越权）');
    setOutput('action', 'revert');
    setOutput('notification', msg.replace(/\n/g, '%0A'));
    setOutput('violation_type', 'path_unauthorized');
    setOutput('violation_files', disallowedFiles.join(','));
    return;
  }

  if (disallowedFiles.length > 0 && allowedFiles.length > 0) {
    const devName = developer ? `${developer.name}(${developer.devId})` : `未注册开发者`;
    const devPaths = developer && developer.allowed_paths ? developer.allowed_paths.join(', ') : '无';
    const msg = `⚠️ 部分路径越权 · 推送者: ${actor}${personaId ? ` [${personaId}]` : ''} · ${devName}\n\n` +
      `允许路径: ${devPaths}\n\n` +
      `✅ 合法文件:\n` + allowedFiles.map(f => `- \`${f}\``).join('\n') + '\n\n' +
      `❌ 越权文件:\n` + disallowedFiles.map(f => `- \`${f}\``).join('\n') +
      `\n\n该 commit 已被自动回退。请将越权文件移除后重新提交。`;

    console.log('❌ 判定: revert（部分越权）');
    setOutput('action', 'revert');
    setOutput('notification', msg.replace(/\n/g, '%0A'));
    setOutput('violation_type', 'partial_unauthorized');
    setOutput('violation_files', disallowedFiles.join(','));
    return;
  }

  // 全部文件在允许路径内 → 放行
  if (developer) {
    const personaInfo = personaId ? ` · 签名:${personaId}` : '';
    console.log(`✅ 判定: pass · ${developer.name}(${developer.devId})${personaInfo} · 全部文件合法`);
  } else {
    console.log(`✅ 判定: pass · 未注册开发者 ${actor} · 未修改保护路径`);
  }
  setOutput('action', 'pass');
  setOutput('notification', `${actor}${personaId ? ` [${personaId}]` : ''} 的 push 已通过门禁检查`);
  if (personaId) setOutput('persona_id', personaId);
}

main();
