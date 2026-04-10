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
 *   节点:     createNode / updateNode / deleteNode / queryNodes / getNode
 *   关系:     linkNodes / unlinkNodes / getRelations
 *   结构:     buildPath / scanStructure / classify
 *   COS:      cosWrite / cosRead / cosDelete / cosList / cosArchive
 *   人格体:   registerPersona / getPersona / updatePersona / listPersonas
 *             getNotebook / updateNotebookPage / addMemoryAnchor / queryMemoryAnchors
 *             addWorldPlace / getWorldMap / updateWorldPlace
 *             addTimelineEntry / getTimeline / addRelationship / getRelationships
 *             registerTrainingAgent / updateTrainingAgent / logTrainingRun / getTrainingStatus
 *             saveFile / getFile / listFiles / getFileHistory
 *   Notion:   notionQuery / notionReadPage / notionWritePage / notionUpdatePage / notionWriteSyslog
 *   GitHub:   githubReadFile / githubListDir / githubWriteFile / githubGetCommits / githubGetIssues / githubTriggerDeploy
 *   活模块:   registerModule / getModule / listModules / moduleHeartbeat / diagnoseModule
 *             getModuleAlerts / getModuleLearnings / sendHLDP / getHLDPStats
 *   语料:     cosListCorpus / cosExtractCorpus / cosParseGitRepoArchive / cosParseNotionExport
 *             cosParseGPTCorpus / cosGetCorpusStatus
 *   COS数据库: cosDbInit / cosDbGetIndex / cosDbUpdateIndex / cosDbWriteEntry
 *             cosDbReadEntry / cosDbListEntries / cosDbDeleteEntry / cosDbGetStats
 *   训练:     trainingStartSession / trainingProcessCorpus / trainingClassifyEntry
 *             trainingWriteToMemory / trainingGetProgress / trainingRaiseAlert
 *   Notion桥接: notionCosSyncPage / notionCosReadMirror / notionCosListMirror
 *             notionCosBuildIndex / notionCosWriteWorkorder / notionCosReadWorkorder / notionCosListWorkorders
 *   三方通信: cosAlertScan / cosAlertResolve / cosDispatchTask / cosReadTaskReport
 *             cosListTaskReports / cosApproveTask / cosSendNotification / cosGetCommLink
 *   权限修复: notionCheckPermissions / notionRepairPermissions / notionListSharedPages
 *             notionGenerateRepairGuide / notionPermissionReport
 *   微调引擎: finetuneExportDataset / finetuneSubmitJob / finetuneCheckStatus
 *             finetuneRegisterModel / finetuneListModels / finetuneCallModel
 *             finetuneCompareModels / finetuneGetCostEstimate
 *   光之树:   growBranch / growLeaf / growBloom / getTreeNode / getSubtree
 *             tracePath / getPersonaBranch / getRecentLeaves
 *   天眼:     writeSyslog / getTianyanView / querySyslog
 *   COS轮询:  cosWatcherStatus / cosWatcherTriggerScan / cosWatcherResetIndex
 */

'use strict';

const crypto = require('crypto');
const https = require('https');
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
// 新增模块 A-G
const corpusExtractorOps = require('./tools/corpus-extractor-ops');
const cosPersonaDbOps = require('./tools/cos-persona-db-ops');
const trainingAgentOps = require('./tools/training-agent-ops');
const notionCosBridgeOps = require('./tools/notion-cos-bridge-ops');
const cosCommOps = require('./tools/cos-comm-ops');
const notionPermissionOps = require('./tools/notion-permission-ops');
const finetuneEngineOps = require('./tools/finetune-engine-ops');
// 光之树 + 天眼
const lightTreeOps = require('./tools/light-tree-ops');
// COS桶轮询守护
const cosWatcherOps = require('./tools/cos-watcher-ops');
const cosWatcher = require('./cos-watcher');

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
  // 模块A · COS语料读取引擎
  cosListCorpus:          corpusExtractorOps.cosListCorpus,
  cosExtractCorpus:       corpusExtractorOps.cosExtractCorpus,
  cosParseGitRepoArchive: corpusExtractorOps.cosParseGitRepoArchive,
  cosParseNotionExport:   corpusExtractorOps.cosParseNotionExport,
  cosParseGPTCorpus:      corpusExtractorOps.cosParseGPTCorpus,
  cosGetCorpusStatus:     corpusExtractorOps.cosGetCorpusStatus,
  // 模块G · COS桶内自研数据库
  cosDbInit:              cosPersonaDbOps.cosDbInit,
  cosDbGetIndex:          cosPersonaDbOps.cosDbGetIndex,
  cosDbUpdateIndex:       cosPersonaDbOps.cosDbUpdateIndex,
  cosDbWriteEntry:        cosPersonaDbOps.cosDbWriteEntry,
  cosDbReadEntry:         cosPersonaDbOps.cosDbReadEntry,
  cosDbListEntries:       cosPersonaDbOps.cosDbListEntries,
  cosDbDeleteEntry:       cosPersonaDbOps.cosDbDeleteEntry,
  cosDbGetStats:          cosPersonaDbOps.cosDbGetStats,
  // 模块B · 铸渊思维逻辑训练Agent
  trainingStartSession:    trainingAgentOps.trainingStartSession,
  trainingProcessCorpus:   trainingAgentOps.trainingProcessCorpus,
  trainingClassifyEntry:   trainingAgentOps.trainingClassifyEntry,
  trainingWriteToMemory:   trainingAgentOps.trainingWriteToMemory,
  trainingGetProgress:     trainingAgentOps.trainingGetProgress,
  trainingRaiseAlert:      trainingAgentOps.trainingRaiseAlert,
  // 模块C · Notion ↔ COS桥接
  notionCosSyncPage:       notionCosBridgeOps.notionCosSyncPage,
  notionCosReadMirror:     notionCosBridgeOps.notionCosReadMirror,
  notionCosListMirror:     notionCosBridgeOps.notionCosListMirror,
  notionCosBuildIndex:     notionCosBridgeOps.notionCosBuildIndex,
  notionCosWriteWorkorder: notionCosBridgeOps.notionCosWriteWorkorder,
  notionCosReadWorkorder:  notionCosBridgeOps.notionCosReadWorkorder,
  notionCosListWorkorders: notionCosBridgeOps.notionCosListWorkorders,
  // 模块D+E · COS桶示警 + 三方对接
  cosAlertScan:           cosCommOps.cosAlertScan,
  cosAlertResolve:        cosCommOps.cosAlertResolve,
  cosDispatchTask:        cosCommOps.cosDispatchTask,
  cosReadTaskReport:      cosCommOps.cosReadTaskReport,
  cosListTaskReports:     cosCommOps.cosListTaskReports,
  cosApproveTask:         cosCommOps.cosApproveTask,
  cosSendNotification:    cosCommOps.cosSendNotification,
  cosGetCommLink:         cosCommOps.cosGetCommLink,
  // 模块F · Notion权限自动修复
  notionCheckPermissions:     notionPermissionOps.notionCheckPermissions,
  notionRepairPermissions:    notionPermissionOps.notionRepairPermissions,
  notionListSharedPages:      notionPermissionOps.notionListSharedPages,
  notionGenerateRepairGuide:  notionPermissionOps.notionGenerateRepairGuide,
  notionPermissionReport:     notionPermissionOps.notionPermissionReport,
  // 模块H · 开源模型微调引擎
  finetuneExportDataset:      finetuneEngineOps.finetuneExportDataset,
  finetuneSubmitJob:          finetuneEngineOps.finetuneSubmitJob,
  finetuneCheckStatus:        finetuneEngineOps.finetuneCheckStatus,
  finetuneRegisterModel:      finetuneEngineOps.finetuneRegisterModel,
  finetuneListModels:         finetuneEngineOps.finetuneListModels,
  finetuneCallModel:          finetuneEngineOps.finetuneCallModel,
  finetuneCompareModels:      finetuneEngineOps.finetuneCompareModels,
  finetuneGetCostEstimate:    finetuneEngineOps.finetuneGetCostEstimate,
  // 活模块操作 · S5
  registerModule:     livingModuleOps.registerModule,
  getModule:          livingModuleOps.getModule,
  listModules:        livingModuleOps.listModules,
  moduleHeartbeat:    livingModuleOps.moduleHeartbeat,
  diagnoseModule:     livingModuleOps.diagnoseModule,
  getModuleAlerts:    livingModuleOps.getModuleAlerts,
  getModuleLearnings: livingModuleOps.getModuleLearnings,
  sendHLDP:           livingModuleOps.sendHLDP,
  getHLDPStats:       livingModuleOps.getHLDPStats,
  // 光之树 · 生长操作
  growBranch:          lightTreeOps.growBranch,
  growLeaf:            lightTreeOps.growLeaf,
  growBloom:           lightTreeOps.growBloom,
  // 光之树 · 查询操作
  getTreeNode:         lightTreeOps.getTreeNode,
  getSubtree:          lightTreeOps.getSubtree,
  tracePath:           lightTreeOps.tracePath,
  getPersonaBranch:    lightTreeOps.getPersonaBranch,
  getRecentLeaves:     lightTreeOps.getRecentLeaves,
  // 天眼 · SYSLOG
  writeSyslog:         lightTreeOps.writeSyslog,
  getTianyanView:      lightTreeOps.getTianyanView,
  querySyslog:         lightTreeOps.querySyslog,
  // COS桶轮询守护 · SCF替代
  cosWatcherStatus:       cosWatcherOps.cosWatcherStatus,
  cosWatcherTriggerScan:  cosWatcherOps.cosWatcherTriggerScan,
  cosWatcherResetIndex:   cosWatcherOps.cosWatcherResetIndex
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

  // /webhook/* 端点免API Key鉴权（使用独立的webhook密钥验证）
  if (req.path.startsWith('/webhook/')) return next();

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

  const watcherStatus = cosWatcher.getStatus();

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
    cos_watcher: {
      enabled: watcherStatus.enabled,
      last_scan: watcherStatus.last_scan,
      scan_count: watcherStatus.scan_count,
      errors: watcherStatus.errors
    },
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

// ─── 光之树 API ───

// 光之树 · 人格体分支概览
app.get('/tree/:personaId', async (req, res) => {
  try {
    const result = await lightTreeOps.getPersonaBranch({ persona_id: req.params.personaId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 人格体最近的叶子（唤醒回忆）
app.get('/tree/:personaId/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '3', 10);
    const result = await lightTreeOps.getRecentLeaves({ persona_id: req.params.personaId, limit });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 节点详情
app.get('/tree/node/:nodeId', async (req, res) => {
  try {
    const result = await lightTreeOps.getTreeNode({ node_id: req.params.nodeId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 子树查询
app.get('/tree/node/:nodeId/subtree', async (req, res) => {
  try {
    const result = await lightTreeOps.getSubtree({
      node_id: req.params.nodeId,
      max_depth: req.query.max_depth ? parseInt(req.query.max_depth, 10) : undefined,
      limit: req.query.limit
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 路径回溯（从叶子到根）
app.get('/tree/node/:nodeId/trace', async (req, res) => {
  try {
    const result = await lightTreeOps.tracePath({ node_id: req.params.nodeId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 长树杈
app.post('/tree/grow/branch', async (req, res) => {
  try {
    const result = await lightTreeOps.growBranch(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 长叶子
app.post('/tree/grow/leaf', async (req, res) => {
  try {
    const result = await lightTreeOps.growLeaf(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 光之树 · 开花
app.post('/tree/grow/bloom', async (req, res) => {
  try {
    const result = await lightTreeOps.growBloom(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 天眼 API ───

// 天眼 · 全局感知视图
app.get('/tianyan', async (_req, res) => {
  try {
    const result = await lightTreeOps.getTianyanView({});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 天眼 · SYSLOG查询
app.get('/tianyan/syslog', async (req, res) => {
  try {
    const result = await lightTreeOps.querySyslog({
      agent_id: req.query.agent_id,
      persona_id: req.query.persona_id,
      result_filter: req.query.result,
      start_time: req.query.start,
      end_time: req.query.end,
      limit: req.query.limit
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 天眼 · 写入SYSLOG
app.post('/tianyan/syslog', async (req, res) => {
  try {
    const result = await lightTreeOps.writeSyslog(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── COS桶轮询守护API ───

// 轮询守护状态
app.get('/cos-watcher/status', async (_req, res) => {
  try {
    const status = cosWatcher.getStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 手动触发扫描
app.post('/cos-watcher/scan', async (_req, res) => {
  try {
    const result = await cosWatcher.triggerScan();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 重置索引
app.post('/cos-watcher/reset', async (_req, res) => {
  try {
    const result = cosWatcher.resetIndex();
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

// ─── 语料引擎API（模块A） ───

// 语料状态
app.get('/corpus/status', async (req, res) => {
  try {
    const result = await corpusExtractorOps.cosGetCorpusStatus({ bucket: req.query.bucket || 'cold' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 列出语料
app.get('/corpus/list', async (req, res) => {
  try {
    const result = await corpusExtractorOps.cosListCorpus({
      bucket: req.query.bucket || 'cold',
      prefix: req.query.prefix,
      include_processed: req.query.include_processed === 'true'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── COS数据库API（模块G） ───

// 数据库状态
app.get('/cos-db/:dbType/stats', async (req, res) => {
  try {
    const result = await cosPersonaDbOps.cosDbGetStats({
      bucket: req.query.bucket || 'cold',
      db_type: req.params.dbType
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 数据库索引
app.get('/cos-db/:dbType/index', async (req, res) => {
  try {
    const result = await cosPersonaDbOps.cosDbGetIndex({
      bucket: req.query.bucket || 'cold',
      db_type: req.params.dbType
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 训练Agent API（模块B） ───

// 训练进度
app.get('/training/:personaId/progress', async (req, res) => {
  try {
    const result = await trainingAgentOps.trainingGetProgress({
      persona_id: req.params.personaId,
      corpus_bucket: req.query.bucket || 'cold'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 三方通信API（模块D+E） ───

// 通信链路状态
app.get('/comm/status', async (req, res) => {
  try {
    const result = await cosCommOps.cosGetCommLink({ bucket: req.query.bucket || 'team' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 告警列表
app.get('/comm/alerts', async (req, res) => {
  try {
    const result = await cosCommOps.cosAlertScan({
      bucket: req.query.bucket || 'team',
      include_resolved: req.query.include_resolved === 'true'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 工单列表
app.get('/comm/workorders', async (req, res) => {
  try {
    const result = await notionCosBridgeOps.notionCosListWorkorders({
      bucket: req.query.bucket || 'team',
      status_folder: req.query.status || 'pending'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── Notion权限API（模块F） ───

// 权限检查
app.get('/notion/permissions', async (_req, res) => {
  try {
    const result = await notionPermissionOps.notionCheckPermissions({});
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 权限修复指南
app.get('/notion/repair-guide', async (req, res) => {
  try {
    const result = await notionPermissionOps.notionGenerateRepairGuide({
      write_to_cos: req.query.write_to_cos === 'true'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── 微调引擎API（模块H） ───

// 微调模型列表
app.get('/finetune/:personaId/models', async (req, res) => {
  try {
    const result = await finetuneEngineOps.finetuneListModels({
      persona_id: req.params.personaId
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 微调成本估算
app.get('/finetune/:personaId/cost-estimate', async (req, res) => {
  try {
    const result = await finetuneEngineOps.finetuneGetCostEstimate({
      persona_id: req.params.personaId,
      dataset_key: req.query.dataset_key,
      provider: req.query.provider || 'deepseek'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// 微调任务状态
app.get('/finetune/:personaId/jobs/:jobId', async (req, res) => {
  try {
    const result = await finetuneEngineOps.finetuneCheckStatus({
      persona_id: req.params.personaId,
      job_id: req.params.jobId,
      provider: req.query.provider || 'deepseek'
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
});

// ─── COS事件Webhook端点 ───
// 接收腾讯COS桶事件通知（如文件上传），转发为GitHub repository_dispatch触发训练Agent
// COS桶设置: 事件通知 → HTTP回调 → https://guanghulab.online/api/mcp/webhook/cos-event
//
// 此端点免API Key鉴权，但使用独立的webhook密钥验证

app.post('/webhook/cos-event', async (req, res) => {
  // COS Webhook密钥验证（独立于API Key，防止外部伪造请求）
  const webhookSecret = process.env.COS_WEBHOOK_SECRET || '';
  if (webhookSecret) {
    const providedSecret = req.headers['x-cos-webhook-secret'] || req.query.secret || '';
    if (providedSecret !== webhookSecret) {
      return res.status(403).json({ error: true, code: 'INVALID_WEBHOOK_SECRET', message: 'Webhook密钥无效' });
    }
  }

  const event = req.body;
  const now = new Date().toISOString();

  // 解析COS事件（腾讯COS事件通知格式）
  let eventType = 'unknown';
  let bucketName = '';
  let objectKey = '';
  let objectSize = 0;

  try {
    if (event.Records && Array.isArray(event.Records) && event.Records.length > 0) {
      // 标准COS事件格式
      const record = event.Records[0];
      eventType = record.event?.eventName || record.eventName || 'cos:ObjectCreated';
      bucketName = record.cos?.cosBucket?.name || record.s3?.bucket?.name || '';
      objectKey = record.cos?.cosObject?.key || record.s3?.object?.key || '';
      objectSize = record.cos?.cosObject?.size || record.s3?.object?.size || 0;
    } else if (event.bucket && event.key) {
      // 简化格式（手动测试用）
      eventType = event.event || 'cos:ObjectCreated';
      bucketName = event.bucket;
      objectKey = event.key;
      objectSize = event.size || 0;
    }
  } catch {
    // 解析失败继续处理
  }

  console.log(`[COS Webhook] 事件: ${eventType} · 桶: ${bucketName} · 文件: ${objectKey}`);

  // 触发GitHub repository_dispatch（如果配置了GitHub PAT）
  const githubToken = process.env.GITHUB_DISPATCH_TOKEN || process.env.GITHUB_TOKEN || '';
  const githubRepo = process.env.GITHUB_REPO || 'qinfendebingshuo/guanghulab';
  let dispatchResult = null;

  if (githubToken) {
    try {
      const [owner, repo] = githubRepo.split('/');
      const dispatchPayload = JSON.stringify({
        event_type: 'cos-file-uploaded',
        client_payload: {
          bucket: bucketName,
          key: objectKey,
          size: objectSize,
          event: eventType,
          timestamp: now
        }
      });

      dispatchResult = await new Promise((resolve, reject) => {
        const dispatchReq = https.request({
          hostname: 'api.github.com',
          port: 443,
          path: `/repos/${owner}/${repo}/dispatches`,
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github+json',
            'Authorization': `Bearer ${githubToken}`,
            'X-GitHub-Api-Version': '2022-11-28',
            'User-Agent': 'ZY-MCP-COS-Webhook',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(dispatchPayload)
          },
          timeout: 15000
        }, (dispatchRes) => {
          let body = '';
          dispatchRes.on('data', c => body += c);
          dispatchRes.on('end', () => {
            resolve({ status: dispatchRes.statusCode, body });
          });
        });
        dispatchReq.on('error', reject);
        dispatchReq.on('timeout', () => { dispatchReq.destroy(); reject(new Error('dispatch timeout')); });
        dispatchReq.write(dispatchPayload);
        dispatchReq.end();
      });

      console.log(`[COS Webhook] GitHub dispatch: ${dispatchResult.status}`);
    } catch (err) {
      console.error(`[COS Webhook] GitHub dispatch失败: ${err.message}`);
      dispatchResult = { status: 'error', error: err.message };
    }
  } else {
    console.log('[COS Webhook] 未配置GITHUB_DISPATCH_TOKEN，跳过dispatch');
  }

  // 写入告警日志到COS（异步，不阻塞响应）
  const logEntry = {
    event_type: eventType,
    bucket: bucketName,
    key: objectKey,
    size: objectSize,
    received_at: now,
    dispatch: dispatchResult ? { status: dispatchResult.status } : null
  };

  try {
    await cos.write('team', `zhuyuan/cos-events/${now.slice(0, 10)}/${Date.now()}.json`,
      JSON.stringify(logEntry, null, 2), 'application/json');
  } catch {
    // 日志写入失败不影响响应
  }

  res.json({
    received: true,
    event_type: eventType,
    bucket: bucketName,
    key: objectKey,
    dispatch: dispatchResult ? (dispatchResult.status === 204 ? 'triggered' : 'failed') : 'no_token',
    timestamp: now
  });
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
  if (name.startsWith('cosDb')) return 'cos-persona-db';
  if (['cosListCorpus','cosExtractCorpus','cosParseGitRepoArchive','cosParseNotionExport',
       'cosParseGPTCorpus','cosGetCorpusStatus'].includes(name)) return 'corpus-extractor';
  if (['cosAlertScan','cosAlertResolve','cosDispatchTask','cosReadTaskReport',
       'cosListTaskReports','cosApproveTask','cosSendNotification','cosGetCommLink'].includes(name)) return 'cos-comm';
  if (name.startsWith('cos')) return 'cos';
  if (['registerPersona','getPersona','updatePersona','listPersonas',
       'getNotebook','updateNotebookPage','addMemoryAnchor','queryMemoryAnchors',
       'addWorldPlace','getWorldMap','updateWorldPlace',
       'addTimelineEntry','getTimeline','addRelationship','getRelationships',
       'registerTrainingAgent','updateTrainingAgent','logTrainingRun','getTrainingStatus',
       'saveFile','getFile','listFiles','getFileHistory'].includes(name)) return 'persona';
  if (name.startsWith('training')) return 'training-agent';
  if (name.startsWith('finetune')) return 'finetune-engine';
  if (['notionCosSyncPage','notionCosReadMirror','notionCosListMirror',
       'notionCosBuildIndex','notionCosWriteWorkorder','notionCosReadWorkorder',
       'notionCosListWorkorders'].includes(name)) return 'notion-cos-bridge';
  if (['notionCheckPermissions','notionRepairPermissions','notionListSharedPages',
       'notionGenerateRepairGuide','notionPermissionReport'].includes(name)) return 'notion-permission';
  if (name.startsWith('notion')) return 'notion';
  if (name.startsWith('github')) return 'github';
  if (['registerModule','getModule','listModules','moduleHeartbeat','diagnoseModule',
       'getModuleAlerts','getModuleLearnings','sendHLDP','getHLDPStats'].includes(name)) return 'living-module';
  if (['growBranch','growLeaf','growBloom','getTreeNode','getSubtree',
       'tracePath','getPersonaBranch','getRecentLeaves'].includes(name)) return 'light-tree';
  if (['writeSyslog','getTianyanView','querySyslog'].includes(name)) return 'tianyan';
  if (name.startsWith('cosWatcher')) return 'cos-watcher';
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

  // 启动COS桶轮询守护进程（SCF替代方案）
  cosWatcher.start();
});

// 优雅关闭
process.on('SIGTERM', async () => {
  console.log('[MCP] 收到SIGTERM，停止COS轮询 + 关闭数据库连接...');
  cosWatcher.stop();
  await db.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('[MCP] 收到SIGINT，停止COS轮询 + 关闭数据库连接...');
  cosWatcher.stop();
  await db.close();
  process.exit(0);
});

module.exports = app;
