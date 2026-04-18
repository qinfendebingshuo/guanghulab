/**
 * ═══════════════════════════════════════════════════════════
 * 铸渊哨兵 · 永久记忆系统 · Persistent Memory
 * ═══════════════════════════════════════════════════════════
 *
 * 跨重启持久化记忆层
 * 所有 Agent 知识、事件、修复记录都存储在这里
 * 记忆文件: {DATA_DIR}/sentinel/memory.json
 *
 * 守护: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════════════════
 */

'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_MEMORY = {
  agent_id: 'ZY-SENTINEL-001',
  agent_name: '铸渊哨兵',
  born_at: null,
  memory_version: 1,
  last_save: null,

  // 书源运行时状态
  sources: {
    'fanqie-direct': {
      primary_host: 'fanqienovel.com',
      backup_hosts: [],
      active_host: 'fanqienovel.com',
      status: 'unknown',
      last_check: null,
      consecutive_failures: 0,
      total_checks: 0,
      total_successes: 0,
      search_strategy: 'api',
      catalog_strategy: 'api',
      chapter_strategy: 'api',
      last_latency_ms: null
    },
    'qimao-direct': {
      primary_host: 'www.qimao.com',
      backup_hosts: [],
      active_host: 'www.qimao.com',
      status: 'unknown',
      last_check: null,
      consecutive_failures: 0,
      total_checks: 0,
      total_successes: 0,
      search_strategy: 'api',
      catalog_strategy: 'scrape',
      chapter_strategy: 'scrape',
      aes_key: '32343263636238323330643730396531',
      last_latency_ms: null
    },
    'biquge-direct': {
      primary_host: '69shu.buzs.cc',
      backup_hosts: [],
      active_host: '69shu.buzs.cc',
      status: 'unknown',
      last_check: null,
      consecutive_failures: 0,
      total_checks: 0,
      total_successes: 0,
      last_latency_ms: null
    }
  },

  // 事件记录（最近200条）
  incidents: [],

  // 自动修复记录（最近100条）
  repairs: [],

  // 积累的知识
  knowledge: {
    // 哪些策略对哪些源有效
    effective_strategies: {},
    // 已知的失效域名
    dead_hosts: [],
    // 已知的有效备用域名
    verified_backup_hosts: {}
  },

  // 统计
  stats: {
    total_scans: 0,
    total_incidents: 0,
    total_auto_repairs: 0,
    total_repair_successes: 0,
    last_scan_at: null,
    last_incident_at: null,
    last_repair_at: null
  }
};

class SentinelMemory {
  /**
   * @param {string} dataDir - 数据目录根路径
   */
  constructor(dataDir) {
    this.dataDir = path.join(dataDir, 'sentinel');
    this.memoryFile = path.join(this.dataDir, 'memory.json');
    this.memory = null;
    this._dirty = false;
  }

  /**
   * 初始化记忆系统（加载或创建）
   */
  init() {
    // 确保目录存在
    try {
      fs.mkdirSync(this.dataDir, { recursive: true });
    } catch {}

    // 尝试加载已有记忆
    try {
      if (fs.existsSync(this.memoryFile)) {
        const raw = fs.readFileSync(this.memoryFile, 'utf8');
        this.memory = JSON.parse(raw);
        // 合并新增字段（保留已有数据）
        this._mergeDefaults();
        console.log(`[ZY-SENTINEL] 🧠 永久记忆已恢复 (事件:${this.memory.incidents.length} 修复:${this.memory.repairs.length} 扫描:${this.memory.stats.total_scans})`);
        return;
      }
    } catch (err) {
      console.warn(`[ZY-SENTINEL] ⚠️ 记忆加载失败，创建新记忆: ${err.message}`);
    }

    // 创建全新记忆
    this.memory = JSON.parse(JSON.stringify(DEFAULT_MEMORY));
    this.memory.born_at = new Date().toISOString();
    this._save();
    console.log('[ZY-SENTINEL] 🧠 新的永久记忆已创建');
  }

  /**
   * 合并默认值到已有记忆（保留已有数据，添加新字段）
   */
  _mergeDefaults() {
    const def = JSON.parse(JSON.stringify(DEFAULT_MEMORY));

    // 合并顶层字段
    for (const key of Object.keys(def)) {
      if (!(key in this.memory)) {
        this.memory[key] = def[key];
      }
    }

    // 合并 sources
    for (const [srcId, srcDef] of Object.entries(def.sources)) {
      if (!this.memory.sources[srcId]) {
        this.memory.sources[srcId] = srcDef;
      } else {
        for (const [k, v] of Object.entries(srcDef)) {
          if (!(k in this.memory.sources[srcId])) {
            this.memory.sources[srcId][k] = v;
          }
        }
      }
    }

    // 合并 stats
    if (this.memory.stats) {
      for (const [k, v] of Object.entries(def.stats)) {
        if (!(k in this.memory.stats)) {
          this.memory.stats[k] = v;
        }
      }
    }

    // 合并 knowledge
    if (this.memory.knowledge) {
      for (const [k, v] of Object.entries(def.knowledge)) {
        if (!(k in this.memory.knowledge)) {
          this.memory.knowledge[k] = v;
        }
      }
    }
  }

  /**
   * 获取完整记忆
   */
  get() {
    return this.memory;
  }

  /**
   * 获取指定书源的状态
   */
  getSource(sourceId) {
    return this.memory.sources[sourceId] || null;
  }

  /**
   * 更新书源状态
   */
  updateSource(sourceId, updates) {
    if (!this.memory.sources[sourceId]) {
      this.memory.sources[sourceId] = {};
    }
    Object.assign(this.memory.sources[sourceId], updates);
    this._dirty = true;
  }

  /**
   * 记录事件
   */
  recordIncident(incident) {
    const entry = {
      id: `INC-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      ...incident
    };
    this.memory.incidents.unshift(entry);
    // 保留最近200条
    if (this.memory.incidents.length > 200) {
      this.memory.incidents = this.memory.incidents.slice(0, 200);
    }
    this.memory.stats.total_incidents++;
    this.memory.stats.last_incident_at = entry.timestamp;
    this._dirty = true;
    return entry;
  }

  /**
   * 记录自动修复
   */
  recordRepair(repair) {
    const entry = {
      id: `RPR-${Date.now().toString(36)}`,
      timestamp: new Date().toISOString(),
      ...repair
    };
    this.memory.repairs.unshift(entry);
    if (this.memory.repairs.length > 100) {
      this.memory.repairs = this.memory.repairs.slice(0, 100);
    }
    this.memory.stats.total_auto_repairs++;
    if (repair.success) {
      this.memory.stats.total_repair_successes++;
    }
    this.memory.stats.last_repair_at = entry.timestamp;
    this._dirty = true;
    return entry;
  }

  /**
   * 更新知识
   */
  updateKnowledge(key, value) {
    this.memory.knowledge[key] = value;
    this._dirty = true;
  }

  /**
   * 记录一次扫描
   */
  recordScan() {
    this.memory.stats.total_scans++;
    this.memory.stats.last_scan_at = new Date().toISOString();
    this._dirty = true;
  }

  /**
   * 保存到磁盘（如果有变更）
   */
  save() {
    if (this._dirty) {
      this._save();
    }
  }

  /**
   * 强制保存到磁盘
   */
  _save() {
    try {
      this.memory.last_save = new Date().toISOString();
      fs.writeFileSync(this.memoryFile, JSON.stringify(this.memory, null, 2), 'utf8');
      this._dirty = false;
    } catch (err) {
      console.error(`[ZY-SENTINEL] ⚠️ 记忆保存失败: ${err.message}`);
    }
  }

  /**
   * 获取记忆摘要（用于API返回）
   */
  getSummary() {
    return {
      agent_id: this.memory.agent_id,
      agent_name: this.memory.agent_name,
      born_at: this.memory.born_at,
      memory_version: this.memory.memory_version,
      sources: Object.entries(this.memory.sources).map(([id, src]) => ({
        id,
        status: src.status,
        active_host: src.active_host,
        last_check: src.last_check,
        consecutive_failures: src.consecutive_failures,
        uptime_ratio: src.total_checks > 0
          ? ((src.total_successes / src.total_checks) * 100).toFixed(1) + '%'
          : 'N/A'
      })),
      recent_incidents: this.memory.incidents.slice(0, 5),
      recent_repairs: this.memory.repairs.slice(0, 5),
      stats: this.memory.stats
    };
  }
}

module.exports = SentinelMemory;
