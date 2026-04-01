/**
 * ═══════════════════════════════════════════════
 * 🔺 Sovereign: TCS-0002∞ | Root: SYS-GLW-0001
 * 📜 Copyright: 国作登字-2026-A-00037559
 * ═══════════════════════════════════════════════
 *
 * HLDP同步引擎 · 副将每日执行
 * 职责: 更新HLDP同步进度 · 同步到Notion · 生成进度报告
 */

const fs = require('fs');
const path = require('path');

const SYNC_PROGRESS_PATH = path.join(__dirname, '..', 'hldp', 'data', 'common', 'sync-progress.json');
const EVOLUTION_LOG_PATH = path.join(__dirname, '..', 'hldp', 'data', 'common', 'evolution-log.json');
const VOCABULARY_PATH = path.join(__dirname, '..', 'hldp', 'data', 'ontology', 'ONT-VOCABULARY.json');
const SNAPSHOTS_DIR = path.join(__dirname, '..', 'hldp', 'data', 'snapshots');
const SCHEMA_DIR = path.join(__dirname, '..', 'hldp', 'schema');

function countFiles(dir, ext) {
  try {
    return fs.readdirSync(dir).filter(f => !ext || f.endsWith(ext)).length;
  } catch { return 0; }
}

function loadJSON(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch { return null; }
}

function generateSyncReport() {
  console.log('[HLDP-SYNC] 🔄 开始HLDP同步进度更新...');

  const progress = loadJSON(SYNC_PROGRESS_PATH);
  if (!progress) {
    console.log('[HLDP-SYNC] ❌ 无法读取sync-progress.json');
    return null;
  }

  const vocabulary = loadJSON(VOCABULARY_PATH);
  const evolutionLog = loadJSON(EVOLUTION_LOG_PATH);

  // Update GitHub side status
  const vocabCount = vocabulary?.payload?.vocabulary?.length || 0;
  const schemaCount = countFiles(SCHEMA_DIR, '.json');
  const snapshotCount = countFiles(SNAPSHOTS_DIR, '.json');
  const evolutionCount = evolutionLog?.payload?.entries?.length || 0;

  progress.payload.github_side_status.vocabulary_count = vocabCount;
  progress.payload.github_side_status.schema_count = schemaCount;
  progress.payload.github_side_status.snapshots = snapshotCount;
  progress.payload.github_side_status.last_evolution = evolutionLog?.payload?.entries?.[evolutionLog.payload.entries.length - 1]?.evolution_id || 'N/A';

  // Update common protocol status
  progress.payload.common_protocol_status.evolution_entries = evolutionCount;
  progress.payload.last_sync = new Date().toISOString();
  progress.payload.sync_count += 1;

  // Update source timestamp
  progress.source.last_edited = new Date().toISOString();

  // Write updated progress
  fs.writeFileSync(SYNC_PROGRESS_PATH, JSON.stringify(progress, null, 2), 'utf8');

  console.log(`[HLDP-SYNC] ✅ 同步进度已更新`);
  console.log(`[HLDP-SYNC]   词汇: ${vocabCount} | Schema: ${schemaCount} | 快照: ${snapshotCount}`);
  console.log(`[HLDP-SYNC]   演化记录: ${evolutionCount} | 同步次数: ${progress.payload.sync_count}`);

  return progress;
}

// Attempt Notion sync if credentials available
async function syncToNotion(progress) {
  const token = process.env.ZY_NOTION_TOKEN || process.env.NOTION_TOKEN;
  const dbId = process.env.ZY_NOTION_CHANGELOG_DB;

  if (!token || !dbId) {
    console.log('[HLDP-SYNC] ⚠️ Notion密钥未配置·跳过Notion同步');
    return;
  }

  try {
    const { Client } = require('@notionhq/client');
    const notion = new Client({ auth: token });

    await notion.pages.create({
      parent: { database_id: dbId },
      properties: {
        'Name': { title: [{ text: { content: `HLDP同步 · ${new Date().toISOString().slice(0, 10)}` } }] },
        'Type': { select: { name: 'HLDP-Sync' } },
        'Status': { select: { name: 'completed' } }
      },
      children: [
        {
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{
              text: {
                content: `HLDP同步报告 · 词汇${progress.payload.github_side_status.vocabulary_count}个 · Schema${progress.payload.github_side_status.schema_count}个 · 快照${progress.payload.github_side_status.snapshots}个 · 通用词汇${progress.payload.common_protocol_status.common_vocabulary_count}个 · 同步次数${progress.payload.sync_count}`
              }
            }]
          }
        }
      ]
    });

    console.log('[HLDP-SYNC] ✅ Notion同步完成');
  } catch (err) {
    console.log(`[HLDP-SYNC] ⚠️ Notion同步失败: ${err.message}`);
  }
}

async function main() {
  const progress = generateSyncReport();
  if (progress) {
    await syncToNotion(progress);
  }
}

main().catch(err => {
  console.error(`[HLDP-SYNC] ❌ 执行失败: ${err.message}`);
  process.exit(1);
});
