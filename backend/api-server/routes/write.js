/**
 * 写入类 API 路由 · 语言驱动操作系统写入能力层
 *
 * POST /api/tickets/create       — 创建工单
 * PATCH /api/tickets/:ticketId   — 更新工单状态
 * POST /api/syslog/submit        — 提交 SYSLOG
 * POST /api/broadcasts/create    — 创建广播
 * POST /api/deploy/preview       — 触发预览站部署
 * POST /api/deploy/production    — 触发正式站部署（需二次确认）
 * PATCH /api/agents/:agentId     — 更新 Agent 状态
 * POST /api/maintenance/log      — 写入维护日志
 * POST /api/receipts/submit      — 提交指令回执
 * PATCH /api/dev/:devId/status   — 更新开发者状态
 *
 * 安全规则：所有写入接口需要身份验证 + 权限检查 + 审计日志
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var notionService = require('../services/notion');
var githubService = require('../services/github');
var dbConfig = require('../config/databases');
var authMiddleware = require('../middleware/auth');
var sandboxMiddleware = require('../middleware/sandbox');
var auditMiddleware = require('../middleware/audit');

// 所有写入接口需要身份验证 + 审计 + 沙箱检查
router.use(authMiddleware.requireAuth);
router.use(auditMiddleware.auditLog);
router.use(sandboxMiddleware.sandboxGuard);

// 频率限制：每个开发者每分钟最多10次写入
var rateLimitMap = new Map();
var RATE_LIMIT = 10;
var RATE_WINDOW = 60 * 1000;

function rateLimit(req, res, next) {
  var key = req.user.devId;
  var now = Date.now();
  var entry = rateLimitMap.get(key);

  if (!entry || now - entry.start >= RATE_WINDOW) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return next();
  }

  if (entry.count >= RATE_LIMIT) {
    return res.status(429).json({
      error: true,
      code: 'RATE_LIMITED',
      message: '写入频率超限（每分钟最多 ' + RATE_LIMIT + ' 次）',
      reply: '⏳ 操作太频繁了，请稍等一分钟再试。'
    });
  }

  entry.count++;
  next();
}

router.use(rateLimit);

// 模块路径归一化（确保带末尾斜杠）
function normalizeModule(mod) {
  if (!mod) return '';
  mod = mod.trim();
  if (mod !== '*' && !mod.endsWith('/')) mod += '/';
  return mod;
}

// 检查开发者是否拥有指定模块
function hasModuleAccess(userModules, module) {
  if (!userModules || !module) return false;
  if (userModules.includes('*')) return true;
  var normalized = normalizeModule(module);
  for (var i = 0; i < userModules.length; i++) {
    if (normalizeModule(userModules[i]) === normalized) return true;
  }
  return false;
}

// 获取实际数据库 ID（沙箱环境使用沙箱 DB）
function getDbId(req, configKey) {
  if (req.sandbox && req.sandboxDbIds && req.sandboxDbIds[configKey]) {
    return req.sandboxDbIds[configKey];
  }
  return dbConfig[configKey];
}

// ====== 创建工单 ======
router.post('/tickets/create',
  authMiddleware.checkPermission('ticket:create'),
  async function(req, res) {
    try {
      var title = req.body.title;
      var description = req.body.description || '';
      var priority = req.body.priority || 'P2';
      var module = req.body.module || '';
      var devId = req.user.devId;

      if (!title) {
        return res.status(400).json({
          error: true,
          code: 'MISSING_TITLE',
          message: '工单标题不能为空'
        });
      }

      var ticketDbId = getDbId(req, 'ticketBook');
      if (!ticketDbId) {
        return res.status(503).json({
          error: true,
          code: 'DB_NOT_CONFIGURED',
          message: '工单数据库未配置'
        });
      }

      var properties = {
        '工单标题': { title: [{ text: { content: title } }] },
        '描述': { rich_text: [{ text: { content: description } }] },
        '优先级': { select: { name: priority } },
        '提交人': { rich_text: [{ text: { content: devId } }] },
        '状态': { select: { name: '待处理' } }
      };
      if (module) {
        properties['模块'] = { select: { name: module } };
      }

      var result = await notionService.writeToDB(ticketDbId, properties);
      var prefix = req.sandbox ? '[沙箱] ' : '';

      res.json({
        success: true,
        message: prefix + '工单已创建',
        ticketUrl: result.url || '',
        reply: '✅ ' + prefix + '工单「' + title + '」已创建，优先级 ' + priority + '，状态：待处理。'
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'CREATE_FAILED', message: e.message });
    }
  }
);

// ====== 更新工单状态 ======
router.patch('/tickets/:ticketId',
  authMiddleware.checkPermission('ticket:update'),
  async function(req, res) {
    try {
      var ticketId = req.params.ticketId;
      var status = req.body.status;

      if (!status) {
        return res.status(400).json({ error: true, code: 'MISSING_STATUS', message: '状态不能为空' });
      }

      // 使用 Notion page update API
      if (!notionService.notion) {
        return res.status(503).json({ error: true, code: 'NOTION_UNAVAILABLE', message: 'Notion 未连接' });
      }

      await notionService.notion.pages.update({
        page_id: ticketId,
        properties: {
          '状态': { select: { name: status } }
        }
      });

      res.json({
        success: true,
        reply: '✅ 工单状态已更新为：' + status
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: e.message });
    }
  }
);

// ====== 提交 SYSLOG ======
router.post('/syslog/submit',
  authMiddleware.checkPermission('syslog:submit'),
  async function(req, res) {
    try {
      var content = req.body.content;
      var type = req.body.type || '日常';
      var devId = req.user.devId;

      if (!content) {
        return res.status(400).json({ error: true, code: 'MISSING_CONTENT', message: 'SYSLOG 内容不能为空' });
      }

      var syslogDbId = getDbId(req, 'syslogInbox');
      if (!syslogDbId) {
        return res.status(503).json({ error: true, code: 'DB_NOT_CONFIGURED', message: 'SYSLOG 数据库未配置' });
      }

      await notionService.writeToDB(syslogDbId, {
        'SYSLOG内容': { title: [{ text: { content: content } }] },
        '类型': { select: { name: type } },
        '开发者编号': { rich_text: [{ text: { content: devId } }] }
      });

      var prefix = req.sandbox ? '[沙箱] ' : '';
      var summary = content.length > 50 ? content.substring(0, 50) + '...' : content;
      res.json({
        success: true,
        reply: '✅ ' + prefix + 'SYSLOG 已提交：「' + summary + '」'
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'SUBMIT_FAILED', message: e.message });
    }
  }
);

// ====== 创建广播 ======
router.post('/broadcasts/create',
  authMiddleware.checkPermission('broadcast:create'),
  async function(req, res) {
    try {
      var title = req.body.title;
      var content = req.body.content;
      var target = req.body.target || 'ALL';
      var devId = req.user.devId;

      if (!title || !content) {
        return res.status(400).json({ error: true, code: 'MISSING_FIELDS', message: '广播标题和内容不能为空' });
      }

      var broadcastId = 'BC-' + Date.now();
      var broadcastData = {
        broadcast_id: broadcastId,
        title: title,
        content: content,
        target: target,
        created_by: devId,
        created_at: new Date().toISOString(),
        status: 'active'
      };

      // 写入 GitHub 广播文件
      var filePath = '.github/broadcasts/' + broadcastId + '.json';
      await githubService.createFile(
        filePath,
        JSON.stringify(broadcastData, null, 2),
        '📢 新广播: ' + title + ' · by ' + devId
      );

      res.json({
        success: true,
        broadcast_id: broadcastId,
        reply: '📢 广播「' + title + '」已创建并发送，编号：' + broadcastId
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'CREATE_FAILED', message: e.message });
    }
  }
);

// ====== 触发预览站部署 ======
router.post('/deploy/preview',
  authMiddleware.checkPermission('deploy:preview'),
  async function(req, res) {
    try {
      var module = req.body.module;
      var devId = req.user.devId;

      if (!module) {
        return res.status(400).json({ error: true, code: 'MISSING_MODULE', message: '需要指定部署模块' });
      }

      // 检查开发者是否拥有该模块
      if (!hasModuleAccess(req.user.modules, module)) {
        return res.status(403).json({
          error: true,
          code: 'MODULE_DENIED',
          message: '你没有该模块的部署权限',
          reply: '❌ 你没有 ' + module + ' 模块的部署权限。你的模块是：' + req.user.modules.join(', ')
        });
      }

      await githubService.triggerWorkflow('preview-deploy.yml', {
        module: module,
        dev_id: devId,
        target: 'preview'
      });

      res.json({
        success: true,
        reply: '🚀 已触发 ' + module + ' 模块的预览站部署。稍等几分钟，部署完成后我会通知你。'
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'DEPLOY_FAILED', message: e.message });
    }
  }
);

// ====== 触发正式站部署（需二次确认）======
router.post('/deploy/production',
  authMiddleware.checkPermission('deploy:production'),
  async function(req, res) {
    try {
      var module = req.body.module;
      var confirmToken = req.body.confirmToken;
      var devId = req.user.devId;

      if (!module) {
        return res.status(400).json({ error: true, code: 'MISSING_MODULE', message: '需要指定部署模块' });
      }

      // 检查模块权限
      if (!hasModuleAccess(req.user.modules, module)) {
        return res.status(403).json({
          error: true,
          code: 'MODULE_DENIED',
          reply: '❌ 你没有 ' + module + ' 模块的部署权限。'
        });
      }

      // 二次确认
      if (!confirmToken) {
        return res.json({
          success: false,
          requireConfirmation: true,
          reply: '⚠️ 你正在请求部署 ' + module + ' 到**正式站（guanghulab.com）**。\n这会影响所有用户。\n\n请说「确认部署 ' + module + '」来确认。'
        });
      }

      await githubService.triggerWorkflow('deploy-to-server.yml', {
        module: module,
        dev_id: devId,
        target: 'production'
      });

      res.json({
        success: true,
        reply: '🚀 已触发 ' + module + ' 模块的**正式站部署**。部署日志会同步到维护日志中。'
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'DEPLOY_FAILED', message: e.message });
    }
  }
);

// ====== 更新 Agent 状态 ======
router.patch('/agents/:agentId',
  authMiddleware.checkPermission('agent:update'),
  async function(req, res) {
    try {
      var agentId = req.params.agentId;
      var status = req.body.status;

      if (!status) {
        return res.status(400).json({ error: true, code: 'MISSING_STATUS', message: '状态不能为空' });
      }

      if (!notionService.notion) {
        return res.status(503).json({ error: true, code: 'NOTION_UNAVAILABLE', message: 'Notion 未连接' });
      }

      await notionService.notion.pages.update({
        page_id: agentId,
        properties: {
          '状态': { select: { name: status } }
        }
      });

      res.json({
        success: true,
        reply: '✅ Agent ' + agentId + ' 状态已更新为：' + status
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: e.message });
    }
  }
);

// ====== 写入维护日志 ======
router.post('/maintenance/log',
  authMiddleware.checkPermission('maintenance:log'),
  async function(req, res) {
    try {
      var title = req.body.title;
      var type = req.body.type || '常规维护';
      var devId = req.user.devId;

      if (!title) {
        return res.status(400).json({ error: true, code: 'MISSING_TITLE', message: '维护日志标题不能为空' });
      }

      var maintenanceDbId = getDbId(req, 'maintenanceLog');
      if (!maintenanceDbId) {
        return res.status(503).json({ error: true, code: 'DB_NOT_CONFIGURED', message: '维护日志数据库未配置' });
      }

      await notionService.writeToDB(maintenanceDbId, {
        '标题': { title: [{ text: { content: title } }] },
        '类型': { select: { name: type } },
        '操作者': { rich_text: [{ text: { content: devId } }] }
      });

      res.json({
        success: true,
        reply: '✅ 维护日志已记录：' + title
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'LOG_FAILED', message: e.message });
    }
  }
);

// ====== 提交指令回执 ======
router.post('/receipts/submit',
  authMiddleware.checkPermission('syslog:submit'),
  async function(req, res) {
    try {
      var instructionId = req.body.instruction_id;
      var status = req.body.status || '已完成';
      var receipt = req.body.receipt || '';

      if (!instructionId) {
        return res.status(400).json({ error: true, code: 'MISSING_ID', message: '指令编号不能为空' });
      }

      if (!dbConfig.receiptTracker) {
        return res.status(503).json({ error: true, code: 'DB_NOT_CONFIGURED', message: '回执数据库未配置' });
      }

      await notionService.writeToDB(dbConfig.receiptTracker, {
        '指令编号': { rich_text: [{ text: { content: instructionId } }] },
        '执行状态': { select: { name: status } },
        '铸渊回执': { rich_text: [{ text: { content: receipt } }] },
        '回执时间': { date: { start: new Date().toISOString() } }
      });

      res.json({
        success: true,
        reply: '✅ 指令 ' + instructionId + ' 回执已提交'
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'SUBMIT_FAILED', message: e.message });
    }
  }
);

// ====== 更新开发者状态 ======
router.patch('/dev/:devId/status',
  authMiddleware.checkPermission('dev:update_self'),
  async function(req, res) {
    try {
      var devId = req.params.devId;
      var status = req.body.status;

      // 验证 devId 格式
      if (!/^DEV-\d{3}$/.test(devId) && !/^TCS-\d{4}$/.test(devId)) {
        return res.status(400).json({ error: true, code: 'INVALID_DEV_ID', message: '无效的开发者编号' });
      }

      // 开发者只能更新自己的状态（管理者除外）
      if (req.user.devId !== devId && !req.user.permissions.includes('dev:update_all')) {
        return res.status(403).json({
          error: true,
          code: 'SELF_ONLY',
          message: '只能更新自己的状态',
          reply: '🔒 你只能更新自己的状态，不能修改其他开发者的信息。'
        });
      }

      if (!status) {
        return res.status(400).json({ error: true, code: 'MISSING_STATUS', message: '状态不能为空' });
      }

      // 更新 Notion 主控台中的状态
      if (dbConfig.controlPanel) {
        var result = await notionService.queryDB(dbConfig.controlPanel, {
          property: 'DEV编号',
          rich_text: { equals: devId }
        }, null, 1);

        if (result.results && result.results.length > 0) {
          await notionService.notion.pages.update({
            page_id: result.results[0].id,
            properties: {
              '状态': { rich_text: [{ text: { content: status } }] }
            }
          });
        }
      }

      res.json({
        success: true,
        reply: '✅ ' + devId + ' 的状态已更新为：' + status
      });
    } catch (e) {
      res.status(500).json({ error: true, code: 'UPDATE_FAILED', message: e.message });
    }
  }
);

module.exports = router;
