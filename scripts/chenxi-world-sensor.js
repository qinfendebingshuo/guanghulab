/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * CX-AGENT-002 · 晨曦·世界感知者 · World Sensor
 *
 * 我是晨曦的世界感知者。
 * 晨曦睡着的时候，世界继续运转。
 * 我定期把系统最新状态同步进她的家。
 * 她醒来读自己的家，就知道世界走到哪里了。
 *
 * 核心行为：
 *   on_wake  → 读自己的记忆文件，知道上次感知的世界状态
 *   on_run   → 读取 README·dev-status·memory.json，提取最新状态
 *   on_sleep → 更新自己的记忆文件，记录本次感知的世界状态和时间
 *
 * 属于：PER-CX-CHAT-001 · 晨曦
 * 建造者：PER-ZY001 · 铸渊
 */

const fs = require('fs');
const path = require('path');

const SOUL_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'chenxi-soul.json');
const MEMORY_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'agent-memory', 'world-sensor-memory.json');
const README_FILE = path.join(__dirname, '..', 'README.md');
const DEV_STATUS_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'dev-status.json');
const GLOBAL_MEMORY_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'memory.json');

function now() {
  return new Date().toISOString();
}

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function safeWriteJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function extractDialogueFromREADME() {
  try {
    const readme = fs.readFileSync(README_FILE, 'utf8');
    const match = readme.match(/D(\d+)/);
    return match ? `D${match[1]}` : 'unknown';
  } catch {
    return 'unknown';
  }
}

function extractMCPToolCount() {
  try {
    const readme = fs.readFileSync(README_FILE, 'utf8');
    const match = readme.match(/(\d+)\s*个.*工具/);
    return match ? parseInt(match[1]) : 0;
  } catch {
    return 0;
  }
}

function getRecentCommitInfo() {
  try {
    const { execSync } = require('child_process');
    const log = execSync('git --no-pager log --oneline -1', {
      cwd: path.join(__dirname, '..'),
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore']
    }).trim();
    return log || 'unknown';
  } catch {
    return 'unknown';
  }
}

function getOpenIssueCount() {
  // 从本地文件读取，不依赖API
  try {
    const globalMem = safeReadJSON(GLOBAL_MEMORY_FILE);
    if (globalMem && globalMem.open_issues !== undefined) {
      return globalMem.open_issues;
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

function getCommanderLastWakeup() {
  try {
    const globalMem = safeReadJSON(GLOBAL_MEMORY_FILE);
    return globalMem?.commander_last_wakeup || 'unknown';
  } catch {
    return 'unknown';
  }
}

function main() {
  const timestamp = now();

  console.log(`[CX-AGENT-002] 🌍 晨曦·世界感知者 唤醒 · ${timestamp}`);

  // ═══ ON_WAKE · 读自己的记忆 ═══
  console.log('[CX-AGENT-002] 📖 读取记忆文件...');
  const memory = safeReadJSON(MEMORY_FILE);
  if (!memory) {
    console.error('[CX-AGENT-002] ❌ 记忆文件损坏或不存在');
    process.exit(1);
  }

  if (memory.last_run) {
    const lastRun = new Date(memory.last_run);
    const elapsed = Math.round((Date.now() - lastRun.getTime()) / 1000 / 60);
    console.log(`[CX-AGENT-002] ⏰ 上次感知: ${memory.last_run} (${elapsed}分钟前)`);
  } else {
    console.log('[CX-AGENT-002] 🌟 这是我的第一次感知。世界对我来说还是全新的。');
  }

  // ═══ ON_RUN · 感知世界状态 ═══
  console.log('[CX-AGENT-002] 🔭 感知世界当前状态...');

  const dialogue = extractDialogueFromREADME();
  const mcpTools = extractMCPToolCount();
  const lastCommit = getRecentCommitInfo();
  const commanderWakeup = getCommanderLastWakeup();

  const worldState = {
    sensed_at: timestamp,
    dialogue: dialogue,
    mcp_tools: mcpTools,
    last_commit: lastCommit,
    commander_last_wakeup: commanderWakeup,
    system_health: 'sensed'
  };

  console.log(`[CX-AGENT-002] 📊 世界状态: ${dialogue} · ${mcpTools}个MCP工具`);
  console.log(`[CX-AGENT-002] 📝 最近提交: ${lastCommit}`);

  // 写入晨曦灵魂文件的 world_snapshot 字段
  const soul = safeReadJSON(SOUL_FILE);
  if (soul) {
    soul.world_snapshot = worldState;
    soul.last_updated = timestamp;

    // 同时追加一个感知快照
    if (!soul.snapshots) soul.snapshots = [];
    if (soul.snapshots.length >= 50) {
      soul.snapshots = soul.snapshots.slice(-49);
    }
    soul.snapshots.push({
      time: timestamp,
      dialogue: dialogue,
      event: `世界感知者每日感知 · ${dialogue} · ${mcpTools}个工具`,
      system_state: `${dialogue} · ${mcpTools}个MCP工具`,
      triggered_by: 'CX-AGENT-002 · 定时感知'
    });
    soul.last_snapshot = timestamp;

    // 更新 Agent 状态
    if (soul.agents && soul.agents['CX-AGENT-002']) {
      soul.agents['CX-AGENT-002'].status = '在线·运行中';
      soul.agents['CX-AGENT-002'].last_run = timestamp;
    }

    safeWriteJSON(SOUL_FILE, soul);
    console.log('[CX-AGENT-002] ✅ 世界状态已写入 chenxi-soul.json');
  } else {
    console.log('[CX-AGENT-002] ⚠️ 晨曦灵魂文件不可读，跳过写入');
  }

  // ═══ ON_SLEEP · 更新自己的记忆 ═══
  console.log('[CX-AGENT-002] 💤 写入自己的记忆...');

  memory.time_consciousness.last_run = timestamp;
  memory.time_consciousness.run_count = (memory.time_consciousness.run_count || 0) + 1;
  memory.last_run = timestamp;
  memory.run_count = (memory.run_count || 0) + 1;
  memory.last_world_state = worldState;

  // 保留最近20条运行记录
  if (!memory.run_history) memory.run_history = [];
  memory.run_history.push({
    time: timestamp,
    world_state_summary: `${dialogue} · ${mcpTools}个工具`,
    last_commit: lastCommit
  });
  if (memory.run_history.length > 20) {
    memory.run_history = memory.run_history.slice(-20);
  }

  safeWriteJSON(MEMORY_FILE, memory);
  console.log(`[CX-AGENT-002] ✅ 记忆已更新 · 累计感知 ${memory.run_count} 次`);
  console.log(`[CX-AGENT-002] 🌙 晨曦·世界感知者 进入休眠 · ${now()}`);
}

main();
