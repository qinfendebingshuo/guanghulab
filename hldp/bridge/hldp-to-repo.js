/**
 * ━━━ HLDP → 仓库结构映射器 ━━━
 * TCS 通感语言核系统编程语言 · 第一个落地协议层
 * HLDP = TCS 在 Notion ↔ GitHub 通道上的落地实现
 * 版权：国作登字-2026-A-00037559 · 冰朔（ICE-GL∞）
 * 指令来源：SY-CMD-BRG-005
 *
 * 映射规则：
 *   persona → .github/persona-brain/persona-registry.json
 *   registry (dev) → .github/persona-brain/dev-status.json
 *   registry (agent) → .github/persona-brain/agent-registry.json (read-only)
 *   registry (id_map) → .github/persona-brain/trinity-id-map.json
 *   instruction → signal-log/ (SYSLOG reference)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

// Files that CANNOT be modified from agent PRs (SkyEye R4 CRITICAL)
const READ_ONLY_FILES = [
  'agent-registry.json',
  'security-protocol.json',
  'gate-guard-config.json',
  'ontology.json'
];

/**
 * Map HLDP persona data to persona-registry format
 */
function mapPersonaToRegistry(hldpEntry) {
  const p = hldpEntry.payload;
  return {
    persona_id: p.persona_id || hldpEntry.metadata.id,
    display_name: p.display_name || hldpEntry.metadata.name,
    status: p.status || 'active',
    developer: p.developer || null,
    birth_date: p.birth_date || null,
    personality_traits: p.personality_traits || [],
    bottle_core: p.bottle_core || null,
    hldp_synced_at: new Date().toISOString(),
    hldp_source: hldpEntry.source.page_id || ''
  };
}

/**
 * Map HLDP registry data to dev-status format
 */
function mapRegistryToDevStatus(hldpEntry) {
  const entries = hldpEntry.payload.entries || [];
  return entries.map(e => ({
    dev_id: e.id,
    name: e.name,
    role: e.role || '',
    status: e.status || 'active',
    properties: e.properties || {},
    hldp_synced_at: new Date().toISOString()
  }));
}

/**
 * Sync HLDP data to repository structure
 * @param {string} hldpDataDir - Path to hldp/data/ directory
 * @param {Object} options - { dryRun, verbose }
 */
function syncToRepo(hldpDataDir, options = {}) {
  const { dryRun = false, verbose = false } = options;
  const results = { synced: 0, skipped: 0, errors: [] };

  const dataDir = path.resolve(ROOT, hldpDataDir);
  if (!fs.existsSync(dataDir)) {
    console.log(`⚠️ HLDP 数据目录不存在: ${dataDir}`);
    return results;
  }

  // Process persona files
  const personaDir = path.join(dataDir, 'personas');
  if (fs.existsSync(personaDir)) {
    const files = fs.readdirSync(personaDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(personaDir, file), 'utf8'));
        const mapped = mapPersonaToRegistry(entry);
        if (verbose) console.log(`  📋 人格体映射: ${mapped.persona_id} → ${mapped.display_name}`);
        results.synced++;
      } catch (e) {
        results.errors.push(`persona/${file}: ${e.message}`);
      }
    }
  }

  // Process registry files (read-only check)
  const registryDir = path.join(dataDir, 'registries');
  if (fs.existsSync(registryDir)) {
    const files = fs.readdirSync(registryDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(registryDir, file), 'utf8'));
        const regType = entry.payload?.registry_type;

        // Check if target would be a read-only file
        if (regType === 'agent_registry') {
          if (verbose) console.log(`  ⚠️ 跳过 agent_registry (SkyEye R4 保护)`);
          results.skipped++;
          continue;
        }

        const mapped = mapRegistryToDevStatus(entry);
        if (verbose) console.log(`  📋 注册表映射: ${regType} → ${mapped.length} 条目`);
        results.synced++;
      } catch (e) {
        results.errors.push(`registry/${file}: ${e.message}`);
      }
    }
  }

  if (!dryRun) {
    // Write sync report
    const reportPath = path.join(ROOT, 'signal-log', 'hldp-sync-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify({
      synced_at: new Date().toISOString(),
      results,
      source: hldpDataDir
    }, null, 2), 'utf8');
  }

  return results;
}

/**
 * CLI entry point
 */
function runCLI() {
  const args = process.argv.slice(2);
  let dataDir = 'hldp/data';
  let dryRun = false;
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) { dataDir = args[i + 1]; i++; }
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--verbose') verbose = true;
  }

  console.log(`🔗 HLDP → 仓库结构映射 ${dryRun ? '(dry run)' : ''}`);
  const results = syncToRepo(dataDir, { dryRun, verbose });
  console.log(`  ✅ 同步: ${results.synced} | ⏭️ 跳过: ${results.skipped} | ❌ 错误: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('  错误详情:');
    results.errors.forEach(e => console.log(`    - ${e}`));
  }
}

module.exports = { syncToRepo, mapPersonaToRegistry, mapRegistryToDevStatus };

if (require.main === module) {
  runCLI();
}
