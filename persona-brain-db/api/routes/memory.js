/**
 * 记忆 读写 · /brain/memory
 */

const { Router } = require('express');
const crypto = require('crypto');
const router = Router();

// GET /brain/memory - 查询记忆（支持persona_id和type过滤）
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM persona_memory WHERE 1=1';
    const params = [];

    if (req.query.persona_id) {
      sql += ' AND persona_id = ?';
      params.push(req.query.persona_id);
    }
    if (req.query.type) {
      sql += ' AND type = ?';
      params.push(req.query.type);
    }

    sql += ' ORDER BY timestamp DESC';

    const rows = req.db.prepare(sql).all(...params);
    const parsed = rows.map(parseJsonFields);
    res.json({ data: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// POST /brain/memory - 写入新记忆
router.post('/', (req, res) => {
  try {
    const { persona_id, type, title, content, importance,
            related_dev, related_broadcast, tags, timestamp } = req.body;

    if (!persona_id || !type || !title || !content || !importance || !timestamp) {
      return res.status(400).json({
        error: true,
        message: 'Missing required fields: persona_id, type, title, content, importance, timestamp'
      });
    }

    const memory_id = `MEM-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    req.db.prepare(`
      INSERT INTO persona_memory
        (memory_id, persona_id, type, title, content, importance,
         related_dev, related_broadcast, tags, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      memory_id, persona_id, type, title, content, importance,
      related_dev || null, related_broadcast || null,
      tags ? JSON.stringify(tags) : null, timestamp
    );

    res.status(201).json({ data: { memory_id }, message: 'Memory created' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

function parseJsonFields(row) {
  const result = { ...row };
  if (result.tags) {
    try { result.tags = JSON.parse(result.tags); } catch (_e) { /* keep raw */ }
  }
  return result;
}

module.exports = router;
