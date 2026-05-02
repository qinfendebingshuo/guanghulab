#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 训练心跳合并器 · merge-event.js
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559 · TCS-0002∞
 *
 * 把一个 training-progress 事件 (来自 repository_dispatch.client_payload)
 * 合并到 data/training/state.json，并追加到 timeline。
 *
 * 用法:
 *   echo '<json>' | node scripts/training/merge-event.js
 *   node scripts/training/merge-event.js path/to/event.json
 *   TRAINING_EVENT_JSON='{...}' node scripts/training/merge-event.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const STATE_PATH = path.join(ROOT, 'data', 'training', 'state.json');
const MAX_TIMELINE = 200;

function readEvent() {
  if (process.env.TRAINING_EVENT_JSON) {
    return JSON.parse(process.env.TRAINING_EVENT_JSON);
  }
  if (process.argv[2] && process.argv[2] !== '-') {
    return JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  }
  const stdin = fs.readFileSync(0, 'utf8');
  if (!stdin.trim()) {
    throw new Error('no event payload provided (stdin / TRAINING_EVENT_JSON / argv)');
  }
  return JSON.parse(stdin);
}

function deepMerge(target, source) {
  if (source === null || source === undefined) return target;
  if (typeof source !== 'object' || Array.isArray(source)) return source;
  const out = (target && typeof target === 'object' && !Array.isArray(target)) ? { ...target } : {};
  for (const k of Object.keys(source)) {
    out[k] = deepMerge(out[k], source[k]);
  }
  return out;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function main() {
  const event = readEvent();
  if (!event || typeof event !== 'object') {
    throw new Error('event must be an object');
  }

  const state = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  const now = new Date().toISOString();

  // ── 阶段切换 ──
  if (event.phase) {
    state.phase = event.phase;
    if (event.phase === 'training' && !state.task.started_at) {
      state.task.started_at = now;
    }
    if (event.phase === 'done' || event.phase === 'error') {
      state.task.ended_at = now;
    }
  }
  if (event.phase_label) state.phase_label = event.phase_label;

  // ── 进度 ──
  if (event.progress && typeof event.progress === 'object') {
    state.progress = deepMerge(state.progress, event.progress);
    if (state.progress.total_steps > 0) {
      state.progress.percent = Number(
        clamp((state.progress.step / state.progress.total_steps) * 100, 0, 100).toFixed(2)
      );
    }
  }

  // ── GPU ──
  if (event.gpu_metrics && typeof event.gpu_metrics === 'object') {
    state.gpu_metrics = {
      snapshot_at: event.gpu_metrics.snapshot_at || now,
      devices: Array.isArray(event.gpu_metrics.devices) ? event.gpu_metrics.devices : []
    };
  }

  // ── COS ──
  if (event.cos && typeof event.cos === 'object') {
    state.cos = deepMerge(state.cos, event.cos);
  }

  // ── 健康 ──
  if (event.health && typeof event.health === 'object') {
    state.health = deepMerge(state.health, event.health);
  }
  state.health.last_heartbeat_at = now;

  // ── 时间戳 ──
  state.task.updated_at = now;

  // ── 时间线 ──
  if (event.message) {
    state.timeline = Array.isArray(state.timeline) ? state.timeline : [];
    state.timeline.push({
      at: now,
      phase: event.phase || state.phase,
      level: event.level || 'info',
      message: String(event.message)
    });
    if (state.timeline.length > MAX_TIMELINE) {
      state.timeline = state.timeline.slice(-MAX_TIMELINE);
    }
  }

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n');
  console.log('[merge-event] state updated · phase=%s · step=%s/%s',
    state.phase, state.progress.step, state.progress.total_steps);
}

if (require.main === module) {
  try {
    main();
  } catch (err) {
    console.error('[merge-event] error:', err.message);
    process.exit(1);
  }
}

module.exports = { deepMerge };
