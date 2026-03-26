// scripts/neural/sync-notion-directives.js
// 🧬 Notion 指令同步脚本（方案B · 汇总引擎附带同步）
// 从 Notion「⚒️ 铸渊·协作指令」页面读取最新指令，更新 memory.json 的 notion_sync 字段
// 兜底：即使 Notion API 不可用，也保证 notion_sync 字段结构存在

'use strict';

const fs = require('fs');
const path = require('path');

const MEMORY_PATH = path.join(__dirname, '../../.github/persona-brain/memory.json');
const NOTION_TOKEN = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;
const DIRECTIVES_DB_ID = process.env.DIRECTIVES_DB_ID || '';

async function syncNotionDirectives() {
  console.log('🔄 Notion 指令同步开始...');

  // 读取当前 memory.json
  let memory;
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  } catch (err) {
    console.error('❌ memory.json 读取失败:', err.message);
    process.exit(1);
  }

  // 确保 notion_sync 字段存在
  if (!memory.notion_sync) {
    memory.notion_sync = {
      last_sync_time: new Date().toISOString(),
      sync_source: 'sync-notion-directives.js',
      active_directives: [],
      architecture_version: {},
      recent_incidents: []
    };
  }

  let notionSuccess = false;

  // 尝试从 Notion API 读取指令
  if (NOTION_TOKEN && DIRECTIVES_DB_ID) {
    try {
      console.log('📡 尝试从 Notion API 读取指令...');
      const { Client } = require('@notionhq/client');
      const notion = new Client({ auth: NOTION_TOKEN });

      const response = await notion.databases.query({
        database_id: DIRECTIVES_DB_ID,
        filter: {
          property: 'Status',
          select: { equals: 'active' }
        },
        sorts: [{ property: 'Priority', direction: 'ascending' }]
      });

      if (response.results && response.results.length > 0) {
        const directives = response.results.map(page => {
          const props = page.properties || {};
          return {
            id: (props['ID'] && props['ID'].rich_text && props['ID'].rich_text[0]) ? props['ID'].rich_text[0].plain_text : '',
            title: (props['Name'] && props['Name'].title && props['Name'].title[0]) ? props['Name'].title[0].plain_text : '',
            priority: (props['Priority'] && props['Priority'].select) ? props['Priority'].select.name : '',
            status: 'active',
            summary: (props['Summary'] && props['Summary'].rich_text && props['Summary'].rich_text[0]) ? props['Summary'].rich_text[0].plain_text : ''
          };
        }).filter(d => d.id);

        if (directives.length > 0) {
          memory.notion_sync.active_directives = directives;
          notionSuccess = true;
          console.log(`✅ 从 Notion 读取到 ${directives.length} 条活跃指令`);
        }
      }
    } catch (err) {
      console.log('⚠️ Notion API 读取失败: ' + err.message);
      console.log('   使用本地缓存的指令数据');
    }
  } else {
    console.log('⚠️ NOTION_TOKEN 或 DIRECTIVES_DB_ID 未配置，跳过 Notion API 拉取');
  }

  // 更新同步时间
  const syncTime = new Date();
  memory.notion_sync.last_sync_time = syncTime.toISOString();
  memory.notion_sync.sync_source = notionSuccess ? 'Notion API (sync-notion-directives.js)' : memory.notion_sync.sync_source;

  // 写回 memory.json
  try {
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(memory, null, 2));
    console.log('✅ memory.json notion_sync 字段已更新');
  } catch (err) {
    console.error('❌ memory.json 写入失败:', err.message);
    process.exit(1);
  }

  // 输出同步状态摘要
  const directives = memory.notion_sync.active_directives || [];
  const p0Count = directives.filter(d => d.priority === 'P0' && d.status === 'active').length;

  console.log('\n━━━ 🧠 Notion 指令同步完成 ━━━');
  console.log(`同步时间：${syncTime.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} CST`);
  console.log(`数据来源：${notionSuccess ? 'Notion API' : '本地缓存'}`);
  console.log(`活跃指令：${directives.length} 条（P0: ${p0Count} 条）`);
  directives.filter(d => d.priority === 'P0').forEach(d => {
    console.log(`  → ${d.id}（${d.title}）`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

syncNotionDirectives().catch(function(err) {
  console.error('❌ Notion 指令同步失败:', err);
  // 不阻断主流程，自然退出
});
