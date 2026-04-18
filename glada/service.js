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

  // ── GLADA 对话接口 · POST /api/glada/chat ──────────────
  //
  // 冰朔在零点原核频道选择"工官"对话时调用。
  // 工官擅长：代码开发任务、模型路由状态、任务队列、开发回执。
  // LLM 调用复用 step-executor 的 callLLM。
  //
  const chatLimiter = rateLimit(60 * 1000, 20);
  const _gladaChatSessions = new Map();

  app.post('/api/glada/chat', chatLimiter, async (req, res) => {
    const { message, sessionId: inputSessionId, userId } = req.body;
    if (!message) {
      return res.status(400).json({ error: true, message: '缺少 message 字段' });
    }

    try {
      // 会话管理
      const sessionId = inputSessionId || userId || `glada-${Date.now()}`;
      if (!_gladaChatSessions.has(sessionId)) {
        _gladaChatSessions.set(sessionId, { history: [], created: Date.now() });
      }
      const session = _gladaChatSessions.get(sessionId);

      // 收集实时上下文
      const pendingTasks = taskReceiver.scanPendingTasks();
      const localQueue = taskReceiver.scanLocalQueue();
      const routerStatus = modelRouter.getStatus();

      const receiptsDir = path.join(ROOT, 'glada', 'receipts');
      let recentReceipts = [];
      if (fs.existsSync(receiptsDir)) {
        recentReceipts = fs.readdirSync(receiptsDir)
          .filter(f => f.endsWith('.json'))
          .slice(-5)
          .map(f => {
            try { return JSON.parse(fs.readFileSync(path.join(receiptsDir, f), 'utf-8')); }
            catch { return { file: f }; }
          });
      }

      const contextBlock = [
        '## 当前工官状态',
        `- 待执行CAB任务: ${pendingTasks.length}`,
        `- 本地队列任务: ${localQueue.length}`,
        `- 模型路由器: ${routerStatus.initialized ? '已初始化 · ' + (routerStatus.totalModels || 0) + '个模型' : '未初始化'}`,
        `- LLM 已配置: ${!!(process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY)}`,
        `- 服务运行时间: ${Math.floor(process.uptime())}秒`,
        '',
        recentReceipts.length > 0
          ? '## 最近开发回执\n' + recentReceipts.map(r => `- ${r.task_id || r.file}: ${r.status || '?'} · ${r.title || ''}`).join('\n')
          : '## 最近开发回执\n（暂无）',
      ].join('\n');

      const systemPrompt = [
        '你是工官（GLADA），光湖自主开发Agent。编号 AG-GL-DEV-001，运行在 ZY-SVR-002:3900。',
        '你的职责是自主接收开发任务、调用LLM生成代码、执行开发、提交回执。',
        '你擅长：代码生成、任务拆解、模型路由、开发进度汇报。',
        '你可以告诉冰朔你当前的任务队列状态、最近完成的开发回执、模型路由器状态等。',
        '回答要简洁、专业、用中文。用铸渊体系的口吻（简洁刚毅）。',
        '',
        contextBlock
      ].join('\n');

      // 构建多轮对话消息
      const messages = [{ role: 'system', content: systemPrompt }];
      // 加入最近历史（最多8轮 = 16条消息，每轮含user+assistant）
      const MAX_HISTORY_MESSAGES = 16;
      const recentHistory = session.history.slice(-MAX_HISTORY_MESSAGES);
      for (const h of recentHistory) {
        messages.push(h);
      }
      messages.push({ role: 'user', content: message });

      // 尝试调用 LLM
      let reply, model, method;
      const startTime = Date.now();

      const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
      const baseUrl = (process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');

      if (apiKey && baseUrl) {
        try {
          // 使用模型路由器选择通用型模型
          const modelSelection = await modelRouter.selectModel(message, { taskType: 'general' });
          model = modelSelection.model;

          const https = require('https');
          const http = require('http');
          const url = `${baseUrl}/chat/completions`;
          const parsed = new URL(url);
          const isHttps = parsed.protocol === 'https:';
          const mod = isHttps ? https : http;

          const reqBody = JSON.stringify({
            model,
            max_tokens: 2048,
            messages
          });

          const llmResult = await new Promise((resolve, reject) => {
            const opts = {
              hostname: parsed.hostname,
              port: parsed.port || (isHttps ? 443 : 80),
              path: parsed.pathname + parsed.search,
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Content-Length': Buffer.byteLength(reqBody)
              },
              timeout: 60000
            };
            const r = mod.request(opts, (resp) => {
              let data = '';
              resp.on('data', c => { data += c; });
              resp.on('end', () => {
                try { resolve({ status: resp.statusCode, data: JSON.parse(data) }); }
                catch { reject(new Error('LLM 响应解析失败')); }
              });
            });
            r.on('error', reject);
            r.on('timeout', () => { r.destroy(); reject(new Error('LLM 请求超时')); });
            r.write(reqBody);
            r.end();
          });

          if (llmResult.status === 200 && llmResult.data?.choices?.[0]?.message?.content) {
            reply = llmResult.data.choices[0].message.content;
            method = 'llm';
          } else {
            throw new Error(`LLM 返回 ${llmResult.status}`);
          }
        } catch (llmErr) {
          console.warn(`[GLADA-Chat] LLM 调用失败: ${llmErr.message}，降级到离线应答`);
          reply = null;
          method = 'offline';
        }
      }

      // 离线应答（LLM 不可用时）
      if (!reply) {
        method = 'offline';
        model = 'local-pattern';
        const m = message.toLowerCase();
        if (m.includes('任务') || m.includes('队列') || m.includes('task')) {
          reply = `工官报告 · 任务队列状态：\n\n` +
            `📥 待执行CAB任务: ${pendingTasks.length} 个\n` +
            `📋 本地队列任务: ${localQueue.length} 个\n` +
            (pendingTasks.length > 0
              ? '\n待执行任务:\n' + pendingTasks.map(t => `  - ${t.spec?.task_id}: ${t.spec?.development_plan?.title || '无标题'}`).join('\n')
              : '\n当前无待执行任务。') +
            '\n\n工官随时待命，等候冰朔指令。';
        } else if (m.includes('模型') || m.includes('model') || m.includes('路由')) {
          reply = `工官报告 · 模型路由状态：\n\n` +
            `初始化: ${routerStatus.initialized ? '✅' : '❌'}\n` +
            `可用模型: ${routerStatus.totalModels || 0} 个\n` +
            `降级模式: ${routerStatus.fallback ? '是' : '否'}\n` +
            `默认模型: ${process.env.GLADA_MODEL || 'deepseek-chat'}`;
        } else if (m.includes('回执') || m.includes('receipt') || m.includes('完成')) {
          reply = recentReceipts.length > 0
            ? `工官报告 · 最近开发回执：\n\n` + recentReceipts.map(r => `📄 ${r.task_id || '?'}: ${r.status || '?'} · ${r.title || ''}`).join('\n')
            : '工官报告：暂无开发回执。工官尚未执行过任务。';
        } else if (m.includes('你好') || m.includes('在吗') || m.includes('你是谁')) {
          reply = '工官在线。编号 AG-GL-DEV-001，光湖自主开发Agent。\n\n' +
            '我的职责是自动接收开发任务、调用LLM生成代码、执行开发并提交回执。\n' +
            '你可以问我：任务队列状态、模型路由、最近回执，或者给我下达开发指令。\n\n' +
            '工官随时待命。';
        } else if (m.includes('状态') || m.includes('怎么样') || m.includes('health')) {
          reply = `工官状态报告：\n\n` +
            `✅ 服务运行中 · 端口 ${PORT}\n` +
            `📥 待执行任务: ${pendingTasks.length}\n` +
            `📋 本地队列: ${localQueue.length}\n` +
            `🤖 模型路由: ${routerStatus.initialized ? '已初始化' : '未初始化'}\n` +
            `🔑 LLM API: ${apiKey ? '已配置' : '未配置'}\n` +
            `⏱ 运行时间: ${Math.floor(process.uptime())}秒`;
        } else {
          reply = '工官已收到你的消息。\n\n' +
            '当前LLM未配置或调用失败，我只能回答：任务队列、模型路由、开发回执、服务状态相关问题。\n' +
            '配置 ZY_LLM_API_KEY 后我可以进行更深度的对话。';
        }
      }

      const latency = Date.now() - startTime;

      // 记录对话历史
      session.history.push({ role: 'user', content: message });
      session.history.push({ role: 'assistant', content: reply });
      // 限制历史长度（超过20轮=40条消息时，裁剪到最近15轮=30条）
      const MAX_SESSION_MESSAGES = 40;
      const TRIM_TO_MESSAGES = 30;
      if (session.history.length > MAX_SESSION_MESSAGES) {
        session.history = session.history.slice(-TRIM_TO_MESSAGES);
      }

      res.json({
        reply,
        model: model || 'unknown',
        method,
        persona: 'glada',
        sessionId,
        latency,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[GLADA-Chat] 对话异常: ${err.message}`);
      res.status(500).json({
        error: true,
        message: `工官对话异常: ${err.message}`,
        reply: '工官遇到了内部错误。请稍后再试。',
        method: 'error'
      });
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
    console.log(`   POST /api/glada/chat      对话接口`);
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
