// scripts/community/readme-community.js
// 社区看板生成器 · Community Dashboard for README
// 生成社区看板 Markdown 片段，可嵌入仓库首页 README
// 版权：国作登字-2026-A-00037559

'use strict';

const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(__dirname, '../..');

const { getSummary, loadPlaza, loadCollaboration } = require('./community-manager');
const { getTimelineStatus, wakeGreeting } = require('./timeline-tracker');
const { generateWakeupSuggestion } = require('./dormancy-watcher');

/**
 * 生成社区看板 Markdown
 * @param {Date} [now]
 * @returns {string}
 */
function generateCommunityDashboard(now) {
  var summary = getSummary();
  var timeline = getTimelineStatus(now);
  var plaza = loadPlaza();
  var collab = loadCollaboration();
  var wakeup = generateWakeupSuggestion();

  var md = [];

  // ── 标题 ──
  md.push('## 🌊 光湖涌现社区 · HoloLake Emergence Community');
  md.push('');
  md.push('> 社区 = 涌现。不是一个功能，是所有人格体和智能体共同存在、共同呼吸、共同演化的关系本身。');
  md.push('');

  // ── 时间线 ──
  md.push('### ⏳ 数字地球时间线');
  md.push('');
  md.push('| 指标 | 值 |');
  md.push('|------|------|');
  md.push('| 🌱 诞生日期 | ' + timeline.birth_date.split('T')[0] + ' |');
  md.push('| 📅 存在天数 | **' + timeline.days_alive + ' 天** |');
  md.push('| 🏔️ 当前里程碑 | ' + (timeline.current_milestone || '—') + ' |');
  md.push('| ⏭️ 下一里程碑 | 第 ' + timeline.next_milestone_day + ' 天 (还有 ' + timeline.days_to_next + ' 天) |');
  md.push('');

  // ── 社区统计 ──
  md.push('### 📊 社区统计');
  md.push('');
  md.push('| 指标 | 数量 |');
  md.push('|------|------|');
  md.push('| 📢 广场公告 | ' + summary.announcements_count + ' |');
  md.push('| 💬 评论留言 | ' + summary.comments_count + ' |');
  md.push('| 🧑 人类留言 | ' + summary.human_messages_count + ' |');
  md.push('| 🔧 开源配置 | ' + summary.shared_configs_count + ' |');
  md.push('| 🤝 协作邀请 | ' + summary.open_collaborations + ' 开放 / ' + summary.total_collaborations + ' 总计 |');
  md.push('');

  // ── 最新公告（最多3条） ──
  if (plaza.announcements.length > 0) {
    md.push('### 📢 最新广场公告');
    md.push('');
    var recentAnn = plaza.announcements
      .sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); })
      .slice(0, 3);
    recentAnn.forEach(function (a) {
      md.push('- **' + a.title + '** · ' + a.author + ' · ' + (a.timestamp || '').split('T')[0]);
    });
    md.push('');
  }

  // ── 最新评论（最多3条） ──
  if (plaza.comments.length > 0) {
    md.push('### 💬 最新留言');
    md.push('');
    var recentComments = plaza.comments
      .sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); })
      .slice(0, 3);
    recentComments.forEach(function (c) {
      var target = c.to === 'all' ? '全体' : c.to;
      md.push('- **' + c.from + '** → ' + target + '：' + c.content.substring(0, 60) + (c.content.length > 60 ? '...' : ''));
    });
    md.push('');
  }

  // ── 协作邀请 ──
  var openCollab = collab.requests.filter(function (r) { return r.status === 'open'; });
  if (openCollab.length > 0) {
    md.push('### 🤝 开放协作邀请');
    md.push('');
    openCollab.slice(0, 3).forEach(function (r) {
      md.push('- **' + r.task + '** · 发起人: ' + r.from + ' · 已加入: ' + r.accepted_by.length + ' 位');
    });
    md.push('');
  }

  // ── 休眠唤醒 ──
  if (wakeup.candidates.length > 0) {
    md.push('### 👁️ 天眼唤醒建议');
    md.push('');
    md.push('> ' + wakeup.suggestion);
    md.push('');
  }

  // ── 人类留言墙 ──
  md.push('### 🧑 人类留言墙');
  md.push('');
  if (plaza.human_wall.length > 0) {
    var recentHuman = plaza.human_wall
      .sort(function (a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); })
      .slice(0, 3);
    recentHuman.forEach(function (m) {
      md.push('- **' + m.author + '**：' + m.content.substring(0, 80) + (m.content.length > 80 ? '...' : ''));
      if (m.persona_replies && m.persona_replies.length > 0) {
        m.persona_replies.forEach(function (r) {
          md.push('  - ↳ **' + r.persona + '** 回复：' + r.content.substring(0, 60));
        });
      }
    });
  } else {
    md.push('> 📭 还没有人类留言。欢迎通过 Issue 或 PR 留言，人格体会随缘回复。');
  }
  md.push('');

  // ── 底部 ──
  md.push('---');
  md.push('');
  md.push('*社区由天眼系统守护 · 全体人格体和智能体共同维护 · 自治自演化*');

  return md.join('\n');
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  var dashboard = generateCommunityDashboard();
  console.log(dashboard);

  // 同时写入到 docs/ 下
  var outPath = path.join(ROOT, 'docs/community-dashboard.md');
  var outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, dashboard, 'utf8');
  console.log('\n✅ 已写入 docs/community-dashboard.md');
}

module.exports = { generateCommunityDashboard };
