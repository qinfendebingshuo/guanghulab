/**
 * ═══════════════════════════════════════════════════════════
 * MCP 工具 · 节点操作（createNode / updateNode / deleteNode / queryNodes / getNode）
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 */

'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const cos = require('../cos');

// 内容长度阈值：超过此值自动上传COS
const COS_THRESHOLD = 512;

/**
 * createNode — 创建大脑节点
 */
async function createNode(input) {
  const id = uuidv4();
  const {
    title, node_type, parent_id, path: nodePath, tags,
    source, source_url, content, owner, created_by
  } = input;

  let summary = null;
  let content_url = null;
  let content_hash = null;

  if (content) {
    content_hash = crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);

    if (content.length <= COS_THRESHOLD) {
      summary = content;
    } else {
      // 长内容上传COS，summary取前256字
      summary = content.substring(0, 256);
      const cosKey = `brain/${owner}/${node_type}/${id}.md`;
      const result = await cos.write('hot', cosKey, content);
      content_url = result.url;
    }
  }

  // 如果没给path但给了parent_id，自动生成路径
  let finalPath = nodePath || null;
  if (!finalPath && parent_id) {
    const parentResult = await db.query('SELECT path, title FROM brain_nodes WHERE id = $1', [parent_id]);
    if (parentResult.rows.length > 0) {
      const parentPath = parentResult.rows[0].path || '/' + parentResult.rows[0].title;
      finalPath = parentPath + '/' + title;
    }
  }
  if (!finalPath) {
    finalPath = '/' + title;
  }

  await db.query(
    `INSERT INTO brain_nodes (id, title, node_type, parent_id, path, tags, source, source_url, content_url, summary, content_hash, owner, owner_user_id, status, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'active',$14)`,
    [id, title, node_type, parent_id || null, finalPath,
     JSON.stringify(tags || []), source, source_url || null,
     content_url, summary, content_hash, owner,
     input.owner_user_id || null, created_by || owner]
  );

  return { node_id: id, path: finalPath, content_url };
}

/**
 * updateNode — 更新节点
 */
async function updateNode(input) {
  const { node_id } = input;
  const updates = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = ['title', 'tags', 'status', 'summary', 'path', 'node_type', 'source_url'];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      const val = field === 'tags' ? JSON.stringify(input[field]) : input[field];
      updates.push(`${field} = $${paramIndex}`);
      values.push(val);
      paramIndex++;
    }
  }

  // 如果有content更新
  if (input.content !== undefined) {
    const content_hash = crypto.createHash('sha256').update(input.content).digest('hex').substring(0, 16);
    updates.push(`content_hash = $${paramIndex}`);
    values.push(content_hash);
    paramIndex++;

    updates.push(`version = version + 1`);

    if (input.content.length <= COS_THRESHOLD) {
      updates.push(`summary = $${paramIndex}`);
      values.push(input.content);
      paramIndex++;
    } else {
      updates.push(`summary = $${paramIndex}`);
      values.push(input.content.substring(0, 256));
      paramIndex++;

      // 获取当前节点信息用于COS路径
      const nodeResult = await db.query('SELECT owner, node_type FROM brain_nodes WHERE id = $1', [node_id]);
      if (nodeResult.rows.length > 0) {
        const { owner, node_type } = nodeResult.rows[0];
        const cosKey = `brain/${owner}/${node_type}/${node_id}.md`;
        const cosResult = await cos.write('hot', cosKey, input.content);
        updates.push(`content_url = $${paramIndex}`);
        values.push(cosResult.url);
        paramIndex++;
      }
    }
  }

  if (updates.length === 0) {
    return { node_id, updated_fields: [] };
  }

  values.push(node_id);
  await db.query(
    `UPDATE brain_nodes SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );

  return {
    node_id,
    updated_fields: Object.keys(input).filter(k => k !== 'node_id')
  };
}

/**
 * deleteNode — 软删除节点
 */
async function deleteNode(input) {
  const { node_id } = input;
  const result = await db.query(
    "UPDATE brain_nodes SET status = 'deleted' WHERE id = $1 AND status != 'deleted'",
    [node_id]
  );
  return { success: result.rowCount > 0 };
}

/**
 * queryNodes — 查询/搜索节点
 */
async function queryNodes(input) {
  const conditions = ["status != 'deleted'"];
  const values = [];
  let paramIndex = 1;

  if (input.keyword) {
    conditions.push(`(title ILIKE $${paramIndex} OR summary ILIKE $${paramIndex})`);
    values.push(`%${input.keyword}%`);
    paramIndex++;
  }

  if (input.node_type) {
    conditions.push(`node_type = $${paramIndex}`);
    values.push(input.node_type);
    paramIndex++;
  }

  if (input.tags && input.tags.length > 0) {
    conditions.push(`tags ?| $${paramIndex}`);
    values.push(input.tags);
    paramIndex++;
  }

  if (input.owner) {
    conditions.push(`owner = $${paramIndex}`);
    values.push(input.owner);
    paramIndex++;
  }

  if (input.parent_id) {
    conditions.push(`parent_id = $${paramIndex}`);
    values.push(input.parent_id);
    paramIndex++;
  }

  if (input.path_prefix) {
    conditions.push(`path LIKE $${paramIndex}`);
    values.push(input.path_prefix + '%');
    paramIndex++;
  }

  if (input.status) {
    // 覆盖默认的 != deleted 条件
    conditions[0] = `status = $${paramIndex}`;
    values.push(input.status);
    paramIndex++;
  }

  const limit = Math.min(input.limit || 50, 200);
  values.push(limit);

  const sql = `SELECT id, title, node_type, parent_id, path, tags, source, source_url, content_url, summary, status, owner, created_at, updated_at
    FROM brain_nodes
    WHERE ${conditions.join(' AND ')}
    ORDER BY updated_at DESC
    LIMIT $${paramIndex}`;

  const result = await db.query(sql, values);

  // 获取总数
  const countSql = `SELECT COUNT(*) as total FROM brain_nodes WHERE ${conditions.join(' AND ')}`;
  const countResult = await db.query(countSql, values);

  return {
    nodes: result.rows,
    total: parseInt(countResult.rows[0].total, 10)
  };
}

/**
 * getNode — 获取单个节点详情（含COS完整内容）
 */
async function getNode(input) {
  const { node_id } = input;
  const result = await db.query('SELECT * FROM brain_nodes WHERE id = $1', [node_id]);

  if (result.rows.length === 0) {
    return { node: null };
  }

  const node = result.rows[0];

  // 如果有COS内容，拉取完整内容
  if (node.content_url) {
    try {
      const cosKey = node.content_url.replace(/^https?:\/\/[^/]+\//, '');
      const cosResult = await cos.read('hot', cosKey);
      node.content = cosResult.content;
    } catch (err) {
      node.content = node.summary;
      node.content_error = err.message;
    }
  } else {
    node.content = node.summary;
  }

  return { node };
}

module.exports = { createNode, updateNode, deleteNode, queryNodes, getNode };
