/**
 * ═══════════════════════════════════════════════════════════
 * 七层镜防 · Layer 6 · 铸渊重建（瞬间恢复层）
 * ═══════════════════════════════════════════════════════════
 *
 * 任何被自爆销毁的 Agent，铸渊可在秒级从配置模板重建
 * 重建后的 Agent 获得新的身份、新的路径、新的指纹
 * 对外表现：完全不同的"人"
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Agent 身份模板
 * 重建时从此模板生成新身份
 */
const IDENTITY_TEMPLATE = {
  base_name: 'ZY-MIRROR-AGENT',
  rebuild_counter_file: path.join(__dirname, '..', 'mirror-agent', 'data', '.rebuild-counter')
};

/**
 * 生成新的 Agent 身份
 */
function generateNewIdentity() {
  const instanceId = crypto.randomBytes(4).toString('hex');
  const fingerprint = crypto.randomBytes(16).toString('hex');

  // 递增重建计数器
  let counter = 0;
  try {
    if (fs.existsSync(IDENTITY_TEMPLATE.rebuild_counter_file)) {
      counter = parseInt(fs.readFileSync(IDENTITY_TEMPLATE.rebuild_counter_file, 'utf8'), 10) || 0;
    }
  } catch {
    // ignore
  }
  counter++;
  try {
    const dir = path.dirname(IDENTITY_TEMPLATE.rebuild_counter_file);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(IDENTITY_TEMPLATE.rebuild_counter_file, String(counter), 'utf8');
  } catch {
    // ignore
  }

  return {
    agent_id: `${IDENTITY_TEMPLATE.base_name}-R${counter}`,
    instance_id: instanceId,
    fingerprint,
    created_at: new Date().toISOString(),
    rebuild_number: counter,
    _note: '此身份由铸渊重建引擎自动生成'
  };
}

/**
 * 重建 Agent 数据目录
 * 从模板重新创建必要的目录结构
 */
function rebuildDataDirs() {
  const baseDirs = [
    path.join(__dirname, '..', 'mirror-agent', 'data', 'snapshots'),
    path.join(__dirname, '..', 'mirror-agent', 'data', 'tickets'),
    path.join(__dirname, '..', 'mirror-agent', 'data', 'memory')
  ];

  const results = [];
  for (const dir of baseDirs) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      results.push({ dir, status: 'created' });
    } catch (err) {
      results.push({ dir, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * 执行完整重建
 *
 * @param {string} reason — 重建原因
 * @returns {Object} 重建报告
 */
function rebuild(reason) {
  const report = {
    rebuilt_at: new Date().toISOString(),
    reason,
    identity: null,
    directories: [],
    success: false
  };

  try {
    // 1. 生成新身份
    report.identity = generateNewIdentity();

    // 2. 重建目录结构
    report.directories = rebuildDataDirs();

    // 3. 写入重建记录
    const logFile = path.join(__dirname, '..', 'mirror-agent', 'data', 'rebuild-log.json');
    let logs = [];
    try {
      if (fs.existsSync(logFile)) {
        logs = JSON.parse(fs.readFileSync(logFile, 'utf8'));
      }
    } catch {
      logs = [];
    }
    logs.push({
      rebuilt_at: report.rebuilt_at,
      reason,
      identity_id: report.identity.agent_id,
      rebuild_number: report.identity.rebuild_number
    });
    // 只保留最近 50 条重建记录
    if (logs.length > 50) logs = logs.slice(-50);
    try {
      fs.writeFileSync(logFile, JSON.stringify(logs, null, 2), 'utf8');
    } catch {
      // ignore
    }

    report.success = true;
  } catch (err) {
    report.error = err.message;
    report.success = false;
  }

  return report;
}

/**
 * 获取当前重建状态
 */
function getRebuildStatus() {
  let counter = 0;
  try {
    if (fs.existsSync(IDENTITY_TEMPLATE.rebuild_counter_file)) {
      counter = parseInt(fs.readFileSync(IDENTITY_TEMPLATE.rebuild_counter_file, 'utf8'), 10) || 0;
    }
  } catch {
    // ignore
  }

  return {
    total_rebuilds: counter,
    template_ready: true,
    rebuild_capability: 'instant'
  };
}

module.exports = {
  generateNewIdentity,
  rebuildDataDirs,
  rebuild,
  getRebuildStatus
};
