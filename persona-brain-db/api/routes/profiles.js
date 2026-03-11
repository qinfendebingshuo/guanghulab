/**
 * 开发者画像 读写 · /brain/profiles
 */

const { Router } = require('express');
const router = Router();

// GET /brain/profiles - 列出所有开发者
router.get('/', (req, res) => {
  try {
    const rows = req.db.prepare('SELECT * FROM dev_profiles').all();
    const parsed = rows.map(parseJsonFields);
    res.json({ data: parsed, total: parsed.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /brain/profiles/:dev_id - 查询单个开发者
router.get('/:dev_id', (req, res) => {
  try {
    const row = req.db
      .prepare('SELECT * FROM dev_profiles WHERE dev_id = ?')
      .get(req.params.dev_id);
    if (!row) {
      return res.status(404).json({ error: true, message: 'Developer not found' });
    }
    res.json({ data: parseJsonFields(row) });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// PUT /brain/profiles/:dev_id - 更新开发者画像
router.put('/:dev_id', (req, res) => {
  try {
    const existing = req.db
      .prepare('SELECT * FROM dev_profiles WHERE dev_id = ?')
      .get(req.params.dev_id);
    if (!existing) {
      return res.status(404).json({ error: true, message: 'Developer not found' });
    }

    const updatable = [
      'name', 'device_os', 'current_module', 'current_broadcast',
      'guide_persona', 'guide_line', 'streak', 'total_completed',
      'emotion_baseline', 'last_syslog_at', 'last_active_at',
      'status', 'notes'
    ];
    const jsonUpdatable = ['capabilities', 'friction_points', 'pca_score'];

    const setClauses = [];
    const values = [];

    for (const field of updatable) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }
    for (const field of jsonUpdatable) {
      if (req.body[field] !== undefined) {
        setClauses.push(`${field} = ?`);
        values.push(JSON.stringify(req.body[field]));
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: true, message: 'No fields to update' });
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(req.params.dev_id);

    req.db.prepare(
      `UPDATE dev_profiles SET ${setClauses.join(', ')} WHERE dev_id = ?`
    ).run(...values);

    const updated = req.db
      .prepare('SELECT * FROM dev_profiles WHERE dev_id = ?')
      .get(req.params.dev_id);
    res.json({ data: parseJsonFields(updated), message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

function parseJsonFields(row) {
  const jsonFields = ['capabilities', 'friction_points', 'pca_score'];
  const result = { ...row };
  for (const field of jsonFields) {
    if (result[field]) {
      try { result[field] = JSON.parse(result[field]); } catch (_e) { /* keep raw */ }
    }
  }
  return result;
}

module.exports = router;
