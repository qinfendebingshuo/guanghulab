// scripts/agents/readme-generator.js
// README Generator · 首页动态布局引擎
// ZY-P1-README-002 · Phase 1 · README Management Agent
// 版权：国作登字-2026-A-00037559

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// ── 皮肤系统 · 情绪驱动界面 ─────────────────────────────────────────────
const SKINS = {
  CALM: { name: '🌊 湖面平静', emoji: ['🌊', '✅', '💎'], badgeColor: 'blue' },
  BUILDING: { name: '⚡ 建设中', emoji: ['⚡', '🔨', '🚧'], badgeColor: 'yellow' },
  ATTENTION: { name: '🔥 需要关注', emoji: ['🔥', '⚠️', '🔧'], badgeColor: 'orange' },
  EMERGENCY: { name: '🚨 紧急状态', emoji: ['🚨', '❌', '🛑'], badgeColor: 'red' },
  CELEBRATION: { name: '🎉 庆祝模式', emoji: ['🎉', '🏆', '✨'], badgeColor: 'brightgreen' }
};

/**
 * 根据系统状态选择皮肤
 * @param {object} systemState
 * @returns {object} skin
 */
function selectSkin(systemState) {
  if (!systemState) return SKINS.CALM;

  // 紧急状态：有高级别告警
  if (systemState.alert && systemState.alert.level === 'high') {
    return SKINS.EMERGENCY;
  }

  // 需要关注：有中级别告警
  if (systemState.alert && systemState.alert.level === 'medium') {
    return SKINS.ATTENTION;
  }

  // 庆祝模式：平衡度完美且有里程碑
  if (systemState.balanced && systemState.milestone) {
    return SKINS.CELEBRATION;
  }

  // 建设中：有活跃开发
  if (systemState.building || (systemState.recentUpdates && systemState.recentUpdates.length > 0)) {
    return SKINS.BUILDING;
  }

  return SKINS.CALM;
}

/**
 * 生成布局排序 · 按优先级排列版块
 * @param {object} systemState
 * @returns {string[]} 排序后的版块名称列表
 */
function generateLayout(systemState) {
  const sections = [];

  // P0: 紧急状态优先
  if (systemState && systemState.alert && systemState.alert.level === 'high') {
    sections.push('critical_alert');
  }

  // P1: 平衡偏差
  if (systemState && !systemState.balanced) {
    sections.push('balance_drift');
  }

  // P2: 最近合并
  if (systemState && systemState.recentUpdates && systemState.recentUpdates.length > 0) {
    sections.push('recent_updates');
  }

  // P3: 常规内容
  sections.push('dashboard', 'twin_balance', 'bulletin');

  return sections;
}

/**
 * 渲染系统仪表板
 * @param {object} state
 * @returns {string} markdown
 */
function renderDashboard(state) {
  const skin = selectSkin(state);
  const now = new Date().toISOString().split('T')[0];

  let md = `## ${skin.emoji[0]} 系统状态\n\n`;
  md += `| 指标 | 状态 |\n`;
  md += `|------|------|\n`;
  md += `| 皮肤 | ${skin.name} |\n`;
  md += `| 更新时间 | ${now} |\n`;

  if (state && state.balance !== undefined) {
    md += `| 平衡度 | ${(state.balance * 100).toFixed(1)}% |\n`;
  }

  if (state && state.alert) {
    md += `| 告警 | ${state.alert.level} - ${state.alert.laggingSide} |\n`;
  }

  return md;
}

/**
 * 渲染双子天平可视化
 * @param {object} state
 * @returns {string} markdown
 */
function renderTwinBalance(state) {
  let md = '## ⚖️ 双子天平\n\n';

  if (!state || !state.metrics) {
    md += '_暂无天平数据_\n';
    return md;
  }

  const left = state.metrics.left || {};
  const right = state.metrics.right || {};

  md += '| 维度 | EXE-Engine | Grid-DB |\n';
  md += '|------|-----------|--------|\n';

  const dims = ['taskCompletion', 'testPassRate', 'codeCoverage', 'securityScore'];
  const dimNames = { taskCompletion: '任务完成', testPassRate: '测试通过', codeCoverage: '代码覆盖', securityScore: '安全扫描' };

  for (const dim of dims) {
    const lv = left.dimensions ? left.dimensions[dim] : 0;
    const rv = right.dimensions ? right.dimensions[dim] : 0;
    const lBar = generateProgressBar(lv);
    const rBar = generateProgressBar(rv);
    md += `| ${dimNames[dim]} | ${lBar} ${(lv * 100).toFixed(0)}% | ${rBar} ${(rv * 100).toFixed(0)}% |\n`;
  }

  md += `\n**综合**: EXE=${left.composite || 0} · GDB=${right.composite || 0} · 平衡度=${state.balance || 0}\n`;

  return md;
}

/**
 * 生成文本进度条
 * @param {number} value - 0~1
 * @returns {string}
 */
function generateProgressBar(value) {
  const filled = Math.round((value || 0) * 10);
  const empty = 10 - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * 渲染公告板
 * @param {object[]} events
 * @returns {string} markdown
 */
function renderBulletin(events) {
  let md = '## 📋 公告板\n\n';

  if (!events || events.length === 0) {
    md += '_暂无公告_\n';
    return md;
  }

  md += '| 时间 | 事件 | 状态 | 处理 |\n';
  md += '|------|------|------|------|\n';

  for (const evt of events.slice(0, 10)) {
    const time = evt.timestamp ? evt.timestamp.split('T')[0] : '-';
    md += `| ${time} | ${evt.event || '-'} | ${evt.status || '-'} | ${evt.handler || '-'} |\n`;
  }

  return md;
}

/**
 * 渲染最近更新
 * @param {object[]} updates
 * @returns {string} markdown
 */
function renderRecentUpdates(updates) {
  let md = '## 📝 最近更新\n\n';

  if (!updates || updates.length === 0) {
    md += '_暂无更新_\n';
    return md;
  }

  for (const u of updates.slice(0, 5)) {
    md += `- ${u.emoji || '📌'} ${u.description || u}\n`;
  }

  return md;
}

/**
 * 生成完整 README
 * @param {object} systemState
 * @returns {string} markdown
 */
function generateReadme(systemState) {
  const state = systemState || {};
  const skin = selectSkin(state);
  const layout = generateLayout(state);

  let md = `# ${skin.emoji[0]} 光湖 · GuangHuLab\n\n`;
  md += `> 数字地球本体论 · Digital Earth Ontology\n`;
  md += `> 版权：国作登字-2026-A-00037559\n\n`;

  for (const section of layout) {
    switch (section) {
      case 'critical_alert':
        md += `## 🚨 紧急告警\n\n`;
        if (state.alert) {
          md += `**${state.alert.level}**: ${state.alert.laggingSide} 落后 · 偏差 ${state.alert.deficit}\n\n`;
          md += `> ${state.alert.recommendation}\n\n`;
        }
        break;
      case 'balance_drift':
        md += `## ⚠️ 平衡偏差\n\n`;
        md += `偏差值: ${state.drift || 0} · 落后侧: ${state.alert ? state.alert.laggingSide : '未知'}\n\n`;
        break;
      case 'dashboard':
        md += renderDashboard(state);
        md += '\n';
        break;
      case 'twin_balance':
        md += renderTwinBalance(state);
        md += '\n';
        break;
      case 'bulletin':
        md += renderBulletin(state.events || []);
        md += '\n';
        break;
      case 'recent_updates':
        md += renderRecentUpdates(state.recentUpdates || []);
        md += '\n';
        break;
    }
  }

  md += '---\n';
  md += `_由 铸渊 (AG-ZY-01) 自动生成 · ${new Date().toISOString().split('T')[0]}_\n`;

  return md;
}

// ── CLI 入口 ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--auto')) {
    // 自动模式：读取天眼数据生成 README
    console.log('📡 README Generator · 自动更新模式\n');

    let state = {};
    const statusPath = path.join(ROOT, '.github/tianyen/twin-status.json');
    const bulletinPath = path.join(ROOT, '.github/tianyen/bulletin-data.json');

    if (fs.existsSync(statusPath)) {
      try {
        state = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
      } catch (_) { /* 忽略解析错误 */ }
    }

    if (fs.existsSync(bulletinPath)) {
      try {
        const bulletin = JSON.parse(fs.readFileSync(bulletinPath, 'utf8'));
        state.events = bulletin.events || [];
      } catch (_) { /* 忽略解析错误 */ }
    }

    state.building = true;
    const readme = generateReadme(state);
    fs.writeFileSync(path.join(ROOT, 'README.md'), readme, 'utf8');
    console.log('✅ README.md 已更新');
  } else {
    console.log('📡 README Generator · 预览模式\n');
    const preview = generateReadme({ building: true });
    console.log(preview);
  }
}

module.exports = {
  SKINS,
  selectSkin,
  generateLayout,
  renderDashboard,
  renderTwinBalance,
  renderBulletin,
  renderRecentUpdates,
  generateReadme,
  generateProgressBar
};
