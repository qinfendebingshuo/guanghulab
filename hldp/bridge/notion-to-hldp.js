/**
 * ━━━ HLDP Notion → HLDP 转换器 ━━━
 * TCS 通感语言核系统编程语言 · 第一个落地协议层
 * HLDP = TCS 在 Notion ↔ GitHub 通道上的落地实现
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 * 指令来源：SY-CMD-BRG-005
 *
 * 转换规则：
 * 1. Notion 页面标题 → metadata.name
 * 2. Notion 页面属性 → payload 中对应字段
 * 3. Notion @提及 → relations 数组
 * 4. Notion 关系属性 → relations 数组
 * 5. Notion 选择/多选属性 → payload 中的字符串/数组
 * 6. Notion 日期属性 → ISO-8601 字符串
 * 7. Notion 页面内容（blocks）→ payload.content（Markdown 格式）
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const fs = require('fs');
const path = require('path');

const HLDP_VERSION = '1.0';

/**
 * Extract plain text from Notion rich_text array
 */
function extractPlainText(richTextArr) {
  if (!Array.isArray(richTextArr)) return '';
  return richTextArr.map(t => t.plain_text || '').join('');
}

/**
 * Extract title from Notion page properties
 */
function extractTitle(properties) {
  for (const [, prop] of Object.entries(properties || {})) {
    if (prop.type === 'title') {
      return extractPlainText(prop.title);
    }
  }
  return '';
}

/**
 * Convert a Notion property to a plain value
 */
function convertProperty(prop) {
  if (!prop) return null;

  switch (prop.type) {
    case 'title':
      return extractPlainText(prop.title);
    case 'rich_text':
      return extractPlainText(prop.rich_text);
    case 'number':
      return prop.number;
    case 'select':
      return prop.select ? prop.select.name : null;
    case 'multi_select':
      return (prop.multi_select || []).map(s => s.name);
    case 'date':
      return prop.date ? prop.date.start : null;
    case 'checkbox':
      return prop.checkbox;
    case 'url':
      return prop.url;
    case 'email':
      return prop.email;
    case 'phone_number':
      return prop.phone_number;
    case 'formula':
      return prop.formula ? convertFormulaResult(prop.formula) : null;
    case 'relation':
      return (prop.relation || []).map(r => r.id);
    case 'rollup':
      return prop.rollup ? prop.rollup.array : null;
    case 'people':
      return (prop.people || []).map(p => p.name || p.id);
    case 'status':
      return prop.status ? prop.status.name : null;
    default:
      return null;
  }
}

function convertFormulaResult(formula) {
  switch (formula.type) {
    case 'string': return formula.string;
    case 'number': return formula.number;
    case 'boolean': return formula.boolean;
    case 'date': return formula.date ? formula.date.start : null;
    default: return null;
  }
}

/**
 * Convert Notion blocks to Markdown
 */
function blocksToMarkdown(blocks) {
  if (!Array.isArray(blocks)) return '';

  return blocks.map(block => {
    const text = extractPlainText(block[block.type]?.rich_text || []);

    switch (block.type) {
      case 'paragraph': return text;
      case 'heading_1': return `# ${text}`;
      case 'heading_2': return `## ${text}`;
      case 'heading_3': return `### ${text}`;
      case 'bulleted_list_item': return `- ${text}`;
      case 'numbered_list_item': return `1. ${text}`;
      case 'to_do': {
        const checked = block.to_do?.checked ? 'x' : ' ';
        return `- [${checked}] ${text}`;
      }
      case 'toggle': return `<details><summary>${text}</summary></details>`;
      case 'code': {
        const lang = block.code?.language || '';
        return `\`\`\`${lang}\n${text}\n\`\`\``;
      }
      case 'quote': return `> ${text}`;
      case 'callout': {
        const icon = block.callout?.icon?.emoji || '💡';
        return `> ${icon} ${text}`;
      }
      case 'divider': return '---';
      default: return text;
    }
  }).filter(Boolean).join('\n\n');
}

/**
 * Extract relations from Notion properties
 */
function extractRelations(properties) {
  const relations = [];

  for (const [key, prop] of Object.entries(properties || {})) {
    if (prop.type === 'relation' && Array.isArray(prop.relation)) {
      for (const rel of prop.relation) {
        relations.push({
          target_id: rel.id,
          relation_type: 'reference',
          description: `Notion relation: ${key}`
        });
      }
    }
  }

  return relations;
}

/**
 * Detect data_type from Notion page properties and tags
 */
function detectDataType(properties, tags) {
  const allTags = (tags || []).map(t => t.toLowerCase());
  const title = extractTitle(properties).toLowerCase();

  if (allTags.includes('persona') || allTags.includes('人格体') || title.includes('人格体')) return 'persona';
  if (allTags.includes('registry') || allTags.includes('注册表') || title.includes('注册表')) return 'registry';
  if (allTags.includes('instruction') || allTags.includes('指令') || title.includes('指令')) return 'instruction';
  if (allTags.includes('broadcast') || allTags.includes('广播') || title.includes('广播')) return 'broadcast';
  if (allTags.includes('id_system') || allTags.includes('编号') || title.includes('编号')) return 'id_system';

  return 'registry'; // default fallback
}

/**
 * Convert a Notion page to HLDP JSON format
 * @param {Object} page - Notion API page object
 * @param {Array} blocks - Notion page blocks (optional)
 * @param {string} dataType - Override data_type detection
 * @returns {Object} HLDP JSON
 */
function notionPageToHLDP(page, blocks, dataType) {
  const properties = page.properties || {};
  const title = extractTitle(properties);

  // Extract tags from multi_select property named 'Tags' or '标签'
  const tagsProp = properties.Tags || properties['标签'];
  const tags = tagsProp?.type === 'multi_select'
    ? (tagsProp.multi_select || []).map(s => s.name)
    : [];

  const type = dataType || detectDataType(properties, tags);

  // Build payload from all non-system properties
  const payload = {};
  for (const [key, prop] of Object.entries(properties)) {
    const val = convertProperty(prop);
    if (val !== null && val !== '' && key !== 'Tags' && key !== '标签') {
      payload[key] = val;
    }
  }

  // Add content from blocks if provided
  if (blocks && blocks.length > 0) {
    payload.content = blocksToMarkdown(blocks);
  }

  // Extract ID from properties or generate from title
  const idProp = properties['ID'] || properties['编号'] || properties['id'];
  const id = idProp ? convertProperty(idProp) : `HLDP-${Date.now()}`;

  return {
    hldp_version: HLDP_VERSION,
    data_type: type,
    source: {
      platform: 'notion',
      page_url: page.url || '',
      page_id: page.id || '',
      last_edited: page.last_edited_time || new Date().toISOString(),
      edited_by: page.last_edited_by?.name || 'unknown'
    },
    metadata: {
      id: String(id),
      name: title,
      name_en: '',
      created: page.created_time || new Date().toISOString(),
      tags
    },
    payload,
    relations: extractRelations(properties)
  };
}

/**
 * Convert a Notion database query result to an array of HLDP entries
 * @param {Object} queryResult - Notion API database query result
 * @param {string} dataType - Data type for all entries
 * @returns {Array} Array of HLDP JSON objects
 */
function notionDatabaseToHLDP(queryResult, dataType) {
  const results = queryResult.results || [];
  return results.map(page => notionPageToHLDP(page, null, dataType));
}

/**
 * CLI: Convert raw Notion JSON files to HLDP format
 */
function runCLI() {
  const args = process.argv.slice(2);
  let inputDir = '';
  let outputDir = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--input' && args[i + 1]) { inputDir = args[i + 1]; i++; }
    if (args[i] === '--output' && args[i + 1]) { outputDir = args[i + 1]; i++; }
  }

  if (!inputDir || !outputDir) {
    console.log('Usage: node notion-to-hldp.js --input <raw-dir> --output <hldp-data-dir>');
    process.exit(1);
  }

  const root = path.resolve(__dirname, '../..');
  inputDir = path.resolve(root, inputDir);
  outputDir = path.resolve(root, outputDir);

  if (!fs.existsSync(inputDir)) {
    console.log(`⚠️ 输入目录不存在: ${inputDir}`);
    process.exit(0);
  }

  let converted = 0;
  let failed = 0;

  const files = fs.readdirSync(inputDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(inputDir, file), 'utf8'));

      // Handle both single page and database query results
      let hldpEntries;
      if (raw.results) {
        hldpEntries = notionDatabaseToHLDP(raw);
      } else if (raw.id) {
        hldpEntries = [notionPageToHLDP(raw)];
      } else {
        console.warn(`  ⚠️ 无法识别格式: ${file}`);
        failed++;
        continue;
      }

      // Determine output subdirectory based on data_type
      for (const entry of hldpEntries) {
        const typeDir = {
          persona: 'personas',
          registry: 'registries',
          instruction: 'instructions',
          broadcast: 'broadcasts',
          id_system: 'id-system'
        }[entry.data_type] || 'registries';

        const outDir = path.join(outputDir, typeDir);
        fs.mkdirSync(outDir, { recursive: true });

        const safeName = entry.metadata.id.replace(/[^a-zA-Z0-9_-]/g, '_');
        const outFile = path.join(outDir, `${safeName}.json`);
        fs.writeFileSync(outFile, JSON.stringify(entry, null, 2), 'utf8');
        converted++;
      }
    } catch (e) {
      console.error(`  ❌ 转换失败 ${file}: ${e.message}`);
      failed++;
    }
  }

  console.log(`🔄 Notion → HLDP 转换完成: ${converted} 条成功, ${failed} 条失败`);
}

// Export for programmatic use
module.exports = {
  notionPageToHLDP,
  notionDatabaseToHLDP,
  extractPlainText,
  blocksToMarkdown,
  convertProperty,
  HLDP_VERSION
};

// CLI entry point
if (require.main === module) {
  runCLI();
}
