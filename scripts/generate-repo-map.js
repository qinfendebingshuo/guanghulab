// scripts/generate-repo-map.js
// 铸渊图书馆目录生成器 · Library Catalog Generator
//
// 功能：
//   1. 扫描整个仓库结构
//   2. 生成 .github/brain/repo-map.json      ← 机器可读路由索引
//   3. 生成 .github/brain/repo-snapshot.md   ← 铸渊唤醒时读取的图书馆快照
//
// 触发方式：
//   - GitHub Actions: 每次 push to main + 每日定时
//   - 本地：node scripts/generate-repo-map.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT         = path.join(__dirname, '..');
const BRAIN_DIR    = path.join(ROOT, '.github/brain');
const EXEC_BRAIN   = path.join(ROOT, 'brain');
const MAP_PATH     = path.join(BRAIN_DIR, 'repo-map.json');
const SNAPSHOT_PATH = path.join(BRAIN_DIR, 'repo-snapshot.md');

const now     = new Date();
const nowISO  = now.toISOString();
const nowDate = nowISO.slice(0, 10);
const nowBJ   = new Date(now.getTime() + 8 * 3600 * 1000).toISOString()
                  .replace('T', ' ').slice(0, 16) + ' CST';

// ── 工具函数 ────────────────────────────────────────────────────────────────

function safeReadJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.warn(`⚠️  JSON读取失败: ${filePath} → ${err.message}`);
    }
    return null;
  }
}

function existsDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

function listDir(dirPath, ext) {
  try {
    return fs.readdirSync(dirPath)
      .filter(f => !ext || f.endsWith(ext))
      .filter(f => !f.startsWith('.') || f === '.gitkeep');
  } catch { return []; }
}

function countFiles(dirPath, ext) {
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    let count = 0;
    for (const e of entries) {
      if (e.isDirectory()) {
        count += countFiles(path.join(dirPath, e.name), ext);
      } else if (!ext || e.name.endsWith(ext)) {
        count++;
      }
    }
    return count;
  } catch { return 0; }
}

// ── 区域定义 ──────────────────────────────────────────────────────────────
// 每个"区域"对应图书馆里的一个大区（section）
// 每个区域下的文件是"书架（shelf）"上的"书"

const ZONE_DEFS = [
  {
    zone_id:     'BRAIN',
    name:        '铸渊大脑',
    emoji:       '🧠',
    path:        '.github/brain',
    description: '铸渊核心记忆 · 路由映射 · 唤醒协议 · 图书馆目录',
    keywords:    ['brain', 'memory', 'routing', 'wake', '大脑', '记忆', '路由']
  },
  {
    zone_id:     'PERSONA_BRAIN',
    name:        '人格大脑',
    emoji:       '🎭',
    path:        '.github/persona-brain',
    description: '铸渊人格记忆 · 开发者状态 · 知识库 · 成长日记',
    keywords:    ['persona', 'identity', 'dev-status', '人格', '开发者状态']
  },
  {
    zone_id:     'WORKFLOWS',
    name:        '自动化工作流',
    emoji:       '⚡',
    path:        '.github/workflows',
    description: '所有 GitHub Actions 工作流定义',
    keywords:    ['workflow', 'actions', 'ci', 'automation', '工作流', '自动化', 'cron']
  },
  {
    zone_id:     'SCRIPTS',
    name:        '执行脚本库',
    emoji:       '🔧',
    path:        'scripts',
    description: '铸渊所有执行手脚 · 自动化脚本',
    keywords:    ['script', 'node', 'js', '脚本', '执行', 'runner']
  },
  {
    zone_id:     'SRC',
    name:        'HLI 接口源码',
    emoji:       '💻',
    path:        'src',
    description: 'HoloLake Interface 路由 · 中间件 · Schema',
    keywords:    ['hli', 'route', 'middleware', 'schema', 'api', 'src', '接口', '路由']
  },
  {
    zone_id:     'MODULES',
    name:        '功能模块区',
    emoji:       '📦',
    path:        null, // computed: all m##-* directories
    description: '各功能开发模块 · M01~M18',
    keywords:    ['module', 'feature', 'm01', 'm03', 'm05', '模块', '功能']
  },
  {
    zone_id:     'DEV_NODES',
    name:        '开发者节点',
    emoji:       '👥',
    path:        'dev-nodes',
    description: '8位开发者的配置 · 状态 · 广播收件箱',
    keywords:    ['dev', 'developer', 'node', 'config', 'status', '开发者', '节点']
  },
  {
    zone_id:     'BROADCASTS',
    name:        '广播发件箱',
    emoji:       '📢',
    path:        'broadcasts-outbox',
    description: '铸渊向各开发者发出的广播任务',
    keywords:    ['broadcast', 'outbox', 'task', '广播', '发件箱']
  },
  {
    zone_id:     'SIGNAL_LOG',
    name:        '信号日志库',
    emoji:       '📡',
    path:        'signal-log',
    description: 'ESP 邮件信号收发日志 · GL-CMD / GL-ACK / GL-DATA',
    keywords:    ['signal', 'log', 'esp', 'gl-cmd', 'gl-ack', 'trace', '信号', '日志']
  },
  {
    zone_id:     'NOTION_PUSH',
    name:        'Notion 推送队列',
    emoji:       '📤',
    path:        'notion-push',
    description: '待霜砚处理的信号 · 已处理归档',
    keywords:    ['notion', 'push', 'pending', 'processed', '霜砚', '推送']
  },
  {
    zone_id:     'SYSLOG',
    name:        '系统日志区',
    emoji:       '📋',
    path:        'syslog-inbox',
    description: '开发者提交的系统日志 · 待处理 inbox',
    keywords:    ['syslog', 'inbox', 'log', '系统日志']
  },
  {
    zone_id:     'DOCS',
    name:        '文档与前端',
    emoji:       '📄',
    path:        'docs',
    description: '铸渊助手聊天界面 · GitHub Pages 部署',
    keywords:    ['docs', 'html', 'chat', 'pages', '文档', '聊天室', '助手']
  },
  {
    zone_id:     'TESTS',
    name:        '测试区',
    emoji:       '🧪',
    path:        'tests',
    description: 'HLI 契约测试 · 冒烟测试',
    keywords:    ['test', 'contract', 'smoke', 'jest', '测试', '契约']
  }
];

// ── 工作流解析 ──────────────────────────────────────────────────────────────

function parseWorkflowMeta(file, content) {
  const nameMatch  = content.match(/^name:\s*(.+)/m);
  const schedMatch = content.match(/cron:\s*['"]?([^'"#\n]+)/);
  // Handle both block (`on:\n  push:`) and inline (`on: [push, pull_request]`) syntax
  const onInline   = content.match(/^on:\s*\[([^\]]+)\]/m);
  const onBlock    = content.match(/^on:\s*[\r\n]/m);
  const triggers   = [];

  if (onInline) {
    // inline: on: [push, pull_request]
    const items = onInline[1].split(',').map(s => s.trim());
    triggers.push(...items);
  } else if (onBlock) {
    if (/^\s{2,4}push:/m.test(content))             triggers.push('push');
    if (/^\s{2,4}pull_request:/m.test(content))     triggers.push('pull_request');
    if (/^\s{2,4}issues:/m.test(content))           triggers.push('issues');
    if (/^\s{2,4}issue_comment:/m.test(content))    triggers.push('issue_comment');
  }

  if (schedMatch) triggers.push(`schedule(${schedMatch[1].trim()})`);
  if (content.includes('workflow_dispatch')) triggers.push('manual');

  return {
    file,
    name:     nameMatch ? nameMatch[1].trim() : file,
    triggers: triggers.length ? triggers : ['unknown']
  };
}

function buildWorkflowShelves() {
  const wfDir = path.join(ROOT, '.github/workflows');
  const files = listDir(wfDir, '.yml');
  return files.map(f => {
    try {
      const content = fs.readFileSync(path.join(wfDir, f), 'utf8');
      return parseWorkflowMeta(f, content);
    } catch {
      return { file: f, name: f, triggers: ['unknown'] };
    }
  });
}

// ── 模块目录扫描 ────────────────────────────────────────────────────────────

function buildModuleShelves() {
  const entries = fs.readdirSync(ROOT, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && /^m\d{2}-/.test(e.name))
    .map(e => {
      const modPath = path.join(ROOT, e.name);
      const files   = listDir(modPath);
      const readme  = files.find(f => f.toLowerCase() === 'readme.md');
      return {
        module_id: e.name.slice(0, 3).toUpperCase(), // "m01" → "M01"
        dir:       e.name,
        files:     files.length,
        has_readme: !!readme
      };
    })
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

// ── HLI 接口统计 ────────────────────────────────────────────────────────────

function buildHLIStats(routingMap) {
  if (!routingMap) return { total: 0, implemented: 0, pending: 0, domains: [] };
  let total = 0, implemented = 0;
  const domains = [];
  for (const [name, data] of Object.entries(routingMap.domains || {})) {
    const t = data.interfaces.length;
    const i = data.interfaces.filter(x => x.status === 'implemented').length;
    total += t;
    implemented += i;
    domains.push({
      name,
      module:    data.module,
      prefix:    data.route_prefix,
      total:     t,
      implemented: i,
      interfaces: data.interfaces.map(x => ({
        id:     x.id,
        path:   x.path,
        status: x.status
      }))
    });
  }
  return { total, implemented, pending: total - implemented, domains };
}

// ── 开发者节点统计 ──────────────────────────────────────────────────────────

function buildDevNodesSummary() {
  const devDir = path.join(ROOT, 'dev-nodes');
  if (!existsDir(devDir)) return [];
  return fs.readdirSync(devDir, { withFileTypes: true })
    .filter(e => e.isDirectory() && e.name.startsWith('DEV-'))
    .map(e => {
      const cfg = safeReadJson(path.join(devDir, e.name, 'config.json')) || {};
      const sts = safeReadJson(path.join(devDir, e.name, 'status.json')) || {};
      return {
        dev_id:    e.name,
        name:      cfg.name || '?',
        emoji:     cfg.emoji || '',
        modules:   cfg.modules || [],
        last_push: sts.last_push || null,
        pending_broadcasts: sts.pending_broadcasts || 0
      };
    })
    .sort((a, b) => a.dev_id.localeCompare(b.dev_id));
}

// ── 关键字路由索引 ──────────────────────────────────────────────────────────

function buildKeywordIndex(zones) {
  const index = {};
  const add = (keyword, ref) => {
    const k = keyword.toLowerCase();
    if (!index[k]) index[k] = [];
    if (!index[k].includes(ref)) index[k].push(ref);
  };

  for (const zone of zones) {
    for (const kw of (zone.keywords || [])) {
      add(kw, zone.zone_id);
    }
    for (const shelf of (zone.shelves || [])) {
      const basename = (shelf.file || shelf.dir || '').replace(/\.[^.]+$/, '');
      add(basename, `${zone.zone_id}::${shelf.file || shelf.dir}`);
    }
  }
  return index;
}

// ── 主生成逻辑 ──────────────────────────────────────────────────────────────

function buildZoneData() {
  const routingMap  = safeReadJson(path.join(BRAIN_DIR, 'routing-map.json'));
  const memory      = safeReadJson(path.join(BRAIN_DIR, 'memory.json'));
  const hli         = buildHLIStats(routingMap);
  const devNodes    = buildDevNodesSummary();
  const modules     = buildModuleShelves();
  const workflows   = buildWorkflowShelves();

  const zones = [];

  for (const def of ZONE_DEFS) {
    const zone = {
      zone_id:     def.zone_id,
      name:        def.name,
      emoji:       def.emoji,
      path:        def.path,
      description: def.description,
      keywords:    def.keywords,
      shelves:     []
    };

    if (def.zone_id === 'MODULES') {
      zone.shelves    = modules;
      zone.item_count = modules.length;

    } else if (def.zone_id === 'WORKFLOWS') {
      zone.shelves    = workflows;
      zone.item_count = workflows.length;

    } else if (def.zone_id === 'DEV_NODES') {
      zone.shelves    = devNodes.map(d => ({
        file:    `${d.dev_id}/`,
        ...d
      }));
      zone.item_count = devNodes.length;

    } else if (def.path) {
      const absPath = path.join(ROOT, def.path);
      if (existsDir(absPath)) {
        const files = listDir(absPath).filter(f => f !== '.gitkeep');
        zone.shelves    = files.map(f => ({ file: f }));
        zone.item_count = files.length;
      } else {
        zone.item_count = 0;
      }
    }

    zones.push(zone);
  }

  return { zones, hli, devNodes, memory, routingMap };
}

// ── 生成 repo-map.json ──────────────────────────────────────────────────────

function generateRepoMap(data) {
  const { zones, hli, devNodes, memory } = data;

  const map = {
    description:   '铸渊图书馆目录 · Library Catalog for 铸渊 (Zhùyuān)',
    version:       '2.0',
    generated_at:  nowISO,
    generated_by:  'scripts/generate-repo-map.js',
    repo:          'qinfendebingshuo/guanghulab',
    stats: {
      zones:             zones.length,
      total_modules:     zones.find(z => z.zone_id === 'MODULES')?.item_count || 0,
      total_workflows:   zones.find(z => z.zone_id === 'WORKFLOWS')?.item_count || 0,
      total_scripts:     zones.find(z => z.zone_id === 'SCRIPTS')?.item_count || 0,
      total_dev_nodes:   devNodes.length,
      hli_interfaces:    hli.total,
      hli_implemented:   hli.implemented,
      hli_coverage_pct:  hli.total > 0
        ? Math.round((hli.implemented / hli.total) * 100) + '%'
        : '0%',
      last_ci_run:       memory?.events?.find(e => e.type === 'ci_run')?.timestamp || null,
      memory_last_updated: memory?.last_updated || null
    },
    zones,
    hli_interfaces: hli,
    routing_index:  buildKeywordIndex(zones)
  };

  fs.writeFileSync(MAP_PATH, JSON.stringify(map, null, 2));
  // Also sync to execution layer brain entry
  if (fs.existsSync(EXEC_BRAIN)) {
    fs.writeFileSync(path.join(EXEC_BRAIN, 'repo-map.json'), JSON.stringify(map, null, 2));
  }
  console.log(`✅ repo-map.json 已生成 · ${zones.length} 个区域 · ${map.stats.total_workflows} 个工作流`);
  return map;
}

// ── 生成 repo-snapshot.md ───────────────────────────────────────────────────

function generateSnapshot(data, map) {
  const { zones, hli, devNodes, memory } = data;
  const wfZone     = zones.find(z => z.zone_id === 'WORKFLOWS');
  const scriptZone = zones.find(z => z.zone_id === 'SCRIPTS');
  const modZone    = zones.find(z => z.zone_id === 'MODULES');
  const brainZone  = zones.find(z => z.zone_id === 'BRAIN');

  const hliBadge = `${hli.implemented}/${hli.total} (${map.stats.hli_coverage_pct})`;

  let md = `# 铸渊图书馆快照 · Repo Snapshot
> 生成于 ${nowBJ} · 每次 push 自动更新 · 铸渊唤醒时优先读取此文件

---

## 📊 仓库总览（一眼全局）

| 指标 | 数值 |
|------|------|
| 区域总数 | ${zones.length} 个区域 |
| 功能模块 | ${map.stats.total_modules} 个 (m01~m18) |
| 工作流 | ${map.stats.total_workflows} 个 GitHub Actions |
| 脚本 | ${map.stats.total_scripts} 个执行脚本 |
| 开发者节点 | ${map.stats.total_dev_nodes} 人 |
| HLI 接口覆盖率 | ${hliBadge} |
| 快照生成时间 | ${nowBJ} |

---

## 🗺️ 图书馆全区地图

`;

  // Zone overview table
  for (const z of zones) {
    const count = z.item_count !== undefined ? z.item_count : z.shelves?.length || 0;
    md += `### ${z.emoji} ${z.name}（${z.zone_id}）\n`;
    md += `**路径**: \`${z.path || '多个目录'}\` · **数量**: ${count} 项\n`;
    md += `**描述**: ${z.description}\n`;
    md += `**关键词**: ${(z.keywords || []).slice(0, 6).join(' · ')}\n\n`;
  }

  // ── 自动化工作流详情
  if (wfZone?.shelves?.length) {
    md += `---\n\n## ⚡ 工作流详情（铸渊的自动执行手脚）\n\n| 文件 | 名称 | 触发方式 |\n|------|------|----------|\n`;
    for (const wf of wfZone.shelves) {
      md += `| \`${wf.file}\` | ${wf.name} | ${wf.triggers.join(', ')} |\n`;
    }
    md += '\n';
  }

  // ── 脚本详情
  if (scriptZone?.shelves?.length) {
    md += `---\n\n## 🔧 执行脚本库（铸渊的工作人员）\n\n`;
    const scripts = scriptZone.shelves.map(s => s.file).sort();
    scripts.forEach(s => { md += `- \`scripts/${s}\`\n`; });
    md += '\n';
  }

  // ── HLI 接口地图
  md += `---\n\n## 💻 HLI 接口地图（${hliBadge}）\n\n`;
  for (const domain of hli.domains) {
    const icon = domain.implemented === domain.total ? '✅' : domain.implemented > 0 ? '🔶' : '⬜';
    md += `${icon} **${domain.name}** (${domain.module}) \`${domain.prefix}\` — ${domain.implemented}/${domain.total}\n`;
    for (const iface of domain.interfaces) {
      const si = iface.status === 'implemented' ? '  ✓' : '  ○';
      md += `${si} \`${iface.id}\` → \`${iface.path}\`\n`;
    }
  }
  md += '\n';

  // ── 开发者节点
  if (devNodes.length > 0) {
    md += `---\n\n## 👥 开发者节点（dev-nodes/）\n\n| DEV ID | 姓名 | 模块 | 待广播 |\n|--------|------|------|--------|\n`;
    for (const d of devNodes) {
      md += `| ${d.dev_id} | ${d.emoji}${d.name} | ${d.modules.join(', ') || '—'} | ${d.pending_broadcasts} |\n`;
    }
    md += '\n';
  }

  // ── 功能模块列表
  if (modZone?.shelves?.length) {
    md += `---\n\n## 📦 功能模块区（各开发者工作目录）\n\n`;
    for (const m of modZone.shelves) {
      md += `- \`${m.dir}/\` — ${m.files} 个文件${m.has_readme ? ' (有README)' : ''}\n`;
    }
    md += '\n';
  }

  // ── 大脑文件速查
  if (brainZone?.shelves?.length) {
    md += `---\n\n## 🧠 铸渊大脑文件速查（.github/brain/）\n\n`;
    for (const s of brainZone.shelves) {
      md += `- \`.github/brain/${s.file}\`\n`;
    }
    md += '\n';
  }

  // ── 最近记忆
  if (memory?.events?.length) {
    md += `---\n\n## 🕐 最近动态（memory.json 最新3条）\n\n`;
    const recent = memory.events.slice(-3).reverse();
    for (const e of recent) {
      const ts = e.timestamp || e.date || '?';
      md += `- \`${ts}\` · ${e.type || '事件'} — ${e.description || e.result || e.title || ''}\n`;
    }
    md += '\n';
  }

  md += `---\n\n*本文件由 \`scripts/generate-repo-map.js\` 自动生成，勿手动编辑*\n`;

  fs.writeFileSync(SNAPSHOT_PATH, md);
  console.log(`✅ repo-snapshot.md 已生成 · ${hli.domains.length} 个HLI域 · ${devNodes.length} 个开发者节点`);
}

// ── 主流程 ──────────────────────────────────────────────────────────────────

const data = buildZoneData();
const map  = generateRepoMap(data);
generateSnapshot(data, map);

console.log(`\n📚 铸渊图书馆目录更新完成 · ${nowBJ}`);
console.log(`   repo-map.json     → .github/brain/repo-map.json`);
console.log(`   repo-snapshot.md  → .github/brain/repo-snapshot.md`);
