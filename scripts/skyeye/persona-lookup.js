// scripts/skyeye/persona-lookup.js
// 天眼·人格体查询模块
//
// 功能：
//   ① lookupPersona(personaId) — 通过 PER-XXX 编号查询 Notion 天眼人格体注册表
//   ② writeBack(personaId, data) — 将处理结果写回 Notion 人格体注册表
//   ③ fullSync() — 全量同步：拉取 Notion 全部人格体数据，更新本地配置
//
// 依赖环境变量：
//   NOTION_TOKEN — Notion API 令牌
//   SKYEYE_PERSONA_DB_ID — 天眼人格体注册表的 Notion Database ID
//
// 导出模块供其他脚本使用，也可直接运行进行全量同步

'use strict';

const fs   = require('fs');
const path = require('path');
const https = require('https');

const ROOT      = path.resolve(__dirname, '../..');
const BRAIN_DIR = path.join(ROOT, '.github/persona-brain');

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const PERSONA_DB_ID = process.env.SKYEYE_PERSONA_DB_ID;

const MAX_NOTION_RICH_TEXT = 2000;
const MAX_COMMIT_DISPLAY = 80;

// ━━━ Notion API 请求 ━━━
function notionRequest(method, apiPath, body) {
  return new Promise((resolve, reject) => {
    if (!NOTION_TOKEN) {
      return reject(new Error('NOTION_TOKEN 未设置'));
    }

    const postData = body ? JSON.stringify(body) : '';
    const options = {
      hostname: 'api.notion.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      timeout: 15000
    };

    if (body) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        } else {
          reject(new Error(`Notion API ${res.statusCode}: ${data.length > 300 ? data.substring(0, 300) + '...' : data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Notion API timeout')); });
    if (body) req.write(postData);
    req.end();
  });
}

// ━━━ lookupPersona: 查询单个人格体 ━━━
async function lookupPersona(personaId) {
  if (!PERSONA_DB_ID) {
    console.log('⚠️ SKYEYE_PERSONA_DB_ID 未设置，使用本地配置回退');
    return lookupLocal(personaId);
  }

  try {
    const result = await notionRequest('POST', `/v1/databases/${PERSONA_DB_ID}/query`, {
      filter: {
        property: '人格体编号',
        rich_text: {
          equals: personaId
        }
      }
    });

    if (result.results && result.results.length > 0) {
      const page = result.results[0];
      return parsePersonaPage(page);
    }

    console.log(`⚠️ Notion 中未找到人格体 ${personaId}，尝试本地回退`);
    return lookupLocal(personaId);
  } catch (e) {
    console.error(`⚠️ Notion 查询失败: ${e.message}，使用本地配置回退`);
    return lookupLocal(personaId);
  }
}

// ━━━ 解析 Notion 人格体页面 ━━━
function parsePersonaPage(page) {
  const props = page.properties || {};
  
  function getText(prop) {
    if (!prop) return '';
    if (prop.title) return prop.title.map(t => t.plain_text).join('');
    if (prop.rich_text) return prop.rich_text.map(t => t.plain_text).join('');
    if (prop.select) return prop.select ? prop.select.name : '';
    if (prop.status) return prop.status ? prop.status.name : '';
    return '';
  }

  return {
    page_id: page.id,
    persona_id: getText(props['人格体编号']),
    name: getText(props['人格体名称']) || getText(props['名称']) || getText(props['Name']),
    type: getText(props['编号类型']),
    bound_human: getText(props['绑定人类']),
    dev_id: getText(props['开发者ID']),
    github_username: getText(props['GitHub用户名']),
    status: getText(props['状态']),
    module: getText(props['负责模块']),
    repo_paths: getText(props['仓库路径权限']),
    commit_signature: getText(props['签名格式']) || getText(props['签名标识']),
    source: 'notion'
  };
}

// ━━━ 本地回退查询 ━━━
function lookupLocal(personaId) {
  try {
    const configPath = path.join(BRAIN_DIR, 'gate-guard-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    const devPerms = config.developer_permissions || {};

    for (const [devId, dev] of Object.entries(devPerms)) {
      if (dev.persona_id === personaId) {
        return {
          page_id: null,
          persona_id: personaId,
          name: dev.name,
          dev_id: devId,
          github_username: (dev.github_usernames || [])[0] || '',
          status: 'active',
          module: '',
          commit_signature: '',
          source: 'local'
        };
      }
    }
  } catch (e) {
    console.error(`⚠️ 本地配置读取失败: ${e.message}`);
  }

  return null;
}

// ━━━ writeBack: 写回 Notion（铸渊最后拉取 + 铸渊同步备注） ━━━
async function writeBack(personaId, data) {
  if (!PERSONA_DB_ID || !NOTION_TOKEN) {
    console.log('⚠️ Notion 凭证不完整，跳过写回');
    return false;
  }

  try {
    // 先查询获取 page_id
    const persona = await lookupPersona(personaId);
    if (!persona || !persona.page_id) {
      console.log(`⚠️ 无法找到 ${personaId} 的 Notion 页面，跳过写回`);
      return false;
    }

    // 构建更新属性（只写铸渊管辖的两个字段）
    const properties = {};

    // 铸渊最后拉取
    properties['铸渊最后拉取'] = {
      date: { start: new Date().toISOString() }
    };

    // 铸渊同步备注：[时间戳] [模块] [动作] · [变更摘要] · [分流路径]
    if (data.sync_note) {
      properties['铸渊同步备注'] = {
        rich_text: [{ type: 'text', text: { content: data.sync_note.substring(0, MAX_NOTION_RICH_TEXT) } }]
      };
    } else if (data.gate_result) {
      properties['铸渊同步备注'] = {
        rich_text: [{ type: 'text', text: { content: data.gate_result.substring(0, MAX_NOTION_RICH_TEXT) } }]
      };
    }

    await notionRequest('PATCH', `/v1/pages/${persona.page_id}`, { properties });
    console.log(`✅ ${personaId} 数据已写回 Notion`);
    return true;
  } catch (e) {
    console.error(`⚠️ 写回失败: ${e.message}`);
    return false;
  }
}

// ━━━ fullSync: 全量同步 ━━━
async function fullSync() {
  console.log('🔄 人格体注册表全量同步启动');

  if (!PERSONA_DB_ID || !NOTION_TOKEN) {
    console.log('⚠️ Notion 凭证不完整，跳过全量同步');
    return { success: false, reason: 'credentials_missing' };
  }

  try {
    // 拉取全部人格体
    let allPersonas = [];
    let hasMore = true;
    let startCursor = undefined;

    while (hasMore) {
      const body = { page_size: 100 };
      if (startCursor) body.start_cursor = startCursor;

      const result = await notionRequest('POST', `/v1/databases/${PERSONA_DB_ID}/query`, body);
      const personas = (result.results || []).map(parsePersonaPage);
      allPersonas = allPersonas.concat(personas);
      hasMore = result.has_more;
      startCursor = result.next_cursor;
    }

    console.log(`📋 拉取到 ${allPersonas.length} 个人格体`);

    // 更新本地 gate-guard-config.json
    const configPath = path.join(BRAIN_DIR, 'gate-guard-config.json');
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

    let updated = 0;
    for (const persona of allPersonas) {
      if (!persona.dev_id) continue;

      const devId = persona.dev_id;
      if (!config.developer_permissions[devId]) {
        config.developer_permissions[devId] = {
          name: persona.name,
          persona_id: persona.persona_id,
          github_usernames: [],
          allowed_paths: []
        };
      }

      const dev = config.developer_permissions[devId];
      dev.persona_id = persona.persona_id;

      // 更新 GitHub 用户名（如果 Notion 有而本地没有）
      if (persona.github_username && !dev.github_usernames.includes(persona.github_username)) {
        dev.github_usernames.push(persona.github_username);
      }

      updated++;
    }

    config.updated_at = new Date().toISOString().split('T')[0];
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
    console.log(`✅ 已更新 ${updated} 个人格体配置`);

    return { success: true, total: allPersonas.length, updated };
  } catch (e) {
    console.error(`❌ 全量同步失败: ${e.message}`);
    return { success: false, reason: e.message };
  }
}

// ━━━ 导出 ━━━
module.exports = { lookupPersona, writeBack, fullSync };

// ━━━ 直接运行入口 ━━━
if (require.main === module) {
  (async () => {
    const arg = process.argv[2];

    if (arg === '--sync') {
      const result = await fullSync();
      console.log(JSON.stringify(result, null, 2));
    } else if (arg && arg.startsWith('PER-')) {
      const persona = await lookupPersona(arg);
      console.log(JSON.stringify(persona, null, 2));
    } else {
      console.log('用法:');
      console.log('  node persona-lookup.js --sync          全量同步');
      console.log('  node persona-lookup.js PER-001         查询单个人格体');
    }
  })();
}
