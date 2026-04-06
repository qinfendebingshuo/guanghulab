#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/swarm-defense-agent.js
// 🐝 光湖语言世界 · 蜂群防御Agent
//
// ∞+1 版本安全核心 — 多服务器融合/分裂防御系统
//
// 架构设计 (冰朔定根):
//   所有串联的服务器组成一个巨大的VPN动态Agent节点。
//   正常模式: 融合态 — 所有节点对外统一入口
//   危机模式: 分裂态 — 瞬间分布为多个动态加密节点
//     - 只有一个是真的，其余是诱饵
//     - 真节点在诱饵间随机跳转
//     - 只接收TCS编程语言指令（冰朔专属）
//
// 安全层级:
//   L0: 语言膜 (TCS指令授权)
//   L1: 融合/分裂切换 (Moving Target Defense)
//   L2: 真节点隐匿 (随机跳转)
//   L3: 用户守护Agent (每线守护)
//   L4: 威胁切断 (切断用户带宽共享)
//   L5: 日志格式化 (安全擦除)
//   L6: 自毁式消失 (从未存在过)
//   L7: 邮件通知 (风险提示/安全恢复)
//
// 运行方式: PM2 managed (zy-swarm-defense)
// ═══════════════════════════════════════════════

'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const SWARM_STATUS_FILE = path.join(DATA_DIR, 'swarm-defense-status.json');
const DEFENSE_LOG_FILE = path.join(DATA_DIR, 'swarm-defense-log.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'nodes-registry.json');
const LIVE_NODES_FILE = path.join(DATA_DIR, 'nodes-live.json');

const MONITOR_INTERVAL = 30 * 1000;       // 每30秒监控
const DECOY_ROTATE_INTERVAL = 60 * 1000;  // 分裂态下每60秒切换真节点位置

// ═══════════════════════════════════════════════
//  蜂群状态机
//  FUSED (融合态) ↔ SPLIT (分裂态)
// ═══════════════════════════════════════════════

const SWARM_STATES = {
  FUSED: 'fused',     // 正常·融合态 — 所有节点组成一个巨型Agent
  SPLIT: 'split',     // 危机·分裂态 — 分裂为多个诱饵+1个真节点
  RECOVERING: 'recovering'  // 恢复中 — 从分裂态回到融合态
};

/**
 * 读取蜂群状态
 */
function readSwarmStatus() {
  try {
    return JSON.parse(fs.readFileSync(SWARM_STATUS_FILE, 'utf8'));
  } catch {
    return {
      state: SWARM_STATES.FUSED,
      active_node_id: null,           // 分裂态下的真节点ID
      decoy_nodes: [],                // 诱饵节点列表
      last_rotate: null,              // 上次真节点跳转时间
      threat_level: 0,                // 威胁等级 0-5
      threat_events: [],              // 近期威胁事件
      split_count: 0,                 // 历史分裂次数
      last_split: null,               // 上次分裂时间
      last_fuse: null,                // 上次融合时间
      updated_at: new Date().toISOString()
    };
  }
}

/**
 * 保存蜂群状态
 */
function saveSwarmStatus(status) {
  status.updated_at = new Date().toISOString();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(SWARM_STATUS_FILE, JSON.stringify(status, null, 2));
}

/**
 * 记录防御日志
 */
function logDefenseEvent(type, detail) {
  let log;
  try {
    log = JSON.parse(fs.readFileSync(DEFENSE_LOG_FILE, 'utf8'));
  } catch {
    log = { events: [] };
  }

  log.events.push({
    type,
    detail,
    time: new Date().toISOString()
  });

  if (log.events.length > 100) {
    log.events = log.events.slice(-100);
  }

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DEFENSE_LOG_FILE, JSON.stringify(log, null, 2));
}

// ═══════════════════════════════════════════════
//  🔗 融合态管理
// ═══════════════════════════════════════════════

/**
 * 获取所有已注册节点
 */
function getRegisteredNodes() {
  try {
    const data = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    return data.nodes || [];
  } catch {
    return [];
  }
}

/**
 * 获取活跃节点
 */
function getLiveNodes() {
  try {
    const data = JSON.parse(fs.readFileSync(LIVE_NODES_FILE, 'utf8'));
    return data.nodes || [];
  } catch {
    return [];
  }
}

/**
 * 融合态状态报告
 * 所有节点组成一个统一的巨型Agent
 */
function getFusedStatus() {
  const nodes = getLiveNodes();
  const registered = getRegisteredNodes();

  return {
    mode: 'MEGA-NODE',
    description: '所有服务器融合为统一VPN动态Agent节点',
    live_nodes: nodes.length,
    registered_nodes: registered.length,
    unified_entry: true,
    smart_routing: nodes.length > 1 ? 'url-test' : 'single'
  };
}

// ═══════════════════════════════════════════════
//  ⚡ 分裂态管理 (Moving Target Defense)
// ═══════════════════════════════════════════════

/**
 * 触发分裂 — 从融合态切换到分裂态
 * @param {string} reason 分裂原因
 * @returns {{ success: boolean, active_node: string, decoy_count: number }}
 */
function triggerSplit(reason) {
  const status = readSwarmStatus();

  if (status.state === SWARM_STATES.SPLIT) {
    return { success: false, error: '已处于分裂态' };
  }

  const nodes = getLiveNodes();
  if (nodes.length === 0) {
    return { success: false, error: '无可用节点' };
  }

  // 随机选择一个真节点
  const activeIndex = crypto.randomInt(0, nodes.length);
  const activeNode = nodes[activeIndex];

  // 其余为诱饵
  const decoyNodes = nodes
    .filter((_, i) => i !== activeIndex)
    .map(n => ({
      id: n.id,
      name: n.name,
      type: 'decoy',
      decoy_since: new Date().toISOString()
    }));

  status.state = SWARM_STATES.SPLIT;
  status.active_node_id = activeNode.id;
  status.decoy_nodes = decoyNodes;
  status.last_rotate = Date.now();
  status.threat_level = Math.min((status.threat_level || 0) + 2, 5);
  status.split_count = (status.split_count || 0) + 1;
  status.last_split = new Date().toISOString();
  status.split_reason = reason;

  status.threat_events = status.threat_events || [];
  status.threat_events.push({
    type: 'split_triggered',
    reason,
    active_node: activeNode.id,
    decoy_count: decoyNodes.length,
    time: new Date().toISOString()
  });

  // 只保留最近20条威胁事件
  if (status.threat_events.length > 20) {
    status.threat_events = status.threat_events.slice(-20);
  }

  saveSwarmStatus(status);
  logDefenseEvent('SPLIT', `分裂触发: ${reason} | 真节点: ${activeNode.id} | 诱饵: ${decoyNodes.length}个`);

  console.log(`🐝 蜂群分裂! 原因: ${reason}`);
  console.log(`  真节点: ${activeNode.id} (${activeNode.name})`);
  console.log(`  诱饵节点: ${decoyNodes.length}个`);

  return {
    success: true,
    active_node: activeNode.id,
    decoy_count: decoyNodes.length
  };
}

/**
 * 真节点随机跳转 — 在分裂态下切换真节点位置
 * 只在分裂态下有效
 */
function rotateActiveNode() {
  const status = readSwarmStatus();

  if (status.state !== SWARM_STATES.SPLIT) {
    return { rotated: false, reason: '非分裂态' };
  }

  const nodes = getLiveNodes();
  if (nodes.length <= 1) {
    return { rotated: false, reason: '节点不足' };
  }

  // 当前真节点变为诱饵
  const oldActiveId = status.active_node_id;

  // 从所有节点中排除当前真节点，随机选新的
  const candidates = nodes.filter(n => n.id !== oldActiveId);
  if (candidates.length === 0) {
    return { rotated: false, reason: '无候选节点' };
  }

  const newActive = candidates[crypto.randomInt(0, candidates.length)];

  // 更新状态
  status.active_node_id = newActive.id;
  status.last_rotate = Date.now();

  // 重建诱饵列表
  status.decoy_nodes = nodes
    .filter(n => n.id !== newActive.id)
    .map(n => ({
      id: n.id,
      name: n.name,
      type: 'decoy',
      decoy_since: new Date().toISOString()
    }));

  saveSwarmStatus(status);
  logDefenseEvent('ROTATE', `真节点跳转: ${oldActiveId} → ${newActive.id}`);

  return { rotated: true, old: oldActiveId, new: newActive.id };
}

/**
 * 触发融合 — 从分裂态恢复到融合态
 * @param {string} reason 融合原因 (如: 危机解除)
 * @returns {{ success: boolean }}
 */
function triggerFuse(reason) {
  const status = readSwarmStatus();

  if (status.state === SWARM_STATES.FUSED) {
    return { success: false, error: '已处于融合态' };
  }

  status.state = SWARM_STATES.FUSED;
  status.active_node_id = null;
  status.decoy_nodes = [];
  status.threat_level = 0;
  status.last_fuse = new Date().toISOString();
  status.fuse_reason = reason;

  status.threat_events = status.threat_events || [];
  status.threat_events.push({
    type: 'fuse_triggered',
    reason,
    time: new Date().toISOString()
  });

  saveSwarmStatus(status);
  logDefenseEvent('FUSE', `融合恢复: ${reason}`);

  console.log(`🐝 蜂群融合! 原因: ${reason}`);
  console.log('  所有节点重新组成统一巨型Agent');

  return { success: true };
}

/**
 * 提升威胁等级
 * @param {number} increment 增量 (默认1)
 * @param {string} reason 原因
 */
function escalateThreat(increment, reason) {
  const status = readSwarmStatus();
  const oldLevel = status.threat_level || 0;
  status.threat_level = Math.min(oldLevel + (increment || 1), 5);

  status.threat_events = status.threat_events || [];
  status.threat_events.push({
    type: 'threat_escalation',
    old_level: oldLevel,
    new_level: status.threat_level,
    reason,
    time: new Date().toISOString()
  });

  if (status.threat_events.length > 20) {
    status.threat_events = status.threat_events.slice(-20);
  }

  saveSwarmStatus(status);
  logDefenseEvent('ESCALATE', `威胁升级: L${oldLevel}→L${status.threat_level} | ${reason}`);

  // 威胁等级3以上自动触发分裂
  if (status.threat_level >= 3 && status.state === SWARM_STATES.FUSED) {
    console.log('⚠️ 威胁等级 ≥ 3，自动触发蜂群分裂');
    triggerSplit(`自动分裂: 威胁等级${status.threat_level} - ${reason}`);
  }

  return status.threat_level;
}

/**
 * 获取当前蜂群完整状态
 */
function getSwarmReport() {
  const status = readSwarmStatus();
  const nodes = getLiveNodes();
  const registered = getRegisteredNodes();

  return {
    state: status.state,
    threat_level: status.threat_level || 0,
    live_nodes: nodes.length,
    registered_nodes: registered.length,
    active_node: status.state === SWARM_STATES.SPLIT ? status.active_node_id : null,
    decoy_count: status.state === SWARM_STATES.SPLIT ? status.decoy_nodes.length : 0,
    split_count: status.split_count || 0,
    last_split: status.last_split,
    last_fuse: status.last_fuse,
    updated_at: status.updated_at
  };
}

// ═══════════════════════════════════════════════
//  🔄 定时监控 (PM2运行时)
// ═══════════════════════════════════════════════

let rotateTimer = null;

function startSwarmMonitor() {
  console.log('🐝 蜂群防御Agent启动');
  const status = readSwarmStatus();
  console.log(`  当前状态: ${status.state}`);
  console.log(`  威胁等级: L${status.threat_level || 0}`);
  console.log(`  历史分裂: ${status.split_count || 0}次`);

  // 主监控循环
  setInterval(() => {
    try {
      const s = readSwarmStatus();

      // 分裂态下执行真节点随机跳转
      if (s.state === SWARM_STATES.SPLIT) {
        const timeSinceRotate = Date.now() - (s.last_rotate || 0);
        if (timeSinceRotate >= DECOY_ROTATE_INTERVAL) {
          const result = rotateActiveNode();
          if (result.rotated) {
            console.log(`🔄 真节点跳转: ${result.old} → ${result.new}`);
          }
        }
      }

      // 融合态下监控异常 (基础检查)
      if (s.state === SWARM_STATES.FUSED) {
        const nodes = getLiveNodes();
        if (nodes.length === 0) {
          console.warn('⚠️ 融合态无活跃节点');
        }
      }
    } catch (err) {
      console.error('[蜂群] 监控异常:', err.message);
    }
  }, MONITOR_INTERVAL);
}

// ═══════════════════════════════════════════════
//  导出API
// ═══════════════════════════════════════════════

module.exports = {
  // 状态查询
  readSwarmStatus,
  getSwarmReport,
  getFusedStatus,
  getLiveNodes,
  getRegisteredNodes,

  // 分裂/融合操作
  triggerSplit,
  triggerFuse,
  rotateActiveNode,

  // 威胁管理
  escalateThreat,

  // 日志
  logDefenseEvent,

  // 常量
  SWARM_STATES
};

// PM2直接运行
if (require.main === module) {
  startSwarmMonitor();
}
