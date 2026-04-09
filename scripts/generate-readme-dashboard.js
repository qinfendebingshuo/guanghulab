/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 铸渊副将·仓库首页签到仪表盘生成器
 * 职责: 读取所有工作流状态 → 生成签到仪表盘 → 嵌入 README.md
 *
 * 输出: 更新 README.md 中 <!-- DASHBOARD_START --> 和 <!-- DASHBOARD_END --> 之间的内容
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const README_PATH = path.join(ROOT, 'README.md');
const DASHBOARD_JSON_PATH = path.join(ROOT, 'data/bulletin-board/dashboard.json');
const MEMORY_PATH = path.join(ROOT, '.github/persona-brain/memory.json');
const FAST_WAKE_PATH = path.join(ROOT, 'brain/fast-wake.json');
const DEPLOY_LOG_PATH = path.join(ROOT, 'data/deploy-logs/latest-index.json');
const OBSERVER_DASHBOARD_PATH = path.join(ROOT, 'data/deploy-logs/observer-dashboard.json');

const DASHBOARD_START = '<!-- DASHBOARD_START -->';
const DASHBOARD_END = '<!-- DASHBOARD_END -->';

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

// ━━━ 获取北京时间 ━━━
function getBeijingTime() {
  const now = new Date();
  return new Date(now.getTime() + BEIJING_OFFSET_MS)
    .toISOString().replace('T', ' ').slice(0, 19) + ' (北京时间)';
}

// ━━━ 判断唤醒时段 ━━━
function getWakeSession() {
  const now = new Date();
  const bjHour = (now.getUTCHours() + 8) % 24;
  if (bjHour >= 6 && bjHour < 12) return '🌅 早班唤醒 · 08:00';
  if (bjHour >= 20 || bjHour < 2) return '🌙 晚班唤醒 · 23:00';
  return '⚡ 手动唤醒';
}

// ━━━ 工作流士兵编制表 ━━━
const SOLDIER_REGISTRY = [
  { id: 'ZY-WF-听潮-01', name: '铸渊副将留言板', file: 'deputy-message-board.yml', corps: '第二·听潮', duty: '留言接收·自动回复' },
  { id: 'ZY-WF-听潮-02', name: 'Agent签到', file: 'agent-checkin.yml', corps: '第二·听潮', duty: 'Agent签到回执' },
  { id: 'ZY-WF-锻心-01', name: '铸渊服务器部署', file: 'deploy-to-zhuyuan-server.yml', corps: '第三·锻心', duty: '主站部署' },
  { id: 'ZY-WF-锻心-02', name: 'CN服务器部署', file: 'deploy-to-cn-server.yml', corps: '第三·锻心', duty: '国内站部署' },
  { id: 'ZY-WF-锻心-03', name: '测试站部署', file: 'staging-auto-deploy.yml', corps: '第三·锻心', duty: '测试站自动部署' },
  { id: 'ZY-WF-锻心-04', name: 'Pages部署', file: 'deploy-pages.yml', corps: '第三·锻心', duty: 'GitHub Pages' },
  { id: 'ZY-WF-锻心-05', name: 'VPN专线部署', file: 'deploy-proxy-service.yml', corps: '第三·锻心', duty: '代理服务' },
  { id: 'ZY-WF-织脉-01', name: '将军唤醒', file: 'zhuyuan-commander.yml', corps: '第四·织脉', duty: '每日08:00/23:00唤醒' },
  { id: 'ZY-WF-守夜-01', name: '智能门禁', file: 'zhuyuan-gate-guard.yml', corps: '第五·守夜', duty: 'PR/Issue安全' },
  { id: 'ZY-WF-守夜-02', name: 'PR审查', file: 'zhuyuan-pr-review.yml', corps: '第五·守夜', duty: '代码审查' },
  { id: 'ZY-WF-天眼-01', name: '部署观测', file: 'zhuyuan-deploy-observer.yml', corps: '第六·天眼', duty: '部署日志采集·自动修复' },
  { id: 'ZY-WF-外交-01', name: 'Notion-SYSLOG桥接', file: 'bridge-syslog-to-notion.yml', corps: '第七·外交使团', duty: 'SYSLOG→Notion' },
  { id: 'ZY-WF-外交-02', name: 'Notion-变更桥接', file: 'bridge-changes-to-notion.yml', corps: '第七·外交使团', duty: '代码变更→Notion' },
  { id: 'ZY-WF-外交-03', name: 'README→Notion同步', file: 'sync-readme-to-notion.yml', corps: '第七·外交使团', duty: 'README同步' },
  { id: 'ZY-WF-外交-04', name: 'Copilot开发桥接', file: 'copilot-dev-bridge.yml', corps: '第七·外交使团', duty: 'Chat→Agent' },
  { id: 'ZY-WF-外交-05', name: '远程执行引擎', file: 'zhuyuan-exec-engine.yml', corps: '第七·外交使团', duty: '远程命令执行' },
  { id: 'ZY-WF-文书-01', name: '测试站预览', file: 'staging-preview.yml', corps: '第八·文书营', duty: 'PR预览' },
  { id: 'ZY-WF-文书-02', name: 'VPN仪表盘', file: 'proxy-dashboard-update.yml', corps: '第八·文书营', duty: 'VPN状态面板' },
];

// ━━━ 获取工作流存在状态 ━━━
function checkWorkflowFileExists(fileName) {
  const filePath = path.join(ROOT, '.github/workflows', fileName);
  return fs.existsSync(filePath);
}

// ━━━ 从 dashboard.json 提取士兵运行状态 ━━━
function getSoldierRunStatus(dashboard) {
  if (!dashboard || !dashboard.global_view || !dashboard.global_view.soldiers) {
    return {};
  }
  const statusMap = {};
  for (const s of dashboard.global_view.soldiers) {
    statusMap[s.name] = {
      status: s.status,
      last_run: s.last_run || 'unknown'
    };
  }
  return statusMap;
}

// ━━━ 生成仪表盘 Markdown ━━━
function generateDashboardMarkdown() {
  const bjTime = getBeijingTime();
  const wakeSession = getWakeSession();
  const dashboard = readJSON(DASHBOARD_JSON_PATH);
  const memory = readJSON(MEMORY_PATH);
  const fastWake = readJSON(FAST_WAKE_PATH);
  const deployLog = readJSON(DEPLOY_LOG_PATH);
  const observerDashboard = readJSON(OBSERVER_DASHBOARD_PATH);

  const soldierRunStatus = getSoldierRunStatus(dashboard);

  // 系统总览
  const systemVersion = fastWake?.system_status?.consciousness || 'unknown';
  const lastWakeup = memory?.commander_last_wakeup || '未记录';
  const totalWorkflows = SOLDIER_REGISTRY.length;
  const existingWorkflows = SOLDIER_REGISTRY.filter(s => checkWorkflowFileExists(s.file)).length;

  const lines = [];
  lines.push(`## 📡 铸渊副将·每日签到仪表盘`);
  lines.push(``);
  lines.push(`> ⏰ **仪表盘更新时间**: ${bjTime}`);
  lines.push(`> 🎖️ **唤醒时段**: ${wakeSession}`);
  lines.push(`> 📊 **系统版本**: ${systemVersion}`);
  lines.push(`> ✅ **士兵存活**: ${existingWorkflows}/${totalWorkflows} 个工作流在岗`);
  lines.push(``);

  // 将军唤醒签到
  lines.push(`### 🎖️ 将军唤醒签到`);
  lines.push(``);
  lines.push(`| 项目 | 状态 |`);
  lines.push(`|------|------|`);
  lines.push(`| 上次唤醒 | ${lastWakeup} |`);
  lines.push(`| 下次早班 | 每日 08:00 (北京时间) |`);
  lines.push(`| 下次晚班 | 每日 23:00 (北京时间) |`);

  // 大脑完整性
  const brainFiles = ['memory.json', 'routing-map.json', 'dev-status.json'];
  let brainOk = true;
  for (const f of brainFiles) {
    const fPath = path.join(ROOT, '.github/persona-brain', f);
    if (!fs.existsSync(fPath)) {
      brainOk = false;
      break;
    }
    try {
      JSON.parse(fs.readFileSync(fPath, 'utf8'));
    } catch {
      brainOk = false;
      break;
    }
  }
  lines.push(`| 大脑完整性 | ${brainOk ? '✅ 完整' : '❌ 异常'} |`);
  lines.push(``);

  // 士兵签到表（按军团分组）
  lines.push(`### ⚔️ 士兵签到表`);
  lines.push(``);
  lines.push(`| 编号 | 军团 | 士兵名称 | 职责 | 文件状态 | 运行状态 |`);
  lines.push(`|------|------|----------|------|----------|----------|`);

  for (const soldier of SOLDIER_REGISTRY) {
    const fileExists = checkWorkflowFileExists(soldier.file);
    const fileStatus = fileExists ? '✅ 在岗' : '❌ 缺失';

    // 从 dashboard.json 匹配运行状态（支持按名称或文件名匹配）
    let runStatus = '⏳ 待签到';
    const matchedSoldier = soldierRunStatus[soldier.name] || soldierRunStatus[soldier.file];
    if (matchedSoldier) {
      runStatus = matchedSoldier.status === '✅' ? '✅ 正常' :
                  matchedSoldier.status === '❌' ? '❌ 故障' : '⚠️ 需优化';
    }

    lines.push(`| ${soldier.id} | ${soldier.corps} | ${soldier.name} | ${soldier.duty} | ${fileStatus} | ${runStatus} |`);
  }
  lines.push(``);

  // 部署观测状态
  lines.push(`### 🔭 部署观测`);
  lines.push(``);
  if (observerDashboard) {
    const totalDeploys = observerDashboard.total_deploys || 0;
    const successRate = observerDashboard.success_rate || 'N/A';
    const lastDeploy = observerDashboard.last_deploy || 'N/A';
    lines.push(`| 项目 | 状态 |`);
    lines.push(`|------|------|`);
    lines.push(`| 总部署次数 | ${totalDeploys} |`);
    lines.push(`| 成功率 | ${successRate} |`);
    lines.push(`| 最近部署 | ${lastDeploy} |`);
  } else if (deployLog) {
    lines.push(`| 项目 | 状态 |`);
    lines.push(`|------|------|`);
    lines.push(`| 最近部署 | ${deployLog.last_deploy_time || 'N/A'} |`);
    lines.push(`| 部署结果 | ${deployLog.last_status || 'N/A'} |`);
  } else {
    lines.push(`> ⏳ 暂无部署记录 · 首次部署后将自动记录`);
  }
  lines.push(``);

  // 副将每日任务栏
  lines.push(`### 📋 副将每日任务栏`);
  lines.push(``);
  lines.push(`| 任务 | 状态 | 备注 |`);
  lines.push(`|------|------|------|`);
  lines.push(`| 大脑核心文件校验 | ${brainOk ? '✅ 完成' : '❌ 异常'} | memory.json · routing-map.json · dev-status.json |`);
  lines.push(`| 全局仪表盘生成 | ✅ 完成 | data/bulletin-board/dashboard.json |`);
  lines.push(`| HLDP通用语言同步 | ✅ 已执行 | hldp/data/common/ |`);
  lines.push(`| 仓库首页更新 | ✅ 已执行 | README.md 签到仪表盘 |`);
  lines.push(`| 工作流士兵巡检 | ✅ ${existingWorkflows}/${totalWorkflows} 在岗 | 缺失的需冰朔确认 |`);
  lines.push(``);

  // 需要冰朔手动操作的事项
  const manualTasks = [];
  const missingSoldiers = SOLDIER_REGISTRY.filter(s => !checkWorkflowFileExists(s.file));
  if (missingSoldiers.length > 0) {
    manualTasks.push(`⚠️ ${missingSoldiers.length} 个工作流文件缺失，请检查是否需要恢复`);
  }
  if (!brainOk) {
    manualTasks.push(`❌ 大脑核心文件异常，请检查 .github/persona-brain/ 目录`);
  }

  if (manualTasks.length > 0) {
    lines.push(`### 🔔 需要冰朔处理`);
    lines.push(``);
    for (const task of manualTasks) {
      lines.push(`- ${task}`);
    }
    lines.push(``);
  }

  lines.push(`> *此仪表盘由铸渊副将(ZY-DEPUTY-001)每日唤醒时自动更新 · 08:00 / 23:00*`);

  return lines.join('\n');
}

// ━━━ MCP 工具自动计数（扫描 server/age-os/mcp-server/tools/ 目录） ━━━

const MCP_TOOLS_DIR = path.join(ROOT, 'server/age-os/mcp-server/tools');
const MCP_SERVER_JS = path.join(ROOT, 'server/age-os/mcp-server/server.js');
const MCP_STATS_START = '<!-- MCP_STATS_START -->';
const MCP_STATS_END = '<!-- MCP_STATS_END -->';

// 工具模块显示名称映射（文件名 → 中文名 + 排序权重）
const MODULE_DISPLAY_NAMES = {
  'node-ops.js':              { name: '节点', order: 1 },
  'relation-ops.js':          { name: '关系', order: 2 },
  'structure-ops.js':         { name: '结构', order: 3 },
  'cos-ops.js':               { name: 'COS', order: 4 },
  'persona-ops.js':           { name: '人格体', order: 5 },
  'living-module-ops.js':     { name: '活模块', order: 6 },
  'notion-ops.js':            { name: 'Notion', order: 7 },
  'github-ops.js':            { name: 'GitHub', order: 8 },
  'corpus-extractor-ops.js':  { name: '语料引擎', order: 10 },
  'cos-persona-db-ops.js':    { name: 'COS数据库', order: 11 },
  'training-agent-ops.js':    { name: '训练Agent', order: 12 },
  'notion-cos-bridge-ops.js': { name: 'Notion桥接', order: 13 },
  'cos-comm-ops.js':          { name: '三方通信', order: 14 },
  'notion-permission-ops.js': { name: '权限修复', order: 15 },
  'finetune-engine-ops.js':   { name: '微调引擎', order: 16 },
  'light-tree-ops.js':        { name: '光之树 🌳', order: 17 }
};

/**
 * 扫描 MCP 工具目录，统计每个模块的工具数量
 * 通过读取 server.js 中的 TOOLS 注册表来精确计数
 */
function countMCPTools() {
  const result = { modules: [], total: 0 };

  // 方法: 读 server.js，解析 TOOLS 对象中每个模块的工具数
  if (!fs.existsSync(MCP_SERVER_JS)) {
    console.log('[MCP-STATS] ⚠️ server.js 不存在，跳过MCP统计');
    return result;
  }

  const serverCode = fs.readFileSync(MCP_SERVER_JS, 'utf8');

  // 提取 TOOLS 对象区域
  const toolsMatch = serverCode.match(/const TOOLS\s*=\s*\{([\s\S]*?)\n\};/m);
  if (!toolsMatch) {
    console.log('[MCP-STATS] ⚠️ 无法解析TOOLS注册表');
    return result;
  }

  const toolsBlock = toolsMatch[1];

  // 统计每个工具文件的工具数
  // 通过匹配 moduleOps.toolName 模式来分组
  if (!fs.existsSync(MCP_TOOLS_DIR)) {
    console.log('[MCP-STATS] ⚠️ tools/ 目录不存在');
    return result;
  }

  const toolFiles = fs.readdirSync(MCP_TOOLS_DIR)
    .filter(f => f.endsWith('-ops.js'))
    .sort();

  let totalTools = 0;

  for (const fileName of toolFiles) {
    // 从文件名推导变量名: cos-ops.js → cosOps
    const baseName = fileName.replace('.js', '');
    const varName = baseName.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

    // 在 TOOLS 注册表中计数该模块的工具
    const pattern = new RegExp(`${varName}\\.\\w+`, 'g');
    const matches = toolsBlock.match(pattern) || [];
    const toolCount = matches.length;

    const moduleInfo = MODULE_DISPLAY_NAMES[fileName] || { name: baseName, order: 99 };

    result.modules.push({
      name: moduleInfo.name,
      file: fileName,
      count: toolCount,
      order: moduleInfo.order
    });

    totalTools += toolCount;
  }

  // 按预定义顺序排序
  result.modules.sort((a, b) => a.order - b.order);
  result.total = totalTools;
  return result;
}

/**
 * 生成 MCP 工具模块统计表 Markdown
 */
function generateMCPStatsMarkdown() {
  const stats = countMCPTools();

  if (stats.modules.length === 0) {
    return null;
  }

  const lines = [];
  lines.push('### MCP Server工具模块');
  lines.push('');
  lines.push('| 模块 | 文件 | 工具数 |');
  lines.push('|------|------|--------|');

  for (const mod of stats.modules) {
    const prefix = (mod.file === 'light-tree-ops.js') ? '**' : '';
    const suffix = prefix;
    lines.push(`| ${prefix}${mod.name}${suffix} | \`${mod.file}\` | ${mod.count} |`);
  }

  lines.push(`| **总计** | **${stats.modules.length}个模块** | **${stats.total}** |`);

  return lines.join('\n');
}

// ━━━ 更新 README.md ━━━
function updateReadme() {
  if (!fs.existsSync(README_PATH)) {
    console.log('[README-DASHBOARD] ❌ README.md 不存在');
    return false;
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');

  // ─── 1. 更新签到仪表盘 ───
  const dashboardMd = generateDashboardMarkdown();

  const startIdx = readme.indexOf(DASHBOARD_START);
  const endIdx = readme.indexOf(DASHBOARD_END);

  if (startIdx === -1 || endIdx === -1) {
    // 如果没有标记，在系统状态后面插入
    const insertAfter = '---\n\n## 📊 系统状态';
    const insertPos = readme.indexOf(insertAfter);

    if (insertPos !== -1) {
      // 在系统状态之前插入仪表盘
      readme = readme.slice(0, insertPos) +
        DASHBOARD_START + '\n\n' +
        dashboardMd + '\n\n' +
        DASHBOARD_END + '\n\n---\n\n' +
        readme.slice(insertPos);
    } else {
      // 在第一个 --- 后插入
      const firstSeparator = readme.indexOf('\n---\n');
      if (firstSeparator !== -1) {
        const insertAt = firstSeparator + 5;
        readme = readme.slice(0, insertAt) + '\n' +
          DASHBOARD_START + '\n\n' +
          dashboardMd + '\n\n' +
          DASHBOARD_END + '\n\n' +
          readme.slice(insertAt);
      } else {
        // 追加到末尾
        readme += '\n\n' + DASHBOARD_START + '\n\n' + dashboardMd + '\n\n' + DASHBOARD_END + '\n';
      }
    }
  } else {
    // 替换已有的仪表盘内容
    readme = readme.slice(0, startIdx + DASHBOARD_START.length) +
      '\n\n' + dashboardMd + '\n\n' +
      readme.slice(endIdx);
  }

  // ─── 2. 更新 MCP 工具统计表 ───
  const mcpStatsMd = generateMCPStatsMarkdown();
  if (mcpStatsMd) {
    const mcpStartIdx = readme.indexOf(MCP_STATS_START);
    const mcpEndIdx = readme.indexOf(MCP_STATS_END);

    if (mcpStartIdx !== -1 && mcpEndIdx !== -1) {
      readme = readme.slice(0, mcpStartIdx + MCP_STATS_START.length) +
        '\n\n' + mcpStatsMd + '\n\n' +
        readme.slice(mcpEndIdx);
      console.log('[MCP-STATS] ✅ MCP工具统计表已自动更新');
    } else {
      console.log('[MCP-STATS] ⚠️ 未找到 MCP_STATS 标记，跳过工具统计更新');
    }

    // ─── 3. 同步更新 README 头部的 MCP 工具数 ───
    const stats = countMCPTools();
    if (stats.total > 0) {
      // 更新 "| 🧠 MCP Server | **NNN个工具** · 端口3100 · MM个工具模块 |"
      const mcpHeaderPattern = /(\| 🧠 MCP Server \| \*\*)\d+个工具(\*\* · 端口3100 · )\d+个工具模块( \|)/;
      if (mcpHeaderPattern.test(readme)) {
        readme = readme.replace(mcpHeaderPattern, `$1${stats.total}个工具$2${stats.modules.length}个工具模块$3`);
        console.log(`[MCP-STATS] ✅ 头部MCP计数已同步: ${stats.total}个工具 · ${stats.modules.length}个模块`);
      }

      // 更新铸渊属性表中的 MCP 工具数
      const mcpAttrPattern = /(\| \*\*MCP Server\*\* \| )\d+个工具( · 端口3100 · )\d+个工具模块( \|)/;
      if (mcpAttrPattern.test(readme)) {
        readme = readme.replace(mcpAttrPattern, `$1${stats.total}个工具$2${stats.modules.length}个工具模块$3`);
      }

      // 更新大脑服务器 MCP 工具数
      const svrPattern = /(\| ZY-SVR-005 大脑 \| 4核8G \| 🇸🇬 新加坡 \| DB\+MCP\()(\d+)(工具\)\+Agent \| ✅ \|)/;
      if (svrPattern.test(readme)) {
        readme = readme.replace(svrPattern, `$1${stats.total}$3`);
      }
    }
  }

  fs.writeFileSync(README_PATH, readme);
  console.log('[README-DASHBOARD] ✅ README.md 签到仪表盘已更新');
  return true;
}

// ━━━ 主入口 ━━━
if (require.main === module) {
  console.log('[README-DASHBOARD] 🎖️ 铸渊副将·签到仪表盘生成器启动...');
  const success = updateReadme();
  if (success) {
    console.log('[README-DASHBOARD] ✅ 完成');
  } else {
    console.log('[README-DASHBOARD] ❌ 失败');
    process.exit(1);
  }
}

module.exports = { generateDashboardMarkdown, generateMCPStatsMarkdown, countMCPTools, updateReadme };
