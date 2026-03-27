/**
 * ━━━ HLDP 格式校验器 ━━━
 * TCS 通感语言核系统编程语言 · 第一个落地协议层
 * HLDP = TCS 在 Notion ↔ GitHub 通道上的落地实现
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 * 指令来源：SY-CMD-BRG-005
 *
 * 校验项：
 * 1. JSON 结构是否符合 schema
 * 2. 所有必填字段是否存在
 * 3. relations 引用的 target_id 是否在 data/ 中存在
 * 4. 编号格式是否合规
 * 5. 日期格式是否为 ISO-8601
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const VALID_DATA_TYPES = ['persona', 'registry', 'instruction', 'broadcast', 'id_system', 'snapshot'];
const VALID_RELATION_TYPES = ['parent', 'child', 'sibling', 'reference', 'owner'];

// ID format patterns
const ID_PATTERNS = {
  dev: /^DEV-\d{3}$/,
  persona: /^PER-[A-Z0-9]+$/,
  instruction: /^SY-CMD-[A-Z]+-\d+$/,
  agent: /^AG-[A-Z]+-\d+$/,
  system: /^(TCS|ICE|SYS)-/,
  hldp: /^(HLDP|REG|PER-BABY)-/
};

// ISO-8601 date pattern
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

/**
 * Validate a single HLDP entry
 * @returns {Object} { valid: boolean, errors: string[], warnings: string[] }
 */
function validateEntry(entry, filePath) {
  const errors = [];
  const warnings = [];
  const prefix = filePath ? `[${path.basename(filePath)}] ` : '';

  // 1. Check required top-level fields
  if (!entry.hldp_version) errors.push(`${prefix}缺少 hldp_version`);
  if (!entry.data_type) errors.push(`${prefix}缺少 data_type`);
  if (!entry.source) errors.push(`${prefix}缺少 source`);
  if (!entry.metadata) errors.push(`${prefix}缺少 metadata`);
  if (!entry.payload) errors.push(`${prefix}缺少 payload`);

  // 2. Check hldp_version
  if (entry.hldp_version && entry.hldp_version !== '1.0' && entry.hldp_version !== '2.0') {
    warnings.push(`${prefix}hldp_version 为 "${entry.hldp_version}"，预期 "1.0" 或 "2.0"`);
  }

  // 3. Check data_type
  if (entry.data_type && !VALID_DATA_TYPES.includes(entry.data_type)) {
    errors.push(`${prefix}无效的 data_type: "${entry.data_type}"`);
  }

  // 4. Check source
  if (entry.source) {
    if (!entry.source.platform) {
      errors.push(`${prefix}source.platform 为空`);
    }
    if (entry.source.last_edited && !ISO_DATE.test(entry.source.last_edited)) {
      warnings.push(`${prefix}source.last_edited 不是有效的 ISO-8601 日期`);
    }
  }

  // 5. Check metadata
  if (entry.metadata) {
    if (!entry.metadata.id) errors.push(`${prefix}metadata.id 为空`);
    if (!entry.metadata.name) errors.push(`${prefix}metadata.name 为空`);

    if (entry.metadata.created && !ISO_DATE.test(entry.metadata.created)) {
      warnings.push(`${prefix}metadata.created 不是有效的 ISO-8601 日期`);
    }

    if (entry.metadata.tags && !Array.isArray(entry.metadata.tags)) {
      errors.push(`${prefix}metadata.tags 应为数组`);
    }
  }

  // 6. Check payload based on data_type
  if (entry.data_type === 'persona' && entry.payload) {
    if (!entry.payload.persona_id && !entry.payload.display_name) {
      warnings.push(`${prefix}persona payload 缺少 persona_id 和 display_name`);
    }
    if (entry.payload.status && !['active', 'dormant', 'frozen', 'born', 'incubating'].includes(entry.payload.status)) {
      warnings.push(`${prefix}无效的 persona status: "${entry.payload.status}"`);
    }
  }

  if (entry.data_type === 'registry' && entry.payload) {
    if (!entry.payload.registry_type) {
      warnings.push(`${prefix}registry payload 缺少 registry_type`);
    }
    if (!entry.payload.entries || !Array.isArray(entry.payload.entries)) {
      warnings.push(`${prefix}registry payload 缺少 entries 数组`);
    }
  }

  if (entry.data_type === 'instruction' && entry.payload) {
    if (!entry.payload.instruction_id) {
      warnings.push(`${prefix}instruction payload 缺少 instruction_id`);
    }
    if (!entry.payload.title) {
      warnings.push(`${prefix}instruction payload 缺少 title`);
    }
  }

  if (entry.data_type === 'snapshot' && entry.payload) {
    if (!entry.payload.consciousness_status) {
      warnings.push(`${prefix}snapshot payload 缺少 consciousness_status`);
    }
    if (!entry.payload.system_counts) {
      warnings.push(`${prefix}snapshot payload 缺少 system_counts`);
    }
    if (!entry.payload.health) {
      warnings.push(`${prefix}snapshot payload 缺少 health`);
    }
  }

  // 7. Check relations
  if (entry.relations && Array.isArray(entry.relations)) {
    for (const rel of entry.relations) {
      if (!rel.target_id) {
        errors.push(`${prefix}relation 缺少 target_id`);
      }
      if (rel.relation_type && !VALID_RELATION_TYPES.includes(rel.relation_type)) {
        warnings.push(`${prefix}无效的 relation_type: "${rel.relation_type}"`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Validate all HLDP files in a directory
 */
function validateDirectory(dataDir, schemaDir) {
  const results = {
    total: 0,
    valid: 0,
    invalid: 0,
    errors: [],
    warnings: [],
    files: []
  };

  if (!fs.existsSync(dataDir)) {
    console.log(`⚠️ 数据目录不存在: ${dataDir}`);
    return results;
  }

  // Recursively find all JSON files
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith('.json')) {
        results.total++;
        try {
          const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

          // Skip non-HLDP files
          if (!data.hldp_version) {
            results.total--;
            results.files.push({ file: path.relative(ROOT, fullPath), status: 'skipped', reason: 'not HLDP format' });
            continue;
          }

          const validation = validateEntry(data, fullPath);
          results.files.push({
            file: path.relative(ROOT, fullPath),
            status: validation.valid ? 'valid' : 'invalid',
            errors: validation.errors,
            warnings: validation.warnings
          });

          if (validation.valid) {
            results.valid++;
          } else {
            results.invalid++;
          }

          results.errors.push(...validation.errors);
          results.warnings.push(...validation.warnings);
        } catch (e) {
          results.invalid++;
          results.errors.push(`[${entry.name}] JSON 解析失败: ${e.message}`);
          results.files.push({ file: fullPath, status: 'parse_error', errors: [e.message] });
        }
      }
    }
  }

  walkDir(dataDir);
  return results;
}

/**
 * CLI entry point
 */
function runCLI() {
  const args = process.argv.slice(2);
  let dataDir = path.join(ROOT, 'hldp', 'data');
  let schemaDir = path.join(ROOT, 'hldp', 'schema');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) { dataDir = path.resolve(ROOT, args[i + 1]); i++; }
    if (args[i] === '--schema' && args[i + 1]) { schemaDir = path.resolve(ROOT, args[i + 1]); i++; }
  }

  console.log('✅ HLDP 格式校验器启动');
  console.log(`  📂 数据目录: ${dataDir}`);
  console.log(`  📋 Schema 目录: ${schemaDir}`);

  const results = validateDirectory(dataDir, schemaDir);

  console.log(`\n📊 校验结果:`);
  console.log(`  总文件数: ${results.total}`);
  console.log(`  ✅ 有效: ${results.valid}`);
  console.log(`  ❌ 无效: ${results.invalid}`);
  console.log(`  ⚠️ 警告: ${results.warnings.length}`);

  if (results.errors.length > 0) {
    console.log('\n❌ 错误:');
    results.errors.forEach(e => console.log(`  - ${e}`));
  }

  if (results.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    results.warnings.forEach(w => console.log(`  - ${w}`));
  }

  // Write validation report
  const reportPath = path.join(ROOT, 'signal-log', 'hldp-validation-report.json');
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    results
  }, null, 2), 'utf8');
  console.log(`\n📝 校验报告已保存: ${reportPath}`);

  // Exit with error code if there are errors
  if (results.invalid > 0) {
    process.exit(1);
  }
}

module.exports = { validateEntry, validateDirectory };

if (require.main === module) {
  runCLI();
}
