/**
 * M-PALACE · 人格分析引擎
 * 实时分析玩家每一次输入，识别并量化人格侧面
 *
 * 分析流程：
 *   ① 关键词匹配：扫描 persona-dict 的 keywords
 *   ② 行为信号匹配：判断选项类型对应的 behavior_signals
 *   ③ 上下文推断：结合对话历史推断语气/态度/策略倾向
 *   → 输出 8 维人格侧面分数（0~100）
 */

const fs = require('fs');
const path = require('path');

const DICT_PATH = path.join(__dirname, '..', '..', 'data', 'persona-dict.json');

let _dictCache = null;

function loadDict() {
  if (_dictCache) return _dictCache;
  _dictCache = JSON.parse(fs.readFileSync(DICT_PATH, 'utf-8'));
  return _dictCache;
}

/**
 * 生成初始人格分数（基于身份锚点）
 */
function getInitialScores(role) {
  const base = {
    ambition: 50, warmth: 50, aggression: 50, suspicion: 50,
    vanity: 50, cunning: 50, loyalty: 50, fear: 50
  };
  const adjustments = {
    '皇帝':  { ambition: 20, vanity: 15 },
    '妃子':  { warmth: 15, fear: 10 },
    '重臣':  { loyalty: 20, cunning: 10 },
    '奸臣':  { cunning: 25, aggression: 15 }
  };
  const adj = adjustments[role] || {};
  for (const [k, v] of Object.entries(adj)) {
    base[k] = Math.min(100, base[k] + v);
  }
  return base;
}

/**
 * 关键词匹配：在输入文本中扫描 persona-dict keywords
 * @returns {{ [dimensionId]: number }} 命中次数 map
 */
function matchKeywords(text) {
  const dict = loadDict();
  const hits = {};
  for (const dim of dict.dimensions) {
    hits[dim.id] = 0;
    for (const kw of dim.keywords) {
      if (text.includes(kw)) hits[dim.id]++;
    }
  }
  return hits;
}

/**
 * 行为信号匹配：将选项 index 映射到行为信号
 * 选项设计规则：A=最强侧面（舒适区），B=最弱侧面（成长区），C=中性
 * @param {number|null} choiceIndex 0/1/2 or null(自由输入)
 * @param {object} optionMeta 后端为本次选项附加的元数据 { a_dims, b_dims, c_dims }
 */
function matchBehavior(choiceIndex, optionMeta) {
  if (choiceIndex === null || !optionMeta) return {};
  const key = ['a_dims', 'b_dims', 'c_dims'][choiceIndex];
  const dims = (optionMeta && optionMeta[key]) || [];
  const hits = {};
  for (const d of dims) {
    hits[d] = (hits[d] || 0) + 1;
  }
  return hits;
}

/**
 * 合并关键词 + 行为信号 → 更新人格分数
 */
function updateScores(currentScores, keywordHits, behaviorHits) {
  const updated = { ...currentScores };
  const KEYWORD_WEIGHT = 3;
  const BEHAVIOR_WEIGHT = 5;

  for (const dim of Object.keys(updated)) {
    let delta = 0;
    if (keywordHits[dim]) delta += keywordHits[dim] * KEYWORD_WEIGHT;
    if (behaviorHits[dim]) delta += behaviorHits[dim] * BEHAVIOR_WEIGHT;
    updated[dim] = Math.max(0, Math.min(100, updated[dim] + delta));
  }
  return updated;
}

/**
 * 找到当前最突出特征
 */
function getDominantTrait(scores) {
  let maxDim = null;
  let maxVal = -1;
  for (const [k, v] of Object.entries(scores)) {
    if (v > maxVal) { maxVal = v; maxDim = k; }
  }
  return maxDim;
}

/**
 * 检测分数突变（单次 +15 以上）
 */
function detectSurge(oldScores, newScores) {
  const surges = [];
  for (const dim of Object.keys(newScores)) {
    const delta = newScores[dim] - (oldScores[dim] || 50);
    if (delta >= 15) surges.push({ dim, delta });
  }
  return surges;
}

/**
 * 检测交叉升高（两个维度同时上升 10+）
 */
function detectCrossRise(oldScores, newScores) {
  const rising = [];
  for (const dim of Object.keys(newScores)) {
    const delta = newScores[dim] - (oldScores[dim] || 50);
    if (delta >= 10) rising.push(dim);
  }
  return rising.length >= 2 ? rising : [];
}

/**
 * 主分析入口
 * @param {string} text 玩家输入文本
 * @param {number|null} choiceIndex 选项序号（null = 自由输入）
 * @param {object} optionMeta 选项元数据
 * @param {object} currentScores 当前人格分数
 * @returns {{ scores, dominant, surges, crossRise }}
 */
function analyze(text, choiceIndex, optionMeta, currentScores) {
  const kwHits = text ? matchKeywords(text) : {};
  const bhHits = matchBehavior(choiceIndex, optionMeta);
  const oldScores = { ...currentScores };
  const newScores = updateScores(currentScores, kwHits, bhHits);
  const dominant = getDominantTrait(newScores);
  const surges = detectSurge(oldScores, newScores);
  const crossRise = detectCrossRise(oldScores, newScores);

  return { scores: newScores, dominant, surges, crossRise };
}

/**
 * 将 8 维人格分数转换为前端四维状态栏数值
 * 权力值 = avg(ambition, cunning)
 * 地位值 = avg(vanity, loyalty)
 * 情感值 = avg(warmth, fear反转)
 * 冲突值 = avg(aggression, suspicion)
 */
function toFourDimensions(scores) {
  return {
    power:    Math.round((scores.ambition + scores.cunning) / 2),
    status:   Math.round((scores.vanity + scores.loyalty) / 2),
    emotion:  Math.round((scores.warmth + (100 - scores.fear)) / 2),
    conflict: Math.round((scores.aggression + scores.suspicion) / 2)
  };
}

module.exports = {
  getInitialScores,
  analyze,
  getDominantTrait,
  toFourDimensions,
  matchKeywords,
  detectSurge,
  detectCrossRise
};
