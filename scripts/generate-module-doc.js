// scripts/generate-module-doc.js
// 铸渊 · HoloLake Era 操作系统部署模块文档生成器
// 检测所有合作者上传的模块目录 → 按 DEV 编号整理 → 生成总文档

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = 'docs/HoloLake-Era-OS-Modules.md';

// ========== 合作者编号 → 模块目录 路由映射表 ==========
// 新增合作者或模块时，在此表维护即可
const COLLABORATOR_MODULES = [
  {
    devId: 'DEV-001',
    name: '页页',
    emoji: '🖥️',
    role: '后端工程师',
    dirs: ['backend-integration'],
  },
  {
    devId: 'DEV-002',
    name: '肥猫',
    emoji: '🦁',
    role: '光湖团队总控',
    dirs: ['m01-login', 'm03-personality'],
  },
  {
    devId: 'DEV-003',
    name: '燕樊',
    emoji: '🌸',
    role: '前端工程师',
    dirs: ['m07-dialogue-ui', 'm10-cloud', 'm15-cloud-drive'],
  },
  {
    devId: 'DEV-004',
    name: '之之',
    emoji: '🤖',
    role: '机器人工程师',
    dirs: ['dingtalk-bot'],
  },
  {
    devId: 'DEV-005',
    name: '小草莓',
    emoji: '🍓',
    role: '看板工程师',
    dirs: ['m12-kanban', 'status-board'],
  },
  {
    devId: 'DEV-009',
    name: '花尔',
    emoji: '🌺',
    role: '前端工程师',
    dirs: ['m05-user-center'],
  },
  {
    devId: 'DEV-010',
    name: '桔子',
    emoji: '🍊',
    role: '光湖主控',
    dirs: ['m06-ticket', 'm11-module'],
  },
  {
    devId: 'DEV-011',
    name: '匆匆那年',
    emoji: '🌙',
    role: '开发者',
    dirs: [],
  },
];

// ========== 读取模块元信息 ==========
function readModuleInfo(dir) {
  const info = {
    dir,
    title: dir,
    owner: '',
    status: '未知',
    techStack: '待定',
    dependencies: '无',
    hasSrc: false,
    hasPackageJson: false,
    hasSyslog: false,
    files: [],
    description: '',
  };

  // 读取 README.md
  const readmePath = path.join(dir, 'README.md');
  if (fs.existsSync(readmePath)) {
    const content = fs.readFileSync(readmePath, 'utf8');
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch) info.title = titleMatch[1].trim();
    const ownerMatch = content.match(/负责人[：:]\s*(.+)/);
    if (ownerMatch) info.owner = ownerMatch[1].trim();
    const statusMatch = content.match(/状态[：:]\s*(.+)/);
    if (statusMatch) info.status = statusMatch[1].trim();
    const techMatch = content.match(/技术栈[：:]\s*(.+)/);
    if (techMatch) info.techStack = techMatch[1].trim();
    const depsMatch = content.match(/依赖模块[：:]\s*(.+)/);
    if (depsMatch) info.dependencies = depsMatch[1].trim();
    // 收集额外描述行（非元数据）
    const lines = content.split('\n').filter(l =>
      l.trim() &&
      !l.startsWith('#') &&
      !l.match(/^\s*-\s*(负责人|状态|技术栈|依赖模块)[：:]/)
    );
    if (lines.length > 0) info.description = lines.slice(0, 3).join(' ').trim();
  }

  // 检查结构完整性
  info.hasSrc = fs.existsSync(path.join(dir, 'src'));
  info.hasPackageJson = fs.existsSync(path.join(dir, 'package.json'));
  info.hasSyslog = fs.existsSync(path.join(dir, 'SYSLOG.md'));

  // 列出文件（最多15个，排除 node_modules）
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    info.files = entries
      .filter(e => e.name !== 'node_modules' && e.name !== '.git')
      .map(e => (e.isDirectory() ? e.name + '/' : e.name))
      .sort();
  } catch (_) {
    // 目录不可读时忽略
  }

  return info;
}

// ========== 生成与 GitHub 一致的 Markdown anchor ==========
// GitHub 规则：小写 → 保留字母/数字/空格/连字符/中文 → 空格转连字符
function toGitHubAnchor(headingText) {
  return headingText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '') // 去除非字母/数字/空格/连字符（支持 Unicode）
    .replace(/\s+/g, '-');             // 空格转连字符
}


function structureBadge(info) {
  const checks = [
    info.hasSrc ? '✅ src/' : '⚠️ src/',
    info.hasPackageJson ? '✅ package.json' : '⚠️ package.json',
    info.hasSyslog ? '✅ SYSLOG.md' : '⚠️ SYSLOG.md',
  ];
  return checks.join(' · ');
}

// ========== 主函数：生成文档 ==========
function generateDoc() {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const dateStr = now.toISOString().slice(0, 10);

  const lines = [];

  lines.push('# HoloLake Era 操作系统部署模块');
  lines.push('');
  lines.push('> 📋 **自动生成文档** · 铸渊（ZhùYuān）维护 · 最后更新：' + timestamp);
  lines.push('> ');
  lines.push('> 本文档由 GitHub Actions 自动触发生成，每当合作者上传/更新模块时自动刷新。');
  lines.push('> 按合作者编号（DEV-XXX）整理所有已上传模块。');
  lines.push('');
  lines.push('---');
  lines.push('');

  // 生成目录
  lines.push('## 📑 目录');
  lines.push('');
  for (const collab of COLLABORATOR_MODULES) {
    const moduleCount = collab.dirs.filter(d => fs.existsSync(d)).length;
    const badge = moduleCount > 0 ? `（${moduleCount} 个模块）` : '（待上传）';
    const headingText = `${collab.devId} · ${collab.emoji} ${collab.name}`;
    const anchor = toGitHubAnchor(headingText);
    lines.push(`- [${headingText}](#${anchor}) ${badge}`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  // 统计
  let totalModules = 0;
  let uploadedModules = 0;

  // 各合作者章节
  for (const collab of COLLABORATOR_MODULES) {
    lines.push(`## ${collab.devId} · ${collab.emoji} ${collab.name}`);
    lines.push('');
    lines.push(`**角色：** ${collab.role}`);
    lines.push('');

    const existingDirs = collab.dirs.filter(d => fs.existsSync(d));
    const missingDirs = collab.dirs.filter(d => !fs.existsSync(d));

    totalModules += collab.dirs.length;
    uploadedModules += existingDirs.length;

    if (collab.dirs.length === 0) {
      lines.push('> 🕐 暂无分配模块，待安排。');
      lines.push('');
      lines.push('---');
      lines.push('');
      continue;
    }

    if (existingDirs.length === 0) {
      lines.push('> ⏳ 模块目录尚未创建，等待上传。');
      lines.push('');
      if (missingDirs.length > 0) {
        lines.push('**待上传模块：** ' + missingDirs.join('、'));
        lines.push('');
      }
      lines.push('---');
      lines.push('');
      continue;
    }

    for (const dir of existingDirs) {
      const info = readModuleInfo(dir);

      lines.push(`### 📦 ${info.title}`);
      lines.push('');
      lines.push(`| 字段 | 内容 |`);
      lines.push(`|------|------|`);
      lines.push(`| **目录** | \`${dir}/\` |`);
      lines.push(`| **负责人** | ${info.owner || collab.name} |`);
      lines.push(`| **状态** | ${info.status} |`);
      lines.push(`| **技术栈** | ${info.techStack} |`);
      lines.push(`| **依赖模块** | ${info.dependencies} |`);
      lines.push('');

      lines.push('**结构检查：** ' + structureBadge(info));
      lines.push('');

      if (info.files.length > 0) {
        lines.push('**已上传文件：**');
        lines.push('');
        lines.push('```');
        lines.push(dir + '/');
        info.files.forEach(f => lines.push('  ' + f));
        lines.push('```');
        lines.push('');
      }

      if (info.hasSyslog) {
        const syslogContent = fs.readFileSync(path.join(dir, 'SYSLOG.md'), 'utf8');
        const syslogLines = syslogContent.split('\n').filter(l => l.trim()).slice(0, 5);
        if (syslogLines.length > 0) {
          lines.push('<details>');
          lines.push('<summary>📝 SYSLOG 摘要（点击展开）</summary>');
          lines.push('');
          lines.push('```');
          syslogLines.forEach(l => lines.push(l));
          lines.push('```');
          lines.push('');
          lines.push('</details>');
          lines.push('');
        }
      }
    }

    if (missingDirs.length > 0) {
      lines.push('> ⏳ **待上传：** ' + missingDirs.map(d => '`' + d + '/`').join('、'));
      lines.push('');
    }

    lines.push('---');
    lines.push('');
  }

  // 汇总统计
  lines.push('## 📊 部署统计');
  lines.push('');
  lines.push(`| 项目 | 数量 |`);
  lines.push(`|------|------|`);
  lines.push(`| 合作者总数 | ${COLLABORATOR_MODULES.length} |`);
  lines.push(`| 计划模块数 | ${totalModules} |`);
  lines.push(`| 已上传模块数 | ${uploadedModules} |`);
  lines.push(`| 待上传模块数 | ${totalModules - uploadedModules} |`);
  lines.push(`| 上传完成率 | ${totalModules > 0 ? Math.round(uploadedModules / totalModules * 100) : 0}% |`);
  lines.push(`| 文档更新时间 | ${timestamp} |`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*由 铸渊（ZhùYuān）· GitHub Copilot Agent 自动生成 · 仓库：guanghulab*');
  lines.push('');

  // 确保 docs/ 目录存在
  if (!fs.existsSync('docs')) {
    fs.mkdirSync('docs', { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf8');
  console.log('✅ 文档已生成：' + OUTPUT_FILE);
  console.log('📊 合作者: ' + COLLABORATOR_MODULES.length + ' | 计划模块: ' + totalModules + ' | 已上传: ' + uploadedModules);
}

generateDoc();
