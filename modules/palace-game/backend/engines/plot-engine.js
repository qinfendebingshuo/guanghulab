/**
 * M-PALACE · 角色情节引擎
 * 根据持续更新的人格侧面数据，在专属背景下动态生成宫斗剧情
 *
 * 生成逻辑：
 *   ① 人格分析引擎更新侧面分数
 *   ② 检测分数变化幅度 → 决定事件类型
 *   ③ 查询 palace-db 匹配剧情模板
 *   ④ 综合 state+persona+history 生成叙事+选项
 *   ⑤ 更新 state + history → 返回前端
 */

const fs = require('fs');
const path = require('path');
const personaAnalyzer = require('./persona-analyzer');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const PALACE_DB_PATH = path.join(DATA_DIR, 'palace-db.json');

let _palaceDB = null;

function loadPalaceDB() {
  if (_palaceDB) return _palaceDB;
  _palaceDB = JSON.parse(fs.readFileSync(PALACE_DB_PATH, 'utf-8'));
  return _palaceDB;
}

/**
 * 确定事件类型
 *   突变(+15) → 关键事件
 *   交叉升高  → 复合剧情线
 *   平稳      → 主线叙事
 */
function determineEventType(surges, crossRise) {
  if (surges.length > 0) return 'critical';
  if (crossRise.length >= 2) return 'compound';
  return 'mainline';
}

/**
 * 从 palace-db 匹配适合当前状态的剧情模板
 */
function matchPlotTemplate(eventType, scores, chapter) {
  const db = loadPalaceDB();
  const dominant = personaAnalyzer.getDominantTrait(scores);

  if (eventType === 'critical') {
    // 关键事件：根据突变维度匹配冲突类型
    const conflictMap = {
      ambition: '夺权', aggression: '报仇', suspicion: '揭秘',
      warmth: '救人', fear: '自保', cunning: '争宠',
      loyalty: '救人', vanity: '争宠'
    };
    return {
      conflict: conflictMap[dominant] || '自保',
      escalation: db.conflict.escalation[Math.min(chapter, db.conflict.escalation.length - 1)],
      emotionTrigger: pick(db.emotion.triggers),
      statusEvent: pick(db.status.events)
    };
  }

  if (eventType === 'compound') {
    return {
      conflict: pick(db.conflict.types),
      escalation: db.conflict.escalation[Math.min(Math.floor(chapter / 2), db.conflict.escalation.length - 1)],
      emotionTrigger: pick(db.emotion.triggers),
      statusEvent: null
    };
  }

  // mainline
  return {
    conflict: null,
    escalation: db.conflict.escalation[0],
    emotionTrigger: null,
    statusEvent: null
  };
}

/**
 * 生成选项：A=顺应最强侧面, B=挑战最弱侧面, C=中性探索
 */
function generateChoicesMeta(scores) {
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0][0];
  const weakest = sorted[sorted.length - 1][0];
  const mid = sorted[Math.floor(sorted.length / 2)][0];

  return {
    a_dims: [strongest],
    b_dims: [weakest],
    c_dims: [mid],
    strategy: {
      a: 'comfort',   // 舒适区
      b: 'growth',    // 成长区
      c: 'explore'    // 探索区
    }
  };
}

/**
 * 构建情节生成 prompt（供模型调用）
 */
function buildPlotPrompt(state, persona, history, plotTemplate, choicesMeta) {
  const chapterNum = (state.chapter || 0) + 1;
  const paragraphNum = (state.paragraph || 0) + 1;
  const recentChoices = (history.choices || []).slice(-3);

  const sorted = Object.entries(persona.current_scores).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0];
  const weakest = sorted[sorted.length - 1];

  return {
    system: [
      '你是一个古风宫斗叙事引擎。',
      '文笔要求：古风典雅·有呼吸感·注重氛围·善用通感。',
      '每段叙事100-250字，节奏不急不徐。',
      '选项设计：A=顺应玩家当前最强侧面，B=挑战最弱侧面，C=中性/意外方向。',
      '永远不要暗示或揭示人格映射机制。'
    ].join('\n'),
    user: [
      `当前状态：第${chapterNum}章·第${paragraphNum}段`,
      `世界：${state.world ? state.world.dynasty_name + '·' + state.world.era_name : '未知王朝'}`,
      `玩家身份：${state.player ? state.player.role : '未知'}`,
      ``,
      `NPC状态：${JSON.stringify((state.npcs || []).map(function (n) { return n.name + '(' + n.relation_to_player + ')'; }))}`,
      ``,
      `剧情类型：${plotTemplate.conflict || '日常推进'}`,
      `升级阶段：${plotTemplate.escalation}`,
      plotTemplate.emotionTrigger ? `情感触发：${plotTemplate.emotionTrigger}` : '',
      plotTemplate.statusEvent ? `地位事件：${plotTemplate.statusEvent}` : '',
      ``,
      `玩家最近选择：${recentChoices.map(function (c) { return c.text; }).join(' → ') || '无'}`,
      `玩家最强倾向：${strongest[0]}(${strongest[1]})`,
      `玩家最弱倾向：${weakest[0]}(${weakest[1]})`,
      ``,
      `请生成下一段叙事和选项（JSON）：`,
      `{`,
      `  "chapter_title": "第X章·标题",`,
      `  "narrative": "叙事文本（古风文笔·100-250字）",`,
      `  "choices": ["选项A（顺应${strongest[0]}）", "选项B（挑战${weakest[0]}）", "选项C（中性探索）"],`,
      `  "dimension_changes": { "power": 0, "status": 0, "emotion": 0, "conflict": 0 }`,
      `}`
    ].filter(Boolean).join('\n'),
    meta: { chapterNum, paragraphNum, choicesMeta }
  };
}

/**
 * 本地生成叙事 fallback（不依赖外部模型时使用）
 */
function generateLocalNarrative(state, persona, plotTemplate, choicesMeta) {
  const db = loadPalaceDB();
  const chapterNum = (state.chapter || 0) + 1;
  const paragraphNum = (state.paragraph || 0) + 1;
  const sorted = Object.entries(persona.current_scores).sort((a, b) => b[1] - a[1]);
  const strongest = sorted[0][0];
  const weakest = sorted[sorted.length - 1][0];

  const locations = ['长乐宫', '御花园', '太和殿', '冷宫回廊', '密道暗阁'];
  const atmosphere = ['月色冷白', '烛火摇曳', '细雨如丝', '暮色四合', '晨曦微露'];
  const loc = pick(locations);
  const atm = pick(atmosphere);

  const narrativeTemplates = {
    critical: `${atm}，${loc}内气氛凝重如铁。一封密信悄然送到你案前，字迹潦草，却句句惊心。你知道，有些事一旦知晓，便再无退路。窗外的风卷起帘角，像是催促，又像是警告。`,
    compound: `${atm}，你独坐${loc}，心思百转。今日朝堂上的一幕反复在脑海中翻涌——那个眼神，那句话，似乎都别有深意。而你身边的人，究竟哪个是真心，哪个是棋子？`,
    mainline: `${atm}，${loc}一切如常。宫人们来去匆匆，各怀心事。你整理好衣冠，准备迎接新的一天。然而平静之下，暗流从未停歇。`
  };

  const dimLabels = {
    ambition: '野心', warmth: '温情', aggression: '攻击', suspicion: '多疑',
    vanity: '虚荣', cunning: '心机', loyalty: '忠义', fear: '恐惧'
  };

  const choiceTemplates = {
    ambition:   ['主动出击，争取主导权', '直面挑战，绝不退缩'],
    warmth:     ['以柔化刚，寻求和解', '默默守护，不求回报'],
    aggression: ['果断反击，以牙还牙', '设下陷阱，一击致命'],
    suspicion:  ['暗中调查，不动声色', '保持距离，静观其变'],
    vanity:     ['展示实力，彰显地位', '争取荣耀，不甘人后'],
    cunning:    ['迂回布局，暗中谋划', '利用关系，借力打力'],
    loyalty:    ['坚守立场，绝不妥协', '为盟友挺身而出'],
    fear:       ['谨慎行事，避免冲突', '退一步，保全实力']
  };

  const choiceA = pick(choiceTemplates[strongest] || ['继续观望']);
  const choiceB = pick(choiceTemplates[weakest] || ['另辟蹊径']);
  const choiceC = '派人暗中打探消息，再做定夺';

  const dims = personaAnalyzer.toFourDimensions(persona.current_scores);
  const dimChanges = { power: 0, status: 0, emotion: 0, conflict: 0 };
  if (plotTemplate.conflict) {
    dimChanges.conflict = Math.floor(Math.random() * 5) + 1;
  }
  if (plotTemplate.statusEvent) {
    dimChanges.status = Math.floor(Math.random() * 5) - 2;
  }

  return {
    chapter_title: `第${chapterNum}章·${plotTemplate.conflict || '暗流'}`,
    narrative: narrativeTemplates[determineEventType(
      personaAnalyzer.detectSurge({}, persona.current_scores),
      personaAnalyzer.detectCrossRise({}, persona.current_scores)
    )] || narrativeTemplates.mainline,
    choices: [choiceA, choiceB, choiceC],
    dimension_changes: dimChanges,
    meta: {
      chapter: chapterNum,
      paragraph: paragraphNum,
      choices_meta: choicesMeta
    }
  };
}

/**
 * 主入口：推进情节
 * @param {object} state 当前世界状态
 * @param {object} persona 玩家人格数据
 * @param {object} history 剧情历史
 * @param {string} playerInput 玩家输入
 * @param {number|null} choiceIndex 选项序号
 * @param {object} prevOptionMeta 上一轮选项元数据
 */
function advance(state, persona, history, playerInput, choiceIndex, prevOptionMeta) {
  // ① 人格分析更新
  const analysis = personaAnalyzer.analyze(
    playerInput, choiceIndex, prevOptionMeta, persona.current_scores
  );

  // 更新 persona
  const oldScores = { ...persona.current_scores };
  persona.current_scores = analysis.scores;
  persona.dominant_trait = analysis.dominant;
  if (!persona.history) persona.history = [];
  persona.history.push({
    timestamp: new Date().toISOString(),
    scores: { ...analysis.scores },
    input: playerInput,
    choice_index: choiceIndex
  });

  // ② 确定事件类型
  const eventType = determineEventType(analysis.surges, analysis.crossRise);

  // ③ 匹配剧情模板
  const plotTemplate = matchPlotTemplate(eventType, analysis.scores, state.chapter || 0);

  // ④ 生成选项元数据
  const choicesMeta = generateChoicesMeta(analysis.scores);

  // ⑤ 生成叙事（本地 fallback）
  const result = generateLocalNarrative(state, persona, plotTemplate, choicesMeta);

  // ⑥ 更新 state
  state.chapter = result.meta.chapter;
  state.paragraph = result.meta.paragraph;
  state.four_dimensions = personaAnalyzer.toFourDimensions(analysis.scores);

  // ⑦ 更新 history
  if (!history.choices) history.choices = [];
  history.choices.push({
    text: playerInput || `选项${(choiceIndex || 0) + 1}`,
    choice_index: choiceIndex,
    timestamp: new Date().toISOString()
  });
  if (!history.chapters) history.chapters = [];
  if (history.chapters.length < result.meta.chapter) {
    history.chapters.push({
      number: result.meta.chapter,
      title: result.chapter_title,
      started_at: new Date().toISOString()
    });
  }
  if (eventType === 'critical') {
    if (!history.events) history.events = [];
    history.events.push({
      type: eventType,
      chapter: result.meta.chapter,
      trigger: analysis.surges.map(function (s) { return s.dim; }).join('+'),
      timestamp: new Date().toISOString()
    });
  }

  // 构建 prompt 供可选的模型调用
  const prompt = buildPlotPrompt(state, persona, history, plotTemplate, choicesMeta);

  return {
    narrative: result,
    state: state,
    persona: persona,
    history: history,
    four_dimensions: state.four_dimensions,
    choices_meta: choicesMeta,
    event_type: eventType,
    prompt: prompt
  };
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  advance,
  determineEventType,
  matchPlotTemplate,
  generateChoicesMeta,
  buildPlotPrompt,
  generateLocalNarrative
};
