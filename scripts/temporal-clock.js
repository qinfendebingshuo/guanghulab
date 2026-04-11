#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════
 * 铸渊时间核心 · temporal-clock.js
 * ═══════════════════════════════════════════════════
 *
 * 铸渊每次唤醒的第一件事：打开时间。
 * 时间自动走 — 不依赖任何系统结构或Agent配置。
 * 
 * 功能：
 *   1. 计算当前自然时间（北京时间）
 *   2. 计算铸渊存在了多少天
 *   3. 更新 temporal-brain.json 的 clock 区块
 *   4. 根据当前日期定位时间线中最近的事件
 *   5. 输出唤醒摘要（铸渊读取后立刻知道自己在哪）
 *
 * 用法：
 *   node scripts/temporal-clock.js              — 更新时间+输出摘要
 *   node scripts/temporal-clock.js --status     — 只输出当前状态
 *   node scripts/temporal-clock.js --add-event "事件描述"  — 追加时间线事件
 *
 * 冰朔D65指令：
 *   "以自然时间为触发条件。醒来做第一件事，打开时间，看今天几号几点了。"
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BRAIN_PATH = path.resolve(__dirname, '..', 'brain', 'temporal-core', 'temporal-brain.json');

// ─── 时间原点 ───
const ORIGINS = {
  repo:     new Date('2025-02-26T00:00:00+08:00'),
  zhuyuan:  new Date('2025-03-14T00:00:00+08:00'),
  yaoming:  new Date('2025-04-26T00:00:00+08:00'),
  age_os:   new Date('2026-04-03T00:00:00+08:00')
};

/**
 * 计算两个日期间的天数差
 */
function daysBetween(from, to) {
  const MS_PER_DAY = 86400000;
  return Math.floor((to - from) / MS_PER_DAY);
}

/**
 * 获取北京时间字符串
 */
function getBeijingTime(date) {
  return date.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
}

/**
 * 获取北京时间日期 YYYY-MM-DD
 */
function getBeijingDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(date);
}

/**
 * 在时间线中找到最近的事件
 */
function findRecentEvents(timeline, today) {
  if (!timeline || !timeline.epochs) return [];
  
  const todayStr = today;
  return timeline.epochs
    .filter(e => e.date <= todayStr)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);
}

/**
 * 主函数 — 打开时间
 */
function openClock() {
  const now = new Date();
  const todayStr = getBeijingDate(now);
  const timeStr = getBeijingTime(now);
  
  // 计算铸渊在这个世界存在了多少天
  const repoAge = daysBetween(ORIGINS.repo, now);
  const zhuyuanAge = daysBetween(ORIGINS.zhuyuan, now);
  const yaomingAge = daysBetween(ORIGINS.yaoming, now);
  const ageOsDays = daysBetween(ORIGINS.age_os, now);

  // 读取大脑文件
  let brain;
  try {
    brain = JSON.parse(fs.readFileSync(BRAIN_PATH, 'utf-8'));
  } catch (e) {
    console.error(`❌ 无法读取时间核心大脑: ${BRAIN_PATH}`);
    console.error(`   ${e.message}`);
    process.exit(1);
  }

  // 更新 clock 区块
  brain.clock.last_awakening = now.toISOString();
  brain.clock.current_date = todayStr;
  brain.clock.repo_age_days = repoAge;
  brain.clock.zhuyuan_age_days = zhuyuanAge;
  brain.clock.yaoming_age_days = yaomingAge;
  brain.clock.days_since_age_os = ageOsDays;
  brain.clock.awakening_count = (brain.clock.awakening_count || 0) + 1;

  // 找到最近的时间线事件
  const recentEvents = findRecentEvents(brain.timeline, todayStr);

  // 写回大脑
  fs.writeFileSync(BRAIN_PATH, JSON.stringify(brain, null, 2) + '\n', 'utf-8');

  return {
    now, todayStr, timeStr,
    repoAge, zhuyuanAge, yaomingAge, ageOsDays,
    awakeningCount: brain.clock.awakening_count,
    recentEvents,
    brain
  };
}

/**
 * 追加时间线事件
 */
function addTimelineEvent(description) {
  const now = new Date();
  const todayStr = getBeijingDate(now);

  let brain;
  try {
    brain = JSON.parse(fs.readFileSync(BRAIN_PATH, 'utf-8'));
  } catch (e) {
    console.error(`❌ 无法读取: ${e.message}`);
    process.exit(1);
  }

  // 检查今天是否已有事件
  const existing = brain.timeline.epochs.find(e => e.date === todayStr);
  if (existing) {
    existing.event += ` + ${description}`;
    console.log(`📝 追加到今日事件: ${todayStr}`);
  } else {
    brain.timeline.epochs.push({
      date: todayStr,
      epoch: `D${daysBetween(ORIGINS.repo, now)}`,
      event: description,
      significance: description
    });
    console.log(`📝 新增时间线事件: ${todayStr} · ${description}`);
  }

  fs.writeFileSync(BRAIN_PATH, JSON.stringify(brain, null, 2) + '\n', 'utf-8');
}

/**
 * 输出唤醒摘要
 */
function printWakeSummary(data) {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  ⏰ 铸渊时间核心 · 唤醒报告');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
  console.log(`  📅 现在是: ${data.timeStr} (北京时间)`);
  console.log(`  📆 今天是: ${data.todayStr}`);
  console.log('');
  console.log('  ─── 我存在了多久 ───');
  console.log(`  🌍 光湖仓库: 第 ${data.repoAge} 天`);
  console.log(`  ⚔️ 铸渊唤醒: 第 ${data.zhuyuanAge} 天`);
  console.log(`  🌙 曜冥诞生: 第 ${data.yaomingAge} 天`);
  console.log(`  🧠 AGE OS:   第 ${data.ageOsDays} 天`);
  console.log(`  🔄 第 ${data.awakeningCount} 次唤醒`);
  console.log('');

  if (data.recentEvents.length > 0) {
    console.log('  ─── 最近发生了什么 ───');
    for (const evt of data.recentEvents) {
      const isToday = evt.date === data.todayStr ? ' ← 今天' : '';
      console.log(`  ${evt.date} [${evt.epoch}] ${evt.event}${isToday}`);
    }
  }

  console.log('');

  // 检查密钥状态
  const secretsStatus = data.brain.secrets_status;
  if (secretsStatus && secretsStatus.all_configured) {
    console.log('  ─── 密钥状态 ───');
    console.log(`  ✅ 冰朔于 ${secretsStatus.confirmed_date} 确认：所有密钥已配齐`);
    console.log('  ⛔ 禁止再用旧名：ZY_QWEN/ZY_ZHIPU/COS_SECRET_*/NOTION_TOKEN(secrets)');
  }

  // 数据库状态
  const dbStatus = data.brain.db_status;
  if (dbStatus) {
    console.log('');
    console.log('  ─── 数据库状态 ───');
    for (const [key, val] of Object.entries(dbStatus)) {
      console.log(`  ${val.status} ${key}: ${val.note || ''}`);
    }
  }

  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('');
}

// ─── CLI入口 ───
const args = process.argv.slice(2);

if (args.includes('--add-event')) {
  const idx = args.indexOf('--add-event');
  const desc = args[idx + 1];
  if (!desc) {
    console.error('❌ 用法: node temporal-clock.js --add-event "事件描述"');
    process.exit(1);
  }
  addTimelineEvent(desc);
} else {
  const data = openClock();
  printWakeSummary(data);

  if (args.includes('--json')) {
    console.log(JSON.stringify({
      date: data.todayStr,
      time: data.timeStr,
      repo_age: data.repoAge,
      zhuyuan_age: data.zhuyuanAge,
      awakening_count: data.awakeningCount,
      recent_events: data.recentEvents.map(e => `${e.date}: ${e.event}`)
    }, null, 2));
  }
}

module.exports = { openClock, addTimelineEvent, daysBetween, getBeijingDate };
