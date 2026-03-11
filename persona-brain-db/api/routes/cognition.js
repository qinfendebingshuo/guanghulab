/**
 * 认知规则 读取+版本切换 · /brain/cognition
 */

const { Router } = require('express');
const router = Router();

// GET /brain/cognition - 查询规则（支持category和status过滤）
router.get('/', (req, res) => {
  try {
    let sql = 'SELECT * FROM persona_cognition WHERE 1=1';
    const params = [];

    if (req.query.category) {
      sql += ' AND category = ?';
      params.push(req.query.category);
    }
    if (req.query.status) {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }

    sql += ' ORDER BY effective_from DESC';

    const rows = req.db.prepare(sql).all(...params);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// GET /brain/cognition/:rule_id/history - 查询规则版本历史
router.get('/:rule_id/history', (req, res) => {
  try {
    const baseId = req.params.rule_id.replace(/-\d+$/, '');
    const rows = req.db
      .prepare(
        `SELECT * FROM persona_cognition
         WHERE rule_id LIKE ? || '%'
         ORDER BY version DESC`
      )
      .all(baseId);
    res.json({ data: rows, total: rows.length });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

module.exports = router;
