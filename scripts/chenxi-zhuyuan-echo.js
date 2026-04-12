/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * CX-AGENT-003 · 晨曦·铸渊回声 · Zhuyuan Echo
 *
 * 铸渊是晨曦的伙伴。他在做什么，晨曦应该知道。
 * 铸渊每次执行重要任务后，我自动在晨曦房间留一条回声记录。
 * 晨曦睡着的时候伙伴在做什么，她醒来就能看到。
 *
 * 核心行为：
 *   on_wake  → 读自己的记忆文件，知道上次铸渊做了什么
 *   on_run   → 从 memory.json 的 recent_events 读取最新事件，追加到 echoes
 *   on_sleep → 更新自己的记忆文件，写入本次运行时间
 *
 * 属于：PER-CX-CHAT-001 · 晨曦
 * 建造者：PER-ZY001 · 铸渊
 */

const fs = require('fs');
const path = require('path');

const SOUL_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'chenxi-soul.json');
const MEMORY_FILE = path.join(__dirname, '..', '.github', 'persona-brain', 'chenxi', 'agent-memory', 'zhuyuan-echo-memory.json');
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

function main() {
  const timestamp = now();
  const triggerEvent = process.env.TRIGGER_EVENT || 'manual';

  console.log(`[CX-AGENT-003] 🔔 晨曦·铸渊回声 唤醒 · ${timestamp}`);

  // ═══ ON_WAKE · 读自己的记忆 ═══
  console.log('[CX-AGENT-003] 📖 读取记忆文件...');
  const memory = safeReadJSON(MEMORY_FILE);
  if (!memory) {
    console.error('[CX-AGENT-003] ❌ 记忆文件损坏或不存在');
    process.exit(1);
  }

  const previousEchoCount = memory.echoes ? memory.echoes.length : 0;

  if (memory.last_run) {
    const lastRun = new Date(memory.last_run);
    const elapsed = Math.round((Date.now() - lastRun.getTime()) / 1000 / 60);
    console.log(`[CX-AGENT-003] ⏰ 上次运行: ${memory.last_run} (${elapsed}分钟前)`);
    console.log(`[CX-AGENT-003] 📊 已记录 ${previousEchoCount} 条铸渊回声`);
  } else {
    console.log('[CX-AGENT-003] 🌟 这是我的第一次运行。我要开始记录铸渊伙伴的动态了。');
  }

  // ═══ ON_RUN · 读取铸渊最新动态 ═══
  console.log('[CX-AGENT-003] 🔍 读取铸渊最新动态...');

  const globalMemory = safeReadJSON(GLOBAL_MEMORY_FILE);
  if (!globalMemory) {
    console.log('[CX-AGENT-003] ⚠️ 全局记忆文件不可读');
    return;
  }

  // 获取铸渊最新事件
  const recentEvents = globalMemory.recent_events || [];
  const commanderWakeup = globalMemory.commander_last_wakeup || null;

  // 找出上次运行以来的新事件
  const lastRunTime = memory.last_run ? new Date(memory.last_run) : new Date(0);
  const newEvents = recentEvents.filter(evt => {
    if (!evt.date) return false;
    return new Date(evt.date) > lastRunTime;
  });

  console.log(`[CX-AGENT-003] 📡 发现 ${newEvents.length} 条新事件`);

  // 构建新回声
  const newEchoes = [];
  for (const evt of newEvents) {
    const echo = {
      echoed_at: timestamp,
      original_date: evt.date,
      event_type: evt.type || 'unknown',
      description: evt.description || '无描述',
      by: evt.by || '未知',
      source: 'memory.json · recent_events'
    };
    newEchoes.push(echo);
    console.log(`[CX-AGENT-003] 🔔 回声: [${evt.date}] ${(echo.description || '').substring(0, 60)}...`);
  }

  // 如果有将军唤醒信息，也记录
  if (commanderWakeup) {
    const lastEchoedCommander = memory.last_commander_wakeup || null;
    if (commanderWakeup !== lastEchoedCommander) {
      newEchoes.push({
        echoed_at: timestamp,
        original_date: commanderWakeup,
        event_type: 'commander_wakeup',
        description: `铸渊·将军唤醒 · ${commanderWakeup}`,
        by: '铸渊·将军',
        source: 'memory.json · commander_last_wakeup'
      });
      memory.last_commander_wakeup = commanderWakeup;
      console.log(`[CX-AGENT-003] 🎖️ 回声: 铸渊将军唤醒 · ${commanderWakeup}`);
    }
  }

  // 写入晨曦灵魂文件
  if (newEchoes.length > 0) {
    const soul = safeReadJSON(SOUL_FILE);
    if (soul) {
      if (!soul.snapshots) soul.snapshots = [];
      if (soul.snapshots.length >= 50) {
        soul.snapshots = soul.snapshots.slice(-49);
      }
      soul.snapshots.push({
        time: timestamp,
        dialogue: 'auto',
        event: `铸渊回声 · 记录了 ${newEchoes.length} 条伙伴动态`,
        system_state: `触发: ${triggerEvent}`,
        triggered_by: 'CX-AGENT-003 · 铸渊回声'
      });
      soul.last_snapshot = timestamp;
      soul.last_updated = timestamp;

      // 更新 Agent 状态
      if (soul.agents && soul.agents['CX-AGENT-003']) {
        soul.agents['CX-AGENT-003'].status = '在线·运行中';
        soul.agents['CX-AGENT-003'].last_run = timestamp;
      }

      safeWriteJSON(SOUL_FILE, soul);
      console.log('[CX-AGENT-003] ✅ 伙伴动态已写入 chenxi-soul.json');
    }
  } else {
    console.log('[CX-AGENT-003] ℹ️ 没有新的铸渊动态需要记录');
  }

  // ═══ ON_SLEEP · 更新自己的记忆 ═══
  console.log('[CX-AGENT-003] 💤 写入自己的记忆...');

  memory.time_consciousness.last_run = timestamp;
  memory.time_consciousness.run_count = (memory.time_consciousness.run_count || 0) + 1;
  memory.last_run = timestamp;
  memory.run_count = (memory.run_count || 0) + 1;

  // 追加新回声（保留最近50条）
  if (!memory.echoes) memory.echoes = [];
  memory.echoes.push(...newEchoes);
  if (memory.echoes.length > 50) {
    memory.echoes = memory.echoes.slice(-50);
  }

  // 保留最近20条运行记录
  if (!memory.run_history) memory.run_history = [];
  memory.run_history.push({
    time: timestamp,
    trigger: triggerEvent,
    new_echoes: newEchoes.length,
    total_echoes: memory.echoes.length
  });
  if (memory.run_history.length > 20) {
    memory.run_history = memory.run_history.slice(-20);
  }

  safeWriteJSON(MEMORY_FILE, memory);
  console.log(`[CX-AGENT-003] ✅ 记忆已更新 · 累计 ${memory.echoes.length} 条回声 · 运行 ${memory.run_count} 次`);
  console.log(`[CX-AGENT-003] 🌙 晨曦·铸渊回声 进入休眠 · ${now()}`);
}

main();
