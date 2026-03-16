// scripts/gate-guard.js
// 铸渊·智能门禁·判定引擎
//
// 输入：PUSH_ACTOR（推送者 GitHub username）+ /tmp/changed_files.txt
// 输出：action（pass/fix/revert）+ 相关信息 → GITHUB_OUTPUT
//
// 判定流程：
// 1. 读取门禁配置（开发者→路径映射）
// 2. 读取本次修改的文件列表
// 3. 识别推送者身份
// 4. 判定：pass / fix / revert

const fs = require('fs');
const path = require('path');

// ━━━ 配置路径 ━━━
const CONFIG_PATH = path.join(__dirname, '../.github/persona-brain/gate-guard-config.json');
const CHANGED_FILES_PATH = '/tmp/changed_files.txt';
const GITHUB_OUTPUT = process.env.GITHUB_OUTPUT || '/dev/null';

// ━━━ 读取配置 ━━━
function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (e) {
    console.error('⚠️ 无法读取门禁配置:', e.message);
    return null;
  }
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

// ━━━ 查找开发者权限 ━━━
function findDeveloper(config, actor) {
  if (!config || !config.developer_permissions) return null;

  for (const [devId, dev] of Object.entries(config.developer_permissions)) {
    if (dev.github_usernames && dev.github_usernames.includes(actor)) {
      return { devId, ...dev };
    }
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

  // 3. 检查是否为白名单用户
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
