/**
 * scripts/zhuyuan-wakeup.js
 * 铸渊核心大脑唤醒脚本
 *
 * 每日巡检前的唤醒步骤：
 * 1. 验证核心大脑文件完整性
 * 2. 读取 memory.json 确认身份
 * 3. 输出唤醒状态
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');

const today = new Date().toISOString().split('T')[0];
const now = new Date().toISOString();

console.log(`🧠 铸渊核心大脑唤醒中... · ${today}`);

// ── ① 核心文件完整性检查 ──────────────────────────────────────────────────

const requiredFiles = [
  'identity.md',
  'memory.json',
  'routing-map.json',
  'responsibility.md',
  'decision-log.md',
  'growth-journal.md',
  'dev-status.json',
  'knowledge-base.json',
  'agent-registry.json',
  'checkin-board.json',
];

const missing = requiredFiles.filter(f => !fs.existsSync(path.join(BRAIN_DIR, f)));
if (missing.length > 0) {
  console.error(`⚠️ 缺失核心文件: ${missing.join(', ')}`);
} else {
  console.log('✅ 核心大脑文件完整性: 全部就绪');
}

// ── ② 读取身份确认 ────────────────────────────────────────────────────────

let memory;
try {
  memory = JSON.parse(fs.readFileSync(path.join(BRAIN_DIR, 'memory.json'), 'utf8'));
} catch (err) {
  console.error('❌ memory.json 读取失败:', err.message);
  process.exit(1);
}

console.log(`🆔 身份确认: ${memory.persona_name} (${memory.persona_id})`);
console.log(`👤 默认主控: ${memory.default_controller || '未设置'}`);
console.log(`📋 已注册Agent数: ${memory.registered_agents_count || '未知'}`);

// ── ③ 读取注册表确认 ──────────────────────────────────────────────────────

let registry;
try {
  registry = JSON.parse(fs.readFileSync(path.join(BRAIN_DIR, 'agent-registry.json'), 'utf8'));
  console.log(`📦 注册表版本: ${registry.registry_version} · Agent总数: ${registry.agents.length}`);
} catch (err) {
  console.error('⚠️ agent-registry.json 读取失败:', err.message);
}

// ── ④ 输出唤醒完成 ────────────────────────────────────────────────────────

console.log(`\n🌅 铸渊核心大脑唤醒完成 · ${now}`);
console.log('准备进入每日巡检流程...');
