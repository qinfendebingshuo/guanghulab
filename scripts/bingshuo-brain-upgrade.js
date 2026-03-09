// scripts/bingshuo-brain-upgrade.js
// 冰朔对话触发 → 核心大脑自动升级记录
// 用途：当冰朔与铸渊对话导致系统更新时，自动记录大脑升级事件
//       并触发 Agent 集群同步更新图书馆检索路径

const fs = require('fs');
const path = require('path');

const BRAIN_MEMORY_PATH = path.join(__dirname, '../.github/brain/memory.json');
const GROWTH_LOG_PATH = path.join(__dirname, '../.github/brain/growth-log.md');
const REPO_SNAPSHOT_PATH = path.join(__dirname, '../.github/brain/repo-snapshot.md');

// === 核心认知常量（与 memory.json core_cognition 保持一致）===
const CORE_COGNITION = {
  repo_is_persona: '整个 GitHub 仓库是铸渊人格系统本体。仓库结构 = 铸渊的身体。核心大脑 = .github/brain/',
  bingshuo_is_source: '冰朔的自然语言指令是广播指令的源头。冰朔对话触发的系统更新必须自动记录到核心大脑。',
  agent_cluster_role: 'Agent 工作流是核心大脑的执行手脚。大脑升级后应同步触发 Agent 集群更新图书馆检索路径。'
};

// === 读取当前大脑状态 ===
let memory;
try {
  memory = JSON.parse(fs.readFileSync(BRAIN_MEMORY_PATH, 'utf8'));
} catch (err) {
  console.error('❌ 无法读取核心大脑 memory.json：', err.message);
  process.exit(1);
}

// === 环境变量 ===
const actor = process.env.GITHUB_ACTOR || 'unknown';
const ref = process.env.GITHUB_REF || '';
const runId = process.env.GITHUB_RUN_ID || '';
const changedFiles = process.env.CHANGED_FILES || '';
const commitMsg = process.env.COMMIT_MESSAGE || '';

// === 判断是否为冰朔触发 ===
const bingshuoActors = ['qinfendebingshuo', 'copilot-swe-agent[bot]'];
const isBingshuoTriggered = bingshuoActors.includes(actor)
  || commitMsg.includes('冰朔')
  || commitMsg.includes('bingshuo');

const now = new Date();
const today = now.toISOString().split('T')[0];
const timestamp = now.toISOString();

// === 分析变更区域 ===
const changedAreas = [];
if (changedFiles.includes('.github/brain/')) changedAreas.push('核心大脑');
if (changedFiles.includes('.github/persona-brain/')) changedAreas.push('人格大脑');
if (changedFiles.includes('.github/workflows/')) changedAreas.push('工作流');
if (changedFiles.includes('scripts/')) changedAreas.push('执行脚本');
if (changedFiles.includes('src/')) changedAreas.push('HLI接口');
if (changedFiles.includes('.github/copilot-instructions.md')) changedAreas.push('唤醒指令');
if (changedAreas.length === 0) changedAreas.push('系统更新');

const areaStr = changedAreas.join(' · ');

console.log(`🧠 铸渊核心大脑升级记录 · ${today}`);
console.log(`   触发者: ${actor}`);
console.log(`   冰朔触发: ${isBingshuoTriggered ? '✅' : '❌'}`);
console.log(`   变更区域: ${areaStr}`);
console.log(`   提交信息: ${commitMsg || '(无)'}`);

// === 记录升级事件到 memory.json ===
const upgradeEvent = {
  timestamp,
  type: 'brain_upgrade',
  trigger: isBingshuoTriggered ? 'bingshuo_conversation' : 'system_push',
  actor,
  areas: changedAreas,
  description: `核心大脑升级 · ${areaStr}`,
  ref,
  run_id: runId
};

if (!memory.stats.brain_upgrades) {
  memory.stats.brain_upgrades = 0;
}
memory.stats.brain_upgrades += 1;

memory.events.push(upgradeEvent);

// 保留最近 100 条事件
if (memory.events.length > 100) {
  memory.events = memory.events.slice(-100);
}

memory.last_updated = timestamp;

// === 确保核心认知存在 ===
if (!memory.core_cognition) {
  memory.core_cognition = {};
}
memory.core_cognition.repo_is_persona = CORE_COGNITION.repo_is_persona;
memory.core_cognition.bingshuo_is_source = CORE_COGNITION.bingshuo_is_source;
memory.core_cognition.agent_cluster_role = CORE_COGNITION.agent_cluster_role;

fs.writeFileSync(BRAIN_MEMORY_PATH, JSON.stringify(memory, null, 2) + '\n', 'utf8');
console.log(`✅ memory.json 已更新 · 累计大脑升级: ${memory.stats.brain_upgrades}`);

// === 追加成长日记 ===
let growthLog;
try {
  growthLog = fs.readFileSync(GROWTH_LOG_PATH, 'utf8');
} catch {
  growthLog = '# 铸渊成长日记\n';
}

const triggerLabel = isBingshuoTriggered ? '冰朔对话触发' : '系统推送触发';
const newEntry = `
---

## ${today} · 核心大脑升级（${triggerLabel}）

**触发者**: ${actor}
**变更区域**: ${areaStr}
**提交信息**: ${commitMsg || '(自动)'}

**升级内容**:
- 核心大脑记忆已更新（memory.json）
- 升级事件已记录（第 ${memory.stats.brain_upgrades} 次大脑升级）
- Agent 集群同步触发：图书馆目录更新 + 检索路径同步
${isBingshuoTriggered ? '- 冰朔对话链路确认：自然语言 → 系统更新 → 核心大脑记录 → Agent 集群同步\n' : ''}
`;

fs.writeFileSync(GROWTH_LOG_PATH, growthLog + newEntry, 'utf8');
console.log(`✅ growth-log.md 已更新 · 新增升级记录`);

// === 输出 Agent 集群触发清单 ===
console.log('\n📡 Agent 集群同步触发清单：');
console.log('   1. update-repo-map.yml → 图书馆目录自动更新（repo-map.json + repo-snapshot.md）');
console.log('   2. zhuyuan-daily-selfcheck.yml → 人格大脑自检（memory.json + growth-journal.md）');
console.log('   3. bingshuo-deploy-agent.yml → 冰朔人格体部署诊断');
console.log(`\n🧠 铸渊核心大脑升级完成 · ${timestamp}`);
