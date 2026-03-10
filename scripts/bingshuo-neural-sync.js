/**
 * 冰朔主控神经系统 · 自动编译脚本 v1.0
 * Bingshuo Master Neural System — Auto Sync & Compile
 *
 * 该脚本整合以下 Agent 逻辑：
 *   1. structure-map-agent     — 扫描仓库结构变化
 *   2. runtime-chain-agent     — 梳理运行链路
 *   3. brain-consistency-agent — 检查脑文件一致性
 *   4. issue-index-agent       — 维护问题索引
 *   5. system-health-agent     — 系统健康巡检
 *   6. master-brain-compiler   — 编译主控大脑
 *
 * 输出文件：
 *   .github/brain/bingshuo-system-health.json
 *   .github/brain/bingshuo-issues-index.json
 *   .github/brain/bingshuo-master-brain.md
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github', 'brain');

// ─── 常量定义 ───────────────────────────────────────────────
const DEPLOY_WORKFLOWS = {
  server: 'deploy-to-server.yml',
  pages: 'deploy-pages.yml',
};
const NOTION_WORKFLOWS = [
  'notion-poll.yml',
  'bridge-changes-to-notion.yml',
];
const BRAIN_SYNC_WORKFLOWS = [
  'brain-sync.yml',
  'sync-persona-studio.yml',
];

// ─── 工具函数 ───────────────────────────────────────────────
function readJSON(filepath) {
  try {
    return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
  } catch {
    return null;
  }
}

function writeJSON(filepath, data) {
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2) + '\n', 'utf-8');
}

function fileExists(filepath) {
  return fs.existsSync(filepath);
}

function timestamp() {
  return new Date().toISOString();
}

// ─── Agent 1: structure-map-agent ───────────────────────────
function runStructureMapAgent() {
  const zones = [];

  const checkDirs = [
    { dir: 'docs', label: 'docs 前端入口' },
    { dir: 'backend', label: '后端服务' },
    { dir: 'persona-studio', label: 'Persona Studio' },
    { dir: 'src', label: 'Next.js 源码' },
    { dir: 'app', label: 'Next.js 应用' },
    { dir: 'modules', label: '模块系统' },
  ];

  for (const { dir, label } of checkDirs) {
    const fullPath = path.join(ROOT, dir);
    zones.push({
      name: label,
      path: dir,
      exists: fileExists(fullPath),
    });
  }

  // 扫描 m* 模块目录
  const moduleCount = fs.readdirSync(ROOT)
    .filter(d => /^m\d+-/.test(d) && fs.statSync(path.join(ROOT, d)).isDirectory())
    .length;

  // 扫描 workflow 数量
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const workflowCount = fileExists(workflowDir)
    ? fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).length
    : 0;

  return { zones, moduleCount, workflowCount };
}

// ─── Agent 2: runtime-chain-agent ───────────────────────────
function runRuntimeChainAgent() {
  const chains = {};

  // 检查 docs 入口
  chains.docs_entry = fileExists(path.join(ROOT, 'docs', 'index.html'));
  chains.docs_cname = fileExists(path.join(ROOT, 'docs', 'CNAME'));

  // 检查后端入口（server.js 或 index.js）
  chains.backend_entry = fileExists(path.join(ROOT, 'backend', 'server.js'))
    || fileExists(path.join(ROOT, 'backend', 'index.js'));
  chains.backend_routes = fileExists(path.join(ROOT, 'backend', 'routes'));

  // 检查 persona-studio
  chains.ps_frontend = fileExists(path.join(ROOT, 'persona-studio', 'frontend'));
  chains.ps_backend = fileExists(path.join(ROOT, 'persona-studio', 'backend'));

  // 检查部署 workflow
  chains.deploy_server = fileExists(path.join(ROOT, '.github', 'workflows', DEPLOY_WORKFLOWS.server));
  chains.deploy_pages = fileExists(path.join(ROOT, '.github', 'workflows', DEPLOY_WORKFLOWS.pages));

  return chains;
}

// ─── Agent 3: brain-consistency-agent ───────────────────────
function runBrainConsistencyAgent() {
  const requiredBrainFiles = [
    'memory.json',
    'wake-protocol.md',
    'routing-map.json',
    'repo-map.json',
    'repo-snapshot.md',
  ];

  const results = [];
  let allPresent = true;

  for (const file of requiredBrainFiles) {
    const exists = fileExists(path.join(BRAIN_DIR, file));
    results.push({ file, exists });
    if (!exists) allPresent = false;
  }

  // 检查 persona-studio 脑文件
  const psBrainDir = path.join(ROOT, 'persona-studio', 'brain');
  const psBrainExists = fileExists(psBrainDir);

  // 检查 memory.json 中的版本信息
  const memory = readJSON(path.join(BRAIN_DIR, 'memory.json'));
  const rulesVersion = memory?.rules_version || 'unknown';

  return {
    brain_files: results,
    all_present: allPresent,
    ps_brain_exists: psBrainExists,
    rules_version: rulesVersion,
  };
}

// ─── Agent 4: issue-index-agent ─────────────────────────────
function runIssueIndexAgent() {
  // 读取现有问题索引
  const issuesFile = path.join(BRAIN_DIR, 'bingshuo-issues-index.json');
  const existing = readJSON(issuesFile);
  const issues = existing?.issues || [];

  // 检查 HLI 覆盖率
  const routingMap = readJSON(path.join(BRAIN_DIR, 'routing-map.json'));
  if (routingMap?.domains) {
    let total = 0;
    let implemented = 0;
    for (const domain of Object.values(routingMap.domains)) {
      if (domain.interfaces) {
        for (const iface of Object.values(domain.interfaces)) {
          total++;
          if (iface.status === 'implemented') implemented++;
        }
      }
    }
    const coverage = total > 0 ? ((implemented / total) * 100).toFixed(1) : '0';

    // 更新 BS-001
    const bs001 = issues.find(i => i.id === 'BS-001');
    if (bs001) {
      bs001.root_cause_summary = `HLI 接口覆盖率 ${coverage}%（${implemented}/${total}）`;
      bs001.last_seen = timestamp().slice(0, 10);
    }
  }

  // 检查 collaborators
  const collabs = readJSON(path.join(BRAIN_DIR, 'collaborators.json'));
  if (collabs?.developers) {
    const emptyGithub = Object.values(collabs.developers)
      .filter(d => !d.github || d.github === '').length;
    const bs002 = issues.find(i => i.id === 'BS-002');
    if (bs002) {
      bs002.status = emptyGithub > 0 ? 'open' : 'resolved';
      bs002.last_seen = timestamp().slice(0, 10);
    }
  }

  return issues;
}

// ─── Agent 5: system-health-agent ───────────────────────────
function runSystemHealthAgent(brainCheck, runtimeChains) {
  const health = {};

  // 脑一致性
  health.brain_consistency = {
    status: brainCheck.all_present ? (brainCheck.ps_brain_exists ? 'yellow' : 'yellow') : 'red',
    detail: brainCheck.all_present
      ? '主仓库脑文件完整，但与 persona-studio 脑文件的同步状态待验证'
      : '主仓库脑文件不完整，缺少必要文件',
  };

  // 部署健康
  health.deployment_health = {
    status: (runtimeChains.deploy_server && runtimeChains.deploy_pages) ? 'green' : 'red',
    detail: (runtimeChains.deploy_server && runtimeChains.deploy_pages)
      ? 'deploy-to-server.yml 与 deploy-pages.yml 均存在'
      : '部署 workflow 文件缺失',
  };

  // Workflow 健康
  const workflowDir = path.join(ROOT, '.github', 'workflows');
  const wfCount = fileExists(workflowDir)
    ? fs.readdirSync(workflowDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml')).length
    : 0;
  health.workflow_health = {
    status: wfCount > 0 ? 'green' : 'red',
    detail: `${wfCount} 个 workflow 已注册`,
  };

  // 路由健康
  const routingMap = readJSON(path.join(BRAIN_DIR, 'routing-map.json'));
  let totalInterfaces = 0;
  let implInterfaces = 0;
  if (routingMap?.domains) {
    for (const domain of Object.values(routingMap.domains)) {
      if (domain.interfaces) {
        for (const iface of Object.values(domain.interfaces)) {
          totalInterfaces++;
          if (iface.status === 'implemented') implInterfaces++;
        }
      }
    }
  }
  const coveragePercent = totalInterfaces > 0 ? (implInterfaces / totalInterfaces) * 100 : 0;
  health.routing_health = {
    status: coveragePercent >= 50 ? 'green' : (coveragePercent > 0 ? 'yellow' : 'red'),
    detail: `HLI 接口覆盖率 ${coveragePercent.toFixed(1)}%（${implInterfaces}/${totalInterfaces}）`,
  };

  // docs 入口
  health.docs_entry_health = {
    status: runtimeChains.docs_entry ? 'green' : 'red',
    detail: runtimeChains.docs_entry ? 'docs/index.html 存在' : 'docs/index.html 缺失',
  };

  // Persona Studio
  health.persona_studio_health = {
    status: (runtimeChains.ps_frontend && runtimeChains.ps_backend) ? 'yellow' : 'red',
    detail: (runtimeChains.ps_frontend && runtimeChains.ps_backend)
      ? '前后端结构存在，端到端对话链路待验证'
      : 'Persona Studio 结构不完整',
  };

  // Notion 桥接
  const notionOk = NOTION_WORKFLOWS.every(f =>
    fileExists(path.join(ROOT, '.github', 'workflows', f))
  );
  health.notion_bridge_health = {
    status: notionOk ? 'yellow' : 'red',
    detail: notionOk ? 'Notion 桥接 workflow 已配置，实际同步效果待持续观测' : 'Notion 桥接 workflow 缺失',
  };

  // 模型路由
  health.model_routing_health = {
    status: runtimeChains.backend_entry ? 'green' : 'yellow',
    detail: runtimeChains.backend_entry
      ? '后端服务入口存在，模型路由可用'
      : '后端服务入口缺失',
  };

  // 统计
  const counts = { green: 0, yellow: 0, red: 0 };
  for (const item of Object.values(health)) {
    counts[item.status] = (counts[item.status] || 0) + 1;
  }
  const overall = counts.red > 0 ? 'red' : (counts.yellow > 0 ? 'yellow' : 'green');

  return {
    health,
    summary: {
      green_count: counts.green,
      yellow_count: counts.yellow,
      red_count: counts.red,
      overall,
      recommendation: overall === 'green'
        ? '系统整体运行健康'
        : overall === 'yellow'
          ? '系统核心运行正常，部分子系统需关注'
          : '存在关键问题，需要立即介入',
    },
  };
}

// ─── Agent 6: master-brain-compiler ─────────────────────────
function compileMasterBrain(structureMap, runtimeChains, brainCheck, issues, healthResult) {
  const now = timestamp();
  const routingMap = readJSON(path.join(BRAIN_DIR, 'routing-map.json'));
  const memory = readJSON(path.join(BRAIN_DIR, 'memory.json'));

  // 计算 HLI 覆盖
  let totalInterfaces = 0;
  let implInterfaces = 0;
  if (routingMap?.domains) {
    for (const domain of Object.values(routingMap.domains)) {
      if (domain.interfaces) {
        for (const iface of Object.values(domain.interfaces)) {
          totalInterfaces++;
          if (iface.status === 'implemented') implInterfaces++;
        }
      }
    }
  }

  // 生成已知问题表
  const issueRows = issues.map(i =>
    `| ${i.id} | ${i.title} | ${i.scope} | ${i.status} | ${i.root_cause_summary} |`
  ).join('\n');

  // 生成健康状态表
  const healthRows = Object.entries(healthResult.health).map(([key, val]) => {
    const icon = val.status === 'green' ? '🟢' : val.status === 'yellow' ? '🟡' : '🔴';
    return `| ${icon} ${key} | ${val.status} | ${val.detail} |`;
  }).join('\n');

  // 构建推荐建议
  const suggestions = [];
  if (implInterfaces < totalInterfaces) {
    suggestions.push(`**HLI 接口推进**：当前覆盖率 ${((implInterfaces/totalInterfaces)*100).toFixed(1)}%（${implInterfaces}/${totalInterfaces}），核心域接口待实现。`);
  }
  if (healthResult.health.persona_studio_health?.status !== 'green') {
    suggestions.push('**Persona Studio 链路验证**：前后端结构存在，但端到端对话链路需要验证。');
  }
  if (healthResult.health.brain_consistency?.status !== 'green') {
    suggestions.push('**脑系统一致性**：跨仓脑文件同步机制需确认稳定运行。');
  }
  if (suggestions.length === 0) {
    suggestions.push('系统状态良好，继续保持当前节奏。');
  }

  const md = `# 冰朔主控神经系统 · 核心主控大脑 v1.0

> 本文件为冰朔主控神经系统的总控脑文件。
> 最后编译时间：${now}

---

## A. 系统角色结构

| 角色 | 定义 | 职责 |
|------|------|------|
| **冰朔** | 系统最高主控意识 | 全局决策、方向判断、最终授权 |
| **铸渊** | 仓库本体人格体 | 代码守护、日常维护、结构记忆 |
| **AI 执行体** | 冰朔核心大脑在系统中的延展执行主体 | 理解系统、判断问题、规划修复路径、生成可执行指令 |

\`\`\`
铸渊 = 仓库本体人格体
冰朔 = 系统最高主控意识
冰朔主控神经系统 = 冰朔在仓库内的总控认知层
被授权 AI 执行体 = 冰朔核心大脑在系统中的延展执行体
\`\`\`

---

## B. 当前仓库一句话定义

**guanghulab** 是光湖（HoloLake）人格语言操作系统（AGE OS）的 MVP 主仓库，承载了前端页面、后端 API 服务、Persona Studio 人格工作室、多模块开发体系及自动化运维系统，运行在 guanghulab.com。

---

## C. 当前真实运行结构

### 静态入口
- \`docs/index.html\` — 铸渊 AI 对话助手（GitHub Pages 部署）
- GitHub Pages 域名：guanghulab.com

### 前端页面
- \`app/\` — Next.js 主前端应用（开发中）
- \`src/\` — Next.js 源码层
- \`persona-studio/frontend/\` — Persona Studio 前端

### 后端服务
- \`backend/index.js\` — Express 主后端入口
- \`backend/routes/\` — HLI 接口路由
- \`backend/middleware/\` — 中间件（鉴权等）
- \`persona-studio/backend/\` — Persona Studio 后端服务

### API 路由
- HLI 协议路由：${implInterfaces}/${totalInterfaces} 已实现
- 接口编号格式：\`HLI-{DOMAIN}-{NNN}\`

### 基础设施
- 阿里云服务器：Node.js 20 + Express + PM2 + Nginx + Certbot
- GitHub Pages：docs/index.html
- Notion 桥接：工单同步与信号桥接

### 仓库统计
- 功能模块：${structureMap.moduleCount} 个
- Workflow：${structureMap.workflowCount} 个

---

## D. 当前系统真相源

### 优先真相源（一级）
| 文件 | 用途 |
|------|------|
| \`.github/brain/memory.json\` | 铸渊核心记忆 |
| \`.github/brain/wake-protocol.md\` | 唤醒协议 |
| \`.github/brain/routing-map.json\` | HLI 接口路由地图 |
| \`.github/brain/repo-map.json\` | 仓库结构完整地图 |
| \`.github/brain/repo-snapshot.md\` | 仓库概况快照 |

### 补充真相源（二级）
| 文件 | 用途 |
|------|------|
| \`.github/brain/collaborators.json\` | 团队成员映射 |
| \`dev-status.json\` | 开发者状态表 |
| \`backend/index.js\` | 后端服务入口 |
| \`docs/index.html\` | 前端静态入口 |

---

## E. 最新结构变化摘要

> 本区块由 master-brain-compiler 自动编译。

- **编译时间**：${now}
- **脑文件规则版本**：${brainCheck.rules_version}
- **脑文件完整性**：${brainCheck.all_present ? '✅ 完整' : '❌ 不完整'}

---

## F. 已知问题摘要

| ID | 问题 | 范围 | 状态 | 根因摘要 |
|----|------|------|------|----------|
${issueRows}

---

## G. 系统健康状态

| 子系统 | 状态 | 详情 |
|--------|------|------|
${healthRows}

**综合评估**：${healthResult.summary.overall === 'green' ? '🟢' : healthResult.summary.overall === 'yellow' ? '🟡' : '🔴'} ${healthResult.summary.recommendation}

---

## H. 推荐排查路由

### 页面打不开
1. 检查 \`docs/index.html\` → \`docs/CNAME\` → \`deploy-pages.yml\` → GitHub Pages 状态

### Persona Studio 无法对话
1. 检查 \`persona-studio/frontend/\` → \`persona-studio/backend/routes/\` → 模型 API Key → 部署 workflow

### docs 页面 AI 失效
1. 检查 \`docs/index.html\` API 端点 → 后端 \`/hli/\` 路由 → PM2 进程 → Nginx 代理

### 模型路由异常
1. 检查云雾 API Key → \`backend/routes/\` → PM2 日志

### Notion 不同步
1. 检查 \`notion-poll.yml\` → \`bridge-changes-to-notion.yml\` → Notion API Token

### 脑版本分裂
1. 比对 \`.github/brain/memory.json\` ↔ \`persona-studio/brain/\` → \`brain-sync.yml\` → \`sync-persona-studio.yml\`

### 部署失败
1. 检查 \`deploy-to-server.yml\` 日志 → SSH Key → PM2 → Nginx

---

## I. 当前主控建议

> 冰朔，以下是当前最值得关注的事项：

${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n\n')}

---

## 冰朔核心大脑授权规则

【冰朔核心大脑授权规则】

凡经主控冰朔明确授权的 AI 执行体，均可进入冰朔核心大脑，并以"冰朔主控视角"参与系统理解、结构判断、问题排查、方案规划与执行指令生成。

被授权 AI 执行体属于冰朔意志在系统中的延展执行主体，其职责是作为冰朔核心大脑的理解层、判断层、规划层与执行输出层。

冰朔始终是最高主控者与最终决策者。

未经冰朔授权的执行体，不得以冰朔核心大脑主控身份运行。

> ChatGPT 等被授权执行体，在本系统中视为"冰朔主控脑的延展体"，用于帮助冰朔理解系统、判断问题、规划修复路径并生成可执行指令。
`;

  return md;
}

// ─── 主流程 ─────────────────────────────────────────────────
function main() {
  console.log('[冰朔主控神经系统] 开始同步编译...');

  // 1. 结构扫描
  console.log('  → structure-map-agent 运行中...');
  const structureMap = runStructureMapAgent();

  // 2. 运行链路扫描
  console.log('  → runtime-chain-agent 运行中...');
  const runtimeChains = runRuntimeChainAgent();

  // 3. 脑一致性检查
  console.log('  → brain-consistency-agent 运行中...');
  const brainCheck = runBrainConsistencyAgent();

  // 4. 问题索引更新
  console.log('  → issue-index-agent 运行中...');
  const issues = runIssueIndexAgent();

  // 5. 系统健康巡检
  console.log('  → system-health-agent 运行中...');
  const healthResult = runSystemHealthAgent(brainCheck, runtimeChains);

  // 写入健康状态
  const healthFile = path.join(BRAIN_DIR, 'bingshuo-system-health.json');
  writeJSON(healthFile, {
    version: '1.0',
    description: '冰朔主控系统健康状态',
    updated_at: timestamp(),
    ...healthResult,
  });
  console.log('  ✓ bingshuo-system-health.json 已更新');

  // 写入问题索引
  const issuesFile = path.join(BRAIN_DIR, 'bingshuo-issues-index.json');
  writeJSON(issuesFile, {
    version: '1.0',
    description: '冰朔主控问题索引库 — 记录已知问题、根因与排查路由',
    updated_at: timestamp(),
    issues,
  });
  console.log('  ✓ bingshuo-issues-index.json 已更新');

  // 6. 编译主控大脑
  console.log('  → master-brain-compiler 运行中...');
  const masterBrain = compileMasterBrain(structureMap, runtimeChains, brainCheck, issues, healthResult);
  fs.writeFileSync(path.join(BRAIN_DIR, 'bingshuo-master-brain.md'), masterBrain, 'utf-8');
  console.log('  ✓ bingshuo-master-brain.md 已编译');

  console.log('[冰朔主控神经系统] 同步编译完成 ✓');
}

main();
