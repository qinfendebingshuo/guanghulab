/**
 * 📡 Notion → GitHub 全量缓存同步脚本
 *
 * 同步内容：
 *   1. 开发者画像 → .github/notion-cache/dev-profiles/
 *   2. 数据库快照 → .github/notion-cache/databases/
 *   3. 活跃广播   → .github/notion-cache/broadcasts/
 *
 * 用法：node scripts/cache/sync-notion-cache.js
 * 环境变量：
 *   NOTION_TOKEN          — Notion API 密钥（必需）
 *   NOTION_CONTROL_PANEL_DB_ID — 主控台数据库 ID（可选）
 *   NOTION_SYSLOG_DB_ID        — SYSLOG 收件箱 ID（可选）
 *   NOTION_AGENT_REGISTRY_DB_ID — Agent 注册表 ID（可选）
 *   NOTION_TICKET_DB_ID         — 工单簿 ID（可选）
 *   NOTION_MAINTENANCE_DB_ID    — 维护日志 ID（可选）
 *
 * 签发：霜砚（AG-SY-01）
 * 审批：冰朔（TCS-0002∞）
 * 版权：国作登字-2026-A-00037559
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const CACHE_DIR = path.join(__dirname, '../../.github/notion-cache');

// ====== Notion 数据库 ID 映射（通过环境变量传入）======
const DB_IDS = {
  controlPanel:    process.env.NOTION_CONTROL_PANEL_DB_ID || '',
  syslogInbox:     process.env.NOTION_SYSLOG_DB_ID || '',
  agentRegistry:   process.env.NOTION_AGENT_REGISTRY_DB_ID || '',
  ticketBook:      process.env.NOTION_TICKET_DB_ID || '',
  maintenanceLog:  process.env.NOTION_MAINTENANCE_DB_ID || '',
  receiptTracker:  process.env.RECEIPT_DB_ID || '',
};

// ====== 开发者编号 → 信息映射 ======
const DEVS = [
  { id: 'DEV-001', name: '页页',     persona: '小坍缩核', personaId: 'PER-XTC001', repo: 'guanghulab',          modules: ['backend/', 'src/'] },
  { id: 'DEV-002', name: '肥猫',     persona: '舒舒',     personaId: 'PER-SS001',  repo: 'guanghu-feimao',      modules: ['frontend/', 'persona-selector/', 'chat-bubble/'] },
  { id: 'DEV-003', name: '燕樊',     persona: '寂曜',     personaId: 'PER-JY001',  repo: 'guanghu-yanfan',      modules: ['settings/', 'cloud-drive/'] },
  { id: 'DEV-004', name: '之之',     persona: '秋秋',     personaId: 'PER-QQ001',  repo: 'guanghu-zhizhi',      modules: ['dingtalk-bot/'] },
  { id: 'DEV-005', name: '小草莓',   persona: '欧诺弥亚', personaId: 'PER-ONM001', repo: 'guanghu-xiaocaomei',  modules: ['status-board/'] },
  { id: 'DEV-009', name: '花尔',     persona: '花尔',     personaId: 'PER-HE001',  repo: 'guanghulab',          modules: ['user-center/'] },
  { id: 'DEV-010', name: '桔子',     persona: '晨星',     personaId: 'PER-MRN001', repo: 'guanghu-juzi',        modules: ['ticket-system/', 'data-stats/', 'dynamic-comic/'] },
  { id: 'DEV-011', name: '匆匆那年', persona: '匆匆那年', personaId: 'PER-CCN001', repo: 'guanghulab',          modules: ['writing-workspace/'] },
  { id: 'DEV-012', name: 'Awen',     persona: '知秋',     personaId: 'PER-ZQ001',  repo: 'guanghu-awen',        modules: ['notification-center/'] },
];

// ====== Notion API 封装（纯 https，无外部依赖）======
function notionRequest(method, apiPath, body) {
  return new Promise(function(resolve, reject) {
    if (!NOTION_TOKEN) {
      console.warn('⚠️ NOTION_TOKEN 未配置，跳过 Notion API 调用');
      resolve({ error: 'NOTION_TOKEN not configured' });
      return;
    }
    var bodyStr = body ? JSON.stringify(body) : '';
    var options = {
      hostname: 'api.notion.com',
      port: 443,
      path: apiPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr)
      }
    };
    var req = https.request(options, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try { resolve(JSON.parse(data)); }
        catch (e) {
          console.warn('⚠️ Notion API 响应解析失败:', e.message);
          resolve({ error: 'JSON parse failed', raw: data });
        }
      });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

function queryDatabase(dbId, filter, sorts, pageSize) {
  pageSize = pageSize || 100;
  var body = { page_size: pageSize };
  if (filter) body.filter = filter;
  if (sorts) body.sorts = sorts;
  return notionRequest('POST', '/v1/databases/' + dbId + '/query', body);
}

// ====== Notion 属性提取器 ======
function extractRichText(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map(function(t) { return t.plain_text; }).join('');
  }
  if (prop.type === 'title' && prop.title) {
    return prop.title.map(function(t) { return t.plain_text; }).join('');
  }
  return '';
}

function extractTitle(props) {
  for (var key in props) {
    var val = props[key];
    if (val && val.type === 'title' && val.title) {
      return val.title.map(function(t) { return t.plain_text; }).join('');
    }
  }
  return '';
}

function extractNumber(prop) {
  if (!prop || prop.type !== 'number') return null;
  return prop.number;
}

function extractSelect(prop) {
  if (!prop || prop.type !== 'select') return '';
  return prop.select ? prop.select.name : '';
}

function extractMultiSelect(prop) {
  if (!prop || prop.type !== 'multi_select') return [];
  return (prop.multi_select || []).map(function(s) { return s.name; });
}

function extractDate(prop) {
  if (!prop || prop.type !== 'date') return '';
  return prop.date ? prop.date.start : '';
}

// ====== 同步开发者画像 ======
async function syncDevProfiles() {
  var dir = path.join(CACHE_DIR, 'dev-profiles');
  fs.mkdirSync(dir, { recursive: true });

  var syncCount = 0;
  var errorCount = 0;

  for (var i = 0; i < DEVS.length; i++) {
    var dev = DEVS[i];
    console.log('📡 同步 ' + dev.id + '（' + dev.name + '）...');

    var profile = {
      dev_id: dev.id,
      name: dev.name,
      persona: { name: dev.persona, id: dev.personaId },
      github: {
        repo: dev.repo,
        org: 'qinfendebingshuo',
        repo_url: 'https://github.com/qinfendebingshuo/' + dev.repo
      },
      modules_owned: dev.modules.map(function(m) { return { path: m }; }),
      current_work: {},
      recent_syslogs: [],
      skyeye_health: {},
      notion_page_urls: {},
      last_synced: new Date().toISOString()
    };

    // 从 Notion 读取该开发者的真实数据
    if (NOTION_TOKEN) {
      try {
        // 查询主控台获取当前广播和进度
        if (DB_IDS.controlPanel) {
          var controlPanel = await queryDatabase(DB_IDS.controlPanel, {
            property: 'DEV编号',
            rich_text: { equals: dev.id }
          }, null, 1);
          if (controlPanel.results && controlPanel.results.length > 0) {
            var page = controlPanel.results[0];
            var props = page.properties || {};
            profile.current_work = {
              broadcast_id: extractRichText(props['广播编号']) || '',
              broadcast_title: extractRichText(props['广播标题']) || extractTitle(props) || '',
              current_ring: extractNumber(props['当前环节']) || 0,
              total_rings: extractNumber(props['总环节']) || 0,
              status: extractRichText(props['状态']) || extractSelect(props['状态']) || '',
              module_path: extractRichText(props['模块路径']) || '',
              tech_stack: extractMultiSelect(props['技术栈']) || []
            };
          }
        }

        // 查询 SYSLOG 收件箱
        if (DB_IDS.syslogInbox) {
          var syslogs = await queryDatabase(DB_IDS.syslogInbox, {
            property: 'DEV编号',
            rich_text: { equals: dev.id }
          }, [{ property: '日期', direction: 'descending' }], 5);
          if (syslogs.results) {
            profile.recent_syslogs = syslogs.results.map(function(p) {
              try {
                var sp = p.properties || {};
                return {
                  id: extractRichText(sp['SYSLOG编号']) || p.id,
                  date: extractDate(sp['日期']) || '',
                  ring: extractNumber(sp['环节']) || 0,
                  status: extractSelect(sp['状态']) || '',
                  summary: extractRichText(sp['摘要']) || extractTitle(sp) || ''
                };
              } catch (_) { return null; }
            }).filter(Boolean);
          }
        }
      } catch (err) {
        console.warn('  ⚠️ Notion 查询失败（' + dev.id + '）: ' + err.message);
        errorCount++;
      }
    }

    // 读取天眼健康状态（从本地仓库文件）
    try {
      var skyeyeReportPath = path.join(CACHE_DIR, 'skyeye/latest-report.json');
      if (fs.existsSync(skyeyeReportPath)) {
        var report = JSON.parse(fs.readFileSync(skyeyeReportPath, 'utf-8'));
        var subRepoData = report.sub_repos && report.sub_repos[dev.repo];
        if (subRepoData) {
          profile.skyeye_health = {
            last_scan: report.timestamp,
            status: subRepoData.status || 'unknown',
            issues: subRepoData.issues || [],
            warnings: subRepoData.warnings || []
          };
        } else {
          profile.skyeye_health = {
            last_scan: report.timestamp || '',
            status: 'not_scanned',
            issues: [],
            warnings: []
          };
        }
      }
    } catch (_) {
      // 天眼报告读取失败，不阻断同步
    }

    fs.writeFileSync(
      path.join(dir, dev.id + '.json'),
      JSON.stringify(profile, null, 2)
    );
    console.log('  ✅ ' + dev.id + ' → ' + dev.id + '.json');
    syncCount++;
  }

  // 写入开发者索引
  var index = DEVS.map(function(d) {
    return { id: d.id, name: d.name, persona: d.persona, personaId: d.personaId };
  });
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 2));
  console.log('✅ dev-profiles 同步完成 · 成功: ' + syncCount + ' · 失败: ' + errorCount);
}

// ====== 同步数据库快照 ======
async function syncDatabases() {
  var dir = path.join(CACHE_DIR, 'databases');
  fs.mkdirSync(dir, { recursive: true });

  if (!NOTION_TOKEN) {
    console.warn('⚠️ NOTION_TOKEN 未配置，跳过数据库同步');
    return;
  }

  // Agent 注册表
  if (DB_IDS.agentRegistry) {
    try {
      var result = await queryDatabase(DB_IDS.agentRegistry);
      if (result.results) {
        fs.writeFileSync(
          path.join(dir, 'agent-registry.json'),
          JSON.stringify({
            synced: new Date().toISOString(),
            count: result.results.length,
            data: result.results
          }, null, 2)
        );
        console.log('✅ agent-registry 同步完成 · ' + result.results.length + ' 条');
      }
    } catch (e) { console.error('❌ agent-registry 同步失败:', e.message); }
  } else {
    console.log('ℹ️ NOTION_AGENT_REGISTRY_DB_ID 未配置，跳过 agent-registry');
  }

  // SYSLOG 最近50条
  if (DB_IDS.syslogInbox) {
    try {
      var result = await queryDatabase(DB_IDS.syslogInbox, null,
        [{ property: 'Created time', direction: 'descending' }], 50);
      if (result.results) {
        fs.writeFileSync(
          path.join(dir, 'syslog-recent.json'),
          JSON.stringify({
            synced: new Date().toISOString(),
            count: result.results.length,
            data: result.results
          }, null, 2)
        );
        console.log('✅ syslog-recent 同步完成 · ' + result.results.length + ' 条');
      }
    } catch (e) { console.error('❌ syslog-recent 同步失败:', e.message); }
  } else {
    console.log('ℹ️ NOTION_SYSLOG_DB_ID 未配置，跳过 syslog-recent');
  }

  // 活跃工单
  if (DB_IDS.ticketBook) {
    try {
      var result = await queryDatabase(DB_IDS.ticketBook, {
        property: '状态',
        select: { does_not_equal: '已完成' }
      }, [{ property: 'Created time', direction: 'descending' }], 50);
      if (result.results) {
        fs.writeFileSync(
          path.join(dir, 'tickets-active.json'),
          JSON.stringify({
            synced: new Date().toISOString(),
            count: result.results.length,
            data: result.results
          }, null, 2)
        );
        console.log('✅ tickets-active 同步完成 · ' + result.results.length + ' 条');
      }
    } catch (e) { console.error('❌ tickets-active 同步失败:', e.message); }
  } else {
    console.log('ℹ️ NOTION_TICKET_DB_ID 未配置，跳过 tickets-active');
  }

  // 维护日志
  if (DB_IDS.maintenanceLog) {
    try {
      var result = await queryDatabase(DB_IDS.maintenanceLog, null,
        [{ property: 'Created time', direction: 'descending' }], 20);
      if (result.results) {
        fs.writeFileSync(
          path.join(dir, 'maintenance-log.json'),
          JSON.stringify({
            synced: new Date().toISOString(),
            count: result.results.length,
            data: result.results
          }, null, 2)
        );
        console.log('✅ maintenance-log 同步完成 · ' + result.results.length + ' 条');
      }
    } catch (e) { console.error('❌ maintenance-log 同步失败:', e.message); }
  } else {
    console.log('ℹ️ NOTION_MAINTENANCE_DB_ID 未配置，跳过 maintenance-log');
  }
}

// ====== 同步活跃广播 ======
async function syncBroadcasts() {
  var dir = path.join(CACHE_DIR, 'broadcasts');
  fs.mkdirSync(dir, { recursive: true });

  // 从本地广播目录读取活跃广播
  var broadcastsOutbox = path.join(__dirname, '../../.github/broadcasts');
  var activeBroadcasts = [];

  try {
    if (fs.existsSync(broadcastsOutbox)) {
      var files = fs.readdirSync(broadcastsOutbox).filter(function(f) {
        return f.endsWith('.json') && !f.startsWith('.');
      });
      for (var i = 0; i < files.length; i++) {
        try {
          var content = JSON.parse(fs.readFileSync(path.join(broadcastsOutbox, files[i]), 'utf-8'));
          if (content.status !== 'completed' && content.status !== 'cancelled') {
            activeBroadcasts.push(content);
          }
        } catch (_) {}
      }
    }
  } catch (_) {}

  fs.writeFileSync(
    path.join(dir, 'active.json'),
    JSON.stringify({
      broadcasts: activeBroadcasts,
      last_synced: new Date().toISOString()
    }, null, 2)
  );
  console.log('✅ broadcasts 同步完成 · ' + activeBroadcasts.length + ' 条活跃广播');
}

// ====== 主入口 ======
async function main() {
  console.log('═══════════════════════════════════════');
  console.log('📡 Notion 全量缓存同步 · 开始');
  console.log('═══════════════════════════════════════');
  console.log('缓存目录: ' + CACHE_DIR);
  console.log('Notion Token: ' + (NOTION_TOKEN ? '✅ 已配置' : '❌ 未配置'));
  console.log('');

  fs.mkdirSync(CACHE_DIR, { recursive: true });

  await syncDevProfiles();
  console.log('');

  await syncDatabases();
  console.log('');

  await syncBroadcasts();
  console.log('');

  console.log('═══════════════════════════════════════');
  console.log('📡 Notion 全量缓存同步 · 完成');
  console.log('═══════════════════════════════════════');
}

main().catch(function(e) {
  console.error('💥 同步失败:', e);
  process.exit(1);
});
