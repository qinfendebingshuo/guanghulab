/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · 关系操作（linkNodes / unlinkNodes / getRelations）
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../db');

/**
 * linkNodes — 建立节点关联
 */
async function linkNodes(input) {
  const { from_node_id, to_node_id, relation_type, description, created_by } = input;
  const id = uuidv4();
  const weight = input.weight || 50;

  await db.query(
    `INSERT INTO brain_relations (id, from_node_id, to_node_id, relation_type, description, weight, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (from_node_id, to_node_id, relation_type) DO UPDATE
       SET description = EXCLUDED.description, weight = EXCLUDED.weight`,
    [id, from_node_id, to_node_id, relation_type, description || null, weight, created_by || 'system']
  );

  return { relation_id: id };
}

/**
 * unlinkNodes — 删除关联
 */
async function unlinkNodes(input) {
  const { relation_id } = input;
  const result = await db.query('DELETE FROM brain_relations WHERE id = $1', [relation_id]);
  return { success: result.rowCount > 0 };
}

/**
 * getRelations — 查询某节点的所有关联
 */
async function getRelations(input) {
  const { node_id, relation_type, direction } = input;
  const dir = direction || 'both';
  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (dir === 'both') {
    conditions.push(`(from_node_id = $${paramIndex} OR to_node_id = $${paramIndex})`);
    values.push(node_id);
    paramIndex++;
  } else if (dir === 'outgoing') {
    conditions.push(`from_node_id = $${paramIndex}`);
    values.push(node_id);
    paramIndex++;
  } else {
    conditions.push(`to_node_id = $${paramIndex}`);
    values.push(node_id);
    paramIndex++;
  }

  if (relation_type) {
    conditions.push(`relation_type = $${paramIndex}`);
    values.push(relation_type);
    paramIndex++;
  }

  const sql = `SELECT r.*, fn.title as from_title, tn.title as to_title
    FROM brain_relations r
    LEFT JOIN brain_nodes fn ON r.from_node_id = fn.id
    LEFT JOIN brain_nodes tn ON r.to_node_id = tn.id
    WHERE ${conditions.join(' AND ')}
    ORDER BY r.weight DESC, r.created_at DESC`;

  const result = await db.query(sql, values);
  return { relations: result.rows };
}

module.exports = { linkNodes, unlinkNodes, getRelations };
