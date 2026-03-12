/**
 * Agent注册 CRUD · /brain/agents
 * Phase A：只读，Phase C启用写入
 */

const { Router } = require('express');
const router = Router();

// GET /brain/agents - 列出所有Agent
router.get('/', (req, res) => {
  try {
    const rows = req.db.prepare('SELECT * FROM agent_registry').all();
    const parsed = rows.map(parseJsonFields);
    res.json({ data: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /brain/agents/:id - 查询单个Agent
router.get('/:id', (req, res) => {
  try {
    const row = req.db
      .prepare('SELECT * FROM agent_registry WHERE agent_id = ?')
      .get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: true, message: 'Agent not found' });
    }
    res.json({ data: parseJsonFields(row) });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

function parseJsonFields(row) {
  const jsonFields = ['capabilities', 'performance'];
  const result = { ...row };
  for (const field of jsonFields) {
    if (result[field]) {
      try { result[field] = JSON.parse(result[field]); } catch (_e) { /* keep raw */ }
    }
  }
  return result;
}

module.exports = router;
