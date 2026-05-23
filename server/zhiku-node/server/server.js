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
const nodemailer = require('nodemailer');
const os = require('os');

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

/**
 * 测试SMTP连接是否可用
 */
async function testSmtpConnection() {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('[ZY-SVR-006] SMTP测试: 配置不完整 (ZY_SMTP_USER或ZY_SMTP_PASS未设置)');
    return {
      ok: false,
      error: 'SMTP配置不完整 (ZY_SMTP_USER或ZY_SMTP_PASS未设置)'
    };
  }

  const effectiveHost = SMTP_HOST || autoDetectSmtpHost(SMTP_USER);
  if (!effectiveHost) {
    console.log('[ZY-SVR-006] SMTP测试: 无法自动检测SMTP主机 (请设置ZY_SMTP_HOST)');
    return {
      ok: false,
      error: '无法自动检测SMTP主机 (请设置ZY_SMTP_HOST)'
    };
  }

  const transporter = nodemailer.createTransport({
    host: effectiveHost,
    port: parseInt(SMTP_PORT, 10),
    secure: true,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    logger: false,
    debug: false,
    connectionTimeout: 3000,
    greetingTimeout: 3000
  });

  try {
    await transporter.verify();
    console.log('[ZY-SVR-006] SMTP测试: 连接成功');
    return { ok: true };
  } catch (err) {
    console.log(`[ZY-SVR-006] SMTP测试: 连接失败 - ${err.message}`);
    return {
      ok: false,
      error: `SMTP连接失败: ${err.message}`
    };
  }
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
 * 健康检查端点 · 增强版
 * ═══════════════════════════════════════════════════════════ */

/**
 * GET /api/health
 * 返回系统健康状况
 */
app.get('/api/health', async (req, res) => {
  const now = new Date();
  const uptime = Math.floor((Date.now() - START_TIME) / 1000);
  
  // 测试SMTP连接
  const smtpStatus = await testSmtpConnection();
  
  // 测试内置数据源
  let builtinSourceStatus = { ok: false, error: '未加载' };
  if (builtinSource) {
    try {
      await builtinSource.ping();
      builtinSourceStatus = { ok: true };
    } catch (err) {
      builtinSourceStatus = { ok: false, error: err.message };
    }
  }
  
  // 获取系统指标
  const freeMem = Math.round(os.freemem() / 1024 / 1024); // MB
  const totalMem = Math.round(os.totalmem() / 1024 / 1024); // MB
  const memUsage = Math.round((1 - (freeMem / totalMem)) * 100); // %
  
  // 获取磁盘使用情况
  let diskUsage = 0;
  try {
    const stats = fs.statfsSync('/');
    diskUsage = Math.round(((stats.blocks - stats.bfree) / stats.blocks) * 100);
  } catch (err) {
    console.error(`[ZY-SVR-006] 磁盘使用率获取失败: ${err.message}`);
  }
  
  // 获取最后请求时间
  let lastRequestTime = '未知';
  try {
    const logFiles = fs.readdirSync(LOG_DIR)
      .filter(f => f.startsWith('api-') && f.endsWith('.log'))
      .sort()
      .reverse();
    
    if (logFiles.length > 0) {
      const latestLog = path.join(LOG_DIR, logFiles[0]);
      const stats = fs.statSync(latestLog);
      lastRequestTime = stats.mtime.toISOString();
    }
  } catch (err) {
    console.error(`[ZY-SVR-006] 最后请求时间获取失败: ${err.message}`);
  }
  
  res.json({
    ok: true,
    version: '2.1',
    time: now.toISOString(),
    uptime,
    health: {
      smtp: smtpStatus,
      builtinSource: builtinSourceStatus,
      system: {
        memory: {
          free: `${freeMem} MB`,
          total: `${totalMem} MB`,
          usage: `${memUsage}%`
        },
        disk: {
          usage: `${diskUsage}%`
        },
        lastRequest: lastRequestTime
      }
    },
    server: {
      name: 'ZY-SVR-006',
      region: '新加坡',
      domain: DOMAIN
    }
  });
});

// 注册其他路由...
[其余代码保持不变]
