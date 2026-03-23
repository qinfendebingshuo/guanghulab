/**
 * scripts/grid-db/generate-drive-index.js
 *
 * 功能：读取 dev-module-map.json，为每个活跃 DEV 生成专属的 Drive index.json
 *
 * 输出：grid-db/drive-index/DEV-XXX.json（每个活跃 DEV 一个文件）
 *
 * 触发：被 sync-to-drive.js 调用，或独立运行
 *
 * 守护: PER-ZY001 铸渊
 * 系统: SYS-GLW-0001
 */

const fs = require('fs');
const path = require('path');

const GRID_DB_ROOT = path.join(__dirname, '../../grid-db');
const RULES_DIR = path.join(GRID_DB_ROOT, 'rules');
const INDEX_DIR = path.join(GRID_DB_ROOT, 'drive-index');
const TEMPLATE_PATH = path.join(GRID_DB_ROOT, 'schema/drive-index-template.json');

function main() {
  // 读取开发者映射表
  const moduleMapPath = path.join(RULES_DIR, 'dev-module-map.json');
  if (!fs.existsSync(moduleMapPath)) {
    console.log('[generate-drive-index] dev-module-map.json not found, skipping');
    return;
  }

  const moduleMap = JSON.parse(fs.readFileSync(moduleMapPath, 'utf8'));

  // 读取索引模板
  if (!fs.existsSync(TEMPLATE_PATH)) {
    console.log('[generate-drive-index] drive-index-template.json not found, skipping');
    return;
  }

  const templateData = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
  const template = templateData.template;

  // 确保输出目录存在
  if (!fs.existsSync(INDEX_DIR)) {
    fs.mkdirSync(INDEX_DIR, { recursive: true });
  }

  const now = new Date().toISOString();
  let generated = 0;

  // 为每个活跃 DEV 生成 index.json
  for (const [devId, devInfo] of Object.entries(moduleMap.mappings)) {
    if (!devInfo.active) continue;
    if (!devInfo.persona_id) continue;

    const index = {
      system: template.system,
      version: template.version,
      dev_id: devId,
      persona_id: devInfo.persona_id,
      persona_name: devInfo.persona_name,
      dev_name: devInfo.dev_name,
      last_sync: now,
      routes: {}
    };

    // 替换模板中的 {DEV_ID} 占位符
    for (const [key, val] of Object.entries(template.routes)) {
      index.routes[key] = val.replace(/\{DEV_ID\}/g, devId);
    }

    index.shortcuts = { ...template.shortcuts };

    const outputPath = path.join(INDEX_DIR, `${devId}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(index, null, 2) + '\n');
    generated++;
    console.log(`[generate-drive-index] Generated: ${devId}.json`);
  }

  console.log(`[generate-drive-index] Total generated: ${generated}`);
}

module.exports = { main };

if (require.main === module) {
  main();
}
