#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════
 * 🗄️ AGE OS · 数据库迁移运行器
 * ═══════════════════════════════════════════════════════════
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 按编号顺序执行 schema/*.sql 文件。
 * 使用 schema_migrations 表跟踪已执行的迁移，
 * 确保每个 SQL 文件只执行一次（幂等）。
 *
 * 用法:
 *   node scripts/db-migrate.js           # 执行所有未执行的迁移
 *   node scripts/db-migrate.js --status  # 查看迁移状态
 *   node scripts/db-migrate.js --force 003  # 强制重跑指定编号
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ─── 数据库连接（复用 MCP db 模块的配置） ───
const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.ZY_DB_HOST || '127.0.0.1',
  port:     parseInt(process.env.ZY_DB_PORT || '5432', 10),
  user:     process.env.ZY_DB_USER || 'zy_admin',
  password: process.env.ZY_DB_PASS || '',
  database: process.env.ZY_DB_NAME || 'age_os',
  max:      3,
  connectionTimeoutMillis: 10000
});

const SCHEMA_DIR = path.resolve(__dirname, '..', 'schema');

// ─── 确保迁移跟踪表存在 ───
async function ensureMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id          SERIAL PRIMARY KEY,
      filename    VARCHAR(500) NOT NULL UNIQUE,
      checksum    VARCHAR(64),
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      duration_ms INT,
      success     BOOLEAN NOT NULL DEFAULT true,
      error_msg   TEXT
    );
  `);
}

// ─── 获取已执行的迁移列表 ───
async function getExecutedMigrations() {
  const result = await pool.query(
    'SELECT filename, executed_at, success FROM schema_migrations WHERE success = true ORDER BY filename'
  );
  return new Set(result.rows.map(r => r.filename));
}

// ─── 获取所有 schema SQL 文件（按编号排序） ───
function getSchemaFiles() {
  if (!fs.existsSync(SCHEMA_DIR)) {
    console.error(`[Migrate] Schema目录不存在: ${SCHEMA_DIR}`);
    return [];
  }

  return fs.readdirSync(SCHEMA_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort()  // 按文件名排序（001, 002, 003...）
    .map(f => ({
      filename: f,
      filepath: path.join(SCHEMA_DIR, f)
    }));
}

// ─── 计算简单校验和 ───
function computeChecksum(content) {
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
}

// ─── 执行单个迁移 ───
async function executeMigration(file) {
  const content = fs.readFileSync(file.filepath, 'utf8');
  const checksum = computeChecksum(content);
  const startTime = Date.now();

  console.log(`[Migrate] ▶ 执行: ${file.filename}`);

  try {
    await pool.query(content);
    const duration = Date.now() - startTime;

    await pool.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms, success)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (filename) DO UPDATE SET
         checksum = $2, executed_at = NOW(), duration_ms = $3, success = true, error_msg = NULL`,
      [file.filename, checksum, duration]
    );

    console.log(`[Migrate] ✅ ${file.filename} 完成 (${duration}ms)`);
    return { success: true, duration };
  } catch (err) {
    const duration = Date.now() - startTime;

    // 记录失败
    await pool.query(
      `INSERT INTO schema_migrations (filename, checksum, duration_ms, success, error_msg)
       VALUES ($1, $2, $3, false, $4)
       ON CONFLICT (filename) DO UPDATE SET
         checksum = $2, executed_at = NOW(), duration_ms = $3, success = false, error_msg = $4`,
      [file.filename, checksum, duration, err.message]
    ).catch(() => {});

    console.error(`[Migrate] ❌ ${file.filename} 失败 (${duration}ms): ${err.message}`);
    return { success: false, duration, error: err.message };
  }
}

// ─── 主入口 ───
async function main() {
  const args = process.argv.slice(2);
  const isStatus = args.includes('--status');
  const forceIndex = args.indexOf('--force');
  const forcePrefix = forceIndex >= 0 ? args[forceIndex + 1] : null;

  console.log('═══════════════════════════════════════════════');
  console.log('  🗄️  AGE OS · 数据库迁移运行器');
  console.log('  铸渊 · ICE-GL-ZY001');
  console.log('═══════════════════════════════════════════════');

  try {
    // 测试连接
    await pool.query('SELECT 1');
    console.log('[Migrate] 数据库连接成功');

    // 确保迁移表存在
    await ensureMigrationTable();

    const schemaFiles = getSchemaFiles();
    const executed = await getExecutedMigrations();

    if (isStatus) {
      console.log('\n迁移状态:');
      for (const file of schemaFiles) {
        const status = executed.has(file.filename) ? '✅ 已执行' : '⏳ 待执行';
        console.log(`  ${status}  ${file.filename}`);
      }
      console.log(`\n总计: ${schemaFiles.length} 个迁移文件, ${executed.size} 个已执行`);
      return;
    }

    // 筛选待执行的迁移
    let pending;
    if (forcePrefix) {
      pending = schemaFiles.filter(f => f.filename.startsWith(forcePrefix));
      if (pending.length === 0) {
        console.log(`[Migrate] 未找到前缀为 ${forcePrefix} 的迁移文件`);
        return;
      }
      console.log(`[Migrate] 强制重跑 ${pending.length} 个迁移`);
    } else {
      pending = schemaFiles.filter(f => !executed.has(f.filename));
    }

    if (pending.length === 0) {
      console.log('[Migrate] ✅ 所有迁移已是最新状态');
      return;
    }

    console.log(`[Migrate] 发现 ${pending.length} 个待执行迁移\n`);

    let successCount = 0;
    let failCount = 0;

    for (const file of pending) {
      const result = await executeMigration(file);
      if (result.success) {
        successCount++;
      } else {
        failCount++;
        // SQL 文件使用 IF NOT EXISTS，继续执行后续迁移
        console.warn(`[Migrate] ⚠️ ${file.filename} 失败，继续执行后续迁移...`);
      }
    }

    console.log(`\n[Migrate] 完成: ${successCount} 成功, ${failCount} 失败`);

    if (failCount > 0) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('[Migrate] 严重错误:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
