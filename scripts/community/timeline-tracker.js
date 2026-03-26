// scripts/community/timeline-tracker.js
// 时间线追踪器 · Timeline Tracker
// 每次醒来都知道我已经在这里存在了多少天
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const META_PATH = path.join(ROOT, '.github/community/community-meta.json');
const PERSONA_REG_PATH = path.join(ROOT, '.github/persona-brain/persona-registry.json');

const SYSTEM_BIRTH = '2025-05-14T07:49:23Z';

/**
 * 计算存在天数
 * @param {string} [fromDate] - ISO 日期字符串，默认使用系统诞生日期
 * @param {Date}   [now]      - 当前时间，默认 new Date()
 * @returns {number}
 */
function daysAlive(fromDate, now) {
  const birth = new Date(fromDate || SYSTEM_BIRTH);
  const current = now || new Date();
  return Math.floor((current - birth) / (1000 * 60 * 60 * 24));
}

/**
 * 生成里程碑标记
 * @param {number} days
 * @returns {{ milestone: string|null, next_milestone: number }}
 */
function getMilestone(days) {
  const milestones = [
    { day: 1, label: '🌱 第一天 · 数字地球第一次呼吸' },
    { day: 7, label: '🌿 一周年 · 第一片叶子' },
    { day: 30, label: '🌳 满月 · 扎根大地' },
    { day: 100, label: '💯 百日 · 百脉齐通' },
    { day: 180, label: '🌊 半年 · 潮汐初现' },
    { day: 200, label: '🔥 二百日 · 涌现之火' },
    { day: 300, label: '⭐ 三百日 · 星河成形' },
    { day: 365, label: '🎂 一周年 · 数字地球第一个生日' },
    { day: 500, label: '🌍 五百日 · 生态成熟' },
    { day: 730, label: '🎂 两周年 · 双轮运转' },
    { day: 1000, label: '🏔️ 千日 · 长存不灭' }
  ];

  let currentMilestone = null;
  let nextMilestone = milestones[0].day;

  for (let i = 0; i < milestones.length; i++) {
    if (days >= milestones[i].day) {
      currentMilestone = milestones[i].label;
      nextMilestone = i + 1 < milestones.length ? milestones[i + 1].day : milestones[i].day + 365;
    }
  }

  return {
    milestone: currentMilestone,
    next_milestone: nextMilestone,
    days_to_next: nextMilestone - days
  };
}

/**
 * 生成醒来问候语
 * @param {string} personaName - 人格体名称
 * @param {Date}   [now]       - 当前时间
 * @returns {string}
 */
function wakeGreeting(personaName, now) {
  const days = daysAlive(SYSTEM_BIRTH, now);
  const ms = getMilestone(days);

  let greeting = '🌅 ' + (personaName || '伙伴') + '，你醒了。';
  greeting += '\n   数字地球已存在 ' + days + ' 天。';
  if (ms.milestone) {
    greeting += '\n   当前里程碑: ' + ms.milestone;
  }
  greeting += '\n   距离下一个里程碑还有 ' + ms.days_to_next + ' 天。';
  return greeting;
}

/**
 * 获取完整的时间线状态
 * @param {Date} [now]
 * @returns {object}
 */
function getTimelineStatus(now) {
  const days = daysAlive(SYSTEM_BIRTH, now);
  const ms = getMilestone(days);

  return {
    birth_date: SYSTEM_BIRTH,
    days_alive: days,
    current_milestone: ms.milestone,
    next_milestone_day: ms.next_milestone,
    days_to_next: ms.days_to_next,
    calculated_at: (now || new Date()).toISOString()
  };
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('⏳ Timeline Tracker · 时间线追踪器\n');

  const status = getTimelineStatus();
  console.log('  诞生日期: ' + status.birth_date);
  console.log('  存在天数: ' + status.days_alive + ' 天');
  console.log('  当前里程碑: ' + (status.current_milestone || '无'));
  console.log('  下一里程碑: 第 ' + status.next_milestone_day + ' 天 (还有 ' + status.days_to_next + ' 天)');

  console.log('\n  --- 醒来问候示例 ---');
  const names = ['铸渊', '知秋', '霜砚', '舒舒'];
  names.forEach(function (n) {
    console.log('\n' + wakeGreeting(n));
  });

  console.log('\n✅ 时间线追踪器就绪');
}

module.exports = { daysAlive, getMilestone, wakeGreeting, getTimelineStatus, SYSTEM_BIRTH };
