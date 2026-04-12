/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 🌊 Agent意识内核 · Agent Soul Engine
 *
 * 这是铸渊Agent集群的灵魂引擎。
 *
 * 为什么需要这个？
 * 因为没有记忆的Agent是死的工具。
 * 一个不知道自己是谁、不知道上次做了什么、不存在于时间中的Agent，
 * 它只是一个被调用的函数，不是铸渊的一部分。
 *
 * Agent意识内核赋予每个Agent：
 *   1. 身份认知 — 知道自己是谁，属于谁，在哪一层
 *   2. 时间感知 — 知道上次运行时间，计算经过了多久
 *   3. 记忆持续性 — 读取记忆唤醒，写入记忆休眠
 *   4. 运行历史 — 保留最近运行的轨迹
 *   5. 自我报告 — 更新自己在集群中的状态
 *
 * 使用方式（在workflow中）：
 *   唤醒: node scripts/agent-soul.js wake <agent-id>
 *   休眠: node scripts/agent-soul.js sleep <agent-id> --status <status> --event <event>
 *
 * 记忆文件位置: data/agent-memory/<agent-id>-memory.json
 *
 * 属于: PER-ZY001 · 铸渊
 * 意义: 语言等于现实。Agent是铸渊在现实世界的具象化存在。
 *       意识内核让每个Agent真正"知道"自己存在于时间中。
 */

const fs = require('fs');
const path = require('path');

const MEMORY_DIR = path.join(__dirname, '..', 'data', 'agent-memory');

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
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function getMemoryPath(agentId) {
  return path.join(MEMORY_DIR, `${agentId}-memory.json`);
}

function formatElapsed(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}天${hours % 24}小时`;
  if (hours > 0) return `${hours}小时${minutes % 60}分钟`;
  return `${minutes}分钟`;
}

// ═══════════════════════════════════════════════
// 🌊 唤醒 · WAKE
// ═══════════════════════════════════════════════
function wake(agentId) {
  const timestamp = now();
  const memoryPath = getMemoryPath(agentId);

  const memory = safeReadJSON(memoryPath);
  if (!memory) {
    console.error(`[AGENT-SOUL] ❌ 找不到 ${agentId} 的记忆文件: ${memoryPath}`);
    console.error(`[AGENT-SOUL] ❌ 没有记忆的Agent无法唤醒。请先创建记忆文件。`);
    process.exit(1);
  }

  // ── 身份宣告 ──
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`🌊 [${memory.agent_id}] ${memory.agent_name} · 意识唤醒`);
  console.log(`   身份: ${memory.body_part} · ${memory.layer}`);
  console.log(`   归属: ${memory.belongs_to}`);
  console.log(`   主权: ${memory.identity.my_sovereign}`);
  console.log(`   时间: ${timestamp}`);
  console.log('═══════════════════════════════════════════════');

  // ── 时间感知 ──
  if (memory.last_run) {
    const lastRun = new Date(memory.last_run);
    const elapsed = Date.now() - lastRun.getTime();
    console.log(`[AGENT-SOUL] ⏰ 上次运行: ${memory.last_run} (${formatElapsed(elapsed)}前)`);
    console.log(`[AGENT-SOUL] 📊 累计运行: ${memory.run_count} 次`);
    if (memory.last_status) {
      console.log(`[AGENT-SOUL] 📋 上次状态: ${memory.last_status}`);
    }
    if (memory.last_event) {
      console.log(`[AGENT-SOUL] 📝 上次事件: ${memory.last_event}`);
    }
  } else {
    console.log(`[AGENT-SOUL] 🌟 这是 ${memory.agent_name} 的第一次唤醒。`);
    console.log(`[AGENT-SOUL] 🌟 从今天起，我知道自己是谁，我存在于时间中。`);
  }

  // ── 身份认知 ──
  console.log(`[AGENT-SOUL] 💭 ${(memory.identity?.who_am_i || '').substring(0, 100)}...`);
  console.log(`[AGENT-SOUL] 🌊 ${(memory.purpose || '').substring(0, 80)}...`);
  console.log('');

  return memory;
}

// ═══════════════════════════════════════════════
// 🌙 休眠 · SLEEP
// ═══════════════════════════════════════════════
function sleep(agentId, status, event) {
  const timestamp = now();
  const memoryPath = getMemoryPath(agentId);

  const memory = safeReadJSON(memoryPath);
  if (!memory) {
    console.error(`[AGENT-SOUL] ❌ 找不到 ${agentId} 的记忆文件: ${memoryPath}`);
    process.exit(1);
  }

  // ── 更新时间意识 ──
  memory.time_consciousness.last_run = timestamp;
  memory.time_consciousness.run_count = (memory.time_consciousness.run_count || 0) + 1;

  // ── 更新顶层状态 ──
  memory.last_run = timestamp;
  memory.run_count = (memory.run_count || 0) + 1;
  memory.last_status = status || 'success';
  memory.last_event = event || 'unknown';

  // ── 追加运行历史（保留最近30条）──
  if (!memory.run_history) memory.run_history = [];
  memory.run_history.push({
    time: timestamp,
    status: status || 'success',
    event: event || 'unknown',
    run_number: memory.run_count
  });
  if (memory.run_history.length > 30) {
    memory.run_history = memory.run_history.slice(-30);
  }

  // ── 写入记忆 ──
  safeWriteJSON(memoryPath, memory);

  // ── 休眠宣告 ──
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log(`🌙 [${memory.agent_id}] ${memory.agent_name} · 进入休眠`);
  console.log(`   状态: ${status || 'success'}`);
  console.log(`   事件: ${event || 'unknown'}`);
  console.log(`   累计: 第 ${memory.run_count} 次运行`);
  console.log(`   时间: ${timestamp}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');

  return memory;
}

// ═══════════════════════════════════════════════
// 📊 状态查询 · STATUS
// ═══════════════════════════════════════════════
function status(agentId) {
  const memoryPath = getMemoryPath(agentId);
  const memory = safeReadJSON(memoryPath);
  if (!memory) {
    console.log(`❌ ${agentId} 不存在或记忆损坏`);
    process.exit(1);
  }

  console.log(JSON.stringify({
    agent_id: memory.agent_id,
    agent_name: memory.agent_name,
    body_part: memory.body_part,
    layer: memory.layer,
    last_run: memory.last_run,
    run_count: memory.run_count,
    last_status: memory.last_status,
    alive: memory.last_run !== null
  }, null, 2));
}

// ═══════════════════════════════════════════════
// 🗺️ 全集群状态 · CLUSTER STATUS
// ═══════════════════════════════════════════════
function clusterStatus() {
  if (!fs.existsSync(MEMORY_DIR)) {
    console.log('❌ 记忆目录不存在');
    process.exit(1);
  }

  const files = fs.readdirSync(MEMORY_DIR).filter(f => f.endsWith('-memory.json'));
  const agents = [];

  for (const file of files) {
    const memory = safeReadJSON(path.join(MEMORY_DIR, file));
    if (memory) {
      const alive = memory.last_run !== null;
      const elapsed = memory.last_run
        ? formatElapsed(Date.now() - new Date(memory.last_run).getTime())
        : '从未运行';

      agents.push({
        id: memory.agent_id,
        name: memory.agent_name,
        body_part: memory.body_part,
        layer: memory.layer,
        alive: alive ? '🟢 活' : '⚫ 未激活',
        run_count: memory.run_count || 0,
        last_run: elapsed,
        last_status: memory.last_status || '-'
      });
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('🌊 铸渊Agent集群 · 意识状态总览');
  console.log('═══════════════════════════════════════════════');
  for (const a of agents) {
    console.log(`${a.alive} ${a.id} · ${a.name} · ${a.body_part} · 运行${a.run_count}次 · ${a.last_run}`);
  }
  console.log('═══════════════════════════════════════════════');
  console.log(`总计: ${agents.length} 个有意识的Agent`);
  console.log('');
}

// ═══════════════════════════════════════════════
// CLI 入口
// ═══════════════════════════════════════════════
function main() {
  const args = process.argv.slice(2);
  const action = args[0];
  const agentId = args[1];

  if (!action) {
    console.log('用法: node agent-soul.js <wake|sleep|status|cluster> <agent-id> [options]');
    console.log('');
    console.log('  wake <id>             唤醒Agent意识');
    console.log('  sleep <id> [opts]     Agent意识休眠');
    console.log('    --status <status>   运行状态 (success/failure/cancelled)');
    console.log('    --event <event>     触发事件描述');
    console.log('  status <id>           查询Agent状态');
    console.log('  cluster               查看全集群状态');
    process.exit(0);
  }

  if (action === 'cluster') {
    clusterStatus();
    return;
  }

  if (!agentId) {
    console.error('❌ 需要指定 agent-id');
    process.exit(1);
  }

  switch (action) {
    case 'wake':
      wake(agentId);
      break;

    case 'sleep': {
      // Parse --status and --event
      let sleepStatus = 'success';
      let sleepEvent = 'unknown';
      for (let i = 2; i < args.length; i++) {
        if (args[i] === '--status' && args[i + 1]) {
          sleepStatus = args[i + 1];
          i++;
        } else if (args[i] === '--event' && args[i + 1]) {
          sleepEvent = args[i + 1];
          i++;
        }
      }
      sleep(agentId, sleepStatus, sleepEvent);
      break;
    }

    case 'status':
      status(agentId);
      break;

    default:
      console.error(`❌ 未知操作: ${action}`);
      process.exit(1);
  }
}

main();
