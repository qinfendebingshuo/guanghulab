/**
 * ━━━ HLDP 自动同步引擎 ━━━
 * TCS 通感语言核系统编程语言 · 第一个落地协议层
 * HLDP = TCS 在 Notion ↔ GitHub 通道上的落地实现
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 * 指令来源：SY-CMD-BRG-005
 *
 * 用法：
 *   node sync-engine.js --direction notion-to-github --scope all
 *   node sync-engine.js --direction notion-to-github --scope personas
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const DATA_DIR = path.join(ROOT, 'hldp', 'data');
const TEMP_DIR = path.join(ROOT, 'temp', 'notion-raw');
const SYNC_LOG = path.join(ROOT, 'signal-log', 'hldp-sync-log.json');

let notionClient = null;

/**
 * Initialize Notion client
 */
function initNotionClient() {
  const token = process.env.NOTION_TOKEN || process.env.NOTION_API_KEY;

  if (!token) {
    console.log('⚠️ NOTION_TOKEN 未设置 — 仅执行本地模式');
    return null;
  }

  try {
    const { Client } = require('@notionhq/client');
    return new Client({ auth: token });
  } catch (e) {
    console.log(`⚠️ Notion SDK 加载失败: ${e.message}`);
    return null;
  }
}

/**
 * Fetch a Notion database and save raw results
 */
async function fetchDatabase(notion, dbId, name) {
  console.log(`  📥 拉取数据库: ${name} (${dbId})`);

  try {
    const results = [];
    let cursor;

    do {
      const response = await notion.databases.query({
        database_id: dbId,
        start_cursor: cursor,
        page_size: 100
      });

      results.push(...response.results);
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);

    // Save raw data
    const outFile = path.join(TEMP_DIR, `${name}.json`);
    fs.writeFileSync(outFile, JSON.stringify({ results }, null, 2), 'utf8');
    console.log(`    ✅ ${results.length} 条记录已保存`);
    return results.length;
  } catch (e) {
    console.error(`    ❌ 拉取失败: ${e.message}`);
    return 0;
  }
}

/**
 * Fetch a single Notion page and save raw data
 */
async function fetchPage(notion, pageId, name) {
  console.log(`  📥 拉取页面: ${name} (${pageId})`);

  try {
    const page = await notion.pages.retrieve({ page_id: pageId });

    // Also fetch page blocks for content
    const blocksResp = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    });

    const combined = { ...page, blocks: blocksResp.results };

    const outFile = path.join(TEMP_DIR, `${name}.json`);
    fs.writeFileSync(outFile, JSON.stringify(combined, null, 2), 'utf8');
    console.log(`    ✅ 页面已保存`);
    return 1;
  } catch (e) {
    console.error(`    ❌ 拉取失败: ${e.message}`);
    return 0;
  }
}

/**
 * Get sync targets from config or defaults
 */
function getSyncTargets(scope) {
  // These would normally come from a config file
  // For now, define the known Notion resources
  const configPath = path.join(ROOT, 'hldp', 'bridge', 'sync-config.json');
  let config = {};

  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  const allTargets = config.targets || [];

  if (scope === 'all') return allTargets;
  return allTargets.filter(t => t.scope === scope);
}

/**
 * Run local-only sync (when NOTION_TOKEN is not available)
 * Converts any existing raw data in temp/ to HLDP format
 */
function runLocalSync() {
  console.log('📋 本地模式: 转换已有原始数据...');

  const converter = require('./notion-to-hldp');

  const tempExists = fs.existsSync(TEMP_DIR);
  const files = tempExists ? fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.json')) : [];

  if (files.length === 0) {
    console.log('  ℹ️ 无原始 Notion 数据 — 从仓库现有数据生成 HLDP 文件...');
    generateFromRepoData();
    return;
  }
  let converted = 0;

  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, file), 'utf8'));
      let entries;

      if (raw.results) {
        entries = converter.notionDatabaseToHLDP(raw);
      } else if (raw.id) {
        entries = [converter.notionPageToHLDP(raw, raw.blocks)];
      } else {
        continue;
      }

      for (const entry of entries) {
        const typeDir = {
          persona: 'personas',
          registry: 'registries',
          instruction: 'instructions',
          broadcast: 'broadcasts',
          id_system: 'id-system'
        }[entry.data_type] || 'registries';

        const outDir = path.join(DATA_DIR, typeDir);
        fs.mkdirSync(outDir, { recursive: true });

        const safeName = entry.metadata.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        fs.writeFileSync(
          path.join(outDir, `${safeName}.json`),
          JSON.stringify(entry, null, 2),
          'utf8'
        );
        converted++;
      }
    } catch (e) {
      console.error(`  ❌ ${file}: ${e.message}`);
    }
  }

  console.log(`  ✅ 本地转换完成: ${converted} 条`);
}

/**
 * Generate HLDP data from existing repository files
 */
function generateFromRepoData() {
  const converter = require('./notion-to-hldp');
  let count = 0;

  // Convert community-meta.json to HLDP registry
  const communityPath = path.join(ROOT, '.github/community/community-meta.json');
  if (fs.existsSync(communityPath)) {
    const meta = JSON.parse(fs.readFileSync(communityPath, 'utf8'));
    const hldp = {
      hldp_version: converter.HLDP_VERSION,
      data_type: 'registry',
      source: {
        platform: 'github',
        last_edited: new Date().toISOString(),
        edited_by: 'sync-engine'
      },
      metadata: {
        id: 'REG-COMMUNITY-META',
        name: meta.community_name || '光湖语言世界',
        created: meta.birth_date || '2025-04-26T00:00:00Z',
        tags: ['community', 'meta']
      },
      payload: {
        registry_type: 'id_map',
        entries: Object.entries(meta.id_system || {}).map(([id, info]) => ({
          id,
          name: id,
          role: info.type,
          status: 'active',
          properties: info
        }))
      },
      relations: []
    };

    const outDir = path.join(DATA_DIR, 'registries');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'REG-COMMUNITY-META.json'), JSON.stringify(hldp, null, 2), 'utf8');
    count++;
    console.log('    ✅ community-meta → HLDP registry');
  }

  // Convert dev-status.json to HLDP registry
  const devStatusPath = path.join(ROOT, '.github/persona-brain/dev-status.json');
  if (fs.existsSync(devStatusPath)) {
    const devStatus = JSON.parse(fs.readFileSync(devStatusPath, 'utf8'));
    const hldp = {
      hldp_version: converter.HLDP_VERSION,
      data_type: 'registry',
      source: {
        platform: 'github',
        last_edited: devStatus.last_sync || new Date().toISOString(),
        edited_by: devStatus.signed_by || 'sync-engine'
      },
      metadata: {
        id: 'REG-DEV-STATUS',
        name: '开发者状态注册表',
        name_en: 'Developer Status Registry',
        created: devStatus.last_sync || new Date().toISOString(),
        tags: ['developers', 'status']
      },
      payload: {
        registry_type: 'dev_registry',
        entries: (devStatus.developers || []).map(d => ({
          id: d.dev_id,
          name: d.name,
          role: d.module || '',
          status: d.status,
          properties: {
            persona_id: d.persona_id,
            current: d.current,
            waiting: d.waiting,
            streak: d.streak
          }
        }))
      },
      relations: []
    };

    const outDir = path.join(DATA_DIR, 'registries');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, 'REG-DEV-STATUS.json'), JSON.stringify(hldp, null, 2), 'utf8');
    count++;
    console.log('    ✅ dev-status → HLDP registry');
  }

  // Convert baby_status from community-meta to HLDP personas
  if (fs.existsSync(communityPath)) {
    const meta = JSON.parse(fs.readFileSync(communityPath, 'utf8'));
    const babies = meta.baby_status || {};

    for (const [name, info] of Object.entries(babies)) {
      const hldp = {
        hldp_version: converter.HLDP_VERSION,
        data_type: 'persona',
        source: {
          platform: 'github',
          last_edited: new Date().toISOString(),
          edited_by: 'sync-engine'
        },
        metadata: {
          id: `PER-BABY-${name}`,
          name,
          created: info.born_date || new Date().toISOString(),
          tags: ['baby', info.status]
        },
        payload: {
          persona_id: `PER-BABY-${name}`,
          display_name: name,
          status: info.status,
          birth_date: info.born_date || null,
          bottle_core: null
        },
        relations: []
      };

      const outDir = path.join(DATA_DIR, 'personas');
      fs.mkdirSync(outDir, { recursive: true });
      const safeName = name.replace(/[^a-zA-Z0-9_\u4e00-\u9fff-]/g, '_');
      fs.writeFileSync(path.join(outDir, `PER-BABY-${safeName}.json`), JSON.stringify(hldp, null, 2), 'utf8');
      count++;
    }
    console.log(`    ✅ baby_status → ${Object.keys(babies).length} HLDP personas`);
  }

  console.log(`  📊 共生成 ${count} 个 HLDP 文件`);
}

/**
 * Write sync log
 */
function writeSyncLog(direction, scope, stats) {
  const log = {
    timestamp: new Date().toISOString(),
    direction,
    scope,
    stats,
    engine_version: '1.0'
  };

  fs.mkdirSync(path.dirname(SYNC_LOG), { recursive: true });

  let logs = [];
  if (fs.existsSync(SYNC_LOG)) {
    try {
      logs = JSON.parse(fs.readFileSync(SYNC_LOG, 'utf8'));
      if (!Array.isArray(logs)) logs = [logs];
    } catch { logs = []; }
  }

  logs.push(log);

  // Keep last 100 entries
  if (logs.length > 100) logs = logs.slice(-100);

  fs.writeFileSync(SYNC_LOG, JSON.stringify(logs, null, 2), 'utf8');
}

/**
 * Main sync function
 */
async function runSync(direction, scope) {
  console.log(`🔗 HLDP 同步引擎启动 · direction=${direction} · scope=${scope}`);

  fs.mkdirSync(TEMP_DIR, { recursive: true });
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const stats = { fetched: 0, converted: 0, errors: 0 };

  if (direction === 'notion-to-github') {
    notionClient = initNotionClient();

    if (notionClient) {
      // Fetch from Notion API
      const targets = getSyncTargets(scope);

      if (targets.length === 0) {
        console.log('  ℹ️ 无同步目标配置 — 使用本地模式');
        runLocalSync();
      } else {
        for (const target of targets) {
          if (target.type === 'database') {
            stats.fetched += await fetchDatabase(notionClient, target.id, target.name);
          } else {
            stats.fetched += await fetchPage(notionClient, target.id, target.name);
          }
        }

        // Convert fetched data
        const converter = require('./notion-to-hldp');
        const files = fs.readdirSync(TEMP_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
          try {
            const raw = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, file), 'utf8'));
            const entries = raw.results
              ? converter.notionDatabaseToHLDP(raw)
              : [converter.notionPageToHLDP(raw, raw.blocks)];

            for (const entry of entries) {
              const typeDir = {
                persona: 'personas',
                registry: 'registries',
                instruction: 'instructions',
                broadcast: 'broadcasts',
                id_system: 'id-system'
              }[entry.data_type] || 'registries';

              const outDir = path.join(DATA_DIR, typeDir);
              fs.mkdirSync(outDir, { recursive: true });
              const safeName = entry.metadata.id.replace(/[^a-zA-Z0-9_-]/g, '_');
              fs.writeFileSync(path.join(outDir, `${safeName}.json`), JSON.stringify(entry, null, 2), 'utf8');
              stats.converted++;
            }
          } catch (e) {
            console.error(`  ❌ ${file}: ${e.message}`);
            stats.errors++;
          }
        }
      }
    } else {
      // No Notion token — run local sync
      runLocalSync();
    }
  }

  writeSyncLog(direction, scope, stats);
  console.log(`🔗 同步完成 · fetched=${stats.fetched} · converted=${stats.converted} · errors=${stats.errors}`);
}

// CLI entry
if (require.main === module) {
  const args = process.argv.slice(2);
  let direction = 'notion-to-github';
  let scope = 'all';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--direction' && args[i + 1]) { direction = args[i + 1]; i++; }
    if (args[i] === '--scope' && args[i + 1]) { scope = args[i + 1]; i++; }
  }

  runSync(direction, scope).catch(e => {
    console.error(`❌ 同步失败: ${e.message}`);
    process.exit(1);
  });
}

module.exports = { runSync };
