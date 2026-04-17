#!/usr/bin/env node
/**
 * GLADA · 主服务入口 · service.js
 *
 * 光湖自主开发Agent（GuangHu Lake Autonomous Dev Agent）
 *
 * 功能：
 *   - PM2 常驻服务，24小时运行
 *   - 监听任务队列，自动执行开发任务
 *   - 提供 HTTP API 查询状态
 *   - 支持命令行操作（status / run / submit）
 *
 * 用法：
 *   node glada/service.js              启动 GLADA 服务
 *   node glada/service.js --status     查看系统状态
 *   node glada/service.js --run-once   只执行一个任务就退出
 *   node glada/service.js --submit     提交新任务（JSON 从 stdin）
 *
 * PM2:
 *   pm2 start glada/ecosystem.config.js
 *
 * 版权：国作登字-2026-A-00037559
 * 签发：铸渊 · ICE-GL-ZY001
 */

'use strict';

const express = require('express');
const fs = require('fs');
const path = require('path');

const taskReceiver = require('./task-receiver');
const executionLoop = require('./execution-loop');
const contextBuilder = require('./context-builder');
const notifier = require('./notifier');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.GLADA_PORT || process.env.PORT || '3900', 10);

// ── CLI 模式 ──────────────────────────────────

const args = process.argv.slice(2);

if (args.includes('--status')) {
  showStatus();
  process.exit(0);
}

if (args.includes('--run-once')) {
  runOnce();
} else if (args.includes('--submit')) {
  submitTask();
} else {
  startService();
}

// ── 状态查询 ────────────────────────────────────

function showStatus() {
  console.log('═'.repeat(50));
  console.log('🤖 GLADA · 光湖自主开发Agent · 系统状态');
  console.log('═'.repeat(50));

  // 队列状态
  const pendingTasks = taskReceiver.scanPendingTasks();
  const localQueue = taskReceiver.scanLocalQueue();

  console.log(`\n📥 CAB 待执行任务: ${pendingTasks.length}`);
  for (const t of pendingTasks) {
    console.log(`  - ${t.spec.task_id}: ${t.spec.development_plan?.title || '无标题'}`);
  }

  console.log(`\n📋 本地队列任务: ${localQueue.length}`);
  for (const t of localQueue) {
    console.log(`  - ${t.glada_task_id}: ${t.plan?.title || '无标题'} [${t.status}]`);
  }

  // 回执
  const receiptsDir = path.join(ROOT, 'glada', 'receipts');
  if (fs.existsSync(receiptsDir)) {
    const receipts = fs.readdirSync(receiptsDir).filter(f => f.endsWith('.json'));
    console.log(`\n📄 开发回执: ${receipts.length}`);
    for (const r of receipts.slice(-5)) {
      try {
        const receipt = JSON.parse(fs.readFileSync(path.join(receiptsDir, r), 'utf-8'));
        console.log(`  - ${receipt.task_id}: ${receipt.status} · ${receipt.title}`);
      } catch {
        console.log(`  - ${r}`);
      }
    }
  }

  // LLM 配置
  const hasApiKey = !!(process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY);
  const baseUrl = process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '未配置';
  console.log(`\n🤖 LLM 配置:`);
  console.log(`  API Key: ${hasApiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  Base URL: ${baseUrl}`);

  console.log('');
}

// ── 单次执行 ────────────────────────────────────

async function runOnce() {
  console.log('[GLADA] 单次执行模式...\n');

  await executionLoop.startLoop({
    singleRun: true,
    pollIntervalMs: 1000
  });
}

// ── 提交任务 ────────────────────────────────────

function submitTask() {
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const spec = JSON.parse(input);
      const gladaTask = taskReceiver.convertToGladaTask(spec);

      // 保存到本地队列
      const queueDir = taskReceiver.GLADA_QUEUE_DIR;
      fs.mkdirSync(queueDir, { recursive: true });
      const filePath = path.join(queueDir, `${gladaTask.glada_task_id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(gladaTask, null, 2), 'utf-8');

      console.log(`✅ 任务已提交: ${gladaTask.glada_task_id}`);
      console.log(`   标题: ${gladaTask.plan.title}`);
      console.log(`   步骤数: ${gladaTask.plan.steps.length}`);
    } catch (err) {
      console.error(`❌ 任务提交失败: ${err.message}`);
      process.exit(1);
    }
  });
}

// ── HTTP 服务 + 执行循环 ─────────────────────────

function startService() {
  const app = express();
  app.use(express.json());

  // 健康检查
  app.get('/api/glada/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'glada',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    });
  });

  // 查看队列状态
  app.get('/api/glada/status', (req, res) => {
    const pendingTasks = taskReceiver.scanPendingTasks();
    const localQueue = taskReceiver.scanLocalQueue();

    const receiptsDir = path.join(ROOT, 'glada', 'receipts');
    let receipts = [];
    if (fs.existsSync(receiptsDir)) {
      receipts = fs.readdirSync(receiptsDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try {
            return JSON.parse(fs.readFileSync(path.join(receiptsDir, f), 'utf-8'));
          } catch {
            return { file: f };
          }
        });
    }

    res.json({
      pending_cab_tasks: pendingTasks.length,
      local_queue_tasks: localQueue.length,
      recent_receipts: receipts.slice(-10),
      llm_configured: !!(process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY),
      uptime: process.uptime()
    });
  });

  // 提交新任务（API）
  app.post('/api/glada/submit', (req, res) => {
    try {
      const spec = req.body;
      if (!spec || !spec.task_id) {
        return res.status(400).json({ error: '缺少 task_id' });
      }

      const gladaTask = taskReceiver.convertToGladaTask(spec);
      const queueDir = taskReceiver.GLADA_QUEUE_DIR;
      fs.mkdirSync(queueDir, { recursive: true });
      fs.writeFileSync(
        path.join(queueDir, `${gladaTask.glada_task_id}.json`),
        JSON.stringify(gladaTask, null, 2),
        'utf-8'
      );

      res.json({
        success: true,
        glada_task_id: gladaTask.glada_task_id,
        steps: gladaTask.plan.steps.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // 查看特定任务
  app.get('/api/glada/task/:taskId', (req, res) => {
    const taskId = req.params.taskId;
    const filePath = path.join(taskReceiver.GLADA_QUEUE_DIR, `${taskId}.json`);

    // 也查看已完成
    const completedPath = path.join(taskReceiver.GLADA_QUEUE_DIR, 'completed', `${taskId}.json`);

    for (const fp of [filePath, completedPath]) {
      if (fs.existsSync(fp)) {
        try {
          const task = JSON.parse(fs.readFileSync(fp, 'utf-8'));
          return res.json(task);
        } catch (err) {
          return res.status(500).json({ error: err.message });
        }
      }
    }

    res.status(404).json({ error: `任务不存在: ${taskId}` });
  });

  // 查看开发回执
  app.get('/api/glada/receipt/:taskId', (req, res) => {
    const receiptPath = path.join(ROOT, 'glada', 'receipts', `${req.params.taskId}.json`);
    if (fs.existsSync(receiptPath)) {
      try {
        res.json(JSON.parse(fs.readFileSync(receiptPath, 'utf-8')));
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    } else {
      res.status(404).json({ error: '回执不存在' });
    }
  });

  // 启动 HTTP 服务
  app.listen(PORT, '0.0.0.0', () => {
    console.log('═'.repeat(50));
    console.log('🤖 GLADA · 光湖自主开发Agent · v1.0.0');
    console.log('═'.repeat(50));
    console.log(`📡 HTTP API: http://0.0.0.0:${PORT}`);
    console.log(`📡 端点:`);
    console.log(`   GET  /api/glada/health    健康检查`);
    console.log(`   GET  /api/glada/status    队列状态`);
    console.log(`   POST /api/glada/submit    提交任务`);
    console.log(`   GET  /api/glada/task/:id  查看任务`);
    console.log(`   GET  /api/glada/receipt/:id  查看回执`);
    console.log('═'.repeat(50));
    console.log('');
  });

  // 启动执行循环
  const pollInterval = parseInt(process.env.GLADA_POLL_INTERVAL || '30000', 10);
  executionLoop.startLoop({
    pollIntervalMs: pollInterval,
    model: process.env.GLADA_MODEL || 'deepseek-chat',
    stopOnFailure: process.env.GLADA_STOP_ON_FAILURE !== 'false'
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n[GLADA] 收到 SIGINT，正在关闭...');
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n[GLADA] 收到 SIGTERM，正在关闭...');
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    console.error('[GLADA] 未捕获异常:', err.message);
  });
}
