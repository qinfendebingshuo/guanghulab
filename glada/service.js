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

const fs = require('fs');
const path = require('path');

// 加载环境变量（独立运行时需要；PM2 由 ecosystem.config.js 加载）
// 优先级：.env.glada → .env.app → .env
const envFiles = [
  path.join(__dirname, '..', '.env'),
  path.join(__dirname, '..', '.env.app'),
  path.join(__dirname, '.env.glada'),
];
for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    const lines = fs.readFileSync(envFile, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        const value = trimmed.substring(idx + 1).trim();
        // 不覆盖已有的环境变量（PM2 设置的优先）
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const express = require('express');

const taskReceiver = require('./task-receiver');
const executionLoop = require('./execution-loop');
const contextBuilder = require('./context-builder');
const notifier = require('./notifier');
const modelRouter = require('./model-router');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.GLADA_PORT || process.env.PORT || '3900', 10);

// ── 共用验证工具 ──────────────────────────────

/**
 * 验证 GLADA 任务ID格式，防止路径注入
 * @param {string} taskId
 * @returns {boolean}
 */
function isValidGladaTaskId(taskId) {
  return /^GLADA-CAB-\d{8}-\d{3}$/.test(taskId);
}

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
  const modelPref = process.env.GLADA_MODEL_PREFERENCE || '(自动选择)';
  console.log(`\n🤖 LLM 配置:`);
  console.log(`  API Key: ${hasApiKey ? '✅ 已配置' : '❌ 未配置'}`);
  console.log(`  Base URL: ${baseUrl}`);
  console.log(`  模型偏好: ${modelPref}`);

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

/**
 * 简易速率限制中间件（内存存储，不需要额外依赖）
 * @param {number} windowMs - 时间窗口（毫秒）
 * @param {number} maxRequests - 窗口内最大请求数
 */
function rateLimit(windowMs, maxRequests) {
  const hits = new Map();

  // 定期清理过期记录
  setInterval(() => {
    const now = Date.now();
    for (const [ip, data] of hits) {
      if (now - data.windowStart > windowMs) {
        hits.delete(ip);
      }
    }
  }, windowMs).unref();

  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!hits.has(ip)) {
      hits.set(ip, { windowStart: now, count: 1 });
      return next();
    }

    const data = hits.get(ip);

    // 窗口过期，重置
    if (now - data.windowStart > windowMs) {
      data.windowStart = now;
      data.count = 1;
      return next();
    }

    data.count++;
    if (data.count > maxRequests) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retry_after_ms: windowMs - (now - data.windowStart)
      });
    }

    next();
  };
}

function startService() {
  const app = express();
  app.use(express.json());

  // 速率限制实例：每分钟 60 次请求
  const apiLimiter = rateLimit(60 * 1000, 60);

  // 健康检查
  app.get('/api/glada/health', apiLimiter, (req, res) => {
    const routerStatus = modelRouter.getStatus();
    res.json({
      status: 'ok',
      service: 'glada',
      version: '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      model_router: {
        initialized: routerStatus.initialized,
        totalModels: routerStatus.totalModels || 0,
        fallback: routerStatus.fallback || false
      }
    });
  });

  // 模型路由器状态（查看已发现的模型和分类）
  app.get('/api/glada/models', apiLimiter, (req, res) => {
    res.json(modelRouter.getStatus());
  });

  // 查看队列状态
  app.get('/api/glada/status', apiLimiter, (req, res) => {
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

  // 提交新任务（API）· 更严格限制（每分钟 10 次）
  const submitLimiter = rateLimit(60 * 1000, 10);
  app.post('/api/glada/submit', submitLimiter, (req, res) => {
    try {
      const spec = req.body;
      if (!spec || !spec.task_id) {
        return res.status(400).json({ error: '缺少 task_id' });
      }

      // 验证 task_id 格式，防止路径注入
      if (!/^CAB-\d{8}-\d{3}$/.test(spec.task_id)) {
        return res.status(400).json({ error: 'task_id 格式无效，应为 CAB-YYYYMMDD-NNN' });
      }

      const gladaTask = taskReceiver.convertToGladaTask(spec);
      const queueDir = taskReceiver.GLADA_QUEUE_DIR;
      fs.mkdirSync(queueDir, { recursive: true });

      // 再次验证生成的 ID 安全性
      const safeId = gladaTask.glada_task_id.replace(/[^A-Za-z0-9_-]/g, '');
      if (safeId !== gladaTask.glada_task_id) {
        return res.status(400).json({ error: '任务ID包含非法字符' });
      }

      fs.writeFileSync(
        path.join(queueDir, `${safeId}.json`),
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
  app.get('/api/glada/task/:taskId', apiLimiter, (req, res) => {
    const taskId = req.params.taskId;

    // 验证 taskId 格式，防止路径注入
    if (!/^GLADA-CAB-\d{8}-\d{3}$/.test(taskId)) {
      return res.status(400).json({ error: '任务ID格式无效' });
    }

    const filePath = path.join(taskReceiver.GLADA_QUEUE_DIR, `${taskId}.json`);
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
  app.get('/api/glada/receipt/:taskId', apiLimiter, (req, res) => {
    const taskId = req.params.taskId;

    // 验证 taskId 格式，防止路径注入
    if (!/^GLADA-CAB-\d{8}-\d{3}$/.test(taskId)) {
      return res.status(400).json({ error: '任务ID格式无效' });
    }

    const receiptPath = path.join(ROOT, 'glada', 'receipts', `${taskId}.json`);
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
    console.log(`   GET  /api/glada/models    模型路由状态`);
    console.log(`   GET  /api/glada/status    队列状态`);
    console.log(`   POST /api/glada/submit    提交任务`);
    console.log(`   GET  /api/glada/task/:id  查看任务`);
    console.log(`   GET  /api/glada/receipt/:id  查看回执`);
    console.log('═'.repeat(50));
    console.log('');
  });

  // 初始化模型路由器（自动发现代理上的可用模型）
  modelRouter.initialize({
    refreshIntervalMs: parseInt(process.env.GLADA_MODEL_REFRESH_MS || '600000', 10)
  }).then(() => {
    console.log('[GLADA] ✅ 模型路由器初始化完成');
  }).catch(err => {
    console.warn(`[GLADA] ⚠️ 模型路由器初始化失败（将使用默认模型）: ${err.message}`);
  });

  // 启动执行循环（模型由 model-router 自动选择，不再硬编码）
  const pollInterval = parseInt(process.env.GLADA_POLL_INTERVAL || '30000', 10);
  executionLoop.startLoop({
    pollIntervalMs: pollInterval,
    model: process.env.GLADA_MODEL_PREFERENCE || null,  // null = 让 model-router 自动选择
    stopOnFailure: process.env.GLADA_STOP_ON_FAILURE !== 'false'
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\n[GLADA] 收到 SIGINT，正在关闭...');
    modelRouter.shutdown();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('\n[GLADA] 收到 SIGTERM，正在关闭...');
    modelRouter.shutdown();
    process.exit(0);
  });
  process.on('uncaughtException', (err) => {
    console.error('[GLADA] 未捕获异常:', err.message);
    console.error('[GLADA] 堆栈:', err.stack);
  });
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[GLADA] 未处理的 Promise 拒绝（进程保活）:', reason);
  });
}
