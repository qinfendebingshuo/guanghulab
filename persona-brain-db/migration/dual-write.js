/**
 * 双写模式工具
 * Phase 2/3 启用
 *
 * 功能：新数据同时写入 Notion + persona-brain-db
 * 确保数据一致性，支持从Notion主→persona-brain-db主的渐进切换
 */

/**
 * 双写：同时写入Notion和persona-brain-db
 * @param {string} table - 目标表名
 * @param {object} data - 写入数据
 * @param {object} options - 配置选项
 */
async function dualWrite(table, data, options = {}) {
  const { notionClient, brainDbClient, primarySource = 'notion' } = options;

  console.log(`📝 双写模式 [${primarySource}为主] → ${table}`);

  const results = { notion: null, brainDb: null, errors: [] };

  // 写入主数据源
  try {
    if (primarySource === 'notion') {
      results.notion = await writeToNotion(notionClient, table, data);
      results.brainDb = await writeToBrainDb(brainDbClient, table, data);
    } else {
      results.brainDb = await writeToBrainDb(brainDbClient, table, data);
      results.notion = await writeToNotion(notionClient, table, data);
    }
  } catch (err) {
    results.errors.push(err.message);
    console.error(`❌ 双写失败: ${err.message}`);
  }

  return results;
}

async function writeToNotion(client, table, data) {
  // Phase 2/3 实现
  console.log(`  → Notion写入 [${table}]: 占位`);
  return { status: 'placeholder' };
}

async function writeToBrainDb(client, table, data) {
  // Phase 2/3 实现
  console.log(`  → BrainDB写入 [${table}]: 占位`);
  return { status: 'placeholder' };
}

module.exports = { dualWrite };
