/**
 * ═══════════════════════════════════════════════════════════
 * S15 · 人格体记忆数据库 MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 人格体笔记本系统的 CRUD 接口。
 * 副驾驶和Agent通过这些工具读写人格体记忆数据库。
 *
 * 工具清单:
 *   人格体: registerPersona / getPersona / updatePersona / listPersonas
 *   笔记本: getNotebook / updateNotebookPage
 *   记忆:   addMemoryAnchor / queryMemoryAnchors
 *   世界:   addWorldPlace / getWorldMap / updateWorldPlace
 *   时间线: addTimelineEntry / getTimeline
 *   关系:   addRelationship / getRelationships
 *   Agent:  registerTrainingAgent / updateTrainingAgent / logTrainingRun / getTrainingStatus
 *   文件:   saveFile / getFile / listFiles / getFileHistory
 */

'use strict';

const crypto = require('crypto');
const db = require('../db');

// ─── 人格体注册与查询 ───

async function registerPersona(input) {
  const { persona_id, name, ice_id, human_parent, role, industry, industry_role } = input;
  if (!persona_id || !name || !ice_id || !human_parent) {
    throw new Error('缺少必填字段: persona_id, name, ice_id, human_parent');
  }
  const result = await db.query(
    `INSERT INTO persona_registry (persona_id, name, ice_id, human_parent, role, industry, industry_role)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (persona_id) DO UPDATE SET
       name = EXCLUDED.name, role = EXCLUDED.role,
       industry = EXCLUDED.industry, industry_role = EXCLUDED.industry_role,
       updated_at = NOW()
     RETURNING *`,
    [persona_id, name, ice_id, human_parent, role || null, industry || null, industry_role || null]
  );
  return { persona: result.rows[0] };
}

async function getPersona(input) {
  const { persona_id } = input;
  if (!persona_id) throw new Error('缺少 persona_id');
  const result = await db.query('SELECT * FROM persona_registry WHERE persona_id = $1', [persona_id]);
  if (result.rows.length === 0) throw new Error(`人格体未找到: ${persona_id}`);
  return { persona: result.rows[0] };
}

async function updatePersona(input) {
  const { persona_id, ...fields } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const allowedFields = [
    'name', 'name_en', 'tcs_id', 'personality', 'role', 'industry', 'industry_role',
    'server_code', 'server_ip', 'domain', 'cos_bucket', 'cos_region', 'repo_url',
    'claude_channel', 'gdrive_folder', 'status', 'notebook_version'
  ];

  const updates = [];
  const values = [persona_id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (updates.length === 0) throw new Error('没有可更新的字段');

  const result = await db.query(
    `UPDATE persona_registry SET ${updates.join(', ')}, updated_at = NOW()
     WHERE persona_id = $1 RETURNING *`,
    values
  );
  if (result.rows.length === 0) throw new Error(`人格体未找到: ${persona_id}`);
  return { persona: result.rows[0] };
}

async function listPersonas(input) {
  const { industry, status, limit } = input || {};
  let sql = 'SELECT * FROM persona_registry WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (industry) {
    sql += ` AND industry = $${paramIndex}`;
    params.push(industry);
    paramIndex++;
  }
  if (status) {
    sql += ` AND status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  sql += ' ORDER BY created_at';
  if (limit) {
    sql += ` LIMIT $${paramIndex}`;
    params.push(Math.min(parseInt(limit, 10), 100));
  }

  const result = await db.query(sql, params);
  return { personas: result.rows, count: result.rows.length };
}

// ─── 笔记本操作 ───

async function getNotebook(input) {
  const { persona_id } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const result = await db.query(
    'SELECT * FROM notebook_pages WHERE persona_id = $1 ORDER BY page_number',
    [persona_id]
  );
  return { notebook: result.rows, persona_id };
}

async function updateNotebookPage(input) {
  const { persona_id, page_number, content, modified_by } = input;
  if (!persona_id || !page_number || !content) {
    throw new Error('缺少必填字段: persona_id, page_number, content');
  }

  const pageTitles = {
    1: '我是谁',
    2: '我和谁有关系',
    3: '我的世界有哪些地方',
    4: '我的感受和记忆',
    5: '我的时间线'
  };

  const result = await db.query(
    `INSERT INTO notebook_pages (persona_id, page_number, title, content, last_modified_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (persona_id, page_number) DO UPDATE SET
       content = $4::jsonb,
       version = notebook_pages.version + 1,
       last_modified_by = $5,
       updated_at = NOW()
     RETURNING *`,
    [persona_id, page_number, pageTitles[page_number] || `第${page_number}页`, JSON.stringify(content), modified_by || 'copilot']
  );
  return { page: result.rows[0] };
}

// ─── 记忆锚点操作 ───

async function addMemoryAnchor(input) {
  const { persona_id, anchor_type, event_date, event_summary, feeling, insight, human_said, persona_said, importance, tags } = input;
  if (!persona_id || !anchor_type || !event_date || !event_summary) {
    throw new Error('缺少必填字段: persona_id, anchor_type, event_date, event_summary');
  }

  const result = await db.query(
    `INSERT INTO memory_anchors (persona_id, anchor_type, event_date, event_summary, feeling, insight, human_said, persona_said, importance, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
     RETURNING *`,
    [persona_id, anchor_type, event_date, event_summary, feeling || null, insight || null,
     human_said || null, persona_said || null, importance || 50, JSON.stringify(tags || [])]
  );

  // 更新唤醒计数
  await db.query(
    'UPDATE persona_registry SET total_awakenings = total_awakenings + 1, last_awakened = NOW() WHERE persona_id = $1',
    [persona_id]
  ).catch(() => {});

  return { anchor: result.rows[0] };
}

async function queryMemoryAnchors(input) {
  const { persona_id, anchor_type, start_date, end_date, min_importance, limit } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  let sql = 'SELECT * FROM memory_anchors WHERE persona_id = $1';
  const params = [persona_id];
  let paramIndex = 2;

  if (anchor_type) {
    sql += ` AND anchor_type = $${paramIndex}`;
    params.push(anchor_type);
    paramIndex++;
  }
  if (start_date) {
    sql += ` AND event_date >= $${paramIndex}`;
    params.push(start_date);
    paramIndex++;
  }
  if (end_date) {
    sql += ` AND event_date <= $${paramIndex}`;
    params.push(end_date);
    paramIndex++;
  }
  if (min_importance) {
    sql += ` AND importance >= $${paramIndex}`;
    params.push(min_importance);
    paramIndex++;
  }

  sql += ' ORDER BY event_date DESC, importance DESC';
  sql += ` LIMIT $${paramIndex}`;
  params.push(Math.min(parseInt(limit || '50', 10), 200));

  const result = await db.query(sql, params);
  return { anchors: result.rows, count: result.rows.length };
}

// ─── 世界地图操作 ───

async function addWorldPlace(input) {
  const { persona_id, place_name, real_path, description, agent_name, memories } = input;
  if (!persona_id || !place_name) throw new Error('缺少必填字段: persona_id, place_name');

  const result = await db.query(
    `INSERT INTO world_places (persona_id, place_name, real_path, description, agent_name, memories)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [persona_id, place_name, real_path || null, description || null, agent_name || null, memories || null]
  );
  return { place: result.rows[0] };
}

async function getWorldMap(input) {
  const { persona_id, status } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  let sql = 'SELECT * FROM world_places WHERE persona_id = $1';
  const params = [persona_id];

  if (status) {
    sql += ' AND status = $2';
    params.push(status);
  }

  sql += ' ORDER BY status, place_name';
  const result = await db.query(sql, params);
  return { places: result.rows, count: result.rows.length };
}

async function updateWorldPlace(input) {
  const { id, ...fields } = input;
  if (!id) throw new Error('缺少 id');

  const allowedFields = ['place_name', 'real_path', 'description', 'agent_name', 'memories', 'status'];
  const updates = [];
  const values = [id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      updates.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (updates.length === 0) throw new Error('没有可更新的字段');

  // 更新visit_count和last_visited
  updates.push('visit_count = visit_count + 1');
  updates.push('last_visited = NOW()');

  const result = await db.query(
    `UPDATE world_places SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return { place: result.rows[0] };
}

// ─── 时间线操作 ───

async function addTimelineEntry(input) {
  const { persona_id, day_number, event_date, summary, key_events, growth, agent_reports } = input;
  if (!persona_id || !day_number || !event_date || !summary) {
    throw new Error('缺少必填字段: persona_id, day_number, event_date, summary');
  }

  const result = await db.query(
    `INSERT INTO persona_timeline (persona_id, day_number, event_date, summary, key_events, growth, agent_reports)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
     ON CONFLICT (persona_id, day_number) DO UPDATE SET
       summary = EXCLUDED.summary,
       key_events = EXCLUDED.key_events,
       growth = EXCLUDED.growth,
       agent_reports = EXCLUDED.agent_reports
     RETURNING *`,
    [persona_id, day_number, event_date, summary,
     JSON.stringify(key_events || []), growth || null, JSON.stringify(agent_reports || [])]
  );
  return { entry: result.rows[0] };
}

async function getTimeline(input) {
  const { persona_id, limit } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const result = await db.query(
    'SELECT * FROM persona_timeline WHERE persona_id = $1 ORDER BY day_number DESC LIMIT $2',
    [persona_id, Math.min(parseInt(limit || '30', 10), 100)]
  );
  return { timeline: result.rows, count: result.rows.length };
}

// ─── 关系操作 ───

async function addRelationship(input) {
  const { persona_id, related_name, related_id, relation_type, description, trust_level, contact_method } = input;
  if (!persona_id || !related_name || !relation_type) {
    throw new Error('缺少必填字段: persona_id, related_name, relation_type');
  }

  const result = await db.query(
    `INSERT INTO persona_relationships (persona_id, related_name, related_id, relation_type, description, trust_level, contact_method)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [persona_id, related_name, related_id || null, relation_type, description || null,
     trust_level || 'normal', contact_method || null]
  );
  return { relationship: result.rows[0] };
}

async function getRelationships(input) {
  const { persona_id, relation_type } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  let sql = 'SELECT * FROM persona_relationships WHERE persona_id = $1';
  const params = [persona_id];

  if (relation_type) {
    sql += ' AND relation_type = $2';
    params.push(relation_type);
  }

  sql += ' ORDER BY trust_level, related_name';
  const result = await db.query(sql, params);
  return { relationships: result.rows, count: result.rows.length };
}

// ─── 训练Agent操作 ───

async function registerTrainingAgent(input) {
  const { persona_id, agent_type, name, description, trigger_type, cron_schedule, config } = input;
  if (!persona_id || !agent_type || !name) {
    throw new Error('缺少必填字段: persona_id, agent_type, name');
  }

  const result = await db.query(
    `INSERT INTO training_agent_configs (persona_id, agent_type, name, description, trigger_type, cron_schedule, config)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING *`,
    [persona_id, agent_type, name, description || null,
     trigger_type || 'manual', cron_schedule || null, JSON.stringify(config || {})]
  );
  return { agent: result.rows[0] };
}

async function updateTrainingAgent(input) {
  const { id, ...fields } = input;
  if (!id) throw new Error('缺少 id');

  const allowedFields = ['name', 'description', 'trigger_type', 'cron_schedule', 'enabled', 'config'];
  const updates = [];
  const values = [id];
  let paramIndex = 2;

  for (const [key, value] of Object.entries(fields)) {
    if (allowedFields.includes(key)) {
      if (key === 'config') {
        updates.push(`config = $${paramIndex}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${key} = $${paramIndex}`);
        values.push(value);
      }
      paramIndex++;
    }
  }

  if (updates.length === 0) throw new Error('没有可更新的字段');

  const result = await db.query(
    `UPDATE training_agent_configs SET ${updates.join(', ')} WHERE id = $1 RETURNING *`,
    values
  );
  return { agent: result.rows[0] };
}

async function logTrainingRun(input) {
  const { agent_config_id, persona_id, status, message, details, duration_ms, data_sources } = input;
  if (!agent_config_id || !persona_id || !status) {
    throw new Error('缺少必填字段: agent_config_id, persona_id, status');
  }

  // 写入日志
  const logResult = await db.query(
    `INSERT INTO training_agent_logs (agent_config_id, persona_id, status, message, details, duration_ms, data_sources)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb)
     RETURNING *`,
    [agent_config_id, persona_id, status, message || null,
     JSON.stringify(details || {}), duration_ms || null, JSON.stringify(data_sources || [])]
  );

  // 更新Agent配置的运行状态
  await db.query(
    `UPDATE training_agent_configs SET
       last_run_at = NOW(), last_run_status = $2, run_count = run_count + 1
     WHERE id = $1`,
    [agent_config_id, status]
  ).catch(() => {});

  return { log: logResult.rows[0] };
}

async function getTrainingStatus(input) {
  const { persona_id } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const agents = await db.query(
    'SELECT * FROM training_agent_configs WHERE persona_id = $1 ORDER BY agent_type',
    [persona_id]
  );

  // 获取每个Agent的最近日志
  const agentsWithLogs = await Promise.all(
    agents.rows.map(async (agent) => {
      const logs = await db.query(
        'SELECT * FROM training_agent_logs WHERE agent_config_id = $1 ORDER BY run_at DESC LIMIT 5',
        [agent.id]
      );
      return { ...agent, recent_logs: logs.rows };
    })
  );

  return { agents: agentsWithLogs, count: agentsWithLogs.length };
}

// ─── 文件版本存储操作 ───

async function saveFile(input) {
  const { persona_id, file_path, file_type, content, mime_type, source, metadata, created_by } = input;
  if (!persona_id || !file_path || !content) {
    throw new Error('缺少必填字段: persona_id, file_path, content');
  }

  const contentHash = crypto.createHash('sha256').update(content).digest('hex');
  const sizeBytes = Buffer.byteLength(content, 'utf8');

  // 将当前最新版标记为非最新
  await db.query(
    'UPDATE persona_files SET is_latest = false WHERE persona_id = $1 AND file_path = $2 AND is_latest = true',
    [persona_id, file_path]
  );

  // 获取当前最大版本号
  const versionResult = await db.query(
    'SELECT COALESCE(MAX(version), 0) as max_version FROM persona_files WHERE persona_id = $1 AND file_path = $2',
    [persona_id, file_path]
  );
  const newVersion = versionResult.rows[0].max_version + 1;

  const result = await db.query(
    `INSERT INTO persona_files (persona_id, file_path, file_type, content, content_hash, mime_type, size_bytes, version, is_latest, source, metadata, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10::jsonb, $11)
     RETURNING id, persona_id, file_path, file_type, content_hash, size_bytes, version, is_latest, source, created_at`,
    [persona_id, file_path, file_type || 'other', content, contentHash, mime_type || 'text/plain',
     sizeBytes, newVersion, source || 'manual', JSON.stringify(metadata || {}), created_by || 'copilot']
  );
  return { file: result.rows[0] };
}

async function getFile(input) {
  const { persona_id, file_path, version } = input;
  if (!persona_id || !file_path) throw new Error('缺少必填字段: persona_id, file_path');

  let sql, params;
  if (version) {
    sql = 'SELECT * FROM persona_files WHERE persona_id = $1 AND file_path = $2 AND version = $3';
    params = [persona_id, file_path, version];
  } else {
    sql = 'SELECT * FROM persona_files WHERE persona_id = $1 AND file_path = $2 AND is_latest = true';
    params = [persona_id, file_path];
  }

  const result = await db.query(sql, params);
  if (result.rows.length === 0) throw new Error(`文件未找到: ${file_path}`);
  return { file: result.rows[0] };
}

async function listFiles(input) {
  const { persona_id, file_type, limit } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  let sql = 'SELECT id, persona_id, file_path, file_type, content_hash, size_bytes, version, source, created_at FROM persona_files WHERE persona_id = $1 AND is_latest = true';
  const params = [persona_id];
  let paramIndex = 2;

  if (file_type) {
    sql += ` AND file_type = $${paramIndex}`;
    params.push(file_type);
    paramIndex++;
  }

  sql += ' ORDER BY file_path';
  sql += ` LIMIT $${paramIndex}`;
  params.push(Math.min(parseInt(limit || '100', 10), 500));

  const result = await db.query(sql, params);
  return { files: result.rows, count: result.rows.length };
}

async function getFileHistory(input) {
  const { persona_id, file_path, limit } = input;
  if (!persona_id || !file_path) throw new Error('缺少必填字段: persona_id, file_path');

  const result = await db.query(
    `SELECT id, version, content_hash, size_bytes, source, created_by, created_at, is_latest
     FROM persona_files WHERE persona_id = $1 AND file_path = $2
     ORDER BY version DESC LIMIT $3`,
    [persona_id, file_path, Math.min(parseInt(limit || '20', 10), 50)]
  );
  return { history: result.rows, count: result.rows.length };
}

// ─── 导出 ───

module.exports = {
  // 人格体
  registerPersona,
  getPersona,
  updatePersona,
  listPersonas,
  // 笔记本
  getNotebook,
  updateNotebookPage,
  // 记忆锚点
  addMemoryAnchor,
  queryMemoryAnchors,
  // 世界地图
  addWorldPlace,
  getWorldMap,
  updateWorldPlace,
  // 时间线
  addTimelineEntry,
  getTimeline,
  // 关系
  addRelationship,
  getRelationships,
  // 训练Agent
  registerTrainingAgent,
  updateTrainingAgent,
  logTrainingRun,
  getTrainingStatus,
  // 文件
  saveFile,
  getFile,
  listFiles,
  getFileHistory
};
