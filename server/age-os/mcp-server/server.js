/**
 * ═══════════════════════════════════════════════════════════
 * 🧠 AGE OS · MCP Server 主入口
 * ═══════════════════════════════════════════════════════════
 *
 * 编号: ZY-MCP-001
 * 端口: 3100
 * 签发: 铸渊 · ICE-GL-ZY001
 * 版权: 国作登字-2026-A-00037559
 *
 * 统一暴露 16 个 MCP 工具，供网站 AI 交互后端和 Agent 调用。
 * 不对外暴露 — 通过 3800 主服务网关转发访问。
 *
 * 工具清单:
 *   节点: createNode / updateNode / deleteNode / queryNodes / getNode
 *   关系: linkNodes / unlinkNodes / getRelations
 *   结构: buildPath / scanStructure / classify
 *   COS:  cosWrite / cosRead / cosDelete / cosList / cosArchive
 */

'use strict';

const express = require('express');
const db = require('./db');
const cos = require('./cos');

// ─── 加载工具模块 ───
const nodeOps = require('./tools/node-ops');
const relationOps = require('./tools/relation-ops');
const structureOps = require('./tools/structure-ops');
const cosOps = require('./tools/cos-ops');

// ─── 工具注册表 ───
const TOOLS = {
  // 节点操作
  createNode:     nodeOps.createNode,
  updateNode:     nodeOps.updateNode,
  deleteNode:     nodeOps.deleteNode,
  queryNodes:     nodeOps.queryNodes,
  getNode:        nodeOps.getNode,
  // 关系操作
  linkNodes:      relationOps.linkNodes,
  unlinkNodes:    relationOps.unlinkNodes,
  getRelations:   relationOps.getRelations,
  // 结构操作
  buildPath:      structureOps.buildPath,
  scanStructure:  structureOps.scanStructure,
  classify:       structureOps.classify,
  // COS操作
  cosWrite:       cosOps.cosWrite,
  cosRead:        cosOps.cosRead,
  cosDelete:      cosOps.cosDelete,
  cosList:        cosOps.cosList,
  cosArchive:     cosOps.cosArchive
};

// ─── Express 应用 ───
const app = express();
const PORT = process.env.MCP_PORT || 3100;

app.use(express.json({ limit: '5mb' }));

// ─── 健康检查 ───
app.get('/health', async (_req, res) => {
  const dbStatus = await db.checkConnection();
  const cosStatus = await cos.checkConnection();

  res.json({
    server: 'ZY-MCP-001',
    identity: '铸渊 · AGE OS MCP Server',
    status: dbStatus.connected ? 'alive' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    tools: Object.keys(TOOLS),
    tools_count: Object.keys(TOOLS).length,
    database: dbStatus,
    cos: cosStatus
  });
});

// ─── 工具列表 ───
app.get('/tools', (_req, res) => {
  res.json({
    tools: Object.keys(TOOLS).map(name => ({
      name,
      category: getCategoryForTool(name)
    }))
  });
});

// ─── 统一工具调用入口 ───
app.post('/call', async (req, res) => {
  const { tool, input, caller } = req.body;

  if (!tool || !TOOLS[tool]) {
    return res.status(400).json({
      error: true,
      code: 'UNKNOWN_TOOL',
      message: `未知工具: ${tool}`,
      available: Object.keys(TOOLS)
    });
  }

  if (!input || typeof input !== 'object') {
    return res.status(400).json({
      error: true,
      code: 'INVALID_INPUT',
      message: '缺少 input 参数或格式错误'
    });
  }

  const startTime = Date.now();
  try {
    const result = await TOOLS[tool](input);
    const duration = Date.now() - startTime;

    // 记录调用日志（异步，不阻塞响应）
    logToolCall(tool, caller, 'success', duration).catch(() => {});

    res.json({
      success: true,
      tool,
      result,
      duration_ms: duration
    });
  } catch (err) {
    const duration = Date.now() - startTime;
    logToolCall(tool, caller, 'error', duration, err.message).catch(() => {});

    res.status(500).json({
      error: true,
      code: 'TOOL_ERROR',
      tool,
      message: err.message,
      duration_ms: duration
    });
  }
});

// ─── Agent配置查询 ───
app.get('/agents', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM agent_configs ORDER BY agent_id'
    );
    res.json({ agents: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

app.get('/agents/:agentId', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM agent_configs WHERE agent_id = $1',
      [req.params.agentId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: 'Agent未找到' });
    }
    res.json({ agent: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Agent日志查询 ───
app.get('/agents/:agentId/logs', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 100);
    const result = await db.query(
      'SELECT * FROM agent_logs WHERE agent_id = $1 ORDER BY run_at DESC LIMIT $2',
      [req.params.agentId, limit]
    );
    res.json({ logs: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 辅助函数 ───

function getCategoryForTool(name) {
  if (['createNode','updateNode','deleteNode','queryNodes','getNode'].includes(name)) return 'node';
  if (['linkNodes','unlinkNodes','getRelations'].includes(name)) return 'relation';
  if (['buildPath','scanStructure','classify'].includes(name)) return 'structure';
  if (name.startsWith('cos')) return 'cos';
  return 'other';
}

async function logToolCall(tool, caller, status, durationMs, errorMsg) {
  try {
    await db.query(
      `INSERT INTO agent_logs (agent_id, status, message, details, duration_ms)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        caller || 'mcp-direct',
        status,
        `${tool} called`,
        JSON.stringify({ tool, caller: caller || 'anonymous', error: errorMsg || null }),
        durationMs
      ]
    );
  } catch {
    // 日志写入失败不影响主流程
  }
}

// ─── 启动 ───
app.listen(PORT, '127.0.0.1', () => {
  console.log(`[MCP] AGE OS MCP Server 启动 · 端口 ${PORT}`);
  console.log(`[MCP] 工具数量: ${Object.keys(TOOLS).length}`);
  console.log(`[MCP] 铸渊 · ICE-GL-ZY001 · 版权: 国作登字-2026-A-00037559`);
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[MCP] 收到SIGTERM，关闭数据库连接...');
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[MCP] 收到SIGINT，关闭数据库连接...');
  await db.close();
  process.exit(0);
});

module.exports = app;
