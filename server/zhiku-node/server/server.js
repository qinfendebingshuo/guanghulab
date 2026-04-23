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
      const transporter = nodemailer.createTransport({
        host: effectiveHost,
        port: SMTP_PORT,
        secure: true,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS
        }
      });

      const mailOptions = {
        from: `"光湖智库" <${SMTP_USER}>`,
        to: email,
        subject: '光湖智库验证码',
        text: `您的验证码是: ${code}\n验证码5分钟内有效，请勿泄露给他人。`,
        html: `
          <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; padding: 20px;">
            <h2 style="color: #1890ff;">光湖智库验证码</h2>
            <p>您的验证码是: <strong style="font-size: 24px; color: #1890ff;">${code}</strong></p>
            <p style="color: #999; font-size: 12px;">验证码5分钟内有效，请勿泄露给他人。</p>
          </div>
        `
      };

      const info = await transporter.sendMail(mailOptions);
      return { success: true, method: 'smtp', messageId: info.messageId };
    } catch (err) {
      console.error(`[ZY-SVR-006] SMTP发送失败 (${err.message})，尝试方式2`);
    }
  }

  // 方式2: 通过主站3800转发（备用）
  if (MAIN_API_URL) {
    try {
      const axios = require('axios');
      const res = await axios.post(`${MAIN_API_URL}/api/mail/send`, {
        to: email,
        subject: '光湖智库验证码',
        text: `您的验证码是: ${code}\n验证码5分钟内有效，请勿泄露给他人。`,
        html: `
          <div style="font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; padding: 20px;">
            <h2 style="color: #1890ff;">光湖智库验证码</h2>
            <p>您的验证码是: <strong style="font-size: 24px; color: #1890ff;">${code}</strong></p>
            <p style="color: #999; font-size: 12px;">验证码5分钟内有效，请勿泄露给他人。</p>
          </div>
        `
      }, { timeout: 5000 });
      return { success: true, method: 'api', messageId: res.data.messageId };
    } catch (err) {
      console.error(`[ZY-SVR-006] 主站API转发失败 (${err.message})`);
    }
  }

  // 方式3: 开发模式记录日志
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV] 验证码邮件 (不实际发送): ${email} → ${code}`);
    return { success: true, method: 'dev', messageId: 'dev-mode-no-send' };
  }

  return { success: false, error: '无法发送验证码邮件' };
}

/**
 * SMTP配置测试端点
 * 用于验证SMTP配置是否正常工作
 */
app.get('/test/smtp', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ 
      error: true, 
      code: 'FORBIDDEN', 
      message: '生产环境禁用测试端点' 
    });
  }

  if (!SMTP_USER || !SMTP_PASS) {
    return res.status(400).json({ 
      error: true, 
      code: 'SMTP_NOT_CONFIGURED', 
      message: 'SMTP配置不完整',
      config: {
        SMTP_USER: SMTP_USER ? '已配置' : '未配置',
        SMTP_PASS: SMTP_PASS ? '已配置' : '未配置',
        SMTP_HOST: SMTP_HOST || autoDetectSmtpHost(SMTP_USER) || '未自动检测到'
      }
    });
  }

  const testEmail = 'test@example.com';
  const testCode = generateCode();
  
  try {
    const result = await sendVerificationEmail(testEmail, testCode);
    
    if (result.success) {
      return res.json({
        success: true,
        method: result.method,
        config: {
          SMTP_USER: SMTP_USER ? '已配置' : '未配置',
          SMTP_HOST: SMTP_HOST || autoDetectSmtpHost(SMTP_USER) || '未自动检测到',
          SMTP_PORT: SMTP_PORT
        },
        testData: {
          email: testEmail,
          code: testCode
        },
        rawResponse: result
      });
    } else {
      return res.status(500).json({
        error: true,
        code: 'SMTP_TEST_FAILED',
        message: 'SMTP测试发送失败',
        details: result.error || '未知错误',
        config: {
          SMTP_USER: SMTP_USER ? '已配置' : '未配置',
          SMTP_HOST: SMTP_HOST || autoDetectSmtpHost(SMTP_USER) || '未自动检测到',
          SMTP_PORT: SMTP_PORT
        }
      });
    }
  } catch (err) {
    return res.status(500).json({
      error: true,
      code: 'SMTP_TEST_ERROR',
      message: 'SMTP测试过程中发生错误',
      details: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
});

// ─── 注册API路由 ───
app.post('/api/auth/send-code', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: true, code: 'INVALID_EMAIL', message: '邮箱格式不正确' });
  }

  // 检查验证码尝试次数
  const existing = verificationCodes.get(email);
  if (existing && existing.attempts >= AUTH_CODE_MAX_ATTEMPTS) {
    return res.status(429).json({ 
      error: true, 
      code: 'TOO_MANY_ATTEMPTS', 
      message: '尝试次数过多，请稍后再试' 
    });
  }

  // 生成新验证码
  const code = generateCode();
  verificationCodes.set(email, {
    code,
    expires: Date.now() + AUTH_CODE_TTL,
    attempts: existing ? existing.attempts + 1 : 1
  });

  // 发送验证码
  const result = await sendVerificationEmail(email, code);
  if (!result.success) {
    return res.status(500).json({ 
      error: true, 
      code: 'EMAIL_SEND_FAILED', 
      message: '验证码发送失败，请稍后再试' 
    });
  }

  res.json({ success: true });
});

// 其他现有路由保持不变...

// ─── 启动服务器 ───
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[ZY-SVR-006] 光湖智库API运行中: http://127.0.0.1:${PORT}`);
  console.log(`[ZY-SVR-006] 当前模式: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[ZY-SVR-006] 数据目录: ${DATA_DIR}`);
  console.log(`[ZY-SVR-006] 日志目录: ${LOG_DIR}`);
  console.log(`[ZY-SVR-006] 域名配置: ${DOMAIN}`);
  console.log(`[ZY-SVR-006] SMTP状态: ${SMTP_USER ? '已配置' : '未配置'}`);
});

// 导出app用于测试
module.exports = app;