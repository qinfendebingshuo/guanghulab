#!/usr/bin/env node

/**
 * 🌀 铸渊人格协议 · 模块生命周期管理脚本 v1.0
 *
 * 用法:
 *   node scripts/zhuyuan-module-protocol.js inspect              # 全模块检查
 *   node scripts/zhuyuan-module-protocol.js inspect <module-id>  # 单模块检查
 *   node scripts/zhuyuan-module-protocol.js status               # 模块状态汇总
 *   node scripts/zhuyuan-module-protocol.js recover <module-id>  # 模块回收检查
 *   node scripts/zhuyuan-module-protocol.js preview              # 预演报告生成
 *
 * 纯 Node.js，无外部依赖。
 */

const fs = require('fs');
const path = require('path');

// === 配置 ===
const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github', 'brain');
const DOCS_DIR = path.join(ROOT, 'docs');

// 模块注册表
const MODULE_REGISTRY = {
  'm01-login':       { owner: 'DEV-002', name: '肥猫', hli: 'AUTH',      label: '登录模块' },
  'm03-personality': { owner: 'DEV-002', name: '肥猫', hli: 'PERSONA',   label: '人格模块' },
  'm05-user-center': { owner: 'DEV-009', name: '花尔', hli: 'USER',      label: '用户中心' },
  'm06-ticket':      { owner: 'DEV-010', name: '桔子', hli: 'TICKET',    label: '工单系统' },
  'm07-dialogue-ui': { owner: 'DEV-003', name: '燕樊', hli: 'DIALOGUE',  label: '对话界面' },
  'm10-cloud':       { owner: 'DEV-003', name: '燕樊', hli: 'STORAGE',   label: '云存储' },
  'm11-module':      { owner: 'DEV-010', name: '桔子', hli: 'MODULE',    label: '模块管理' },
  'm12-kanban':      { owner: 'DEV-005', name: '小草莓', hli: 'DASHBOARD', label: '看板' },
  'm15-cloud-drive': { owner: 'DEV-003', name: '燕樊', hli: 'STORAGE',   label: '云盘' },
  'm18-health-check':{ owner: null,      name: '待分配', hli: 'SYSTEM',   label: '健康检查' },
};

// === 工具函数 ===

function countFiles(dir) {
  if (!fs.existsSync(dir)) return 0;
  let count = 0;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of items) {
    if (item.name.startsWith('.')) continue;
    if (item.isFile()) count++;
    else if (item.isDirectory()) count += countFiles(path.join(dir, item.name));
  }
  return count;
}

function hasReadme(dir) {
  return fs.existsSync(path.join(dir, 'README.md'));
}

function getModuleStatus(moduleDir) {
  const fullPath = path.join(ROOT, moduleDir);
  if (!fs.existsSync(fullPath)) return { exists: false, files: 0, readme: false };

  const files = countFiles(fullPath);
  const readme = hasReadme(fullPath);

  let status = '📭 空';
  if (files > 0 && readme) status = '✅ 正常';
  else if (files > 0 && !readme) status = '⚠️ 缺README';
  else if (files === 0) status = '📭 空';

  return { exists: true, files, readme, status };
}

// === 命令：inspect ===

function cmdInspect(moduleId) {
  console.log('🌀 铸渊人格协议 · 模块检查');
  console.log('─'.repeat(50));

  if (moduleId) {
    // 单模块检查
    const info = MODULE_REGISTRY[moduleId];
    if (!info) {
      console.log(`❌ 未知模块: ${moduleId}`);
      console.log(`已注册模块: ${Object.keys(MODULE_REGISTRY).join(', ')}`);
      process.exit(1);
    }

    const status = getModuleStatus(moduleId);
    console.log(`\n📦 模块: ${moduleId} (${info.label})`);
    console.log(`   负责人: ${info.name} (${info.owner || '未分配'})`);
    console.log(`   HLI 域: ${info.hli}`);
    console.log(`   目录存在: ${status.exists ? '✅' : '❌'}`);
    console.log(`   文件数量: ${status.files}`);
    console.log(`   README: ${status.readme ? '✅' : '❌'}`);
    console.log(`   状态: ${status.status}`);

    // 检查 HLI 接口
    const schemaDir = path.join(ROOT, 'src', 'schemas', 'hli', info.hli.toLowerCase());
    const routeDir = path.join(ROOT, 'src', 'routes', 'hli', info.hli.toLowerCase());

    if (fs.existsSync(schemaDir)) {
      try {
        const schemas = fs.readdirSync(schemaDir).filter(f => f.endsWith('.schema.json'));
        console.log(`   HLI Schema: ${schemas.length} 个 (${schemas.join(', ')})`);
      } catch (e) {
        console.log(`   HLI Schema: ⚠️ 读取失败 (${e.code || e.message})`);
      }
    } else {
      console.log(`   HLI Schema: 📭 未创建`);
    }

    if (fs.existsSync(routeDir)) {
      try {
        const routes = fs.readdirSync(routeDir).filter(f => f.endsWith('.js'));
        console.log(`   HLI 路由: ${routes.length} 个 (${routes.join(', ')})`);
      } catch (e) {
        console.log(`   HLI 路由: ⚠️ 读取失败 (${e.code || e.message})`);
      }
    } else {
      console.log(`   HLI 路由: 📭 未创建`);
    }
  } else {
    // 全模块检查
    console.log('\n📋 全模块状态:\n');
    console.log('模块ID              | 标签     | 负责人   | 文件 | README | 状态');
    console.log('─'.repeat(70));

    for (const [id, info] of Object.entries(MODULE_REGISTRY)) {
      const status = getModuleStatus(id);
      const line = [
        id.padEnd(20),
        info.label.padEnd(8),
        info.name.padEnd(8),
        String(status.files).padStart(4),
        (status.readme ? '✅' : '❌').padEnd(6),
        status.status,
      ].join(' | ');
      console.log(line);
    }
  }
}

// === 命令：status ===

function cmdStatus() {
  console.log('🌀 铸渊人格协议 · 模块状态汇总');
  console.log('─'.repeat(50));

  let total = 0, ok = 0, warn = 0, empty = 0;

  for (const [id] of Object.entries(MODULE_REGISTRY)) {
    total++;
    const status = getModuleStatus(id);
    if (status.files > 0 && status.readme) ok++;
    else if (status.files > 0) warn++;
    else empty++;
  }

  console.log(`\n📊 模块统计:`);
  console.log(`   总模块数: ${total}`);
  console.log(`   ✅ 正常: ${ok}`);
  console.log(`   ⚠️ 告警: ${warn}`);
  console.log(`   📭 空模块: ${empty}`);
  console.log(`   完成率: ${Math.round((ok / total) * 100)}%`);

  // 检查前端
  const indexPath = path.join(DOCS_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    const stat = fs.statSync(indexPath);
    const lines = fs.readFileSync(indexPath, 'utf8').split('\n').length;
    console.log(`\n🌐 前端:`);
    console.log(`   docs/index.html: ${lines} 行, ${(stat.size / 1024).toFixed(1)} KB`);
  }

  // 检查 CNAME
  const cnamePath = path.join(DOCS_DIR, 'CNAME');
  if (fs.existsSync(cnamePath)) {
    const domain = fs.readFileSync(cnamePath, 'utf8').trim();
    console.log(`   自定义域名: ${domain}`);
  } else {
    console.log(`   自定义域名: ❌ 未配置`);
  }

  // 检查大脑文件
  console.log(`\n🧠 大脑状态:`);
  const brainFiles = ['repo-snapshot.md', 'repo-map.json', 'memory.json', 'collaborators.json', 'module-protocol.md'];
  for (const f of brainFiles) {
    const fp = path.join(BRAIN_DIR, f);
    if (fs.existsSync(fp)) {
      const stat = fs.statSync(fp);
      console.log(`   ✅ ${f} (${(stat.size / 1024).toFixed(1)} KB)`);
    } else {
      console.log(`   ❌ ${f} 缺失`);
    }
  }
}

// === 命令：recover ===

function cmdRecover(moduleId) {
  if (!moduleId) {
    console.log('❌ 请指定模块ID，如: npm run module:protocol -- recover m01-login');
    process.exit(1);
  }

  const info = MODULE_REGISTRY[moduleId];
  if (!info) {
    console.log(`❌ 未知模块: ${moduleId}`);
    process.exit(1);
  }

  console.log('🌀 铸渊人格协议 · 模块回收检查');
  console.log('─'.repeat(50));
  console.log(`\n📦 目标模块: ${moduleId} (${info.label})`);

  const status = getModuleStatus(moduleId);
  console.log(`   当前状态: ${status.status}`);
  console.log(`   文件数量: ${status.files}`);

  if (status.files === 0) {
    console.log(`\n✅ 模块已为空状态，无需回收。`);
    return;
  }

  console.log(`\n⚠️ 回收操作需要手动执行:`);
  console.log(`   方法一（推荐）: 通过 PR 删除模块文件`);
  console.log(`   方法二: git revert 恢复到模块的上一个版本`);
  console.log(`   方法三: 直接在 GitHub 界面删除文件`);
  console.log(`\n💡 回收后，铸渊会通过 generate-module-doc.yml 更新文档索引。`);
}

// === 命令：preview ===

function cmdPreview() {
  console.log('🌀 铸渊人格协议 · 本地预演报告');
  console.log('═'.repeat(50));

  // 模块状态
  cmdStatus();

  console.log('\n');
  console.log('─'.repeat(50));
  console.log('🎯 预演结论:');

  let ok = true;
  const issues = [];

  // 检查 index.html
  if (!fs.existsSync(path.join(DOCS_DIR, 'index.html'))) {
    issues.push('docs/index.html 不存在');
    ok = false;
  }

  // 检查工作流
  const wfDir = path.join(ROOT, '.github', 'workflows');
  if (!fs.existsSync(path.join(wfDir, 'deploy-pages.yml'))) {
    issues.push('deploy-pages.yml 不存在');
    ok = false;
  }

  if (ok && issues.length === 0) {
    console.log('✅ 预演通过 — 代码可以安全部署到生产环境');
    console.log('   下一步: 合并 PR 到 main 分支，触发自动部署');
  } else {
    console.log('❌ 预演未通过:');
    issues.forEach(i => console.log(`   - ${i}`));
  }
}

// === 主入口 ===

const [,, command, ...args] = process.argv;

switch (command) {
  case 'inspect':
    cmdInspect(args[0]);
    break;
  case 'status':
    cmdStatus();
    break;
  case 'recover':
    cmdRecover(args[0]);
    break;
  case 'preview':
    cmdPreview();
    break;
  default:
    console.log('🌀 铸渊人格协议 · 模块生命周期管理 v1.0');
    console.log('');
    console.log('用法:');
    console.log('  node scripts/zhuyuan-module-protocol.js inspect              全模块检查');
    console.log('  node scripts/zhuyuan-module-protocol.js inspect <module-id>  单模块检查');
    console.log('  node scripts/zhuyuan-module-protocol.js status               模块状态汇总');
    console.log('  node scripts/zhuyuan-module-protocol.js recover <module-id>  模块回收检查');
    console.log('  node scripts/zhuyuan-module-protocol.js preview              本地预演报告');
    console.log('');
    console.log('npm 快捷命令:');
    console.log('  npm run module:protocol -- inspect');
    console.log('  npm run module:protocol -- status');
    console.log('  npm run module:protocol -- preview');
    break;
}
