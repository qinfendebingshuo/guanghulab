/**
 * ═══════════════════════════════════════════════════════════
 * AGE OS · 数据库连接模块
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * PostgreSQL 连接池 — 所有 MCP 工具通过此模块访问数据库
 */

'use strict';

const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.ZY_DB_HOST || '127.0.0.1',
  port:     parseInt(process.env.ZY_DB_PORT || '5432', 10),
  user:     process.env.ZY_DB_USER || 'zy_admin',
  password: process.env.ZY_DB_PASS || (() => {
    if (process.env.NODE_ENV === 'production') {
      console.error('[DB] 严重: 生产环境未配置ZY_DB_PASS');
    }
    return '';
  })(),
  database: process.env.ZY_DB_NAME || 'age_os',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

// 连接错误不应崩溃进程
pool.on('error', (err) => {
  console.error('[DB] 连接池错误:', err.message);
});

/**
 * 执行查询
 * @param {string} text - SQL 语句（使用 $1, $2 参数占位符）
 * @param {any[]} params - 参数数组
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[DB] 慢查询 (${duration}ms): ${text.substring(0, 80)}`);
    }
    return result;
  } catch (err) {
    console.error(`[DB] 查询失败: ${err.message}`);
    console.error(`[DB] SQL: ${text.substring(0, 200)}`);
    throw err;
  }
}

/**
 * 检查数据库连接
 * @returns {Promise<{connected: boolean, version?: string, error?: string}>}
 */
async function checkConnection() {
  try {
    const result = await pool.query('SELECT version()');
    return {
      connected: true,
      version: result.rows[0].version
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

/**
 * 关闭连接池（进程退出时调用）
 */
async function close() {
  await pool.end();
}

module.exports = { query, checkConnection, close };
