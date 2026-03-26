/**
 * 天眼配额守卫中间件
 * 拦截所有 API 调用请求，检查配额后放行或拒绝
 *
 * 指令：ZY-AGEOS-TOWER-2026-0326-001
 * 版权：国作登字-2026-A-00037559
 */

const fs = require('fs');
const path = require('path');

const QUOTA_CONFIG_PATH = path.join(__dirname, '..', 'skyeye', 'guards', 'quota-guard.json');
const QUOTA_LOG_PATH = path.join(__dirname, '..', '.github', 'persona-brain', 'quota-daily.json');

let _quotaConfig = null;

function getQuotaConfig() {
  if (!_quotaConfig) {
    _quotaConfig = JSON.parse(fs.readFileSync(QUOTA_CONFIG_PATH, 'utf8'));
  }
  return _quotaConfig;
}

function loadDailyQuota() {
  const today = new Date().toISOString().split('T')[0];
  try {
    const data = JSON.parse(fs.readFileSync(QUOTA_LOG_PATH, 'utf8'));
    if (data.date === today) return data;
  } catch (e) {
    // File missing or corrupted — will reset to fresh daily quota
  }

  return {
    date: today,
    total_used: 0,
    by_member: {},
    by_tier: { P0: 0, P1: 0, P2: 0 }
  };
}

function saveDailyQuota(daily) {
  const dir = path.dirname(QUOTA_LOG_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(QUOTA_LOG_PATH, JSON.stringify(daily, null, 2));
}

function getTier(devId) {
  const config = getQuotaConfig();
  for (const [tier, tierConfig] of Object.entries(config.priority_tiers)) {
    if (tierConfig.members && tierConfig.members.includes(devId)) return tier;
  }
  return null; // unknown developer — not in any tier
}

function checkQuota(devId) {
  const config = getQuotaConfig();
  const daily = loadDailyQuota();
  const tier = getTier(devId);

  if (!tier) {
    return {
      allowed: false,
      reason: '开发者 ' + devId + ' 未注册到任何配额层级',
      suggestion: '请联系管理员将你添加到配额层级中'
    };
  }

  const tierConfig = config.priority_tiers[tier];

  const totalDaily = config.quota_pool.daily_total;

  // If daily_total is not yet configured, allow through
  if (totalDaily === 'auto-detect' || typeof totalDaily !== 'number') {
    return { allowed: true, remaining: -1, note: 'quota pool daily_total not yet configured' };
  }

  // Calculate tier allocation
  const tierAllocation = Math.floor(totalDaily * tierConfig.allocation_percent / 100);
  const tierUsed = daily.by_tier[tier] || 0;

  if (tierUsed >= tierAllocation) {
    return {
      allowed: false,
      reason: `${tier} 层级今日配额已耗尽（${tierUsed}/${tierAllocation}）`,
      suggestion: tier === 'P2' ? '请等待次日刷新或联系冰朔' : '请联系冰朔调整配额'
    };
  }

  // Per-member cap check
  const memberCount = tierConfig.members ? tierConfig.members.length : 1;
  const perMemberCap = Math.floor(tierAllocation / memberCount);
  const memberUsed = daily.by_member[devId] || 0;

  if (memberUsed >= perMemberCap) {
    return {
      allowed: false,
      reason: `你的个人今日配额已耗尽（${memberUsed}/${perMemberCap}）`,
      suggestion: '请等待次日刷新'
    };
  }

  return { allowed: true, remaining: perMemberCap - memberUsed };
}

function recordUsage(devId) {
  const daily = loadDailyQuota();
  const tier = getTier(devId);

  daily.total_used = (daily.total_used || 0) + 1;
  daily.by_member[devId] = (daily.by_member[devId] || 0) + 1;
  daily.by_tier[tier] = (daily.by_tier[tier] || 0) + 1;

  saveDailyQuota(daily);
}

function generateDailyReport() {
  const config = getQuotaConfig();
  const daily = loadDailyQuota();
  const totalDaily = config.quota_pool.daily_total;

  const report = {
    date: daily.date,
    total: {
      used: daily.total_used || 0,
      limit: totalDaily,
      percent: totalDaily !== 'auto-detect' && typeof totalDaily === 'number'
        ? Math.round(((daily.total_used || 0) / totalDaily) * 100)
        : 'N/A'
    },
    tiers: {},
    members: daily.by_member || {}
  };

  for (const [tier, tierConfig] of Object.entries(config.priority_tiers)) {
    const tierUsed = daily.by_tier[tier] || 0;
    const allocation = typeof totalDaily === 'number'
      ? Math.floor(totalDaily * tierConfig.allocation_percent / 100)
      : 'N/A';
    report.tiers[tier] = {
      name: tierConfig.name,
      used: tierUsed,
      allocation: allocation,
      percent: typeof allocation === 'number' ? Math.round((tierUsed / allocation) * 100) : 'N/A'
    };
  }

  return report;
}

module.exports = { checkQuota, recordUsage, getTier, loadDailyQuota, generateDailyReport };
