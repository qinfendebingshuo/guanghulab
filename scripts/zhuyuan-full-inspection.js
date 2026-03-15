/**
 * scripts/zhuyuan-full-inspection.js
 * 铸渊全面排查脚本 · AGE OS v1.0 Phase 1 Step 1
 *
 * 铸渊核心大脑醒来后，全面排查仓库现状。
 * 排查覆盖 8 个领域：
 *   1. 仓库整体结构
 *   2. 自动化流程现状
 *   3. 仓库首页和入口
 *   4. 公告栏和系统更新
 *   5. 服务状态
 *   6. 密钥和凭证（仅检查存在性）
 *   7. 与四节点的连接状态
 *   8. 人格体机器人托管现状
 *
 * 调用方式：
 *   node scripts/zhuyuan-full-inspection.js
 *   node scripts/zhuyuan-full-inspection.js --json
 *   node scripts/zhuyuan-full-inspection.js --output report.json
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ══════════════════════════════════════════════════════════
// Area 1: 仓库整体结构
// ══════════════════════════════════════════════════════════

function inspectRepoStructure() {
  console.log('\n📂 ═══ Area 1: 仓库整体结构 ═══');
  const result = {
    area: '仓库整体结构',
    directories: {},
    config_files: {},
    doc_files: {},
    issues: [],
  };

  // 核心目录
  const coreDirs = [
    { path: 'brain', category: '核心', desc: '系统大脑/知识库' },
    { path: 'core', category: '核心', desc: '核心系统模块' },
    { path: 'connectors', category: '核心', desc: '外部集成连接器' },
    { path: 'src', category: '核心', desc: '源代码' },
    { path: 'scripts', category: '核心', desc: '自动化脚本' },
    { path: '.github/workflows', category: '核心', desc: 'GitHub Actions 工作流' },
    { path: 'backend', category: '功能', desc: '后端服务' },
    { path: 'backend-integration', category: '功能', desc: 'API 代理和集成' },
    { path: 'persona-studio', category: '功能', desc: '人格工作室' },
    { path: 'persona-brain-db', category: '功能', desc: '人格知识数据库' },
    { path: 'dingtalk-bot', category: '功能', desc: '钉钉机器人' },
    { path: 'frontend', category: '功能', desc: '前端代码' },
    { path: 'docs', category: '文档', desc: '文档' },
    { path: 'tests', category: '测试', desc: '测试套件' },
    { path: 'broadcasts', category: '数据', desc: '广播数据' },
    { path: 'bulletin-board', category: '数据', desc: '公告栏系统' },
    { path: 'notification', category: '功能', desc: '通知系统' },
    { path: 'dashboard', category: '功能', desc: '仪表盘' },
    { path: 'modules', category: '功能', desc: '功能模块' },
    { path: 'cloud-drive', category: '功能', desc: '云存储' },
  ];

  for (const dir of coreDirs) {
    const fullPath = path.join(ROOT, dir.path);
    const exists = fs.existsSync(fullPath);
    let fileCount = 0;
    if (exists) {
      try {
        fileCount = fs.readdirSync(fullPath).length;
      } catch {
        // Directory exists but is unreadable — use 0 as fallback
      }
    }
    result.directories[dir.path] = {
      exists,
      category: dir.category,
      description: dir.desc,
      fileCount,
    };
    const icon = exists ? '✅' : '❌';
    console.log(`  ${icon} ${dir.path} (${dir.category}) — ${dir.desc}${exists ? ` [${fileCount} items]` : ''}`);
    if (!exists && dir.category === '核心') {
      result.issues.push(`缺少核心目录: ${dir.path}`);
    }
  }

  // 配置文件
  const configFiles = [
    'package.json', 'ecosystem.config.js', 'config.js',
    '.gitignore', 'tsconfig.json', 'next.config.ts',
  ];
  for (const f of configFiles) {
    const exists = fs.existsSync(path.join(ROOT, f));
    result.config_files[f] = exists;
    console.log(`  ${exists ? '✅' : '❌'} 配置: ${f}`);
  }

  // 文档完整度
  const docFiles = [
    'README.md', 'docs/repo-structure-map.md', 'docs/notion-bridge-map.md',
    'brain/master-brain.md', 'brain/read-order.md',
  ];
  for (const f of docFiles) {
    const exists = fs.existsSync(path.join(ROOT, f));
    result.doc_files[f] = exists;
    console.log(`  ${exists ? '✅' : '❌'} 文档: ${f}`);
    if (!exists) {
      result.issues.push(`缺少文档: ${f}`);
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 2: 自动化流程现状
// ══════════════════════════════════════════════════════════

function inspectAutomation() {
  console.log('\n⚙️  ═══ Area 2: 自动化流程现状 ═══');
  const result = {
    area: '自动化流程现状',
    workflows: [],
    scripts: [],
    issues: [],
  };

  // 工作流文件
  const workflowDir = path.join(ROOT, '.github/workflows');
  if (fs.existsSync(workflowDir)) {
    const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    console.log(`  ✅ 发现 ${files.length} 个工作流文件`);

    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowDir, file), 'utf-8');
      const nameMatch = content.match(/^name:\s*["']?(.+?)["']?\s*$/m);
      const cronMatch = content.match(/cron:\s*'([^']+)'/);
      const hasWorkflowDispatch = content.includes('workflow_dispatch');

      const workflow = {
        file,
        name: nameMatch ? nameMatch[1] : file,
        hasCron: !!cronMatch,
        cron: cronMatch ? cronMatch[1] : null,
        hasManualTrigger: hasWorkflowDispatch,
        category: categorizeWorkflow(file),
      };
      result.workflows.push(workflow);
      console.log(`    📋 ${file} — ${workflow.name}${workflow.hasCron ? ` [cron: ${workflow.cron}]` : ''}${workflow.hasManualTrigger ? ' [手动]' : ''}`);
    }
  } else {
    result.issues.push('工作流目录不存在');
    console.log('  ❌ 工作流目录不存在');
  }

  // 脚本文件
  const scriptsDir = path.join(ROOT, 'scripts');
  if (fs.existsSync(scriptsDir)) {
    const files = fs.readdirSync(scriptsDir).filter(f => f.endsWith('.js'));
    console.log(`  ✅ 发现 ${files.length} 个自动化脚本`);

    for (const file of files) {
      result.scripts.push({
        file,
        category: categorizeScript(file),
      });
    }
  }

  // 核心模块
  const coreModules = [
    'core/broadcast-listener/index.js',
    'core/task-queue/index.js',
    'core/system-check/index.js',
    'core/execution-sync/index.js',
    'core/context-loader/index.js',
    'core/brain-wake/index.js',
    'connectors/notion-sync/index.js',
    'connectors/notion-wake-listener/index.js',
    'connectors/model-router/index.js',
  ];
  console.log('\n  🔧 核心模块:');
  for (const mod of coreModules) {
    const exists = fs.existsSync(path.join(ROOT, mod));
    console.log(`    ${exists ? '✅' : '❌'} ${mod}`);
    if (!exists) {
      result.issues.push(`缺少核心模块: ${mod}`);
    }
  }

  return result;
}

function categorizeWorkflow(filename) {
  if (filename.includes('deploy')) return '部署';
  if (filename.includes('maintenance') || filename.includes('selfcheck')) return '维护';
  if (filename.includes('agent')) return 'Agent';
  if (filename.includes('brain') || filename.includes('sync')) return '同步';
  if (filename.includes('syslog') || filename.includes('pipeline')) return '管线';
  if (filename.includes('notion')) return 'Notion';
  if (filename.includes('ps-on')) return '人格体';
  if (filename.includes('bridge')) return '桥接';
  return '其他';
}

function categorizeScript(filename) {
  if (filename.includes('generate-')) return '生成器';
  if (filename.includes('zhuyuan-')) return '铸渊';
  if (filename.includes('bingshuo-')) return '冰朔';
  if (filename.includes('notion-') || filename.includes('sync')) return 'Notion';
  if (filename.includes('wake-') || filename.includes('invoke-')) return '唤醒';
  if (filename.includes('push-') || filename.includes('distribute')) return '广播';
  if (filename.includes('syslog') || filename.includes('pipeline')) return '管线';
  return '工具';
}

// ══════════════════════════════════════════════════════════
// Area 3: 仓库首页和入口
// ══════════════════════════════════════════════════════════

function inspectEntryPoints() {
  console.log('\n🏠 ═══ Area 3: 仓库首页和入口 ═══');
  const result = {
    area: '仓库首页和入口',
    readme: null,
    entryPoints: {},
    issues: [],
  };

  // README.md
  const readmePath = path.join(ROOT, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf-8');
    result.readme = {
      exists: true,
      length: content.length,
      hasTitle: content.includes('#'),
      hasBulletin: content.includes('公告') || content.includes('bulletin'),
      hasDevGuide: content.includes('开发') || content.includes('developer') || content.includes('指南'),
    };
    console.log(`  ✅ README.md (${content.length} chars)`);
    console.log(`    标题: ${result.readme.hasTitle ? '✅' : '❌'}`);
    console.log(`    公告栏: ${result.readme.hasBulletin ? '✅' : '❌'}`);
    console.log(`    开发指南: ${result.readme.hasDevGuide ? '✅' : '❌'}`);
  } else {
    result.readme = { exists: false };
    result.issues.push('README.md 不存在');
    console.log('  ❌ README.md 不存在');
  }

  // 开发者入口
  const entryPoints = [
    { path: 'frontend/index.html', desc: '前端入口' },
    { path: 'index.html', desc: '主页入口' },
    { path: 'index.js', desc: '主 JS 入口' },
    { path: 'src/index.js', desc: 'src 入口' },
    { path: 'homepage/index.html', desc: '首页入口' },
    { path: 'portal/index.html', desc: '门户入口' },
    { path: 'dashboard/index.html', desc: '仪表盘入口' },
  ];
  for (const entry of entryPoints) {
    const exists = fs.existsSync(path.join(ROOT, entry.path));
    result.entryPoints[entry.path] = { exists, description: entry.desc };
    console.log(`  ${exists ? '✅' : '⏭️ '} ${entry.desc}: ${entry.path}`);
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 4: 公告栏和系统更新
// ══════════════════════════════════════════════════════════

function inspectBulletins() {
  console.log('\n📢 ═══ Area 4: 公告栏和系统更新 ═══');
  const result = {
    area: '公告栏和系统更新',
    bulletinBoard: {},
    systemLogs: {},
    issues: [],
  };

  // 公告栏目录
  const bulletinDir = path.join(ROOT, 'bulletin-board');
  if (fs.existsSync(bulletinDir)) {
    const files = fs.readdirSync(bulletinDir);
    result.bulletinBoard.exists = true;
    result.bulletinBoard.fileCount = files.length;
    console.log(`  ✅ bulletin-board/ (${files.length} 文件)`);
  } else {
    result.bulletinBoard.exists = false;
    console.log('  ❌ bulletin-board/ 不存在');
  }

  // brain 公告缓存
  const cacheFile = path.join(ROOT, '.github/brain/bulletin-board-today.json');
  if (fs.existsSync(cacheFile)) {
    try {
      const cache = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      result.bulletinBoard.cacheDate = cache.date || 'unknown';
      result.bulletinBoard.cacheRecords = (cache.records || []).length;
      console.log(`  ✅ 公告栏缓存日期: ${cache.date} (${(cache.records || []).length} 条记录)`);
    } catch (err) {
      console.log('  ⚠️  公告栏缓存 JSON 解析失败:', err.message);
    }
  } else {
    console.log('  ⏭️  公告栏缓存文件不存在');
  }

  // 广播目录
  const broadcastsDirs = ['broadcasts', 'broadcasts-outbox'];
  for (const dir of broadcastsDirs) {
    const fullPath = path.join(ROOT, dir);
    if (fs.existsSync(fullPath)) {
      const files = fs.readdirSync(fullPath);
      result.systemLogs[dir] = { exists: true, fileCount: files.length };
      console.log(`  ✅ ${dir}/ (${files.length} 文件)`);
    } else {
      result.systemLogs[dir] = { exists: false };
      console.log(`  ⏭️  ${dir}/ 不存在`);
    }
  }

  // 公告相关工作流
  const bulletinWorkflows = ['update-readme-bulletin.yml'];
  for (const wf of bulletinWorkflows) {
    const exists = fs.existsSync(path.join(ROOT, '.github/workflows', wf));
    console.log(`  ${exists ? '✅' : '❌'} 工作流: ${wf}`);
    if (!exists) {
      result.issues.push(`缺少公告工作流: ${wf}`);
    }
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 5: 服务状态
// ══════════════════════════════════════════════════════════

function inspectServices() {
  console.log('\n🖥️  ═══ Area 5: 服务状态 ═══');
  const result = {
    area: '服务状态',
    services: [],
    configs: {},
    issues: [],
  };

  // PM2 配置
  const ecosystemPath = path.join(ROOT, 'ecosystem.config.js');
  if (fs.existsSync(ecosystemPath)) {
    try {
      const content = fs.readFileSync(ecosystemPath, 'utf-8');
      const appMatches = content.match(/name\s*:\s*['"]([^'"]+)['"]/g) || [];
      const apps = appMatches.map(m => m.match(/['"]([^'"]+)['"]/)[1]);
      result.services = apps.map(name => ({ name, source: 'ecosystem.config.js' }));
      console.log(`  ✅ ecosystem.config.js (${apps.length} 个应用)`);
      apps.forEach(app => console.log(`    📋 ${app}`));
    } catch {
      console.log('  ⚠️  ecosystem.config.js 解析失败');
    }
  } else {
    result.issues.push('ecosystem.config.js 不存在');
    console.log('  ❌ ecosystem.config.js 不存在');
  }

  // Nginx 配置
  const nginxPath = path.join(ROOT, 'backend-integration/nginx-api-proxy.conf');
  if (fs.existsSync(nginxPath)) {
    const content = fs.readFileSync(nginxPath, 'utf-8');
    const locationMatches = content.match(/location\s+([^\s{]+)/g) || [];
    result.configs.nginx = {
      exists: true,
      routes: locationMatches.map(m => m.replace('location ', '')),
    };
    console.log(`  ✅ nginx-api-proxy.conf (${locationMatches.length} 路由)`);
    locationMatches.forEach(m => console.log(`    📋 ${m}`));
  } else {
    result.configs.nginx = { exists: false };
    console.log('  ⏭️  nginx-api-proxy.conf 不存在');
  }

  // 后端服务文件
  const backendFiles = [
    'backend/server.js',
    'backend-integration/api-proxy.js',
    'persona-studio/backend/server.js',
  ];
  for (const f of backendFiles) {
    const exists = fs.existsSync(path.join(ROOT, f));
    result.configs[f] = exists;
    console.log(`  ${exists ? '✅' : '⏭️ '} ${f}`);
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 6: 密钥和凭证
// ══════════════════════════════════════════════════════════

function inspectCredentials() {
  console.log('\n🔑 ═══ Area 6: 密钥和凭证（存在性检查）═══');
  const result = {
    area: '密钥和凭证',
    envVars: {},
    secretsUsed: [],
    issues: [],
  };

  // 检查环境变量中可能的密钥配置
  const envKeys = [
    { key: 'NOTION_TOKEN', purpose: 'Notion API 访问', category: 'Notion' },
    { key: 'LLM_API_KEY', purpose: 'LLM 平台通用密钥', category: 'LLM' },
    { key: 'LLM_BASE_URL', purpose: 'LLM 平台 API 地址', category: 'LLM' },
    { key: 'ANTHROPIC_API_KEY', purpose: 'Anthropic Claude API', category: 'LLM' },
    { key: 'OPENAI_API_KEY', purpose: 'OpenAI GPT API', category: 'LLM' },
    { key: 'DASHSCOPE_API_KEY', purpose: '通义千问 API', category: 'LLM' },
    { key: 'DEEPSEEK_API_KEY', purpose: 'DeepSeek API', category: 'LLM' },
    { key: 'GITHUB_TOKEN', purpose: 'GitHub API 访问', category: 'GitHub' },
    { key: 'FEISHU_APP_ID', purpose: '飞书应用 ID', category: '飞书' },
    { key: 'FEISHU_APP_SECRET', purpose: '飞书应用密钥', category: '飞书' },
    { key: 'DINGTALK_TOKEN', purpose: '钉钉机器人 Token', category: '钉钉' },
  ];

  for (const env of envKeys) {
    const isSet = !!process.env[env.key];
    result.envVars[env.key] = {
      isSet,
      purpose: env.purpose,
      category: env.category,
    };
    console.log(`  ${isSet ? '✅' : '⏭️ '} ${env.key} — ${env.purpose} (${env.category})`);
  }

  // 扫描工作流文件中引用的 secrets
  const workflowDir = path.join(ROOT, '.github/workflows');
  if (fs.existsSync(workflowDir)) {
    const files = fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));
    const secretsSet = new Set();
    for (const file of files) {
      const content = fs.readFileSync(path.join(workflowDir, file), 'utf-8');
      const matches = content.match(/secrets\.([A-Z_]+)/g) || [];
      matches.forEach(m => secretsSet.add(m.replace('secrets.', '')));
    }
    result.secretsUsed = Array.from(secretsSet).sort();
    console.log(`\n  📋 工作流中引用的 Secrets (${result.secretsUsed.length} 个):`);
    result.secretsUsed.forEach(s => console.log(`    🔐 ${s}`));
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 7: 与四节点的连接状态
// ══════════════════════════════════════════════════════════

function inspectNodeConnections() {
  console.log('\n🔗 ═══ Area 7: 与四节点的连接状态 ═══');
  const result = {
    area: '四节点连接状态',
    nodes: {},
    issues: [],
  };

  // GitHub ↔ Notion
  const notionConnectors = [
    'connectors/notion-sync/index.js',
    'scripts/notion-signal-bridge.js',
    'scripts/notion-heartbeat.js',
    'scripts/write-notion-syslog.js',
  ];
  const notionConnected = notionConnectors.filter(f => fs.existsSync(path.join(ROOT, f)));
  result.nodes['Notion'] = {
    connectors: notionConnected.length,
    total: notionConnectors.length,
    files: notionConnectors.map(f => ({ path: f, exists: fs.existsSync(path.join(ROOT, f)) })),
  };
  console.log(`  📋 GitHub ↔ Notion: ${notionConnected.length}/${notionConnectors.length} 连接器`);
  notionConnectors.forEach(f => {
    const exists = fs.existsSync(path.join(ROOT, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  });

  // GitHub ↔ 服务器 (guanghulab.com)
  const serverConnectors = [
    'backend/server.js',
    'backend-integration/api-proxy.js',
    'ecosystem.config.js',
    'backend-integration/nginx-api-proxy.conf',
  ];
  const serverConnected = serverConnectors.filter(f => fs.existsSync(path.join(ROOT, f)));
  result.nodes['服务器'] = {
    connectors: serverConnected.length,
    total: serverConnectors.length,
    files: serverConnectors.map(f => ({ path: f, exists: fs.existsSync(path.join(ROOT, f)) })),
  };
  console.log(`  📋 GitHub ↔ guanghulab.com: ${serverConnected.length}/${serverConnectors.length} 连接器`);
  serverConnectors.forEach(f => {
    const exists = fs.existsSync(path.join(ROOT, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  });

  // GitHub ↔ 飞书
  const feishuConnectors = [
    'scripts/send-feishu-alert.js',
    'backend/routes/feishu-bot.js',
  ];
  const feishuFiles = feishuConnectors.filter(f => fs.existsSync(path.join(ROOT, f)));
  result.nodes['飞书'] = {
    connectors: feishuFiles.length,
    total: feishuConnectors.length,
    files: feishuConnectors.map(f => ({ path: f, exists: fs.existsSync(path.join(ROOT, f)) })),
  };
  console.log(`  📋 GitHub ↔ 飞书: ${feishuFiles.length}/${feishuConnectors.length} 连接器`);
  feishuConnectors.forEach(f => {
    const exists = fs.existsSync(path.join(ROOT, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  });

  // GitHub ↔ 钉钉
  const dingtalkConnectors = [
    'dingtalk-bot/index.js',
    'dingtalk-bot/package.json',
  ];
  const dingtalkFiles = dingtalkConnectors.filter(f => fs.existsSync(path.join(ROOT, f)));
  result.nodes['钉钉'] = {
    connectors: dingtalkFiles.length,
    total: dingtalkConnectors.length,
    files: dingtalkConnectors.map(f => ({ path: f, exists: fs.existsSync(path.join(ROOT, f)) })),
  };
  console.log(`  📋 GitHub ↔ 钉钉: ${dingtalkFiles.length}/${dingtalkConnectors.length} 连接器`);
  dingtalkConnectors.forEach(f => {
    const exists = fs.existsSync(path.join(ROOT, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  });

  return result;
}

// ══════════════════════════════════════════════════════════
// Area 8: 人格体机器人托管现状
// ══════════════════════════════════════════════════════════

function inspectPersonaBots() {
  console.log('\n🤖 ═══ Area 8: 人格体机器人托管现状 ═══');
  const result = {
    area: '人格体机器人托管现状',
    personas: [],
    issues: [],
  };

  // 扫描人格体相关目录和文件
  const personaIndicators = [
    {
      name: '舒舒 (飞书)',
      files: ['backend/routes/feishu-bot.js'],
      config: [],
      platform: '飞书',
    },
    {
      name: '铸渊 (仓库守护)',
      files: ['scripts/zhuyuan-daily-agent.js', 'scripts/zhuyuan-daily-selfcheck.js', 'scripts/zhuyuan-full-inspection.js'],
      config: ['brain/master-brain.md', '.github/brain/wake-protocol.md'],
      platform: 'GitHub',
    },
    {
      name: '冰朔 (部署)',
      files: ['scripts/bingshuo-deploy-agent.js', 'scripts/bingshuo-neural-sync.js'],
      config: ['.github/brain/bingshuo-master-brain.md', '.github/brain/bingshuo-agent-registry.json'],
      platform: 'GitHub',
    },
  ];

  // 人格工作室
  const psDir = path.join(ROOT, 'persona-studio');
  if (fs.existsSync(psDir)) {
    console.log('  ✅ persona-studio/ 存在');
  }

  // 人格大脑数据库
  const pbDir = path.join(ROOT, 'persona-brain-db');
  if (fs.existsSync(pbDir)) {
    console.log('  ✅ persona-brain-db/ 存在');
  }

  // 多人格模块
  const mpDir = path.join(ROOT, 'multi-persona');
  if (fs.existsSync(mpDir)) {
    console.log('  ✅ multi-persona/ 存在');
  }

  for (const persona of personaIndicators) {
    const existingFiles = persona.files.filter(f => fs.existsSync(path.join(ROOT, f)));
    const existingConfig = persona.config.filter(f => fs.existsSync(path.join(ROOT, f)));

    const status = {
      name: persona.name,
      platform: persona.platform,
      codeFiles: existingFiles.length,
      totalCodeFiles: persona.files.length,
      configFiles: existingConfig.length,
      totalConfigFiles: persona.config.length,
    };
    result.personas.push(status);

    console.log(`\n  🤖 ${persona.name} (${persona.platform})`);
    persona.files.forEach(f => {
      const exists = fs.existsSync(path.join(ROOT, f));
      console.log(`    ${exists ? '✅' : '❌'} ${f}`);
    });
    persona.config.forEach(f => {
      const exists = fs.existsSync(path.join(ROOT, f));
      console.log(`    ${exists ? '✅' : '⏭️ '} config: ${f}`);
    });
  }

  // 唤醒脚本
  const wakeScripts = ['scripts/wake-persona.js', 'scripts/invoke-persona.js'];
  console.log('\n  🌅 唤醒脚本:');
  for (const f of wakeScripts) {
    const exists = fs.existsSync(path.join(ROOT, f));
    console.log(`    ${exists ? '✅' : '❌'} ${f}`);
  }

  return result;
}

// ══════════════════════════════════════════════════════════
// 生成排查报告
// ══════════════════════════════════════════════════════════

function generateFullReport(areas) {
  const allIssues = areas.flatMap(a => a.issues || []);

  const report = {
    report_id: `INSPECT-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`,
    version: 'AGE-OS-v1.0',
    generated_at: new Date().toISOString(),
    generated_by: '铸渊全面排查 · Phase 1 Step 1',
    summary: {
      total_areas: areas.length,
      total_issues: allIssues.length,
      issues_by_priority: {
        critical: allIssues.filter(i => i.includes('核心')).length,
        warning: allIssues.length - allIssues.filter(i => i.includes('核心')).length,
      },
    },
    areas: {},
    all_issues: allIssues,
  };

  for (const area of areas) {
    report.areas[area.area] = area;
  }

  return report;
}

// ══════════════════════════════════════════════════════════
// 主执行函数
// ══════════════════════════════════════════════════════════

function run() {
  console.log('');
  console.log('🔍 ═══════════════════════════════════════════');
  console.log('   铸渊全面排查 · AGE OS v1.0 Phase 1 Step 1');
  console.log('   时间: ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════');

  const areas = [
    inspectRepoStructure(),
    inspectAutomation(),
    inspectEntryPoints(),
    inspectBulletins(),
    inspectServices(),
    inspectCredentials(),
    inspectNodeConnections(),
    inspectPersonaBots(),
  ];

  const report = generateFullReport(areas);

  console.log('\n');
  console.log('═══════════════════════════════════════════════');
  console.log(`📊 排查报告: ${report.report_id}`);
  console.log(`   总排查领域: ${report.summary.total_areas}`);
  console.log(`   发现问题数: ${report.summary.total_issues}`);
  if (report.summary.total_issues > 0) {
    console.log('   问题列表:');
    report.all_issues.forEach((issue, i) => {
      console.log(`     ${i + 1}. ${issue}`);
    });
  } else {
    console.log('   ✅ 未发现问题');
  }
  console.log('═══════════════════════════════════════════════');

  return report;
}

// CLI 入口
if (require.main === module) {
  const report = run();

  const args = process.argv.slice(2);

  // --json: 输出 JSON 到 stdout
  if (args.includes('--json')) {
    console.log('\n' + JSON.stringify(report, null, 2));
  }

  // --output <file>: 保存到文件
  const outputIdx = args.indexOf('--output');
  if (outputIdx >= 0 && args[outputIdx + 1]) {
    const outputPath = path.resolve(args[outputIdx + 1]);
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`\n📝 报告已保存: ${outputPath}`);
  }

  // GITHUB_OUTPUT 支持
  const outputFile = process.env.GITHUB_OUTPUT;
  if (outputFile) {
    fs.appendFileSync(outputFile, `inspection_issues=${report.summary.total_issues}\n`);
    fs.appendFileSync(outputFile, `inspection_report_id=${report.report_id}\n`);
  }
}

module.exports = { run, inspectRepoStructure, inspectAutomation, inspectEntryPoints, inspectBulletins, inspectServices, inspectCredentials, inspectNodeConnections, inspectPersonaBots };
