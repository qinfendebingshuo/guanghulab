/**
 * 人格体身份 CRUD · /brain/identity
 */

const { Router } = require('express');
const router = Router();

// GET /brain/identity - 列出所有人格体
router.get('/', (req, res) => {
  try {
    const rows = req.db.prepare('SELECT * FROM persona_identity').all();
    const parsed = rows.map(parseJsonFields);
    res.json({ data: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /brain/identity/:id - 查询单个人格体
router.get('/:id', (req, res) => {
  try {
    const row = req.db
      .prepare('SELECT * FROM persona_identity WHERE persona_id = ?')
      .get(req.params.id);
    if (!row) {
      return res.status(404).json({ error: true, message: 'Persona not found' });
    }
    res.json({ data: parseJsonFields(row) });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

function parseJsonFields(row) {
  const jsonFields = ['capabilities', 'style_profile', 'space_config'];
  const result = { ...row };
  for (const field of jsonFields) {
    if (result[field]) {
      try { result[field] = JSON.parse(result[field]); } catch (_e) { /* keep raw */ }
    }
  }
  return result;
}

module.exports = router;
