#!/usr/bin/env node
// scripts/generate-session-summary.js
// 铸渊 · 会话摘要生成器
//
// 在 Notion Agent 巡检前 10 分钟自动运行，生成 latest-summary.json
// 供 Notion 侧「铸渊·桥接巡检引擎」读取
//
// 用法：node scripts/generate-session-summary.js

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TELEMETRY_DIR  = path.join(ROOT, 'persona-telemetry');
const SUMMARY_FILE   = path.join(TELEMETRY_DIR, 'latest-summary.json');
const SYSLOG_INBOX   = path.join(ROOT, 'syslog-inbox');
const DEV_STATUS     = path.join(ROOT, '.github', 'persona-brain', 'dev-status.json');
const STYLE_CONFIG   = path.join(ROOT, '.github', 'persona-brain', 'style-config.json');
const MEMORY_FILE    = path.join(ROOT, '.github', 'persona-brain', 'memory.json');
const TUNING_QUEUE   = path.join(TELEMETRY_DIR, 'tuning-queue');

// ══════════════════════════════════════════════════════════
// 辅助函数
// ══════════════════════════════════════════════════════════

function safeReadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function countFiles(dir, ext) {
  if (!fs.existsSync(dir)) return 0;
  return fs.readdirSync(dir).filter(f => {
    if (ext) return f.endsWith(ext);
    return !f.startsWith('.') && f !== 'README.md';
  }).length;
}

function countPendingTuningOrders() {
  if (!fs.existsSync(TUNING_QUEUE)) return 0;
  return fs.readdirSync(TUNING_QUEUE).filter(f =>
    f.startsWith('TUNE-') && f.endsWith('.json')
  ).length;
}

// ══════════════════════════════════════════════════════════
// 主流程
// ══════════════════════════════════════════════════════════

function generateSummary() {
  const now = new Date().toISOString();

  // 读取开发者状态
  const devStatus = safeReadJSON(DEV_STATUS);
  const activeDevs = devStatus?.team_status
    ?.filter(d => d.status && d.status.includes('🟢'))
    .map(d => d.dev_id) || [];

  // 读取记忆文件
  const memory = safeReadJSON(MEMORY_FILE);

  // 读取风格配置
  const styleConfig = safeReadJSON(STYLE_CONFIG);

  // 统计未处理 SYSLOG
  const syslogCount = countFiles(SYSLOG_INBOX, '.json');

  // 统计待处理微调工单
  const pendingOrders = countPendingTuningOrders();

  // 构建摘要
  const summary = {
    version: '1.0',
    timestamp: now,
    sessions: {
      total_24h: 0,
      active_devs: activeDevs,
      total_messages: 0,
      avg_session_length_min: 0,
    },
    persona_state: {
      active_persona: '铸渊',
      style_profile: '通感语言·守护者',
      style_drift_score: 0.0,
      memory_depth: (memory?.total_selfchecks || 0) + ' selfchecks',
      last_brain_update: memory?.last_updated || now,
    },
    dev_progress: {
      syslog_submitted: syslogCount,
      modules_uploaded: 0,
      issues_raised: 0,
    },
    tuning_status: {
      pending_orders: pendingOrders,
      last_completed: null,
      next_scheduled: pendingOrders > 0 ? 'next-patrol' : null,
    },
    repo_health: {
      hli_coverage: memory?.hli_coverage || '17.6%',
      total_team_members: devStatus?.team_status?.length || 0,
      green_status_count: activeDevs.length,
    },
    alerts: [],
  };

  // 检查是否有开发者连续 72 小时无提交（告警）
  // 此处为占位逻辑，实际需要 git log 分析
  if (devStatus?.team_status) {
    const blocked = devStatus.team_status.filter(d =>
      d.status && d.status.includes('🔴')
    );
    blocked.forEach(d => {
      summary.alerts.push({
        type: 'dev_blocked',
        dev_id: d.dev_id,
        message: d.name + ' 当前状态为阻塞',
      });
    });
  }

  // 确保目录存在
  if (!fs.existsSync(TELEMETRY_DIR)) {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  }

  // 写入文件
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2) + '\n', 'utf8');
  console.log('✅ 会话摘要已生成:', SUMMARY_FILE);
  console.log('   时间:', now);
  console.log('   活跃开发者:', activeDevs.length);
  console.log('   待处理 SYSLOG:', syslogCount);
  console.log('   待处理微调工单:', pendingOrders);
  console.log('   告警数:', summary.alerts.length);
}

// ══════════════════════════════════════════════════════════
// 入口
// ══════════════════════════════════════════════════════════

generateSummary();
