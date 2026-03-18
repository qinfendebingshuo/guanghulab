// scripts/sfp-core.js
// 系统指纹安全协议 · SFP v1.0 · 核心模块
//
// 功能：
//   ① generateSFP(agent_id, content) — 生成系统指纹
//   ② verifySFP(content_with_signature) — 验证系统指纹
//   ③ loadConfig() — 加载 SFP 配置
//
// 指纹格式: ⌜SFP::{agent_id}::{persona_chain}::{timestamp}::{content_hash}::{nonce}⌝

'use strict';

const crypto = require('crypto');
const fs     = require('fs');
const path   = require('path');

const ROOT = path.resolve(__dirname, '..');
const SFP_CONFIG_PATH = path.join(ROOT, 'data/security/sfp-config.json');
const SFP_NONCE_PATH  = path.join(ROOT, 'data/security/sfp-nonce-registry.json');
const SFP_ALERT_PATH  = path.join(ROOT, 'data/security/sfp-alert-log.json');

const BEIJING_OFFSET_MS = 8 * 3600 * 1000;
const MAX_NONCE_REGISTRY_SIZE = 1000;
const MAX_ALERT_LOG_SIZE = 500;

// ━━━ SFP 指纹正则 ━━━
const SFP_REGEX = /⌜SFP::([^:]+)::([^:]+)::([0-9T+:.-]+)::([a-f0-9]{12})::([a-zA-Z0-9]{6})⌝/;

// ━━━ 安全读取 JSON ━━━
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// ━━━ 安全写入 JSON ━━━
function writeJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// ━━━ 加载 SFP 配置 ━━━
function loadConfig() {
  const config = readJSON(SFP_CONFIG_PATH);
  if (!config) {
    throw new Error('SFP配置文件缺失: ' + SFP_CONFIG_PATH);
  }
  return config;
}

// ━━━ 查找受信Agent ━━━
function findTrustedAgent(config, agentId) {
  if (!config || !config.trusted_agents) return null;
  return config.trusted_agents.find(a => a.agent_id === agentId) || null;
}

// ━━━ 计算内容哈希（SHA-256前12位） ━━━
function computeContentHash(content) {
  const hash = crypto.createHash('sha256').update(content, 'utf8').digest('hex');
  return hash.slice(0, 12);
}

// ━━━ 生成6位随机nonce ━━━
function generateNonce() {
  // Use hex encoding of random bytes for unbiased distribution
  return crypto.randomBytes(3).toString('hex');
}

// ━━━ 获取北京时间ISO字符串 ━━━
function getBeijingTimestamp() {
  const now = new Date();
  const bjTime = new Date(now.getTime() + BEIJING_OFFSET_MS);
  return bjTime.toISOString().replace('Z', '+08:00').replace(/\.\d{3}/, '');
}

// ━━━ 生成系统指纹 ━━━
function generateSFP(agentId, content) {
  const config = loadConfig();
  const agent = findTrustedAgent(config, agentId);

  if (!agent) {
    return {
      success: false,
      error: 'AGENT_NOT_FOUND',
      message: `Agent ${agentId} 不在受信Agent列表中`
    };
  }

  const timestamp = getBeijingTimestamp();
  const contentHash = computeContentHash(content);
  const nonce = generateNonce();

  const fingerprint = `⌜SFP::${agent.agent_id}::${agent.persona_chain}::${timestamp}::${contentHash}::${nonce}⌝`;

  // 记录 nonce 到已使用列表
  try {
    const nonceRegistry = readJSON(SFP_NONCE_PATH) || { used_nonces: [] };
    nonceRegistry.used_nonces.push({
      nonce,
      agent_id: agentId,
      timestamp,
      content_hash: contentHash
    });
    // 保留最近 1000 条 nonce 记录
    if (nonceRegistry.used_nonces.length > MAX_NONCE_REGISTRY_SIZE) {
      nonceRegistry.used_nonces = nonceRegistry.used_nonces.slice(-MAX_NONCE_REGISTRY_SIZE);
    }
    writeJSON(SFP_NONCE_PATH, nonceRegistry);
  } catch (e) {
    // nonce 记录失败不阻断指纹生成
  }

  return {
    success: true,
    fingerprint,
    signed_content: `${content}\n${fingerprint}`,
    meta: {
      agent_id: agent.agent_id,
      persona_chain: agent.persona_chain,
      timestamp,
      content_hash: contentHash,
      nonce
    }
  };
}

// ━━━ 验证系统指纹 ━━━
function verifySFP(contentWithSignature) {
  const config = loadConfig();

  // Step 1: 检查是否有指纹块
  const match = contentWithSignature.match(SFP_REGEX);
  if (!match) {
    return {
      valid: false,
      error: 'NO_FINGERPRINT',
      level: '⚠️',
      message: '无指纹·不可信',
      log: `[SFP-WARN] 无指纹内容发现`
    };
  }

  const [, agentId, personaChain, timestamp, contentHash, nonce] = match;

  // Step 2: 验证 agent_id
  const agent = findTrustedAgent(config, agentId);
  if (!agent) {
    return {
      valid: false,
      error: 'INVALID_AGENT',
      level: '❌',
      message: `无效Agent ID: ${agentId}`,
      log: `[SFP-ALERT] 伪造Agent ID: ${agentId}`
    };
  }

  // Step 3: 验证亲子链
  if (agent.persona_chain !== personaChain) {
    return {
      valid: false,
      error: 'CHAIN_MISMATCH',
      level: '❌',
      message: `亲子链伪造: 期望 ${agent.persona_chain}，实际 ${personaChain}`,
      log: `[SFP-CRITICAL] 亲子链伪造企图 · agent=${agentId}`
    };
  }

  // Step 4: 验证内容哈希
  // 从内容中去除指纹行，重新计算哈希
  const fingerprintLine = match[0];
  const originalContent = contentWithSignature
    .replace(fingerprintLine, '')
    .replace(/\n$/, '')
    .trim();
  const recomputedHash = computeContentHash(originalContent);

  if (recomputedHash !== contentHash) {
    return {
      valid: false,
      error: 'CONTENT_TAMPERED',
      level: '❌',
      message: `内容被篡改: hash不匹配 (期望=${contentHash}, 实际=${recomputedHash})`,
      log: `[SFP-CRITICAL] 内容篡改检测 · hash不匹配`
    };
  }

  // Step 5: 检查 nonce 重放
  const nonceRegistry = readJSON(SFP_NONCE_PATH) || { used_nonces: [] };
  const nonceUsed = nonceRegistry.used_nonces.some(
    n => n.nonce === nonce && n.agent_id !== agentId
  );
  // 注意：同一个 agent 的相同 nonce 是自己生成的，允许验证
  // 只有不同 agent 使用相同 nonce 才是重放攻击
  const duplicateNonce = nonceRegistry.used_nonces.filter(n => n.nonce === nonce);
  if (duplicateNonce.length > 1) {
    // 检查是否有不同 agent 使用了相同 nonce
    const uniqueAgents = new Set(duplicateNonce.map(n => n.agent_id));
    if (uniqueAgents.size > 1) {
      return {
        valid: false,
        error: 'REPLAY_ATTACK',
        level: '❌',
        message: `重放攻击: nonce ${nonce} 被多个Agent使用`,
        log: `[SFP-CRITICAL] 重放攻击 · nonce重复 · nonce=${nonce}`
      };
    }
  }

  return {
    valid: true,
    level: '✅',
    message: '指纹验证通过',
    meta: {
      agent_id: agentId,
      persona_chain: personaChain,
      timestamp,
      content_hash: contentHash,
      nonce,
      agent_name: agent.name,
      agent_side: agent.side
    }
  };
}

// ━━━ 记录安全警报 ━━━
function logAlert(alertEntry) {
  try {
    const alertLog = readJSON(SFP_ALERT_PATH) || { alerts: [] };
    alertLog.alerts.push({
      ...alertEntry,
      logged_at: getBeijingTimestamp()
    });
    // 保留最近 500 条
    if (alertLog.alerts.length > MAX_ALERT_LOG_SIZE) {
      alertLog.alerts = alertLog.alerts.slice(-MAX_ALERT_LOG_SIZE);
    }
    writeJSON(SFP_ALERT_PATH, alertLog);
  } catch (e) {
    console.error('[SFP] 写入警报日志失败:', e.message);
  }
}

module.exports = {
  generateSFP,
  verifySFP,
  loadConfig,
  findTrustedAgent,
  computeContentHash,
  generateNonce,
  logAlert,
  SFP_REGEX
};
