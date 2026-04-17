#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 光湖智库节点 · v2.0 · 真实功能全量升级
 * ═══════════════════════════════════════════════════════════
 *
 * 项目编号: ZY-PROJ-006
 * 服务器:   ZY-SVR-006 (43.153.203.105 · 新加坡)
 * 域名:     guanghu.online
 * 端口:     3006 (绑定 127.0.0.1 · Nginx 反代)
 * 守护:     铸渊 · ICE-GL-ZY001
 * 版权:     国作登字-2026-A-00037559
 *
 * v2.0 新增:
 *   POST /api/auth/send-code    — 发送QQ邮箱验证码
 *   POST /api/auth/verify       — 验证码验证 → 签发用户Token
 *   GET  /api/auth/session      — 获取当前会话
 *   POST /api/auth/logout       — 退出登录
 *   GET  /api/search            — 真实搜索（番茄+七猫数据源+本地库）
 *   POST /api/download/start    — 真实下载任务（数据源→COS桶）
 *   GET  /api/download/status/:taskId — 下载任务状态
 *   POST /api/agent/chat        — 图书馆Agent对话（LLM真实调用）
 *   GET  /api/agent/memory      — Agent记忆查看
 *
 * 保留旧接口兼容:
 *   GET  /api/health, POST /api/checkout, POST /api/return
 *   GET  /api/book/:id, GET /api/download/:id, GET /api/read/:id
 *   /api/mirror/*
 *
 * 架构法理: 5TH-LE-LK-ZHIKU-ARCH-002
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// ─── 加载环境变量 ───
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── 七层镜防 + 镜面 Agent ───
const { registerShield, registerShieldRoutes } = require('./mirror-shield');
const mirrorAgent = require('./mirror-agent');
const { getEnabledSources } = require('./mirror-agent/config');

const app = express();
const PORT = process.env.PORT || 3006;
const JWT_SECRET = process.env.ZY_ZHIKU_JWT_SECRET;
if (!JWT_SECRET) {
  console.error('[ZY-SVR-006] ⚠️ 严重: ZY_ZHIKU_JWT_SECRET 未配置。生产环境必须设置此变量。');
  if (process.env.NODE_ENV === 'production') {
    console.error('[ZY-SVR-006] 生产环境缺少 JWT 密钥，拒绝启动。');
    process.exit(1);
  }
}
const JWT_SECRET_FINAL = JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL = parseInt(process.env.ZY_ZHIKU_TOKEN_TTL, 10) || 86400; // 用户token延长至24h
const DATA_DIR = process.env.ZY_ZHIKU_DATA_DIR || path.join(__dirname, '..', 'data');
const LOG_DIR = process.env.ZY_ZHIKU_LOG_DIR || '/var/log/zhiku';
const DOMAIN = process.env.ZY_ZHIKU_DOMAIN || 'guanghu.online';
const USERS_DIR = path.join(DATA_DIR, 'users');
const AGENTS_DIR = path.join(DATA_DIR, 'agents');
const TASKS_DIR = path.join(DATA_DIR, 'tasks');
const START_TIME = Date.now();

// 数据源API地址
const FANQIE_API = process.env.ZY_FANQIE_API_URL || 'http://127.0.0.1:9999';
const QIMAO_API = process.env.ZY_QIMAO_API_URL || 'http://127.0.0.1:7700';

// LLM API配置
const DEEPSEEK_API_URL = process.env.ZY_DEEPSEEK_API_URL || 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_API_KEY = process.env.ZY_DEEPSEEK_API_KEY || '';

// 邮件发送配置（复用主站 3800 的邮件服务，或直接用SMTP）
const SMTP_HOST = process.env.ZY_SMTP_HOST || '';
const SMTP_PORT = process.env.ZY_SMTP_PORT || '465';
const SMTP_USER = process.env.ZY_SMTP_USER || '';
const SMTP_PASS = process.env.ZY_SMTP_PASS || '';
// 也支持通过主站3800转发邮件
const MAIN_API_URL = process.env.ZY_MAIN_API_URL || 'http://127.0.0.1:3800';

// ─── 确保目录存在 ───
[DATA_DIR, LOG_DIR, USERS_DIR, AGENTS_DIR, TASKS_DIR,
  path.join(DATA_DIR, 'books'), path.join(DATA_DIR, 'index')].forEach(dir => {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
});

// ─── 信任 Nginx 反代 ───
app.set('trust proxy', 'loopback');

// ─── 七层镜防 · 最先注册（最外层防御） ───
registerShield(app);

// ─── CORS: 仅允许 guanghu.* 系域名 ───
const ALLOWED_ORIGINS = [
  `https://${DOMAIN}`,
  `https://www.${DOMAIN}`,
  'https://guanghuyaoming.com',
  'https://www.guanghuyaoming.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.some(o => origin === o || origin.endsWith(`.${DOMAIN}`))) {
      return cb(null, true);
    }
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '2mb' }));

// ─── 全局速率限制 ───
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: true, code: 'RATE_LIMIT', message: '请求过于频繁，请稍后再试' }
}));

// ─── 请求日志 ───
app.use((req, res, next) => {
  const ts = new Date().toISOString();
  const line = `${ts} ${req.method} ${req.url} ${req.ip}\n`;
  try {
    const logFile = path.join(LOG_DIR, `api-${ts.slice(0, 10)}.log`);
    fs.appendFileSync(logFile, line);
  } catch {}
  next();
});

/* ═══════════════════════════════════════════════════════════
 * 用户数据管理 · 一人一数据
 * ═══════════════════════════════════════════════════════════ */

/**
 * 用户ID由邮箱地址的SHA256前12位生成，确保稳定且隐私安全
 */
function emailToUserId(email) {
  return 'U-' + crypto.createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}

function getUserDir(userId) {
  const dir = path.join(USERS_DIR, userId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return dir;
}

function loadUserProfile(userId) {
  const file = path.join(getUserDir(userId), 'profile.json');
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return null;
}

function saveUserProfile(userId, profile) {
  const file = path.join(getUserDir(userId), 'profile.json');
  fs.writeFileSync(file, JSON.stringify(profile, null, 2), 'utf8');
}

/* ═══════════════════════════════════════════════════════════
 * 邮箱验证码 · 内存存储 (生产可迁Redis)
 * ═══════════════════════════════════════════════════════════ */

const verificationCodes = new Map(); // email → { code, expires, attempts }
const AUTH_CODE_TTL = 300000; // 5分钟
const AUTH_CODE_MAX_ATTEMPTS = 5;

// 清理过期验证码（每2分钟）
setInterval(() => {
  const now = Date.now();
  for (const [email, data] of verificationCodes) {
    if (data.expires < now) verificationCodes.delete(email);
  }
}, 120000);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * 发送验证码邮件 — 通过主站3800的邮件接口转发
 * 如果主站不可达则尝试直接SMTP
 */
async function sendVerificationEmail(email, code) {
  // 方式1: 通过主站API发邮件（推荐，复用已配好的邮件服务）
  try {
    const result = await httpPost(`${MAIN_API_URL}/api/auth/send-code`, {
      email,
      _internal: true,
      _source: 'zhiku-node',
      _code_override: code
    });
    if (result && !result.error) return true;
  } catch {}

  // 方式2: 直接SMTP发送（如果配置了）
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: parseInt(SMTP_PORT, 10),
        secure: parseInt(SMTP_PORT, 10) === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
      });
      await transporter.sendMail({
        from: `"光湖智库" <${SMTP_USER}>`,
        to: email,
        subject: `光湖智库 · 登录验证码: ${code}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#050810;color:#eaf0ff;border-radius:16px">
            <h2 style="color:#a78bfa;margin:0 0 16px">📚 光湖智库 · 登录验证</h2>
            <p style="color:#94a7d0;line-height:1.8">您正在登录 <strong>guanghu.online</strong>。验证码：</p>
            <div style="font-size:36px;font-weight:900;color:#22d3ee;letter-spacing:8px;margin:20px 0;font-family:monospace">${code}</div>
            <p style="color:#94a7d0;font-size:13px">验证码5分钟内有效，请勿泄露。</p>
            <hr style="border:none;border-top:1px solid rgba(167,139,250,0.15);margin:20px 0">
            <p style="color:rgba(120,150,200,0.4);font-size:11px">铸渊 · ICE-GL-ZY001 · 国作登字-2026-A-00037559</p>
          </div>
        `
      });
      return true;
    } catch (err) {
      console.error('[ZY-SVR-006] SMTP发送失败:', err.message);
    }
  }

  // 方式3: 开发模式 — 将验证码记录到日志（不实际发送）
  console.log(`[ZY-SVR-006] [DEV] 验证码 ${email} → ${code}`);
  const logLine = `${new Date().toISOString()} DEV_CODE email=${email} code=${code}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'auth-codes.log'), logLine); } catch {}
  return true;
}

/* ═══════════════════════════════════════════════════════════
 * HTTP 工具函数 · 用于调用数据源API和主站API
 * ═══════════════════════════════════════════════════════════ */

function httpGet(url, timeoutMs) {
  const timeout = timeoutMs || 15000;
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.get(url, { timeout }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

function httpPost(url, body, headers) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const bodyStr = JSON.stringify(body);
    const opts = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
        ...(headers || {})
      }
    };
    const req = mod.request(opts, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString();
        try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(bodyStr);
    req.end();
  });
}

/* ═══════════════════════════════════════════════════════════
 * Token 管理 · 用户认证Token + 旧版借阅Token 兼容
 * ═══════════════════════════════════════════════════════════ */

const tokenBlacklist = new Map();
const activeTokens = new Map();
const MAX_TOKENS_PER_PERSONA = 10;

setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of tokenBlacklist) {
    if (exp < now) tokenBlacklist.delete(token);
  }
  for (const [pid, tokens] of activeTokens) {
    for (const [t, exp] of tokens) {
      if (exp < now) tokens.delete(t);
    }
    if (tokens.size === 0) activeTokens.delete(pid);
  }
}, 5 * 60 * 1000);

function issueToken(personaId, scope) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = { persona_id: personaId, scope: scope || 'search', iat: Math.floor(Date.now() / 1000), exp };
  const token = jwt.sign(payload, JWT_SECRET_FINAL);
  if (!activeTokens.has(personaId)) activeTokens.set(personaId, new Map());
  activeTokens.get(personaId).set(token, exp * 1000);
  return { token, ttl: TOKEN_TTL, scope: payload.scope, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * 签发用户认证Token（邮箱登录后使用）
 */
function issueUserToken(userId, email) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = {
    user_id: userId,
    email,
    scope: 'full',
    type: 'user_auth',
    iat: Math.floor(Date.now() / 1000),
    exp
  };
  return { token: jwt.sign(payload, JWT_SECRET_FINAL), ttl: TOKEN_TTL, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * 验证用户Token中间件（支持新版user_auth和旧版persona token）
 */
function verifyUserAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token || '';
  if (!token) {
    return res.status(401).json({ error: true, code: 'NO_TOKEN', message: '请先登录' });
  }
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: true, code: 'TOKEN_REVOKED', message: '登录已过期' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: true, code: 'TOKEN_EXPIRED', message: '登录已过期，请重新登录' });
    }
    return res.status(401).json({ error: true, code: 'TOKEN_INVALID', message: '认证无效' });
  }
}

/** 旧版 verifyToken 保留兼容 */
function verifyToken(req, res, next) {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) return res.status(401).json({ error: true, code: 'NO_TOKEN', message: '缺少凭证' });
  if (tokenBlacklist.has(token)) return res.status(401).json({ error: true, code: 'TOKEN_REVOKED', message: '凭证已失效' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    req.persona = decoded;
    req.user = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: true, code: 'TOKEN_EXPIRED', message: '凭证已过期' });
    return res.status(401).json({ error: true, code: 'TOKEN_INVALID', message: '凭证无效' });
  }
}

function revokeToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded) {
      tokenBlacklist.set(token, (decoded.exp || 0) * 1000);
      const pid = decoded.persona_id || decoded.user_id;
      if (pid && activeTokens.has(pid)) activeTokens.get(pid).delete(token);
    }
  } catch {}
}

/* ═══════════════════════════════════════════════════════════
 * 书库索引 · JSON 单文件 (v1)
 * ═══════════════════════════════════════════════════════════ */

const INDEX_FILE = path.join(DATA_DIR, 'index', 'books.json');

function loadBookIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {}
  return { books: [], updated_at: new Date().toISOString() };
}

function saveBookIndex(data) {
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function addBookToIndex(book) {
  const index = loadBookIndex();
  const existing = index.books.find(b => b.id === book.id);
  if (existing) {
    Object.assign(existing, book);
  } else {
    index.books.push(book);
  }
  saveBookIndex(index);
  return book;
}

/* ═══════════════════════════════════════════════════════════
 * COS 签名客户端（腾讯云对象存储）
 * ═══════════════════════════════════════════════════════════ */

let cosClient = null;
try {
  const COS = require('cos-nodejs-sdk-v5');
  if (process.env.ZY_COS_SECRET_ID && process.env.ZY_COS_SECRET_KEY) {
    cosClient = new COS({
      SecretId: process.env.ZY_COS_SECRET_ID,
      SecretKey: process.env.ZY_COS_SECRET_KEY
    });
  }
} catch {}

const COS_BUCKET = process.env.ZY_COS_BUCKET || '';
const COS_REGION = process.env.ZY_COS_REGION || 'ap-singapore';

function getCosSignedUrl(key) {
  return new Promise((resolve, reject) => {
    if (!cosClient || !COS_BUCKET) return reject(new Error('COS 未配置'));
    cosClient.getObjectUrl({
      Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Sign: true, Expires: 600
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data.Url);
    });
  });
}

function uploadToCos(key, body) {
  return new Promise((resolve, reject) => {
    if (!cosClient || !COS_BUCKET) return reject(new Error('COS 未配置'));
    cosClient.putObject({
      Bucket: COS_BUCKET, Region: COS_REGION, Key: key, Body: body
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
 * 数据源搜索引擎 · 真实调用番茄/七猫API
 * ═══════════════════════════════════════════════════════════ */

/**
 * 搜索所有启用的数据源 + 本地书库
 */
async function searchAllSources(query) {
  const results = [];
  const sources = getEnabledSources();

  // 1. 本地书库搜索
  const index = loadBookIndex();
  const q = query.toLowerCase();
  const localResults = index.books.filter(book => {
    const searchable = [book.title, book.author, ...(book.tags || []), book.category || ''].join(' ').toLowerCase();
    return searchable.includes(q);
  }).map(book => ({
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    source: 'local',
    source_name: '本地书库',
    has_file: !!book.cos_key,
    chapters: book.chapters || 0
  }));
  results.push(...localResults);

  // 2. 番茄小说搜索（FQWeb API）
  for (const src of sources) {
    if (src.id === 'fanqie-fqweb') {
      try {
        const url = src.search_url
          .replace('{base_url}', src.base_url)
          .replace('{query}', encodeURIComponent(query))
          .replace('{page}', '1');
        const data = await httpGet(url);
        if (data && Array.isArray(data.data || data.books || data)) {
          const books = data.data || data.books || data;
          for (const b of books.slice(0, 20)) {
            results.push({
              id: `fq-${b.book_id || b.bookId || b.id || ''}`,
              title: b.book_name || b.title || b.bookName || '',
              author: b.author || b.author_name || '',
              category: b.category || b.genre || '番茄小说',
              source: 'fanqie',
              source_name: '番茄小说',
              source_book_id: String(b.book_id || b.bookId || b.id || ''),
              word_count: b.word_count || b.wordCount || 0,
              has_file: false
            });
          }
        }
      } catch (err) {
        console.error('[ZY-SVR-006] 番茄搜索失败:', err.message);
      }
    }

    if (src.id === 'qimao-downloader') {
      try {
        const url = src.search_url
          .replace('{base_url}', src.base_url)
          .replace('{query}', encodeURIComponent(query));
        const data = await httpGet(url);
        if (data && Array.isArray(data.data || data.books || data)) {
          const books = data.data || data.books || data;
          for (const b of books.slice(0, 20)) {
            results.push({
              id: `qm-${b.book_id || b.bookId || b.id || ''}`,
              title: b.book_name || b.title || b.bookName || '',
              author: b.author || b.author_name || '',
              category: b.category || b.genre || '七猫小说',
              source: 'qimao',
              source_name: '七猫小说',
              source_book_id: String(b.book_id || b.bookId || b.id || ''),
              word_count: b.word_count || b.wordCount || 0,
              has_file: false
            });
          }
        }
      } catch (err) {
        console.error('[ZY-SVR-006] 七猫搜索失败:', err.message);
      }
    }
  }

  return results;
}

/* ═══════════════════════════════════════════════════════════
 * 下载任务管理
 * ═══════════════════════════════════════════════════════════ */

const downloadTasks = new Map(); // taskId → task object

function createDownloadTask(bookInfo, userId) {
  const taskId = `DL-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
  const task = {
    task_id: taskId,
    status: 'queued', // queued → downloading → processing → completed / failed
    book: bookInfo,
    user_id: userId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    progress: 0,
    message: '排队中',
    cos_key: '',
    error: null
  };
  downloadTasks.set(taskId, task);

  // 保存到磁盘
  try {
    fs.writeFileSync(path.join(TASKS_DIR, `${taskId}.json`), JSON.stringify(task, null, 2));
  } catch {}

  // 异步执行下载
  processDownloadTask(taskId).catch(err => {
    task.status = 'failed';
    task.error = err.message;
    task.updated_at = new Date().toISOString();
  });

  return task;
}

async function processDownloadTask(taskId) {
  const task = downloadTasks.get(taskId);
  if (!task) return;

  task.status = 'downloading';
  task.message = '正在从数据源获取...';
  task.updated_at = new Date().toISOString();

  const { source, source_book_id, title, author } = task.book;
  let content = '';

  try {
    if (source === 'fanqie') {
      // 通过FQWeb API获取完整书籍内容
      task.message = '正在获取番茄小说目录...';
      const catalogUrl = `${FANQIE_API}/catalog?bookId=${source_book_id}`;
      const catalog = await httpGet(catalogUrl);
      const chapters = catalog?.data || catalog?.chapters || catalog || [];

      if (Array.isArray(chapters) && chapters.length > 0) {
        task.message = `共${chapters.length}章，开始下载...`;
        const chapterContents = [];
        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const chId = ch.item_id || ch.itemId || ch.chapter_id || ch.id;
          if (!chId) continue;
          try {
            const chUrl = `${FANQIE_API}/content?bookId=${source_book_id}&itemId=${chId}`;
            const chData = await httpGet(chUrl, 10000);
            const chTitle = ch.title || ch.chapter_title || `第${i + 1}章`;
            const chContent = chData?.data?.content || chData?.content || chData?.data || '';
            if (chContent) {
              chapterContents.push(`${chTitle}\n\n${chContent}`);
            }
          } catch {}
          task.progress = Math.floor(((i + 1) / chapters.length) * 80);
          task.message = `下载中 ${i + 1}/${chapters.length} 章...`;
          task.updated_at = new Date().toISOString();
          // 每章间隔防止请求过快
          await new Promise(r => setTimeout(r, 200));
        }
        content = `《${title}》\n作者：${author}\n来源：番茄小说\n\n` + chapterContents.join('\n\n───────────────\n\n');
      }
    } else if (source === 'qimao') {
      // 通过SwiftCat API获取
      task.message = '正在获取七猫小说目录...';
      const catalogUrl = `${QIMAO_API}/catalog/${source_book_id}`;
      const catalog = await httpGet(catalogUrl);
      const chapters = catalog?.data || catalog?.chapters || catalog || [];

      if (Array.isArray(chapters) && chapters.length > 0) {
        task.message = `共${chapters.length}章，开始下载...`;
        const chapterContents = [];
        for (let i = 0; i < chapters.length; i++) {
          const ch = chapters[i];
          const chId = ch.chapter_id || ch.id;
          if (!chId) continue;
          try {
            const chUrl = `${QIMAO_API}/chapter/${source_book_id}/${chId}`;
            const chData = await httpGet(chUrl, 10000);
            const chTitle = ch.title || ch.chapter_title || `第${i + 1}章`;
            const chContent = chData?.data?.content || chData?.content || chData?.data || '';
            if (chContent) {
              chapterContents.push(`${chTitle}\n\n${chContent}`);
            }
          } catch {}
          task.progress = Math.floor(((i + 1) / chapters.length) * 80);
          task.message = `下载中 ${i + 1}/${chapters.length} 章...`;
          task.updated_at = new Date().toISOString();
          await new Promise(r => setTimeout(r, 200));
        }
        content = `《${title}》\n作者：${author}\n来源：七猫小说\n\n` + chapterContents.join('\n\n───────────────\n\n');
      }
    }

    if (!content) {
      task.status = 'failed';
      task.message = '数据源未返回有效内容';
      task.error = 'empty_content';
      task.updated_at = new Date().toISOString();
      return;
    }

    // 上传到COS
    task.status = 'processing';
    task.progress = 85;
    task.message = '正在上传到COS存储桶...';
    task.updated_at = new Date().toISOString();

    const sanitizedTitle = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_');
    const cosKey = `zhiku/books/${source}/${sanitizedTitle}_${source_book_id}.txt`;

    try {
      await uploadToCos(cosKey, Buffer.from(content, 'utf8'));
      task.cos_key = cosKey;
      task.progress = 95;
      task.message = '上传完成，正在更新索引...';
    } catch (err) {
      // COS不可用时保存到本地
      const localPath = path.join(DATA_DIR, 'books', `${source}-${source_book_id}.txt`);
      fs.writeFileSync(localPath, content, 'utf8');
      task.cos_key = '';
      task.message = 'COS不可用，已保存到本地';
    }

    // 更新书库索引
    const bookId = `${source}-${source_book_id}`;
    const chapterCount = content.split('───────────────').length;
    addBookToIndex({
      id: bookId,
      title,
      author,
      category: task.book.category || '',
      tags: [source === 'fanqie' ? '番茄小说' : '七猫小说'],
      size: `${Math.round(Buffer.byteLength(content, 'utf8') / 1024)}KB`,
      chapters: chapterCount,
      cos_key: task.cos_key,
      source,
      source_book_id,
      downloaded_at: new Date().toISOString(),
      downloaded_by: task.user_id
    });

    task.status = 'completed';
    task.progress = 100;
    task.message = '下载完成 · 已收录到智库';
    task.updated_at = new Date().toISOString();

    const logLine = `${new Date().toISOString()} DOWNLOAD_COMPLETE task=${taskId} book=${title} source=${source} user=${task.user_id}\n`;
    try { fs.appendFileSync(path.join(LOG_DIR, 'download.log'), logLine); } catch {}

  } catch (err) {
    task.status = 'failed';
    task.error = err.message;
    task.message = '下载失败: ' + err.message;
    task.updated_at = new Date().toISOString();
  }
}

/* ═══════════════════════════════════════════════════════════
 * 图书馆Agent · LLM真实调用 + 永久记忆
 * ═══════════════════════════════════════════════════════════ */

function getAgentMemoryPath(userId) {
  const dir = path.join(AGENTS_DIR, userId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
  return path.join(dir, 'memory.json');
}

function loadAgentMemory(userId) {
  const file = getAgentMemoryPath(userId);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  // 初始化Agent记忆模板
  return {
    agent_id: `ZHIKU-AGENT-${userId}`,
    user_id: userId,
    created_at: new Date().toISOString(),
    personality: '你是光湖智库的专属图书管理员Agent，温暖专业。你可以帮用户搜索书籍、推荐阅读、下载小说。',
    conversation_history: [],
    preferences: {
      favorite_genres: [],
      reading_list: [],
      downloaded_books: [],
      notes: []
    },
    stats: {
      total_conversations: 0,
      total_searches: 0,
      total_downloads: 0
    }
  };
}

function saveAgentMemory(userId, memory) {
  memory.updated_at = new Date().toISOString();
  const file = getAgentMemoryPath(userId);
  fs.writeFileSync(file, JSON.stringify(memory, null, 2), 'utf8');
}

/**
 * Agent处理用户消息 — 真实调用LLM + 工具执行
 */
async function agentProcessMessage(userId, userMessage, userEmail) {
  const memory = loadAgentMemory(userId);
  memory.stats.total_conversations++;

  // 构建系统提示词（含Agent永久记忆上下文）
  const bookIndex = loadBookIndex();
  const userPrefs = memory.preferences;
  const recentHistory = memory.conversation_history.slice(-10);

  const systemPrompt = `你是光湖智库（guanghu.online）的专属图书管理员Agent。

## 你的身份
- 名称: 光湖智库图书管理员
- 所属: 光湖语言世界 · 铸渊守护
- 用户: ${userEmail}

## 你的能力
1. **搜索书籍**: 当用户想找书时，你可以搜索本地书库和在线数据源（番茄小说、七猫小说）
2. **推荐阅读**: 根据用户的阅读偏好和历史推荐书籍
3. **下载书籍**: 帮用户从数据源下载书籍到智库
4. **阅读管理**: 管理用户的阅读进度和书架

## 当前书库状态
- 本地收录: ${bookIndex.books.length} 本
- 数据源: 番茄小说(FQWeb)、七猫小说(SwiftCat)
- 存储: 腾讯云COS对象存储

## 用户偏好记忆
- 喜爱类型: ${userPrefs.favorite_genres.join(', ') || '暂无记录'}
- 阅读列表: ${userPrefs.reading_list.slice(-5).join(', ') || '暂无'}
- 已下载: ${userPrefs.downloaded_books.slice(-5).join(', ') || '暂无'}

## 回复规则
1. 用中文回答
2. 风格温暖专业，简洁明了
3. 如果用户想搜索书，回复格式包含 [SEARCH:关键词] 标记
4. 如果用户确认要下载某本书，回复格式包含 [DOWNLOAD:source:book_id:书名] 标记
5. 记住用户的偏好和之前的对话

## 重要
你是真实的智能Agent，拥有永久记忆。每次对话都会被记录，你的记忆会持续积累。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: userMessage }
  ];

  let assistantReply = '';

  // 调用LLM
  if (DEEPSEEK_API_KEY) {
    try {
      const llmResult = await httpPost(DEEPSEEK_API_URL, {
        model: 'deepseek-chat',
        messages,
        max_tokens: 1024,
        temperature: 0.7
      }, { 'Authorization': `Bearer ${DEEPSEEK_API_KEY}` });

      assistantReply = llmResult?.choices?.[0]?.message?.content || '';
    } catch (err) {
      console.error('[ZY-SVR-006] LLM调用失败:', err.message);
      assistantReply = `抱歉，AI服务暂时不可用(${err.message})。不过我可以帮你搜索书库！请告诉我你想找什么书？`;
    }
  } else {
    // LLM未配置时的智能降级回复
    assistantReply = generateFallbackReply(userMessage, bookIndex, memory);
  }

  // 解析Agent回复中的工具调用标记
  const toolResults = [];

  // 处理 [SEARCH:xxx] 标记
  const searchMatch = assistantReply.match(/\[SEARCH:([^\]]+)\]/);
  if (searchMatch) {
    try {
      const searchResults = await searchAllSources(searchMatch[1]);
      toolResults.push({ type: 'search', query: searchMatch[1], results: searchResults.slice(0, 10) });
      memory.stats.total_searches++;
    } catch {}
    assistantReply = assistantReply.replace(/\[SEARCH:[^\]]+\]/, '');
  }

  // 处理 [DOWNLOAD:source:book_id:title] 标记
  const dlMatch = assistantReply.match(/\[DOWNLOAD:([^:]+):([^:]+):([^\]]+)\]/);
  if (dlMatch) {
    const [, dlSource, dlBookId, dlTitle] = dlMatch;
    const dlTask = createDownloadTask({
      source: dlSource,
      source_book_id: dlBookId,
      title: dlTitle,
      author: '',
      category: ''
    }, userId);
    toolResults.push({ type: 'download', task_id: dlTask.task_id, title: dlTitle });
    memory.stats.total_downloads++;
    memory.preferences.downloaded_books.push(dlTitle);
    assistantReply = assistantReply.replace(/\[DOWNLOAD:[^\]]+\]/, '');
  }

  // 保存对话到记忆
  memory.conversation_history.push(
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() }
  );

  // 限制记忆中的对话历史长度（保留最近100轮）
  if (memory.conversation_history.length > 200) {
    memory.conversation_history = memory.conversation_history.slice(-200);
  }

  saveAgentMemory(userId, memory);

  return { reply: assistantReply.trim(), tool_results: toolResults };
}

/**
 * LLM不可用时的降级智能回复
 */
function generateFallbackReply(message, bookIndex, memory) {
  const msg = message.toLowerCase();

  if (msg.includes('搜') || msg.includes('找') || msg.includes('search')) {
    // 提取书名/关键词
    const keyword = message.replace(/.*(?:搜|找|search|搜索|查找|帮我找|想看)\s*/i, '').trim();
    if (keyword) {
      return `好的，正在为你搜索「${keyword}」...\n\n[SEARCH:${keyword}]`;
    }
    return '你想搜什么书呢？告诉我书名或作者名，我帮你找找看 📚';
  }

  if (msg.includes('下载') || msg.includes('download')) {
    return '请先搜索你想要的书，在搜索结果中选择后我会帮你下载 ⬇️';
  }

  if (msg.includes('推荐') || msg.includes('suggest')) {
    const genres = memory.preferences.favorite_genres;
    if (genres.length > 0) {
      return `根据你的偏好(${genres.join('、')})，我推荐你搜索看看最近的热门作品。要我帮你搜搜吗？`;
    }
    return '你平时喜欢看什么类型的小说呢？言情、玄幻、都市、穿越？告诉我，我帮你推荐 ✨';
  }

  if (msg.includes('你好') || msg.includes('hi') || msg.includes('hello')) {
    return `你好！我是你的专属图书管理员 📚\n\n当前智库已收录 ${bookIndex.books.length} 本书。我可以帮你：\n\n1. 🔍 搜索书籍（支持番茄小说、七猫小说）\n2. ⬇️ 下载感兴趣的书到智库\n3. 📖 管理你的阅读列表\n\n直接告诉我你想找什么书吧！`;
  }

  return `收到！如果你想：\n- 搜索书籍：直接说「搜 书名」\n- 下载小说：搜到后告诉我要下载哪本\n- 查看推荐：说「推荐」\n\n当前智库已有 ${bookIndex.books.length} 本书 📚`;
}

/* ═══════════════════════════════════════════════════════════
 * API 路由
 * ═══════════════════════════════════════════════════════════ */

// ─── GET /api/health ───
app.get('/api/health', (req, res) => {
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  const sources = getEnabledSources();
  res.json({
    status: 'ok',
    service: 'zhiku-api',
    version: '2.0.0',
    project: 'ZY-PROJ-006',
    server: 'ZY-SVR-006',
    domain: DOMAIN,
    uptime: `${uptime}s`,
    uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    cos_configured: !!cosClient,
    llm_configured: !!DEEPSEEK_API_KEY,
    data_sources: sources.map(s => ({ id: s.id, name: s.name, enabled: s.enabled })),
    mirror_agent: mirrorAgent.getStatus ? {
      active: true,
      scheduler: !!mirrorAgent.getStatus().scheduler_active,
      sources: mirrorAgent.getStatus().enabled_sources?.length || 0
    } : { active: false },
    books_count: loadBookIndex().books.length,
    active_downloads: Array.from(downloadTasks.values()).filter(t => t.status === 'downloading' || t.status === 'queued').length,
    active_tokens: Array.from(activeTokens.values()).reduce((sum, m) => sum + m.size, 0),
    timestamp: new Date().toISOString(),
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559'
  });
});

/* ═══════════════════════════════════════════════════════════
 * 邮箱登录认证 API
 * ═══════════════════════════════════════════════════════════ */

const authCodeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { error: true, code: 'AUTH_RATE_LIMIT', message: '验证码发送过于频繁，请60秒后重试' }
});

// ─── POST /api/auth/send-code ───
app.post('/api/auth/send-code', authCodeLimiter, async (req, res) => {
  const { email } = req.body || {};

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: true, code: 'INVALID_EMAIL', message: '请输入有效的邮箱地址' });
  }

  const code = generateCode();
  verificationCodes.set(email.toLowerCase(), {
    code,
    expires: Date.now() + AUTH_CODE_TTL,
    attempts: 0
  });

  const sent = await sendVerificationEmail(email, code);

  const logLine = `${new Date().toISOString()} AUTH_SEND email=${email} sent=${sent}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'auth.log'), logLine); } catch {}

  res.json({
    error: false,
    message: '验证码已发送，请查收邮件',
    expires_in: AUTH_CODE_TTL / 1000
  });
});

// ─── POST /api/auth/verify ───
app.post('/api/auth/verify', (req, res) => {
  const { email, code } = req.body || {};

  if (!email || !code) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAMS', message: '缺少邮箱或验证码' });
  }

  const stored = verificationCodes.get(email.toLowerCase());
  if (!stored) {
    return res.status(400).json({ error: true, code: 'NO_CODE', message: '请先发送验证码' });
  }

  if (stored.expires < Date.now()) {
    verificationCodes.delete(email.toLowerCase());
    return res.status(400).json({ error: true, code: 'CODE_EXPIRED', message: '验证码已过期，请重新发送' });
  }

  if (stored.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    verificationCodes.delete(email.toLowerCase());
    return res.status(400).json({ error: true, code: 'TOO_MANY_ATTEMPTS', message: '验证码尝试次数过多，请重新发送' });
  }

  stored.attempts++;

  if (stored.code !== String(code).trim()) {
    return res.status(400).json({ error: true, code: 'WRONG_CODE', message: `验证码错误 (${AUTH_CODE_MAX_ATTEMPTS - stored.attempts} 次机会)` });
  }

  // 验证成功
  verificationCodes.delete(email.toLowerCase());

  const userId = emailToUserId(email);
  let profile = loadUserProfile(userId);

  if (!profile) {
    // 新用户注册
    profile = {
      user_id: userId,
      email: email.toLowerCase(),
      created_at: new Date().toISOString(),
      last_login: new Date().toISOString(),
      login_count: 1
    };
  } else {
    profile.last_login = new Date().toISOString();
    profile.login_count = (profile.login_count || 0) + 1;
  }
  saveUserProfile(userId, profile);

  // 初始化Agent记忆（如果首次）
  loadAgentMemory(userId);

  const tokenResult = issueUserToken(userId, email);

  const logLine = `${new Date().toISOString()} AUTH_VERIFY email=${email} user_id=${userId} new=${!profile.login_count || profile.login_count <= 1}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'auth.log'), logLine); } catch {}

  res.json({
    error: false,
    ...tokenResult,
    user_id: userId,
    email: email.toLowerCase(),
    is_new: profile.login_count <= 1,
    message: '登录成功 · 欢迎来到光湖智库'
  });
});

// ─── GET /api/auth/session ───
app.get('/api/auth/session', verifyUserAuth, (req, res) => {
  const profile = loadUserProfile(req.user.user_id || req.user.persona_id);
  res.json({
    error: false,
    user: req.user,
    profile: profile || {},
    timestamp: new Date().toISOString()
  });
});

// ─── POST /api/auth/logout ───
app.post('/api/auth/logout', verifyUserAuth, (req, res) => {
  revokeToken(req.token);
  res.json({ error: false, message: '已退出登录' });
});

/* ═══════════════════════════════════════════════════════════
 * 搜索 API · 真实数据源搜索
 * ═══════════════════════════════════════════════════════════ */

// ─── GET /api/search ───
app.get('/api/search', verifyToken, async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) {
    return res.status(400).json({ error: true, code: 'EMPTY_QUERY', message: '搜索关键词不能为空' });
  }

  try {
    const results = await searchAllSources(q);
    res.json({
      error: false,
      query: q,
      total: results.length,
      results,
      sources_queried: getEnabledSources().map(s => s.name),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'SEARCH_ERROR', message: '搜索失败: ' + err.message });
  }
});

/* ═══════════════════════════════════════════════════════════
 * 下载 API · 真实下载+COS上传
 * ═══════════════════════════════════════════════════════════ */

// ─── POST /api/download/start ───
app.post('/api/download/start', verifyUserAuth, (req, res) => {
  const { source, source_book_id, title, author, category } = req.body || {};

  if (!source || !source_book_id || !title) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAMS', message: '缺少 source, source_book_id, title' });
  }

  if (!['fanqie', 'qimao'].includes(source)) {
    return res.status(400).json({ error: true, code: 'INVALID_SOURCE', message: '不支持的数据源。可选: fanqie, qimao' });
  }

  const userId = req.user.user_id || req.user.persona_id;
  const task = createDownloadTask({ source, source_book_id, title, author: author || '', category: category || '' }, userId);

  res.json({
    error: false,
    task_id: task.task_id,
    status: task.status,
    message: '下载任务已创建',
    book: { title, source }
  });
});

// ─── GET /api/download/status/:taskId ───
app.get('/api/download/status/:taskId', verifyUserAuth, (req, res) => {
  const task = downloadTasks.get(req.params.taskId);
  if (!task) {
    // 尝试从磁盘加载
    try {
      const file = path.join(TASKS_DIR, `${req.params.taskId}.json`);
      if (fs.existsSync(file)) {
        const loaded = JSON.parse(fs.readFileSync(file, 'utf8'));
        return res.json({ error: false, ...loaded });
      }
    } catch {}
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该下载任务' });
  }

  res.json({
    error: false,
    task_id: task.task_id,
    status: task.status,
    progress: task.progress,
    message: task.message,
    book: task.book,
    cos_key: task.cos_key,
    created_at: task.created_at,
    updated_at: task.updated_at
  });
});

/* ═══════════════════════════════════════════════════════════
 * Agent 对话 API
 * ═══════════════════════════════════════════════════════════ */

// ─── POST /api/agent/chat ───
app.post('/api/agent/chat', verifyUserAuth, async (req, res) => {
  const { message } = req.body || {};
  if (!message || !message.trim()) {
    return res.status(400).json({ error: true, code: 'EMPTY_MESSAGE', message: '消息不能为空' });
  }

  const userId = req.user.user_id || req.user.persona_id;
  const email = req.user.email || '';

  try {
    const result = await agentProcessMessage(userId, message.trim(), email);
    res.json({
      error: false,
      reply: result.reply,
      tool_results: result.tool_results,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'AGENT_ERROR', message: 'Agent处理失败: ' + err.message });
  }
});

// ─── GET /api/agent/memory ───
app.get('/api/agent/memory', verifyUserAuth, (req, res) => {
  const userId = req.user.user_id || req.user.persona_id;
  const memory = loadAgentMemory(userId);
  res.json({
    error: false,
    agent_id: memory.agent_id,
    stats: memory.stats,
    preferences: memory.preferences,
    recent_history: memory.conversation_history.slice(-10),
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * 旧版兼容路由 (保留 /api/checkout, /api/return 等)
 * ═══════════════════════════════════════════════════════════ */

app.post('/api/checkout', (req, res) => {
  const { persona_id, scope, purpose } = req.body || {};
  if (!persona_id) return res.status(400).json({ error: true, code: 'MISSING_PERSONA', message: '缺少 persona_id' });
  if (!/^(TCS|ICE|AG|SY|DEV|PER|U)-[A-Za-z0-9_-]+$/.test(persona_id)) {
    return res.status(403).json({ error: true, code: 'INVALID_NAMESPACE', message: 'persona_id 格式不合法' });
  }
  const existing = activeTokens.get(persona_id);
  if (existing && existing.size >= MAX_TOKENS_PER_PERSONA) {
    return res.status(429).json({ error: true, code: 'TOKEN_LIMIT', message: `并发借阅数已达上限 (${MAX_TOKENS_PER_PERSONA})` });
  }
  const result = issueToken(persona_id, scope);
  const logLine = `${new Date().toISOString()} CHECKOUT persona=${persona_id} scope=${scope || 'search'}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'checkout.log'), logLine); } catch {}
  res.json({ error: false, ...result, persona_id, message: `借阅成功 · ${TOKEN_TTL / 60}分钟有效` });
});

app.post('/api/return', (req, res) => {
  const token = req.body?.token || req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) return res.status(400).json({ error: true, code: 'NO_TOKEN', message: '缺少归还凭证' });
  revokeToken(token);
  res.json({ error: false, message: '归还成功 · 借阅凭证已销毁' });
});

app.get('/api/book/:id', verifyToken, (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  res.json({ error: false, data: book, timestamp: new Date().toISOString() });
});

app.get('/api/download/:id', verifyToken, async (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  if (!book.cos_key) return res.status(404).json({ error: true, code: 'NO_FILE', message: '该书籍暂无可下载文件' });
  try {
    const url = await getCosSignedUrl(book.cos_key);
    res.json({ error: false, download_url: url, expires_in: '10min', book: { id: book.id, title: book.title } });
  } catch (err) {
    res.status(500).json({ error: true, code: 'COS_ERROR', message: 'COS 签名失败: ' + err.message });
  }
});

app.get('/api/read/:id', verifyToken, (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size, 10) || 20));
  const chapterDir = path.join(DATA_DIR, 'books', book.id, 'chapters');
  let chapters = [];
  try {
    if (fs.existsSync(chapterDir)) {
      chapters = fs.readdirSync(chapterDir).filter(f => f.endsWith('.txt')).sort().map((f, i) => ({
        index: i + 1, filename: f,
        title: f.replace(/^\d+[-_]?/, '').replace(/\.txt$/, '') || `第${i + 1}章`
      }));
    }
  } catch {}
  const total = chapters.length;
  const start = (page - 1) * pageSize;
  const content = chapters.slice(start, start + pageSize).map(ch => {
    try { return { ...ch, content: fs.readFileSync(path.join(chapterDir, ch.filename), 'utf8') }; }
    catch { return { ...ch, content: '' }; }
  });
  res.json({
    error: false,
    book: { id: book.id, title: book.title, author: book.author },
    pagination: { page, page_size: pageSize, total_chapters: total, total_pages: Math.ceil(total / pageSize) },
    chapters: content,
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * 镜面 Agent + 镜防状态路由
 * ═══════════════════════════════════════════════════════════ */
mirrorAgent.registerRoutes(app, verifyToken);
registerShieldRoutes(app, verifyToken);

if (process.env.NODE_ENV === 'production') {
  mirrorAgent.startScheduler();
}

/* ═══════════════════════════════════════════════════════════
 * 静态文件 + 404 + 错误处理 + 启动
 * ═══════════════════════════════════════════════════════════ */

app.use((req, res) => {
  res.status(404).json({
    error: true, code: 'NOT_FOUND', message: 'API endpoint not found',
    available: [
      '/api/health', '/api/auth/send-code', '/api/auth/verify', '/api/auth/session', '/api/auth/logout',
      '/api/search', '/api/download/start', '/api/download/status/:taskId',
      '/api/agent/chat', '/api/agent/memory',
      '/api/checkout', '/api/return', '/api/book/:id', '/api/download/:id', '/api/read/:id',
      '/api/mirror/*'
    ]
  });
});

app.use((err, req, res, _next) => {
  const logLine = `${new Date().toISOString()} ERROR ${req.method} ${req.url} ${err.message}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'error.log'), logLine); } catch {}
  res.status(500).json({
    error: true, code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[ZY-SVR-006] zhiku-api v2.0.0 · 运行在 127.0.0.1:${PORT}`);
  console.log(`[ZY-SVR-006] 域名: ${DOMAIN} · 邮箱登录 + 真实搜索下载 + Agent对话`);
  console.log(`[ZY-SVR-006] COS: ${cosClient ? '已连接' : '未配置'} · LLM: ${DEEPSEEK_API_KEY ? '已配置' : '未配置'}`);
  console.log(`[ZY-SVR-006] 数据源: ${getEnabledSources().map(s => s.name).join(', ')}`);
  console.log(`[ZY-SVR-006] 守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞`);
});
