/**
 * ═══════════════════════════════════════════════════════════
 * 📧 FTCHAT 邮箱认证 + 10 槽位占位
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-FTCHAT-AUTH-001
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 设计原则（冰朔指令）:
 *   - 任意 QQ 邮箱可登录, 不预设白名单
 *   - 系统只数数: 10 个槽位先到先得, 满即拒
 *   - 同一邮箱多次登录复用同一槽位
 *   - 槽位状态持久化到 data/slots.json (服务器重启不丢)
 */

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
// nodemailer 懒加载: 仅当需要真正发送邮件时加载,
// 避免单测/契约校验环境下因缺包而崩溃。
let _nodemailer = null;
function getNodemailer() {
  if (_nodemailer) return _nodemailer;
  _nodemailer = require('nodemailer');
  return _nodemailer;
}

// ─── 常量 ───
const CODE_LENGTH = 6;
const CODE_EXPIRE_MS = 5 * 60 * 1000;       // 5 分钟
const CODE_COOLDOWN_MS = 60 * 1000;          // 60 秒冷却
const CODE_MAX_ATTEMPTS = 3;
const SESSION_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
const TOKEN_BYTES = 32;
const MAX_SLOTS = 10;

const DATA_DIR = process.env.FTCHAT_DATA_DIR || path.join(__dirname, '..', 'data');
const SLOTS_FILE = path.join(DATA_DIR, 'slots.json');

// ─── 内存存储 ───
const pendingCodes = new Map();   // emailHash → { code, createdAt, attempts, email }
const activeSessions = new Map(); // token → { emailHash, email, createdAt, expiresAt }

// ─── 槽位状态（持久化）───
// slots = { '<emailHash>': { email, first_seen, last_seen, slot_index } }
let slots = {};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadSlots() {
  ensureDataDir();
  try {
    if (fs.existsSync(SLOTS_FILE)) {
      const raw = fs.readFileSync(SLOTS_FILE, 'utf8');
      slots = JSON.parse(raw) || {};
    }
  } catch (err) {
    console.error('[FTCHAT Auth] slots.json 读取失败, 使用空槽位:', err.message);
    slots = {};
  }
}

function saveSlots() {
  ensureDataDir();
  try {
    fs.writeFileSync(SLOTS_FILE, JSON.stringify(slots, null, 2), { mode: 0o600 });
  } catch (err) {
    console.error('[FTCHAT Auth] slots.json 写入失败:', err.message);
  }
}

loadSlots();

// ─── 工具 ───
function emailHash(email) {
  return crypto.createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 16);
}

function isValidQqEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254 || email.length < 7) return false;
  if (email.indexOf(' ') !== -1) return false;
  const atIndex = email.indexOf('@');
  if (atIndex < 1 || atIndex === email.length - 1) return false;
  if (atIndex !== email.lastIndexOf('@')) return false;
  // 仅接受 QQ 邮箱（@qq.com / @vip.qq.com / @foxmail.com）
  const domain = email.slice(atIndex + 1).toLowerCase();
  return domain === 'qq.com' || domain === 'vip.qq.com' || domain === 'foxmail.com';
}

function generateCode() {
  const max = 999999;
  const maxValid = Math.floor(0xFFFFFFFF / (max + 1)) * (max + 1);
  let num;
  do {
    num = crypto.randomBytes(4).readUInt32BE(0);
  } while (num >= maxValid);
  return String(num % (max + 1)).padStart(CODE_LENGTH, '0');
}

function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

// ─── SMTP ───
let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const smtpUser = process.env.ZY_SMTP_USER;
  const smtpPass = process.env.ZY_SMTP_PASS;
  if (!smtpUser || !smtpPass) {
    throw new Error('SMTP 未配置: 需要 ZY_SMTP_USER 和 ZY_SMTP_PASS');
  }
  transporter = getNodemailer().createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: true }
  });
  return transporter;
}

function buildEmailHtml(code) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
  <div style="background: linear-gradient(135deg, #1a1d3a 0%, #2d3460 100%); color: #f0f0f5; padding: 32px; border-radius: 12px;">
    <h2 style="margin: 0 0 16px; font-weight: 500;">✦ 光湖 · 微调模型内测频道</h2>
    <p style="opacity: 0.85; margin: 0 0 24px;">您正在登录团队内测站，6 位验证码：</p>
    <div style="font-size: 32px; letter-spacing: 8px; text-align: center; padding: 16px; background: rgba(255,255,255,0.1); border-radius: 8px; font-family: monospace;">${code}</div>
    <p style="opacity: 0.7; font-size: 13px; margin: 24px 0 0;">5 分钟内有效。若非本人操作请忽略。</p>
  </div>
  <p style="text-align: center; color: #888; font-size: 12px; margin-top: 16px;">守护: 铸渊 · 国作登字-2026-A-00037559</p>
</body></html>`;
}

// ─── 清理 ───
function cleanupExpired() {
  const now = Date.now();
  for (const [k, v] of pendingCodes.entries()) {
    if (now - v.createdAt > CODE_EXPIRE_MS) pendingCodes.delete(k);
  }
  for (const [t, s] of activeSessions.entries()) {
    if (now > s.expiresAt) activeSessions.delete(t);
  }
}
const _cleanupTimer = setInterval(cleanupExpired, 10 * 60 * 1000);
if (_cleanupTimer && typeof _cleanupTimer.unref === 'function') _cleanupTimer.unref();

// ─── 槽位逻辑 ───
function slotsTaken() {
  return Object.keys(slots).length;
}

function slotsRemaining() {
  return Math.max(0, MAX_SLOTS - slotsTaken());
}

function hasSlot(hash) {
  return Object.prototype.hasOwnProperty.call(slots, hash);
}

function tryClaimSlot(hash, email) {
  if (hasSlot(hash)) {
    slots[hash].last_seen = new Date().toISOString();
    saveSlots();
    return { ok: true, slot_index: slots[hash].slot_index };
  }
  if (slotsTaken() >= MAX_SLOTS) {
    return { ok: false, reason: 'slots_full' };
  }
  // 找最小空闲序号
  const used = new Set(Object.values(slots).map(s => s.slot_index));
  let idx = 1;
  while (used.has(idx)) idx++;
  slots[hash] = {
    email,
    slot_index: idx,
    first_seen: new Date().toISOString(),
    last_seen: new Date().toISOString()
  };
  saveSlots();
  return { ok: true, slot_index: idx };
}

// ─── 发送验证码 ───
async function sendCode(email) {
  if (!isValidQqEmail(email)) {
    return { success: false, message: '请使用 QQ 邮箱（@qq.com / @vip.qq.com / @foxmail.com）' };
  }
  const normalized = email.trim().toLowerCase();
  const hash = emailHash(normalized);

  // 槽位预检查：未占位且已满 → 直接拒绝（不发邮件浪费）
  if (!hasSlot(hash) && slotsTaken() >= MAX_SLOTS) {
    return {
      success: false,
      message: '内测席位已满（10/10），请等待现有成员退出后再试',
      slots_remaining: 0
    };
  }

  const now = Date.now();
  const existing = pendingCodes.get(hash);
  if (existing) {
    const elapsed = now - existing.createdAt;
    if (elapsed < CODE_COOLDOWN_MS) {
      const remaining = Math.ceil((CODE_COOLDOWN_MS - elapsed) / 1000);
      return { success: false, message: `请 ${remaining} 秒后再试`, cooldown: remaining };
    }
  }

  const code = generateCode();
  pendingCodes.set(hash, { code, createdAt: now, attempts: 0, email: normalized });

  // 测试模式：跳过实际发送
  if (process.env.FTCHAT_AUTH_DEV_MODE === 'true') {
    console.log(`[FTCHAT Auth · DEV] 验证码 (不发邮件) ${normalized.slice(0, 3)}*** => ${code}`);
    return { success: true, message: '验证码已生成（开发模式，请查看服务器日志）', slots_remaining: slotsRemaining(), dev_code: code };
  }

  try {
    const transport = getTransporter();
    const smtpUser = process.env.ZY_SMTP_USER;
    await transport.sendMail({
      from: `"光湖 · 微调模型内测" <${smtpUser}>`,
      to: normalized,
      subject: '光湖内测 · 登录验证码',
      html: buildEmailHtml(code)
    });
    console.log(`[FTCHAT Auth] 验证码已发送: ${normalized.slice(0, 3)}***`);
    return { success: true, message: '验证码已发送，请查收 QQ 邮箱', slots_remaining: slotsRemaining() };
  } catch (err) {
    pendingCodes.delete(hash);
    const cfgErr = !process.env.ZY_SMTP_USER || !process.env.ZY_SMTP_PASS;
    console.error(`[FTCHAT Auth] 发送失败: ${err.message}${cfgErr ? ' · 检查 ZY_SMTP_USER/ZY_SMTP_PASS' : ''}`);
    return { success: false, message: cfgErr ? '邮件服务未配置' : '验证码发送失败，请稍后重试' };
  }
}

// ─── 校验 ───
function verifyCode(email, code) {
  if (!email || !code) return { success: false, message: '邮箱和验证码不能为空' };
  if (!isValidQqEmail(email)) return { success: false, message: '邮箱格式不正确' };

  const normalized = email.trim().toLowerCase();
  const hash = emailHash(normalized);
  const inputCode = String(code).trim();
  const now = Date.now();

  const pending = pendingCodes.get(hash);
  if (!pending) return { success: false, message: '验证码不存在或已过期，请重新获取' };
  if (now - pending.createdAt > CODE_EXPIRE_MS) {
    pendingCodes.delete(hash);
    return { success: false, message: '验证码已过期' };
  }
  if (pending.attempts >= CODE_MAX_ATTEMPTS) {
    pendingCodes.delete(hash);
    return { success: false, message: '错误次数过多，请重新获取' };
  }
  // 常量时间比较
  const a = Buffer.from(inputCode);
  const b = Buffer.from(pending.code);
  const codeOk = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!codeOk) {
    pending.attempts += 1;
    return { success: false, message: `验证码错误（${CODE_MAX_ATTEMPTS - pending.attempts} 次机会）` };
  }
  pendingCodes.delete(hash);

  // 占据槽位
  const claim = tryClaimSlot(hash, normalized);
  if (!claim.ok) {
    return { success: false, message: '内测席位已满（10/10），无法登录' };
  }

  const token = generateToken();
  const expiresAt = now + SESSION_EXPIRE_MS;
  activeSessions.set(token, {
    emailHash: hash,
    email: normalized,
    slot_index: claim.slot_index,
    createdAt: now,
    expiresAt
  });

  console.log(`[FTCHAT Auth] 登录成功 ${normalized.slice(0, 3)}*** · 槽位 ${claim.slot_index}/${MAX_SLOTS}`);
  return {
    success: true,
    token,
    user_hash: hash,
    slot_index: claim.slot_index,
    expires_at: new Date(expiresAt).toISOString(),
    message: '登录成功'
  };
}

function validateSession(token) {
  if (!token) return { valid: false };
  const s = activeSessions.get(token);
  if (!s) return { valid: false };
  if (Date.now() > s.expiresAt) {
    activeSessions.delete(token);
    return { valid: false };
  }
  return {
    valid: true,
    email: s.email,
    user_hash: s.emailHash,
    slot_index: s.slot_index,
    expires_at: new Date(s.expiresAt).toISOString()
  };
}

function revokeSession(token) {
  return activeSessions.delete(token);
}

function getStatus() {
  return {
    slots_taken: slotsTaken(),
    slots_total: MAX_SLOTS,
    slots_remaining: slotsRemaining(),
    sessions_active: activeSessions.size,
    smtp_configured: !!(process.env.ZY_SMTP_USER && process.env.ZY_SMTP_PASS)
  };
}

// ─── 测试钩子 ───
function _resetForTests() {
  pendingCodes.clear();
  activeSessions.clear();
  slots = {};
  saveSlots();
}

module.exports = {
  sendCode,
  verifyCode,
  validateSession,
  revokeSession,
  getStatus,
  emailHash,
  isValidQqEmail,
  MAX_SLOTS,
  _resetForTests
};
