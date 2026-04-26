/**
 * GMP-Agent 统一日志收集模块
 * logger.js · GH-GMP-004 · 录册A02
 *
 * 功能：
 * - 每个GMP模块独立日志文件（install/runtime/error）
 * - 结构化JSON日志（时间戳+级别+模块+消息+元数据）
 * - 按大小自动轮转（默认10MB）
 * - 日志查询API（按模块/级别/时间范围过滤）
 * - 统一存储到 /guanghu/repo/gmp-agent/logs/
 *
 * 环境要求：Node.js 20+ · 纯标准库 · 无第三方依赖
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

// ─── 配置 ───────────────────────────────────────────────
const DEFAULT_CONFIG = {
  logDir: process.env.GMP_LOG_DIR || path.join(__dirname, '..', 'logs'),
  maxFileSize: parseInt(process.env.GMP_LOG_MAX_SIZE) || 10 * 1024 * 1024, // 10MB
  maxRotatedFiles: parseInt(process.env.GMP_LOG_MAX_FILES) || 5,
  levels: ['debug', 'info', 'warn', 'error', 'fatal'],
  minLevel: process.env.GMP_LOG_LEVEL || 'info',
  enableConsole: process.env.GMP_LOG_CONSOLE !== 'false',
};

// ─── 日志级别权重 ──────────────────────────────────────────
const LEVEL_WEIGHT = { debug: 0, info: 1, warn: 2, error: 3, fatal: 4 };

// ─── Logger 类 ──────────────────────────────────────────
class GmpLogger extends EventEmitter {
  /**
   * @param {string} moduleName - GMP模块名称（如 'webhook', 'installer'）
   * @param {object} [config] - 覆盖默认配置
   */
  constructor(moduleName, config = {}) {
    super();
    this.moduleName = moduleName;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.minLevelWeight = LEVEL_WEIGHT[this.config.minLevel] ?? 1;

    // 确保日志目录存在
    this._ensureDir(this.config.logDir);
    this._ensureDir(path.join(this.config.logDir, moduleName));
  }

  // ─── 公共API ────────────────────────────────────────────

  debug(message, meta = {}) { return this._log('debug', message, meta); }
  info(message, meta = {})  { return this._log('info', message, meta); }
  warn(message, meta = {})  { return this._log('warn', message, meta); }
  error(message, meta = {}) { return this._log('error', message, meta); }
  fatal(message, meta = {}) { return this._log('fatal', message, meta); }

  /**
   * 记录安装日志（专用通道）
   */
  install(message, meta = {}) {
    return this._log('info', message, { ...meta, channel: 'install' });
  }

  /**
   * 查询日志
   * @param {object} filter - { level?, since?, until?, limit?, channel? }
   * @returns {Array<object>} 匹配的日志条目
   */
  query(filter = {}) {
    const { level, since, until, limit = 100, channel } = filter;
    const logDir = path.join(this.config.logDir, this.moduleName);
    const entries = [];

    // 读取所有日志文件
    let files;
    try {
      files = fs.readdirSync(logDir).filter(f => f.endsWith('.jsonl')).sort();
    } catch {
      return entries;
    }

    for (const file of files) {
      const content = fs.readFileSync(path.join(logDir, file), 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          // 按级别过滤
          if (level && entry.level !== level) continue;
          // 按通道过滤
          if (channel && entry.channel !== channel) continue;
          // 按时间范围过滤
          if (since && entry.timestamp < since) continue;
          if (until && entry.timestamp > until) continue;
          entries.push(entry);
          if (entries.length >= limit) return entries;
        } catch {
          // 跳过损坏的行
        }
      }
    }
    return entries;
  }

  /**
   * 获取日志统计
   * @returns {object} { total, byLevel, byChannel }
   */
  stats() {
    const all = this.query({ limit: Infinity });
    const byLevel = {};
    const byChannel = {};
    for (const entry of all) {
      byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
      if (entry.channel) {
        byChannel[entry.channel] = (byChannel[entry.channel] || 0) + 1;
      }
    }
    return { total: all.length, byLevel, byChannel };
  }

  // ─── 内部方法 ────────────────────────────────────────────

  _log(level, message, meta) {
    if (LEVEL_WEIGHT[level] < this.minLevelWeight) return null;

    const entry = {
      timestamp: new Date().toISOString(),
      level,
      module: this.moduleName,
      message,
      ...meta,
    };

    // 写入文件
    const channel = meta.channel || 'runtime';
    const logFile = path.join(
      this.config.logDir,
      this.moduleName,
      `${channel}.jsonl`
    );
    const line = JSON.stringify(entry) + '\n';

    try {
      fs.appendFileSync(logFile, line, 'utf-8');
      this._checkRotation(logFile);
    } catch (err) {
      // 如果写入失败，输出到控制台
      console.error(`[GmpLogger] Failed to write log: ${err.message}`);
    }

    // 控制台输出
    if (this.config.enableConsole) {
      const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${this.moduleName}]`;
      if (level === 'error' || level === 'fatal') {
        console.error(`${prefix} ${message}`);
      } else {
        console.log(`${prefix} ${message}`);
      }
    }

    // 触发事件（供外部监听）
    this.emit('log', entry);

    return entry;
  }

  _checkRotation(logFile) {
    try {
      const stat = fs.statSync(logFile);
      if (stat.size >= this.config.maxFileSize) {
        this._rotate(logFile);
      }
    } catch {
      // 文件不存在或无法读取，跳过
    }
  }

  _rotate(logFile) {
    const max = this.config.maxRotatedFiles;
    // 删除最老的轮转文件
    const oldest = `${logFile}.${max}`;
    if (fs.existsSync(oldest)) {
      fs.unlinkSync(oldest);
    }
    // 依次重命名
    for (let i = max - 1; i >= 1; i--) {
      const from = `${logFile}.${i}`;
      const to = `${logFile}.${i + 1}`;
      if (fs.existsSync(from)) {
        fs.renameSync(from, to);
      }
    }
    // 当前文件变为 .1
    fs.renameSync(logFile, `${logFile}.1`);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ─── 工厂函数 ──────────────────────────────────────────

/** 已创建的logger缓存 */
const loggers = new Map();

/**
 * 获取或创建模块日志实例
 * @param {string} moduleName
 * @param {object} [config]
 * @returns {GmpLogger}
 */
function getLogger(moduleName, config) {
  if (!loggers.has(moduleName)) {
    loggers.set(moduleName, new GmpLogger(moduleName, config));
  }
  return loggers.get(moduleName);
}

/**
 * 查询所有模块日志
 * @param {object} filter - { module?, level?, since?, until?, limit? }
 * @returns {Array<object>}
 */
function queryAll(filter = {}) {
  const { module: mod, ...rest } = filter;
  if (mod) {
    const logger = getLogger(mod);
    return logger.query(rest);
  }
  // 查询所有已注册模块
  const results = [];
  for (const [, logger] of loggers) {
    results.push(...logger.query(rest));
  }
  // 按时间排序
  results.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  if (filter.limit) {
    return results.slice(0, filter.limit);
  }
  return results;
}

// ─── 导出 ──────────────────────────────────────────────
module.exports = {
  GmpLogger,
  getLogger,
  queryAll,
  DEFAULT_CONFIG,
  LEVEL_WEIGHT,
};
