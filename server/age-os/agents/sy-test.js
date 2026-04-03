/**
 * Agent: SY-TEST · 系统自检
 * 每30分钟运行一次
 * 检测：数据库连接、COS连通性、MCP工具链可用性
 * 异常时自动写工单
 *
 * 签发: 铸渊 · ICE-GL-ZY001
 */

'use strict';

const db = require('../mcp-server/db');
const cos = require('../mcp-server/cos');

async function run(config) {
  const checks = [];
  let allPassed = true;

  // 1. 数据库连接检查
  try {
    const dbStatus = await db.checkConnection();
    checks.push({
      name: '数据库连接',
      status: dbStatus.connected ? 'pass' : 'fail',
      detail: dbStatus.connected ? dbStatus.version : dbStatus.error
    });
    if (!dbStatus.connected) allPassed = false;
  } catch (err) {
    checks.push({ name: '数据库连接', status: 'fail', detail: err.message });
    allPassed = false;
  }

  // 2. COS连通性检查
  try {
    const cosStatus = await cos.checkConnection();
    checks.push({
      name: 'COS存储桶',
      status: cosStatus.connected ? 'pass' : 'fail',
      detail: cosStatus.connected ? 'hot桶可达' : cosStatus.reason
    });
    if (!cosStatus.connected) allPassed = false;
  } catch (err) {
    checks.push({ name: 'COS存储桶', status: 'fail', detail: err.message });
    allPassed = false;
  }

  // 3. brain_nodes表可用性
  try {
    const result = await db.query("SELECT COUNT(*) as cnt FROM brain_nodes WHERE status = 'active'");
    checks.push({
      name: 'brain_nodes表',
      status: 'pass',
      detail: `${result.rows[0].cnt} 个活跃节点`
    });
  } catch (err) {
    checks.push({ name: 'brain_nodes表', status: 'fail', detail: err.message });
    allPassed = false;
  }

  // 4. agent_configs表可用性
  try {
    const result = await db.query("SELECT COUNT(*) as cnt FROM agent_configs WHERE enabled = true");
    checks.push({
      name: 'agent_configs表',
      status: 'pass',
      detail: `${result.rows[0].cnt} 个启用的Agent`
    });
  } catch (err) {
    checks.push({ name: 'agent_configs表', status: 'fail', detail: err.message });
    allPassed = false;
  }

  return {
    message: allPassed ? '系统自检通过' : '系统自检发现异常',
    details: {
      all_passed: allPassed,
      checks,
      checked_at: new Date().toISOString()
    }
  };
}

module.exports = { run };
