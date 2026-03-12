// scripts/contract-check.js
// 用途：确保每个 HLI 路由文件都有对应的 JSON Schema 且路径一致

const fs = require('fs');
const path = require('path');
const glob = require('glob');

const ROUTE_DIR = 'src/routes/hli';
const SCHEMA_DIR = 'src/schemas/hli';

// 扫描所有 HLI 路由文件
const routeFiles = glob.sync(`${ROUTE_DIR}/**/*.js`);
const errors = [];

routeFiles.forEach(routeFile => {
  const domain = path.basename(path.dirname(routeFile));
  const name = path.basename(routeFile, '.js');

  // 跳过 index.js（路由注册中心，无需 schema）
  if (name === 'index') return;

  const schemaPath = path.join(SCHEMA_DIR, domain, `${name}.schema.json`);

  // 检查1: 对应 schema 文件是否存在
  if (!fs.existsSync(schemaPath)) {
    errors.push(`❌ [MISSING SCHEMA] ${routeFile} → 缺少 ${schemaPath}`);
    return;
  }

  // 检查2: schema 文件格式是否合法
  try {
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    if (!schema.input || !schema.output) {
      errors.push(`❌ [INVALID SCHEMA] ${schemaPath} → 缺少 input/output 定义`);
    }
    if (!schema.hli_id) {
      errors.push(`❌ [MISSING HLI_ID] ${schemaPath} → 缺少 hli_id 字段`);
    }
  } catch (e) {
    errors.push(`❌ [PARSE ERROR] ${schemaPath} → ${e.message}`);
  }
});

if (errors.length > 0) {
  console.error('\n🚫 HLI Contract Check FAILED:\n');
  errors.forEach(e => console.error(e));
  process.exit(1);
} else {
  console.log('✅ HLI Contract Check PASSED — 所有路由均有合法 schema');
}
