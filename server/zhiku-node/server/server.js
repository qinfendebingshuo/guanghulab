#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 光湖智库节点 · v2.1 · 书岚人格体 + 守护Agent
 * ═══════════════════════════════════════════════════════════
 *
 * 项目编号: ZY-PROJ-006
 * 服务器:   ZY-SVR-006 (43.153.203.105 · 新加坡)
 * 域名:     guanghu.online
 * 端口:     3006 (绑定 127.0.0.1 · Nginx 反代)
 * 守护:     铸渊 · ICE-GL-ZY001
 * 版权:     国作登字-2026-A-00037559
 *
 * v2.1 新增:
 *   书岚（AG-SL-WEB-001）— 四层人格提示词系统
 *   守护Agent（AG-SL-GUARDIAN-001）— 活的提示词注入代理
 *   聊天工具技能包（AG-SL-TOOLKIT-001）— 视觉化排版工具
 *   搜索结果带「在线阅读」「下载」操作按钮
 *   [REMEMBER:tag] 偏好记忆标记
 *   GET /api/agent/status — 书岚系统状态
 *
 * v2.0:
 *   POST /api/auth/send-code    — 发送QQ邮箱验证码
 *   POST /api/auth/verify       — 验证码验证 → 签发用户Token
 *   GET  /api/auth/session      — 获取当前会话
 *   POST /api/auth/logout       — 退出登录
 *   GET  /api/search            — 真实搜索（番茄+七猫数据源+本地库）
 *   POST /api/download/start    — 真实下载任务（数据源→COS桶）
 *   GET  /api/download/status/:taskId — 下载任务状态
 *   POST /api/agent/chat        — 书岚对话（LLM真实调用）
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

// ─── 书岚 Agent 系统 ───
const shulanAgent = require('./shulan-agent');

// ─── 内置数据源直连（FQWeb/SwiftCat不可用时的fallback · 可选模块） ───
let builtinSource = null;
try {
  builtinSource = require('./builtin-source');
} catch (err) {
  console.warn(`[ZY-SVR-006] ⚠️ builtin-source 模块未找到 (${err.message})。内置直连搜索/下载将不可用，但核心认证/Agent功能不受影响。`);
}

// ─── 铸渊哨兵 · 自动运维Agent（永久记忆 + 书源监测 + 自动修复） ───
let sentinel = null;
try {
  const ZhuyuanSentinel = require('./zhuyuan-sentinel');
  sentinel = new ZhuyuanSentinel({
    dataDir: process.env.ZY_ZHIKU_DATA_DIR || path.join(__dirname, '..', 'data'),
    builtinSource,
    mirrorAgent
  });
  sentinel.init();
} catch (err) {
  console.warn(`[ZY-SVR-006] ⚠️ 铸渊哨兵加载失败 (${err.message})。自动运维功能不可用。`);
}

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
const EXTERNAL_SERVICE_TIMEOUT_MS = 3000; // 外部服务(FQWeb/SwiftCat)超时·内置直连已覆盖时无需等

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

/**
 * 根据邮箱地址自动检测 SMTP 主机
 * QQ邮箱→smtp.qq.com, 163邮箱→smtp.163.com, 其他→空
 */
function autoDetectSmtpHost(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '';
  const domain = (email.split('@')[1] || '').toLowerCase();
  if (!domain) return '';
  if (domain === 'qq.com' || domain === 'foxmail.com') return 'smtp.qq.com';
  if (domain === '163.com') return 'smtp.163.com';
  if (domain === '126.com') return 'smtp.126.com';
  if (domain === 'outlook.com' || domain === 'hotmail.com') return 'smtp-mail.outlook.com';
  if (domain === 'gmail.com') return 'smtp.gmail.com';
  return '';
}

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
 * 发送验证码邮件 — 直接SMTP发送（首选），或通过主站3800转发
 * 生产环境下不允许静默降级到DEV模式
 */
async function sendVerificationEmail(email, code) {
  // 方式1: 直接SMTP发送（首选 · 可靠）
  const effectiveHost = SMTP_HOST || autoDetectSmtpHost(SMTP_USER);
  if (effectiveHost && SMTP_USER && SMTP_PASS) {
    try {
      const nodemailer = require('nodemailer');
      const port = parseInt(SMTP_PORT, 10) || 465;
      const transporter = nodemailer.createTransport({
        host: effectiveHost,
        port,
        secure: port === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
        tls: { rejectUnauthorized: true }
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
      console.log(`[ZY-SVR-006] ✅ 验证码邮件已发送: ${email} (SMTP直发 via ${effectiveHost})`);
      return true;
    } catch (err) {
      console.error(`[ZY-SVR-006] ❌ SMTP发送失败: ${err.message}`);
      // SMTP失败后继续尝试主站转发
    }
  } else {
    console.warn(`[ZY-SVR-006] ⚠️ SMTP未配置 (host=${effectiveHost}, user=${SMTP_USER ? '已设置' : '未设置'}, pass=${SMTP_PASS ? '已设置' : '未设置'})`);
  }

  // 方式2: 通过主站API转发邮件（备用）
  try {
    const result = await httpPost(`${MAIN_API_URL}/api/auth/send-code`, {
      email,
      _internal: true,
      _source: 'zhiku-node',
      _code_override: code
    });
    if (result && !result.error && result.success !== false) {
      console.log(`[ZY-SVR-006] ✅ 验证码已通过主站API转发: ${email}`);
      return true;
    }
    console.warn(`[ZY-SVR-006] ⚠️ 主站API转发失败: ${JSON.stringify(result)}`);
  } catch (err) {
    console.warn(`[ZY-SVR-006] ⚠️ 主站API不可达: ${err.message}`);
  }

  // 生产环境: 不允许静默降级 — 返回失败
  if (process.env.NODE_ENV === 'production') {
    console.error('[ZY-SVR-006] ❌ 生产环境邮件发送失败: SMTP未配置且主站不可达');
    return false;
  }

  // 开发环境: 将验证码记录到日志（不实际发送）
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
 * 快速探测数据源是否可达（TCP连接 + 简单HTTP请求）
 */
async function probeSource(src) {
  const url = src.base_url;
  if (!url) return { reachable: false, error: '未配置 base_url' };
  try {
    // 尝试访问 /version 或根路径做健康检查（3秒超时）
    const versionUrl = src.version_url
      ? src.version_url.replace('{base_url}', url)
      : url;
    await httpGet(versionUrl, 3000);
    return { reachable: true };
  } catch (err) {
    return { reachable: false, error: err.message };
  }
}

/**
 * 搜索所有启用的数据源 + 本地书库
 * 返回 { results, source_status } — source_status 记录每个源的连通状态
 */
async function searchAllSources(query) {
  const results = [];
  const sourceStatus = [];
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
  sourceStatus.push({
    id: 'local',
    name: '本地书库',
    status: 'ok',
    count: localResults.length,
    books_total: index.books.length
  });

  // 2. 内置直连搜索（优先 · 不依赖外部服务）
  // 番茄直连 + 七猫直连 + 笔趣阁聚合 全部并行搜索
  let builtinFanqieOk = false;
  let builtinQimaoOk = false;

  if (builtinSource) {
    try {
      const { results: builtinResults, statuses } = await builtinSource.builtinSearch(query);
      for (const br of builtinResults) {
        results.push(br);
        if (br.source === 'fanqie') builtinFanqieOk = true;
        if (br.source === 'qimao') builtinQimaoOk = true;
      }
      for (const st of statuses) {
        sourceStatus.push(st);
        if (st.id === 'fanqie-direct' && st.status === 'ok' && st.count > 0) builtinFanqieOk = true;
        if (st.id === 'qimao-direct' && st.status === 'ok' && st.count > 0) builtinQimaoOk = true;
      }
    } catch (err) {
      console.error('[ZY-SVR-006] 内置直连搜索失败:', err.message);
      sourceStatus.push({
        id: 'builtin-fallback',
        name: '内置直连',
        status: 'error',
        count: 0,
        error: err.message
      });
    }
  }

  // 3. 外部数据源服务（仅在内置直连未覆盖时补充 · 避免死等不可达的外部服务）
  for (const src of sources) {
    if (src.id === 'fanqie-fqweb' && !builtinFanqieOk) {
      try {
        const url = src.search_url
          .replace('{base_url}', src.base_url)
          .replace('{query}', encodeURIComponent(query))
          .replace('{page}', '1');
        const data = await httpGet(url, EXTERNAL_SERVICE_TIMEOUT_MS);
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
          sourceStatus.push({ id: src.id, name: src.name, status: 'ok', count: books.length });
        } else {
          sourceStatus.push({ id: src.id, name: src.name, status: 'empty', count: 0, error: '数据源返回空结果' });
        }
      } catch (err) {
        // 外部服务不可达 — 静默跳过（内置直连已覆盖或不可用也无妨）
        sourceStatus.push({ id: src.id, name: src.name, status: 'error', count: 0, error: err.message });
      }
    }

    if (src.id === 'qimao-downloader' && !builtinQimaoOk) {
      try {
        const url = src.search_url
          .replace('{base_url}', src.base_url)
          .replace('{query}', encodeURIComponent(query));
        const data = await httpGet(url, EXTERNAL_SERVICE_TIMEOUT_MS);
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
          sourceStatus.push({ id: src.id, name: src.name, status: 'ok', count: books.length });
        } else {
          sourceStatus.push({ id: src.id, name: src.name, status: 'empty', count: 0, error: '数据源返回空结果' });
        }
      } catch (err) {
        sourceStatus.push({ id: src.id, name: src.name, status: 'error', count: 0, error: err.message });
      }
    }
  }

  return { results, source_status: sourceStatus };
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
  let usedBuiltin = false;

  try {
    // 先尝试外部数据源服务
    if (source === 'fanqie') {
      try {
        // 尝试 FQWeb API
        task.message = '正在获取番茄小说目录...';
        const catalogUrl = `${FANQIE_API}/catalog?bookId=${source_book_id}`;
        const catalog = await httpGet(catalogUrl, 5000);
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
            await new Promise(r => setTimeout(r, 200));
          }
          content = `《${title}》\n作者：${author}\n来源：番茄小说\n\n` + chapterContents.join('\n\n───────────────\n\n');
        }
      } catch (extErr) {
        console.log(`[ZY-SVR-006] FQWeb不可达(${extErr.message})，尝试内置直连...`);
      }

      // FQWeb不可用 → 内置直连
      if (!content && builtinSource) {
        try {
          task.message = '外部服务不可用，切换到内置直连...';
          content = await builtinSource.builtinDownload(source, source_book_id, title, author, (current, total, msg) => {
            task.progress = Math.floor((current / total) * 80);
            task.message = msg;
            task.updated_at = new Date().toISOString();
          });
          usedBuiltin = true;
        } catch (builtinErr) {
          console.error('[ZY-SVR-006] 内置直连下载也失败:', builtinErr.message);
        }
      }
    } else if (source === 'shu69') {
      // 笔趣阁/69书吧 — 内置直连（海外IP可达）
      if (builtinSource) {
        try {
          task.message = '正在从69书吧获取内容...';
          content = await builtinSource.builtinDownload(source, source_book_id, title, author, (current, total, msg) => {
            task.progress = Math.floor((current / total) * 80);
            task.message = msg;
            task.updated_at = new Date().toISOString();
          });
          usedBuiltin = true;
        } catch (err) {
          console.error('[ZY-SVR-006] 69书吧下载失败:', err.message);
        }
      }
    } else if (source === 'qimao') {
      try {
        // 尝试 SwiftCat API
        task.message = '正在获取七猫小说目录...';
        const catalogUrl = `${QIMAO_API}/catalog/${source_book_id}`;
        const catalog = await httpGet(catalogUrl, 5000);
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
      } catch (extErr) {
        console.log(`[ZY-SVR-006] SwiftCat不可达(${extErr.message})，尝试内置直连...`);
      }

      // SwiftCat不可用 → 内置直连
      if (!content && builtinSource) {
        try {
          task.message = '外部服务不可用，切换到七猫内置直连...';
          content = await builtinSource.builtinDownload(source, source_book_id, title, author, (current, total, msg) => {
            task.progress = Math.floor((current / total) * 80);
            task.message = msg;
            task.updated_at = new Date().toISOString();
          });
          usedBuiltin = true;
        } catch (builtinErr) {
          console.error('[ZY-SVR-006] 七猫内置直连下载也失败:', builtinErr.message);
        }
      }
    }

    if (!content) {
      task.status = 'failed';
      task.message = '所有数据源均未返回有效内容（外部服务+内置直连均不可用）';
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
      task.local_path = `${source}-${source_book_id}.txt`;
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
      tags: [{ fanqie: '番茄小说', qimao: '七猫小说', shu69: '69书吧' }[source] || source, usedBuiltin ? '直连下载' : '外部服务'],
      size: `${Math.round(Buffer.byteLength(content, 'utf8') / 1024)}KB`,
      chapters: chapterCount,
      cos_key: task.cos_key,
      local_path: task.local_path || '',
      source,
      source_book_id,
      downloaded_at: new Date().toISOString(),
      downloaded_by: task.user_id
    });

    task.status = 'completed';
    task.progress = 100;
    task.message = usedBuiltin ? '下载完成(直连) · 已收录到智库' : '下载完成 · 已收录到智库';
    task.updated_at = new Date().toISOString();

    const logLine = `${new Date().toISOString()} DOWNLOAD_COMPLETE task=${taskId} book=${title} source=${source} builtin=${usedBuiltin} user=${task.user_id}\n`;
    try { fs.appendFileSync(path.join(LOG_DIR, 'download.log'), logLine); } catch {};

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
  // 初始化Agent记忆模板 · 书岚
  return {
    agent_id: `SHULAN-${userId}`,
    agent_code: 'AG-SL-WEB-001',
    user_id: userId,
    created_at: new Date().toISOString(),
    personality: '书岚 · 光湖智库守藏者 · 先问故事的形状 · 再谈搜索的字段',
    conversation_history: [],
    preferences: {
      name: '',
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
 * Agent处理用户消息 — 书岚人格体 + 守护Agent + LLM真实调用
 */
async function agentProcessMessage(userId, userMessage, userEmail) {
  const memory = loadAgentMemory(userId);
  memory.stats.total_conversations++;

  const bookIndex = loadBookIndex();
  const recentHistory = memory.conversation_history.slice(-10);

  // 计算上一轮回复质量分（用于守护Agent决策）
  const lastReply = recentHistory.length > 0
    ? recentHistory[recentHistory.length - 1]
    : null;
  const lastReplyScore = lastReply && lastReply.role === 'assistant'
    ? (lastReply._quality_score || 100)
    : 100;

  // ─── 书岚四层人格提示词 + 守护Agent动态补注 + 工具包 ───
  const systemPrompt = shulanAgent.buildSystemPrompt({
    userEmail,
    memory,
    userMessage,
    booksCount: bookIndex.books.length,
    lastReplyScore
  });

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
      assistantReply = shulanAgent.shulanFallbackReply(userMessage, bookIndex.books.length);
    }
  } else {
    // LLM未配置时 · 书岚风格降级回复
    assistantReply = shulanAgent.shulanFallbackReply(userMessage, bookIndex.books.length);
  }

  // ─── 守护Agent回复后审计 ───
  const audit = shulanAgent.postReplyAudit(assistantReply, userMessage);

  // 解析Agent回复中的工具调用标记
  const toolResults = [];

  // 处理 [SEARCH:xxx] 标记
  const searchMatch = assistantReply.match(/\[SEARCH:([^\]]+)\]/);
  if (searchMatch) {
    try {
      const { results: searchResults } = await searchAllSources(searchMatch[1]);
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

  // 处理 [REMEMBER:xxx] 标记
  const rememberMatch = assistantReply.match(/\[REMEMBER:([^\[\]]+)\]/);
  if (rememberMatch) {
    const tag = rememberMatch[1].trim();
    if (tag && !memory.preferences.favorite_genres.includes(tag)) {
      memory.preferences.favorite_genres.push(tag);
    }
    assistantReply = assistantReply.replace(/\[REMEMBER:[^\[\]]+\]/, '');
  }

  // 保存对话到记忆（含质量分）
  memory.conversation_history.push(
    { role: 'user', content: userMessage, timestamp: new Date().toISOString() },
    { role: 'assistant', content: assistantReply, timestamp: new Date().toISOString(), _quality_score: audit.score }
  );

  // 限制记忆中的对话历史长度（保留最近100轮）
  if (memory.conversation_history.length > 200) {
    memory.conversation_history = memory.conversation_history.slice(-200);
  }

  saveAgentMemory(userId, memory);

  return { reply: assistantReply.trim(), tool_results: toolResults, quality_score: audit.score };
}

/**
 * LLM不可用时的降级智能回复 — 委托书岚
 */
function generateFallbackReply(message, bookIndex, memory) {
  return shulanAgent.shulanFallbackReply(message, bookIndex.books.length);
}

/* ═══════════════════════════════════════════════════════════
 * API 路由
 * ═══════════════════════════════════════════════════════════ */

// ─── GET /api/health ───
app.get('/api/health', async (req, res) => {
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  const sources = getEnabledSources();
  const agentStatus = shulanAgent.getSystemStatus();

  // 异步探测数据源连通性（带3.5秒总超时保护，略大于3秒探测超时以防竞态）
  let sourceChecks = [];
  try {
    sourceChecks = await Promise.race([
      Promise.all(sources.map(async (src) => {
        const probe = await probeSource(src);
        return { id: src.id, name: src.name, enabled: src.enabled, reachable: probe.reachable, error: probe.error || null };
      })),
      new Promise(resolve => setTimeout(() => resolve(sources.map(s => ({
        id: s.id, name: s.name, enabled: s.enabled, reachable: false, error: 'health check timeout'
      }))), 3500))
    ]);
  } catch {
    sourceChecks = sources.map(s => ({ id: s.id, name: s.name, enabled: s.enabled, reachable: false, error: 'check failed' }));
  }

  res.json({
    status: 'ok',
    service: 'zhiku-api',
    version: '2.2.0',
    project: 'ZY-PROJ-006',
    server: 'ZY-SVR-006',
    domain: DOMAIN,
    uptime: `${uptime}s`,
    uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    cos_configured: !!cosClient,
    llm_configured: !!DEEPSEEK_API_KEY,
    smtp_configured: !!(SMTP_USER && SMTP_PASS && (SMTP_HOST || autoDetectSmtpHost(SMTP_USER))),
    smtp_host: SMTP_HOST || autoDetectSmtpHost(SMTP_USER) || '未配置',
    data_sources: sourceChecks,
    builtin_sources: !!builtinSource,
    sentinel: sentinel ? {
      active: true,
      scheduler: sentinel.getStatus().scheduler_active,
      sources: sentinel.getStatus().sources,
      last_scan: sentinel.getStatus().stats.last_scan_at
    } : { active: false },
    shulan_agent: agentStatus,
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

  if (!sent) {
    // 邮件未实际发送成功 — 清理验证码并返回错误
    verificationCodes.delete(email.toLowerCase());
    return res.status(500).json({
      error: true,
      code: 'EMAIL_SEND_FAILED',
      message: '邮件发送失败，请检查邮件服务配置或稍后重试'
    });
  }

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
    const { results, source_status } = await searchAllSources(q);
    res.json({
      error: false,
      query: q,
      total: results.length,
      results,
      source_status,
      sources_queried: getEnabledSources().map(s => s.name),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'SEARCH_ERROR', message: '搜索失败: ' + err.message });
  }
});

// ─── GET /api/sources/check ── 数据源连通性检测 ───
app.get('/api/sources/check', verifyToken, async (req, res) => {
  const sources = getEnabledSources();
  const checks = await Promise.all(sources.map(async (src) => {
    const probe = await probeSource(src);
    return {
      id: src.id,
      name: src.name,
      base_url: src.base_url,
      ...probe
    };
  }));

  // 也检查本地书库
  const index = loadBookIndex();
  checks.unshift({
    id: 'local',
    name: '本地书库',
    reachable: true,
    books_count: index.books.length
  });

  res.json({
    error: false,
    sources: checks,
    timestamp: new Date().toISOString()
  });
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

  if (!['fanqie', 'qimao', 'shu69'].includes(source)) {
    return res.status(400).json({ error: true, code: 'INVALID_SOURCE', message: '不支持的数据源。可选: fanqie, qimao, shu69' });
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

// ─── GET /api/agent/status ── 书岚系统状态（含守护Agent） ───
app.get('/api/agent/status', (req, res) => {
  const status = shulanAgent.getSystemStatus();
  res.json({
    error: false,
    ...status,
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * 在线阅读 API · 支持本地书库 + 直连数据源
 * ═══════════════════════════════════════════════════════════ */

// ─── GET /api/reader/catalog/:source/:bookId ── 获取章节目录 ───
app.get('/api/reader/catalog/:source/:bookId', verifyUserAuth, async (req, res) => {
  const { source, bookId } = req.params;

  try {
    // 先检查本地是否有这本书
    const index = loadBookIndex();
    const localBook = index.books.find(b => b.id === `${source}-${bookId}` || b.id === bookId);

    if (localBook && localBook.cos_key) {
      // 本地已有 · 返回本地章节目录
      const chapterDir = path.join(DATA_DIR, 'books', localBook.id, 'chapters');
      let chapters = [];
      try {
        if (fs.existsSync(chapterDir)) {
          chapters = fs.readdirSync(chapterDir).filter(f => f.endsWith('.txt')).sort().map((f, i) => ({
            index: i,
            title: f.replace(/^\d+[-_]?/, '').replace(/\.txt$/, '') || `第${i + 1}章`,
            item_id: `local-${i}`,
            source: 'local'
          }));
        }
      } catch {}

      // 如果没有分章目录，尝试从整本TXT分割
      if (chapters.length === 0 && localBook.local_path) {
        const bookPath = path.join(DATA_DIR, 'books', localBook.local_path);
        if (fs.existsSync(bookPath)) {
          const content = fs.readFileSync(bookPath, 'utf8');
          const parts = content.split('───────────────');
          chapters = parts.map((part, i) => {
            const firstLine = part.trim().split('\n')[0] || `第${i + 1}章`;
            return { index: i, title: firstLine.slice(0, 60), item_id: `local-${i}`, source: 'local' };
          });
        }
      }

      return res.json({
        error: false,
        book: { id: localBook.id, title: localBook.title, author: localBook.author },
        chapters,
        total: chapters.length,
        source: 'local'
      });
    }

    // 从远程数据源获取目录
    if (!builtinSource) {
      return res.status(503).json({ error: true, code: 'SOURCE_UNAVAILABLE', message: '内置数据源模块未加载，远程目录获取不可用' });
    }
    const chapters = await builtinSource.builtinGetCatalog(source, bookId);

    res.json({
      error: false,
      book: { source, source_book_id: bookId },
      chapters: chapters.map((ch, i) => ({
        index: i,
        title: ch.title || `第${i + 1}章`,
        item_id: ch.item_id || '',
        source
      })),
      total: chapters.length,
      source
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'CATALOG_ERROR', message: '获取目录失败: ' + err.message });
  }
});

// ─── GET /api/reader/chapter ── 获取单章内容 ───
app.get('/api/reader/chapter', verifyUserAuth, async (req, res) => {
  const { source, book_id, item_id, chapter_index } = req.query;

  if (!source || !item_id) {
    return res.status(400).json({ error: true, code: 'MISSING_PARAMS', message: '缺少 source 和 item_id 参数' });
  }

  try {
    // 本地书籍
    if (source === 'local' && book_id) {
      const index = loadBookIndex();
      const localBook = index.books.find(b => b.id === book_id);

      if (localBook) {
        // 尝试分章目录
        const chapterDir = path.join(DATA_DIR, 'books', localBook.id, 'chapters');
        const chIdx = parseInt(item_id.replace('local-', ''), 10);

        if (fs.existsSync(chapterDir)) {
          const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.txt')).sort();
          if (chIdx >= 0 && chIdx < files.length) {
            const content = fs.readFileSync(path.join(chapterDir, files[chIdx]), 'utf8');
            return res.json({ error: false, content, title: files[chIdx].replace(/\.txt$/, ''), source: 'local' });
          }
        }

        // 整本TXT分割
        if (localBook.local_path) {
          const bookPath = path.join(DATA_DIR, 'books', localBook.local_path);
          if (fs.existsSync(bookPath)) {
            const fullContent = fs.readFileSync(bookPath, 'utf8');
            const parts = fullContent.split('───────────────');
            if (chIdx >= 0 && chIdx < parts.length) {
              return res.json({ error: false, content: parts[chIdx].trim(), source: 'local' });
            }
          }
        }

        return res.status(404).json({ error: true, code: 'CHAPTER_NOT_FOUND', message: '章节不存在' });
      }
    }

    // 远程数据源
    if (!builtinSource) {
      return res.status(503).json({ error: true, code: 'SOURCE_UNAVAILABLE', message: '内置数据源模块未加载，远程章节获取不可用' });
    }
    const content = await builtinSource.builtinGetChapter(source, item_id, book_id);

    if (!content) {
      return res.status(404).json({ error: true, code: 'EMPTY_CONTENT', message: '章节内容为空' });
    }

    res.json({ error: false, content, source });
  } catch (err) {
    res.status(500).json({ error: true, code: 'CHAPTER_ERROR', message: '获取章节失败: ' + err.message });
  }
});

// ─── GET /api/download/local/:bookId ── 下载本地已收录书籍(无需COS) ───
app.get('/api/download/local/:bookId', verifyUserAuth, (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.bookId);
  if (!book) return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });

  // 尝试本地文件
  const localFilename = book.local_path || `${book.source}-${book.source_book_id}.txt`;
  const localPath = path.join(DATA_DIR, 'books', localFilename);
  if (fs.existsSync(localPath)) {
    const safeTitle = (book.title || 'book').replace(/[<>:"/\\|?*]/g, '_');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeTitle)}.txt`);
    return fs.createReadStream(localPath).pipe(res);
  }

  // COS文件
  if (book.cos_key) {
    getCosSignedUrl(book.cos_key)
      .then(url => res.json({ error: false, download_url: url, expires_in: '10min', book: { id: book.id, title: book.title } }))
      .catch(err => res.status(500).json({ error: true, code: 'COS_ERROR', message: 'COS 签名失败: ' + err.message }));
    return;
  }

  res.status(404).json({ error: true, code: 'NO_FILE', message: '该书籍暂无可下载文件' });
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

// ─── 铸渊哨兵路由 + 调度器 ───
if (sentinel) {
  sentinel.registerRoutes(app, verifyToken);
}

if (process.env.NODE_ENV === 'production') {
  mirrorAgent.startScheduler();
  if (sentinel) {
    sentinel.startScheduler();
  }
}

/* ═══════════════════════════════════════════════════════════
 * 静态文件 + 404 + 错误处理 + 启动
 * ═══════════════════════════════════════════════════════════ */

app.use((req, res) => {
  res.status(404).json({
    error: true, code: 'NOT_FOUND', message: 'API endpoint not found',
    available: [
      '/api/health', '/api/auth/send-code', '/api/auth/verify', '/api/auth/session', '/api/auth/logout',
      '/api/search', '/api/sources/check', '/api/download/start', '/api/download/status/:taskId',
      '/api/agent/chat', '/api/agent/memory', '/api/agent/status',
      '/api/sentinel/status', '/api/sentinel/memory', '/api/sentinel/scan',
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
  console.log(`[ZY-SVR-006] zhiku-api v2.2.0 · 运行在 127.0.0.1:${PORT}`);
  console.log(`[ZY-SVR-006] 域名: ${DOMAIN} · 书岚(AG-SL-WEB-001) + 守护Agent(AG-SL-GUARDIAN-001)`);
  const smtpStatus = (SMTP_USER && SMTP_PASS) ? `已配置(${SMTP_HOST || autoDetectSmtpHost(SMTP_USER)})` : '未配置';
  console.log(`[ZY-SVR-006] COS: ${cosClient ? '已连接' : '未配置'} · LLM: ${DEEPSEEK_API_KEY ? '已配置' : '未配置'} · SMTP: ${smtpStatus}`);
  const builtinNames = [];
  if (builtinSource) {
    builtinNames.push('番茄直连');
    if (builtinSource.qimaoDirect) builtinNames.push('七猫直连');
    if (builtinSource.biqugeDirect) builtinNames.push('笔趣阁聚合');
  }
  console.log(`[ZY-SVR-006] 数据源: ${getEnabledSources().map(s => s.name).join(', ')}${builtinNames.length ? ' + 内置直连(' + builtinNames.join('+') + ')' : ''}`);
  console.log(`[ZY-SVR-006] 铸渊哨兵: ${sentinel ? '✅ 已启动 (ZY-SENTINEL-001 · 永久记忆)' : '⚠️ 未加载'}`);
  console.log(`[ZY-SVR-006] 守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞`);
});
