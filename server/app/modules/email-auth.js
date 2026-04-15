/**
 * ═══════════════════════════════════════════════════════════
 * 📧 零点原核频道 · QQ邮箱验证码登录模块
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-AUTH-EMAIL-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 功能:
 *   1. 发送6位数字验证码到QQ邮箱
 *   2. 验证码校验 → 签发session token
 *   3. Session管理（内存存储，可扩展为DB）
 *
 * 安全策略:
 *   - 验证码5分钟过期
 *   - 单邮箱60秒冷却
 *   - 单验证码最多3次尝试
 *   - Session默认7天过期
 *   - Token使用crypto.randomBytes生成
 */

'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');

// ─── 常量 ───
const CODE_LENGTH = 6;
const CODE_EXPIRE_MS = 5 * 60 * 1000;       // 5分钟
const CODE_COOLDOWN_MS = 60 * 1000;          // 60秒冷却
const CODE_MAX_ATTEMPTS = 3;
const SESSION_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7天
const TOKEN_BYTES = 32;

// ─── 内存存储 ───
const pendingCodes = new Map();   // email → { code, createdAt, attempts }
const activeSessions = new Map(); // token → { email, createdAt, expiresAt }

// ─── SMTP 传输器（懒初始化） ───
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const smtpUser = process.env.ZY_SMTP_USER;
  const smtpPass = process.env.ZY_SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP未配置: 需要 ZY_SMTP_USER 和 ZY_SMTP_PASS 环境变量');
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: true
    }
  });

  return transporter;
}

/**
 * 生成6位数字验证码（无偏差）
 */
function generateCode() {
  // 使用 rejection sampling 避免 modulo bias
  const max = 999999;
  const bytesNeeded = 4;
  const maxValid = Math.floor(0xFFFFFFFF / (max + 1)) * (max + 1);
  let num;
  do {
    num = crypto.randomBytes(bytesNeeded).readUInt32BE(0);
  } while (num >= maxValid);
  return String(num % (max + 1)).padStart(CODE_LENGTH, '0');
}

/**
 * 生成安全session token
 */
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

/**
 * 验证邮箱格式（基础校验，避免ReDoS）
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254 || email.length < 5) return false;
  // 不允许空格
  if (email.indexOf(' ') !== -1) return false;
  // 确保只有一个@
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) return false;
  if (atIndex !== email.lastIndexOf('@')) return false;
  const domain = email.slice(atIndex + 1);
  if (domain.indexOf('.') < 1) return false;
  if (domain.endsWith('.')) return false;
  return true;
}

/**
 * 清理过期的验证码和会话
 */
function cleanupExpired() {
  const now = Date.now();

  for (const [email, data] of pendingCodes.entries()) {
    if (now - data.createdAt > CODE_EXPIRE_MS) {
      pendingCodes.delete(email);
    }
  }

  for (const [token, session] of activeSessions.entries()) {
    if (now > session.expiresAt) {
      activeSessions.delete(token);
    }
  }
}

// 每10分钟清理一次
setInterval(cleanupExpired, 10 * 60 * 1000);

/**
 * 发送验证码
 * @param {string} email - 目标邮箱
 * @returns {Promise<{success: boolean, message: string, cooldown?: number}>}
 */
async function sendCode(email) {
  if (!isValidEmail(email)) {
    return { success: false, message: '邮箱格式不正确' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const now = Date.now();

  // 检查冷却时间
  const existing = pendingCodes.get(normalizedEmail);
  if (existing) {
    const elapsed = now - existing.createdAt;
    if (elapsed < CODE_COOLDOWN_MS) {
      const remaining = Math.ceil((CODE_COOLDOWN_MS - elapsed) / 1000);
      return {
        success: false,
        message: `请${remaining}秒后再试`,
        cooldown: remaining
      };
    }
  }

  // 生成验证码
  const code = generateCode();

  // 存储验证码
  pendingCodes.set(normalizedEmail, {
    code,
    createdAt: now,
    attempts: 0
  });

  // 发送邮件
  try {
    const transport = getTransporter();
    const smtpUser = process.env.ZY_SMTP_USER;

    await transport.sendMail({
      from: `"零点原核 · 光湖语言世界" <${smtpUser}>`,
      to: normalizedEmail,
      subject: '零点原核 · 登录验证码',
      html: buildEmailHtml(code)
    });

    console.log(`[Email Auth] 验证码已发送: ${normalizedEmail.slice(0, 3)}***`);
    return { success: true, message: '验证码已发送，请查收邮箱' };
  } catch (err) {
    // 发送失败，清理验证码
    pendingCodes.delete(normalizedEmail);
    // 直接检查环境变量是否缺失，而非依赖错误消息字符串匹配
    const isConfigError = !process.env.ZY_SMTP_USER || !process.env.ZY_SMTP_PASS;
    console.error(`[Email Auth] 发送失败: ${err.message}${isConfigError ? ' · 请检查 ZY_SMTP_USER 和 ZY_SMTP_PASS 环境变量是否已在 .env.app 中配置' : ''}`);
    return {
      success: false,
      message: isConfigError
        ? '邮件服务未配置，请联系管理员'
        : '验证码发送失败，请稍后重试'
    };
  }
}

/**
 * 验证码校验
 * @param {string} email - 邮箱
 * @param {string} code - 验证码
 * @returns {{success: boolean, token?: string, expiresAt?: string, message: string}}
 */
function verifyCode(email, code) {
  if (!email || !code) {
    return { success: false, message: '邮箱和验证码不能为空' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const normalizedCode = String(code).trim();
  const now = Date.now();

  const pending = pendingCodes.get(normalizedEmail);
  if (!pending) {
    return { success: false, message: '验证码不存在或已过期，请重新获取' };
  }

  // 检查过期
  if (now - pending.createdAt > CODE_EXPIRE_MS) {
    pendingCodes.delete(normalizedEmail);
    return { success: false, message: '验证码已过期，请重新获取' };
  }

  // 检查尝试次数
  if (pending.attempts >= CODE_MAX_ATTEMPTS) {
    pendingCodes.delete(normalizedEmail);
    return { success: false, message: '验证码错误次数过多，请重新获取' };
  }

  // 校验验证码（使用时间恒定比较防止时序攻击）
  pending.attempts++;
  const codeBuffer = Buffer.from(normalizedCode);
  const pendingBuffer = Buffer.from(pending.code);

  if (codeBuffer.length !== pendingBuffer.length ||
      !crypto.timingSafeEqual(codeBuffer, pendingBuffer)) {
    const remaining = CODE_MAX_ATTEMPTS - pending.attempts;
    return {
      success: false,
      message: `验证码错误，还剩${remaining}次机会`
    };
  }

  // 验证成功 — 清理验证码，创建session
  pendingCodes.delete(normalizedEmail);

  const token = generateToken();
  const expiresAt = now + SESSION_EXPIRE_MS;

  activeSessions.set(token, {
    email: normalizedEmail,
    createdAt: now,
    expiresAt
  });

  console.log(`[Email Auth] 登录成功: ${normalizedEmail.slice(0, 3)}***`);

  return {
    success: true,
    token,
    email: normalizedEmail,
    expiresAt: new Date(expiresAt).toISOString(),
    message: '登录成功'
  };
}

/**
 * 验证session token
 * @param {string} token - Session token
 * @returns {{valid: boolean, email?: string, expiresAt?: string}}
 */
function validateSession(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false };
  }

  const session = activeSessions.get(token);
  if (!session) {
    return { valid: false };
  }

  if (Date.now() > session.expiresAt) {
    activeSessions.delete(token);
    return { valid: false };
  }

  return {
    valid: true,
    email: session.email,
    expiresAt: new Date(session.expiresAt).toISOString()
  };
}

/**
 * 注销session
 * @param {string} token
 */
function revokeSession(token) {
  activeSessions.delete(token);
}

/**
 * Express中间件：验证登录状态
 */
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      code: 'AUTH_REQUIRED',
      message: '请先登录'
    });
  }

  const token = authHeader.slice(7);
  const session = validateSession(token);

  if (!session.valid) {
    return res.status(401).json({
      error: true,
      code: 'SESSION_EXPIRED',
      message: '登录已过期，请重新登录'
    });
  }

  req.userEmail = session.email;
  req.sessionToken = token;
  next();
}

/**
 * 获取模块状态（用于健康检查）
 */
function getAuthStatus() {
  return {
    module: 'email-auth',
    version: '1.0.0',
    pending_codes: pendingCodes.size,
    active_sessions: activeSessions.size,
    smtp_configured: !!(process.env.ZY_SMTP_USER && process.env.ZY_SMTP_PASS)
  };
}

/**
 * 构建验证码邮件HTML
 */
function buildEmailHtml(code) {
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>零点原核·登录验证码</title></head>
<body style="margin:0;padding:0;background:#050810;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Helvetica Neue',sans-serif">
<main style="max-width:480px;margin:0 auto;padding:40px 24px">
  <div style="text-align:center;margin-bottom:32px">
    <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:14px;background:linear-gradient(135deg,rgba(34,211,238,0.15),rgba(167,139,250,0.12));border:1px solid rgba(96,165,250,0.2);font-size:24px;font-weight:900;color:#22d3ee;font-family:serif">渊</div>
  </div>
  <div style="background:rgba(10,16,36,0.95);border-radius:16px;border:1px solid rgba(96,165,250,0.1);padding:32px 24px;text-align:center">
    <h2 style="color:#e2eaf8;font-size:18px;font-weight:700;margin:0 0 8px">零点原核 · 登录验证</h2>
    <p style="color:#7a8db8;font-size:13px;margin:0 0 24px">光湖语言世界 · guanghuyaoming.com</p>
    <div style="background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.15);border-radius:12px;padding:20px;margin:0 0 24px">
      <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#22d3ee;font-family:'SF Mono','JetBrains Mono',monospace">${code}</div>
    </div>
    <p style="color:#7a8db8;font-size:12px;margin:0 0 4px">验证码5分钟内有效</p>
    <p style="color:#7a8db8;font-size:12px;margin:0">如非本人操作，请忽略此邮件</p>
  </div>
  <div style="text-align:center;margin-top:24px">
    <p style="color:rgba(100,130,180,0.4);font-size:10px;margin:0">版权 国作登字-2026-A-00037559 · TCS-0002∞</p>
  </div>
</main>
</body>
</html>`;
}

module.exports = {
  sendCode,
  verifyCode,
  validateSession,
  revokeSession,
  authMiddleware,
  getAuthStatus
};
