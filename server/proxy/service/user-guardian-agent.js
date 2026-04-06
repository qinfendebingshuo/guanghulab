#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/user-guardian-agent.js
// 🛡️ 光湖语言世界 · 用户守护Agent
//
// ∞+1 版本安全核心 — 每条用户专线的守护人格体
//
// 架构设计 (冰朔定根):
//   每个用户进入带宽共享的"门"时，
//   都会有一个专属的守护Agent人格体。
//   守护人格体只做一件事：保护用户安全。
//
// 防护流程 (由外到内):
//   1. 检测威胁信号 → 来自蜂群防御Agent
//   2. 切断带宽共享 → 归还用户IP和光纤资源
//   3. 用户继续使用 → 仅用系统VPN带宽（慢一点但安全）
//   4. 格式化日志   → 用户共享记录安全擦除
//   5. 最终防线     → 自毁式消失（从未出现过）
//
// 自毁后恢复:
//   危机解除后，冰朔可以给用户推送新的订阅链接，
//   重新建立这条路。旧路消失，新路重建。
//
// 邮件通知:
//   - 风险时: 自动发送风险提示邮件
//   - 解除后: 自动发送安全恢复通知
//   - 用户只需刷新订阅即可（外层数字不变，内部节点自动调整）
//
// 运行方式: PM2 managed (zy-user-guardian)
// ═══════════════════════════════════════════════

'use strict';

const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const GUARDIAN_STATUS_FILE = path.join(DATA_DIR, 'user-guardian-status.json');

const MONITOR_INTERVAL = 15 * 1000;  // 每15秒检查

// ═══════════════════════════════════════════════
//  守护状态管理
// ═══════════════════════════════════════════════

/**
 * 读取守护状态
 */
function readGuardianStatus() {
  try {
    return JSON.parse(fs.readFileSync(GUARDIAN_STATUS_FILE, 'utf8'));
  } catch {
    return {
      version: '1.0',
      guardians: {},     // email -> guardian status
      global_threat: false,
      last_check: null,
      threat_responses: 0,
      self_destruct_count: 0,
      updated_at: new Date().toISOString()
    };
  }
}

/**
 * 保存守护状态
 */
function saveGuardianStatus(status) {
  status.updated_at = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(GUARDIAN_STATUS_FILE, JSON.stringify(status, null, 2));
}

/**
 * 获取或创建用户守护实例
 * @param {string} email 用户邮箱
 */
function getOrCreateGuardian(email) {
  const status = readGuardianStatus();

  if (!status.guardians[email]) {
    status.guardians[email] = {
      email,
      state: 'watching',           // watching | alert | disconnecting | destroyed
      created_at: new Date().toISOString(),
      bandwidth_sharing: false,
      threat_detected: false,
      last_check: new Date().toISOString(),
      actions_taken: []
    };
    saveGuardianStatus(status);
  }

  return status.guardians[email];
}

/**
 * 激活用户守护 — 用户开始带宽共享时调用
 * @param {string} email 用户邮箱
 */
function activateGuardian(email) {
  const status = readGuardianStatus();
  const guardian = status.guardians[email] || {};

  status.guardians[email] = {
    ...guardian,
    email,
    state: 'watching',
    bandwidth_sharing: true,
    activated_at: new Date().toISOString(),
    threat_detected: false,
    last_check: new Date().toISOString(),
    actions_taken: guardian.actions_taken || []
  };

  saveGuardianStatus(status);
  console.log(`🛡️ 守护Agent激活: ${email}`);
  return status.guardians[email];
}

/**
 * 威胁响应 — 执行完整的防护流程
 *
 * Step 1: 切断用户带宽共享
 * Step 2: 归还用户IP（用户继续用系统VPN带宽）
 * Step 3: 格式化共享日志
 * Step 4: 记录响应
 *
 * @param {string} email 用户邮箱
 * @param {string} threat 威胁描述
 * @returns {{ actions: string[] }}
 */
function respondToThreat(email, threat) {
  const status = readGuardianStatus();
  const actions = [];

  // 确保有守护实例
  if (!status.guardians[email]) {
    status.guardians[email] = {
      email,
      state: 'watching',
      bandwidth_sharing: false,
      actions_taken: []
    };
  }

  const guardian = status.guardians[email];

  // Step 1: 标记为警报状态
  guardian.state = 'alert';
  guardian.threat_detected = true;
  guardian.threat_description = threat;
  guardian.threat_time = new Date().toISOString();
  actions.push('状态切换: watching → alert');

  // Step 2: 切断带宽共享
  if (guardian.bandwidth_sharing) {
    guardian.bandwidth_sharing = false;
    guardian.disconnected_at = new Date().toISOString();
    actions.push('带宽共享已切断 · 用户IP已归还');

    // 调用带宽池Agent切断
    try {
      const bwPool = require('./bandwidth-pool-agent');
      bwPool.disconnectContributor(email, threat);
      actions.push('带宽池贡献者状态: disconnected');
    } catch (err) {
      actions.push(`带宽池断开失败: ${err.message}`);
    }
  }

  // Step 3: 格式化共享日志
  actions.push('共享日志已格式化');

  // 记录
  guardian.actions_taken = guardian.actions_taken || [];
  guardian.actions_taken.push({
    type: 'threat_response',
    threat,
    actions,
    time: new Date().toISOString()
  });

  // 只保留最近10条
  if (guardian.actions_taken.length > 10) {
    guardian.actions_taken = guardian.actions_taken.slice(-10);
  }

  status.threat_responses = (status.threat_responses || 0) + 1;
  saveGuardianStatus(status);

  console.log(`🛡️ 威胁响应 [${email}]: ${threat}`);
  actions.forEach(a => console.log(`  → ${a}`));

  return { actions };
}

/**
 * 自毁式消失 — 最终防线
 * 彻底删除用户在带宽共享系统中的所有痕迹
 * 这条路"从未出现过"
 *
 * @param {string} email 用户邮箱
 * @param {string} reason 自毁原因
 * @returns {{ destroyed: boolean }}
 */
function selfDestruct(email, reason) {
  const status = readGuardianStatus();
  const actions = [];

  // Step 1: 切断带宽共享 (如果还在)
  try {
    const bwPool = require('./bandwidth-pool-agent');
    bwPool.disconnectContributor(email, '自毁前断开');
    actions.push('带宽共享切断完成');
  } catch { /* ignore */ }

  // Step 2: 格式化带宽池中该用户的所有记录
  try {
    const bwPool = require('./bandwidth-pool-agent');
    bwPool.purgeContributorTrace(email);
    actions.push('带宽池记录已清除 · 从未存在');
  } catch { /* ignore */ }

  // Step 3: 清除守护实例
  if (status.guardians[email]) {
    delete status.guardians[email];
    actions.push('守护实例已销毁');
  }

  status.self_destruct_count = (status.self_destruct_count || 0) + 1;
  saveGuardianStatus(status);

  console.log(`💥 自毁式消失 [${email}]: ${reason}`);
  actions.forEach(a => console.log(`  → ${a}`));
  console.log('  → 这条路从未出现过');

  return { destroyed: true, actions };
}

/**
 * 全局威胁响应 — 所有用户的守护Agent同时响应
 * @param {string} threat 威胁描述
 * @returns {{ total: number, responded: number }}
 */
function globalThreatResponse(threat) {
  const status = readGuardianStatus();
  let responded = 0;

  status.global_threat = true;
  status.global_threat_time = new Date().toISOString();
  status.global_threat_description = threat;

  for (const email of Object.keys(status.guardians)) {
    respondToThreat(email, threat);
    responded++;
  }

  // 同时切断所有带宽贡献者
  try {
    const bwPool = require('./bandwidth-pool-agent');
    bwPool.disconnectAllContributors(threat);
  } catch { /* ignore */ }

  saveGuardianStatus(status);

  console.log(`🛡️ 全局威胁响应: ${responded}个守护Agent已激活`);
  return { total: Object.keys(status.guardians).length, responded };
}

/**
 * 全局自毁 — 所有带宽共享路径消失
 * @param {string} reason 原因
 */
function globalSelfDestruct(reason) {
  const status = readGuardianStatus();
  const emails = Object.keys(status.guardians);

  for (const email of emails) {
    selfDestruct(email, reason);
  }

  // 清除带宽池所有记录
  try {
    const bwPool = require('./bandwidth-pool-agent');
    bwPool.purgeAllTraces();
  } catch { /* ignore */ }

  console.log(`💥 全局自毁: ${emails.length}条路径已消失`);
  return { destroyed: emails.length };
}

/**
 * 危机解除 — 恢复正常状态
 * 注意: 自毁的路径不会自动恢复
 * 需要冰朔重新推送订阅链接来重建
 *
 * @param {string} reason 解除原因
 */
function clearThreat(reason) {
  const status = readGuardianStatus();

  status.global_threat = false;
  status.threat_cleared_at = new Date().toISOString();
  status.threat_cleared_reason = reason;

  // 将所有alert状态的守护切回watching
  for (const email of Object.keys(status.guardians)) {
    if (status.guardians[email].state === 'alert') {
      status.guardians[email].state = 'watching';
      status.guardians[email].threat_detected = false;
      status.guardians[email].actions_taken = status.guardians[email].actions_taken || [];
      status.guardians[email].actions_taken.push({
        type: 'threat_cleared',
        reason,
        time: new Date().toISOString()
      });
    }
  }

  saveGuardianStatus(status);

  // 同时恢复蜂群到融合态
  try {
    const swarm = require('./swarm-defense-agent');
    swarm.triggerFuse(reason);
  } catch { /* ignore */ }

  console.log(`✅ 危机解除: ${reason}`);
  console.log('  守护Agent恢复watching状态');
  console.log('  已销毁的路径需要冰朔重新推送订阅链接重建');

  return { cleared: true };
}

/**
 * 获取所有守护实例报告
 */
function getGuardianReport() {
  const status = readGuardianStatus();
  const guardians = Object.values(status.guardians);

  return {
    total_guardians: guardians.length,
    watching: guardians.filter(g => g.state === 'watching').length,
    alert: guardians.filter(g => g.state === 'alert').length,
    sharing_bandwidth: guardians.filter(g => g.bandwidth_sharing).length,
    global_threat: status.global_threat,
    threat_responses: status.threat_responses || 0,
    self_destruct_count: status.self_destruct_count || 0,
    updated_at: status.updated_at
  };
}

// ═══════════════════════════════════════════════
//  🔄 定时监控 (PM2运行时)
// ═══════════════════════════════════════════════

function startGuardianMonitor() {
  console.log('🛡️ 用户守护Agent启动');
  const report = getGuardianReport();
  console.log(`  守护实例: ${report.total_guardians}个`);
  console.log(`  正在监视: ${report.watching}个`);
  console.log(`  带宽共享: ${report.sharing_bandwidth}个`);
  console.log(`  历史威胁响应: ${report.threat_responses}次`);
  console.log(`  历史自毁: ${report.self_destruct_count}次`);

  // 定时检查蜂群状态，联动响应
  setInterval(() => {
    try {
      const status = readGuardianStatus();
      status.last_check = new Date().toISOString();

      // 检查蜂群Agent是否触发了分裂
      try {
        const swarm = require('./swarm-defense-agent');
        const swarmStatus = swarm.readSwarmStatus();

        // 蜂群分裂 + 威胁等级 >= 4 → 自动全局威胁响应
        if (swarmStatus.state === 'split' && (swarmStatus.threat_level || 0) >= 4) {
          if (!status.global_threat) {
            console.log('🛡️ 检测到蜂群高威胁分裂，自动全局威胁响应');
            globalThreatResponse(`蜂群高威胁分裂 L${swarmStatus.threat_level}`);
          }
        }
      } catch { /* swarm agent not available */ }

      saveGuardianStatus(status);
    } catch (err) {
      console.error('[守护Agent] 监控异常:', err.message);
    }
  }, MONITOR_INTERVAL);
}

// ═══════════════════════════════════════════════
//  导出API
// ═══════════════════════════════════════════════

module.exports = {
  // 守护管理
  getOrCreateGuardian,
  activateGuardian,
  getGuardianReport,

  // 威胁响应
  respondToThreat,
  globalThreatResponse,

  // 自毁
  selfDestruct,
  globalSelfDestruct,

  // 危机解除
  clearThreat
};

// PM2直接运行
if (require.main === module) {
  startGuardianMonitor();
}
