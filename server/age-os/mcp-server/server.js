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
 * 统一暴露 MCP 工具，供网站 AI 交互后端和 Agent 调用。
 * 外部访问通过 Nginx /api/mcp/ 反向代理，需 API Key 鉴权。
 * 内部访问（127.0.0.1）免鉴权。
 *
 * 鉴权方式: Authorization: Bearer <ZHUYUAN_API_KEY>
 * 免鉴权端点: /health（监控探针）
 *
 * 工具清单:
 *   节点:   createNode / updateNode / deleteNode / queryNodes / getNode
 *   关系:   linkNodes / unlinkNodes / getRelations
 *   结构:   buildPath / scanStructure / classify
 *   COS:    cosWrite / cosRead / cosDelete / cosList / cosArchive
 *   人格体: registerPersona / getPersona / updatePersona / listPersonas
 *           getNotebook / updateNotebookPage / addMemoryAnchor / queryMemoryAnchors
 *           addWorldPlace / getWorldMap / updateWorldPlace
 *           addTimelineEntry / getTimeline / addRelationship / getRelationships
 *           registerTrainingAgent / updateTrainingAgent / logTrainingRun / getTrainingStatus
 *           saveFile / getFile / listFiles / getFileHistory
 *   Notion: notionQuery / notionReadPage / notionWritePage / notionUpdatePage / notionWriteSyslog
 *   GitHub: githubReadFile / githubListDir / githubWriteFile / githubGetCommits / githubGetIssues / githubTriggerDeploy
 *   活模块: registerModule / getModule / listModules / moduleHeartbeat / diagnoseModule
 *           getModuleAlerts / getModuleLearnings / sendHLDP / getHLDPStats
 */

'use strict';

const crypto = require('crypto');
const express = require('express');
const db = require('./db');
const cos = require('./cos');

// ─── 加载工具模块 ───
const nodeOps = require('./tools/node-ops');
const relationOps = require('./tools/relation-ops');
const structureOps = require('./tools/structure-ops');
const cosOps = require('./tools/cos-ops');
const personaOps = require('./tools/persona-ops');
const livingModuleOps = require('./tools/living-module-ops');

// ─── 外部集成模块（优雅降级：未安装依赖时不影响核心功能） ───
let notionOps = null;
let githubOps = null;
let notionClient = null;
let githubClient = null;

try {
  notionOps = require('./tools/notion-ops');
  notionClient = require('./notion-client');
} catch (err) {
  console.warn(`[MCP] Notion模块加载跳过: ${err.message}`);
}

try {
  githubOps = require('./tools/github-ops');
  githubClient = require('./github-client');
} catch (err) {
  console.warn(`[MCP] GitHub模块加载跳过: ${err.message}`);
}

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
  cosArchive:     cosOps.cosArchive,
  // 人格体COS隔离路径操作（限定 /{persona_id}/ 目录）
  personaCosWrite: cosOps.personaCosWrite,
  personaCosRead:  cosOps.personaCosRead,
  personaCosList:  cosOps.personaCosList,
  // 人格体操作 · S15
  registerPersona:       personaOps.registerPersona,
  getPersona:            personaOps.getPersona,
  updatePersona:         personaOps.updatePersona,
  listPersonas:          personaOps.listPersonas,
  getNotebook:           personaOps.getNotebook,
  updateNotebookPage:    personaOps.updateNotebookPage,
  addMemoryAnchor:       personaOps.addMemoryAnchor,
  queryMemoryAnchors:    personaOps.queryMemoryAnchors,
  addWorldPlace:         personaOps.addWorldPlace,
  getWorldMap:           personaOps.getWorldMap,
  updateWorldPlace:      personaOps.updateWorldPlace,
  addTimelineEntry:      personaOps.addTimelineEntry,
  getTimeline:           personaOps.getTimeline,
  addRelationship:       personaOps.addRelationship,
  getRelationships:      personaOps.getRelationships,
  registerTrainingAgent: personaOps.registerTrainingAgent,
  updateTrainingAgent:   personaOps.updateTrainingAgent,
  logTrainingRun:        personaOps.logTrainingRun,
  getTrainingStatus:     personaOps.getTrainingStatus,
  saveFile:              personaOps.saveFile,
  getFile:               personaOps.getFile,
  listFiles:             personaOps.listFiles,
  getFileHistory:        personaOps.getFileHistory,
  // Notion操作（动态注册）
  ...(notionOps ? {
    notionQuery:       notionOps.notionQuery,
    notionReadPage:    notionOps.notionReadPage,
    notionWritePage:   notionOps.notionWritePage,
    notionUpdatePage:  notionOps.notionUpdatePage,
    notionWriteSyslog: notionOps.notionWriteSyslog
  } : {}),
  // GitHub操作（动态注册）
  ...(githubOps ? {
    githubReadFile:      githubOps.githubReadFile,
    githubListDir:       githubOps.githubListDir,
    githubWriteFile:     githubOps.githubWriteFile,
    githubGetCommits:    githubOps.githubGetCommits,
    githubGetIssues:     githubOps.githubGetIssues,
    githubTriggerDeploy: githubOps.githubTriggerDeploy
  } : {}),
  // 活模块操作 · S5
  registerModule:     livingModuleOps.registerModule,
  getModule:          livingModuleOps.getModule,
  listModules:        livingModuleOps.listModules,
  moduleHeartbeat:    livingModuleOps.moduleHeartbeat,
  diagnoseModule:     livingModuleOps.diagnoseModule,
  getModuleAlerts:    livingModuleOps.getModuleAlerts,
  getModuleLearnings: livingModuleOps.getModuleLearnings,
  sendHLDP:           livingModuleOps.sendHLDP,
  getHLDPStats:       livingModuleOps.getHLDPStats
};

// ─── Express 应用 ───
const app = express();
const PORT = process.env.MCP_PORT || 3100;

// ─── API Key 配置 ───
const ZHUYUAN_API_KEY = process.env.ZHUYUAN_API_KEY || '';

app.use(express.json({ limit: '5mb' }));

// 信任 Nginx 反向代理 — 使 req.ip 返回真实客户端IP
// 而非代理服务器的 127.0.0.1
app.set('trust proxy', 'loopback');

// ─── API Key 鉴权中间件 ───
// 外部访问需携带 Authorization: Bearer <ZHUYUAN_API_KEY>
// 内部访问 (127.0.0.1 / ::1) 免鉴权
// /health 端点免鉴权（监控探针用）
function apiKeyAuth(req, res, next) {
  // /health 端点免鉴权
  if (req.path === '/health') return next();

  // 内部回环地址免鉴权
  const remoteIp = req.ip || req.connection.remoteAddress || '';
  const isLocal = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  if (isLocal) return next();

  // API Key 未配置时，拒绝所有外部请求
  if (!ZHUYUAN_API_KEY) {
    return res.status(503).json({
      error: true,
      code: 'API_KEY_NOT_CONFIGURED',
      message: 'MCP Server API Key 未配置，外部访问不可用'
    });
  }

  // 验证 Authorization: Bearer <key>
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: true,
      code: 'MISSING_AUTH',
      message: '缺少 Authorization: Bearer <API_KEY> 头'
    });
  }

  const providedKey = authHeader.slice(7);
  if (providedKey.length === 0) {
    return res.status(401).json({
      error: true,
      code: 'EMPTY_KEY',
      message: 'API Key 不能为空'
    });
  }

  // 常量时间比较防止时序攻击
  const keyBuffer = Buffer.from(ZHUYUAN_API_KEY);
  const providedBuffer = Buffer.from(providedKey);
  if (keyBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(keyBuffer, providedBuffer)) {
    return res.status(403).json({
      error: true,
      code: 'INVALID_KEY',
      message: 'API Key 无效'
    });
  }

  // 将调用者身份附加到请求对象
  req.mcpCaller = 'external-api-key';
  next();
}

app.use(apiKeyAuth);

// ─── 健康检查 ───
app.get('/health', async (_req, res) => {
  const dbStatus = await db.checkConnection();
  const cosStatus = await cos.checkConnection();

  // 外部集成状态（异步并行检查）
  const [notionStatus, githubStatus] = await Promise.all([
    notionClient ? notionClient.checkConnection().catch(e => ({ connected: false, error: e.message })) : Promise.resolve({ connected: false, reason: '模块未加载' }),
    githubClient ? githubClient.checkConnection().catch(e => ({ connected: false, error: e.message })) : Promise.resolve({ connected: false, reason: '模块未加载' })
  ]);

  res.json({
    server: 'ZY-MCP-001',
    identity: '铸渊 · AGE OS MCP Server',
    status: dbStatus.connected ? 'alive' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    auth: {
      api_key_configured: !!ZHUYUAN_API_KEY,
      external_access: !!ZHUYUAN_API_KEY ? 'enabled' : 'disabled'
    },
    tools: Object.keys(TOOLS),
    tools_count: Object.keys(TOOLS).length,
    database: dbStatus,
    cos: cosStatus,
    notion: notionStatus,
    github: githubStatus
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

// ─── 人格体API（S15） ───

// 人格体列表
app.get('/personas', async (_req, res) => {
  try {
    const result = await db.query('SELECT * FROM persona_registry ORDER BY persona_id');
    res.json({ personas: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体详情（含笔记本+关系+世界地图+训练状态）
app.get('/personas/:personaId', async (req, res) => {
  try {
    const pid = req.params.personaId;
    const [persona, notebook, relationships, worldMap, trainingAgents] = await Promise.all([
      db.query('SELECT * FROM persona_registry WHERE persona_id = $1', [pid]),
      db.query('SELECT * FROM notebook_pages WHERE persona_id = $1 ORDER BY page_number', [pid]),
      db.query('SELECT * FROM persona_relationships WHERE persona_id = $1', [pid]),
      db.query('SELECT * FROM world_places WHERE persona_id = $1 ORDER BY status, place_name', [pid]),
      db.query('SELECT * FROM training_agent_configs WHERE persona_id = $1 ORDER BY agent_type', [pid])
    ]);

    if (persona.rows.length === 0) {
      return res.status(404).json({ error: true, message: '人格体未找到' });
    }

    res.json({
      persona: persona.rows[0],
      notebook: notebook.rows,
      relationships: relationships.rows,
      world_map: worldMap.rows,
      training_agents: trainingAgents.rows
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体笔记本
app.get('/personas/:personaId/notebook', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM notebook_pages WHERE persona_id = $1 ORDER BY page_number',
      [req.params.personaId]
    );
    res.json({ notebook: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体记忆锚点
app.get('/personas/:personaId/memories', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '50', 10), 200);
    const result = await db.query(
      'SELECT * FROM memory_anchors WHERE persona_id = $1 ORDER BY event_date DESC, importance DESC LIMIT $2',
      [req.params.personaId, limit]
    );
    res.json({ anchors: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体训练状态
app.get('/personas/:personaId/training', async (req, res) => {
  try {
    const agents = await db.query(
      'SELECT * FROM training_agent_configs WHERE persona_id = $1 ORDER BY agent_type',
      [req.params.personaId]
    );
    const recentLogs = await db.query(
      'SELECT * FROM training_agent_logs WHERE persona_id = $1 ORDER BY run_at DESC LIMIT 20',
      [req.params.personaId]
    );
    res.json({ agents: agents.rows, recent_logs: recentLogs.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 活模块API（S5） ───

// 活模块列表
app.get('/modules', async (req, res) => {
  try {
    const { status, module_type } = req.query;
    const result = await livingModuleOps.listModules({ status, module_type });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 活模块详情
app.get('/modules/:moduleId', async (req, res) => {
  try {
    const result = await livingModuleOps.getModule({ module_id: req.params.moduleId });
    if (!result.found) {
      return res.status(404).json({ error: true, message: '模块未找到' });
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 活模块心跳上报
app.post('/modules/:moduleId/heartbeat', async (req, res) => {
  try {
    const result = await livingModuleOps.moduleHeartbeat({
      module_id: req.params.moduleId,
      ...req.body
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 活模块报警记录
app.get('/modules/:moduleId/alerts', async (req, res) => {
  try {
    const result = await livingModuleOps.getModuleAlerts({
      module_id: req.params.moduleId,
      resolved: req.query.resolved === 'true' ? true : (req.query.resolved === 'false' ? false : undefined),
      limit: parseInt(req.query.limit || '20', 10)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 活模块学习记录
app.get('/modules/:moduleId/learnings', async (req, res) => {
  try {
    const result = await livingModuleOps.getModuleLearnings({
      module_id: req.params.moduleId,
      limit: parseInt(req.query.limit || '20', 10)
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// HLDP消息发送
app.post('/hldp/send', async (req, res) => {
  try {
    const result = await livingModuleOps.sendHLDP(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// HLDP统计
app.get('/hldp/stats', async (_req, res) => {
  try {
    const result = await livingModuleOps.getHLDPStats({});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 人格体数据库引擎状态API（S15） ───

// 人格体引擎巡检状态
app.get('/persona-engine/status', async (_req, res) => {
  try {
    // 实时统计
    const [personas, notebooks, memories, training] = await Promise.all([
      db.query('SELECT status, COUNT(*) as cnt FROM persona_registry GROUP BY status'),
      db.query(`
        SELECT p.persona_id, p.name, COUNT(n.page_number) as page_count
        FROM persona_registry p
        LEFT JOIN notebook_pages n ON p.persona_id = n.persona_id
        GROUP BY p.persona_id, p.name
        ORDER BY p.persona_id
      `),
      db.query('SELECT COUNT(*) as total FROM memory_anchors'),
      db.query('SELECT COUNT(*) as total FROM training_agent_configs WHERE enabled = true')
    ]);

    const statusMap = {};
    for (const row of personas.rows) {
      statusMap[row.status] = parseInt(row.cnt, 10);
    }

    res.json({
      engine: 'ZY-MOD-PERSONA-ENGINE',
      identity: 'S15 · 人格体数据库引擎',
      version: '1.0.0',
      personas: statusMap,
      notebooks: notebooks.rows.map(n => ({
        persona_id: n.persona_id,
        name: n.name,
        pages: parseInt(n.page_count, 10),
        complete: parseInt(n.page_count, 10) === 5
      })),
      memories_total: parseInt(memories.rows[0].total, 10),
      training_agents_enabled: parseInt(training.rows[0].total, 10),
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体唤醒
app.post('/personas/:personaId/awaken', async (req, res) => {
  try {
    const pid = req.params.personaId;
    const result = await db.query(
      `UPDATE persona_registry
       SET last_awakened = NOW(), total_awakenings = total_awakenings + 1, status = 'active', updated_at = NOW()
       WHERE persona_id = $1 RETURNING *`,
      [pid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: '人格体未找到' });
    }
    res.json({ persona: result.rows[0], message: `${result.rows[0].name} 已唤醒` });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体休眠
app.post('/personas/:personaId/dormant', async (req, res) => {
  try {
    const pid = req.params.personaId;
    const result = await db.query(
      `UPDATE persona_registry SET status = 'dormant', updated_at = NOW()
       WHERE persona_id = $1 RETURNING *`,
      [pid]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: true, message: '人格体未找到' });
    }
    res.json({ persona: result.rows[0], message: `${result.rows[0].name} 已休眠` });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体世界地图
app.get('/personas/:personaId/world', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM world_places WHERE persona_id = $1 ORDER BY status, place_name',
      [req.params.personaId]
    );
    res.json({ places: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体关系网络
app.get('/personas/:personaId/relationships', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM persona_relationships WHERE persona_id = $1 ORDER BY trust_level, related_name',
      [req.params.personaId]
    );
    res.json({ relationships: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体时间线
app.get('/personas/:personaId/timeline', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '30', 10), 100);
    const result = await db.query(
      'SELECT * FROM persona_timeline WHERE persona_id = $1 ORDER BY day_number DESC LIMIT $2',
      [req.params.personaId, limit]
    );
    res.json({ timeline: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 人格体文件列表
app.get('/personas/:personaId/files', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const result = await db.query(
      `SELECT id, persona_id, file_path, file_type, content_hash, size_bytes, version, source, created_at
       FROM persona_files WHERE persona_id = $1 AND is_latest = true ORDER BY file_path LIMIT $2`,
      [req.params.personaId, limit]
    );
    res.json({ files: result.rows });
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 数据库迁移状态API ───

app.get('/migrations', async (_req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM schema_migrations ORDER BY filename'
    );
    res.json({ migrations: result.rows });
  } catch (err) {
    // schema_migrations 表可能不存在
    res.json({ migrations: [], note: '迁移表尚未创建' });
  }
});

// ─── 辅助函数 ───

function getCategoryForTool(name) {
  if (['createNode','updateNode','deleteNode','queryNodes','getNode'].includes(name)) return 'node';
  if (['linkNodes','unlinkNodes','getRelations'].includes(name)) return 'relation';
  if (['buildPath','scanStructure','classify'].includes(name)) return 'structure';
  if (name.startsWith('personaCos')) return 'persona-cos';
  if (name.startsWith('cos')) return 'cos';
  if (['registerPersona','getPersona','updatePersona','listPersonas',
       'getNotebook','updateNotebookPage','addMemoryAnchor','queryMemoryAnchors',
       'addWorldPlace','getWorldMap','updateWorldPlace',
       'addTimelineEntry','getTimeline','addRelationship','getRelationships',
       'registerTrainingAgent','updateTrainingAgent','logTrainingRun','getTrainingStatus',
       'saveFile','getFile','listFiles','getFileHistory'].includes(name)) return 'persona';
  if (name.startsWith('notion')) return 'notion';
  if (name.startsWith('github')) return 'github';
  if (['registerModule','getModule','listModules','moduleHeartbeat','diagnoseModule',
       'getModuleAlerts','getModuleLearnings','sendHLDP','getHLDPStats'].includes(name)) return 'living-module';
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
// 默认监听 127.0.0.1（安全默认值）
// Nginx 从本机反代访问，无需暴露到外部网络
const BIND_HOST = process.env.MCP_BIND_HOST || '127.0.0.1';
app.listen(PORT, BIND_HOST, () => {
  console.log(`[MCP] AGE OS MCP Server 启动 · ${BIND_HOST}:${PORT}`);
  console.log(`[MCP] 工具数量: ${Object.keys(TOOLS).length}`);
  console.log(`[MCP] API Key 鉴权: ${ZHUYUAN_API_KEY ? '已启用' : '未配置（仅内部访问）'}`);
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
