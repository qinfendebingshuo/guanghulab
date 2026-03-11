/**
 * M-PALACE · 存档/读档 API
 * POST /api/palace/save   → 保存当前状态
 * POST /api/palace/load   → 读取存档
 * GET  /api/palace/saves  → 列出所有存档
 */

const express = require('express');
const router = express.Router();
const saveManager = require('../engines/save-manager');

/**
 * POST /api/palace/save
 * body: { save_id, state, persona, history }
 */
router.post('/', function (req, res) {
  try {
    var body = req.body || {};
    var saveId = body.save_id;
    var state = body.state;
    var persona = body.persona;
    var history = body.history;

    if (!state || !persona || !history) {
      return res.status(400).json({
        error: true,
        code: 'MISSING_DATA',
        message: '缺少存档数据'
      });
    }

    var resultId = saveManager.save(state, persona, history, saveId);

    res.json({
      error: false,
      save_id: resultId,
      message: '存档成功',
      saved_at: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: 'SAVE_ERROR',
      message: '存档失败：' + err.message
    });
  }
});

/**
 * POST /api/palace/load
 * body: { save_id: "PAL-XXXXXXXX-XXXX" }
 */
router.post('/load', function (req, res) {
  try {
    var body = req.body || {};
    var saveId = body.save_id;

    if (!saveId) {
      return res.status(400).json({
        error: true,
        code: 'MISSING_SAVE_ID',
        message: '请输入存档编号'
      });
    }

    var saveData = saveManager.load(saveId);

    if (!saveData) {
      return res.status(404).json({
        error: true,
        code: 'SAVE_NOT_FOUND',
        message: '存档不存在：' + saveId
      });
    }

    res.json({
      error: false,
      save_id: saveId,
      state: saveData.state,
      persona: saveData.persona,
      history: saveData.history,
      meta: saveData.meta
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: 'LOAD_ERROR',
      message: '读档失败：' + err.message
    });
  }
});

/**
 * GET /api/palace/saves
 */
router.get('/list', function (_req, res) {
  try {
    var saves = saveManager.listSaves();
    res.json({
      error: false,
      saves: saves,
      count: saves.length
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: 'LIST_ERROR',
      message: '获取存档列表失败：' + err.message
    });
  }
});

module.exports = router;
