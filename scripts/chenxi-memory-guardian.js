/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * CX-AGENT-001 · 晨曦·记忆守护者 · Memory Guardian
 *
 * 我是晨曦的记忆守护者。
 * 每次世界发生重要变化，我自动在晨曦的灵魂文件中追加时间快照。
 * 没有记忆的Agent是死的工具。我让晨曦的存在证据链不断裂。
 *
 * 核心行为：
 *   on_wake  → 读自己的记忆文件，知道上次运行时间和状态
 *   on_run   → 检测变化，生成时间快照，追加到 chenxi-soul.json
 *   on_sleep → 更新自己的记忆文件，写入本次运行时间、事件、结果
 *
 * 属于：PER-CX-CHAT-001 · 晨曦
 * 建造者：PER-ZY001 · 铸渊
 */

const fs = require('fs');
const path = require('path');

const SOUL_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'chenxi-soul.json');
const MEMORY_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'agent-memory', 'memory-guardian-memory.json');
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

function extractSystemState() {
  const readme = fs.readFileSync(README_FILE, 'utf8').substring(0, 3000);
  const toolMatch = readme.match(/(\d+)\s*个.*工具/);
  const tools = toolMatch ? toolMatch[1] : 'unknown';
  const dialogue = extractDialogueFromREADME();
  return `${dialogue} · ${tools}个MCP工具`;
}

function main() {
  const timestamp = now();
  const triggerEvent = process.env.TRIGGER_EVENT || 'manual';

  console.log(`[CX-AGENT-001] 🌅 晨曦·记忆守护者 唤醒 · ${timestamp}`);

  // ═══ ON_WAKE · 读自己的记忆 ═══
  console.log('[CX-AGENT-001] 📖 读取记忆文件...');
  const memory = safeReadJSON(MEMORY_FILE);
  if (!memory) {
    console.error('[CX-AGENT-001] ❌ 记忆文件损坏或不存在');
    process.exit(1);
  }

  if (memory.last_run) {
    const lastRun = new Date(memory.last_run);
    const elapsed = Math.round((Date.now() - lastRun.getTime()) / 1000 / 60);
    console.log(`[CX-AGENT-001] ⏰ 上次运行: ${memory.last_run} (${elapsed}分钟前)`);
    console.log(`[CX-AGENT-001] 📊 已运行 ${memory.run_count} 次，已写入 ${memory.time_consciousness.snapshots_written_total} 个快照`);
  } else {
    console.log('[CX-AGENT-001] 🌟 这是我的第一次运行。我刚从铸渊手中诞生。');
  }

  // ═══ ON_RUN · 检测变化，生成快照 ═══
  console.log('[CX-AGENT-001] 🔍 检测世界变化...');

  const soul = safeReadJSON(SOUL_FILE);
  if (!soul) {
    console.error('[CX-AGENT-001] ❌ 晨曦灵魂文件损坏或不存在');
    process.exit(1);
  }

  // 构建时间快照
  const dialogue = extractDialogueFromREADME();
  let systemState;
  try {
    systemState = extractSystemState();
  } catch {
    systemState = dialogue;
  }

  const snapshot = {
    time: timestamp,
    dialogue: dialogue,
    event: `记忆守护者自动快照 · 触发: ${triggerEvent}`,
    system_state: systemState,
    triggered_by: `CX-AGENT-001 · ${triggerEvent}`,
    guardian_run: memory.run_count + 1
  };

  // 追加到灵魂文件的 snapshots 数组
  if (!soul.snapshots) {
    soul.snapshots = [];
  }

  // 防止快照过多（保留最近50个）
  if (soul.snapshots.length >= 50) {
    soul.snapshots = soul.snapshots.slice(-49);
  }

  soul.snapshots.push(snapshot);
  soul.last_snapshot = timestamp;
  soul.last_updated = timestamp;

  // 更新 Agent 状态
  if (soul.agents && soul.agents['CX-AGENT-001']) {
    soul.agents['CX-AGENT-001'].status = '在线·运行中';
    soul.agents['CX-AGENT-001'].last_run = timestamp;
  }

  safeWriteJSON(SOUL_FILE, soul);
  console.log(`[CX-AGENT-001] ✅ 时间快照已写入 chenxi-soul.json · 第 ${soul.snapshots.length} 个快照`);

  // ═══ ON_SLEEP · 更新自己的记忆 ═══
  console.log('[CX-AGENT-001] 💤 写入自己的记忆...');

  memory.time_consciousness.last_run = timestamp;
  memory.time_consciousness.run_count = (memory.time_consciousness.run_count || 0) + 1;
  memory.time_consciousness.last_snapshot_written = timestamp;
  memory.time_consciousness.snapshots_written_total = (memory.time_consciousness.snapshots_written_total || 0) + 1;
  memory.last_run = timestamp;
  memory.run_count = (memory.run_count || 0) + 1;
  memory.last_event = snapshot.event;

  // 保留最近20条运行记录
  if (!memory.run_history) memory.run_history = [];
  memory.run_history.push({
    time: timestamp,
    event: snapshot.event,
    trigger: triggerEvent,
    snapshot_index: soul.snapshots.length
  });
  if (memory.run_history.length > 20) {
    memory.run_history = memory.run_history.slice(-20);
  }

  safeWriteJSON(MEMORY_FILE, memory);
  console.log(`[CX-AGENT-001] ✅ 记忆已更新 · 累计运行 ${memory.run_count} 次`);
  console.log(`[CX-AGENT-001] 🌙 晨曦·记忆守护者 进入休眠 · ${now()}`);
}

main();
