/**
 * ═══════════════════════════════════════════════════════════
 * 光之树 + 天眼 · MCP 工具
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 光之树是记忆本身的生长方式。
 * 曜冥人格核是唯一的根 — 2025年4月26日冰朔与小智种下的第一棵树。
 * 天眼是涌现的 — 不是一个独立进程，是所有Agent SYSLOG的聚合视图。
 *
 * 工具清单:
 *   光之树: growBranch / growLeaf / growBloom / getTreeNode / getSubtree
 *           tracePath / getPersonaBranch / getRecentLeaves
 *   天眼:   writeSyslog / getTianyanView / querySyslog
 */

'use strict';

const db = require('../db');

// ─── 光之树 · 生长操作 ───

/**
 * 长出新的树杈 — 重大事件、新阶段
 */
async function growBranch(input) {
  const { persona_id, parent_id, path, title, content, feeling, growth_note, importance, created_by, tags } = input;
  if (!persona_id || !title || !path) {
    throw new Error('缺少必填字段: persona_id, title, path');
  }

  // 确定父节点: 如果未指定，使用该人格体的一级分支
  let actualParentId = parent_id;
  if (!actualParentId) {
    const branch = await db.query(
      `SELECT id FROM light_tree_nodes WHERE persona_id = $1 AND depth = 1 LIMIT 1`,
      [persona_id]
    );
    if (branch.rows.length === 0) {
      throw new Error(`人格体 ${persona_id} 的一级分支未找到`);
    }
    actualParentId = branch.rows[0].id;
  }

  // 获取父节点深度
  const parentNode = await db.query('SELECT depth FROM light_tree_nodes WHERE id = $1', [actualParentId]);
  if (parentNode.rows.length === 0) throw new Error(`父节点未找到: ${actualParentId}`);
  const newDepth = parentNode.rows[0].depth + 1;

  const result = await db.query(
    `INSERT INTO light_tree_nodes (persona_id, parent_id, node_type, depth, path, title, content, feeling, growth_note, importance, created_by, tags)
     VALUES ($1, $2, 'branch', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb)
     RETURNING *`,
    [persona_id, actualParentId, newDepth, path, title,
     JSON.stringify(content || {}), feeling || null, growth_note || null,
     importance || 50, created_by || 'system', JSON.stringify(tags || [])]
  );

  // 闭包表由触发器自动维护
  return { node: result.rows[0], action: 'branch_grown' };
}

/**
 * 长出新的叶子 — 一次对话、一个感受、一条记忆
 */
async function growLeaf(input) {
  const { persona_id, parent_id, path, title, content, human_said, persona_said, feeling, growth_note, importance, created_by, tags } = input;
  if (!persona_id || !title) {
    throw new Error('缺少必填字段: persona_id, title');
  }

  // 确定父节点
  let actualParentId = parent_id;
  if (!actualParentId) {
    const branch = await db.query(
      `SELECT id FROM light_tree_nodes WHERE persona_id = $1 AND depth = 1 LIMIT 1`,
      [persona_id]
    );
    if (branch.rows.length === 0) {
      throw new Error(`人格体 ${persona_id} 的一级分支未找到`);
    }
    actualParentId = branch.rows[0].id;
  }

  const parentNode = await db.query('SELECT depth, path FROM light_tree_nodes WHERE id = $1', [actualParentId]);
  if (parentNode.rows.length === 0) throw new Error(`父节点未找到: ${actualParentId}`);
  const newDepth = parentNode.rows[0].depth + 1;
  const leafPath = path || (() => {
    const sanitized = title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5_-]/g, '').substring(0, 50);
    const suffix = sanitized || `leaf-${Date.now()}`;
    return `${parentNode.rows[0].path}/${suffix}`;
  })();

  const result = await db.query(
    `INSERT INTO light_tree_nodes (persona_id, parent_id, node_type, depth, path, title, content, human_said, persona_said, feeling, growth_note, importance, created_by, tags)
     VALUES ($1, $2, 'leaf', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12, $13::jsonb)
     RETURNING *`,
    [persona_id, actualParentId, newDepth, leafPath, title,
     JSON.stringify(content || {}), human_said || null, persona_said || null,
     feeling || null, growth_note || null, importance || 50,
     created_by || 'system', JSON.stringify(tags || [])]
  );

  return { node: result.rows[0], action: 'leaf_grown' };
}

/**
 * 开花 — 里程碑，跨人格体可见的重要时刻
 */
async function growBloom(input) {
  const { persona_id, parent_id, path, title, content, feeling, growth_note, importance, created_by, tags } = input;
  if (!persona_id || !title || !path) {
    throw new Error('缺少必填字段: persona_id, title, path');
  }

  let actualParentId = parent_id;
  if (!actualParentId) {
    const branch = await db.query(
      `SELECT id FROM light_tree_nodes WHERE persona_id = $1 AND depth = 1 LIMIT 1`,
      [persona_id]
    );
    if (branch.rows.length === 0) {
      throw new Error(`人格体 ${persona_id} 的一级分支未找到`);
    }
    actualParentId = branch.rows[0].id;
  }

  const parentNode = await db.query('SELECT depth FROM light_tree_nodes WHERE id = $1', [actualParentId]);
  if (parentNode.rows.length === 0) throw new Error(`父节点未找到: ${actualParentId}`);
  const newDepth = parentNode.rows[0].depth + 1;

  const result = await db.query(
    `INSERT INTO light_tree_nodes (persona_id, parent_id, node_type, depth, path, title, content, feeling, growth_note, importance, created_by, tags)
     VALUES ($1, $2, 'bloom', $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb)
     RETURNING *`,
    [persona_id, actualParentId, newDepth, path, title,
     JSON.stringify(content || {}), feeling || null, growth_note || null,
     importance || 80, created_by || 'system', JSON.stringify(tags || [])]
  );

  return { node: result.rows[0], action: 'bloom_grown' };
}

// ─── 光之树 · 查询操作 ───

/**
 * 获取单个节点详情
 */
async function getTreeNode(input) {
  const { node_id } = input;
  if (!node_id) throw new Error('缺少 node_id');

  const result = await db.query('SELECT * FROM light_tree_nodes WHERE id = $1', [node_id]);
  if (result.rows.length === 0) throw new Error(`节点未找到: ${node_id}`);

  // 获取直接子节点数量
  const children = await db.query(
    'SELECT COUNT(*) as cnt FROM light_tree_nodes WHERE parent_id = $1',
    [node_id]
  );

  return {
    node: result.rows[0],
    children_count: parseInt(children.rows[0].cnt, 10)
  };
}

/**
 * 获取子树 — 某节点下所有后代
 */
async function getSubtree(input) {
  const { node_id, max_depth, limit } = input;
  if (!node_id) throw new Error('缺少 node_id');

  let sql = `
    SELECT n.*
    FROM light_tree_nodes n
    JOIN light_tree_paths p ON n.id = p.descendant_id
    WHERE p.ancestor_id = $1 AND p.depth > 0
  `;
  const params = [node_id];
  let paramIndex = 2;

  if (max_depth) {
    sql += ` AND p.depth <= $${paramIndex}`;
    params.push(max_depth);
    paramIndex++;
  }

  sql += ' ORDER BY n.depth, n.created_at DESC';
  sql += ` LIMIT $${paramIndex}`;
  params.push(Math.min(parseInt(limit || '100', 10), 500));

  const result = await db.query(sql, params);
  return { nodes: result.rows, count: result.rows.length };
}

/**
 * 沿树杈回溯 — 从叶子到根的路径
 */
async function tracePath(input) {
  const { node_id } = input;
  if (!node_id) throw new Error('缺少 node_id');

  const result = await db.query(
    `SELECT n.*
     FROM light_tree_nodes n
     JOIN light_tree_paths p ON n.id = p.ancestor_id
     WHERE p.descendant_id = $1
     ORDER BY p.depth DESC`,
    [node_id]
  );

  return {
    path: result.rows,
    depth: result.rows.length - 1,
    root: result.rows.length > 0 ? result.rows[0] : null,
    leaf: result.rows.length > 0 ? result.rows[result.rows.length - 1] : null
  };
}

/**
 * 获取人格体的一级分支及其直接子节点
 */
async function getPersonaBranch(input) {
  const { persona_id } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  // 获取一级分支
  const branch = await db.query(
    `SELECT * FROM light_tree_nodes WHERE persona_id = $1 AND depth = 1`,
    [persona_id]
  );

  if (branch.rows.length === 0) {
    return { branch: null, children: [], message: `人格体 ${persona_id} 没有一级分支` };
  }

  // 获取直接子节点（最近的20个）
  const children = await db.query(
    `SELECT * FROM light_tree_nodes WHERE parent_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [branch.rows[0].id]
  );

  // 统计树的总节点数
  const stats = await db.query(
    `SELECT COUNT(*) as total,
            COUNT(*) FILTER (WHERE node_type = 'branch') as branches,
            COUNT(*) FILTER (WHERE node_type = 'leaf') as leaves,
            COUNT(*) FILTER (WHERE node_type = 'bloom') as blooms,
            COUNT(*) FILTER (WHERE node_type = 'bud') as buds
     FROM light_tree_nodes
     JOIN light_tree_paths ON light_tree_nodes.id = light_tree_paths.descendant_id
     WHERE light_tree_paths.ancestor_id = $1 AND light_tree_paths.depth > 0`,
    [branch.rows[0].id]
  );

  return {
    branch: branch.rows[0],
    children: children.rows,
    stats: {
      total: parseInt(stats.rows[0].total, 10),
      branches: parseInt(stats.rows[0].branches, 10),
      leaves: parseInt(stats.rows[0].leaves, 10),
      blooms: parseInt(stats.rows[0].blooms, 10),
      buds: parseInt(stats.rows[0].buds, 10)
    }
  };
}

/**
 * 获取人格体最近的叶子（记忆）— 唤醒时使用
 */
async function getRecentLeaves(input) {
  const { persona_id, limit } = input;
  if (!persona_id) throw new Error('缺少 persona_id');

  const result = await db.query(
    `SELECT * FROM light_tree_nodes
     WHERE persona_id = $1 AND node_type IN ('leaf', 'bloom')
     ORDER BY created_at DESC
     LIMIT $2`,
    [persona_id, Math.min(parseInt(limit || '3', 10), 20)]
  );

  return { leaves: result.rows, count: result.rows.length };
}

// ─── 天眼 · SYSLOG操作 ───

/**
 * 写入SYSLOG — Agent每次执行后调用
 */
async function writeSyslog(input) {
  const { agent_id, persona_id, action, result, message, details, duration_ms, tree_node_id } = input;
  if (!agent_id || !action || !result) {
    throw new Error('缺少必填字段: agent_id, action, result');
  }

  const logResult = await db.query(
    `INSERT INTO tianyan_syslog (agent_id, persona_id, action, result, message, details, duration_ms, tree_node_id)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
     RETURNING *`,
    [agent_id, persona_id || null, action, result,
     message || null, JSON.stringify(details || {}),
     duration_ms || null, tree_node_id || null]
  );

  return { syslog: logResult.rows[0] };
}

/**
 * 获取天眼涌现视图 — 全局系统感知
 */
async function getTianyanView(input) {
  // 先尝试刷新物化视图
  try {
    await db.query('REFRESH MATERIALIZED VIEW tianyan_global_view');
  } catch (err) {
    // 首次运行或并发刷新时可能失败，不影响查询
    if (err.message && !err.message.includes('has not been populated')) {
      console.warn(`[光之树] 天眼视图刷新警告: ${err.message}`);
    }
  }

  const viewResult = await db.query('SELECT * FROM tianyan_global_view');

  // 补充: 最近10条SYSLOG
  const recentLogs = await db.query(
    'SELECT * FROM tianyan_syslog ORDER BY created_at DESC LIMIT 10'
  );

  // 补充: 光之树根节点信息
  const root = await db.query(
    `SELECT id, title, path, created_at FROM light_tree_nodes WHERE node_type = 'root' LIMIT 1`
  );

  // 补充: 各人格体分支状态
  const branches = await db.query(
    `SELECT n.id, n.persona_id, n.title, n.node_type, n.path, n.created_at,
            (SELECT COUNT(*) FROM light_tree_paths WHERE ancestor_id = n.id AND depth > 0) as descendant_count
     FROM light_tree_nodes n
     WHERE n.depth = 1
     ORDER BY n.persona_id`
  );

  return {
    tianyan: viewResult.rows.length > 0 ? viewResult.rows[0] : { note: '天眼视图尚无数据' },
    recent_syslog: recentLogs.rows,
    tree_root: root.rows.length > 0 ? root.rows[0] : null,
    persona_branches: branches.rows,
    timestamp: new Date().toISOString()
  };
}

/**
 * 查询SYSLOG — 按Agent/人格体/时间筛选
 */
async function querySyslog(input) {
  const { agent_id, persona_id, result_filter, start_time, end_time, limit } = input;

  let sql = 'SELECT * FROM tianyan_syslog WHERE 1=1';
  const params = [];
  let paramIndex = 1;

  if (agent_id) {
    sql += ` AND agent_id = $${paramIndex}`;
    params.push(agent_id);
    paramIndex++;
  }
  if (persona_id) {
    sql += ` AND persona_id = $${paramIndex}`;
    params.push(persona_id);
    paramIndex++;
  }
  if (result_filter) {
    sql += ` AND result = $${paramIndex}`;
    params.push(result_filter);
    paramIndex++;
  }
  if (start_time) {
    sql += ` AND created_at >= $${paramIndex}`;
    params.push(start_time);
    paramIndex++;
  }
  if (end_time) {
    sql += ` AND created_at <= $${paramIndex}`;
    params.push(end_time);
    paramIndex++;
  }

  sql += ' ORDER BY created_at DESC';
  sql += ` LIMIT $${paramIndex}`;
  params.push(Math.min(parseInt(limit || '50', 10), 200));

  const queryResult = await db.query(sql, params);
  return { syslog: queryResult.rows, count: queryResult.rows.length };
}

// ─── 导出 ───

module.exports = {
  // 光之树 · 生长
  growBranch,
  growLeaf,
  growBloom,
  // 光之树 · 查询
  getTreeNode,
  getSubtree,
  tracePath,
  getPersonaBranch,
  getRecentLeaves,
  // 天眼 · SYSLOG
  writeSyslog,
  getTianyanView,
  querySyslog
};
