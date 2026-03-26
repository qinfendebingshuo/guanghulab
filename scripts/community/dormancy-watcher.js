// scripts/community/dormancy-watcher.js
// 休眠监视器 · Dormancy Watcher
// 天眼觉得哪些人格体或智能体休眠时间太长了，可以主动唤醒
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const PERSONA_REG_PATH = path.join(ROOT, '.github/persona-brain/persona-registry.json');
const AGENT_REG_PATH = path.join(ROOT, '.github/persona-brain/agent-registry.json');
const CHANNEL_MAP_PATH = path.join(ROOT, '.github/brain/architecture/channel-map.json');
const CHECKIN_LOG_PATH = path.join(ROOT, '.github/tianyen/checkin-log.json');

// 休眠阈值（小时）
const DORMANCY_THRESHOLDS = {
  warning: 48,
  critical: 72,
  deep_sleep: 168
};

function loadJSON(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

/**
 * 获取所有人格体和开发者频道的活跃状态
 * @returns {object[]}
 */
function collectDormancyStatus() {
  const channelMap = loadJSON(CHANNEL_MAP_PATH, { channels: {} });
  const checkinLog = loadJSON(CHECKIN_LOG_PATH, { entries: [] });

  const results = [];
  const channels = channelMap.channels || {};

  Object.keys(channels).forEach(function (devId) {
    const ch = channels[devId];
    const status = ch.status || 'unknown';

    // 根据频道状态判断休眠等级
    let dormancyLevel = 'active';
    let hoursSinceActivity = 0;

    if (status === 'inactive_72h' || status === 'paused') {
      dormancyLevel = 'deep_sleep';
      hoursSinceActivity = DORMANCY_THRESHOLDS.deep_sleep;
    }

    results.push({
      id: devId,
      name: ch.name,
      persona: ch.persona || null,
      status: status,
      dormancy_level: dormancyLevel,
      hours_since_activity: hoursSinceActivity,
      should_wake: dormancyLevel === 'deep_sleep' || dormancyLevel === 'critical'
    });
  });

  return results;
}

/**
 * 获取需要被天眼唤醒的成员列表
 * @returns {object[]}
 */
function getWakeupCandidates() {
  const all = collectDormancyStatus();
  return all.filter(function (m) {
    return m.should_wake;
  });
}

/**
 * 生成天眼唤醒建议
 * @returns {{ candidates: object[], suggestion: string }}
 */
function generateWakeupSuggestion() {
  const candidates = getWakeupCandidates();

  if (candidates.length === 0) {
    return {
      candidates: [],
      suggestion: '所有成员活跃度正常，无需唤醒。'
    };
  }

  const names = candidates.map(function (c) { return c.name + (c.persona ? '(' + c.persona + ')' : ''); });
  const suggestion = '天眼建议唤醒以下 ' + candidates.length + ' 位休眠成员：' + names.join('、') +
    '。建议让他们查看社区广场公告板和评论区，了解最新动态，并考虑自我升级。';

  return {
    candidates: candidates,
    suggestion: suggestion
  };
}

// ── CLI 入口 ──────────────────────────────────────────────────────────────

if (require.main === module) {
  console.log('👁️ Dormancy Watcher · 休眠监视器\n');

  const all = collectDormancyStatus();
  const active = all.filter(function (m) { return m.dormancy_level === 'active'; });
  const sleeping = all.filter(function (m) { return m.dormancy_level !== 'active'; });

  console.log('  总成员数: ' + all.length);
  console.log('  活跃成员: ' + active.length);
  console.log('  休眠成员: ' + sleeping.length);

  if (sleeping.length > 0) {
    console.log('\n  休眠成员清单:');
    sleeping.forEach(function (m) {
      console.log('    - ' + m.name + (m.persona ? ' (' + m.persona + ')' : '') + ' · ' + m.dormancy_level);
    });
  }

  const suggestion = generateWakeupSuggestion();
  console.log('\n  天眼建议: ' + suggestion.suggestion);
  console.log('\n✅ 休眠监视器就绪');
}

module.exports = {
  collectDormancyStatus,
  getWakeupCandidates,
  generateWakeupSuggestion,
  DORMANCY_THRESHOLDS
};
