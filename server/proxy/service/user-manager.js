#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/user-manager.js
// 👤 铸渊专线V2 · 多用户管理器
//
// 每个邮箱绑定一条独立专线:
//   - 独立UUID (Xray VLESS用户ID)
//   - 独立订阅Token (订阅URL认证)
//   - 独立流量统计 (Xray Stats按email追踪)
//   - 共享流量池 (2000GB/月·全用户共享·每月1号重置)
//
// 流量池模型:
//   - 所有用户共享2000GB/月流量池
//   - 无论多少用户，总量一致
//   - 每月1号自动重置
//
// 用户数据存储: /opt/zhuyuan-brain/proxy/data/users.json
// Xray配置自动重建: 增删用户后自动更新config并重启Xray
//
// CLI用法:
//   node user-manager.js add <email>       — 添加用户
//   node user-manager.js remove <email>    — 移除用户
//   node user-manager.js list              — 列出所有用户
//   node user-manager.js get <email>       — 查看用户详情
//   node user-manager.js rebuild           — 重建Xray配置
//   node user-manager.js export            — 导出用户数据(无密钥)
//   node user-manager.js pool              — 查看流量池状态
// ═══════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

// ── 路径配置 ────────────────────────────────
const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const POOL_STATUS_FILE = path.join(DATA_DIR, 'pool-quota-status.json');
const XRAY_CONFIG_OUTPUT = '/usr/local/etc/xray/config.json';
const XRAY_TEMPLATE = path.join(PROXY_DIR, 'config', 'xray-brain-template.json');
const KEYS_FILE = path.join(PROXY_DIR, '.env.keys');

// ── 共享流量池配额 ──────────────────────────
// 冰朔指令D58: 2000GB/月共享流量池·无论多少用户总量一致·每月1号重置
const POOL_QUOTA_BYTES = 2000 * 1024 * 1024 * 1024; // 2000GB = 2TB

// ── 工具函数 ────────────────────────────────

/**
 * 生成UUID v4
 */
function generateUUID() {
  // 优先用xray内置生成
  try {
    const uuid = execSync('xray uuid', { encoding: 'utf8', timeout: 5000 }).trim();
    if (uuid && uuid.match(/^[0-9a-f]{8}-/)) return uuid;
  } catch { /* fallback */ }

  // 回退: crypto
  return crypto.randomUUID();
}

/**
 * 生成32字节hex订阅Token
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * 读取用户数据库
 */
function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
  } catch {
    return { version: '2.0', users: [], created_at: new Date().toISOString() };
  }
}

/**
 * 保存用户数据库
 */
function saveUsers(db) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  db.updated_at = new Date().toISOString();
  fs.writeFileSync(USERS_FILE, JSON.stringify(db, null, 2));
  fs.chmodSync(USERS_FILE, 0o600);
}

/**
 * 读取密钥文件
 */
function loadKeys() {
  const keys = {};
  try {
    const content = fs.readFileSync(KEYS_FILE, 'utf8');
    for (const line of content.split('\n')) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [key, ...vals] = line.split('=');
      keys[key.trim()] = vals.join('=').trim();
    }
  } catch { /* ignore */ }
  return keys;
}

// ── 用户操作 ────────────────────────────────

/**
 * 添加用户
 * @param {string} email - 邮箱地址
 * @param {object} options - 可选参数 {quota_gb, label}
 * @returns {object} 新用户信息
 */
function addUser(email, options = {}) {
  if (!email || !email.includes('@')) {
    throw new Error(`无效的邮箱地址: ${email}`);
  }

  const db = loadUsers();

  // 检查是否已存在
  const existing = db.users.find(u => u.email === email);
  if (existing) {
    throw new Error(`用户已存在: ${email} (UUID: ${existing.uuid.substring(0, 8)}...)`);
  }

  const now = new Date();
  const user = {
    email,
    uuid: generateUUID(),
    token: generateToken(),
    label: options.label || email.split('@')[0],
    quota_bytes: POOL_QUOTA_BYTES, // 存储池配额引用·实际配额由池级别统一控制(getPoolStatus)·非独立限额
    enabled: true,
    created_at: now.toISOString(),
    traffic: {
      upload_bytes: 0,
      download_bytes: 0,
      period: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      alerts_sent: { p80: false, p90: false, p100: false }
    }
  };

  db.users.push(user);
  saveUsers(db);

  const poolGB = (POOL_QUOTA_BYTES / (1024 ** 3)).toFixed(0);
  console.log(`✅ 用户已添加: ${email}`);
  console.log(`   UUID:  ${user.uuid}`);
  console.log(`   Token: ${user.token}`);
  console.log(`   流量池: ${poolGB}GB/月 (全用户共享)`);

  return user;
}

/**
 * 移除用户
 * @param {string} email - 邮箱地址
 * @returns {boolean}
 */
function removeUser(email) {
  const db = loadUsers();
  const idx = db.users.findIndex(u => u.email === email);

  if (idx === -1) {
    throw new Error(`用户不存在: ${email}`);
  }

  const removed = db.users.splice(idx, 1)[0];
  saveUsers(db);

  console.log(`✅ 用户已移除: ${email} (UUID: ${removed.uuid.substring(0, 8)}...)`);
  return true;
}

/**
 * 列出所有用户
 */
function listUsers() {
  const db = loadUsers();

  if (db.users.length === 0) {
    console.log('📋 暂无用户');
    return [];
  }

  const pool = getPoolStatus();
  console.log(`📋 用户列表 (${db.users.length}人) · 流量池: ${pool.pool_used_gb.toFixed(2)}GB / ${pool.pool_total_gb}GB (${pool.pool_percentage.toFixed(1)}%)`);
  console.log('─'.repeat(80));

  for (const user of db.users) {
    const usedGB = ((user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3)).toFixed(2);
    const status = user.enabled ? '✅' : '⛔';

    console.log(`  ${status} ${user.email}`);
    console.log(`     UUID: ${user.uuid.substring(0, 8)}...  个人用量: ${usedGB}GB  标签: ${user.label}`);
  }

  console.log('─'.repeat(80));
  return db.users;
}

/**
 * 获取单个用户详情
 * @param {string} email
 */
function getUser(email) {
  const db = loadUsers();
  const user = db.users.find(u => u.email === email);

  if (!user) {
    throw new Error(`用户不存在: ${email}`);
  }

  const usedGB = ((user.traffic.upload_bytes + user.traffic.download_bytes) / (1024 ** 3)).toFixed(2);
  const pool = getPoolStatus();

  console.log(`👤 用户详情: ${email}`);
  console.log(`   UUID:    ${user.uuid}`);
  console.log(`   Token:   ${user.token}`);
  console.log(`   标签:    ${user.label}`);
  console.log(`   状态:    ${user.enabled ? '启用' : '禁用'}`);
  console.log(`   个人用量: ${usedGB}GB`);
  console.log(`   流量池:  ${pool.pool_used_gb.toFixed(2)}GB / ${pool.pool_total_gb}GB (${pool.pool_percentage.toFixed(1)}%)`);
  console.log(`   周期:    ${user.traffic.period}`);
  console.log(`   创建于:  ${user.created_at}`);

  return user;
}

/**
 * 通过token查找用户
 * @param {string} token
 * @returns {object|null}
 */
function findUserByToken(token) {
  const db = loadUsers();
  return db.users.find(u => u.token === token && u.enabled) || null;
}

/**
 * 获取所有启用的用户（用于生成Xray配置）
 * @returns {Array}
 */
function getEnabledUsers() {
  const db = loadUsers();
  return db.users.filter(u => u.enabled);
}

/**
 * 更新用户流量数据
 * @param {string} email
 * @param {number} upload
 * @param {number} download
 */
function updateTraffic(email, upload, download) {
  const db = loadUsers();
  const user = db.users.find(u => u.email === email);
  if (!user) return;

  const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  // 月度重置
  if (user.traffic.period !== currentPeriod) {
    user.traffic.upload_bytes = 0;
    user.traffic.download_bytes = 0;
    user.traffic.period = currentPeriod;
    user.traffic.alerts_sent = { p80: false, p90: false, p100: false };
  }

  user.traffic.upload_bytes = upload;
  user.traffic.download_bytes = download;
  saveUsers(db);
}

/**
 * 获取共享流量池状态
 * 汇总所有启用用户的流量 · 对比2000GB池配额
 * @returns {object} 流量池状态
 */
function getPoolStatus() {
  const db = loadUsers();
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let totalUpload = 0;
  let totalDownload = 0;

  for (const user of db.users) {
    if (!user.enabled) continue;
    // 只统计当前周期的流量
    if (user.traffic.period === currentPeriod) {
      totalUpload += user.traffic.upload_bytes;
      totalDownload += user.traffic.download_bytes;
    }
  }

  const totalUsed = totalUpload + totalDownload;
  const poolTotalGB = POOL_QUOTA_BYTES / (1024 ** 3);
  const poolUsedGB = totalUsed / (1024 ** 3);
  const percentage = (totalUsed / POOL_QUOTA_BYTES) * 100;

  return {
    pool_quota_bytes: POOL_QUOTA_BYTES,
    pool_total_gb: poolTotalGB,
    pool_upload_bytes: totalUpload,
    pool_download_bytes: totalDownload,
    pool_used_bytes: totalUsed,
    pool_used_gb: poolUsedGB,
    pool_remaining_bytes: Math.max(0, POOL_QUOTA_BYTES - totalUsed),
    pool_remaining_gb: parseFloat(Math.max(0, poolTotalGB - poolUsedGB).toFixed(2)),
    pool_percentage: parseFloat(percentage.toFixed(1)),
    users_count: db.users.filter(u => u.enabled).length,
    period: currentPeriod,
    reset_day: 1,
    updated_at: now.toISOString()
  };
}

/**
 * 保存流量池状态到文件 (供监控和订阅服务使用)
 */
function savePoolStatus() {
  const status = getPoolStatus();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(POOL_STATUS_FILE, JSON.stringify(status, null, 2));
  return status;
}

// ── Xray配置重建 ────────────────────────────

/**
 * 重建Xray配置文件（根据当前用户列表）
 * 每个用户 = 一个VLESS client = 一条独立专线
 */
function rebuildXrayConfig() {
  const keys = loadKeys();
  const users = getEnabledUsers();

  if (!keys.ZY_PROXY_REALITY_PRIVATE_KEY) {
    throw new Error('缺少 ZY_PROXY_REALITY_PRIVATE_KEY — 请先运行 generate-keys.sh');
  }

  if (!keys.ZY_PROXY_REALITY_SHORT_ID) {
    throw new Error('缺少 ZY_PROXY_REALITY_SHORT_ID — 请先运行 generate-keys.sh');
  }

  if (users.length === 0) {
    console.log('⚠️ 没有启用的用户，Xray配置将为空');
  }

  // 构建clients数组：每个用户一条独立线路
  const clients = users.map(user => ({
    id: user.uuid,
    flow: 'xtls-rprx-vision',
    email: user.email
  }));

  const config = {
    _comment: '铸渊专线V2 · 多用户Xray配置 · 自动生成 · 请勿手动编辑',
    _generated_at: new Date().toISOString(),
    _copyright: '国作登字-2026-A-00037559',
    _users: users.length,
    log: {
      loglevel: 'warning',
      access: '/opt/zhuyuan-brain/proxy/logs/access.log',
      error: '/opt/zhuyuan-brain/proxy/logs/error.log'
    },
    dns: {
      servers: ['8.8.8.8', '1.1.1.1', 'localhost']
    },
    stats: {},
    api: {
      tag: 'api',
      services: ['StatsService']
    },
    policy: {
      levels: {
        '0': {
          statsUserUplink: true,
          statsUserDownlink: true
        }
      },
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
        statsOutboundUplink: true,
        statsOutboundDownlink: true
      }
    },
    inbounds: [
      {
        tag: 'zy-vless-reality-v2',
        listen: '0.0.0.0',
        port: 443,
        protocol: 'vless',
        settings: {
          clients,
          decryption: 'none'
        },
        streamSettings: {
          network: 'tcp',
          security: 'reality',
          realitySettings: {
            show: false,
            dest: 'www.microsoft.com:443',
            xver: 0,
            serverNames: ['www.microsoft.com', 'www.amazon.com'],
            privateKey: keys.ZY_PROXY_REALITY_PRIVATE_KEY,
            shortIds: [keys.ZY_PROXY_REALITY_SHORT_ID]
          }
        },
        sniffing: {
          enabled: true,
          destOverride: ['http', 'tls', 'quic']
        }
      },
      {
        tag: 'api-in',
        port: 10085,
        listen: '127.0.0.1',
        protocol: 'dokodemo-door',
        settings: { address: '127.0.0.1' }
      }
    ],
    outbounds: [
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' }
    ],
    routing: {
      rules: [
        {
          type: 'field',
          inboundTag: ['api-in'],
          outboundTag: 'api'
        },
        {
          type: 'field',
          ip: ['geoip:private'],
          outboundTag: 'block'
        }
      ]
    }
  };

  // 写入配置文件
  fs.writeFileSync(XRAY_CONFIG_OUTPUT, JSON.stringify(config, null, 2));
  console.log(`✅ Xray配置已重建: ${users.length}个用户`);

  // 验证配置
  try {
    execSync(`xray run -test -c ${XRAY_CONFIG_OUTPUT}`, { encoding: 'utf8', timeout: 10000 });
    console.log('✅ Xray配置验证通过');
  } catch (err) {
    console.error('❌ Xray配置验证失败:', err.message);
    throw err;
  }

  return config;
}

/**
 * 重启Xray服务
 */
function restartXray() {
  try {
    execSync('systemctl restart xray', { encoding: 'utf8', timeout: 15000 });
    console.log('✅ Xray已重启');
    return true;
  } catch (err) {
    console.error('❌ Xray重启失败:', err.message);
    return false;
  }
}

/**
 * 添加用户 + 重建配置 + 重启Xray (完整流程)
 */
function addUserFull(email, options = {}) {
  const user = addUser(email, options);
  rebuildXrayConfig();
  restartXray();
  return user;
}

/**
 * 移除用户 + 重建配置 + 重启Xray (完整流程)
 */
function removeUserFull(email) {
  removeUser(email);
  rebuildXrayConfig();
  restartXray();
}

// ── 导出 ────────────────────────────────────
module.exports = {
  loadUsers,
  saveUsers,
  addUser,
  removeUser,
  listUsers,
  getUser,
  findUserByToken,
  getEnabledUsers,
  updateTraffic,
  getPoolStatus,
  savePoolStatus,
  rebuildXrayConfig,
  restartXray,
  addUserFull,
  removeUserFull,
  generateUUID,
  generateToken,
  USERS_FILE,
  DATA_DIR,
  KEYS_FILE,
  POOL_QUOTA_BYTES,
  POOL_STATUS_FILE
};

// ── CLI入口 ────────────────────────────────
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const param = args[1];

  try {
    switch (command) {
      case 'add':
        if (!param) { console.error('用法: node user-manager.js add <email>'); process.exit(1); }
        addUserFull(param);
        break;

      case 'remove':
        if (!param) { console.error('用法: node user-manager.js remove <email>'); process.exit(1); }
        removeUserFull(param);
        break;

      case 'list':
        listUsers();
        break;

      case 'get':
        if (!param) { console.error('用法: node user-manager.js get <email>'); process.exit(1); }
        getUser(param);
        break;

      case 'rebuild':
        rebuildXrayConfig();
        restartXray();
        break;

      case 'pool': {
        const pool = getPoolStatus();
        console.log('🏊 铸渊专线V2 · 共享流量池状态');
        console.log('─'.repeat(50));
        console.log(`  总配额:   ${pool.pool_total_gb}GB/月`);
        console.log(`  已使用:   ${pool.pool_used_gb.toFixed(2)}GB`);
        console.log(`  剩余:     ${pool.pool_remaining_gb}GB`);
        console.log(`  使用率:   ${pool.pool_percentage}%`);
        console.log(`  用户数:   ${pool.users_count}人`);
        console.log(`  周期:     ${pool.period}`);
        console.log(`  重置日:   每月${pool.reset_day}号`);
        console.log('─'.repeat(50));
        break;
      }

      case 'export': {
        const db = loadUsers();
        const pool = getPoolStatus();
        const safe = {
          pool: {
            total_gb: pool.pool_total_gb,
            used_gb: parseFloat(pool.pool_used_gb.toFixed(2)),
            remaining_gb: pool.pool_remaining_gb,
            percentage: pool.pool_percentage,
            period: pool.period
          },
          total_users: db.users.length,
          users: db.users.map(u => ({
            email: u.email,
            label: u.label,
            enabled: u.enabled,
            used_gb: ((u.traffic.upload_bytes + u.traffic.download_bytes) / (1024 ** 3)).toFixed(2),
            created_at: u.created_at
          }))
        };
        console.log(JSON.stringify(safe, null, 2));
        break;
      }

      default:
        console.log('铸渊专线V2 · 多用户管理器 · 共享流量池2000GB/月');
        console.log('');
        console.log('用法:');
        console.log('  node user-manager.js add <email>     — 添加用户');
        console.log('  node user-manager.js remove <email>  — 移除用户');
        console.log('  node user-manager.js list            — 列出所有用户');
        console.log('  node user-manager.js get <email>     — 查看用户详情');
        console.log('  node user-manager.js pool            — 查看流量池状态');
        console.log('  node user-manager.js rebuild         — 重建Xray配置');
        console.log('  node user-manager.js export          — 导出用户数据(无密钥)');
        break;
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
