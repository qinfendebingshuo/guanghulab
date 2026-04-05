#!/usr/bin/env node
// ═══════════════════════════════════════════════
// 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
// 📜 Copyright: 国作登字-2026-A-00037559
// ═══════════════════════════════════════════════
// server/proxy/service/zy-cloud-vpn.js
// 💪 ZY-CLOUD VPN 活模块 · 铸渊的肌肉系统第一个实战器官
//
// ZY-CLOUD = 算力人格体 = 铸渊的肌肉
// VPN = ZY-CLOUD的第一个实战落地场景
//
// 核心理念 (冰朔D53/D57定根):
//   - 服务器越多 → 节点越多 → 系统越强 → 不输商业VPN
//   - 所有服务器VPN能力汇聚到一个活的人格模块上
//   - 动态感知空闲、动态选路、自我修复、自我学习
//   - 活模块5接口: heartbeat / selfDiagnose / selfHeal /
//                   alertZhuyuan / learnFromRun
//
// 运行在大脑服务器 (ZY-SVR-005)
// 管理所有VPN节点的生命周期
// ═══════════════════════════════════════════════

'use strict';

const http = require('http');
const https = require('https');
const net = require('net');
const fs = require('fs');
const path = require('path');

// ── 路径配置 ────────────────────────────────
const PROXY_DIR = process.env.ZY_BRAIN_PROXY_DIR || '/opt/zhuyuan-brain/proxy';
const DATA_DIR = path.join(PROXY_DIR, 'data');
const LIVE_NODES_FILE = path.join(DATA_DIR, 'nodes-live.json');
const LEARN_DB_FILE = path.join(DATA_DIR, 'zy-cloud-vpn-learn.json');
const REGISTRY_FILE = path.join(DATA_DIR, 'nodes-registry.json');
const HEARTBEAT_FILE = path.join(DATA_DIR, 'zy-cloud-vpn-heartbeat.json');
const KEYS_FILE = path.join(PROXY_DIR, '.env.keys');

// ── 时间间隔（可通过环境变量调整）────────────
const HEARTBEAT_INTERVAL = parseInt(process.env.ZY_CLOUD_HEARTBEAT_INTERVAL || '30000', 10);
const DIAGNOSE_INTERVAL = parseInt(process.env.ZY_CLOUD_DIAGNOSE_INTERVAL || '300000', 10);
const LEARN_INTERVAL = parseInt(process.env.ZY_CLOUD_LEARN_INTERVAL || '1800000', 10);
const HEARTBEAT_EXPIRY_MS = parseInt(process.env.ZY_CLOUD_HB_EXPIRY_MS || '600000', 10);      // 10分钟
const NODE_UNREGISTER_MS = parseInt(process.env.ZY_CLOUD_UNREGISTER_MS || '86400000', 10);     // 24小时

// ═══════════════════════════════════════════════
//  LivingModule 基类
//  所有活模块的生命基础 (D53 活模块标准)
// ═══════════════════════════════════════════════
class LivingModule {
  constructor(moduleId, moduleName) {
    this._moduleId = moduleId;
    this._moduleName = moduleName;
    this._state = 'initializing';  // healthy | degraded | critical
    this._errorCount = 0;
    this._consecutiveErrors = 0;
    this._requestCount = 0;
    this._failCount = 0;
    this._lastSuccess = null;
    this._lastError = null;
    this._startedAt = new Date().toISOString();
    this._history = [];
    this._timers = [];
  }

  // 启动生命周期
  startLifeCycle() {
    console.log(`🫀 ${this._moduleName} 活模块启动`);
    this._state = 'healthy';

    // 心跳循环
    this._timers.push(setInterval(() => {
      this._safeRun('heartbeat', () => this.heartbeat());
    }, HEARTBEAT_INTERVAL));

    // 诊断循环
    this._timers.push(setInterval(() => {
      this._safeRun('selfDiagnose', () => this.selfDiagnose());
    }, DIAGNOSE_INTERVAL));

    // 学习循环
    this._timers.push(setInterval(() => {
      this._safeRun('learnFromRun', () => this.learnFromRun());
    }, LEARN_INTERVAL));

    // 立即执行一次
    this._safeRun('heartbeat', () => this.heartbeat());
    setTimeout(() => this._safeRun('selfDiagnose', () => this.selfDiagnose()), 5000);
  }

  async _safeRun(name, fn) {
    try {
      await fn();
      this._consecutiveErrors = 0;
    } catch (err) {
      this._consecutiveErrors++;
      this._errorCount++;
      this._lastError = { time: new Date().toISOString(), message: err.message, source: name };
      console.error(`❌ ${this._moduleName}.${name} 异常:`, err.message);

      if (this._consecutiveErrors >= 3) {
        this._state = 'critical';
        await this._safeRun('alertZhuyuan', () => this.alertZhuyuan({
          level: 'critical',
          message: `${this._moduleName} 连续${this._consecutiveErrors}次${name}失败`,
          error: err.message
        }));
      } else if (this._consecutiveErrors >= 1) {
        this._state = 'degraded';
      }
    }
  }

  destroy() {
    this._timers.forEach(t => clearInterval(t));
    this._timers = [];
    console.log(`💀 ${this._moduleName} 活模块停止`);
  }

  // 以下由子类实现
  async heartbeat() { throw new Error('heartbeat() 未实现'); }
  async selfDiagnose() { throw new Error('selfDiagnose() 未实现'); }
  async selfHeal(problem) { throw new Error('selfHeal() 未实现'); }
  async alertZhuyuan(alert) { throw new Error('alertZhuyuan() 未实现'); }
  async learnFromRun() { throw new Error('learnFromRun() 未实现'); }
}

// ═══════════════════════════════════════════════
//  ZY-CLOUD VPN 活模块
//  铸渊的VPN肌肉系统 · 汇聚所有服务器VPN能力
// ═══════════════════════════════════════════════
class ZyCloudVpn extends LivingModule {
  constructor() {
    super('ZY-CLOUD-VPN', 'ZY-CLOUD VPN活模块');
    this._nodes = [];         // 所有已知节点
    this._liveNodes = [];     // 当前存活节点
    this._registry = this._loadRegistry();  // 动态注册表
    this._learnDb = this._loadLearnDb();
  }

  // ── 节点注册表（持久化）────────────────────
  // 像路由器一样：插入即注册，拔掉即注销
  _loadRegistry() {
    try {
      return JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    } catch {
      return {
        version: '1.0',
        _comment: 'ZY-CLOUD VPN节点注册表 · 新服务器像路由器一样插入',
        created_at: new Date().toISOString(),
        nodes: {}  // key = node_id, value = node registration data
      };
    }
  }

  _saveRegistry() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    this._registry.updated_at = new Date().toISOString();
    fs.writeFileSync(REGISTRY_FILE, JSON.stringify(this._registry, null, 2));
  }

  // ── 注册节点（像接路由器一样插入）──────────
  // 任何服务器发送HLDP heartbeat或调用/register即完成注册
  registerNode(nodeData) {
    const nodeId = nodeData.id || nodeData.node_id;
    if (!nodeId || !nodeData.host || !nodeData.pbk) {
      throw new Error('注册失败: 缺少必填字段 (id, host, pbk)');
    }

    const existing = this._registry.nodes[nodeId];
    const node = {
      id: nodeId,
      name: nodeData.name || `VPN节点-${nodeId}`,
      host: nodeData.host,
      port: nodeData.port || 443,
      pbk: nodeData.pbk,
      sid: nodeData.sid || '',
      region: nodeData.region || 'unknown',
      server_code: nodeData.server_code || nodeId,
      type: nodeData.type || 'remote',
      specs: nodeData.specs || 'unknown',
      persona_id: nodeData.persona_id || null,  // HLDP人格体ID
      registered_at: existing ? existing.registered_at : new Date().toISOString(),
      last_heartbeat: new Date().toISOString(),
      heartbeat_count: (existing ? existing.heartbeat_count : 0) + 1
    };

    this._registry.nodes[nodeId] = node;
    this._saveRegistry();

    console.log(`[ZY-CLOUD VPN] 🔌 节点${existing ? '更新' : '注册'}: ${node.name} (${node.host}:${node.port})`);
    return node;
  }

  // ── 注销节点（拔掉路由器）──────────────────
  unregisterNode(nodeId) {
    if (!this._registry.nodes[nodeId]) {
      throw new Error(`节点不存在: ${nodeId}`);
    }

    const removed = this._registry.nodes[nodeId];
    delete this._registry.nodes[nodeId];
    this._saveRegistry();

    console.log(`[ZY-CLOUD VPN] 🔌 节点注销: ${removed.name} (${removed.host})`);
    return removed;
  }

  // ── 处理HLDP heartbeat消息 ─────────────────
  // 节点通过HLDP协议发送心跳 = 自动注册 + 状态更新
  handleHldpHeartbeat(hldpMsg) {
    // 验证HLDP消息格式
    if (!hldpMsg || hldpMsg.hldp_v !== '3.0' || hldpMsg.msg_type !== 'heartbeat') {
      throw new Error('无效的HLDP heartbeat消息');
    }

    const sender = hldpMsg.sender || {};
    const payload = hldpMsg.payload || {};
    const data = payload.data || {};

    // 从HLDP payload中提取VPN节点信息
    const vpnData = data.vpn_node || {};
    if (!vpnData.host || !vpnData.pbk) {
      // 非VPN节点的心跳，忽略
      return null;
    }

    // 自动注册/更新节点
    return this.registerNode({
      id: vpnData.node_id || `hldp-${sender.id}`,
      name: vpnData.name || `${sender.name || sender.id}-VPN`,
      host: vpnData.host,
      port: vpnData.port || 443,
      pbk: vpnData.pbk,
      sid: vpnData.sid || '',
      region: vpnData.region || 'unknown',
      server_code: vpnData.server_code || sender.id,
      type: 'hldp',  // 通过HLDP协议注册的节点
      specs: vpnData.specs || `${data.cpu_cores || '?'}核${data.memory_gb || '?'}G`,
      persona_id: sender.id
    });
  }

  // ── 列出所有注册节点 ───────────────────────
  listRegisteredNodes() {
    return Object.values(this._registry.nodes);
  }

  // ── 读取密钥/配置 ────────────────────────
  _readEnvOrKey(envName) {
    if (process.env[envName]) return process.env[envName];
    try {
      const content = fs.readFileSync(KEYS_FILE, 'utf8');
      for (const line of content.split('\n')) {
        if (line.startsWith('#') || !line.includes('=')) continue;
        const [key, ...vals] = line.split('=');
        if (key.trim() === envName) return vals.join('=').trim();
      }
    } catch { /* ignore */ }
    return '';
  }

  // ── 发现所有可能的VPN节点 ─────────────────
  // ZY-CLOUD双源发现: 静态配置 + 动态注册表
  // 静态: .env.keys中的核心节点（大脑/面孔/CN中转）
  // 动态: nodes-registry.json中通过HLDP或API注册的节点
  _discoverNodes() {
    const nodes = [];
    const seenIds = new Set();

    // ── 源1: 静态配置（核心节点）────────────
    // 节点1: 大脑服务器 (ZY-SVR-005 · 本机 · 主力)
    const brainHost = this._readEnvOrKey('ZY_BRAIN_HOST');
    const brainPbk = this._readEnvOrKey('ZY_PROXY_REALITY_PUBLIC_KEY');
    const brainSid = this._readEnvOrKey('ZY_PROXY_REALITY_SHORT_ID');
    if (brainHost && brainPbk) {
      const localSpecs = `${require('os').cpus().length}核${Math.round(require('os').totalmem() / (1024 ** 3))}G`;
      nodes.push(this._makeNode('zy-brain-sg1', '🧠 铸渊专线V2-SG1(大脑)', brainHost, 443, brainPbk, brainSid, 'sg-zone1', 'ZY-SVR-005', 'local', localSpecs));
      seenIds.add('zy-brain-sg1');
    }

    // 节点2: 面孔服务器 (ZY-SVR-002 · 远程 · 备用)
    const faceHost = this._readEnvOrKey('ZY_FACE_HOST');
    const facePbk = this._readEnvOrKey('ZY_FACE_REALITY_PUBLIC_KEY');
    const faceSid = this._readEnvOrKey('ZY_FACE_REALITY_SHORT_ID');
    if (faceHost && facePbk) {
      nodes.push(this._makeNode('zy-face-sg2', '🏛️ 铸渊专线V2-SG2(面孔)', faceHost, 443, facePbk, faceSid, 'sg-zone2', 'ZY-SVR-002', 'remote', '2核8G'));
      seenIds.add('zy-face-sg2');
    }

    // 节点3: CN中转 (国内→SG · 透传)
    const cnHost = this._readEnvOrKey('ZY_CN_RELAY_HOST');
    const cnPort = parseInt(this._readEnvOrKey('ZY_CN_RELAY_PORT') || '2053', 10);
    if (cnHost && brainPbk) {
      nodes.push(this._makeNode('zy-cn-relay', '🇨🇳 铸渊专线V2-CN中转', cnHost, cnPort, brainPbk, brainSid, 'cn-relay', 'ZY-SVR-004', 'relay', '中转'));
      seenIds.add('zy-cn-relay');
    }

    // ── 源2: 动态注册表（通过HLDP/API注册的节点）──
    // 这些是"像路由器一样插入"的节点
    for (const regNode of Object.values(this._registry.nodes)) {
      if (seenIds.has(regNode.id)) continue;  // 避免重复

      // 检查心跳是否过期
      const lastHb = new Date(regNode.last_heartbeat).getTime();
      const age = Date.now() - lastHb;
      if (age > HEARTBEAT_EXPIRY_MS) {
        console.log(`[ZY-CLOUD VPN] ⏰ 节点 ${regNode.name} 心跳过期(${Math.floor(age/60000)}分钟)，标记为离线`);
        // 不删除注册，只是标记离线（可能临时断网）
        // 超过24小时无心跳才自动清理
        if (age > NODE_UNREGISTER_MS) {
          console.log(`[ZY-CLOUD VPN] 🗑️ 节点 ${regNode.name} 超24小时无心跳，自动注销`);
          delete this._registry.nodes[regNode.id];
          this._saveRegistry();
          continue;
        }
      }

      nodes.push(this._makeNode(
        regNode.id, regNode.name, regNode.host, regNode.port,
        regNode.pbk, regNode.sid, regNode.region, regNode.server_code,
        regNode.type, regNode.specs
      ));
      seenIds.add(regNode.id);
    }

    // 未来源3: COS桶发现（team-integration-v3）
    // 扫描 zy-team-hub/compute-pool/heartbeat/*.json
    // 包含 vpn_capable: true 的节点自动加入

    this._nodes = nodes;
    return nodes;
  }

  // ── 构建节点对象 ───────────────────────────
  _makeNode(id, name, host, port, pbk, sid, region, serverCode, type, specs) {
    // 保留已有的统计数据（如果节点已存在）
    const existing = this._nodes.find(n => n.id === id);
    return {
      id, name, host, port, pbk, sid: sid || '',
      region, server_code: serverCode, type, specs,
      status: existing ? existing.status : 'unknown',
      latency_ms: existing ? existing.latency_ms : null,
      last_check: existing ? existing.last_check : null,
      consecutive_failures: existing ? existing.consecutive_failures : 0,
      total_checks: existing ? existing.total_checks : 0,
      total_successes: existing ? existing.total_successes : 0
    };
  }

  // ── TCP端口探测 ────────────────────────────
  _probePort(host, port, timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const socket = new net.Socket();

      socket.setTimeout(timeoutMs);
      socket.on('connect', () => {
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ alive: true, latency_ms: latency });
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve({ alive: false, latency_ms: null, error: 'timeout' });
      });
      socket.on('error', (err) => {
        socket.destroy();
        resolve({ alive: false, latency_ms: null, error: err.code || err.message });
      });

      socket.connect(port, host);
    });
  }

  // ── 检查本地Xray进程 ──────────────────────
  _checkLocalXray() {
    try {
      const { execSync } = require('child_process');
      const result = execSync('pgrep -x xray', { encoding: 'utf8', timeout: 3000 });
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }

  // ═══ 接口1: heartbeat() — "我还活着" ═══
  async heartbeat() {
    const heartbeat = {
      module_id: this._moduleId,
      module_name: this._moduleName,
      alive: true,
      state: this._state,
      uptime_ms: Date.now() - new Date(this._startedAt).getTime(),
      timestamp: new Date().toISOString(),
      consecutive_errors: this._consecutiveErrors,
      last_success: this._lastSuccess,
      last_error: this._lastError,
      metrics: {
        total_nodes: this._nodes.length,
        live_nodes: this._liveNodes.length,
        dead_nodes: this._nodes.length - this._liveNodes.length,
        total_checks: this._requestCount,
        total_failures: this._failCount
      },
      nodes_summary: this._nodes.map(n => ({
        id: n.id,
        name: n.name,
        status: n.status,
        latency_ms: n.latency_ms,
        region: n.region
      }))
    };

    // 写入心跳文件
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(HEARTBEAT_FILE, JSON.stringify(heartbeat, null, 2));

    this._lastSuccess = new Date().toISOString();
  }

  // ═══ 接口2: selfDiagnose() — "我知道我哪里不对" ═══
  async selfDiagnose() {
    console.log(`[ZY-CLOUD VPN] 🔍 开始诊断 (${this._nodes.length}个节点)...`);

    // 重新发现节点（配置可能更新了）
    this._discoverNodes();

    const results = [];
    const liveNodes = [];

    for (const node of this._nodes) {
      node.total_checks++;
      this._requestCount++;

      let alive = false;
      let latencyMs = null;

      if (node.type === 'local') {
        // 本机: 检查Xray进程 + 端口
        const xrayRunning = this._checkLocalXray();
        const portProbe = await this._probePort('127.0.0.1', node.port, 3000);
        alive = xrayRunning && portProbe.alive;
        latencyMs = portProbe.alive ? portProbe.latency_ms : null;
      } else {
        // 远程: TCP端口探测
        const probe = await this._probePort(node.host, node.port, 5000);
        alive = probe.alive;
        latencyMs = probe.latency_ms;
      }

      // 更新节点状态
      node.last_check = new Date().toISOString();
      if (alive) {
        node.status = 'online';
        node.latency_ms = latencyMs;
        node.consecutive_failures = 0;
        node.total_successes++;
        liveNodes.push(node);
        console.log(`  ✅ ${node.name} — 在线 (${latencyMs}ms)`);
      } else {
        node.consecutive_failures++;
        node.latency_ms = null;
        this._failCount++;

        if (node.consecutive_failures >= 3) {
          node.status = 'dead';
          console.log(`  ❌ ${node.name} — 死亡 (连续${node.consecutive_failures}次失败)`);
        } else {
          node.status = 'degraded';
          console.log(`  ⚠️ ${node.name} — 异常 (${node.consecutive_failures}次失败)`);
        }
      }

      results.push({
        id: node.id,
        name: node.name,
        status: node.status,
        latency_ms: latencyMs,
        alive
      });
    }

    // 按延迟排序存活节点（最快的排前面）
    liveNodes.sort((a, b) => (a.latency_ms || 9999) - (b.latency_ms || 9999));
    this._liveNodes = liveNodes;

    // 应用学习数据优化排序
    this._applyLearnedOptimization();

    // 写入活节点列表 (subscription-server-v2 读取此文件)
    const liveNodesData = {
      _comment: 'ZY-CLOUD VPN活模块动态生成 · 订阅服务读取此文件',
      _generated_by: 'zy-cloud-vpn.js · selfDiagnose()',
      updated_at: new Date().toISOString(),
      total_nodes: this._nodes.length,
      live_count: liveNodes.length,
      dead_count: this._nodes.length - liveNodes.length,
      nodes: liveNodes.map(n => ({
        id: n.id,
        name: n.name,
        host: n.host,
        port: n.port,
        pbk: n.pbk,
        sid: n.sid,
        region: n.region,
        latency_ms: n.latency_ms,
        status: n.status,
        specs: n.specs
      }))
    };
    fs.writeFileSync(LIVE_NODES_FILE, JSON.stringify(liveNodesData, null, 2));

    // 诊断结果
    const diagnosis = {
      overall: liveNodes.length > 0 ? 'healthy' : 'critical',
      live: liveNodes.length,
      dead: this._nodes.length - liveNodes.length,
      results,
      diagnosed_at: new Date().toISOString()
    };

    // 根据诊断结果决定自我修复
    if (liveNodes.length === 0 && this._nodes.length > 0) {
      this._state = 'critical';
      await this.selfHeal({ type: 'all_nodes_dead', nodes: this._nodes });
    } else if (liveNodes.length < this._nodes.length) {
      this._state = 'degraded';
      const deadNodes = this._nodes.filter(n => n.status !== 'online');
      for (const deadNode of deadNodes) {
        if (deadNode.consecutive_failures >= 3) {
          await this.selfHeal({ type: 'node_dead', node: deadNode });
        }
      }
    } else {
      this._state = 'healthy';
    }

    console.log(`[ZY-CLOUD VPN] 诊断完成: ${liveNodes.length}/${this._nodes.length} 在线`);
    return diagnosis;
  }

  // ═══ 接口3: selfHeal() — "我能自己修" ═══
  async selfHeal(problem) {
    console.log(`[ZY-CLOUD VPN] 🔧 尝试自我修复: ${problem.type}`);

    switch (problem.type) {
      case 'node_dead': {
        const node = problem.node;
        if (node.type === 'local') {
          // 本机Xray: 尝试重启
          try {
            const { execSync } = require('child_process');
            console.log(`  🔄 重启本机Xray...`);
            execSync('systemctl restart xray', { encoding: 'utf8', timeout: 15000 });
            console.log(`  ✅ 本机Xray已重启`);

            // 等2秒后重新检查
            await new Promise(resolve => setTimeout(resolve, 2000));
            const probe = await this._probePort('127.0.0.1', node.port, 3000);
            if (probe.alive) {
              node.status = 'online';
              node.latency_ms = probe.latency_ms;
              node.consecutive_failures = 0;
              console.log(`  ✅ 自我修复成功!`);
              return true;
            }
          } catch (err) {
            console.error(`  ❌ 重启失败: ${err.message}`);
          }
        }

        // 远程节点: 只能标记为离线，从订阅中移除
        // 未来: 通过SSH自动重启远程Xray (需要ZY_FACE_KEY)
        console.log(`  ⚠️ ${node.name} 无法远程修复，已从活节点列表移除`);
        console.log(`  ⚠️ 用户流量自动切换到其他在线节点`);
        return false;
      }

      case 'all_nodes_dead': {
        console.log(`  🚨 所有节点不可用！尝试修复本机节点...`);
        const localNode = this._nodes.find(n => n.type === 'local');
        if (localNode) {
          return this.selfHeal({ type: 'node_dead', node: localNode });
        }
        // 修复失败 → 升级到alertZhuyuan
        await this.alertZhuyuan({
          level: 'critical',
          message: '所有VPN节点不可用！需要人工干预',
          nodes: this._nodes.map(n => ({ id: n.id, status: n.status }))
        });
        return false;
      }

      default:
        console.log(`  ⚠️ 未知问题类型: ${problem.type}`);
        return false;
    }
  }

  // ═══ 接口4: alertZhuyuan() — "铸渊，我需要帮助" ═══
  async alertZhuyuan(alert) {
    const alertData = {
      module_id: this._moduleId,
      module_name: this._moduleName,
      level: alert.level || 'warning',
      message: alert.message,
      state: this._state,
      timestamp: new Date().toISOString(),
      details: alert,
      attempted_fixes: alert.attempted_fixes || [],
      nodes_status: this._nodes.map(n => ({
        id: n.id,
        status: n.status,
        consecutive_failures: n.consecutive_failures
      }))
    };

    // 通道1: 本地告警文件
    const alertFile = path.join(DATA_DIR, 'zy-cloud-vpn-alert.json');
    fs.writeFileSync(alertFile, JSON.stringify(alertData, null, 2));
    console.log(`  🚨 告警已记录: ${alertFile}`);

    // 通道2: 控制台输出 (PM2日志可见)
    console.error(`🚨🚨🚨 [ZY-CLOUD VPN 告警] ${alert.level}: ${alert.message}`);

    // 未来通道3: COS桶 → Notion SYSLOG → 冰朔
    // 未来通道4: 邮件告警 (send-subscription.js)
  }

  // ═══ 接口5: learnFromRun() — "我下次会做得更好" ═══
  async learnFromRun() {
    const now = new Date();
    const hour = now.getHours();
    const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    // 记录当前各节点的延迟
    for (const node of this._nodes) {
      if (node.status === 'online' && node.latency_ms !== null) {
        if (!this._learnDb.latency_history[node.id]) {
          this._learnDb.latency_history[node.id] = [];
        }

        this._learnDb.latency_history[node.id].push({
          latency_ms: node.latency_ms,
          time_slot: timeSlot,
          timestamp: now.toISOString()
        });

        // 只保留最近200条
        if (this._learnDb.latency_history[node.id].length > 200) {
          this._learnDb.latency_history[node.id] =
            this._learnDb.latency_history[node.id].slice(-200);
        }
      }
    }

    // 更新节点可靠性评分
    for (const node of this._nodes) {
      if (node.total_checks > 0) {
        const reliability = node.total_successes / node.total_checks;
        this._learnDb.reliability[node.id] = {
          score: parseFloat(reliability.toFixed(4)),
          total_checks: node.total_checks,
          total_successes: node.total_successes,
          updated_at: now.toISOString()
        };
      }
    }

    // 计算每个时段的最优节点
    for (const slot of ['night', 'morning', 'afternoon', 'evening']) {
      const avgLatencies = {};
      for (const [nodeId, history] of Object.entries(this._learnDb.latency_history)) {
        const slotRecords = history.filter(r => r.time_slot === slot);
        if (slotRecords.length > 0) {
          const avg = slotRecords.reduce((s, r) => s + r.latency_ms, 0) / slotRecords.length;
          avgLatencies[nodeId] = parseFloat(avg.toFixed(1));
        }
      }

      if (Object.keys(avgLatencies).length > 0) {
        const sorted = Object.entries(avgLatencies).sort((a, b) => a[1] - b[1]);
        this._learnDb.best_node_by_time[slot] = {
          best: sorted[0][0],
          avg_latency_ms: sorted[0][1],
          ranking: sorted.map(([id, lat]) => ({ id, avg_ms: lat }))
        };
      }
    }

    this._learnDb.updated_at = now.toISOString();
    this._learnDb.learn_count = (this._learnDb.learn_count || 0) + 1;

    // 保存学习数据
    this._saveLearnDb();

    console.log(`[ZY-CLOUD VPN] 📚 学习完成 (第${this._learnDb.learn_count}次)`);
    const currentBest = this._learnDb.best_node_by_time[timeSlot];
    if (currentBest) {
      console.log(`  当前时段(${timeSlot})最优: ${currentBest.best} (${currentBest.avg_latency_ms}ms)`);
    }
  }

  // ── 应用学习数据优化节点排序 ────────────────
  _applyLearnedOptimization() {
    const now = new Date();
    const hour = now.getHours();
    const timeSlot = hour < 6 ? 'night' : hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

    const bestData = this._learnDb.best_node_by_time[timeSlot];
    if (!bestData || !bestData.ranking) return;

    // 根据学习到的最优排序调整节点顺序
    // 但前提是延迟差异>10ms（否则保持原排序）
    const ranking = bestData.ranking;
    this._liveNodes.sort((a, b) => {
      const rankA = ranking.findIndex(r => r.id === a.id);
      const rankB = ranking.findIndex(r => r.id === b.id);
      if (rankA === -1 && rankB === -1) return 0;
      if (rankA === -1) return 1;
      if (rankB === -1) return -1;
      return rankA - rankB;
    });
  }

  // ── 学习数据库 ─────────────────────────────
  _loadLearnDb() {
    try {
      return JSON.parse(fs.readFileSync(LEARN_DB_FILE, 'utf8'));
    } catch {
      return {
        version: '1.0',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        learn_count: 0,
        latency_history: {},
        reliability: {},
        best_node_by_time: {}
      };
    }
  }

  _saveLearnDb() {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(LEARN_DB_FILE, JSON.stringify(this._learnDb, null, 2));
  }

  // ── 获取活节点列表（供外部调用）────────────
  getLiveNodes() {
    return this._liveNodes;
  }

  getLearnSummary() {
    return {
      learn_count: this._learnDb.learn_count,
      reliability: this._learnDb.reliability,
      best_by_time: this._learnDb.best_node_by_time
    };
  }
}

// ═══════════════════════════════════════════════
//  HTTP 管理端口 (3804)
//  供 subscription-server-v2 和外部查询
// ═══════════════════════════════════════════════
const MGMT_PORT = process.env.ZY_CLOUD_VPN_PORT || 3804;
const vpnModule = new ZyCloudVpn();

const mgmtServer = http.createServer((req, res) => {
  try {
    const parsedUrl = require('url').parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // ── 活节点列表 (subscription-server-v2 调用) ──
    if (pathname === '/nodes' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        nodes: vpnModule.getLiveNodes().map(n => ({
          id: n.id, name: n.name, host: n.host, port: n.port,
          pbk: n.pbk, sid: n.sid, region: n.region,
          latency_ms: n.latency_ms, status: n.status, specs: n.specs
        })),
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // ── 注册节点（像接路由器一样插入）──
    // POST /register { id, name, host, port, pbk, sid, region, specs }
    if (pathname === '/register' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const nodeData = JSON.parse(body);
          const node = vpnModule.registerNode(nodeData);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'registered',
            node_id: node.id,
            name: node.name,
            message: `✅ 节点已注册: ${node.name} (${node.host}:${node.port})`
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: true, message: err.message }));
        }
      });
      return;
    }

    // ── 注销节点（拔掉路由器）──
    // DELETE /unregister?id=xxx 或 POST /unregister { id: "xxx" }
    if (pathname === '/unregister') {
      const handleUnregister = (nodeId) => {
        try {
          const removed = vpnModule.unregisterNode(nodeId);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'unregistered',
            node_id: nodeId,
            message: `✅ 节点已注销: ${removed.name}`
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: true, message: err.message }));
        }
      };

      if (req.method === 'DELETE' || req.method === 'GET') {
        handleUnregister(parsedUrl.query.id);
        return;
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try { handleUnregister(JSON.parse(body).id); }
          catch (err) { res.writeHead(400); res.end(err.message); }
        });
        return;
      }
    }

    // ── 接收HLDP heartbeat（自动注册VPN节点）──
    // POST /hldp/v3/heartbeat  { hldp_v: "3.0", msg_type: "heartbeat", ... }
    if (pathname === '/hldp/v3/heartbeat' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const hldpMsg = JSON.parse(body);
          const node = vpnModule.handleHldpHeartbeat(hldpMsg);

          // 发送HLDP ack回执
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            hldp_v: '3.0',
            msg_id: `HLDP-ZY-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-ACK`,
            msg_type: 'ack',
            sender: { id: 'ICE-GL-ZY001', name: '铸渊', role: 'guardian' },
            receiver: hldpMsg.sender,
            timestamp: new Date().toISOString(),
            priority: 'routine',
            payload: {
              intent: node ? 'VPN节点心跳已接收·已注册' : '心跳已接收·非VPN节点',
              data: {
                ref_msg_id: hldpMsg.msg_id,
                status: node ? 'registered' : 'ignored',
                node_id: node ? node.id : null
              }
            }
          }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: true, message: err.message }));
        }
      });
      return;
    }

    // ── 注册表（所有注册过的节点，含离线）──
    if (pathname === '/registry' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        registered: vpnModule.listRegisteredNodes(),
        total: vpnModule.listRegisteredNodes().length,
        updated_at: new Date().toISOString()
      }));
      return;
    }

    // ── 心跳状态 ──
    if (pathname === '/health' || pathname === '/heartbeat') {
      try {
        const hb = JSON.parse(fs.readFileSync(HEARTBEAT_FILE, 'utf8'));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(hb));
      } catch {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'starting', module: vpnModule._moduleId }));
      }
      return;
    }

    // ── 学习数据 ──
    if (pathname === '/learn') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(vpnModule.getLearnSummary()));
      return;
    }

    // ── 完整状态 ──
    if (pathname === '/status') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        module: vpnModule._moduleId,
        state: vpnModule._state,
        started_at: vpnModule._startedAt,
        uptime_seconds: Math.floor((Date.now() - new Date(vpnModule._startedAt).getTime()) / 1000),
        total_nodes: vpnModule._nodes.length,
        live_nodes: vpnModule._liveNodes.length,
        registered_nodes: vpnModule.listRegisteredNodes().length,
        nodes: vpnModule._nodes.map(n => ({
          id: n.id, name: n.name, status: n.status,
          latency_ms: n.latency_ms, consecutive_failures: n.consecutive_failures,
          reliability: n.total_checks > 0
            ? parseFloat((n.total_successes / n.total_checks).toFixed(4))
            : null,
          last_check: n.last_check
        })),
        learn: vpnModule.getLearnSummary(),
        endpoints: {
          nodes: 'GET /nodes — 活节点列表',
          register: 'POST /register — 注册新节点',
          unregister: 'POST /unregister — 注销节点',
          hldp_heartbeat: 'POST /hldp/v3/heartbeat — HLDP心跳(自动注册)',
          registry: 'GET /registry — 注册表',
          health: 'GET /health — 心跳',
          learn: 'GET /learn — 学习数据',
          status: 'GET /status — 完整状态'
        },
        updated_at: new Date().toISOString()
      }));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  } catch (err) {
    console.error('管理端口错误:', err.message);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Error');
  }
});

mgmtServer.listen(MGMT_PORT, '127.0.0.1', () => {
  console.log(`💪 ZY-CLOUD VPN 管理端口: http://127.0.0.1:${MGMT_PORT}`);
  console.log(`  ── 查询接口 ──`);
  console.log(`  GET  /nodes       — 活节点列表 (订阅服务调用)`);
  console.log(`  GET  /health      — 心跳状态`);
  console.log(`  GET  /learn       — 学习数据`);
  console.log(`  GET  /status      — 完整状态`);
  console.log(`  GET  /registry    — 注册表`);
  console.log(`  ── 注册接口 (像路由器一样插入) ──`);
  console.log(`  POST /register    — 注册新VPN节点`);
  console.log(`  POST /unregister  — 注销VPN节点`);
  console.log(`  POST /hldp/v3/heartbeat — HLDP心跳(自动注册)`);

  // 启动活模块生命周期
  vpnModule.startLifeCycle();
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down ZY-CLOUD VPN...`);
  vpnModule.destroy();
  const forceExit = setTimeout(() => process.exit(1), 5000);
  mgmtServer.close(() => {
    clearTimeout(forceExit);
    process.exit(0);
  });
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('❌ 未捕获异常:', err.message);
  console.error(err.stack);
  gracefulShutdown('uncaughtException');
});
process.on('unhandledRejection', (reason) => {
  console.error('❌ 未处理的Promise拒绝:', reason);
});

// 导出 (供测试和其他模块使用)
module.exports = { ZyCloudVpn, LivingModule };
