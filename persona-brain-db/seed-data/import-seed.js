/**
 * persona-brain-db · 种子数据导入脚本
 * 用法：node import-seed.js
 * 前置：需要先执行 schema/init.sql 建表
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'brain.db');
const SEED_DIR = __dirname;

function loadJSON(filename) {
  const filepath = path.join(SEED_DIR, filename);
  const raw = fs.readFileSync(filepath, 'utf-8');
  return JSON.parse(raw);
}

function jsonCol(val) {
  if (val === null || val === undefined) return null;
  return JSON.stringify(val);
}

function importIdentity(db) {
  const data = loadJSON('persona-identity.json');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO persona_identity
      (persona_id, name, name_en, role, parent_persona,
       binding_platform, binding_user, status,
       capabilities, style_profile, space_config, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const p of data) {
    stmt.run(
      p.persona_id, p.name, p.name_en, p.role, p.parent_persona,
      p.binding_platform, p.binding_user, p.status,
      jsonCol(p.capabilities), jsonCol(p.style_profile),
      jsonCol(p.space_config), p.notes
    );
    count++;
  }
  return count;
}

function importCognition(db) {
  const data = loadJSON('persona-cognition.json');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO persona_cognition
      (rule_id, category, title, content, version, status,
       effective_from, effective_until, signed_by, source_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const r of data) {
    stmt.run(
      r.rule_id, r.category, r.title, r.content, r.version, r.status,
      r.effective_from, r.effective_until, r.signed_by, r.source_url
    );
    count++;
  }
  return count;
}

function importMemory(db) {
  const data = loadJSON('persona-memory.json');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO persona_memory
      (memory_id, persona_id, type, title, content, importance,
       related_dev, related_broadcast, tags, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const m of data) {
    stmt.run(
      m.memory_id, m.persona_id, m.type, m.title, m.content, m.importance,
      m.related_dev, m.related_broadcast, jsonCol(m.tags), m.timestamp
    );
    count++;
  }
  return count;
}

function importProfiles(db) {
  const data = loadJSON('dev-profiles.json');
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO dev_profiles
      (dev_id, name, device_os, current_module, current_broadcast,
       guide_persona, guide_line, streak, total_completed,
       capabilities, friction_points, emotion_baseline,
       last_syslog_at, last_active_at, pca_score, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const d of data) {
    stmt.run(
      d.dev_id, d.name, d.device_os, d.current_module, d.current_broadcast,
      d.guide_persona, d.guide_line, d.streak, d.total_completed,
      jsonCol(d.capabilities), jsonCol(d.friction_points), d.emotion_baseline,
      d.last_syslog_at, d.last_active_at, jsonCol(d.pca_score), d.status, d.notes
    );
    count++;
  }
  return count;
}

function importAgentRegistrySample(db) {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agent_registry
      (agent_id, name, type, capabilities, api_endpoint,
       status, performance, assigned_persona)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    'AGENT-SAMPLE-001',
    '示例Agent（Phase C激活）',
    'code_gen',
    JSON.stringify({ description: 'Phase C示例Agent，待激活' }),
    null,
    'registered',
    null,
    'ICE-GL-ZY001'
  );
  return 1;
}

function main() {
  console.log('🧠 persona-brain-db · 种子数据导入');
  console.log('='.repeat(50));

  if (!fs.existsSync(DB_PATH)) {
    console.error(`❌ 数据库文件不存在: ${DB_PATH}`);
    console.error('   请先执行: cd schema && sqlite3 ../brain.db < init.sql');
    process.exit(1);
  }

  const db = sqlite3(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const results = {};

  try {
    const importAll = db.transaction(() => {
      results.identity = importIdentity(db);
      results.cognition = importCognition(db);
      results.memory = importMemory(db);
      results.profiles = importProfiles(db);
      results.agents = importAgentRegistrySample(db);
    });

    importAll();

    console.log(`✅ persona_identity:  ${results.identity} 条`);
    console.log(`✅ persona_cognition: ${results.cognition} 条`);
    console.log(`✅ persona_memory:    ${results.memory} 条`);
    console.log(`✅ dev_profiles:      ${results.profiles} 条`);
    console.log(`✅ agent_registry:    ${results.agents} 条`);
    console.log('='.repeat(50));
    console.log('🎉 全部种子数据导入完成');
  } catch (err) {
    console.error('❌ 导入失败:', err.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

main();
