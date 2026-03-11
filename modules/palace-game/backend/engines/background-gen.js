/**
 * M-PALACE · 背景生成引擎
 * 接收锚点答案 + 人格侧面初始数据
 *   → 从宫廷数据库匹配
 *   → 生成逻辑自洽的专属背景
 *
 * 生成流程：
 *   锚点1（世界观）→ 选择 templates/ 基础模板
 *   锚点2（身份）  → 确定主角定位 + 初始人格快照
 *   → 查询 palace-db 四大维度 → 调用模型 → 输出世界状态
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
const PALACE_DB_PATH = path.join(DATA_DIR, 'palace-db.json');

let _palaceDB = null;

function loadPalaceDB() {
  if (_palaceDB) return _palaceDB;
  _palaceDB = JSON.parse(fs.readFileSync(PALACE_DB_PATH, 'utf-8'));
  return _palaceDB;
}

function loadTemplate(worldview) {
  const map = {
    'ancient-china': 'ancient-china.json',
    '古代中国':      'ancient-china.json',
    'fantasy':       'fantasy-dynasty.json',
    '架空王朝':      'fantasy-dynasty.json'
  };
  const file = map[worldview] || 'ancient-china.json';
  return JSON.parse(fs.readFileSync(path.join(TEMPLATES_DIR, file), 'utf-8'));
}

/**
 * 从模板中随机选取一项
 */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 基于人格侧面决定 NPC 映射
 * 核心机密：每个 NPC 对应玩家 1~2 个人格侧面的外化
 */
function generateNPCMappings(scores) {
  const npcs = [];
  const dims = Object.entries(scores).sort((a, b) => b[1] - a[1]);

  // 最强维度 → 镜像对手
  const strongest = dims[0];
  npcs.push({
    archetype: 'mirror',
    mapped_dims: [strongest[0]],
    role_hint: 'rival',
    description: '与你最相似的对手'
  });

  // 最弱维度 → 放大威胁
  const weakest = dims[dims.length - 1];
  npcs.push({
    archetype: 'shadow',
    mapped_dims: [weakest[0]],
    role_hint: 'threat',
    description: '让你恐惧的存在'
  });

  // 温情相关 → 情感锚点
  if (scores.warmth >= 40) {
    npcs.push({
      archetype: 'anchor',
      mapped_dims: ['warmth', 'loyalty'],
      role_hint: 'ally',
      description: '需要被保护的弱势角色'
    });
  }

  // 多疑相关 → 暧昧盟友
  if (scores.suspicion >= 45) {
    npcs.push({
      archetype: 'trickster',
      mapped_dims: ['suspicion', 'cunning'],
      role_hint: 'ambiguous',
      description: '行为暧昧的盟友'
    });
  }

  // 确保至少 3 个 NPC
  if (npcs.length < 3) {
    npcs.push({
      archetype: 'catalyst',
      mapped_dims: [dims[2][0]],
      role_hint: 'neutral',
      description: '推动局势变化的中立角色'
    });
  }

  return npcs;
}

/**
 * 基于人格分数查询 palace-db，确定初始格局
 */
function queryInitialSetup(scores) {
  const db = loadPalaceDB();

  // 权力维度：基于 ambition+cunning
  const powerLevel = (scores.ambition + scores.cunning) / 2;
  const factionCount = powerLevel > 60 ? 3 : 2;

  // 后宫地位：基于 vanity+warmth
  const statusLevel = (scores.vanity + scores.warmth) / 2;

  // 情感关系：基于 warmth+loyalty
  const emotionIntensity = (scores.warmth + scores.loyalty) / 2;

  // 矛盾冲突：基于 aggression+suspicion
  const conflictLevel = (scores.aggression + scores.suspicion) / 2;
  const conflictType = conflictLevel > 60 ? '争宠' : '自保';

  return {
    factions: db.power.factions.slice(0, factionCount),
    initialEvent: pick(db.power.events),
    startingRank: db.status.ranks[Math.min(Math.floor(statusLevel / 15), db.status.ranks.length - 1)],
    emotionType: emotionIntensity > 60 ? pick(db.emotion.types.slice(0, 3)) : pick(db.emotion.types.slice(3)),
    emotionTrigger: pick(db.emotion.triggers),
    conflictType: conflictType,
    escalation: db.conflict.escalation[0]
  };
}

/**
 * 构建世界生成 prompt（供模型调用）
 */
function buildWorldPrompt(template, role, setup, npcMappings) {
  const dynasty = template.setting.dynasty;
  const era = pick(template.setting.era_prefix);
  const roleConfig = template.roles[role] || template.roles['妃子'];
  const title = pick(roleConfig.title_options);

  const npcDescriptions = npcMappings.map((npc, i) => {
    return `NPC${i + 1}（${npc.role_hint}型）：${npc.description}`;
  }).join('\n');

  return {
    system: [
      '你是一个古风宫斗叙事生成器。',
      '要求：文笔古风典雅，有呼吸感，不要白话流水账。',
      '使用通感手法，注重氛围营造。',
      '所有NPC的存在都有隐藏的人格映射逻辑，但不能向玩家揭示。'
    ].join('\n'),
    user: [
      `请为以下设定生成宫廷世界开篇：`,
      `王朝：${dynasty}`,
      `年号：${era}`,
      `玩家身份：${role}（${title}）`,
      `初始阵营格局：${setup.factions.join('、')}`,
      `开局事件：${setup.initialEvent}`,
      `情感基调：${setup.emotionType}`,
      `冲突类型：${setup.conflictType}`,
      ``,
      `需要生成的NPC：`,
      npcDescriptions,
      ``,
      `输出格式（JSON）：`,
      `{`,
      `  "dynasty_name": "王朝名",`,
      `  "era_name": "年号",`,
      `  "background": "一段时代背景描述（古风文笔·100-200字）",`,
      `  "player_intro": "主角身世与处境（古风文笔·100-200字）",`,
      `  "npcs": [{ "name": "角色名", "title": "头衔", "personality": "性格", "relation_to_player": "与主角关系", "hidden_archetype": "mirror|shadow|anchor|trickster|catalyst" }],`,
      `  "opening_event": "开局事件描述（古风文笔·150-300字）",`,
      `  "opening_choices": ["选项A", "选项B", "选项C"]`,
      `}`
    ].join('\n'),
    meta: { dynasty, era, title, role }
  };
}

/**
 * 主入口：生成完整背景（不依赖外部模型时，使用本地模板拼接）
 */
function generate(worldview, role, personaScores) {
  const template = loadTemplate(worldview);
  const setup = queryInitialSetup(personaScores);
  const npcMappings = generateNPCMappings(personaScores);
  const prompt = buildWorldPrompt(template, role, setup, npcMappings);

  // 构造本地 fallback 世界（不依赖外部模型时使用）
  const dynasty = prompt.meta.dynasty;
  const era = prompt.meta.era;
  const roleConfig = template.roles[role] || template.roles['妃子'];
  const title = prompt.meta.title;

  const localWorld = {
    dynasty_name: dynasty,
    era_name: era,
    background: `${dynasty}${era}年间，朝堂暗流涌动。${setup.factions.join('与')}明争暗斗，帝位之下，人心叵测。宫墙之内，灯火通明处未必安宁，暗影幢幢处未必无情。`,
    player_intro: `你是${dynasty}${title}，${pick(roleConfig.family_options || ['名门'])}出身。入宫数载，${setup.conflictType === '争宠' ? '虽有圣眷，却树敌颇多' : '小心翼翼，只求自保平安'}。${setup.emotionType}的暗线，早已悄然铺开。`,
    npcs: npcMappings.map(function (npc, i) {
      const names = ['沈婉仪', '赵昭仪', '陈太傅', '李将军', '刘公公'];
      return {
        name: names[i] || '无名氏',
        title: pick(template.setting.era_prefix) + '年间人物',
        personality: npc.description,
        relation_to_player: npc.role_hint,
        hidden_archetype: npc.archetype
      };
    }),
    opening_event: `夜半三更，${template.setting.inner_palace}传来急召。太后身边的掌事姑姑面色如常，语气却带着不容拒绝的冷意。你知道，这一趟，去与不去，都是棋局的一部分。`,
    opening_choices: [
      '立刻更衣前往，恭顺以对',
      '称身体不适，推迟半个时辰',
      '先派人去打听太后的意图'
    ]
  };

  return {
    world: localWorld,
    npcMappings: npcMappings,
    setup: setup,
    prompt: prompt,
    template: template
  };
}

module.exports = {
  generate,
  loadTemplate,
  loadPalaceDB,
  generateNPCMappings,
  queryInitialSetup,
  buildWorldPrompt
};
