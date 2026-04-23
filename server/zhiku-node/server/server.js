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
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: effectiveHost,
      port: parseInt(SMTP_PORT, 10) || 465,
      secure: true,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS
      }
    });

    try {
      await transporter.sendMail({
        from: `"光湖智库" <${SMTP_USER}>`,
        to: email,
        subject: '您的验证码',
        text: `您的验证码是: ${code} (5分钟内有效)`,
        html: `<p>您的验证码是: <strong>${code}</strong> (5分钟内有效)</p>`
      });
      return { success: true };
    } catch (err) {
      console.error(`[ZY-SVR-006] SMTP发送失败 (${err.message})，尝试通过主站3800转发`);
      // 继续尝试方式2
    }
  }

  // 方式2: 通过主站3800转发（备用方案）
  try {
    const axios = require('axios');
    const response = await axios.post(`${MAIN_API_URL}/api/mail/forward`, {
      to: email,
      subject: '您的验证码',
      text: `您的验证码是: ${code} (5分钟内有效)`,
      html: `<p>您的验证码是: <strong>${code}</strong> (5分钟内有效)</p>`
    }, { timeout: 5000 });
    return response.data;
  } catch (err) {
    console.error(`[ZY-SVR-006] 主站3800转发失败 (${err.message})`);
    return { error: true, message: '邮件发送服务不可用' };
  }
}

/**
 * 测试SMTP连接
 */
async function testSmtpConnection() {
  if (!SMTP_USER || !SMTP_PASS) {
    return { connected: false, error: 'SMTP_USER或SMTP_PASS未配置' };
  }

  const effectiveHost = SMTP_HOST || autoDetectSmtpHost(SMTP_USER);
  if (!effectiveHost) {
    return { connected: false, error: '无法自动检测SMTP主机' };
  }

  const nodemailer = require('nodemailer');
  const transporter = nodemailer.createTransport({
    host: effectiveHost,
    port: parseInt(SMTP_PORT, 10) || 465,
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });

  try {
    await transporter.verify();
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/* ═══════════════════════════════════════════════════════════
 * 服务健康检查端点
 * ═══════════════════════════════════════════════════════════ */
app.get('/api/health', async (req, res) => {
  try {
    // 测试SMTP连接
    const smtpStatus = await testSmtpConnection();
    
    // 检查数据源连接
    const sources = getEnabledSources();
    const sourceStatus = {};
    
    if (builtinSource) {
      sourceStatus.builtin = { enabled: true, status: 'ready' };
    }
    
    // 检查铸渊哨兵状态
    const sentinelStatus = sentinel ? {
      active: true,
      lastCheck: sentinel.lastCheckTime,
      nextCheck: sentinel.nextCheckTime,
      sourcesMonitored: sentinel.sourcesMonitored
    } : { active: false };
    
    res.json({
      status: 'healthy',
      uptime: Math.floor((Date.now() - START_TIME) / 1000),
      version: '2.1',
      serverTime: new Date().toISOString(),
      smtp: {
        configured: !!SMTP_USER,
        ...smtpStatus
      },
      sources: sourceStatus,
      sentinel: sentinelStatus,
      system: {
        node: process.version,
        memory: process.memoryUsage(),
        platform: process.platform
      }
    });
  } catch (err) {
    console.error('[ZY-SVR-006] /api/health 检查失败:', err);
    res.status(500).json({
      status: 'unhealthy',
      error: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ... [保留原有代码不变，此处省略后续部分]