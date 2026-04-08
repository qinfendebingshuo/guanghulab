#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/bandwidth-pool-agent.js
// 🌊 光湖语言世界 · 带宽汇聚Agent
//
// ∞+1 版本核心模块 — 用户带宽共享加速系统
//
// 架构设计 (冰朔定根):
//   用户的光纤带宽是真正的引擎。
//   通过验证码授权，用户自愿共享多余带宽，
//   汇聚到公共加速缓冲池，为其他用户加速。
//   用得用户越多，系统越快。
//
// 核心流程:
//   1. 发送验证码 → 用户QQ邮箱
//   2. 用户输入验证码 → 授权带宽共享
//   3. 采集用户IP (加密存储) → 注册为Relay节点
//   4. 用户专属直通道 (优先) + 公共加速缓冲池 (多余带宽)
//
// 安全原则:
//   - 用户IP仅加密存储 (SHA256+盐值)，不存明文
//   - 验证码15分钟过期，一次性使用
//   - 用户可随时退出带宽共享
//   - 威胁检测时自动切断用户共享通道
//
// 运行方式: PM2 managed (zy-bandwidth-pool)
// 状态文件: bandwidth-pool-status.json
// ═══════════════════════════════════════════════

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const POOL_STATUS_FILE = path.join(DATA_DIR, 'bandwidth-pool-status.json');
const AUTH_CODES_FILE = path.join(DATA_DIR, 'bandwidth-auth-codes.json');
const CONTRIBUTORS_FILE = path.join(DATA_DIR, 'bandwidth-contributors.json');
const THREAT_LOG_FILE = path.join(DATA_DIR, 'bandwidth-threat-log.json');

const CODE_EXPIRY_MS = 15 * 60 * 1000;   // 验证码15分钟过期
const POOL_CHECK_INTERVAL = 60 * 1000;    // 每分钟检查池状态
const CONTRIBUTOR_HEARTBEAT_MS = 5 * 60 * 1000; // 贡献者心跳5分钟
const SALT = process.env.ZY_BW_SALT || (() => {
  // 如果未设置环境变量，从密钥文件中读取或生成持久化盐值
  const saltFile = path.join(DATA_DIR, '.bw-salt');
  try {
    return fs.readFileSync(saltFile, 'utf8').trim();
  } catch {
    const generated = crypto.randomBytes(32).toString('hex');
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(saltFile, generated, { mode: 0o600 });
    } catch { /* 无法持久化时使用内存值 */ }
    return generated;
  }
})();

// ═══════════════════════════════════════════════
//  🔑 验证码管理
// ═══════════════════════════════════════════════

/**
 * 生成6位数字验证码
 */
function generateAuthCode() {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * 加密IP地址 (SHA256 + 盐值)
 */
function encryptIP(ip) {
  return crypto.createHash('sha256').update(`${SALT}:${ip}`).digest('hex');
}

/**
 * 读取验证码存储
 */
function readAuthCodes() {
  try {
    return JSON.parse(fs.readFileSync(AUTH_CODES_FILE, 'utf8'));
  } catch {
    return { codes: {} };
  }
}

/**
 * 保存验证码存储
 */
function saveAuthCodes(data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(AUTH_CODES_FILE, JSON.stringify(data, null, 2));
}

/**
 * 创建验证码并关联邮箱
 * @param {string} email 用户邮箱
 * @returns {string} 6位验证码
 */
function createAuthCode(email) {
  const codes = readAuthCodes();
  const code = generateAuthCode();

  // 清理该邮箱的旧验证码
  for (const [key, entry] of Object.entries(codes.codes)) {
    if (entry.email === email) {
      delete codes.codes[key];
    }
  }

  codes.codes[code] = {
    email,
    created_at: Date.now(),
    expires_at: Date.now() + CODE_EXPIRY_MS,
    used: false
  };

  // 清理所有过期验证码
  const now = Date.now();
  for (const [key, entry] of Object.entries(codes.codes)) {
    if (entry.expires_at < now || entry.used) {
      delete codes.codes[key];
    }
  }

  saveAuthCodes(codes);
  return code;
}

/**
 * 验证验证码
 * @param {string} code 用户输入的验证码
 * @param {string} email 用户邮箱 (用于交叉验证)
 * @returns {{ valid: boolean, email?: string, error?: string }}
 */
function verifyAuthCode(code, email) {
  const codes = readAuthCodes();
  const entry = codes.codes[code];

  if (!entry) {
    return { valid: false, error: '验证码不存在或已过期' };
  }

  if (entry.used) {
    return { valid: false, error: '验证码已使用' };
  }

  if (Date.now() > entry.expires_at) {
    delete codes.codes[code];
    saveAuthCodes(codes);
    return { valid: false, error: '验证码已过期(15分钟)' };
  }

  if (entry.email !== email) {
    return { valid: false, error: '验证码与邮箱不匹配' };
  }

  // 标记为已使用
  entry.used = true;
  entry.used_at = Date.now();
  saveAuthCodes(codes);

  return { valid: true, email: entry.email };
}

// ═══════════════════════════════════════════════
//  🌊 带宽贡献者管理
// ═══════════════════════════════════════════════

/**
 * 读取贡献者列表
 */
function readContributors() {
  try {
    return JSON.parse(fs.readFileSync(CONTRIBUTORS_FILE, 'utf8'));
  } catch {
    return {
      version: '1.0',
      contributors: [],
      updated_at: new Date().toISOString()
    };
  }
}

/**
 * 保存贡献者列表
 */
function saveContributors(data) {
  data.updated_at = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(CONTRIBUTORS_FILE, JSON.stringify(data, null, 2));
}

/**
 * 注册带宽贡献者
 * @param {string} email 用户邮箱
 * @param {string} ip 用户真实IP (将加密存储)
 * @returns {{ success: boolean, contributor_id: string }}
 */
function registerContributor(email, ip) {
  const data = readContributors();

  // 检查是否已注册
  const existing = data.contributors.find(c => c.email === email);
  if (existing) {
    existing.ip_hash = encryptIP(ip);
    existing.status = 'active';
    existing.last_heartbeat = Date.now();
    existing.reactivated_at = new Date().toISOString();
    saveContributors(data);
    return { success: true, contributor_id: existing.id };
  }

  // 新注册
  const contributorId = `bw-${crypto.randomBytes(8).toString('hex')}`;
  data.contributors.push({
    id: contributorId,
    email,
    ip_hash: encryptIP(ip),
    status: 'active',             // active | suspended | disconnected
    authorized_at: new Date().toISOString(),
    last_heartbeat: Date.now(),
    bandwidth_contributed_bytes: 0,
    sessions_count: 0
  });

  saveContributors(data);
  return { success: true, contributor_id: contributorId };
}

/**
 * 获取活跃贡献者数量和带宽池状态
 */
function getPoolStatus() {
  const data = readContributors();
  const now = Date.now();

  const active = data.contributors.filter(c =>
    c.status === 'active' &&
    (now - c.last_heartbeat) < CONTRIBUTOR_HEARTBEAT_MS * 3
  );

  const totalContributed = data.contributors.reduce(
    (sum, c) => sum + (c.bandwidth_contributed_bytes || 0), 0
  );

  return {
    total_contributors: data.contributors.length,
    active_contributors: active.length,
    total_contributed_gb: parseFloat((totalContributed / (1024 ** 3)).toFixed(2)),
    pool_status: active.length > 0 ? 'active' : 'idle',
    updated_at: new Date().toISOString()
  };
}

/**
 * 检查指定邮箱是否为活跃带宽贡献者
 * @param {string} email 用户邮箱
 * @returns {{ is_contributor: boolean, status: string, authorized_at: string|null }}
 */
function isContributor(email) {
  const data = readContributors();
  const contributor = data.contributors.find(c => c.email === email);
  if (!contributor) {
    return { is_contributor: false, status: 'none', authorized_at: null };
  }
  return {
    is_contributor: true,
    status: contributor.status,
    authorized_at: contributor.authorized_at || null
  };
}

/**
 * 紧急切断指定用户的带宽共享
 * @param {string} email 用户邮箱
 * @param {string} reason 切断原因
 * @returns {boolean} 是否成功切断
 */
function disconnectContributor(email, reason) {
  const data = readContributors();
  const contributor = data.contributors.find(c => c.email === email);

  if (!contributor) return false;

  contributor.status = 'disconnected';
  contributor.disconnected_at = new Date().toISOString();
  contributor.disconnect_reason = reason;

  saveContributors(data);
  logThreatEvent('contributor_disconnect', email, reason);
  return true;
}

/**
 * 紧急切断所有贡献者 (全局威胁响应)
 * @param {string} reason 切断原因
 * @returns {number} 切断的贡献者数量
 */
function disconnectAllContributors(reason) {
  const data = readContributors();
  let count = 0;

  for (const c of data.contributors) {
    if (c.status === 'active') {
      c.status = 'disconnected';
      c.disconnected_at = new Date().toISOString();
      c.disconnect_reason = reason;
      count++;
    }
  }

  saveContributors(data);
  logThreatEvent('global_disconnect', 'ALL', reason);
  return count;
}

/**
 * 自毁式清除 — 格式化指定用户的所有共享记录
 * 让这条路"从未出现过"
 * @param {string} email 用户邮箱
 */
function purgeContributorTrace(email) {
  const data = readContributors();
  data.contributors = data.contributors.filter(c => c.email !== email);
  saveContributors(data);
  logThreatEvent('trace_purged', email, '自毁式清除·记录已消失');
}

/**
 * 全局自毁 — 格式化所有贡献者记录
 */
function purgeAllTraces() {
  const data = {
    version: '1.0',
    contributors: [],
    updated_at: new Date().toISOString(),
    last_purge: new Date().toISOString()
  };
  saveContributors(data);
  logThreatEvent('global_purge', 'ALL', '全局自毁·所有记录已清除');
}

// ═══════════════════════════════════════════════
//  🛡️ 威胁日志
// ═══════════════════════════════════════════════

function logThreatEvent(type, target, detail) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(THREAT_LOG_FILE, 'utf8'));
  } catch {
    log = { events: [] };
  }

  log.events.push({
    type,
    target,
    detail,
    time: new Date().toISOString()
  });

  // 只保留最近50条
  if (log.events.length > 50) {
    log.events = log.events.slice(-50);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(THREAT_LOG_FILE, JSON.stringify(log, null, 2));
}

// ═══════════════════════════════════════════════
//  📊 池状态持久化 (定时写入)
// ═══════════════════════════════════════════════

function updatePoolStatusFile() {
  const status = getPoolStatus();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(POOL_STATUS_FILE, JSON.stringify(status, null, 2));
  return status;
}

// ═══════════════════════════════════════════════
//  🔄 定时任务 (PM2运行时)
// ═══════════════════════════════════════════════

function startPoolMonitor() {
  console.log('🌊 带宽汇聚Agent启动');
  console.log(`  验证码有效期: ${CODE_EXPIRY_MS / 60000}分钟`);
  console.log(`  贡献者心跳: ${CONTRIBUTOR_HEARTBEAT_MS / 60000}分钟`);
  console.log(`  池状态检查: ${POOL_CHECK_INTERVAL / 1000}秒`);

  // 初始状态
  const status = updatePoolStatusFile();
  console.log(`  当前贡献者: ${status.total_contributors}人 (活跃: ${status.active_contributors})`);

  // 定时更新池状态
  setInterval(() => {
    try {
      const s = updatePoolStatusFile();
      if (s.active_contributors > 0) {
        console.log(`[带宽池] 活跃贡献者: ${s.active_contributors} | 总贡献: ${s.total_contributed_gb}GB`);
      }
    } catch (err) {
      console.error('[带宽池] 状态更新失败:', err.message);
    }
  }, POOL_CHECK_INTERVAL);

  // 定时清理过期验证码
  setInterval(() => {
    try {
      const codes = readAuthCodes();
      const now = Date.now();
      let cleaned = 0;
      for (const [key, entry] of Object.entries(codes.codes)) {
        if (entry.expires_at < now || entry.used) {
          delete codes.codes[key];
          cleaned++;
        }
      }
      if (cleaned > 0) {
        saveAuthCodes(codes);
        console.log(`[带宽池] 清理过期验证码: ${cleaned}个`);
      }
    } catch { /* ignore */ }
  }, 5 * 60 * 1000); // 每5分钟清理
}

// ═══════════════════════════════════════════════
//  导出API
// ═══════════════════════════════════════════════

module.exports = {
  // 验证码
  createAuthCode,
  verifyAuthCode,

  // 贡献者管理
  registerContributor,
  getPoolStatus,
  isContributor,
  readContributors,

  // 安全操作
  disconnectContributor,
  disconnectAllContributors,
  purgeContributorTrace,
  purgeAllTraces,

  // 工具
  encryptIP,
  logThreatEvent,
  updatePoolStatusFile,

  // 常量
  CODE_EXPIRY_MS
};

// PM2直接运行
if (require.main === module) {
  startPoolMonitor();
}
