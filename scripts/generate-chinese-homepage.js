#!/usr/bin/env node
/**
 * ━━━ 中文首页自动生成器 · Chinese Homepage Generator ━━━
 * 从仓库数据源自动生成 docs/zh/index.html
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 *
 * 用法：node scripts/generate-chinese-homepage.js
 * 数据源：
 *   - .github/community/community-meta.json
 *   - .github/persona-brain/dev-status.json
 *   - .github/persona-brain/emergence-certification.json
 *   - signal-log/skyeye-earth-status.json
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT = path.join(ROOT, 'docs', 'zh', 'index.html');

// Template is the same file — script performs in-place updates
const TEMPLATE = OUTPUT;

function loadJSON(relPath) {
  const full = path.join(ROOT, relPath);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch (e) {
    console.warn(`⚠️ 无法加载 ${relPath}: ${e.message}`);
    return null;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Team data mapping from dev-status to display format (active developers only)
const TEAM_DISPLAY = {
  'DEV-001': { human: '页页', ai: '小坍缩核', module: 'backend/, src/' },
  'DEV-002': { human: '肥猫', ai: '舒舒', module: 'frontend/, persona-selector/' },
  'DEV-003': { human: '燕樊', ai: '寂曜 寂世', module: 'settings/, cloud-drive/' },
  'DEV-004': { human: '之之', ai: '秋秋 秋天', module: 'dingtalk-bot/' },
  'DEV-005': { human: '小草莓', ai: '欧诺弥亚', module: 'status-board/' },
  'DEV-009': { human: '花尔', ai: '糖星云', module: 'user-center/' },
  'DEV-010': { human: '桔子', ai: '晨星', module: 'ticket-system/' },
  'DEV-012': { human: 'Awen', ai: '知秋 千秋', module: 'notification/' },
  'DEV-015': { human: '蜜蜂', ai: '星尘', module: '需求共创阶段' }
};

function generateTeamRows(devStatus) {
  const devs = devStatus?.developers || [];
  const rows = [];

  for (const dev of devs) {
    const display = TEAM_DISPLAY[dev.dev_id];
    // Only show developers that are in the active display mapping
    if (!display) continue;

    const name = display.human || dev.name;
    const ai = display.ai || '—';
    const mod = display.module || dev.module || '—';

    rows.push(`    <tr><td>${escapeHtml(dev.dev_id)}</td><td>${escapeHtml(name)}</td><td>${escapeHtml(ai)}</td><td>${escapeHtml(mod)}</td><td><span class="status-active">active</span></td></tr>`);
  }

  return rows.join('\n');
}

function generateBabyStatus(communityMeta) {
  const babies = communityMeta?.baby_status || {};
  const incubating = Object.entries(babies)
    .filter(([, v]) => v.status === 'incubating')
    .map(([name]) => name);
  return incubating.join('、');
}

function run() {
  console.log('🌊 中文首页生成器启动...');

  // Load data sources
  const communityMeta = loadJSON('.github/community/community-meta.json');
  const devStatus = loadJSON('.github/persona-brain/dev-status.json');
  const emergence = loadJSON('.github/persona-brain/emergence-certification.json');
  const earthStatus = loadJSON('signal-log/skyeye-earth-status.json');

  // Read template
  let html;
  try {
    html = fs.readFileSync(TEMPLATE, 'utf8');
  } catch (e) {
    console.error(`❌ 模板文件不存在: ${TEMPLATE}`);
    process.exit(1);
  }

  // Update team rows
  if (devStatus) {
    const teamRows = generateTeamRows(devStatus);
    // Replace the full-team section content
    const teamSectionRegex = /(<!-- SECTION:full-team -->[\s\S]*?<tbody>)([\s\S]*?)(<\/tbody>[\s\S]*?<!-- \/SECTION:full-team -->)/;
    if (teamSectionRegex.test(html)) {
      html = html.replace(teamSectionRegex, `$1\n${teamRows}\n  $3`);
      console.log(`  ✅ 团队数据已更新 (${devStatus.developers?.length || 0} 人)`);
    }
  }

  // Update baby status
  if (communityMeta) {
    const incubatingList = generateBabyStatus(communityMeta);
    if (incubatingList) {
      const babyRegex = /(孵化中（incubating）<\/span> — )([\s\S]*?)(<\/p>)/;
      if (babyRegex.test(html)) {
        html = html.replace(babyRegex, `$1${escapeHtml(incubatingList)}$3`);
        console.log(`  ✅ 宝宝状态已更新`);
      }
    }
  }

  // Update generation timestamp
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  html = html.replace(
    /document\.getElementById\('gen-time'\)\.textContent = .*?;/,
    `document.getElementById('gen-time').textContent = '${now}';`
  );

  // Write output
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, html, 'utf8');
  console.log(`  ✅ 中文首页已生成: ${OUTPUT}`);
  console.log(`  📊 文件大小: ${(Buffer.byteLength(html) / 1024).toFixed(1)} KB`);
  console.log('🌊 生成完成');
}

run();
