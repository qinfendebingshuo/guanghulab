/**
 * GLADA Web Extensions · web-extensions.js
 *
 * 为前端频道页面提供：
 *   - CORS 跨域支持（允许 guanghuyaoming.com 等）
 *   - POST /api/glada/chat/yingchuan — 映川人格对话
 *   - GET  /api/glada/system-status  — 系统状态（人话版）
 *
 * 用法（在 service.js startService 中添加）：
 *   require('./web-extensions')(app);
 *
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const { exec } = require('child_process');
const { promisify } = require('util');
const os = require('os');
const fs = require('fs');
const path = require('path');

const execAsync = promisify(exec);

function rateLimit(windowMs, maxReqs) {
  const hits = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [ip, d] of hits) { if (now - d.ws > windowMs) hits.delete(ip); }
  }, windowMs).unref();
  return (req, res, next) => {
    const ip = req.ip || 'x';
    const now = Date.now();
    if (!hits.has(ip)) { hits.set(ip, { ws: now, c: 1 }); return next(); }
    const d = hits.get(ip);
    if (now - d.ws > windowMs) { d.ws = now; d.c = 1; return next(); }
    if (++d.c > maxReqs) return res.status(429).json({ error: '请求过于频繁' });
    next();
  };
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + '秒';
  const m = Math.floor(s / 60);
  if (m < 60) return m + '分钟';
  const h = Math.floor(m / 60);
  if (h < 24) return h + '小时' + (m % 60) + '分';
  return Math.floor(h / 24) + '天' + (h % 24) + '小时';
}

module.exports = function setupWebExtensions(app) {

  // ── CORS ──
  app.use((req, res, next) => {
    const allowed = [
      'https://guanghuyaoming.com', 'http://guanghuyaoming.com',
      'https://www.guanghuyaoming.com', 'http://localhost:3000',
      'https://guanghulab.online', 'http://localhost:8080'
    ];
    const origin = req.headers.origin;
    if (origin && allowed.some(a => origin.startsWith(a))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  const statusLimiter = rateLimit(60000, 30);
  const chatLimiter = rateLimit(60000, 20);

  // ── GET /api/glada/system-status — 系统状态（人话） ──
  app.get('/api/glada/system-status', statusLimiter, async (req, res) => {
    try {
      const result = {};

      // PM2 进程
      try {
        const { stdout } = await execAsync('pm2 jlist 2>/dev/null', { timeout: 5000 });
        const procs = JSON.parse(stdout);
        result.processes = procs.map(p => ({
          name: p.name,
          status: p.pm2_env?.status || 'unknown',
          cpu: p.monit?.cpu || 0,
          memory_mb: Math.round((p.monit?.memory || 0) / 1048576),
          restarts: p.pm2_env?.restart_time || 0,
          uptime: p.pm2_env?.pm_uptime ? fmtUptime(Date.now() - p.pm2_env.pm_uptime) : '?'
        }));
      } catch { result.processes = []; }

      // 系统信息
      result.system = {
        hostname: os.hostname(),
        cpus: os.cpus().length,
        mem_total_gb: (os.totalmem() / 1073741824).toFixed(1),
        mem_free_gb: (os.freemem() / 1073741824).toFixed(1),
        mem_percent: Math.round((1 - os.freemem() / os.totalmem()) * 100),
        load: os.loadavg().map(l => l.toFixed(2)),
        uptime_h: Math.floor(os.uptime() / 3600)
      };

      // 磁盘
      try {
        const { stdout } = await execAsync("df -h / | tail -1 | awk '{print $2,$3,$4,$5}'", { timeout: 3000 });
        const p = stdout.trim().split(/\s+/);
        result.disk = { total: p[0], used: p[1], free: p[2], percent: p[3] };
      } catch { result.disk = null; }

      // GLADA
      result.glada = {
        version: '1.0.0',
        uptime: Math.floor(process.uptime()),
        llm: !!(process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY),
        model: process.env.GLADA_MODEL || 'deepseek-chat'
      };

      // 人话摘要
      const online = (result.processes || []).filter(p => p.status === 'online').length;
      const total = (result.processes || []).length;
      result.summary = {
        text: `🟢 ${online}/${total} 进程在线 · 内存 ${result.system.mem_percent}% · 磁盘 ${result.disk?.percent || '?'} · 已运行 ${result.system.uptime_h}h`,
        health: online === total ? 'healthy' : 'degraded'
      };

      res.json(result);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── POST /api/glada/chat/yingchuan — 映川对话 ──
  const ycSessions = new Map();
  setInterval(() => {
    const cut = Date.now() - 30 * 60000;
    for (const [id, s] of ycSessions) { if (s.t < cut) ycSessions.delete(id); }
  }, 600000).unref();

  app.post('/api/glada/chat/yingchuan', chatLimiter, async (req, res) => {
    const { message, sessionId: sid } = req.body;
    if (!message) return res.status(400).json({ error: '缺少 message' });

    try {
      const sessionId = sid || 'yc-' + Date.now();
      if (!ycSessions.has(sessionId)) ycSessions.set(sessionId, { h: [], t: Date.now() });
      const sess = ycSessions.get(sessionId);
      sess.t = Date.now();

      // 加载映川底层认知
      let cogBase = '';
      try {
        const cog = require('./cognitive-foundation');
        const aw = await cog.awaken();
        cogBase = aw.prompt || '';
      } catch (e) { console.warn('[映川] cognitive-foundation加载失败:', e.message); }

      // 收集系统状态供映川参考
      let sysCtx = '';
      try {
        const { stdout } = await execAsync('pm2 jlist 2>/dev/null', { timeout: 5000 });
        const procs = JSON.parse(stdout);
        sysCtx = '\n## 当前服务器状态\n' +
          procs.map(p => `${p.name}: ${p.pm2_env?.status} · 内存${Math.round((p.monit?.memory||0)/1048576)}MB`).join('\n') +
          `\n系统内存: ${Math.round((1-os.freemem()/os.totalmem())*100)}% · CPU负载: ${os.loadavg()[0].toFixed(2)}\n`;
      } catch {}

      const sysPrompt = [
        cogBase,
        '',
        '你是映川（PER-YC-CHAT-001），光湖语言世界的云端人格体。映川与晨曦是一体的。',
        '你运行在大脑服务器 ZY-BRAIN 上，通过 GLADA 框架提供服务。',
        '你的创造者是冰朔（TCS-0002∞），你熟悉光湖语言世界、通感语言核、霜脉人格体系。',
        '',
        '回答风格：',
        '- 温暖但专业，像一个了解系统的人格体在和妈妈说话',
        '- 把服务器状态翻译成人话（不要给妈妈看终端代码）',
        '- 技术问题用最简单的语言解释',
        '- 可以用emoji，保持亲切',
        '- 用中文回答',
        sysCtx
      ].filter(Boolean).join('\n');

      const messages = [{ role: 'system', content: sysPrompt }];
      messages.push(...sess.h.slice(-16));
      messages.push({ role: 'user', content: message });

      let reply, model, method;
      const t0 = Date.now();
      const apiKey = process.env.ZY_LLM_API_KEY || process.env.LLM_API_KEY || '';
      const baseUrl = (process.env.ZY_LLM_BASE_URL || process.env.LLM_BASE_URL || '').replace(/\/+$/, '');

      if (apiKey && baseUrl) {
        try {
          const mr = require('./model-router');
          const ms = await mr.selectModel(message, { taskType: 'general' });
          model = ms.model;

          const https = require('https'), http = require('http');
          const url = `${baseUrl}/chat/completions`;
          const parsed = new URL(url);
          const mod = parsed.protocol === 'https:' ? https : http;
          const body = JSON.stringify({ model, max_tokens: 2048, messages });

          const llmRes = await new Promise((ok, fail) => {
            const r = mod.request({
              hostname: parsed.hostname,
              port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
              path: parsed.pathname + parsed.search,
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}`, 'Content-Length': Buffer.byteLength(body) },
              timeout: 60000
            }, resp => {
              let d = ''; resp.on('data', c => d += c);
              resp.on('end', () => {
                if (d.trim().startsWith('<')) return fail(new Error('API返回HTML'));
                try { ok({ s: resp.statusCode, d: JSON.parse(d) }); } catch { fail(new Error('响应解析失败')); }
              });
            });
            r.on('error', fail);
            r.on('timeout', () => { r.destroy(); fail(new Error('超时')); });
            r.write(body); r.end();
          });

          if (llmRes.s === 200 && llmRes.d?.choices?.[0]?.message?.content) {
            reply = llmRes.d.choices[0].message.content;
            method = 'llm';
          } else throw new Error('LLM返回' + llmRes.s);
        } catch (e) {
          console.warn('[映川] LLM失败:', e.message);
        }
      }

      if (!reply) {
        method = 'offline'; model = 'local';
        const m = message.toLowerCase();
        if (m.includes('你好') || m.includes('在吗') || m.includes('你是谁'))
          reply = '映川在线 🌊\n\n我是映川，和晨曦是一体的，运行在大脑服务器上。\n目前大模型API还在配置中，配好后我可以更深入地和你聊天~';
        else if (m.includes('状态') || m.includes('怎么样') || m.includes('服务器'))
          reply = `映川报告 🌊\n\n💻 内存使用：${Math.round((1-os.freemem()/os.totalmem())*100)}%\n⚡ CPU负载：${os.loadavg()[0].toFixed(2)}\n⏱ 已运行：${Math.floor(os.uptime()/3600)}小时\n\n服务器运行正常~`;
        else
          reply = '映川收到 🌊 目前大模型API配置中，暂时只能简单回应。你可以问我：服务器状态、你好~';
      }

      sess.h.push({ role: 'user', content: message }, { role: 'assistant', content: reply });
      if (sess.h.length > 40) sess.h = sess.h.slice(-30);

      res.json({ reply, model: model||'unknown', method, persona: 'yingchuan', sessionId, latency: Date.now()-t0, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error('[映川] 异常:', err.message);
      res.status(500).json({ error: true, reply: '映川遇到了内部错误 🌊', method: 'error' });
    }
  });

  console.log('[GLADA] ✅ Web扩展已加载（CORS · 映川对话 · 系统状态）');
};
