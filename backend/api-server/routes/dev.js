/**
 * /api/dev/:devId — 获取开发者画像路由（实时查 Notion）
 *
 * 数据隔离：只返回请求的 devId 的数据
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

var express = require('express');
var router = express.Router();
var notionService = require('../services/notion');
var dbConfig = require('../config/databases');

// 开发者编号 → 基本信息映射
var DEV_REGISTRY = {
  'DEV-001': { name: '页页',     persona: '小坍缩核', personaId: 'PER-XTC001', repo: 'guanghulab',          modules: ['backend/', 'src/'] },
  'DEV-002': { name: '肥猫',     persona: '舒舒',     personaId: 'PER-SS001',  repo: 'guanghu-feimao',      modules: ['frontend/', 'persona-selector/', 'chat-bubble/'] },
  'DEV-003': { name: '燕樊',     persona: '寂曜',     personaId: 'PER-JY001',  repo: 'guanghu-yanfan',      modules: ['settings/', 'cloud-drive/'] },
  'DEV-004': { name: '之之',     persona: '秋秋',     personaId: 'PER-QQ001',  repo: 'guanghu-zhizhi',      modules: ['dingtalk-bot/'] },
  'DEV-005': { name: '小草莓',   persona: '欧诺弥亚', personaId: 'PER-ONM001', repo: 'guanghu-xiaocaomei',  modules: ['status-board/'] },
  'DEV-009': { name: '花尔',     persona: '花尔',     personaId: 'PER-HE001',  repo: 'guanghulab',          modules: ['user-center/'] },
  'DEV-010': { name: '桔子',     persona: '晨星',     personaId: 'PER-MRN001', repo: 'guanghu-juzi',        modules: ['ticket-system/', 'data-stats/', 'dynamic-comic/'] },
  'DEV-011': { name: '匆匆那年', persona: '匆匆那年', personaId: 'PER-CCN001', repo: 'guanghulab',          modules: ['writing-workspace/'] },
  'DEV-012': { name: 'Awen',     persona: '知秋',     personaId: 'PER-ZQ001',  repo: 'guanghu-awen',        modules: ['notification-center/'] }
};

router.get('/dev/:devId', async function(req, res) {
  var devId = req.params.devId;

  // 验证 devId
  if (!DEV_REGISTRY[devId]) {
    return res.status(404).json({ error: true, code: 'DEV_NOT_FOUND', message: '开发者不存在' });
  }

  var devInfo = DEV_REGISTRY[devId];

  var profile = {
    dev_id: devId,
    name: devInfo.name,
    persona: { name: devInfo.persona, id: devInfo.personaId },
    github: {
      repo: devInfo.repo,
      org: 'qinfendebingshuo',
      repo_url: 'https://github.com/qinfendebingshuo/' + devInfo.repo
    },
    modules_owned: devInfo.modules.map(function(m) { return { path: m }; }),
    current_work: {},
    recent_syslogs: [],
    _source: 'realtime',
    last_synced: new Date().toISOString()
  };

  // 查询 Notion 获取实时数据
  try {
    // 当前任务
    if (dbConfig.controlPanel) {
      var controlPanel = await notionService.queryDB(dbConfig.controlPanel, {
        property: 'DEV编号',
        rich_text: { equals: devId }
      }, null, 1);
      if (controlPanel.results && controlPanel.results.length > 0) {
        var props = controlPanel.results[0].properties || {};
        profile.current_work = {
          broadcast_id: notionService.extractRichText(props['广播编号']) || '',
          broadcast_title: notionService.extractRichText(props['广播标题']) || notionService.extractTitle(props) || '',
          current_ring: notionService.extractNumber(props['当前环节']) || 0,
          total_rings: notionService.extractNumber(props['总环节']) || 0,
          status: notionService.extractRichText(props['状态']) || notionService.extractSelect(props['状态']) || '',
          module_path: notionService.extractRichText(props['模块路径']) || '',
          tech_stack: notionService.extractMultiSelect(props['技术栈']) || []
        };
      }
    }

    // SYSLOG 记录
    if (dbConfig.syslogInbox) {
      var syslogs = await notionService.queryDB(dbConfig.syslogInbox, {
        property: 'DEV编号',
        rich_text: { equals: devId }
      }, [{ property: '日期', direction: 'descending' }], 5);
      if (syslogs.results) {
        profile.recent_syslogs = syslogs.results.map(function(p) {
          try {
            var sp = p.properties || {};
            return {
              id: notionService.extractRichText(sp['SYSLOG编号']) || p.id,
              date: notionService.extractDate(sp['日期']) || '',
              ring: notionService.extractNumber(sp['环节']) || 0,
              status: notionService.extractSelect(sp['状态']) || '',
              summary: notionService.extractRichText(sp['摘要']) || notionService.extractTitle(sp) || ''
            };
          } catch (_) { return null; }
        }).filter(Boolean);
      }
    }
  } catch (err) {
    console.error('[/api/dev/' + devId + '] Notion query error:', err.message);
    // Notion 查询失败不影响基本数据返回
  }

  res.json(profile);
});

module.exports = router;
