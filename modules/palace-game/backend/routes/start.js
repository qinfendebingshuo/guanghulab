/**
 * M-PALACE · 快速启动 API
 * POST /api/palace/start
 *
 * 接收世界观+身份锚点 → 生成初始人格快照 → 背景生成 → 返回世界状态
 */

const express = require('express');
const router = express.Router();
const personaAnalyzer = require('../engines/persona-analyzer');
const backgroundGen = require('../engines/background-gen');
const saveManager = require('../engines/save-manager');

/**
 * POST /api/palace/start
 * body: { worldview: "古代中国"|"架空王朝", role: "妃子"|"皇帝"|"重臣"|"奸臣"|"随机" }
 */
router.post('/', function (req, res) {
  try {
    var body = req.body || {};
    var worldview = body.worldview || '古代中国';
    var role = body.role || '随机';

    // 随机角色
    if (role === '随机') {
      var roles = ['妃子', '皇帝', '重臣', '奸臣'];
      role = roles[Math.floor(Math.random() * roles.length)];
    }

    // ① 基于身份锚点生成初始人格分数
    var initialScores = personaAnalyzer.getInitialScores(role);

    // ② 背景生成引擎
    var bgResult = backgroundGen.generate(worldview, role, initialScores);

    // ③ 构建初始状态
    var state = {
      world: bgResult.world,
      npcs: bgResult.world.npcs || [],
      player: {
        role: role,
        title: bgResult.world.player_intro,
        worldview: worldview
      },
      chapter: 1,
      paragraph: 1,
      four_dimensions: personaAnalyzer.toFourDimensions(initialScores)
    };

    var persona = {
      current_scores: initialScores,
      history: [{
        timestamp: new Date().toISOString(),
        scores: { ...initialScores },
        input: '__init__',
        choice_index: null
      }],
      dominant_trait: personaAnalyzer.getDominantTrait(initialScores)
    };

    var history = {
      chapters: [{
        number: 1,
        title: '第一章·' + (bgResult.world.dynasty_name || '序幕'),
        started_at: new Date().toISOString()
      }],
      events: [],
      choices: []
    };

    // ④ 自动存档
    var saveId = saveManager.save(state, persona, history);

    res.json({
      error: false,
      save_id: saveId,
      state: state,
      narrative: {
        chapter_title: history.chapters[0].title,
        narrative: bgResult.world.opening_event,
        choices: bgResult.world.opening_choices
      },
      four_dimensions: state.four_dimensions
    });
  } catch (err) {
    res.status(500).json({
      error: true,
      code: 'START_ERROR',
      message: '宫廷世界生成失败：' + err.message
    });
  }
});

module.exports = router;
