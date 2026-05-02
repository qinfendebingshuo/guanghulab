#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 训练实时仪表盘渲染器 · render-readme.js
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 *
 * 读 data/training/state.json → 渲染 README.md 中
 *   <!-- TRAINING_DASHBOARD_START --> ... <!-- TRAINING_DASHBOARD_END -->
 * 之间的内容。
 *
 * 不修改标记之外的任何内容。
 *
 * 用法:
 *   node scripts/training/render-readme.js          # 写回 README.md
 *   node scripts/training/render-readme.js --dry    # 只输出，不写
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STATE_PATH = path.join(ROOT, 'data', 'training', 'state.json');
const README_PATH = path.join(ROOT, 'README.md');
const START_MARK = '<!-- TRAINING_DASHBOARD_START -->';
const END_MARK = '<!-- TRAINING_DASHBOARD_END -->';

const PHASE_BADGE = {
  idle: '⚪ 等待启动',
  bootstrapping: '🛠️ 环境配置中',
  'downloading-corpus': '📥 下载语料',
  preprocessing: '🔧 数据预处理',
  training: '🔥 训练进行中',
  evaluating: '📊 评估中',
  done: '✅ 训练完成',
  error: '❌ 异常'
};

const HEALTH_BADGE = {
  ok: '🟢 正常',
  warning: '🟡 注意',
  error: '🔴 异常',
  idle: '⚪ 待命'
};

function fmtNum(n, digits = 4) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  if (typeof n !== 'number') return String(n);
  if (Number.isInteger(n)) return n.toLocaleString('en-US');
  return Number(n).toFixed(digits);
}

function fmtDuration(seconds) {
  if (!seconds || seconds < 0) return '—';
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (h > 0) return `${h}h ${m}m ${ss}s`;
  if (m > 0) return `${m}m ${ss}s`;
  return `${ss}s`;
}

function fmtTimestamp(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').replace(/\..*Z$/, ' UTC').replace(/Z$/, ' UTC');
}

function progressBar(percent, width = 24) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  const filled = Math.round((pct / 100) * width);
  return '`' + '█'.repeat(filled) + '░'.repeat(width - filled) + '` ' + pct.toFixed(1) + '%';
}

function renderHeader(state) {
  const phase = PHASE_BADGE[state.phase] || `⚪ ${state.phase}`;
  const health = HEALTH_BADGE[state.health?.status] || '⚪ unknown';
  return [
    '## 🔥 训练实时仪表盘 · ZY-TRAIN-001',
    '',
    `> ${state.task?.name || ''}`,
    `> **基座模型**: \`${state.task?.model_base || '—'}\` · **任务 ID**: \`${state.task?.id || '—'}\``,
    `> **最后更新**: ${fmtTimestamp(state.task?.updated_at)} · **副将心跳**: ${fmtTimestamp(state.health?.last_heartbeat_at)}`,
    '',
    `| 当前阶段 | 健康 | 训练用时 |`,
    `|---------|------|---------|`,
    `| **${phase}** · ${state.phase_label || ''} | **${health}** · ${state.health?.message || ''} | ${fmtDuration(state.progress?.elapsed_seconds)} |`,
    ''
  ].join('\n');
}

function renderProgress(state) {
  const p = state.progress || {};
  const pct = p.total_steps > 0 ? (p.step / p.total_steps) * 100 : (p.percent || 0);
  return [
    '### 📈 训练进度',
    '',
    progressBar(pct),
    '',
    `| 指标 | 值 |`,
    `|------|----|`,
    `| Step | **${fmtNum(p.step)} / ${fmtNum(p.total_steps)}** |`,
    `| Epoch | ${fmtNum(p.epoch)} / ${fmtNum(p.total_epochs)} |`,
    `| Loss | ${fmtNum(p.loss)} |`,
    `| Learning Rate | ${fmtNum(p.learning_rate, 6)} |`,
    `| 吞吐 | ${p.throughput_samples_per_sec ? fmtNum(p.throughput_samples_per_sec, 2) + ' samples/s' : '—'} |`,
    `| 预估剩余 | ${fmtDuration(p.eta_seconds)} |`,
    ''
  ].join('\n');
}

function renderGpu(state) {
  const m = state.gpu_metrics || {};
  if (!Array.isArray(m.devices) || m.devices.length === 0) {
    return [
      '### 🎮 GPU 状态',
      '',
      `> 暂无 GPU 实时数据 · 等待 progress-reporter 心跳。`,
      ''
    ].join('\n');
  }
  const lines = [
    '### 🎮 GPU 状态',
    '',
    `> 采样时间: ${fmtTimestamp(m.snapshot_at)}`,
    '',
    `| GPU | 利用率 | 显存 | 温度 | 功率 |`,
    `|-----|--------|------|------|------|`
  ];
  for (const d of m.devices) {
    lines.push(
      `| ${d.index ?? '?'} · ${d.name || 'V100'} | ${d.util_percent ?? '—'}% | ${d.memory_used_mib ?? '—'} / ${d.memory_total_mib ?? '—'} MiB | ${d.temperature_c ?? '—'}°C | ${d.power_w ?? '—'} W |`
    );
  }
  lines.push('');
  return lines.join('\n');
}

function renderServer(state) {
  const s = state.server || {};
  const c = state.cos || {};
  return [
    '### 🖥️ 服务器 · COS',
    '',
    `| 项 | 值 |`,
    `|----|----|`,
    `| 实例 | \`${s.instance_name || '—'}\` · ${s.instance_type || '—'} |`,
    `| 公网 IP | \`${s.host || '—'}\` |`,
    `| 地域 | ${s.region || '—'} |`,
    `| GPU | ${s.gpu || '—'} |`,
    `| 系统 | ${s.os || '—'} · CUDA ${s.cuda || '—'} · cuDNN ${s.cudnn || '—'} |`,
    `| COS 桶 | \`${c.bucket || '—'}\` (${c.region || '—'}) |`,
    `| 语料文件 | raw=${fmtNum(c.raw_files)} · processed=${fmtNum(c.processed_files)} · checkpoints=${fmtNum(c.checkpoints)} |`,
    ''
  ].join('\n');
}

function renderTimeline(state) {
  const tl = Array.isArray(state.timeline) ? state.timeline : [];
  const recent = tl.slice(-10).reverse();
  const lines = [
    '### 🕐 最近事件（最新 10 条）',
    ''
  ];
  if (recent.length === 0) {
    lines.push('> 暂无事件。', '');
    return lines.join('\n');
  }
  lines.push('| 时间 (UTC) | 阶段 | 等级 | 事件 |', '|-----------|------|------|------|');
  for (const e of recent) {
    const lvl = e.level === 'error' ? '🔴' : e.level === 'warning' ? '🟡' : 'ℹ️';
    const msg = String(e.message || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    lines.push(`| ${fmtTimestamp(e.at)} | ${e.phase || '—'} | ${lvl} | ${msg} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function renderAsk() {
  return [
    '### 💬 问铸渊副将',
    '',
    '> 冰朔可以**直接打开 Issue 问副将**，副将会读 `data/training/state.json` 并回答你「训练正不正常」「卡在哪里」「下一步该做什么」。',
    '',
    '📌 **[点击向副将提问 →](../../issues/new?template=ask-zhuyuan-training.md)**',
    '',
    '> 留言带 `deputy-message-board` 标签即可触发副将自动回复（已有 LLM 多模型降级链）。',
    ''
  ].join('\n');
}

function renderDashboard(state) {
  const updated = state.task?.updated_at ? `· 更新: ${fmtTimestamp(state.task.updated_at)}` : '';
  return [
    `_铸渊副将守护 · ZY-DEPUTY-001 · 服务器动他也动 ${updated}_`,
    '',
    renderHeader(state),
    renderProgress(state),
    renderGpu(state),
    renderServer(state),
    renderTimeline(state),
    renderAsk()
  ].join('\n');
}

function spliceMarkers(readme, body) {
  const startIdx = readme.indexOf(START_MARK);
  const endIdx = readme.indexOf(END_MARK);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`README 中未找到训练仪表盘标记 ${START_MARK} / ${END_MARK}`);
  }
  const before = readme.slice(0, startIdx + START_MARK.length);
  const after = readme.slice(endIdx);
  return `${before}\n\n${body}\n${after}`;
}

function main() {
  const dry = process.argv.includes('--dry');
  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const body = renderDashboard(state);

  if (dry) {
    process.stdout.write(body + '\n');
    return;
  }

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const next = spliceMarkers(readme, body);
  if (next === readme) {
    console.log('[render-readme] no change');
    return;
  }
  fs.writeFileSync(README_PATH, next);
  console.log('[render-readme] README.md updated');
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[render-readme] error:', err.message);
    process.exit(1);
  }
}

module.exports = { renderDashboard, spliceMarkers };
