/**
 * 📡 Notion → GitHub 开发者画像同步脚本
 * 
 * 从 Notion API 读取开发者信息，写入 .github/notion-cache/dev-profiles/
 * 供铸渊交互页面前端读取，注入模型 system prompt
 * 
 * 用法：node scripts/sync-notion-profiles.js
 * 环境变量：NOTION_TOKEN（必需）
 * 
 * 签发：霜砚（Notion 执行 AI）
 * 审批：冰朔（TCS-0002∞）
 */

'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');

const NOTION_TOKEN = process.env.NOTION_TOKEN;

// ===== 开发者 → Notion 数据源映射 =====
const DEV_REGISTRY = {
  'DEV-001': { name: '页页',   persona: '小坍缩核', personaId: 'PER-XTC001', repo: 'guanghulab' },
  'DEV-002': { name: '肥猫',   persona: '舒舒',     personaId: 'PER-SS001',  repo: 'guanghu-feimao' },
  'DEV-003': { name: '燕樊',   persona: '寂曜',     personaId: 'PER-JY001',  repo: 'guanghu-yanfan' },
  'DEV-004': { name: '之之',   persona: '秋秋',     personaId: 'PER-QQ001',  repo: 'guanghu-zhizhi' },
  'DEV-005': { name: '小草莓', persona: '欧诺弥亚', personaId: 'PER-ONM001', repo: 'guanghu-xiaocaomei' },
  'DEV-010': { name: '桔子',   persona: '晨星',     personaId: 'PER-MRN001', repo: 'guanghu-juzi' },
  'DEV-012': { name: 'Awen',   persona: '知秋',     personaId: 'PER-ZQ001',  repo: 'guanghu-awen' },
};

// Notion API 请求封装
function notionRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    if (!NOTION_TOKEN) {
      console.warn('⚠️ NOTION_TOKEN 未配置，跳过 Notion API 调用');
      resolve({ error: 'NOTION_TOKEN not configured' });
      return;
    }
    const options = {
      hostname: 'api.notion.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (parseErr) {
          console.warn('⚠️ Notion API 响应解析失败:', parseErr.message);
          resolve({ error: 'JSON parse failed', raw: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function syncAllProfiles() {
  const cacheDir = path.join(__dirname, '../.github/notion-cache/dev-profiles');
  fs.mkdirSync(cacheDir, { recursive: true });

  const broadcastDir = path.join(__dirname, '../.github/notion-cache/broadcasts');
  fs.mkdirSync(broadcastDir, { recursive: true });

  let syncCount = 0;
  let errorCount = 0;

  for (const [devId, dev] of Object.entries(DEV_REGISTRY)) {
    console.log(`📡 同步 ${devId}（${dev.name}）...`);

    const profile = {
      dev_id: devId,
      name: dev.name,
      persona: {
        name: dev.persona,
        id: dev.personaId
      },
      github: {
        repo: dev.repo,
        org: 'qinfendebingshuo',
        repo_url: `https://github.com/qinfendebingshuo/${dev.repo}`
      },
      current_work: {},
      recent_syslogs: [],
      modules_owned: [],
      skyeye_health: {},
      notion_page_urls: {},
      last_synced: new Date().toISOString()
    };

    // ====== 从 Notion 读取该开发者的数据 ======
    // Notion Token 可用时尝试读取真实数据
    if (NOTION_TOKEN) {
      try {
        // 查询主控台获取当前广播和进度
        // 铸渊需要根据实际 Notion 数据库 ID 填入查询逻辑
        // 预留接口，Notion 数据库 ID 通过环境变量传入
        const controlPanelDbId = process.env.NOTION_CONTROL_PANEL_DB_ID;
        if (controlPanelDbId) {
          const controlPanel = await notionRequest('POST',
            `/v1/databases/${controlPanelDbId}/query`,
            {
              filter: {
                property: 'DEV编号',
                rich_text: { equals: devId }
              },
              page_size: 1
            }
          );
          if (controlPanel.results && controlPanel.results.length > 0) {
            const page = controlPanel.results[0];
            profile.current_work = parseControlPanelData(page);
          }
        }

        // 查询 SYSLOG 收件箱获取历史日志
        const syslogDbId = process.env.NOTION_SYSLOG_DB_ID;
        if (syslogDbId) {
          const syslogs = await notionRequest('POST',
            `/v1/databases/${syslogDbId}/query`,
            {
              filter: {
                property: 'DEV编号',
                rich_text: { equals: devId }
              },
              sorts: [{ property: '日期', direction: 'descending' }],
              page_size: 5
            }
          );
          if (syslogs.results) {
            profile.recent_syslogs = syslogs.results.map(parseSyslogEntry).filter(Boolean);
          }
        }
      } catch (err) {
        console.warn(`  ⚠️ Notion 查询失败（${devId}）: ${err.message}`);
        errorCount++;
      }
    }

    // 读取天眼健康状态（从本地仓库文件）
    try {
      const skyeyeReportPath = path.join(__dirname, '../.github/notion-cache/skyeye/latest-report.json');
      if (fs.existsSync(skyeyeReportPath)) {
        const report = JSON.parse(fs.readFileSync(skyeyeReportPath, 'utf-8'));
        const subRepoData = report.sub_repos && report.sub_repos[dev.repo];
        if (subRepoData) {
          profile.skyeye_health = {
            last_scan: report.timestamp,
            status: subRepoData.status || 'unknown',
            issues: subRepoData.issues || [],
            warnings: subRepoData.warnings || []
          };
        } else {
          profile.skyeye_health = {
            last_scan: report.timestamp,
            status: 'not_scanned',
            issues: [],
            warnings: []
          };
        }
      }
    } catch (_) {
      // 天眼报告读取失败，不阻断同步
    }

    // 写入缓存文件
    const filePath = path.join(cacheDir, `${devId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(profile, null, 2));
    console.log(`  ✅ ${devId} → ${filePath}`);
    syncCount++;
  }

  console.log(`\n📡 同步完成 · 成功: ${syncCount} · 失败: ${errorCount}`);
}

// ===== 解析函数 =====

function parseControlPanelData(page) {
  try {
    const props = page.properties || {};
    return {
      broadcast_id: extractRichText(props['广播编号']) || '',
      broadcast_title: extractRichText(props['广播标题']) || extractTitle(props) || '',
      current_ring: extractNumber(props['当前环节']) || 0,
      total_rings: extractNumber(props['总环节']) || 0,
      status: extractRichText(props['状态']) || extractSelect(props['状态']) || '',
      module_path: extractRichText(props['模块路径']) || '',
      tech_stack: extractMultiSelect(props['技术栈']) || []
    };
  } catch (_) {
    return {};
  }
}

function parseSyslogEntry(page) {
  try {
    const props = page.properties || {};
    return {
      id: extractRichText(props['SYSLOG编号']) || page.id,
      date: extractDate(props['日期']) || '',
      ring: extractNumber(props['环节']) || 0,
      status: extractSelect(props['状态']) || '',
      summary: extractRichText(props['摘要']) || extractTitle(props) || ''
    };
  } catch (_) {
    return null;
  }
}

// Notion property extractors
function extractRichText(prop) {
  if (!prop) return '';
  if (prop.type === 'rich_text' && prop.rich_text) {
    return prop.rich_text.map(t => t.plain_text).join('');
  }
  if (prop.type === 'title' && prop.title) {
    return prop.title.map(t => t.plain_text).join('');
  }
  return '';
}

function extractTitle(props) {
  for (const val of Object.values(props)) {
    if (val.type === 'title' && val.title) {
      return val.title.map(t => t.plain_text).join('');
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
  return (prop.multi_select || []).map(s => s.name);
}

function extractDate(prop) {
  if (!prop || prop.type !== 'date') return '';
  return prop.date ? prop.date.start : '';
}

// ===== 执行 =====
syncAllProfiles().catch(err => {
  console.error('❌ 同步失败:', err);
  process.exit(1);
});
