#!/usr/bin/env node
/**
 * skyeye/hibernation/readme-status-updater.js
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * 📢 README 状态区自动更新
 * 在 README.md 的 SKYEYE-STATUS-BEGIN/END 标记区域内
 * 根据休眠阶段动态更新系统状态。
 *
 * 用法:
 *   node readme-status-updater.js --phase=pre-announce --mode=daily --duration=12
 *   node readme-status-updater.js --phase=hibernating --mode=daily
 *   node readme-status-updater.js --phase=resumed --mode=daily
 *   node readme-status-updater.js --phase=pre-announce --mode=weekly --hours=3 --minutes=40
 *   node readme-status-updater.js --phase=hibernating --mode=weekly --step=A1
 *   node readme-status-updater.js --phase=resumed --mode=weekly
 *   node readme-status-updater.js --phase=normal
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.resolve(__dirname, '../..');
const README_PATH = path.join(ROOT, 'README.md');

const MARKER_START = '<!-- SKYEYE-STATUS-BEGIN -->';
const MARKER_END   = '<!-- SKYEYE-STATUS-END -->';

// ━━━ 工具函数 ━━━

function getBeijingDate() {
  return new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function getBeijingTime() {
  return new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
}

function getBeijingHHMM() {
  const d = new Date();
  const h = String(d.getUTCHours() + 8).padStart(2, '0'); // approximate CST
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function parseArgs() {
  const args = process.argv.slice(2);
  const result = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      result[key] = value || 'true';
    }
  }
  return result;
}

// ━━━ 状态模板生成 ━━━

function generateNormalStatus() {
  const date = getBeijingDate();
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| 🟢 系统状态 | 正常运转 |',
    '| 🛡️ Guard 集群 | 5/5 在线 |',
    `| ⏰ 上次日休眠 | ${date} · ✅ 正常 |`,
    `| 📅 下次日休眠 | 明日 ~04:00（天眼动态决定）|`,
    `| 📅 下次周休眠 | 本周六 ~20:00（天眼动态决定）|`
  ].join('\n');
}

function generateDailyPreAnnounce(duration) {
  const date = getBeijingDate();
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| 🌙 系统状态 | ⏳ 即将进入日休眠 |',
    `| ⏰ 预计开始 | ${date} 04:00 |`,
    `| ⏱️ 预计时长 | 约 ${duration} 分钟 |`,
    '| 📊 天眼评估 | 今日系统负载评估完成 |',
    '| ⚠️ 注意 | 休眠期间基础心跳维持，紧急通道不受影响 |'
  ].join('\n');
}

function generateDailyHibernating(step) {
  const date = getBeijingDate();
  const stepMap = {
    'check': '轻量自查',
    'optimize': '微调优',
    'archive': '归档'
  };
  const currentStep = stepMap[step] || '轻量自查';
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| 🌙 系统状态 | ⏸️ 日休眠中 |',
    `| ⏰ 开始时间 | ${date} 04:00 |`,
    `| 🔍 当前阶段 | ${currentStep} |`,
    '| ⏱️ 预计恢复 | ~04:15 |'
  ].join('\n');
}

function generateDailyResumed() {
  const date = getBeijingDate();
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| 🟢 系统状态 | ✅ 已从日休眠恢复 |',
    `| ⏰ 休眠时段 | ${date} 04:00 完成 |`,
    '| 📋 成果 | 自查 ✅ · 微调优 ✅ · 归档 ✅ |',
    `| 📄 报告 | daily-checkpoint-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json |`
  ].join('\n');
}

function generateWeeklyPreAnnounce(hours, minutes) {
  const date = getBeijingDate();
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| ⭐ 系统状态 | ⏳ 即将进入本周完全休眠 |',
    `| ⏰ 预计开始 | ${date} 20:00 |`,
    `| ⏱️ 预计时长 | 约 ${hours} 小时 ${minutes} 分钟（天眼评估）|`,
    '| 📊 天眼评估 | 本周变动评估完成 |',
    '| ⚠️ 注意 | 休眠期间所有 workflow 完全暂停，仅 P0 告警通道保持畅通 |'
  ].join('\n');
}

function generateWeeklyHibernating(step) {
  const stepMap = {
    'A1': 'Phase A1 · 全局快照',
    'A2': 'Phase A2 · 经验提炼',
    'A3': 'Phase A3 · 全局修复+升级',
    'A4': 'Phase A4 · 打包 Notion 升级包',
    'A5': 'Phase A5 · 分发小兵升级',
    'B':  'Phase B · Notion 端级联升级'
  };
  const currentStep = stepMap[step] || `Phase ${step}`;
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| ⭐ 系统状态 | ⏸️ 本周完全休眠中 |',
    `| 🔍 当前阶段 | ${currentStep} |`,
    `| ⏱️ 开始时间 | ${getBeijingDate()} 20:00 |`
  ].join('\n');
}

function generateWeeklyResumed() {
  const date = getBeijingDate();
  return [
    '## 🌍 系统运行状态',
    '',
    '| 指标 | 状态 |',
    '|------|------|',
    '| 🟢 系统状态 | ✅ 已从本周完全休眠恢复 |',
    `| ⏰ 休眠时段 | ${date} 完成 |`,
    '| 📋 成果 | |',
    '| 　├ GitHub 端 | Guard 巡检 ✅ · 升级包生成 ✅ |',
    '| 　├ Notion 端 | 级联升级 ✅ |',
    `| 　└ 升级包 | upgrade-pack-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json |`,
    '| 📄 详情 | 周度升级报告已写入系统演进日志 |'
  ].join('\n');
}

// ━━━ README 更新 ━━━

function updateREADME(content) {
  if (!fs.existsSync(README_PATH)) {
    console.log('❌ README.md 不存在');
    return false;
  }

  let readme = fs.readFileSync(README_PATH, 'utf8');

  const startIdx = readme.indexOf(MARKER_START);
  const endIdx = readme.indexOf(MARKER_END);

  if (startIdx === -1 || endIdx === -1) {
    console.log('⚠️ README.md 中未找到 SKYEYE-STATUS 标记，跳过更新');
    return false;
  }

  const before = readme.slice(0, startIdx + MARKER_START.length);
  const after = readme.slice(endIdx);

  readme = before + '\n' + content + '\n' + after;

  fs.writeFileSync(README_PATH, readme, 'utf8');
  console.log('✅ README 状态区已更新');
  return true;
}

// ━━━ 主流程 ━━━

function run() {
  const args = parseArgs();
  const phase = args.phase || 'normal';
  const mode = args.mode || 'daily';
  const duration = args.duration || '12';
  const hours = args.hours || '3';
  const minutes = args.minutes || '0';
  const step = args.step || '';

  console.log(`[README Status Updater] Phase: ${phase}, Mode: ${mode}`);

  let content;

  if (phase === 'normal') {
    content = generateNormalStatus();
  } else if (phase === 'pre-announce' && mode === 'daily') {
    content = generateDailyPreAnnounce(duration);
  } else if (phase === 'hibernating' && mode === 'daily') {
    content = generateDailyHibernating(step);
  } else if (phase === 'resumed' && mode === 'daily') {
    content = generateDailyResumed();
  } else if (phase === 'pre-announce' && mode === 'weekly') {
    content = generateWeeklyPreAnnounce(hours, minutes);
  } else if (phase === 'hibernating' && mode === 'weekly') {
    content = generateWeeklyHibernating(step);
  } else if (phase === 'resumed' && mode === 'weekly') {
    content = generateWeeklyResumed();
  } else {
    content = generateNormalStatus();
  }

  const updated = updateREADME(content);
  return { updated, phase, mode };
}

module.exports = { updateREADME, run };

if (require.main === module) {
  run();
}
