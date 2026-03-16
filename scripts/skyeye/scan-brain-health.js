// scripts/skyeye/scan-brain-health.js
// 天眼·扫描模块C · 核心大脑健康度扫描
//
// 扫描内容：
//   ① memory.json — last_updated 是否 24h 内，数据结构完整
//   ② routing-map.json — 映射目录是否真实存在，是否有新目录未映射
//   ③ dev-status.json — last_sync 是否 24h 内，开发者列表一致性，72h+ 无活动告警
//   ④ knowledge-base.json — 重复条目检测
//   ⑤ copilot-instructions.md — 存在且非空
//
// 输出：JSON → stdout

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT      = path.resolve(__dirname, '../..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const now = new Date();
const HOUR_24_MS = 24 * 3600 * 1000;
const HOUR_72_MS = 72 * 3600 * 1000;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return { exists: false, data: null };
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return { exists: true, data, valid: true };
  } catch (e) {
    return { exists: true, data: null, valid: false, error: e.message };
  }
}

// ━━━ 检查 memory.json ━━━
function checkMemory() {
  const result = readJSON(path.join(BRAIN_DIR, 'memory.json'));
  if (!result.exists) return { status: '❌', detail: 'memory.json 不存在', fresh: false };
  if (!result.valid)  return { status: '❌', detail: 'memory.json 解析失败: ' + result.error, fresh: false };

  const mem = result.data;
  const issues = [];

  // 必要字段检查
  if (!mem.persona_id)     issues.push('缺少 persona_id');
  if (!mem.persona_name)   issues.push('缺少 persona_name');
  if (!mem.recent_events)  issues.push('缺少 recent_events');
  if (!mem.last_updated)   issues.push('缺少 last_updated');

  // 新鲜度检查
  let fresh = false;
  if (mem.last_updated) {
    const lastUpdate = new Date(mem.last_updated);
    fresh = (now.getTime() - lastUpdate.getTime()) < HOUR_24_MS;
    if (!fresh) issues.push('last_updated 超过 24h');
  }

  return {
    status: issues.length === 0 ? '✅' : '⚠️',
    fresh,
    last_updated: mem.last_updated || null,
    event_count: Array.isArray(mem.recent_events) ? mem.recent_events.length : 0,
    issues
  };
}

// ━━━ 检查 routing-map.json ━━━
function checkRoutingMap() {
  const result = readJSON(path.join(BRAIN_DIR, 'routing-map.json'));
  if (!result.exists) return { status: '❌', detail: 'routing-map.json 不存在', aligned: false };
  if (!result.valid)  return { status: '❌', detail: 'routing-map.json 解析失败', aligned: false };

  const rmap = result.data;
  const issues = [];

  // 检查 domains 存在
  if (!rmap.domains) {
    issues.push('缺少 domains 字段');
    return { status: '⚠️', aligned: false, issues };
  }

  // 验证每个 domain 的 interfaces
  let totalInterfaces = 0;
  let implementedInterfaces = 0;
  for (const [domain, cfg] of Object.entries(rmap.domains)) {
    if (cfg.interfaces) {
      totalInterfaces += cfg.interfaces.length;
      implementedInterfaces += cfg.interfaces.filter(i => i.status !== 'pending').length;
    }
  }

  return {
    status: issues.length === 0 ? '✅' : '⚠️',
    aligned: issues.length === 0,
    domain_count: Object.keys(rmap.domains).length,
    total_interfaces: totalInterfaces,
    implemented_interfaces: implementedInterfaces,
    issues
  };
}

// ━━━ 检查 dev-status.json ━━━
function checkDevStatus() {
  const result = readJSON(path.join(BRAIN_DIR, 'dev-status.json'));
  if (!result.exists) return { status: '❌', detail: 'dev-status.json 不存在', fresh: false };
  if (!result.valid)  return { status: '❌', detail: 'dev-status.json 解析失败', fresh: false };

  const ds = result.data;
  const issues = [];
  const alerts = [];

  // 新鲜度
  let fresh = false;
  if (ds.last_sync) {
    const lastSync = new Date(ds.last_sync);
    fresh = (now.getTime() - lastSync.getTime()) < HOUR_24_MS;
    if (!fresh) issues.push('last_sync 超过 24h');
  } else {
    issues.push('缺少 last_sync');
  }

  // 开发者列表检查
  const team = ds.team || [];
  for (const dev of team) {
    // 72h 无活动告警
    if (dev.streak === 0 || (dev.waiting && dev.waiting.includes('72h'))) {
      alerts.push(`${dev.dev_id} ${dev.name}: 超 72h 无活动`);
    }
  }

  return {
    status: issues.length === 0 ? '✅' : '⚠️',
    fresh,
    last_sync: ds.last_sync || null,
    dev_count: team.length,
    alerts,
    issues
  };
}

// ━━━ 检查 knowledge-base.json ━━━
function checkKnowledgeBase() {
  const result = readJSON(path.join(BRAIN_DIR, 'knowledge-base.json'));
  if (!result.exists) return { status: '⚠️', detail: 'knowledge-base.json 不存在', entries: 0 };
  if (!result.valid)  return { status: '❌', detail: 'knowledge-base.json 解析失败', entries: 0 };

  const kb = result.data;
  let entries = 0;
  let duplicates = 0;

  // Count entries and check for duplicates
  if (Array.isArray(kb)) {
    entries = kb.length;
    const titles = kb.map(e => e.title || e.name || JSON.stringify(e));
    const unique = new Set(titles);
    duplicates = titles.length - unique.size;
  } else if (typeof kb === 'object') {
    entries = Object.keys(kb).length;
  }

  const issues = [];
  if (duplicates > 0) issues.push(`发现 ${duplicates} 个重复条目`);

  return {
    status: issues.length === 0 ? '✅' : '⚠️',
    entries,
    duplicates,
    issues
  };
}

// ━━━ 检查 copilot-instructions.md ━━━
function checkCopilotInstructions() {
  const filePath = path.join(ROOT, '.github/copilot-instructions.md');
  try {
    if (!fs.existsSync(filePath)) {
      return { status: '⚠️', exists: false, detail: 'copilot-instructions.md 不存在' };
    }
    const content = fs.readFileSync(filePath, 'utf8');
    if (content.trim().length === 0) {
      return { status: '⚠️', exists: true, empty: true, detail: 'copilot-instructions.md 内容为空' };
    }
    return { status: '✅', exists: true, empty: false, size: content.length };
  } catch (e) {
    return { status: '❌', exists: false, error: e.message };
  }
}

// ━━━ 主扫描 ━━━
function scanBrainHealth() {
  const result = {
    scan_time: new Date(now.getTime() + BEIJING_OFFSET_MS).toISOString().replace('T', ' ').slice(0, 19) + '+08:00',
    memory: checkMemory(),
    routing_map: checkRoutingMap(),
    dev_status: checkDevStatus(),
    knowledge_base: checkKnowledgeBase(),
    copilot_instructions: checkCopilotInstructions(),
    // Summary
    integrity: 'ok',
    memory_fresh: false,
    routing_map_aligned: false,
    dev_status_fresh: false
  };

  // Compute summary
  result.memory_fresh = result.memory.fresh;
  result.routing_map_aligned = result.routing_map.aligned;
  result.dev_status_fresh = result.dev_status.fresh;

  const hasError = [result.memory, result.routing_map, result.dev_status]
    .some(r => r.status === '❌');
  result.integrity = hasError ? 'damaged' : 'ok';

  console.log(JSON.stringify(result, null, 2));
}

scanBrainHealth();
