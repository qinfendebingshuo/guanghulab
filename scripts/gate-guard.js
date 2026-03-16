// scripts/gate-guard.js
// 铸渊·智能门禁·判定引擎
//
// 核心原则（冰朔 2026-03-16 确认）：
//   仓库主人（repo_owner）的推送 → 永远放行，不拦截
//   其他所有非主人推送 → 按门禁系统拦截分流
//
// 输入：PUSH_ACTOR（推送者 GitHub username）+ /tmp/changed_files.txt
// 输出：action（pass/fix/revert）+ 相关信息 → GITHUB_OUTPUT
//
// 判定流程：
// 1. 读取门禁配置（两套配置合并）
// 2. 检查是否为仓库主人 → 直接放行
// 3. 检查是否为白名单用户 → 直接放行
// 4. 识别开发者身份 → 检查路径权限
// 5. 未注册开发者 → 拦截

const fs = require('fs');
const path = require('path');

// ━━━ 配置路径 ━━━
const BRAIN_CONFIG_PATH = path.join(__dirname, '../.github/persona-brain/gate-guard-config.json');
const OWNER_CONFIG_PATH = path.join(__dirname, '../.github/gate-guard-config.json');
const CHANGED_FILES_PATH = '/tmp/changed_files.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 仓库主人（冰朔确认）━━━
// 硬编码默认值，config.repo_owner 可覆盖此值
const REPO_OWNER = 'qinfendebingshuo';

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

  // 以 persona-brain 配置为主体，合并 owner 配置中的信息
  const config = brainConfig || {
    whitelist_actors: [],
    system_protected_paths: [],
    developer_permissions: {}
  };

  // 确保仓库主人在白名单中
  if (!config.whitelist_actors) config.whitelist_actors = [];
  // 从配置中读取 repo_owner，或使用硬编码默认值
  const repoOwner = config.repo_owner || REPO_OWNER;
  if (!config.whitelist_actors.includes(repoOwner)) {
    config.whitelist_actors.push(repoOwner);
  }
  config.repo_owner = repoOwner;

  // 从 owner 配置（冰朔确认版）合并白名单和开发者映射
  if (ownerConfig) {
    // 合并白名单
    const ownerWhitelist = ownerConfig.whitelist || [];
    for (const user of ownerWhitelist) {
      if (!config.whitelist_actors.includes(user)) {
        config.whitelist_actors.push(user);
      }
    }

    // 从冰朔确认版开发者映射中提取信息
    // key 为 GitHub 用户名，可直接用于 actor 匹配
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

// ━━━ 查找开发者权限（双配置源查找） ━━━
function findDeveloper(config, actor) {
  if (!config) return null;

  // 1. 先从 persona-brain 配置（DEV-ID 索引）中按 github_usernames 查找
  if (config.developer_permissions) {
    for (const [devId, dev] of Object.entries(config.developer_permissions)) {
      if (dev.github_usernames && dev.github_usernames.includes(actor)) {
        return { devId, ...dev };
      }
    }
  }

  // 2. 再从冰朔确认版配置（GitHub 用户名索引）中查找
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
    // Fallback for local testing
    console.log(`::set-output name=${key}::${value}`);
  }
}

// ━━━ 主判定逻辑 ━━━
function main() {
  const actor = process.env.PUSH_ACTOR || '';
  console.log(`🚦 铸渊·智能门禁 · 判定引擎启动`);
  console.log(`   推送者: ${actor}`);

  // 0. 仓库主人 → 永远放行（冰朔确认原则）
  //    优先使用 config.repo_owner，回退到硬编码 REPO_OWNER
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

  // 3. 检查是否为白名单用户（系统bot、管理员等）
  if (config.whitelist_actors && config.whitelist_actors.includes(actor)) {
    console.log(`✅ ${actor} 在白名单中，直接放行`);
    setOutput('action', 'pass');
    setOutput('notification', `白名单用户 ${actor} 放行`);
    return;
  }

  // 4. 查找开发者身份
  const developer = findDeveloper(config, actor);
  const protectedPaths = config.system_protected_paths || [];

  // 5. 分类文件
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
      // 未注册开发者 - 非保护路径也标记为越权
      disallowedFiles.push(file);
    }
  }

  console.log(`\n📊 判定结果:`);
  console.log(`   系统保护路径违规: ${protectedViolations.length}`);
  console.log(`   允许路径文件: ${allowedFiles.length}`);
  console.log(`   越权路径文件: ${disallowedFiles.length}`);

  // 6. 判定行动
  if (protectedViolations.length > 0) {
    // 触碰系统保护路径 → 回退
    const msg = `⛔ 系统保护路径违规 · 推送者: ${actor}\n\n` +
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
    // 全部文件都在越权路径 → 回退
    const devInfo = developer
      ? `已注册开发者 ${developer.name}(${developer.devId})`
      : `未注册开发者`;
    const allowedInfo = developer && developer.allowed_paths.length > 0
      ? `允许路径: ${developer.allowed_paths.join(', ')}`
      : '无已分配路径';

    const msg = `⚠️ 路径越权 · 推送者: ${actor} · ${devInfo}\n\n` +
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
    // 部分文件越权，部分合法 → 回退整个 commit（不做部分修复，避免复杂性）
    const devName = developer ? `${developer.name}(${developer.devId})` : `未注册开发者`;
    const devPaths = developer && developer.allowed_paths ? developer.allowed_paths.join(', ') : '无';
    const msg = `⚠️ 部分路径越权 · 推送者: ${actor} · ${devName}\n\n` +
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
    console.log(`✅ 判定: pass · ${developer.name}(${developer.devId}) · 全部文件合法`);
  } else {
    console.log(`✅ 判定: pass · 未注册开发者 ${actor} · 未修改保护路径`);
  }
  setOutput('action', 'pass');
  setOutput('notification', `${actor} 的 push 已通过门禁检查`);
}

main();
