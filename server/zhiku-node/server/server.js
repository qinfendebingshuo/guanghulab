#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 光湖智库节点 · 模块借阅协议 API 服务
 * ═══════════════════════════════════════════════════════════
 *
 * 项目编号: ZY-PROJ-006
 * 服务器:   ZY-SVR-006 (43.153.203.105 · 新加坡)
 * 域名:     guanghu.online
 * 端口:     3006 (绑定 127.0.0.1 · Nginx 反代)
 * 守护:     铸渊 · ICE-GL-ZY001
 * 版权:     国作登字-2026-A-00037559
 *
 * 接口清单 (v1.0):
 *   GET  /api/health          — 健康检查
 *   POST /api/checkout        — 借阅入口（签发 token）
 *   POST /api/return          — 归还入口（销毁 token）
 *   GET  /api/search          — 全文搜索书库
 *   GET  /api/book/:id        — 书籍详情
 *   GET  /api/download/:id    — COS 临时签名 URL
 *   GET  /api/read/:id        — 在线阅读内容（分页）
 *
 * 架构法理: 5TH-LE-LK-ZHIKU-ARCH-001
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// ─── 加载环境变量 ───
require('dotenv').config({ path: path.join(__dirname, '.env') });

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
const TOKEN_TTL = parseInt(process.env.ZY_ZHIKU_TOKEN_TTL, 10) || 600;
const DATA_DIR = process.env.ZY_ZHIKU_DATA_DIR || path.join(__dirname, '..', 'data');
const LOG_DIR = process.env.ZY_ZHIKU_LOG_DIR || '/var/log/zhiku';
const DOMAIN = process.env.ZY_ZHIKU_DOMAIN || 'guanghu.online';
const START_TIME = Date.now();

// ─── 确保目录存在 ───
[DATA_DIR, LOG_DIR, path.join(DATA_DIR, 'books'), path.join(DATA_DIR, 'index')].forEach(dir => {
  try { fs.mkdirSync(dir, { recursive: true }); } catch {}
});

// ─── 信任 Nginx 反代 ───
app.set('trust proxy', 'loopback');

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
 * Token 管理 · 模块借阅协议核心
 * ═══════════════════════════════════════════════════════════ */

// Token 黑名单（v1: 内存 Map · v2 可迁移 Redis）
const tokenBlacklist = new Map();
// persona_id → 活跃 token 集合（并发限制）
const activeTokens = new Map();

const MAX_TOKENS_PER_PERSONA = 10;

// 定期清理过期黑名单条目（每 5 分钟）
setInterval(() => {
  const now = Date.now();
  for (const [token, exp] of tokenBlacklist) {
    if (exp < now) tokenBlacklist.delete(token);
  }
  // 同时清理过期的活跃 token
  for (const [pid, tokens] of activeTokens) {
    for (const [t, exp] of tokens) {
      if (exp < now) tokens.delete(t);
    }
    if (tokens.size === 0) activeTokens.delete(pid);
  }
}, 5 * 60 * 1000);

/**
 * 签发借阅 Token
 */
function issueToken(personaId, scope) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL;
  const payload = {
    persona_id: personaId,
    scope: scope || 'search',
    iat: Math.floor(Date.now() / 1000),
    exp
  };
  const token = jwt.sign(payload, JWT_SECRET_FINAL);

  // 记录活跃 token
  if (!activeTokens.has(personaId)) activeTokens.set(personaId, new Map());
  activeTokens.get(personaId).set(token, exp * 1000);

  return { token, ttl: TOKEN_TTL, scope: payload.scope, expires_at: new Date(exp * 1000).toISOString() };
}

/**
 * 验证 Token 中间件
 */
function verifyToken(req, res, next) {
  const token = req.query.token || req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) {
    return res.status(401).json({ error: true, code: 'NO_TOKEN', message: '缺少借阅凭证' });
  }
  if (tokenBlacklist.has(token)) {
    return res.status(401).json({ error: true, code: 'TOKEN_REVOKED', message: '借阅凭证已归还（失效）' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET_FINAL);
    req.persona = decoded;
    req.token = token;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: true, code: 'TOKEN_EXPIRED', message: '借阅凭证已过期' });
    }
    return res.status(401).json({ error: true, code: 'TOKEN_INVALID', message: '借阅凭证无效' });
  }
}

/**
 * 销毁 Token（归还）
 */
function revokeToken(token) {
  try {
    const decoded = jwt.decode(token);
    if (decoded) {
      // 加入黑名单
      tokenBlacklist.set(token, (decoded.exp || 0) * 1000);
      // 从活跃列表移除
      const pid = decoded.persona_id;
      if (activeTokens.has(pid)) {
        activeTokens.get(pid).delete(token);
      }
    }
  } catch {}
}

/* ═══════════════════════════════════════════════════════════
 * 书库索引 · JSON 单文件 (v1)
 * ═══════════════════════════════════════════════════════════ */

const INDEX_FILE = path.join(DATA_DIR, 'index', 'books.json');

function loadBookIndex() {
  try {
    if (fs.existsSync(INDEX_FILE)) {
      return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
    }
  } catch {}
  // 返回示例数据（首次部署）
  return {
    books: [
      {
        id: 'sample-001',
        title: '光湖智库·示例书目',
        author: '系统',
        category: '系统',
        tags: ['示例', '光湖'],
        size: '0KB',
        chapters: 0,
        created_at: new Date().toISOString(),
        cos_key: ''
      }
    ],
    updated_at: new Date().toISOString()
  };
}

function saveBookIndex(data) {
  data.updated_at = new Date().toISOString();
  fs.writeFileSync(INDEX_FILE, JSON.stringify(data, null, 2), 'utf8');
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
    if (!cosClient || !COS_BUCKET) {
      return reject(new Error('COS 未配置'));
    }
    cosClient.getObjectUrl({
      Bucket: COS_BUCKET,
      Region: COS_REGION,
      Key: key,
      Sign: true,
      Expires: 600 // 10 分钟有效
    }, (err, data) => {
      if (err) return reject(err);
      resolve(data.Url);
    });
  });
}

/* ═══════════════════════════════════════════════════════════
 * API 路由
 * ═══════════════════════════════════════════════════════════ */

// ─── GET /api/health ───
app.get('/api/health', (req, res) => {
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  res.json({
    status: 'ok',
    service: 'zhiku-api',
    version: '1.0.0',
    project: 'ZY-PROJ-006',
    server: 'ZY-SVR-006',
    domain: DOMAIN,
    uptime: `${uptime}s`,
    uptime_human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${uptime % 60}s`,
    cos_configured: !!cosClient,
    books_count: loadBookIndex().books.length,
    active_tokens: Array.from(activeTokens.values()).reduce((sum, m) => sum + m.size, 0),
    timestamp: new Date().toISOString(),
    _sovereign: 'TCS-0002∞',
    _copyright: '国作登字-2026-A-00037559'
  });
});

// ─── POST /api/checkout · 借阅入口 ───
app.post('/api/checkout', (req, res) => {
  const { persona_id, scope, purpose } = req.body || {};

  if (!persona_id) {
    return res.status(400).json({ error: true, code: 'MISSING_PERSONA', message: '缺少 persona_id' });
  }

  // 检查是否为合法命名空间
  if (!/^(TCS|ICE|AG|SY|DEV|PER)-[A-Za-z0-9_-]+$/.test(persona_id)) {
    return res.status(403).json({
      error: true,
      code: 'INVALID_NAMESPACE',
      message: 'persona_id 必须使用 TCS-*/ICE-*/AG-*/SY-*/DEV-*/PER-* 命名空间'
    });
  }

  // 检查并发 token 限制
  const existing = activeTokens.get(persona_id);
  if (existing && existing.size >= MAX_TOKENS_PER_PERSONA) {
    return res.status(429).json({
      error: true,
      code: 'TOKEN_LIMIT',
      message: `并发借阅数已达上限 (${MAX_TOKENS_PER_PERSONA})`,
      active_count: existing.size
    });
  }

  const result = issueToken(persona_id, scope);

  // 记录借阅日志
  const logLine = `${new Date().toISOString()} CHECKOUT persona=${persona_id} scope=${scope || 'search'} purpose=${purpose || '-'}\n`;
  try {
    fs.appendFileSync(path.join(LOG_DIR, 'checkout.log'), logLine);
  } catch {}

  res.json({
    error: false,
    ...result,
    persona_id,
    purpose: purpose || '',
    message: `借阅成功 · ${TOKEN_TTL / 60}分钟有效`
  });
});

// ─── POST /api/return · 归还入口 ───
app.post('/api/return', (req, res) => {
  const token = req.body?.token || req.headers.authorization?.replace('Bearer ', '') || '';
  if (!token) {
    return res.status(400).json({ error: true, code: 'NO_TOKEN', message: '缺少归还凭证' });
  }

  revokeToken(token);

  res.json({
    error: false,
    message: '归还成功 · 借阅凭证已销毁'
  });
});

// ─── GET /api/search · 全文搜索 ───
app.get('/api/search', verifyToken, (req, res) => {
  const q = (req.query.q || '').trim().toLowerCase();
  if (!q) {
    return res.status(400).json({ error: true, code: 'EMPTY_QUERY', message: '搜索关键词不能为空' });
  }

  const index = loadBookIndex();
  const results = index.books.filter(book => {
    const searchable = [book.title, book.author, ...(book.tags || []), book.category || ''].join(' ').toLowerCase();
    return searchable.includes(q);
  }).map(book => ({
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.category,
    tags: book.tags,
    size: book.size,
    chapters: book.chapters
  }));

  res.json({
    error: false,
    query: q,
    total: results.length,
    results,
    timestamp: new Date().toISOString()
  });
});

// ─── GET /api/book/:id · 书籍详情 ───
app.get('/api/book/:id', verifyToken, (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  }

  res.json({
    error: false,
    data: book,
    timestamp: new Date().toISOString()
  });
});

// ─── GET /api/download/:id · COS 临时签名 URL ───
app.get('/api/download/:id', verifyToken, async (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  }
  if (!book.cos_key) {
    return res.status(404).json({ error: true, code: 'NO_FILE', message: '该书籍暂无可下载文件' });
  }

  try {
    const url = await getCosSignedUrl(book.cos_key);
    // 记录下载日志
    const logLine = `${new Date().toISOString()} DOWNLOAD persona=${req.persona.persona_id} book=${book.id} title=${book.title}\n`;
    try { fs.appendFileSync(path.join(LOG_DIR, 'download.log'), logLine); } catch {}

    res.json({
      error: false,
      download_url: url,
      expires_in: '10min',
      book: { id: book.id, title: book.title }
    });
  } catch (err) {
    res.status(500).json({ error: true, code: 'COS_ERROR', message: 'COS 签名失败: ' + err.message });
  }
});

// ─── GET /api/read/:id · 在线阅读（分页） ───
app.get('/api/read/:id', verifyToken, (req, res) => {
  const index = loadBookIndex();
  const book = index.books.find(b => b.id === req.params.id);
  if (!book) {
    return res.status(404).json({ error: true, code: 'NOT_FOUND', message: '未找到该书籍' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const pageSize = Math.min(50, Math.max(1, parseInt(req.query.page_size, 10) || 20));

  // 尝试从本地数据目录读取章节
  const chapterDir = path.join(DATA_DIR, 'books', book.id, 'chapters');
  let chapters = [];
  try {
    if (fs.existsSync(chapterDir)) {
      const files = fs.readdirSync(chapterDir).filter(f => f.endsWith('.txt')).sort();
      chapters = files.map((f, i) => ({
        index: i + 1,
        filename: f,
        title: f.replace(/^\d+[-_]?/, '').replace(/\.txt$/, '') || `第${i + 1}章`
      }));
    }
  } catch {}

  const total = chapters.length;
  const start = (page - 1) * pageSize;
  const paged = chapters.slice(start, start + pageSize);

  // 读取当前页章节内容
  const content = paged.map(ch => {
    try {
      const text = fs.readFileSync(path.join(chapterDir, ch.filename), 'utf8');
      return { ...ch, content: text };
    } catch {
      return { ...ch, content: '' };
    }
  });

  res.json({
    error: false,
    book: { id: book.id, title: book.title, author: book.author },
    pagination: {
      page,
      page_size: pageSize,
      total_chapters: total,
      total_pages: Math.ceil(total / pageSize)
    },
    chapters: content,
    timestamp: new Date().toISOString()
  });
});

/* ═══════════════════════════════════════════════════════════
 * 404 Fallback
 * ═══════════════════════════════════════════════════════════ */
app.use((req, res) => {
  res.status(404).json({
    error: true,
    code: 'NOT_FOUND',
    message: 'API endpoint not found',
    available: ['/api/health', '/api/checkout', '/api/return', '/api/search', '/api/book/:id', '/api/download/:id', '/api/read/:id']
  });
});

/* ═══════════════════════════════════════════════════════════
 * 全局错误处理
 * ═══════════════════════════════════════════════════════════ */
app.use((err, req, res, _next) => {
  const logLine = `${new Date().toISOString()} ERROR ${req.method} ${req.url} ${err.message}\n`;
  try { fs.appendFileSync(path.join(LOG_DIR, 'error.log'), logLine); } catch {}
  res.status(500).json({
    error: true,
    code: 'INTERNAL_ERROR',
    message: process.env.NODE_ENV === 'production' ? '服务器内部错误' : err.message
  });
});

/* ═══════════════════════════════════════════════════════════
 * 启动 · 绑定 127.0.0.1（仅通过 Nginx 反代对外暴露）
 * ═══════════════════════════════════════════════════════════ */
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[ZY-SVR-006] zhiku-api v1.0.0 · 运行在 127.0.0.1:${PORT}`);
  console.log(`[ZY-SVR-006] 域名: ${DOMAIN} · 借阅协议已激活`);
  console.log(`[ZY-SVR-006] COS: ${cosClient ? '已连接' : '未配置'}`);
  console.log(`[ZY-SVR-006] Token TTL: ${TOKEN_TTL}s · 并发限制: ${MAX_TOKENS_PER_PERSONA}`);
  console.log(`[ZY-SVR-006] 守护: 铸渊 · ICE-GL-ZY001 · TCS-0002∞`);
});
