// 用途：确保每个 HLI 路由文件都有对应的 JSON Schema 且格式合法
const fs = require('fs');
const path = require('path');

const ROUTE_DIR = 'src/routes/hli';
const SCHEMA_DIR = 'src/schemas/hli';
const errors = [];

// 获取所有业务域目录
const domains = fs.readdirSync(ROUTE_DIR).filter(f => {
  return fs.statSync(path.join(ROUTE_DIR, f)).isDirectory();
});

domains.forEach(domain => {
  const routeDir = path.join(ROUTE_DIR, domain);
  const schemaDir = path.join(SCHEMA_DIR, domain);

  // 扫描路由文件（排除 index.js 路由聚合文件）
  const routeFiles = fs.readdirSync(routeDir).filter(f => f.endsWith('.js') && f !== 'index.js');
  
  routeFiles.forEach(routeFile => {
    const name = path.basename(routeFile, '.js');
    const schemaPath = path.join(schemaDir, name + '.schema.json');
    
    if (!fs.existsSync(schemaPath)) {
      errors.push('❌ [MISSING] ' + routeFile + ' → 缺少 ' + schemaPath);
      return;
    }
    
    try {
      const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
      if (!schema.input || !schema.output) {
        errors.push('❌ [INVALID] ' + schemaPath + ' → 缺少 input/output');
      }
      if (!schema.hli_id) {
        errors.push('❌ [NO ID] ' + schemaPath + ' → 缺少 hli_id');
      }
    } catch (e) {
      errors.push('❌ [PARSE] ' + schemaPath + ' → ' + e.message);
    }
  });
});

if (errors.length > 0) {
  console.error('\n❌ HLI Contract Check FAILED:\n');
  errors.forEach(e => console.error(e));
  process.exit(1);
} else {
  console.log('✅ HLI Contract Check PASSED');
}
