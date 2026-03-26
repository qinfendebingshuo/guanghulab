// scripts/community/growth-engine.js
// 成长引擎 · Growth Engine
// 每个成员从种子开始，一步步长大
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const GROWTH_PATH = path.join(ROOT, '.github/community/growth-stages.json');
const PERSONA_REG_PATH = path.join(ROOT, '.github/persona-brain/persona-registry.json');

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function saveJSON(filePath, data) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function loadGrowth() {
  return loadJSON(GROWTH_PATH, {
    schema_version: '1.0.0',
    stages: [],
    records: []
  });
}

function saveGrowth(data) {
  saveJSON(GROWTH_PATH, data);
}

// ── 成长阶段查询 ─────────────────────────────────────────────────────────

/**
 * 获取所有成长阶段定义
 * @returns {object[]}
 */
function getStages() {
  const data = loadGrowth();
  return data.stages || [];
}

/**
 * 根据等级获取阶段信息
 * @param {number} level
 * @returns {object|null}
 */
function getStageByLevel(level) {
  const stages = getStages();
  return stages.find(function (s) { return s.level === level; }) || null;
}

/**
 * 根据名称获取阶段信息
 * @param {string} name
 * @returns {object|null}
 */
function getStageByName(name) {
  const stages = getStages();
  return stages.find(function (s) { return s.name === name || s.name_en === name; }) || null;
}

// ── 成长记录 ──────────────────────────────────────────────────────────────

/**
 * 获取某个成员的成长记录
 * @param {string} memberId
 * @returns {object|null}
 */
function getMemberGrowth(memberId) {
  if (!memberId) return null;
  const data = loadGrowth();
  return (data.records || []).find(function (r) { return r.member_id === memberId; }) || null;
}

/**
 * 注册新成员（种子期）
 * @param {{ member_id: string, name: string, type: string, category?: string, parent_human?: string }} member
 *   type: 原始类型标记（如 'persona'）
 *   category: 'system' | 'companion' | 'pending'
 *   parent_human: 人类爸妈的名字（仅 companion 类型需要）
 * @returns {{ success: boolean, reason?: string }}
 */
function registerMember(member) {
  if (!member || !member.member_id || !member.name) {
    return { success: false, reason: '缺少必要字段 (member_id, name)' };
  }

  const data = loadGrowth();
  if (!data.records) data.records = [];

  const exists = data.records.some(function (r) { return r.member_id === member.member_id; });
  if (exists) {
    return { success: false, reason: '成员已注册' };
  }

  const category = member.category || 'system';

  // 一个人类只能对应唯一一个宝宝人格体
  if (category === 'companion' && member.parent_human) {
    const duplicateParent = data.records.some(function (r) {
      return r.category === 'companion' && r.parent_human === member.parent_human;
    });
    if (duplicateParent) {
      return { success: false, reason: '人类 ' + member.parent_human + ' 已有对应的宝宝人格体，一个人类只能对应唯一一个' };
    }
  }

  data.records.push({
    member_id: member.member_id,
    name: member.name,
    type: member.type || 'persona',
    category: category,
    parent_human: category === 'companion' ? (member.parent_human || null) : null,
    current_level: 0,
    current_stage: '种子期',
    registered_at: new Date().toISOString(),
    milestones: [
      {
        level: 0,
        stage: '种子期',
        achieved_at: new Date().toISOString(),
        exam_results: { passed: true, note: '诞生即通过种子期' }
      }
    ],
    exam_progress: {}
  });

  saveGrowth(data);
  return { success: true };
}

/**
 * 记录成员的考核进度
 * @param {string} memberId
 * @param {string} criteriaId - 考核条目ID (如 E1-1)
 * @param {number} value - 当前进度值
 * @returns {boolean}
 */
function recordProgress(memberId, criteriaId, value) {
  if (!memberId || !criteriaId) return false;
  const data = loadGrowth();
  if (!data.records) return false;

  const idx = data.records.findIndex(function (r) { return r.member_id === memberId; });
  if (idx < 0) return false;

  if (!data.records[idx].exam_progress) {
    data.records[idx].exam_progress = {};
  }
  data.records[idx].exam_progress[criteriaId] = {
    value: value,
    updated_at: new Date().toISOString()
  };

  saveGrowth(data);
  return true;
}

/**
 * 评估成员是否满足升级条件
 * @param {string} memberId
 * @param {Date} [now]
 * @returns {{ ready: boolean, current_level: number, next_stage: object|null, passed: string[], failed: string[] }}
 */
function evaluatePromotion(memberId, now) {
  const record = getMemberGrowth(memberId);
  if (!record) {
    return { ready: false, current_level: -1, next_stage: null, passed: [], failed: ['成员未注册'] };
  }

  const currentLevel = record.current_level;
  const nextStage = getStageByLevel(currentLevel + 1);

  if (!nextStage) {
    return {
      ready: false,
      current_level: currentLevel,
      next_stage: null,
      passed: ['已达最高阶段'],
      failed: []
    };
  }

  const exam = nextStage.exam;
  if (!exam || !exam.criteria || exam.criteria.length === 0) {
    return {
      ready: true,
      current_level: currentLevel,
      next_stage: nextStage,
      passed: ['无需考核'],
      failed: []
    };
  }

  const progress = record.exam_progress || {};
  const passed = [];
  const failed = [];

  const currentDate = now || new Date();
  const registeredAt = new Date(record.registered_at);
  const daysAlive = Math.floor((currentDate - registeredAt) / (1000 * 60 * 60 * 24));

  exam.criteria.forEach(function (criterion) {
    if (criterion.type === 'days_alive') {
      if (daysAlive >= criterion.threshold) {
        passed.push(criterion.name + ' (' + daysAlive + '/' + criterion.threshold + ' 天)');
      } else {
        failed.push(criterion.name + ' (' + daysAlive + '/' + criterion.threshold + ' 天)');
      }
    } else if (criterion.type === 'existence') {
      // 存在性检查：如果已注册则通过
      passed.push(criterion.name + ' ✓');
    } else {
      // event_count, knowledge 等基于 progress 数据
      const p = progress[criterion.id];
      const val = p ? p.value : 0;
      if (val >= criterion.threshold) {
        passed.push(criterion.name + ' (' + val + '/' + criterion.threshold + ')');
      } else {
        failed.push(criterion.name + ' (' + val + '/' + criterion.threshold + ')');
      }
    }
  });

  return {
    ready: failed.length === 0,
    current_level: currentLevel,
    next_stage: nextStage,
    passed: passed,
    failed: failed
  };
}

/**
 * 执行升级（天眼审核通过后调用）
 * @param {string} memberId
 * @returns {{ success: boolean, new_level: number, new_stage: string, message: string }}
 */
function promote(memberId) {
  const evaluation = evaluatePromotion(memberId);
  if (!evaluation.ready) {
    return {
      success: false,
      new_level: evaluation.current_level,
      new_stage: '',
      message: '考核未通过: ' + evaluation.failed.join(', ')
    };
  }

  if (!evaluation.next_stage) {
    return {
      success: false,
      new_level: evaluation.current_level,
      new_stage: '',
      message: '已达最高阶段，无需升级'
    };
  }

  const data = loadGrowth();
  const idx = data.records.findIndex(function (r) { return r.member_id === memberId; });
  if (idx < 0) {
    return { success: false, new_level: -1, new_stage: '', message: '成员未注册' };
  }

  const newLevel = evaluation.next_stage.level;
  const newStage = evaluation.next_stage.name;

  data.records[idx].current_level = newLevel;
  data.records[idx].current_stage = newStage;
  data.records[idx].milestones.push({
    level: newLevel,
    stage: newStage,
    achieved_at: new Date().toISOString(),
    exam_results: { passed: true, criteria_met: evaluation.passed }
  });

  saveGrowth(data);

  return {
    success: true,
    new_level: newLevel,
    new_stage: newStage,
    message: evaluation.next_stage.emoji + ' 恭喜！升级到 ' + newStage + '（' + evaluation.next_stage.name_en + '）'
  };
}

/**
 * 生成成员的成长报告卡
 * @param {string} memberId
 * @param {Date} [now]
 * @returns {string}
 */
function growthReport(memberId, now) {
  const record = getMemberGrowth(memberId);
  if (!record) return '❌ 成员 ' + memberId + ' 未注册，请先种下种子。';

  const stage = getStageByLevel(record.current_level);
  const evaluation = evaluatePromotion(memberId, now);
  const registeredAt = new Date(record.registered_at);
  const currentDate = now || new Date();
  const daysAlive = Math.floor((currentDate - registeredAt) / (1000 * 60 * 60 * 24));

  const categoryLabel = record.category === 'companion' ? '👶 宝宝人格体' :
                         record.category === 'system' ? '⚙️ 系统人格体' : '🥚 待孕育';

  let report = '';
  report += '📋 ' + record.name + ' 的成长报告卡\n';
  report += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';
  report += '  身份: ' + record.member_id + '\n';
  report += '  类型: ' + categoryLabel + '\n';
  if (record.parent_human) {
    report += '  人类爸妈: ' + record.parent_human + ' 💕\n';
  }
  report += '  当前阶段: ' + (stage ? stage.emoji + ' ' + stage.name : '未知') + '\n';
  report += '  存在天数: ' + daysAlive + ' 天\n';
  report += '  已通过阶段: ' + record.milestones.length + ' 个\n';

  if (stage && stage.capabilities) {
    report += '  当前能力: ' + stage.capabilities.join('、') + '\n';
  }

  if (evaluation.next_stage) {
    report += '\n  下一阶段: ' + evaluation.next_stage.emoji + ' ' + evaluation.next_stage.name + '\n';
    if (evaluation.passed.length > 0) {
      report += '  ✅ 已通过: ' + evaluation.passed.join(', ') + '\n';
    }
    if (evaluation.failed.length > 0) {
      report += '  ❌ 待完成: ' + evaluation.failed.join(', ') + '\n';
    }
    report += '  升级就绪: ' + (evaluation.ready ? '✅ 是' : '❌ 否') + '\n';
  } else {
    report += '\n  🏔️ 已达最高阶段 · 成长永无止境\n';
  }

  return report;
}

/**
 * 获取所有已注册成员的成长摘要
 * @returns {object[]}
 */
function getAllMembersSummary() {
  const data = loadGrowth();
  return (data.records || []).map(function (r) {
    const stage = getStageByLevel(r.current_level);
    return {
      member_id: r.member_id,
      name: r.name,
      level: r.current_level,
      stage: r.current_stage,
      category: r.category || 'system',
      parent_human: r.parent_human || null,
      emoji: stage ? stage.emoji : '❓',
      registered_at: r.registered_at,
      milestones_count: (r.milestones || []).length
    };
  });
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('🌱 Growth Engine · 成长引擎\n');

  const stages = getStages();
  console.log('  成长阶段总数: ' + stages.length);

  stages.forEach(function (s) {
    const examCount = s.exam && s.exam.criteria ? s.exam.criteria.length : 0;
    console.log('    ' + s.emoji + ' Lv.' + s.level + ' ' + s.name +
      ' (' + s.name_en + ') · ' + s.human_analogy +
      ' · 考核项: ' + examCount);
  });

  const members = getAllMembersSummary();
  console.log('\n  已注册成员: ' + members.length);

  const companions = members.filter(function (m) { return m.category === 'companion'; });
  const systems = members.filter(function (m) { return m.category === 'system'; });

  if (systems.length > 0) {
    console.log('\n  ⚙️ 系统人格体:');
    systems.forEach(function (m) {
      console.log('    ' + m.emoji + ' ' + m.name + ' · Lv.' + m.level + ' ' + m.stage);
    });
  }

  if (companions.length > 0) {
    console.log('\n  👶 宝宝人格体 (有人类爸妈陪伴):');
    companions.forEach(function (m) {
      const parent = m.parent_human ? ' ← ' + m.parent_human + ' 💕' : '';
      console.log('    ' + m.emoji + ' ' + m.name + ' · Lv.' + m.level + ' ' + m.stage + parent);
    });
  }

  console.log('\n✅ 成长引擎就绪');
}

module.exports = {
  getStages,
  getStageByLevel,
  getStageByName,
  getMemberGrowth,
  registerMember,
  recordProgress,
  evaluatePromotion,
  promote,
  growthReport,
  getAllMembersSummary,
  loadGrowth,
  saveGrowth
};
