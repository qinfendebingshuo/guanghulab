/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · 结构操作（buildPath / scanStructure / classify）
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const db = require('../db');

/**
 * buildPath — 批量创建路径结构（类似 mkdir -p）
 * 路径中已存在的节点跳过，不存在的自动创建为 folder 类型
 */
async function buildPath(input) {
  const { path: targetPath, owner } = input;
  const segments = targetPath.split('/').filter(s => s.length > 0);
  const createdNodes = [];
  let parentId = null;
  let currentPath = '';

  for (const segment of segments) {
    currentPath += '/' + segment;

    // 检查此路径是否已存在
    const existing = await db.query(
      'SELECT id FROM brain_nodes WHERE path = $1 AND status != $2',
      [currentPath, 'deleted']
    );

    if (existing.rows.length > 0) {
      parentId = existing.rows[0].id;
      continue;
    }

    // 创建 folder 节点
    const id = uuidv4();
    await db.query(
      `INSERT INTO brain_nodes (id, title, node_type, parent_id, path, tags, source, owner, status, created_by)
       VALUES ($1, $2, 'folder', $3, $4, '[]'::jsonb, 'agent', $5, 'active', $6)`,
      [id, segment, parentId, currentPath, owner, 'buildPath']
    );

    createdNodes.push({ id, title: segment, path: currentPath });
    parentId = id;
  }

  return {
    created_nodes: createdNodes,
    leaf_node_id: parentId
  };
}

/**
 * scanStructure — 扫描大脑结构健康度
 */
async function scanStructure(input) {
  const rootPath = input.root_path || null;
  const checks = input.checks || ['orphans', 'broken_links', 'duplicates', 'empty_folders'];
  const result = {
    total_nodes: 0,
    orphan_nodes: [],
    broken_links: [],
    duplicate_titles: [],
    empty_folders: [],
    health_score: 100
  };

  // 总节点数
  const countResult = await db.query(
    "SELECT COUNT(*) as total FROM brain_nodes WHERE status = 'active'"
  );
  result.total_nodes = parseInt(countResult.rows[0].total, 10);

  if (result.total_nodes === 0) {
    return result;
  }

  // 孤岛节点：有parent_id但parent不存在
  if (checks.includes('orphans')) {
    const orphans = await db.query(
      `SELECT n.id, n.title, n.path, n.parent_id
       FROM brain_nodes n
       LEFT JOIN brain_nodes p ON n.parent_id = p.id
       WHERE n.parent_id IS NOT NULL
         AND n.status = 'active'
         AND (p.id IS NULL OR p.status = 'deleted')`
    );
    result.orphan_nodes = orphans.rows;
  }

  // 断链：关系指向不存在的节点
  if (checks.includes('broken_links')) {
    const broken = await db.query(
      `SELECT r.*
       FROM brain_relations r
       LEFT JOIN brain_nodes fn ON r.from_node_id = fn.id AND fn.status = 'active'
       LEFT JOIN brain_nodes tn ON r.to_node_id = tn.id AND tn.status = 'active'
       WHERE fn.id IS NULL OR tn.id IS NULL`
    );
    result.broken_links = broken.rows;
  }

  // 重复标题
  if (checks.includes('duplicates')) {
    const dupes = await db.query(
      `SELECT title, array_agg(id) as node_ids, COUNT(*) as cnt
       FROM brain_nodes
       WHERE status = 'active'
       GROUP BY title
       HAVING COUNT(*) > 1
       ORDER BY cnt DESC
       LIMIT 20`
    );
    result.duplicate_titles = dupes.rows;
  }

  // 空目录
  if (checks.includes('empty_folders')) {
    const empty = await db.query(
      `SELECT f.id, f.title, f.path
       FROM brain_nodes f
       LEFT JOIN brain_nodes c ON c.parent_id = f.id AND c.status = 'active'
       WHERE f.node_type = 'folder'
         AND f.status = 'active'
         AND c.id IS NULL`
    );
    result.empty_folders = empty.rows;
  }

  // 计算健康分
  const issues = result.orphan_nodes.length + result.broken_links.length +
                 result.duplicate_titles.length + result.empty_folders.length;
  result.health_score = Math.max(0, Math.round(100 - (issues / result.total_nodes) * 100));

  return result;
}

/**
 * classify — 自动分类/打标签
 * strategy=rule: 纯关键词匹配，零成本
 * strategy=model: 调用DeepSeek（极少使用）
 */
async function classify(input) {
  const { node_ids, strategy, rules, dry_run } = input;
  const classified = [];
  const unclassified = [];

  for (const nodeId of node_ids) {
    const nodeResult = await db.query(
      'SELECT id, title, summary, tags, path FROM brain_nodes WHERE id = $1',
      [nodeId]
    );
    if (nodeResult.rows.length === 0) continue;

    const node = nodeResult.rows[0];

    if (strategy === 'rule' && rules) {
      // 规则匹配
      const matchResult = applyRules(node, rules);
      if (matchResult) {
        classified.push({
          node_id: nodeId,
          assigned_tags: matchResult.tags,
          assigned_path: matchResult.path
        });
        if (!dry_run) {
          // 实际更新
          const newTags = [...new Set([...(node.tags || []), ...matchResult.tags])];
          await db.query(
            'UPDATE brain_nodes SET tags = $1, path = COALESCE($2, path) WHERE id = $3',
            [JSON.stringify(newTags), matchResult.path || null, nodeId]
          );
        }
      } else {
        unclassified.push(nodeId);
      }
    } else if (strategy === 'model') {
      // 模型分类 — 占位，S5阶段实现
      unclassified.push(nodeId);
    } else {
      unclassified.push(nodeId);
    }
  }

  return { classified, unclassified };
}

/**
 * 规则引擎：关键词→标签映射
 */
function applyRules(node, rules) {
  const text = ((node.title || '') + ' ' + (node.summary || '')).toLowerCase();

  for (const [pattern, result] of Object.entries(rules)) {
    const keywords = pattern.toLowerCase().split('|');
    if (keywords.some(kw => text.includes(kw))) {
      return {
        tags: Array.isArray(result.tags) ? result.tags : [result.tags],
        path: result.path || null
      };
    }
  }
  return null;
}

module.exports = { buildPath, scanStructure, classify };
