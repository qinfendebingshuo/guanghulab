/**
 * HLI-REGISTRY-001 · 开发者编号查询
 * GET /hli/registry/lookup?exp_id=EXP-001
 *
 * 仅返回指定编号的公开信息，不暴露全量数据库
 */
const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const HUMAN_REGISTRY_PATH = path.join(
  __dirname, '..', '..', '..', '..',
  'persona-studio', 'brain', 'human-registry.json'
);

function loadHumanRegistry() {
  try {
    return JSON.parse(fs.readFileSync(HUMAN_REGISTRY_PATH, 'utf-8'));
  } catch {
    return { developers: [] };
  }
}

// GET /hli/registry/lookup?exp_id=EXP-001
router.get('/lookup', (req, res) => {
  const { exp_id } = req.query || {};

  if (!exp_id || !/^EXP-\d{3,}$/.test(exp_id)) {
    return res.status(400).json({
      error: true,
      hli_id: 'HLI-REGISTRY-001',
      code: 'INVALID_ID',
      message: '编号格式不正确，请使用 EXP-XXX 格式'
    });
  }

  const registry = loadHumanRegistry();
  const devs = registry.developers || [];
  const found = devs.find(d => d.exp_id === exp_id);

  if (!found) {
    return res.status(404).json({
      error: true,
      hli_id: 'HLI-REGISTRY-001',
      code: 'NOT_FOUND',
      message: '编号未注册'
    });
  }

  res.json({
    error: false,
    hli_id: 'HLI-REGISTRY-001',
    data: {
      exp_id: found.exp_id,
      name: found.name,
      status: found.status,
      role: found.role,
      registered_at: found.registered_at
    }
  });
});

module.exports = router;
