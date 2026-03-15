/**
 * M-PALACE · 玩家互动 API
 * POST /api/palace/interact
 *
 * 接收玩家输入 → 人格分析 → 情节推进 → 返回新叙事+选项
 */

const express = require('express');
const router = express.Router();
const plotEngine = require('../engines/plot-engine');
const saveManager = require('../engines/save-manager');

/**
 * POST /api/palace/interact
 * body: {
 *   save_id: "PAL-XXXXXXXX-XXXX",
 *   input: "玩家输入文本" | null,
 *   choice_index: 0|1|2|null,
 *   option_meta: { a_dims, b_dims, c_dims } | null
 * }
 */
router.post('/', function (req, res) {
  try {
    var body = req.body || {};
    var saveId = body.save_id;
    var playerInput = body.input || '';
    var choiceIndex = body.choice_index != null ? body.choice_index : null;
    var optionMeta = body.option_meta || null;

    if (!saveId) {
      return res.status(400).json({
        error: true,
        code: 'MISSING_SAVE_ID',
        message: '缺少存档编号'
      });
    }

    // 读取存档
    var saveData = saveManager.load(saveId);
    if (!saveData) {
      return res.status(404).json({
        error: true,
        code: 'SAVE_NOT_FOUND',
        message: '存档不存在：' + saveId
      });
    }

    var state = saveData.state;
    var persona = saveData.persona;
    var history = saveData.history;

    // 情节推进
    var result = plotEngine.advance(
      state, persona, history,
      playerInput, choiceIndex, optionMeta
    );

    // 自动存档
    saveManager.save(result.state, result.persona, result.history, saveId);

    res.json({
      error: false,
      save_id: saveId,
      narrative: {
        chapter_title: result.narrative.chapter_title,
        narrative: result.narrative.narrative,
        choices: result.narrative.choices
      },
      four_dimensions: result.four_dimensions,
      choices_meta: result.choices_meta,
      event_type: result.event_type,
      chapter: result.state.chapter,
      paragraph: result.state.paragraph
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: 'INTERACT_ERROR',
      message: '剧情推进失败：' + err.message
    });
  }
});

module.exports = router;
