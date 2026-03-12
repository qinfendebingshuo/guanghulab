// scripts/daily-check.js
// 铸渊每日自检脚本
// 用途：检查大脑完整性 + 输出覆盖率报告

const fs = require('fs');
const path = require('path');

const ROUTING_MAP_PATH = path.join(__dirname, '../.github/brain/routing-map.json');
const MEMORY_PATH = path.join(__dirname, '../.github/brain/memory.json');
const SCHEMA_DIR = path.join(__dirname, '../src/schemas/hli');

const errors = [];
const warnings = [];

// ── 1. 大脑文件完整性检查 ─────────────────────────────────────────────────
function checkFileIntegrity() {
  [ROUTING_MAP_PATH, MEMORY_PATH].forEach(filePath => {
    if (!fs.existsSync(filePath)) {
      errors.push(`❌ [MISSING] 大脑文件缺失: ${path.basename(filePath)}`);
      return;
    }
    try {
      JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      errors.push(`❌ [CORRUPT] 大脑文件损坏: ${path.basename(filePath)} → ${e.message}`);
    }
  });
}

// ── 2. HLI 覆盖率报告 ────────────────────────────────────────────────────
function checkCoverage() {
  const routingMap = JSON.parse(fs.readFileSync(ROUTING_MAP_PATH, 'utf8'));
  let total = 0;
  let implemented = 0;
  let pending = 0;

  console.log('\n📊 HLI 接口覆盖率报告:\n');

  Object.entries(routingMap.domains).forEach(([domain, domainData]) => {
    const domainTotal = domainData.interfaces.length;
    const domainImpl = domainData.interfaces.filter(i => i.status === 'implemented').length;
    total += domainTotal;
    implemented += domainImpl;
    pending += domainTotal - domainImpl;

    const icon = domainImpl === domainTotal ? '✅' : domainImpl > 0 ? '🔶' : '⬜';
    console.log(`  ${icon} ${domain.padEnd(12)} ${domainImpl}/${domainTotal}`);

    domainData.interfaces.forEach(iface => {
      const statusIcon = iface.status === 'implemented' ? '  ✓' : '  ○';
      console.log(`       ${statusIcon} ${iface.id.padEnd(20)} ${iface.path}`);
    });
  });

  const percent = total > 0 ? ((implemented / total) * 100).toFixed(1) : 0;
  console.log(`\n  📈 总覆盖率: ${implemented}/${total} (${percent}%)`);
  console.log(`  ✅ 已实现: ${implemented} · ⏳ 待实现: ${pending}\n`);

  if (implemented < total) {
    warnings.push(`⚠️  覆盖率 ${percent}% (${implemented}/${total}) — 仍有 ${pending} 个接口待实现`);
  }

  // 检查 schema 文件与 routing-map 的一致性
  Object.entries(routingMap.domains).forEach(([domain, domainData]) => {
    domainData.interfaces.forEach(iface => {
      if (iface.status !== 'implemented') return;
      const schemaDir = path.join(SCHEMA_DIR, domain.toLowerCase());
      if (!fs.existsSync(schemaDir)) {
        errors.push(`❌ [MISSING DIR] ${domain} schema 目录不存在`);
        return;
      }
      const rawAction = iface.path.split('/').filter(Boolean).pop();
      const action = rawAction ? rawAction.replace(/[?#].*$/, '') : null;
      if (!action) {
        errors.push(`❌ [INVALID PATH] ${iface.id} 路径格式异常: ${iface.path}`);
        return;
      }
      const schemaFile = path.join(schemaDir, `${action}.schema.json`);
      if (!fs.existsSync(schemaFile)) {
        errors.push(`❌ [MISSING SCHEMA] ${iface.id} 标记为 implemented 但缺少 schema: ${schemaFile}`);
      }
    });
  });
}

// ── 3. memory.json 健康检查 ────────────────────────────────────────────────
function checkMemory() {
  const memory = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  const required = ['identity', 'rules_version', 'stats', 'events'];
  required.forEach(field => {
    if (memory[field] === undefined) {
      errors.push(`❌ [MEMORY] memory.json 缺少字段: ${field}`);
    }
  });
  console.log(`🧠 铸渊记忆状态:`);
  console.log(`   规则版本: ${memory.rules_version}`);
  console.log(`   CI 运行次数: ${memory.stats?.ci_runs ?? 0}`);
  console.log(`   PR 审核次数: ${memory.stats?.pr_reviews ?? 0}`);
  console.log(`   广播处理次数: ${memory.stats?.broadcasts_processed ?? 0}`);
  console.log(`   最近更新: ${memory.last_updated || '未知'}\n`);
}

// ── 主流程 ────────────────────────────────────────────────────────────────
console.log('═══════════════════════════════════════════');
console.log('⚒️  铸渊每日自检报告');
console.log(`   时间: ${new Date().toISOString()}`);
console.log('═══════════════════════════════════════════\n');

checkFileIntegrity();

if (errors.length === 0) {
  checkMemory();
  checkCoverage();
}

if (warnings.length > 0) {
  console.log('⚠️  警告:\n');
  warnings.forEach(w => console.log('  ' + w));
  console.log();
}

if (errors.length > 0) {
  console.error('🚫 自检发现严重错误:\n');
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
} else {
  console.log('✅ 铸渊自检通过 — 大脑状态正常');
}
